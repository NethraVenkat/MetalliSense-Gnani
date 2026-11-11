"""In-memory TEST speech only. Never persists or prints private content."""
import contextlib,io,json,os,secrets,sys,tempfile,time,wave,subprocess,base64,audioop
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'app'));sys.path.insert(0,str(ROOT))
def main():
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 with tempfile.TemporaryDirectory(prefix='kural-private-diagnostic-') as temp:
  os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,VOICE_AUDIO_LOG_ENABLED='false',GNANI_MOCK='false')
  from copilot.gnani_client import GnaniClient,_finalize_wav
  from copilot.provider_calls import post
  from tools.stage1_wake_diagnostic import retry_transport
  from copilot import gnani_client
  post=retry_transport(post);gnani_client.provider_post=post
  from copilot.voice_auth import normalize_code
  from copilot.voice_foundation import private_transcription
  code=''.join(str(secrets.randbelow(10)) for _ in range(6));names='zero one two three four five six seven eight nine'.split()
  with contextlib.redirect_stdout(io.StringIO()):client=GnaniClient()
  if client.mock:print(json.dumps({'blocked':'backend credential unavailable','attempts':0}));return
  payload={'text':' '.join(names[int(d)] for d in code),'model':client.tts_model,'voice':client.tts_voice,'language':'en-IN','audio_config':{'sample_rate':16000,'encoding':'linear_pcm','num_channels':1,'sample_width':2,'container':'wav'}}
  if '--sapi-only' in sys.argv:
   from tools.kural_gnani_wake_test import wav_bytes
   audio=wav_bytes(b'\0'*32000)
  else:
   try:r=post(client.base_url+'/api/v1/tts/inference',headers=client._headers(json_body=True),json=payload,timeout=client.tts_timeout_s)
   except Exception as error:print(json.dumps({'blocked':type(error).__name__,'phase':'tts','attempts':1}));return
   if r.status_code!=200:print(json.dumps({'blocked':'provider_status','status':r.status_code,'phase':'tts','attempts':1}));return
   audio=_finalize_wav(r.content)
   with wave.open(io.BytesIO(audio)) as w:duration=w.getnframes()/w.getframerate()
  # SAPI writes only to a MemoryStream; stdout is captured, never displayed.
  script="""Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
$m=New-Object System.IO.MemoryStream
$s.SetOutputToWaveStream($m)
$s.Rate=-2
$s.Speak('"""+', '.join(names[int(d)] for d in code)+"""')
$s.Dispose()
[Convert]::ToBase64String($m.ToArray())
"""
  proc=subprocess.run(['powershell.exe','-NoProfile','-Command','-'],input=script.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  if proc.returncode:print(json.dumps({'blocked':'SAPI generation failed','tts_attempts':1}));return
  try:
   with wave.open(io.BytesIO(base64.b64decode(proc.stdout.strip()))) as w:
    pcm=w.readframes(w.getnframes());rate=w.getframerate();channels=w.getnchannels();width=w.getsampwidth()
   if channels==2:pcm=audioop.tomono(pcm,width,.5,.5)
   if width!=2:pcm=audioop.lin2lin(pcm,width,2)
   pcm,_=audioop.ratecv(pcm,2,1,rate,16000,None)
   target=io.BytesIO()
   with wave.open(target,'wb') as w:w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(pcm)
   sapi=target.getvalue()
  except Exception:print(json.dumps({'blocked':'SAPI WAV conversion failed','tts_attempts':1}));return
  original=(ROOT.parents[1]/'.overnight_backup/v23-stage1/MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_auth.py').read_text(encoding='utf-8')
  namespace={};exec(original[original.index('def normalize_code'):original.index('def entry')],__import__('copilot.voice_auth',fromlist=['NUMBERS']).__dict__.copy(),namespace)
  old=namespace['normalize_code'];results=[]
  variants=[('en-IN','codemix'),('ta-IN,en-IN','codemix'),('hi-IN','codemix'),('en-IN','transcribe'),('en-IN','verbatim')]
  if '--production-only' in sys.argv:variants=[('en-IN','codemix'),('ta-IN,en-IN','codemix'),('hi-IN','codemix'),('ta-IN,en-IN','codemix')]
  # Prevent a global bridge override from invalidating the declared locale comparison.
  os.environ['LANG_BRIDGE']='false'
  for voice,wav in ([('Windows SAPI',sapi)] if '--sapi-only' in sys.argv else [('Timbre',audio),('Windows SAPI',sapi)]):
   with wave.open(io.BytesIO(wav)) as w:duration=w.getnframes()/w.getframerate()
   for locale,fmt in variants:
    time.sleep(1.1)
    try:
     with contextlib.redirect_stdout(io.StringIO()):
      answer=private_transcription(wav,locale) if fmt=='codemix' else client.transcribe(wav,locale,max_attempts=1,output_format=fmt)
     text=answer.get('text','');tokens=text.split()
     results.append({'voice':voice,'locale':locale,'codemix':fmt=='codemix','format':fmt,'duration':duration,'token_count':len(tokens),'token_types':['numeric' if t.isdecimal() else 'word' for t in tokens],'before_correct':old(text)==code,'after_correct':normalize_code(text)==code,'success':answer.get('success',False)})
     client.last_error=None
    except Exception as error:results.append({'voice':voice,'locale':locale,'error':type(error).__name__});break
  print(json.dumps({'tts_attempts':0 if '--sapi-only' in sys.argv else 1,'private_trials':results},ensure_ascii=True))
if __name__=='__main__':main()
