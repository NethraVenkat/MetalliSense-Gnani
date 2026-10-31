"""Paired F8 REST A/B: same cached audio/noise, <=24 STT and <=6 TTS, no retries."""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from tools.noise_bench import read_audio,mix,frontend_score

PHRASES=[
 ('heat_1051_english','What is the status of heat 1051','en',1051,ROOT/'tools/noise_bench/clean/heat_1051_english.wav'),
 ('heat_42_tanglish','Heat 42 epdi irukku','ta',42,ROOT/'tools/noise_bench/clean/heat_42_tanglish.wav'),
 ('heat_1053_tanglish','heat 1053 status enna','ta',1053,ROOT/'app/data/tts_cache/f2_hindi_bridge/07.wav'),
 ('heat_1053_reason','1053 en hold','ta',1053,ROOT/'app/data/tts_cache/f2_hindi_bridge/08.wav'),
 ('heat_1052_tamil','ஹீட் ஆயிரத்து ஐம்பத்தி ரெண்டு நிலை என்ன','ta',1052,None),
 ('heat_1052_english','What is the status of heat 1052','en',1052,None),
]
CONTEXT=['H-1051','heat 1051','1051','H-1052','heat 1052','1052','H-1053','heat 1053','1053','PIG-1053']

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--max-stt',type=int,default=0,choices=range(25));parser.add_argument('--max-tts',type=int,default=0,choices=range(7))
 args=parser.parse_args()
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 os.environ.update(GNANI_CONTEXT_BIAS='on',LANG_BRIDGE='off',GNANI_STT_MODEL='prisma-v3.0',GNANI_STT_LANGUAGE='ta-IN,en-IN',GNANI_STT_FORMAT='codemix')
 from app.copilot.gnani_client import GnaniClient
 client=GnaniClient()
 folder=ROOT/'app/data/tts_cache/f8_context_bias';folder.mkdir(parents=True,exist_ok=True)
 journal=folder/'results.json'
 saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'stt_calls':0,'tts_calls':0,'attempted':[],'rows':[]}
 def save():journal.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
 saved['config']={'model':client.stt_model,'language':client.stt_language,'format':client.stt_format,'static_keyterms':client.stt_keyterms,'context':CONTEXT,'noise':'synthetic_clanks'};save()
 import requests
 original=requests.post
 def guarded(url,**kwargs):
  key='stt_calls' if url.endswith('/stt/v3') else 'tts_calls'
  limit=args.max_stt if key=='stt_calls' else args.max_tts
  if url not in (client.base_url+'/stt/v3',client.base_url+'/api/v1/tts/inference') or saved[key]>=limit:raise ValueError('F8 budget exhausted')
  saved[key]+=1;save();return original(url,**kwargs)
 requests.post=guarded
 noise=read_audio(ROOT/'tools/noise_bench/noise/synthetic_clanks.wav')
 for name,text,lang,heat,cached in PHRASES:
  path=cached or folder/(name+'.wav')
  if not path.exists():
   token='tts:'+name
   if token in saved['attempted'] or saved['tts_calls']>=args.max_tts:continue
   saved['attempted'].append(token);save()
   audio=client.synthesize(text,lang,allow_fallback=False,max_calls=1)
   if not audio:continue
   path.write_bytes(audio)
  clean=read_audio(path)
  for snr in ('0','5'):
   audio=mix(clean,noise,snr)
   # Alternate pair order to avoid a fixed warm-up/order advantage.
   order=('without','with') if (heat+int(snr))%2 else ('with','without')
   for mode in order:
    token=name+':'+snr+':'+mode
    if token in saved['attempted'] or saved['stt_calls']>=args.max_stt:continue
    saved['attempted'].append(token);save();started=time.perf_counter()
    result=client.transcribe(audio,max_attempts=1,context_terms=CONTEXT if mode=='with' else None)
    row={'file':name,'snr':snr,'mode':mode,'expected_text':text,'expected_heat':heat,
         'expected_intent':'gate_reason' if name.endswith('reason') else 'heat_status',
         'transcript':result.get('text',''),'success':result.get('success',False),'latency_ms':round((time.perf_counter()-started)*1000,1)}
    saved['rows'].append(row);save();print(json.dumps({'case':token,'success':row['success']}),flush=True)
 saved['rows']=frontend_score(saved['rows']) if saved['rows'] else []
 for row in saved['rows']:
  params=json.loads(row['predicted_params']);row['heat_correct']=row['success'] and params.get('heatNumber')==row['expected_heat']
 save()
 if saved['rows']:
  with (folder/'runs.csv').open('w',newline='',encoding='utf-8') as handle:
   writer=csv.DictWriter(handle,fieldnames=list(saved['rows'][0]));writer.writeheader();writer.writerows(saved['rows'])
 for snr in ('0','5'):
  print(json.dumps({'snr':snr,**{mode:{'correct':sum(r['heat_correct'] for r in saved['rows'] if r['snr']==snr and r['mode']==mode),'n':sum(r['snr']==snr and r['mode']==mode for r in saved['rows'])} for mode in ('without','with')}}))
 print(json.dumps({'stt_calls':saved['stt_calls'],'tts_calls':saved['tts_calls']}))

if __name__=='__main__':main()
