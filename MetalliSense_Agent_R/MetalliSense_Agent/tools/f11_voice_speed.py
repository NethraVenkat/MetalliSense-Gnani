"""At most 12 Gnani TTS attempts, 0 STT. Sequential cold REST vs SSE trials.

Calls are counted durably before I/O, including fallback attempts. No trial retry.
The production proxy generator is measured directly to avoid TestClient buffering.
"""
import asyncio
import argparse
import base64
import io
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import wave
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SENTENCES = [
    {'lang':'ta','text':'Heat H-1053 HOLD. PIG-1053 தனிமைப்படுத்தப்பட்டுள்ளது. காப்பர் 0.50 சதவீதம், அதிகம்.'},
    {'lang':'hi','text':'हीट H-1053 होल्ड पर है। कॉपर 0.50 प्रतिशत है, सीमा 0.30 से ज़्यादा।'},
    {'lang':'en','text':'Heat H-1053: PLANNED. Gate HOLD.'},
]


def main():
    sys.stdout.reconfigure(encoding='utf-8'); load_dotenv(ROOT/'.env'); logging.disable(logging.CRITICAL)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repeat-en-rest',action='store_true',help='One explicit cold repeat of the invalid English primary trial')
    args=parser.parse_args()
    from app.copilot.gnani_client import GnaniClient
    from app.copilot.voice_service import VoiceService
    from app.copilot.gnani_tts_stream import speak_events
    client = GnaniClient()
    if client.mock: raise RuntimeError('Configured live client required')
    folder = client.tts_cache_dir/'f11_voice_speed'; folder.mkdir(parents=True,exist_ok=True)
    journal = folder/'results.json'
    saved = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'rows':[]}
    def save():
        with tempfile.NamedTemporaryFile(dir=folder,delete=False,suffix='.tmp') as handle:
            temporary=Path(handle.name);handle.write(json.dumps(saved,ensure_ascii=False,indent=2).encode('utf-8'))
        try:
            for retry in range(4):
                try:temporary.replace(journal);break
                except PermissionError:
                    if retry==3:raise
                    time.sleep(.05)
        finally:
            if temporary.exists():temporary.unlink()
    frontend=ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    code="import {toSpokenText} from './src/services/spokenText.js';import {readFileSync} from 'node:fs';console.log(JSON.stringify(JSON.parse(readFileSync(0,'utf8')).map(r=>({...r,spoken:toSpokenText(r.text,r.lang)}))));"
    sentences=json.loads(subprocess.run(['node','--input-type=module','-e',code],cwd=frontend,input=json.dumps(SENTENCES),text=True,encoding='utf-8',capture_output=True,check=True).stdout)
    saved['sentences']=sentences;save()
    import requests,httpx
    post,send=requests.post,httpx.AsyncClient.send
    def count(url):
        if '/tts/' not in str(url) or saved['calls'] >= 12: raise RuntimeError('TTS-only budget exhausted')
        saved['calls']+=1;save()
    def limited_post(url,**kwargs):count(url);return post(url,**kwargs)
    async def limited_send(self,request,**kwargs):count(request.url);return await send(self,request,**kwargs)
    requests.post,httpx.AsyncClient.send=limited_post,limited_send
    service=VoiceService.__new__(VoiceService);service.gnani=client;service.tts_provider='gnani'
    service.last_provider_used=service.last_error=None;service.last_media_type='audio/wav'
    service._gtts_tts=lambda *args:b'' # No extra non-Gnani service in the experiment.
    for sentence in sentences:
        for mode in ('rest','stream'):
            if args.repeat_en_rest and (sentence['lang']!='en' or mode!='rest'):continue
            trial=f"{sentence['lang']}-{mode}"+('-repeat' if args.repeat_en_rest else '')
            if trial in saved['attempted']:continue
            saved['attempted'].append(trial);save()
            client.tts_cache_dir=folder/trial # Separate cold caches, identical production key format.
            row={'language':sentence['lang'],'mode':mode,'trial':trial,'model':client.tts_model,'voice':client.tts_voice}
            before=saved['calls'];began=time.perf_counter();first=None;audio_ms=0;path=None;chunks=0
            if mode=='rest':
                audio=service.text_to_speech(sentence['spoken'],sentence['lang'])
                if audio:
                    first=(time.perf_counter()-began)*1000
                    path='cache' if client.last_tts_source=='cache' else 'rest' if service.last_provider_used==f'gnani:{client.tts_model}:{client.tts_voice}' else 'fallback'
                    with wave.open(io.BytesIO(audio),'rb') as wav:audio_ms=wav.getnframes()/wav.getframerate()*1000
                row['success']=bool(audio)
            else:
                async def run():
                    nonlocal first,audio_ms,path,chunks
                    complete=False
                    async for frame in speak_events(service,sentence['spoken'],sentence['lang']):
                        kind=frame.split('\n')[0][7:];data=json.loads(frame.split('data: ',1)[1])
                        if kind=='reset':audio_ms=0
                        if kind=='audio':
                            if first is None:first=(time.perf_counter()-began)*1000
                            raw=base64.b64decode(data['audio']);path=data['path'];chunks+=1
                            if data['encoding']=='pcm_s16le':audio_ms+=len(raw)/(2*data['sample_rate'])*1000
                            else:
                                with wave.open(io.BytesIO(raw),'rb') as wav:audio_ms=wav.getnframes()/wav.getframerate()*1000
                        if kind=='complete':complete=True
                    return complete
                row['success']=asyncio.run(run())
            row.update(time_to_first_audio_ms=round(first,1) if first is not None else None,total_ms=round((time.perf_counter()-began)*1000,1),
                       total_audio_ms=round(audio_ms,1),path=path,chunks=chunks,calls=saved['calls']-before)
            saved['rows'].append(row);save();print(json.dumps(row),flush=True)
    print(json.dumps({'live_tts_calls':saved['calls'],'stt_calls':0}),flush=True)


if __name__=='__main__':main()
