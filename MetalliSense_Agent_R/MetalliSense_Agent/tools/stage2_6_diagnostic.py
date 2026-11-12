"""Generated-only Stage 2.6 trials; saved plans and sequential HTTP journals."""
import argparse,contextlib,hashlib,io,json,os,sys,tempfile,time,uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'app')]
HINDI=[('लेटेस्ट रीडिंग दिखाओ','spectrometer_heat_reading','/spectrometer'),('रीडिंग लो','request_reading','/spectrometer'),('गेट चेक करो H-1051','gate_check','/premelt-gate'),('H-1053 स्थिति क्या है?','heat_status','/premelt-gate'),('H-1053 मेल्टिंग शुरू करो','start_melting','/premelt-gate'),('चुना हुआ PR अप्रूव करो','approve_pr','/inventory-forecast'),('ट्रक रिसीव करो','receive_lot','/raw-material-stock'),('स्पेक्ट्रोमीटर जाओ','open_screen','/dashboard')]
NAV=[(x,'open_screen','/dashboard') for x in ['spectrometer ku po','pre melt gate ku po','stock page ku po','spectrometer open pannu']]
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def main():
 p=argparse.ArgumentParser();p.add_argument('part',choices=['hindi','navigation','language']);p.add_argument('--live',action='store_true');p.add_argument('--native-tamil',action='store_true');p.add_argument('--resume-tamil',type=Path);p.add_argument('--not-before');args=p.parse_args()
 if args.native_tamil and args.part!='language':p.error('--native-tamil requires language')
 if args.resume_tamil and (not args.native_tamil or args.part!='language'):p.error('Tamil resume requires language --native-tamil')
 if args.live and args.not_before:
  earliest=datetime.fromisoformat(args.not_before)
  if earliest.tzinfo is None:p.error('--not-before requires an explicit timezone')
  if datetime.now(timezone.utc)<earliest:raise SystemExit('Real calls paused until the explicit not-before time; zero calls')
 out=ROOT/'tools/local_wake_data'/('stage2_6-'+args.part+'-'+uuid.uuid4().hex);out.mkdir(parents=True)
 prompts=HINDI if args.part=='hindi' else NAV
 write(out/'plan.json',{'part':args.part,'prompts':prompts if args.part!='language' else 'fixed 4 saved Tamil/Tanglish + 4 saved Hindi + 4 saved English, same audio OFF/ON','threshold':'7/8 Hindi; 3/4 navigation; language and routes ON>=OFF','live':args.live,'no_tuning':True});print(out,flush=True)
 if not args.live:return
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 from app.copilot import gnani_client as g
 from app.copilot.provider_calls import post
 from tools.stage1_wake_diagnostic import retry_transport,convert
 from tools.stage2_5_diagnostic import duration
 requests=[];last=[0.]
 def attempt(url,**kwargs):
  time.sleep(max(0,1.1-(time.monotonic()-last[0])));start=time.monotonic()
  try:
   response=post(url,**kwargs);record={'endpoint':urlsplit(url).path,'status':response.status_code,'elapsed_ms':round(1000*(time.monotonic()-start))}
   if response.status_code>=400:
    try:
     body=response.json();error=body.get('error') or body.get('detail') or body
     if isinstance(error,dict):
      record['provider_error']={k:str(error[k])[:200] for k in ['type','code','error_code','message'] if k in error}
     if body.get('request_id'):record['request_id']=str(body['request_id'])[:100]
     key=os.getenv('GNANI_API_KEY','')
     if key:
      record={k:json.loads(json.dumps(v,ensure_ascii=False).replace(key,'[redacted]')) for k,v in record.items()}
    except (ValueError,TypeError):pass
   requests.append(record);return response
  except Exception as e:requests.append({'endpoint':urlsplit(url).path,'error_class':type(e).__name__});raise
  finally:last[0]=time.monotonic();write(out/'requests.json',requests)
 with tempfile.TemporaryDirectory(prefix='stage2_6-agent-') as temp:
  os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false',STT_CONTEXT_ENABLED='false',TTS_AUDIO_TAGS='false',GNANI_TTS_CLARITY='false',LANG_BRIDGE='false',STT_AUTO_LANGUAGE='false')
  g.provider_post=retry_transport(attempt)
  with contextlib.redirect_stdout(io.StringIO()):client=g.GnaniClient()
  if client.mock:raise RuntimeError('No configured credential; zero calls')
  write(out/'configuration.json',{'tts_model':client.tts_model,'tts_voice':client.tts_voice,'stt_model':client.stt_model,'format':'codemix','context':False,'source_hashes':{str(x.relative_to(ROOT.parent.parent)):hashlib.sha256(x.read_bytes()).hexdigest() for x in [ROOT/'app/copilot/gnani_client.py',ROOT.parent.parent/'MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceActionLanguages.js']}})
  rows=[];prior=[]
  if args.resume_tamil:
   prior_root=args.resume_tamil.resolve()
   if not prior_root.is_relative_to((ROOT/'tools/local_wake_data').resolve()):raise ValueError('Resume evidence must be local diagnostic data')
   prior=json.loads((prior_root/'results.json').read_text(encoding='utf-8'))
   previous_config=json.loads((prior_root/'configuration.json').read_text(encoding='utf-8'))
   if any(previous_config[k]!=getattr(client,k) for k in ['tts_model','tts_voice','stt_model']):raise ValueError('Resume configuration mismatch')
   write(out/'resume-provenance.json',{'parent':str(prior_root),'results_sha256':hashlib.sha256((prior_root/'results.json').read_bytes()).hexdigest(),'no_completed_calls_repeated':True})
  try:
   if args.part!='language':
    for i,(text,intent,route) in enumerate(prompts):
     audio=client.synthesize(text,'hi' if args.part=='hindi' else 'ta',allow_fallback=False,max_calls=1)
     if not audio:raise RuntimeError('TTS failed endpoint=/api/v1/tts/inference')
     audio=convert(audio);file=f'clip-{i}.wav';(out/file).write_bytes(audio)
     result=client.transcribe(audio,'hi-IN' if args.part=='hindi' else 'ta-IN,en-IN',max_attempts=1,output_format='codemix',purpose='command')
     if not result.get('success'):raise RuntimeError('STT failed endpoint=/stt/v3')
     row={'prompt':text,'expected':intent,'route':route,'file':file,'duration':duration(audio),'sha256':hashlib.sha256(audio).hexdigest(),'result':result}
     if args.part=='navigation':row['target']=['/spectrometer','/premelt-gate','/raw-material-stock','/spectrometer'][i]
     rows.append(row);write(out/'results.json',rows)
   else:
    source=ROOT/'tools/local_wake_data/stage2_5-context-6552dfd8f863484e9df210bf0016e0d1';saved=json.loads((source/'results.json').read_text(encoding='utf-8'))
    selections=[('Tamil',r,'ta-IN,en-IN','ta','en') for r in saved if r['group']=='Tanglish'][:4]+[('Hindi',r,'hi-IN','hi','ta') for r in saved if r['group']=='Hindi'][:4]+[('English',r,'en-IN','en','ta') for r in saved if r['group']=='English' and r['prompt']!='spectrometer ku po'][:4]
    if args.native_tamil:
     native=['H-1053 நிலை என்ன?','கடைசி ரீடிங் என்ன?','ஒரு ரீடிங் எடு','H-1051 கேட் செக் பண்ணு']
     selections=[(group,{**row,'prompt':native[i]},locale,expected,current) for i,(group,row,locale,expected,current) in enumerate(selections[:4])]
    write(out/'plan.json',{'part':'language','selection':[{'group':group,'source':row['file'],'sha256':row['sha256'],'current':current,'expected_language':expected,'off_locale':locale,'on_locale':'indic-auto'} for group,row,locale,expected,current in selections],'guard':'under 3 words / outside ta hi en / ambiguous hi-mr => current','no_tuning':True,'live':True})
    for group,row,locale,expected,current in selections:
     if args.resume_tamil:
      complete=next((x for x in prior if x['prompt']==row['prompt'] and x.get('off',{}).get('success') and x.get('on',{}).get('success')),None)
      if complete:
       audio=Path(complete['source']).read_bytes()
       if hashlib.sha256(audio).hexdigest()!=complete['sha256']:raise ValueError('Completed sample hash mismatch')
       duration(audio);rows.append({**complete,'reused':True});write(out/'results.json',rows);continue
     if args.native_tamil:
      existing=args.resume_tamil/row['file'] if args.resume_tamil else None
      if existing and existing.exists():audio=existing.read_bytes();duration(audio)
      else:
       audio=client.synthesize(row['prompt'],'ta',allow_fallback=False,max_calls=1)
       if not audio:raise RuntimeError('TTS failed endpoint=/api/v1/tts/inference')
      audio=convert(audio);(out/row['file']).write_bytes(audio);row={**row,'sha256':hashlib.sha256(audio).hexdigest(),'duration':duration(audio)};origin=out/row['file']
      write(out/(row['file']+'.json'),{'prompt':row['prompt'],'sha256':row['sha256'],'duration':row['duration'],'tts_model':client.tts_model,'tts_voice':client.tts_voice,'reused_audio':bool(existing and existing.exists())})
     else:
      audio=(source/row['file']).read_bytes();assert hashlib.sha256(audio).hexdigest()==row['sha256'];origin=source/row['file']
     item={**row,'group':group,'expected_language':expected,'current_language':current,'source':str(origin)};item.pop('off',None);item.pop('on',None)
     for variant in ['off','on']:
      os.environ['STT_AUTO_LANGUAGE']=str(variant=='on').lower();result=client.transcribe(audio,locale,max_attempts=1,output_format='codemix',purpose='command')
      if not result.get('success'):raise RuntimeError('STT failed endpoint=/stt/v3')
      item[variant]=result
     rows.append(item);write(out/'results.json',rows)
  except Exception as e:write(out/'failure.json',{'error_class':type(e).__name__,'message':str(e)[:180]});raise RuntimeError(type(e).__name__+'; sanitized evidence saved') from None
  finally:write(out/'requests.json',requests)
 print('Completed; HTTP attempts',len(requests),flush=True)
if __name__=='__main__':main()
