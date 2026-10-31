"""One bounded live context update through the unchanged Agent proxy handler."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import socket
import sys

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

async def run(folder):
 import uvicorn
 from fastapi import FastAPI
 from websockets.asyncio.client import connect
 from app.copilot.gnani_stream import proxy_stream
 from tools.stream_smoke import load_pcm
 from tools.f8_context_bias_bench import CONTEXT
 app=FastAPI();app.add_api_websocket_route('/copilot/voice/stream',proxy_stream)
 # Separate local port: no restart, env edit or lifespan/model initialization.
 local=socket.socket();local.bind(('127.0.0.1',0));port=local.getsockname()[1]
 server=uvicorn.Server(uvicorn.Config(app,log_level='critical',lifespan='off'))
 task=asyncio.create_task(server.serve(sockets=[local]))
 result={'sessions':1,'audio_duration_s':0,'settings_updated':False,'messages':[]}
 def save():(folder/'stream.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 save()
 try:
  async with asyncio.timeout(20):
   while not server.started:await asyncio.sleep(.01)
   pcm=load_pcm(ROOT/'tools/noise_bench/clean/heat_42_tanglish.wav')[:16000*2*10]
   async with connect(f'ws://127.0.0.1:{port}/copilot/voice/stream',origin='http://localhost:5173',open_timeout=3,close_timeout=1) as ws:
    await ws.send(json.dumps({'type':'start','sample_rate':16000}))
    message=json.loads(await ws.recv());result['messages'].append({'type':message.get('type'),'code':message.get('code')})
    if message.get('type')!='connected':return result
    await ws.send(json.dumps({'type':'context_terms','terms':CONTEXT}))
    async with asyncio.timeout(7):
     while True:
      message=json.loads(await ws.recv())
      result['messages'].append({key:message[key] for key in ('type','code','term_count') if key in message})
      if message.get('type')=='settings_updated':result['settings_updated']=True;break
      if message.get('type') in ('error','closed','context_bias'):break
    for offset in range(0,len(pcm),1024):
     part=pcm[offset:offset+1024];await ws.send(part);result['audio_duration_s']+=len(part)/32000
     await asyncio.sleep(len(part)/32000)
    await ws.send(json.dumps({'type':'stop'}))
    while True:
     message=json.loads(await ws.recv())
     result['messages'].append({key:message[key] for key in ('type','code','term_count') if key in message})
     if message.get('type')=='final':result['transcript']=message.get('text','')
     if message.get('type')=='closed':break
 except Exception:
  result['error']='stream_smoke_incomplete'
 finally:
  save();server.should_exit=True
  await task;local.close()
 return result

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--live',action='store_true');args=parser.parse_args()
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 folder=ROOT/'app/data/tts_cache/f8_context_bias';folder.mkdir(parents=True,exist_ok=True)
 journal=folder/'stream.json'
 if journal.exists() or not args.live:
  print(journal.read_text(encoding='utf-8') if journal.exists() else 'No streaming attempt yet');return
 os.environ.update(GNANI_CONTEXT_BIAS='on',GNANI_STREAM_ENABLED='on',GNANI_STT_MODEL='prisma-v3.0')
 print(json.dumps(asyncio.run(run(folder)),ensure_ascii=False))

if __name__=='__main__':main()
