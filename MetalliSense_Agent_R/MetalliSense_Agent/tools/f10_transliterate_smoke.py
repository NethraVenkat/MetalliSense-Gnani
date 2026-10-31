"""Four cached clips, strictly sequential main then display-only Latin, <=8 STT, zero TTS."""
import argparse
import asyncio
import json
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-calls',type=int,default=0,choices=range(9));args=parser.parse_args()
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 from app.copilot.gnani_client import GnaniClient
 from fastapi.testclient import TestClient
 from app import main as agent
 import os
 os.environ['GNANI_TRANSLITERATE']='on'
 import requests,httpx
 folder=ROOT/'app/data/tts_cache/f10_transliterate';folder.mkdir(parents=True,exist_ok=True)
 journal=folder/'results_sequential.json';lock=threading.Lock()
 saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
 def save():journal.write_text(json.dumps(saved,indent=2,ensure_ascii=False),encoding='utf-8')
 client=GnaniClient()
 if args.max_calls and client.mock:raise ValueError('live_config_required')
 saved['main_config']={'model':client.stt_model,'language':client.stt_language,'format':client.stt_format};save()
 def count(url):
  if url!=client.base_url+'/stt/v3':raise ValueError('STT only')
  with lock:
   if saved['calls']>=args.max_calls:raise ValueError('F10 call budget exhausted')
   saved['calls']+=1;save()
 post=requests.post;async_post=httpx.AsyncClient.post
 active={}
 def bounded(url,**kwargs):
  count(url);response=post(url,**kwargs);active['main_http_status']=response.status_code;return response
 async def async_bounded(self,url,**kwargs):
  count(url);response=await async_post(self,url,**kwargs);active['latin_http_status']=response.status_code;return response
 def primary(path,language):return client.transcribe(Path(path).read_bytes(),language,max_attempts=1)
 agent.voice_service=SimpleNamespace(stt_provider='gnani',gnani=client,transcribe_audio=primary)
 api=TestClient(agent.app)
 requests.post=bounded;httpx.AsyncClient.post=async_bounded
 clips=[('Tamil status',ROOT/'app/data/tts_cache/f8_context_bias/heat_1052_tamil.wav'),
        ('Tanglish why-hold',ROOT/'app/data/tts_cache/f2_hindi_bridge/08.wav'),
        ('Hindi status',ROOT/'app/data/tts_cache/f2_hindi_bridge/01.wav'),
        ('English status',ROOT/'tools/noise_bench/clean/heat_1051_english.wav')]
 for name,path in clips:
  if name in saved['attempted'] or saved['calls']+2>args.max_calls:continue
  if not path.exists():print('Missing cached clip: '+name);continue
  with lock:saved['attempted'].append(name);save()
  active.clear();audio=path.read_bytes();started=time.perf_counter()
  main_response=api.post('/copilot/voice/transcribe',files={'audio':('audio.wav',audio,'audio/wav')})
  main_ms=(time.perf_counter()-started)*1000
  normal=main_response.json()
  # The main HTTP response is complete before the second endpoint is invoked.
  started=time.perf_counter()
  latin_response=api.post('/copilot/voice/transliterate',files={'audio':('audio.wav',audio,'audio/wav')})
  latin_ms=(time.perf_counter()-started)*1000
  latin=latin_response.json()
  row={'clip':name,'main_success':normal.get('success',False),'main_text':normal.get('text',''),
       'latin_text':latin.get('transcript_latin'),'main_ms':round(main_ms,1),'latin_ms':round(latin_ms,1),
       'post_main_wait_ms':0,'main_http_status':active.get('main_http_status'),'latin_http_status':active.get('latin_http_status')}
  with lock:saved['rows'].append(row);save()
  print(json.dumps(row,ensure_ascii=False),flush=True)
 print(json.dumps({'stt_calls':saved['calls'],'tts_calls':0}),flush=True)

if __name__=='__main__':main()
