"""Read-only short handovers via Gnani Batch. No retries or factory mutations."""
import asyncio
import audioop
import io
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from .gnani_client import DEFAULT_BASE_URL, get_stt_config, _env_bool

MAX_BYTES = 10_000_000
MAX_SECONDS = 90
TOTAL_TIMEOUT = 120


class HandoverError(Exception):
    def __init__(self, code, status=502):
        self.code, self.status = code, status
        super().__init__(code)


def validate_audio(data):
    if not data or len(data) > MAX_BYTES:
        raise HandoverError('audio_size_limit', 413)
    # PCM WAV is validated/resampled locally even when ffmpeg is not on PATH.
    if data[:4] == b'RIFF' and data[8:12] == b'WAVE':
        try:
            with wave.open(io.BytesIO(data), 'rb') as source:
                rate, channels = source.getframerate(), source.getnchannels()
                if source.getsampwidth() != 2 or channels not in (1, 2) or not 8000 <= rate <= 192000:
                    raise HandoverError('invalid_audio', 422)
                pcm = source.readframes(rate * 91)
            if len(pcm) % (2 * channels): raise HandoverError('invalid_audio', 422)
            duration = len(pcm) / (rate * channels * 2)
            if not .1 <= duration <= MAX_SECONDS: raise HandoverError('audio_duration_limit', 422)
            if channels == 2: pcm = audioop.tomono(pcm, 2, .5, .5)
            if rate != 16000: pcm = audioop.ratecv(pcm, 2, 1, rate, 16000, None)[0]
            result = io.BytesIO()
            with wave.open(result, 'wb') as target:
                target.setnchannels(1); target.setsampwidth(2); target.setframerate(16000); target.writeframes(pcm)
            return result.getvalue(), duration
        except (wave.Error, EOFError):
            raise HandoverError('invalid_audio', 422) from None
    if len(data) < 12:
        raise HandoverError('invalid_audio', 422)
    if not shutil.which('ffmpeg'):
        raise HandoverError('audio_decoder_unavailable', 503)
    # Decode actual samples; container duration metadata alone is not trustworthy.
    with tempfile.TemporaryDirectory() as folder:
        source, target = Path(folder) / 'input', Path(folder) / 'audio.wav'
        source.write_bytes(data)
        try:
            proc = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'wav,matroska,webm,mov,mp3,ogg,aac,flac',
                '-i', str(source), '-t', '91', '-vn',
                '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', str(target)],
                capture_output=True, timeout=30)
            if proc.returncode or not target.exists():
                raise HandoverError('invalid_audio', 422)
            wav = target.read_bytes()
            with wave.open(io.BytesIO(wav), 'rb') as audio:
                duration = audio.getnframes() / audio.getframerate()
        except (subprocess.TimeoutExpired, wave.Error, EOFError):
            raise HandoverError('invalid_audio', 422) from None
    if not .1 <= duration <= MAX_SECONDS:
        raise HandoverError('audio_duration_limit', 422)
    return wav, duration


def batch_config():
    return {'model': 'prisma-v3.0', 'language_code': 'ta-IN,en-IN,hi-IN' if _env_bool('LANG_BRIDGE') else 'ta-IN,en-IN',
            'format': 'codemix', 'keyterms': get_stt_config()['keyterms'].split(','),
            'mode': 'transcribe', 'with_diarization': True, 'num_speakers': 2}


