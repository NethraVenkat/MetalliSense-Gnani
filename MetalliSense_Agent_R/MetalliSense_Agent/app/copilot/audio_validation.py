"""Local capture validation shared by optional audio evidence; no provider calls."""
import audioop
import io
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

MAX_BYTES = 10_000_000
MAX_SECONDS = 90


class AudioValidationError(Exception):
    def __init__(self, code, status=502):
        self.code, self.status = code, status
        super().__init__(code)


def validate_audio(data):
    if not data or len(data) > MAX_BYTES:
        raise AudioValidationError('audio_size_limit', 413)
    # PCM WAV is validated/resampled locally even when ffmpeg is not on PATH.
    if data[:4] == b'RIFF' and data[8:12] == b'WAVE':
        try:
            with wave.open(io.BytesIO(data), 'rb') as source:
                rate, channels = source.getframerate(), source.getnchannels()
                if source.getsampwidth() != 2 or channels not in (1, 2) or not 8000 <= rate <= 192000:
                    raise AudioValidationError('invalid_audio', 422)
                pcm = source.readframes(rate * 91)
            if len(pcm) % (2 * channels): raise AudioValidationError('invalid_audio', 422)
            duration = len(pcm) / (rate * channels * 2)
            if not .1 <= duration <= MAX_SECONDS: raise AudioValidationError('audio_duration_limit', 422)
            if channels == 2: pcm = audioop.tomono(pcm, 2, .5, .5)
            if rate != 16000: pcm = audioop.ratecv(pcm, 2, 1, rate, 16000, None)[0]
            result = io.BytesIO()
            with wave.open(result, 'wb') as target:
                target.setnchannels(1); target.setsampwidth(2); target.setframerate(16000); target.writeframes(pcm)
            return result.getvalue(), duration
        except (wave.Error, EOFError):
            raise AudioValidationError('invalid_audio', 422) from None
    if len(data) < 12:
        raise AudioValidationError('invalid_audio', 422)
    if not shutil.which('ffmpeg'):
        raise AudioValidationError('audio_decoder_unavailable', 503)
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
                raise AudioValidationError('invalid_audio', 422)
            wav = target.read_bytes()
            with wave.open(io.BytesIO(wav), 'rb') as audio:
                duration = audio.getnframes() / audio.getframerate()
        except (subprocess.TimeoutExpired, wave.Error, EOFError):
            raise AudioValidationError('invalid_audio', 422) from None
    if not .1 <= duration <= MAX_SECONDS:
        raise AudioValidationError('audio_duration_limit', 422)
    return wav, duration

