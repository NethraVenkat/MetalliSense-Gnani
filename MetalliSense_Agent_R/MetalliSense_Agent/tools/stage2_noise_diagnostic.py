"""Fixed generated-only noise measurement; no model/action changes."""
import argparse,asyncio,contextlib,io,json,os,sys,tempfile,time,uuid,hashlib,wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'app')]
from tools.noise_bench import mix,rms
from tools.stage1_wake_diagnostic import sapi,retry_transport
from tools.kural_gnani_wake_test import onsets_v2,snippet_v2
RATE=16000
PROMPTS=[('wake','குரல்','wake','/dashboard'),('latest','latest reading','spectrometer_heat_reading','/spectrometer'),('request','request reading','request_reading','/spectrometer'),('gate','gate check H-1051','gate_check','/premelt-gate'),('status','status of H-1053','heat_status','/premelt-gate'),('approve','approve the selected PR','approve_pr','/inventory-forecast')]
def readwave(data):
 with wave.open(io.BytesIO(data)) as w:
  if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(1,2,RATE):raise ValueError('Expected PCM16 mono 16kHz')
  pcm=w.readframes(w.getnframes())
  if len(pcm)!=w.getnframes()*2:raise ValueError('Truncated audio')
 return np.frombuffer(pcm,dtype='<i2').astype(float)/32768
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
 out=ROOT/'tools/local_wake_data'/('stage2-noise-'+uuid.uuid4().hex);out.mkdir(parents=True)
 old=ROOT/'tools/local_wake_data/v23-wake-7e88f9918edf4131abdca6a9dff9577d/clips/wake_Timbre_1_0.wav'
 if not old.is_file():raise SystemExit('Missing prior generated Kural source; no model/audio fallback')
 rng=np.random.default_rng(1729);cases=[];sources=[]
 for name,text,intent,route in PROMPTS:
  audio=readwave(old.read_bytes() if name=='wake' else sapi(text));audio=np.concatenate([np.zeros(8000),audio,np.zeros(8000)])
  sources.append((name,audio));n=len(audio);t=np.arange(n)/RATE
  hum=np.sin(2*np.pi*50*t)+.5*np.sin(2*np.pi*100*t);fan=rng.normal(size=n);clanks=np.zeros(n)
  for start in range(RATE//3,n,RATE//2):
   length=min(1600,n-start);u=np.arange(length)/RATE;clanks[start:start+length]=(np.sin(2*np.pi*1900*u)+.2*rng.normal(size=length))*np.exp(-u*35)
  noise=.3*hum+.45*fan+.25*clanks;noise-=noise.mean()
  for snr in ['clean','20','10','5']:
   data=mix(audio,noise,snr);file=f'{name}-{snr}.wav';(out/file).write_bytes(data)
   cases.append(dict(file=file,name=name,prompt=text,expected=intent,route=route,snr=snr,sha256=hashlib.sha256(data).hexdigest(),duration=len(audio)/RATE))
 # Noise-only conditions use the same reference amplitude; SNR is undefined without speech.
 reference=rms(sources[0][1]);n=RATE*3;t=np.arange(n)/RATE;noise=.3*(np.sin(2*np.pi*50*t)+.5*np.sin(2*np.pi*100*t))+.45*rng.normal(size=n)
 for start in [8000,24000,40000]:
  u=np.arange(1600)/RATE;noise[start:start+1600]+=.25*np.sin(2*np.pi*1900*u)*np.exp(-u*35)
 from tools.noise_bench import wav_bytes
 for snr in ['20','10','5']:
  scaled=noise*reference/(rms(noise)*10**(float(snr)/20));data=wav_bytes(scaled*min(1,.95/max(np.max(np.abs(scaled)),1e-8)));file='noise-only-'+snr+'.wav';(out/file).write_bytes(data)
  cases.append(dict(file=file,name='noise-only',prompt='',expected='nonwake',route=None,snr=snr,sha256=hashlib.sha256(data).hexdigest(),duration=3))
 plan=dict(seed=1729,rate=RATE,method='50/100Hz hum + broadband fan + decaying 1900Hz clanks; existing full-clip-RMS mixer, peak scaled without clipping',snrs=['clean',20,10,5],cases=cases,max_logical_requests=47,no_training=True,no_rule_changes=True)
 (out/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8');print(out,flush=True)
 if not args.live:return
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 with tempfile.TemporaryDirectory(prefix='stage2-noise-agent-') as temp:
  os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false',WAKE_WORD_ENABLED='true',LANG_BRIDGE='false')
  from app.copilot import gnani_client,wake_check
  from app.copilot.provider_calls import post
  calls=[];last=[-float('inf')]
  def attempt(*args,**kwargs):
   wait=max(0,4.2-(time.monotonic()-last[0]));time.sleep(wait);start=time.monotonic()
   try:r=post(*args,**kwargs);calls.append({'endpoint':args[0].split('api.vachana.ai')[-1],'status':r.status_code});return r
   finally:last[0]=time.monotonic()
  transport=retry_transport(attempt);gnani_client.provider_post=wake_check.provider_post=transport
  with contextlib.redirect_stdout(io.StringIO()):client=gnani_client.GnaniClient()
  checker=wake_check.WakeChecker();results=[]
  try:
   for case in cases:
    data=(out/case['file']).read_bytes()
    with wave.open(io.BytesIO(data)) as w:pcm=w.readframes(w.getnframes())
    onsets=onsets_v2(pcm);row={**case,'onset_seconds':onsets[0]/RATE if onsets else None,'wake_sent':bool(onsets),'wake':False,'wake_transcript':''}
    if onsets:
     answer=await checker.check(snippet_v2(pcm,onsets[0]));row.update(wake=answer['wake'],wake_transcript=answer['transcript'])
    if case['name'] not in ['wake','noise-only']:
     answer=client.transcribe(data,'en-IN',max_attempts=1)
     if not answer.get('success'):raise RuntimeError('STT failed endpoint=/stt/v3')
     row['transcript']=answer['text']
    results.append(row);(out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
  finally:(out/'requests.json').write_text(json.dumps(calls,indent=2),encoding='utf-8')
 print('Completed',len(results),'clips;',len(calls),'physical requests',flush=True)
if __name__=='__main__':asyncio.run(main())
