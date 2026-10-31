"""Three TTS-only shift summary samples from an isolated real mock-store snapshot.

Default max-calls=0, durable <=3 attempt budget; configured voice/delivery reused.
No browser storage, real plant APIs, STT or LLM calls. No fallback/retry.
"""
import argparse
import json
import logging
from pathlib import Path
import subprocess
import sys
import time
from dotenv import load_dotenv

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-calls',type=int,default=0,choices=range(4));args=parser.parse_args()
    load_dotenv(ROOT/'.env');logging.disable(logging.CRITICAL)
    from app.copilot.gnani_client import GnaniClient,_env_bool
    client=GnaniClient()
    if args.max_calls and client.mock:raise RuntimeError('Live configuration required')
    folder=ROOT/'app/data/tts_cache/f9_shift_summary';folder.mkdir(parents=True,exist_ok=True)
    journal=folder/'results.json';saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
    def save():journal.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
    frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    source="""
import{createServer}from'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
const {startMock,dispatch,requirePort,reset}=await vite.ssrLoadModule('/src/mock/server.js');
const {buildShiftSummary,spokenShiftSummary}=await vite.ssrLoadModule('/src/services/shiftSummary.js');
const local=new Map();globalThis.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
globalThis.sessionStorage={removeItem:()=>{}};
globalThis.window=new EventTarget();window.fetch=async()=>{throw new Error('Snapshot cannot call network');};
globalThis.fetch=window.fetch;globalThis.document={addEventListener:()=>{}};
globalThis.location={href:'http://snapshot.local/',origin:'http://snapshot.local'};window.location=globalThis.location;
await startMock();await reset();
for(const id of ['H-1053','H-1051']){
 const response=await dispatch('POST','http://snapshot.local/api/v2/premelt/heats/'+id+'/gate-check',{by:'Synthetic demo'});
 if(response.status!==200)throw new Error('Local gate fixture failed');
}
const rows=requirePort('premeltGate/store').heats.list();
const snapshot=buildShiftSummary(rows,Date.now());
console.log('F9_JSON:'+JSON.stringify({counts:snapshot.counts,groups:snapshot.groups,priorityId:snapshot.priorityId,firstReason:snapshot.firstReason,
 excludedCompleted:snapshot.excludedCompleted,display:snapshot.display,
 texts:['ta','hi','en'].map(lang=>({lang,text:spokenShiftSummary(snapshot,lang,{clarity:true,register:'colloquial'})}))}));
await vite.close();process.exit(0);
"""
    output=subprocess.run(['node','--input-type=module'],input=source,cwd=frontend,capture_output=True,text=True,encoding='utf-8',timeout=30,check=True).stdout
    snapshot=json.loads(next(line[8:] for line in output.splitlines() if line.startswith('F9_JSON:')))
    saved['snapshot']=snapshot;saved['delivery']={'model':client.tts_model,'voice':client.tts_voice,'speed':client.tts_speed,'clarity':_env_bool('GNANI_TTS_CLARITY'),'tags':client.tts_tags};save()
    import requests
    original=requests.post
    def post(url,**kwargs):
        if '/tts/' not in url or saved['calls']>=args.max_calls:raise RuntimeError('Three-attempt TTS-only budget exhausted')
        saved['calls']+=1;save();return original(url,**kwargs)
    requests.post=post;client.tts_cache_dir=folder/'cache'
    for row in snapshot['texts']:
        path=folder/(row['lang']+'_summary.wav')
        if path.exists() or row['lang'] in saved['attempted']:continue
        can_call=saved['calls']<args.max_calls
        if can_call:saved['attempted'].append(row['lang']);save()
        started=time.perf_counter();audio=client.synthesize(row['text'],row['lang'],allow_fallback=False,max_calls=1 if can_call else 0)
        if audio:path.write_bytes(audio)
        if can_call or audio:
            result={'language':row['lang'],'path':str(path),'success':bool(audio),'source':client.last_tts_source,'latency_ms':round((time.perf_counter()-started)*1000,1)}
            saved['rows'].append(result);save();print(json.dumps(result),flush=True)
    print(json.dumps({'tts_calls':saved['calls'],'stt_calls':0,'counts':snapshot['counts']}),flush=True)


if __name__=='__main__':main()
