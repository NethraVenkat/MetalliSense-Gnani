"""Bounded generated wake screen. Explicit --live only, no app integration."""
import argparse,asyncio,base64,contextlib,io,json,os,subprocess,sys,tempfile,time,uuid,wave,audioop
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'app'))

def wav(pcm):
 out=io.BytesIO()
 with wave.open(out,'wb') as w:w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(pcm)
 return out.getvalue()
def convert(audio):
 with wave.open(io.BytesIO(audio)) as w:
  rate,channels,width=w.getframerate(),w.getnchannels(),w.getsampwidth();pcm=w.readframes(w.getnframes())
 if channels==2:pcm=audioop.tomono(pcm,width,.5,.5)
 if width!=2:pcm=audioop.lin2lin(pcm,width,2)
 pcm,_=audioop.ratecv(pcm,2,1,rate,16000,None)
 return wav(pcm)
def sapi(text,rate=0):
 script="""Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
$m=New-Object System.IO.MemoryStream
$s.SetOutputToWaveStream($m)
$s.Rate="""+str(rate)+"\n$s.Speak('"+text.replace("'","''")+"')\n$s.Dispose()\n[Convert]::ToBase64String($m.ToArray())"
 p=subprocess.run(['powershell.exe','-NoProfile','-Command','-'],input=script.encode('utf-8'),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('SAPI failed')
 return convert(base64.b64decode(p.stdout.strip()))
def retry_transport(original):
 def send(*args,**kwargs):
  from urllib.parse import urlsplit
  for attempt in range(3):
   try:
    response=original(*args,**kwargs)
    if response.status_code<500 and response.status_code!=429:return response
    if attempt==2:return response
   except Exception as error:
    if attempt==2:raise RuntimeError(type(error).__name__+' endpoint='+urlsplit(args[0]).path) from None
   time.sleep(30)
 return send
async def run():
 if "--live" not in sys.argv:raise SystemExit("Explicit --live required for generated provider diagnostics")
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 out=ROOT/'tools/local_wake_data'/('v23-wake-'+uuid.uuid4().hex);out.mkdir(parents=True)
 with tempfile.TemporaryDirectory(prefix='v23-wake-agent-') as temp:
  os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false',WAKE_WORD_ENABLED='true',LANG_BRIDGE='false')
  from app.copilot import gnani_client,wake_check
  from tools.wake_eval_folder import prepare,evaluate
  from app.copilot.provider_calls import post
  transport=retry_transport(post);wake_check.provider_post=transport
  with contextlib.redirect_stdout(io.StringIO()):client=gnani_client.GnaniClient()
  sources=out/'clips';sources.mkdir();settings=[]
  for voice in ['Timbre','SAPI']:
   for index,speed in enumerate([.85,1.,1.15]):
    if voice=='SAPI':audio=sapi('Kural',[-2,0,2][index])
    else:
     payload={'text':'குரல்','model':client.tts_model,'voice':client.tts_voice,'language':'ta-IN','speed':speed,'audio_config':{'sample_rate':16000,'encoding':'linear_pcm','num_channels':1,'sample_width':2,'container':'wav'}}
     response=transport(client.base_url+'/api/v1/tts/inference',headers=client._headers(json_body=True),json=payload,timeout=client.tts_timeout_s)
     if response.status_code!=200:raise RuntimeError('TTS HTTP '+str(response.status_code))
     audio=convert(gnani_client._finalize_wav(response.content));time.sleep(1.1)
    with wave.open(io.BytesIO(audio)) as w:pcm=w.readframes(w.getnframes())
    for lead in [False,True]:
     name=f'wake_{voice}_{index}_{int(lead)}.wav';(sources/name).write_bytes(wav((b'\0'*16000 if lead else b'')+pcm));settings.append({'file':name,'voice':voice,'speed':speed if voice=='Timbre' else [-2,0,2][index],'leading_silence':.5 if lead else 0})
  for index,text in enumerate(['coral','curl','cooler','rural','control','cruel','neural','canal','cuddle','coal']):(sources/f'conf_{index:02}.wav').write_bytes(sapi(text))
  for index,text in enumerate(['The room is quiet today','Please check the stock tomorrow','We should finish the shift soon','The weather is pleasant outside','I will bring the report later']):(sources/f'conv_{index:02}.wav').write_bytes(sapi(text))
  rows=prepare(sources);planned=sum(len(r['onsets']) for r in rows)
  (out/'generation.json').write_text(json.dumps({'settings':settings,'planned_calls':planned,'criteria':'old rule; all 12 wake variants plus fixed first 10 sorted as requested denominator; zero of 10 confusables and 5 conversation clips','no_rule_changes':True},ensure_ascii=False,indent=2),encoding='utf-8')
  class Spaced:
   def __init__(self):self.checker=wake_check.WakeChecker();self.first=True
   async def check(self,audio):
    if not self.first:await asyncio.sleep(4.2)
    self.first=False
    return await self.checker.check(audio)
  print('Generated plan:',planned,'calls; output',out,flush=True)
  if '--live' in sys.argv:print(await evaluate(rows,out/'evaluation',live=True,max_calls=40,checker=Spaced()))
  else:print(await evaluate(rows,out/'dry-run',max_calls=40))
if __name__=='__main__':asyncio.run(run())
