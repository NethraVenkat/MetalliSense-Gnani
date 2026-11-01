"""Isolated, single-run two-request audition; no application mapper or retries."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import time
import urllib.request
import urllib.error
import wave
import sys
import re
import traceback
import struct

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'app/data/tts_cache/spectrometer_language_audition'
USER_AGENT = 'MetalliSense-Kural-Pronunciation-Audition/1.0'
TEXT = 'இது Spectrometer. மெட்டல்ல இருக்குற ஒவ்வொரு element அளவையும் இங்கே பாக்கலாம்.'
STOCK_TEXT = 'இது Raw Material Stock. Pig iron, scrap, alloy — இந்த பொருட்கள் எவ்ளோ இருக்குன்னு இங்கே பாக்கலாம்.'

def payload(language):
    return dict(text=TEXT, model='timbre-v3.0', voice='Kalpana', language=language,
                audio_config=dict(sample_rate=22050, encoding='linear_pcm',
                                  num_channels=1, sample_width=2, container='wav'))

def now():
    return datetime.now(timezone.utc).isoformat()

def load_config(env_path=None):
    from dotenv import dotenv_values
    return dotenv_values(env_path or ROOT/'.env')

def http_details(error, key):
    """Bound reads; never persist request headers or unfiltered provider output."""
    raw=error.read(8193)
    def clean(value):
        text=str(value).replace(key,'[REDACTED]') if key else str(value)
        text=re.sub(r'(?i)(bearer\s+)[^\s"<>]+',r'\1[REDACTED]',text)
        text=re.sub(r'(?i)((?:api[_-]?key(?:[_-]?id)?|authorization|token|password|secret)["\s]*[:=]["\s]*)[^\s,"<>}]+',r'\1[REDACTED]',text)
        return ''.join(c for c in text if c in '\n\t' or ord(c)>=32)
    return dict(status=error.code,content_type=clean(error.headers.get('Content-Type',''))[:200],
        request_id=clean(next((error.headers.get(h) for h in ('X-Request-ID','Request-ID','X-Correlation-ID','CF-Ray') if error.headers.get(h)),''))[:256],
        body=clean(raw.decode('utf-8',errors='replace'))[:4096],
        body_truncated=len(raw)>8192 or len(clean(raw.decode('utf-8',errors='replace')))>4096)

def safe_error(error):
    reason = error.reason if isinstance(error, urllib.error.URLError) else error
    details=dict(type=type(error).__name__, reason_type=type(reason).__name__,
                errno=getattr(reason,'errno',None), winerror=getattr(reason,'winerror',None))
    if isinstance(error,(ValueError,wave.Error,EOFError)):
        details['message']=str(error)[:300]
    details['traceback']=[dict(file=Path(f.filename).name,line=f.lineno,function=f.name)
                          for f in traceback.extract_tb(error.__traceback__)]
    return details

def wav_info(audio):
    with wave.open(io.BytesIO(audio), 'rb') as wav:
        frames = wav.readframes(wav.getnframes())
        if (wav.getnchannels(),wav.getsampwidth(),wav.getframerate(),wav.getcomptype()) != (1,2,22050,'NONE') or not frames or len(frames)!=wav.getnframes()*2:
            raise ValueError('Invalid WAV')
        return dict(duration_seconds=wav.getnframes()/wav.getframerate(), bytes=len(audio), sha256=hashlib.sha256(audio).hexdigest())

def finalize_pcm_wav(audio):
    """Accept ordinary complete RIFF or the observed paired streaming sentinels."""
    if len(audio)<12 or audio[:4]!=b'RIFF' or audio[8:12]!=b'WAVE':
        raise ValueError('Not RIFF/WAVE')
    riff_size=struct.unpack_from('<I',audio,4)[0]
    streaming=riff_size==0xffffffff
    if not streaming and riff_size!=len(audio)-8:
        raise ValueError('RIFF length mismatch')
    pos=12
    fmt=None
    pcm=None
    chunks=[]
    placeholder=False
    while pos<len(audio):
        if pos+8>len(audio): raise ValueError('Incomplete chunk header')
        tag,size=struct.unpack_from('<4sI',audio,pos)
        start=pos+8
        actual=size
        if size==0xffffffff:
            if not streaming or tag!=b'data': raise ValueError('Unexpected placeholder')
            actual=len(audio)-start
            placeholder=True
        if start+actual>len(audio): raise ValueError('Truncated chunk')
        chunks.append(dict(id=tag.decode('ascii',errors='replace'),offset=pos,declared_size=size,actual_size=actual))
        if tag==b'fmt ':
            if fmt is not None or size!=16: raise ValueError('Unsupported or duplicate fmt chunk')
            fmt=struct.unpack_from('<HHIIHH',audio,start)
        if tag==b'data':
            if pcm is not None or fmt is None: raise ValueError('Invalid data chunk order')
            pcm=audio[start:start+actual]
        pos=start+actual+(actual%2)
        if pos>len(audio): raise ValueError('Missing chunk padding')
    if streaming!=placeholder: raise ValueError('Unpaired streaming placeholders')
    if fmt!=(1,1,22050,44100,2,16): raise ValueError('Invalid or unexpected WAV format')
    if not pcm or len(pcm)%2: raise ValueError('Incomplete PCM frames')
    output=io.BytesIO()
    with wave.open(output,'wb') as target:
        target.setparams((1,2,22050,0,'NONE','not compressed'))
        target.writeframes(pcm)
    return output.getvalue(),dict(original_riff_size=riff_size,chunks=chunks,
        placeholder_lengths=placeholder,pcm_bytes=len(pcm),frames=len(pcm)//2,
        pcm_sha256=hashlib.sha256(pcm).hexdigest())

def matching_sample(root, settings):
    for manifest_path in sorted(root.glob('**/manifest.json')) if root.exists() else []:
        try:
            manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
            for row in manifest.get('candidates',[]):
                if row.get('request')!=settings or row.get('status')!=200 or not row.get('file'):
                    continue
                path=(manifest_path.parent/row['file']).resolve()
                if path.parent!=manifest_path.parent.resolve():
                    continue
                info=wav_info(path.read_bytes())
                if info['sha256']==row.get('sha256'):
                    return path,info
        except (OSError,ValueError,wave.Error,EOFError):
            continue
    return None

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def post(settings, key):
    # One HTTP attempt; system proxy discovery, verified TLS, no redirect/retry.
    opener = urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request('https://api.vachana.ai/api/v1/tts/inference',
        data=json.dumps(settings, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type':'application/json', 'X-API-Key-ID':key,
                 'User-Agent':USER_AGENT}, method='POST')
    try:
        with opener.open(request, timeout=60) as response:
            audio=response.read(8*1024*1024+1)
            metadata={
                'content_type':response.headers.get('Content-Type','')[:200],
                'request_id':next((response.headers.get(h) for h in ('X-Request-ID','Request-ID','X-Correlation-ID','CF-Ray') if response.headers.get(h)),'')[:256]}
            if not (audio[:4]==b'RIFF' and audio[8:12]==b'WAVE'):
                diagnostic=urllib.error.HTTPError(request.full_url,response.status,'',response.headers,io.BytesIO(audio))
                metadata=http_details(diagnostic,key)
            return response.status,audio,metadata
    except urllib.error.HTTPError as error:
        return error.code, b'', http_details(error,key)

def run(directory, sender, pause=time.sleep, reuse_root=None, candidate='both', request_settings=None):
    if candidate not in ('A','B','both','stock'):
        raise ValueError('Unknown candidate')
    candidates=[('A_tamil','ta-IN'), ('B_auto','auto')]
    if candidate!='both':
        candidates=[pair for pair in candidates if pair[0].startswith(candidate+'_')]
    if candidate=='stock':
        candidates=[('stock_hi_default','hi-IN')]
    if request_settings is not None and len(candidates)!=1:
        raise ValueError('Explicit settings require one candidate')
    directory = Path(directory)
    # Exclusive directory creation prevents reruns/overwrites and budget resets.
    directory.mkdir(parents=True, exist_ok=False)
    manifest = dict(started_at=now(), max_requests=len(candidates), actual_requests=0,
                    retries=0, fallback=False, interpreter=sys.executable, candidates=[])
    if candidate=='stock':
        manifest['speed_note']='Public API speed omitted: documented default 1.0. Playground speakingSpeed 0.5 mapping unknown; pace parity not claimed.'
    def save():
        (directory/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    for label, language in candidates:
        filename='stock_hi_default.wav' if candidate=='stock' else 'spectrometer_'+label+'.wav'
        settings=payload(language)
        if candidate=='stock':
            settings['text']=STOCK_TEXT
        if request_settings is not None:
            settings=request_settings
        previous=matching_sample(Path(reuse_root),settings) if reuse_root else None
        if previous:
            path,info=previous
            with (directory/filename).open('xb') as target:
                target.write(path.read_bytes())
            manifest['candidates'].append(dict(candidate=label,request=settings,status=200,
                skipped_matching=True,file=filename,source=str(path),**info))
            save()
            continue
        if manifest['actual_requests']:
            pause(1.1)
        row = dict(candidate=label, request=settings, started_at=now(), status=None)
        manifest['candidates'].append(row)
        manifest['actual_requests'] += 1
        save()  # Reserve before sending; never automatically repeat an uncertain request.
        audio=None
        try:
            response = sender(row['request'])
            status, audio = response[:2]
            row['status'] = status
            if len(response)>2:
                row['response'] = response[2]
            if status != 200:
                row['error'] = 'Provider returned HTTP ' + str(status)
                if len(response)>2:
                    row['response'] = response[2]
                break
            # Persist bounded binary evidence before any WAV parsing.
            if audio[:4]==b'RIFF' and audio[8:12]==b'WAVE':
                evidence='response_'+label+'.bin'
                with (directory/evidence).open('xb') as target:
                    target.write(audio[:8*1024*1024])
                row.update(response_evidence=evidence,response_bytes=len(audio),
                    response_sha256=hashlib.sha256(audio).hexdigest(),response_truncated=len(audio)>8*1024*1024)
            save()
            if len(audio)>8*1024*1024:
                raise ValueError('Response exceeds 8 MiB evidence limit')
            audio,row['finalization']=finalize_pcm_wav(audio)
            with wave.open(io.BytesIO(audio), 'rb') as wav:
                row['wav_header']=dict(channels=wav.getnchannels(),sample_width=wav.getsampwidth(),
                    sample_rate=wav.getframerate(),declared_frames=wav.getnframes(),compression=wav.getcomptype())
                frames = wav.readframes(wav.getnframes())
                row['wav_header']['read_frame_bytes']=len(frames)
                if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (1,2,22050,'NONE') or not frames:
                    raise ValueError('Invalid or unexpected WAV format')
                if len(frames) != wav.getnframes()*2:
                    raise ValueError('Truncated WAV')
                row['duration_seconds'] = wav.getnframes()/wav.getframerate()
            with (directory/filename).open('xb') as target:
                target.write(audio)
            row.update(file=filename, bytes=len(audio), sha256=hashlib.sha256(audio).hexdigest())
        except Exception as error:
            row['error'] = type(error).__name__  # No secret-bearing exception strings.
            row['error_details'] = safe_error(error)
            if audio is not None:
                # Preserve bounded RIFF evidence separately, never as an approved WAV.
                row['response_bytes']=len(audio)
                row['response_sha256']=hashlib.sha256(audio).hexdigest()
                if audio[:4]==b'RIFF' and audio[8:12]==b'WAVE' and not row.get('response_evidence'):
                    evidence='response_'+label+'.bin'
                    with (directory/evidence).open('xb') as target:
                        target.write(audio[:8*1024*1024])
                    row['response_evidence']=evidence
                    row['response_truncated']=len(audio)>8*1024*1024
                elif not (audio[:4]==b'RIFF' and audio[8:12]==b'WAVE'):
                    row['response_format']='not RIFF/WAVE; raw body not persisted to avoid secret-bearing text'
                else:
                    row['response_format']='RIFF/WAVE detected; validation failed (see error_details)'
            break
        finally:
            row['finished_at'] = now()
            save()
    manifest['finished_at'] = now()
    save()
    (directory/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Kalpana audition</title><h1>Kalpana language audition</h1>' + ''.join('<p>'+r['candidate']+'</p><audio controls src="'+r['file']+'"></audio>' for r in manifest['candidates'] if 'file' in r), encoding='utf-8')
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--candidate',choices=['A','B','both','stock'],default='both')
    args = parser.parse_args()
    if not args.live:
        print('Dry run: zero requests. Selected candidate: '+args.candidate)
    else:
        config = load_config()
        key = (config.get('GNANI_API_KEY') or '').strip()
        if not key:
            raise SystemExit('Backend .env has no Gnani credential; zero requests.')
        if (config.get('GNANI_BASE_URL') or 'https://api.vachana.ai').rstrip('/') != 'https://api.vachana.ai':
            raise SystemExit('Unexpected backend endpoint; zero requests.')
        output=ROOT/'app/data/tts_cache/stock_pronunciation_audition' if args.candidate=='stock' else OUTPUT
        run_directory=output/('run-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        result = run(run_directory, lambda settings: post(settings,key), reuse_root=output,candidate=args.candidate)
        print('Audition output: '+str(run_directory))
        print(json.dumps(result, ensure_ascii=True, indent=2))
