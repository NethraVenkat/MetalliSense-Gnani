"""Four Kalpana TTS attempts, 0 STT. Reuse configured clarity/speed/tag settings.

Explicit --max-calls 4 permits network; default 0 only uses the existing cache.
Durable attempt markers prevent repeat synthesis on restart. No model fallback.
"""
import argparse
import json
import logging
from pathlib import Path
import subprocess
import sys
import time
from dotenv import load_dotenv

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-calls',type=int,default=0,choices=range(5));args=parser.parse_args()
    load_dotenv(ROOT/'.env');logging.disable(logging.CRITICAL)
    from app.copilot.gnani_client import GnaniClient,_env_bool
    client=GnaniClient()
    if client.tts_model!='timbre-v3.0' or client.tts_voice!='Kalpana':raise RuntimeError('Audition requires current v3.0/Kalpana; no settings changed')
    if args.max_calls and client.mock:raise RuntimeError('Audition requires non-mock configuration')
    folder=ROOT/'app/data/tts_cache/f11c_audition';folder.mkdir(parents=True,exist_ok=True)
    journal=folder/'results.json';saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
    def save():journal.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
    frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    source="""
import{clarityGateSpeech}from'./src/services/voiceClarity';
const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[
 {id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]}]}};
console.log(JSON.stringify(['ta','hi'].flatMap(lang=>['reasons','status'].map(kind=>({lang,case:kind==='reasons'?'hold_reason':'status',
 text:clarityGateSpeech(heat,lang,kind,'colloquial'),formal:clarityGateSpeech(heat,lang,kind,'formal')})))));
"""
    bundle=subprocess.run(['node','--input-type=module','-e',"import{build}from'esbuild';const r=await build({stdin:{contents:"+json.dumps(source)+",resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,platform:'node',format:'esm'});process.stdout.write(r.outputFiles[0].text);"],cwd=frontend,capture_output=True,text=True,encoding='utf-8',check=True)
    helper=folder/'texts.mjs';helper.write_text(bundle.stdout,encoding='utf-8')
    texts=json.loads(subprocess.run(['node',str(helper)],capture_output=True,text=True,encoding='utf-8',check=True).stdout)
    saved['texts']=texts;saved['delivery']={'model':client.tts_model,'voice':client.tts_voice,'speed':client.tts_speed,'clarity':_env_bool('GNANI_TTS_CLARITY'),'tags':client.tts_tags};save()
    client.tts_cache_dir=folder/'cache'
    import requests
    post=requests.post
    def bounded_post(url,**kwargs):
        if '/tts/' not in url or saved['calls']>=args.max_calls:raise RuntimeError('Four-attempt TTS-only budget exhausted')
        saved['calls']+=1;save();return post(url,**kwargs)
    requests.post=bounded_post
    for row in texts:
        name=f"{row['lang']}_{row['case']}";path=folder/(name+'.wav')
        if path.exists() or name in saved['attempted']:continue
        can_call=saved['calls']<args.max_calls
        if can_call:saved['attempted'].append(name);save()
        began=time.perf_counter();audio=client.synthesize(row['text'],row['lang'],style='normal',allow_fallback=False,max_calls=1 if can_call else 0)
        if audio:path.write_bytes(audio)
        if can_call or audio:
            result={'file':str(path),'language':row['lang'],'case':row['case'],'success':bool(audio),'source':client.last_tts_source,'latency_ms':round((time.perf_counter()-began)*1000,1)}
            saved['rows'].append(result);save();print(json.dumps(result),flush=True)
    print(json.dumps({'tts_calls':saved['calls'],'stt_calls':0,'files':[str(path) for path in folder.glob('*.wav')]}),flush=True)


if __name__=='__main__':main()
