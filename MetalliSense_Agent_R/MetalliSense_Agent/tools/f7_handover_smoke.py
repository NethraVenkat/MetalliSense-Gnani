"""Explicitly budgeted synthetic two-voice handover smoke test. No human audio.

One <=20s batch smoke job, at most six TTS attempts. Durable counters prevent
accidental repeats; downloads/status requests are not additional batch jobs.
"""
import io
import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
import sys
import time
import wave

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
LINES = [('Kalpana','Heat one zero five three is fine.'),
         ('Avinash','Heat one zero five two has a problem.'),
         ('Kalpana','Heat one zero five three is on hold.')]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resume', action='store_true', help='Poll/download the existing started job, no new job')
    parser.add_argument('--new-job', action='store_true', help='Explicit additional authorized job; same cached audio')
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    logging.disable(logging.CRITICAL)  # Never log signed URLs or HTTP headers.
    os.environ['HANDOVER_ENABLED'] = 'on'  # Process-local, never edit .env.
    from app.copilot.gnani_client import GnaniClient
    client = GnaniClient()
    if client.mock: raise RuntimeError('Non-mock Gnani configuration required')
    folder = client.tts_cache_dir / 'f7_handover'
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / 'live.json'
    saved = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'tts_calls':0,'batch_jobs':0,'states':[]}
    if saved['batch_jobs'] and not (args.resume or args.new_job):
        print(json.dumps(saved,ensure_ascii=True)); return  # Explicit no automatic job retry.
    if args.new_job:
        saved.setdefault('history', []).append({k: saved[k] for k in ('job_id','duration_s','states','raw_segments','resume_result','resume_latency_s','latency_s','http_status','route_result') if k in saved})
        saved['states'] = []
    def save():
        temporary = journal.with_suffix('.tmp')
        temporary.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
        temporary.replace(journal)
    import requests
    original_post = requests.post
    def limited_post(url, **kwargs):
        if '/tts/' not in url or saved['tts_calls'] >= 6: raise RuntimeError('TTS budget exhausted')
        saved['tts_calls'] += 1; save()
        return original_post(url, **kwargs)
    requests.post = limited_post
    client.tts_model = 'timbre-v3.0'
    chunks, intervals, cursor = [], [], 0
    for index, (voice, text) in enumerate(LINES):
        path = folder / f'{index}.wav'
        if not path.exists():
            for _ in range(2):
                if saved['tts_calls'] >= 6: break
                audio = client.synthesize(text,'en-IN',voice=voice,allow_fallback=False,max_calls=1)
                if audio: path.write_bytes(audio); break
        if not path.exists():
            saved['error']='synthetic_audio_unavailable'; save(); print(json.dumps(saved)); return
        with wave.open(str(path),'rb') as wav:
            assert (wav.getnchannels(),wav.getsampwidth(),wav.getframerate()) == (1,2,client.tts_sample_rate)
            pcm = wav.readframes(wav.getnframes())
        duration = len(pcm) / (2 * client.tts_sample_rate)
        intervals.append({'voice':voice,'start':round(cursor,3),'end':round(cursor+duration,3)})
        chunks.append(pcm); chunks.append(b'\x00\x00' * int(client.tts_sample_rate * .6)); cursor += duration + .6
    output = io.BytesIO()
    with wave.open(output,'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(client.tts_sample_rate); wav.writeframes(b''.join(chunks))
    audio = output.getvalue()
    assert cursor <= 20, 'First smoke must be <=20 seconds; do not submit longer audio'
    (folder / 'smoke.wav').write_bytes(audio)
    saved.update(duration_s=round(cursor,3),voice_intervals=intervals)
    import httpx
    original_request, original_get = httpx.AsyncClient.request, httpx.AsyncClient.get
    async def request(self, method, url, **kwargs):
        if method == 'POST' and url.endswith('/stt/v3/batch/jobs'):
            if saved['batch_jobs'] >= 3: raise RuntimeError('Batch job budget exhausted')
            saved['batch_jobs'] += 1; save()
        response = await original_request(self,method,url,**kwargs)
        if '/batch/jobs' in url and response.status_code not in (200,201,202):
            saved.setdefault('http_failures',[]).append({'method':method,'step':url.split('?')[0].split('/')[-1], 'status':response.status_code}); save()
        if '/batch/jobs' in url and response.status_code in (200,201,202):
            payload=response.json()
            for field in ('started_at','completed_at','created_at'):
                if payload.get(field): saved[field] = payload[field]
            if payload.get('job_id'): saved['job_id'] = payload['job_id']
            if 'status' in payload: saved['states'].append(payload['status']); save()
        return response
    async def get(self,url,**kwargs):
        response=await original_get(self,url,**kwargs)
        if '.amazonaws.com/' in url and response.status_code == 200:
            payload=response.json()
            saved['raw_segments']=[{k:row[k] for k in ('speaker_id','start_time','end_time','text','emotion','sentiment','language_detected') if k in row} for row in payload.get('segments',[])]
            saved['provider_duration_s']=payload.get('duration_seconds'); save()
        return response
    httpx.AsyncClient.request, httpx.AsyncClient.get = request, get
    from fastapi.testclient import TestClient
    from app import main as app_main
    began=time.perf_counter()
    if args.resume:
        from copilot.gnani_batch import GnaniBatchClient
        try:
            result = asyncio.run(GnaniBatchClient().transcribe(b'',cursor,job_id=saved['job_id']))
            saved.update(resume_result=result,resume_latency_s=round(time.perf_counter()-began,3))
        except Exception as error:
            saved.update(resume_error=str(error),resume_latency_s=round(time.perf_counter()-began,3))
    else:
        response=TestClient(app_main.app).post('/copilot/handover',files={'audio':('handover.wav',audio,'audio/wav')})
        saved.update(http_status=response.status_code,route_result=response.json(),latency_s=round(time.perf_counter()-began,3))
    assert client.api_key not in json.dumps(saved)
    save(); print(json.dumps(saved,ensure_ascii=True),flush=True)


if __name__ == '__main__': main()
