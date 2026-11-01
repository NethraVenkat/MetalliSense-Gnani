"""Offline file-only prototype. Disabled unless --enable-local-wake-bench.

No microphone, network, provider, application routing or command execution.
Requires separately acquired official native runtime/model and real recordings.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import unicodedata
import wave

SHERPA_MODEL='sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01'
SHERPA_FILES={part:f'{part}-epoch-12-avg-2-chunk-16-left-64.int8.onnx' for part in ['encoder','decoder','joiner']}
WHISPER_MODEL='ggml-tiny-q5_1.bin'

def has_kural(text):
    text=unicodedata.normalize('NFKC',text).lower()
    return bool(re.search(r'(?<!\w)(?:kural|குரல்)(?!\w)',text))

class WakeBoundary:
    """Mockable one-utterance activation boundary, not an acoustic detector."""
    def __init__(self): self.state='disabled'; self.seen=set(); self.model=None
    def load(self,loader):
        self.close()
        try:
            self.model=loader()
            if self.model is None:raise ValueError('Detector not loaded')
            self.state='waiting'
        except Exception: self.state='error'; raise
    def wake(self,event_id):
        if self.state!='waiting' or event_id in self.seen:return False
        self.seen.add(event_id);self.state='listening';return True
    def consume(self):
        if self.state!='listening':return False
        self.state='waiting';return True
    def close(self):
        if self.model is not None:self.model.close()
        self.model=None;self.state='disabled';self.seen.clear()

def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as file:
        for chunk in iter(lambda:file.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def command(engine,executable,models,wav,keywords=None):
    executable=Path(executable).resolve();models=Path(models).resolve();wav=Path(wav).resolve()
    if not executable.is_file():raise ValueError('Local runtime executable missing')
    if engine=='sherpa':
        files=[models/name for name in SHERPA_FILES.values()]+[models/'tokens.txt']
        if keywords is None:raise ValueError('BPE-tokenized KURAL keywords file required')
        files.append(Path(keywords).resolve())
        if any(not p.is_file() for p in files):raise ValueError('Local KWS model/token/keyword artifact missing')
        args=[str(executable)]+[f'--{part}={models/name}' for part,name in SHERPA_FILES.items()]
        args += [f'--tokens={models/"tokens.txt"}',f'--keywords-file={Path(keywords).resolve()}',str(wav)]
    else:
        files=[models/WHISPER_MODEL]
        if not files[0].is_file():raise ValueError('Local multilingual tiny-q5_1 model missing')
        args=[str(executable),'-m',str(files[0]),'-f',str(wav),'-l','ta','--no-timestamps','--no-gpu']
    return args,files

def detections(engine,stdout):
    if engine=='whisper':
        return [{'keyword':'Kural','token_offsets_seconds':None}] if has_kural(stdout) else []
    found=[]
    for line in stdout.splitlines():
        try: result=json.loads(line.strip())
        except ValueError:continue
        if isinstance(result,dict) and str(result.get('keyword','')).strip().upper()=='KURAL':
            found.append({'keyword':'KURAL','token_offsets_seconds':result.get('timestamps')})
    return found

def benchmark(engine,executable,models,dataset,output,keywords=None,runner=subprocess.run):
    dataset=Path(dataset).resolve();output=Path(output)
    with dataset.open(encoding='utf-8-sig',newline='') as file: rows=list(csv.DictReader(file))
    if not rows:raise ValueError('Empty dataset')
    prepared=[]
    for row in rows:
        wav=(dataset.parent/row['wav']).resolve()
        if not wav.is_relative_to(dataset.parent):raise ValueError('Recording outside dataset directory')
        expected=int(row['expected_wakes'])
        if expected not in (0,1):raise ValueError('Each clip must have zero or one intended wake')
        with wave.open(str(wav),'rb') as source:
            if (source.getnchannels(),source.getsampwidth(),source.getframerate())!=(1,2,16000):raise ValueError('Requires mono PCM16 WAV at 16000 Hz')
            duration=source.getnframes()/16000
            if not 0<duration<=30 or len(source.readframes(source.getnframes()))!=source.getnframes()*2:raise ValueError('Invalid recording length')
        args,artifacts=command(engine,executable,models,wav,keywords)
        prepared.append((row,wav,expected,duration,args,artifacts))
    # Never overwrite evidence, and validate all paths before spawning a process.
    output.mkdir(parents=True,exist_ok=False)
    report=dict(engine=engine,provider_requests=0,live_microphone=False,
        runtime_sha256=digest(executable),artifacts=[dict(file=str(p),bytes=p.stat().st_size,sha256=digest(p)) for p in prepared[0][-1]],
        timing_note='cold process wall time includes model loading; NOT streaming detection latency',results=[])
    try:
        for row,wav,expected,duration,args,_ in prepared:
            start=time.perf_counter()
            try:
                result=runner(args,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True,timeout=60)
                found=detections(engine,result.stdout)
                report['results'].append(dict(id=row['id'],condition=row.get('condition',''),wav=str(wav),audio_sha256=digest(wav),duration_seconds=duration,
                    expected_wakes=expected,detected_wakes=len(found),detections=found,cold_process_ms=(time.perf_counter()-start)*1000,
                    detection_latency_ms=None,status='measured offline',local_transcript=result.stdout[:4096] if engine=='whisper' else None))
            except (subprocess.SubprocessError,OSError) as error:
                report['results'].append(dict(id=row['id'],status='engine_failed',error_type=type(error).__name__))
                break
    finally:
        valid=[r for r in report['results'] if r['status']=='measured offline']
        negative_seconds=sum(r['duration_seconds'] for r in valid if not r['expected_wakes'])
        report['summary']=dict(evaluated_clips=len(valid),missed_wake_clips=sum(r['expected_wakes']==1 and not r['detected_wakes'] for r in valid),
            false_activation_events=sum(r['detected_wakes'] for r in valid if not r['expected_wakes']),negative_minutes=negative_seconds/60,
            detection_latency='pending streaming replay/manual measurement')
        (output/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enable-local-wake-bench',action='store_true')
    parser.add_argument('--engine',choices=['sherpa','whisper'],default='sherpa')
    for name in ['executable','models','dataset','output','keywords']:parser.add_argument('--'+name)
    args=parser.parse_args()
    if not args.enable_local_wake_bench:
        print('Disabled. Zero capture, model inference, network or provider requests.')
    else:
        if any(not getattr(args,k) for k in ['executable','models','dataset','output']):parser.error('Explicit local artifact/dataset/output paths required')
        report=benchmark(args.engine,args.executable,args.models,args.dataset,args.output,args.keywords)
        print(json.dumps(report['summary'],indent=2))
