"""One explicitly authorized STT probe; no retries, synthesis or fallback."""
import argparse,contextlib,hashlib,io,json,os,sys,tempfile,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'app')]
def main():
 p=argparse.ArgumentParser();p.add_argument('--live',action='store_true');args=p.parse_args()
 source=ROOT/'tools/local_wake_data/stage2_6-language-52bd9e1ccf2844d58849e504783853ba/Tanglish-1.wav'
 from tools.stage2_5_diagnostic import duration
 audio=source.read_bytes();seconds=duration(audio)
 out=ROOT/'tools/local_wake_data'/('stage2_6-probe-'+uuid.uuid4().hex);out.mkdir(parents=True)
 row={'endpoint':'/stt/v3','audio_sha256':hashlib.sha256(audio).hexdigest(),'duration':seconds,'max_calls':1,'attempts':0}
 if args.live:
  from dotenv import load_dotenv
  load_dotenv(ROOT/'.env')
  from app.copilot.gnani_client import GnaniClient
  from app.copilot.provider_calls import post
  with tempfile.TemporaryDirectory(prefix='stage2_6-probe-') as temp:
   os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false')
   with contextlib.redirect_stdout(io.StringIO()):client=GnaniClient()
   if client.mock:raise RuntimeError('No credential; zero calls')
   start=time.monotonic();row['attempts']=1
   try:
    data={'model':client.stt_model,'language_code':'ta-IN,en-IN','format':'codemix'}
    if client.stt_keyterms:data['keyterms']=client.stt_keyterms
    response=post(client.base_url+'/stt/v3',headers=client._headers(),files={'audio_file':('audio.wav',audio,'audio/wav')},data=data,timeout=60)
    row['status']=response.status_code;row['success']=response.status_code==200
    if response.status_code>=400:
     try:
      body=response.json();error=body.get('error') or body.get('detail') or body
      if isinstance(error,dict):
       row['provider_error']={k:str(error[k]).replace(client.api_key,'[redacted]')[:200] for k in ['type','code','error_code','message'] if k in error}
      if body.get('request_id'):row['request_id']=str(body['request_id'])[:100]
     except (ValueError,TypeError):pass
   except Exception as error:row['error_class']=type(error).__name__;row['success']=False
   finally:row['elapsed_ms']=round(1000*(time.monotonic()-start))
 (out/'result.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8');print(out);print(json.dumps({k:row[k] for k in ['endpoint','attempts','status','success','error_class'] if k in row}))
if __name__=='__main__':main()
