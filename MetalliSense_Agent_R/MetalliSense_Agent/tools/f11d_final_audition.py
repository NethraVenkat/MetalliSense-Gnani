"""Three sequential final colloquial samples from actual builders; 0 STT, no retry."""
import argparse
import json
import logging
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-calls',type=int,default=0,choices=range(4));args=parser.parse_args()
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env');logging.disable(logging.CRITICAL)
 from app.copilot.gnani_client import GnaniClient,_env_bool
 client=GnaniClient()
 if (client.tts_model,client.tts_voice,client.tts_speed,client.tts_tags,_env_bool('GNANI_TTS_CLARITY'))!=('timbre-v3.0','Kalpana',None,False,False):
  raise ValueError('Current Kalpana v3.0 default-speed/no-tags settings required; nothing changed')
 if client.mock:raise ValueError('Non-mock configuration required')
 folder=ROOT/'app/data/tts_cache/f11d_final';folder.mkdir(parents=True,exist_ok=True)
 journal=folder/'results.json';saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
 def save():journal.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
 frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
 source="""
import{createServer}from'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const{startMock,dispatch,requirePort,reset}=await vite.ssrLoadModule('/src/mock/server.js');
const{clarityGateSpeech}=await vite.ssrLoadModule('/src/services/voiceClarity.js');
const{buildShiftSummary,spokenShiftSummary}=await vite.ssrLoadModule('/src/services/shiftSummary.js');
const local=new Map();globalThis.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
globalThis.sessionStorage={removeItem:()=>{}};globalThis.window=new EventTarget();window.fetch=async()=>{throw Error('No snapshot network');};globalThis.fetch=window.fetch;
globalThis.document={addEventListener:()=>{}};globalThis.location={href:'http://snapshot.local/',origin:'http://snapshot.local'};window.location=globalThis.location;
await startMock();await reset();
for(const id of ['H-1053','H-1051']){const result=await dispatch('POST','http://snapshot.local/api/v2/premelt/heats/'+id+'/gate-check',{by:'Synthetic audition'});if(result.status!==200)throw Error('Gate fixture failed');}
const store=requirePort('premeltGate/store');store.heats.get('H-1052').status='MELTING';
const heat=store.heats.get('H-1053'),view={...heat,gateResult:heat.gate};const summary=buildShiftSummary(store.heats.list());
console.log('FINAL:'+JSON.stringify({counts:summary.counts,display:summary.display,texts:[
 {name:'ta_hold_reason',lang:'ta',text:clarityGateSpeech(view,'ta','reasons','colloquial')},
 {name:'hi_hold_reason',lang:'hi',text:clarityGateSpeech(view,'hi','reasons','colloquial')},
 {name:'ta_shift_summary',lang:'ta',text:spokenShiftSummary(summary,'ta',{clarity:true,register:'colloquial'})}]}));
await vite.close();process.exit(0);
"""
 output=subprocess.check_output(['node','--input-type=module'],input=source.encode(),cwd=frontend).decode('utf-8')
 snapshot=json.loads(next(line[6:] for line in output.splitlines() if line.startswith('FINAL:')))
 saved['snapshot']=snapshot;save()
 import requests
 original=requests.post
 def guarded(url,**kwargs):
  if url!=client.base_url+'/api/v1/tts/inference' or saved['calls']>=min(args.max_calls,3):raise ValueError('Three-call TTS-only budget exhausted')
  saved['calls']+=1;save();return original(url,**kwargs)
 requests.post=guarded
 for row in snapshot['texts']:
  path=folder/(row['name']+'.wav')
  if path.exists() or row['name'] in saved['attempted']:continue
  audio=client.synthesize(row['text'],row['lang'],allow_fallback=False,max_calls=0)
  began=time.perf_counter()
  if not audio and saved['calls']<args.max_calls:
   saved['attempted'].append(row['name']);save()
   audio=client.synthesize(row['text'],row['lang'],allow_fallback=False,max_calls=1)
  if audio:path.write_bytes(audio)
  result={**row,'path':str(path.resolve()),'success':bool(audio),'source':client.last_tts_source,'latency_ms':round((time.perf_counter()-began)*1000,1)}
  saved['rows'].append(result);save();print(json.dumps(result,ensure_ascii=False),flush=True)
 print(json.dumps({'tts_calls':saved['calls'],'stt_calls':0}),flush=True)

if __name__=='__main__':main()