def safe_result(document, job_id, duration, key):
    rows = document.get('segments')
    if not isinstance(rows, list) or len(rows) > 5000:
        raise HandoverError('invalid_result')
    speakers, segments = {}, []
    def label(value):
        if value is None or value == -1:
            return 'Speaker unknown'
        identity = str(value)
        if identity not in speakers:
            speakers[identity] = f'Speaker {len(speakers) + 1}'
        return speakers[identity]
    for row in rows:
        start, end = float(row['start_time']), float(row['end_time'])
        if not math.isfinite(start + end) or start < 0 or end < start or end > duration + 1:
            raise HandoverError('invalid_result')
        def tag(name):
            value = row.get(name)
            return value if isinstance(value, str) and len(value) <= 80 and not re.search(r'https?://', value) else None
        segments.append({'speaker': label(row.get('speaker_id')), 'start': start, 'end': end,
                         'text': str(row.get('text') or '')[:12000], 'emotion': tag('emotion'),
                         'sentiment': tag('sentiment'), 'language_detected': tag('language_detected')})
    result = {'segments': segments, 'job_id': job_id, 'duration_s': round(duration, 3)}
    if key and key in json.dumps(result, ensure_ascii=False):
        raise HandoverError('invalid_result')
    return result


class GnaniBatchClient:
    def __init__(self):
        self.key = os.getenv('GNANI_API_KEY', '').strip()
        self.base = os.getenv('GNANI_BASE_URL', DEFAULT_BASE_URL).rstrip('/')

    async def transcribe(self, audio, duration, *, job_id=None):
        if not self.key or _env_bool('GNANI_MOCK'):
            raise HandoverError('handover_unavailable', 503)
        headers = {'X-API-Key-ID': self.key}
        try:
            async with asyncio.timeout(TOTAL_TIMEOUT):
                async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
                    async def request(method, path, **kwargs):
                        for attempt in range(3):
                            response = await client.request(method, self.base + path, headers=headers, **kwargs)
                            retry = (method == 'GET' and response.status_code in (429, 500, 502, 503, 504)
                                     or path.endswith('/start') and response.status_code == 429)
                            if not retry or attempt == 2:
                                break
                            try: pause = float(response.headers.get('Retry-After', '10'))
                            except ValueError: pause = 10
                            await asyncio.sleep(min(30, max(10, pause)))
                        if response.status_code not in (200, 201, 202):
                            raise HandoverError('batch_upstream_error')
                        return response.json()
                    resume = job_id is not None
                    if not resume:
                        created = await request('POST', '/stt/v3/batch/jobs',
                            files={'config': (None, json.dumps(batch_config()), 'application/json'),
                                   'files': ('handover.wav', audio, 'audio/wav')})
                        job_id = created['job_id']
                    if not re.fullmatch(r'[a-zA-Z0-9-]{1,80}', job_id):
                        raise HandoverError('invalid_result')
                    path = '/stt/v3/batch/jobs/' + job_id
                    if not resume:
                        await request('POST', path + '/start', json={})
                    delay = 10
                    while True:
                        await asyncio.sleep(delay)
                        state = (await request('GET', path))['status']
                        if state in ('COMPLETED', 'PARTIAL_FAILURE'):
                            break
                        if state in ('FAILED', 'START_FAILED', 'CANCELLED'):
                            raise HandoverError('batch_failed')
                        if state not in ('CREATED', 'STARTING', 'QUEUED', 'IN_PROGRESS', 'CANCELLING'):
                            raise HandoverError('invalid_result')
                        delay = min(20, delay * 1.5)
                    files = (await request('GET', path + '/files', params={'status': 'COMPLETED'})).get('data', [])
                    if len(files) != 1 or not files[0].get('transcript_url'):
                        raise HandoverError('batch_failed')
                    url = files[0]['transcript_url']
                    parsed = urlsplit(url)
                    # Only the provider's result storage, no credentials, no redirects.
                    if parsed.scheme != 'https' or parsed.username or parsed.password or not parsed.hostname or not parsed.hostname.endswith('.amazonaws.com'):
                        raise HandoverError('invalid_result_url')
                    response = await client.get(url)  # Never send the API key to storage.
                    if response.status_code != 200 or len(response.content) > 2_000_000:
                        raise HandoverError('batch_result_unavailable')
                    return safe_result(response.json(), job_id, duration, self.key)
        except HandoverError:
            raise
        except (TimeoutError, httpx.TimeoutException):
            raise HandoverError('batch_timeout', 504) from None
        except Exception:
            raise HandoverError('batch_unavailable', 502) from None
