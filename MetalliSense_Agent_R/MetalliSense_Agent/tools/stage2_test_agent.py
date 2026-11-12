"""Explicit isolated real-provider form test. Credentials/audio stay in memory."""
import os,sys,tempfile,json,secrets,contextlib,io,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'app')]
if os.getenv('STAGE2_REAL_TEST')!='true':raise SystemExit('Explicit STAGE2_REAL_TEST required')
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
temp=tempfile.TemporaryDirectory(prefix='stage2-voice-')
os.environ.update(DATA_DIR=temp.name,GNANI_TTS_CACHE_DIR=temp.name,GNANI_MOCK='false',EVON_MOCK='true',COPILOT_PROVIDER='evon',STT_PROVIDER='gnani',TTS_PROVIDER='gnani',VOICE_ACTIONS_ENABLED='true',VOICE_AUDIT_ENABLED='true',VOICE_AUDIO_LOG_ENABLED='false',WAKE_WORD_ENABLED='true',LANG_BRIDGE='false',PYTHON_DOTENV_DISABLED='1')
from copilot.voice_auth import entry
code=''.join(secrets.choice('0123456789') for _ in range(6))
os.environ['VOICE_USERS']=json.dumps([entry('stage2-test','TEST Supervisor','Supervisor',code)])
from copilot.voice_audit import AUDIT
AUDIT.path=lambda date:Path(temp.name)/('audit-'+date+'.jsonl')
from tools.stage1_wake_diagnostic import sapi,retry_transport
from copilot import gnani_client,wake_check
from copilot.provider_calls import post
counts=[];retry=retry_transport(post)
def transport(*args,**kwargs):
 started=time.monotonic();response=retry(*args,**kwargs);counts.append({'endpoint':args[0].split('api.vachana.ai')[-1],'status':response.status_code,'elapsed_ms':round(1000*(time.monotonic()-started))});return response
gnani_client.provider_post=wake_check.provider_post=transport
with contextlib.redirect_stdout(io.StringIO()):client=gnani_client.get_gnani_client()
# Strict provider-only synthesis; prevent cache files containing private speech.
original=client.synthesize
client.synthesize=lambda text,language=None,**kwargs:original(text,language,**{**kwargs,'allow_fallback':False,'max_calls':1})
import main
from copilot.voice_service import VoiceService
main.voice_service=VoiceService()
def unavailable(*args,**kwargs):raise RuntimeError('Diagnostic fallback disabled')
main.voice_service._gtts_tts=unavailable
from fastapi import Request,HTTPException
from fastapi.responses import Response
sound={};safe=[]
names='zero one two three four five six seven eight nine'.split()
sound['approval']=sapi(', '.join(names[int(n)] for n in code),-2)
@main.app.get('/__stage2/ready')
def ready():return {'ready':True,'real':not client.mock}
@main.app.post('/__stage2/setup')
async def setup(request:Request):
 if request.client.host not in ('127.0.0.1','::1'):raise HTTPException(404)
 body=await request.json()
 for label,text in body.items():
  if label not in ('command','material','weight'):raise HTTPException(422)
  if label=='command':
   payload={'text':text,'model':client.tts_model,'voice':client.tts_voice,'language':'ta-IN','audio_config':{'sample_rate':16000,'encoding':'linear_pcm','num_channels':1,'sample_width':2,'container':'wav'}}
   result=transport(client.base_url+'/api/v1/tts/inference',headers=client._headers(json_body=True),json=payload,timeout=client.tts_timeout_s)
   if result.status_code!=200:raise HTTPException(502,'Generated command unavailable')
   sound[label]=gnani_client._finalize_wav(result.content)
  else:sound[label]=sapi(text)
 return {'ready':True}
@main.app.get('/__stage2/audio/{label}')
def audio(label:str,request:Request):
 if request.client.host not in ('127.0.0.1','::1') or label not in sound:raise HTTPException(404)
 return Response(sound[label],media_type='audio/wav',headers={'Cache-Control':'no-store'})
@main.app.get('/__stage2/results')
def results():return {'provider_requests':counts,'stt_calls':client.stats['stt_calls'],'tts_calls':client.stats['tts_calls']}
if __name__=='__main__':
 import uvicorn
 uvicorn.run(main.app,host='127.0.0.1',port=int(sys.argv[1]) if len(sys.argv)>1 else 5199,lifespan='off',access_log=False,log_level='critical')
