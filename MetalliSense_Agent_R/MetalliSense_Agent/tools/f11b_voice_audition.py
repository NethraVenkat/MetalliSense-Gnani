"""F11b explicit 12-attempt audition, no STT. Audio/attempt journal are ignored.

Default max-calls=0: cache-only. Four v3 voices x two languages + two Kalpana
before clips. Failed trials are not retried automatically. No voice config edits.
"""
import argparse
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import time
from dotenv import load_dotenv

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
VOICES=['Kalpana','Avinash','Prakash','Harshad']


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-calls',type=int,default=0,choices=range(13));args=parser.parse_args()
    load_dotenv(ROOT/'.env');logging.disable(logging.CRITICAL)
    from app.copilot.gnani_client import GnaniClient
    folder=ROOT/'app/data/tts_cache/f11b_audition';folder.mkdir(parents=True,exist_ok=True)
    journal=folder/'results.json';saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
    def save():
        journal.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8')
    frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    # Import the real pure frontend builder via a tiny Vite-independent module graph.
    # These modules use extensionless imports, so esbuild bundles only local helpers.
    source="""
import {clarityGateSpeech} from './src/services/voiceClarity';
import {toSpokenText} from './src/services/spokenText';
const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[
 {id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]}]}};
console.log(JSON.stringify(['ta','hi'].map(lang=>({lang,after:clarityGateSpeech(heat,lang),
 before:toSpokenText(lang==='ta'?'Heat H-1053 HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு 0.50 சதவீதம், அதிகம்.':'हीट H-1053 होल्ड पर है। लॉट PIG-1053 क्वारंटीन में है। कॉपर 0.50 प्रतिशत है, सीमा 0.30 से ज़्यादा।',lang)}))));
"""
    helper=folder/'texts.mjs'
    bundle=subprocess.run(['node','--input-type=module','-e',"import{build}from'esbuild';const r=await build({stdin:{contents:"+json.dumps(source)+",resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,platform:'node',format:'esm'});process.stdout.write(r.outputFiles[0].text);"],cwd=frontend,capture_output=True,text=True,encoding='utf-8',check=True)
    helper.write_text(bundle.stdout,encoding='utf-8')
    texts=json.loads(subprocess.run(['node',str(helper)],capture_output=True,text=True,encoding='utf-8',check=True).stdout)
    saved['texts']=texts;save()
    import requests
    original=requests.post
    def post(url,**kwargs):
        if '/tts/' not in url or saved['calls']>=args.max_calls:raise RuntimeError('Audition call budget exhausted')
        saved['calls']+=1;save();return original(url,**kwargs)
    requests.post=post
    trials=[(voice,row,False) for voice in VOICES for row in texts]+[('Kalpana',row,True) for row in texts]
    for voice,row,before in trials:
        name=f"{voice}_{row['lang']}"+('_before' if before else '')
        path=folder/(name+'.wav')
        if name in saved['attempted'] or path.exists():continue
        os.environ['GNANI_TTS_CLARITY']='off' if before else 'on'
        os.environ['GNANI_TTS_SPEED']='' if before else '0.9'
        client=GnaniClient()
        if args.max_calls and client.mock:raise RuntimeError('Non-mock client required')
        client.tts_model='timbre-v3.0';client.tts_voice=voice;client.tts_cache_dir=folder/'cache'
        text=row['before' if before else 'after']
        if saved['calls']>=args.max_calls:
            audio=client.synthesize(text,row['lang'],allow_fallback=False,max_calls=0)
            if audio:path.write_bytes(audio)
            continue
        saved['attempted'].append(name);save();started=time.perf_counter()
        audio=client.synthesize(text,row['lang'],allow_fallback=False,max_calls=1)
        if audio:path.write_bytes(audio)
        record={'file':str(path),'voice':voice,'language':row['lang'],'before':before,'success':bool(audio),
                'latency_ms':round((time.perf_counter()-started)*1000,1),'source':client.last_tts_source,'speed':client.tts_speed}
        saved['rows'].append(record);save();print(json.dumps(record),flush=True)
    print(json.dumps({'tts_calls':saved['calls'],'stt_calls':0,'files':[str(path) for path in folder.glob('*.wav')]}),flush=True)


if __name__=='__main__':main()
