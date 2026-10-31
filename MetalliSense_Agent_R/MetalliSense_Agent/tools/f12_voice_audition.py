"""Private F12 audition: <=3 embedding calls and <=5 cloned TTS calls, no retries."""
import argparse
import json
import logging
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true',help='Spend the explicitly authorized F12 budget once')
    args=parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT/'.env')
    from app.copilot.gnani_client import GnaniClient
    from app.copilot import voice_clone as clone
    from f12_make_voice_embedding import make_embedding
    import os
    logging.disable(logging.CRITICAL)
    if not clone.consented():raise ValueError('consent_required')
    folder=ROOT/'app/data/tts_cache/f12_audition';folder.mkdir(parents=True,exist_ok=True)
    journal=folder/'results.json'
    saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'embedding_calls':0,'tts_calls':0,'attempted':[],'results':[]}
    def save():journal.write_text(json.dumps(saved,indent=2,ensure_ascii=False),encoding='utf-8')
    if not args.live:
        print(json.dumps(saved));return
    client=GnaniClient()
    if client.mock:raise ValueError('live_configuration_required')
    import requests
    original=requests.post
    def guarded(url,**kwargs):
        key='embedding_calls' if url.endswith('/voice-clone/embeddings') else 'tts_calls'
        if not url.startswith(client.base_url+'/api/v1/tts/') or saved[key]>=(3 if key=='embedding_calls' else 5):
            raise ValueError('budget_exhausted')
        saved[key]+=1;save()
        return original(url,**kwargs)
    requests.post=guarded
    for suffix,out in [('', 'embedding'),('_en','embedding_en'),('_hi','embedding_hi')]:
        token='build_'+out
        if token in saved['attempted'] or (clone.CLONE_DIR/(out+'.json')).exists():continue
        saved['attempted'].append(token);save();started=time.perf_counter()
        try:
            make_embedding(clone.CLONE_DIR/('supervisor_reference'+suffix+'.wav'),out,client)
            result={'case':token,'success':True}
        except Exception:result={'case':token,'success':False,'error':'embedding_unavailable'}
        result['latency_ms']=round((time.perf_counter()-started)*1000,1)
        saved['results'].append(result);save();print(json.dumps(result),flush=True)
    frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    source="""
import{createServer}from'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const {clarityGateSpeech}=await vite.ssrLoadModule('/src/services/voiceClarity.js');
const heat={heatId:'H-1053',gateResult:{decision:'HOLD',checks:[]}};
console.log('F12_JSON:'+JSON.stringify(Object.fromEntries(['ta','hi','en'].map(lang=>[lang,clarityGateSpeech(heat,lang,'alert','colloquial')]))));
await vite.close();process.exit(0);
"""
    output=subprocess.run(['node','--input-type=module'],input=source,cwd=frontend,capture_output=True,text=True,encoding='utf-8',timeout=30,check=True).stdout
    texts=json.loads(next(line[9:] for line in output.splitlines() if line.startswith('F12_JSON:')))
    saved['spoken_texts']=texts;save()
    os.environ['GNANI_VOICE_CLONE']='on'  # Process only; never changes .env.
    client.tts_cache_dir=folder/'cache'
    for lang,which in [('ta','main'),('hi','hi'),('hi','main'),('en','en'),('en','main')]:
        token=lang+'_'+which+'_alert'
        if token in saved['attempted']:continue
        os.environ['GNANI_CLONE_EMBEDDING_MODE']='single' if which=='main' else 'per_language'
        if not clone.load_embedding(lang):continue
        saved['attempted'].append(token);save();started=time.perf_counter()
        audio=client.synthesize(texts[lang],lang,voice='supervisor',style='alert',allow_fallback=False,max_calls=1)
        path=folder/(token+'.wav')
        if audio:path.write_bytes(audio)
        result={'case':token,'success':bool(audio),'source':client.last_tts_source,'provider':client.last_provider_used,
                'latency_ms':round((time.perf_counter()-started)*1000,1),'path':str(path) if audio else None,
                'error':client.last_error if not audio else None}
        saved['results'].append(result);save();print(json.dumps(result),flush=True)
    print(json.dumps({'embedding_calls':saved['embedding_calls'],'tts_calls':saved['tts_calls'],'stt_calls':0}),flush=True)


if __name__=='__main__':main()
