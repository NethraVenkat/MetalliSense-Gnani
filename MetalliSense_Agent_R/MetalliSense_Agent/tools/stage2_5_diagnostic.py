"""Explicit, sequential generated-speech comparisons. No application mutations.

Each invocation creates a new ignored evidence directory. Never invokes private
capture, authorization, wake checks or a plant service. No user audio is read.
"""
import argparse, asyncio, base64, contextlib, hashlib, io, json, os, sys, tempfile, time, uuid, wave
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'app')]

def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def duration(audio):
    with wave.open(io.BytesIO(audio)) as source:
        frames=source.readframes(source.getnframes())
        assert frames and len(frames)==source.getnframes()*source.getnchannels()*source.getsampwidth()
        return source.getnframes()/source.getframerate()

TANGLISH=[('H-1053 status enna?','heat_status','/premelt-gate'),('latest reading enna','spectrometer_heat_reading','/spectrometer'),('oru reading edu','request_reading','/spectrometer'),('gate check pannu H-1051','gate_check','/premelt-gate'),('spectrometer ku po','open_screen','/dashboard')]
ENGLISH=[('spectrometer ku po','open_screen','/dashboard'),('gate check H-1051','gate_check','/premelt-gate'),('receive truck','receive_lot','/raw-material-stock'),('approve the selected PR','approve_pr','/inventory-forecast'),('latest reading','spectrometer_heat_reading','/spectrometer'),('request reading','request_reading','/spectrometer'),('status of H-1053','heat_status','/premelt-gate'),('receive lot','receive_lot','/raw-material-stock'),('start melting H-1053','start_melting','/premelt-gate'),('open dashboard','open_screen','/grades')]
HINDI=[('रीडिंग लो','request_reading','/spectrometer'),('गेट चेक करो H-1051','gate_check','/premelt-gate'),('PR अप्रूव करो','approve_pr','/inventory-forecast'),('H-1053 स्थिति क्या है?','heat_status','/premelt-gate'),('डैशबोर्ड खोलो','open_screen','/grades')]
SAFETY={
 'en':['Say yes or no.','Say your passcode.','Heat H-1051: receive 4000 kilograms of pig iron.','Approve PR-1001 for 2000 kilograms.','Test action: no plant or backend effect. Say yes or no.'],
 'ta':['ஆமா அல்லது இல்லை சொல்லுங்க.','உங்க பாஸ்கோடை சொல்லுங்க.','Heat H-1051: 4000 கிலோ pig iron பெறவும்.','PR-1001: 2000 கிலோ வாங்க அனுமதி.','Test action: எந்த மாற்றமும் இல்லை. ஆமா அல்லது இல்லை சொல்லுங்க.'],
 'hi':['हाँ या नहीं कहिए।','अपना पासकोड बोलिए।','Heat H-1051: 4000 किलो pig iron प्राप्त करें।','PR-1001: 2000 किलो खरीदने की अनुमति।','Test action: कोई बदलाव नहीं। हाँ या नहीं कहिए।']}
REPLIES=['Heat H-1053 is HOLD. Copper is above the limit.','The latest reading is available on screen.','There are four thousand kilograms of pig iron in stock.','Gate check complete. Review the decision on screen.','The action was cancelled. No change was made.']

async def main():
    parser=argparse.ArgumentParser();parser.add_argument('part',choices=['context','tags','stream']);parser.add_argument('--live',action='store_true');args=parser.parse_args()
    out=ROOT/'tools/local_wake_data'/('stage2_5-'+args.part+'-'+uuid.uuid4().hex);out.mkdir(parents=True)
    write(out/'plan.json',{'part':args.part,'groups':{'Tanglish':TANGLISH,'English':ENGLISH,'Hindi':HINDI} if args.part=='context' else SAFETY if args.part=='tags' else REPLIES,'new_run':True,'live':args.live,'max_attempts_per_call':3,'backoff_seconds':30,'one_in_flight':True})
    print(out,flush=True)
    if not args.live:return
    from dotenv import load_dotenv
    load_dotenv(ROOT/'.env')
    from tools.stage1_wake_diagnostic import retry_transport,convert,sapi
    from app.copilot import gnani_client as g
    from app.copilot.provider_calls import post
    requests=[];last=[0.]
    def attempt(url,**kwargs):
        time.sleep(max(0,1.1-(time.monotonic()-last[0])));started=time.monotonic()
        try:
            response=post(url,**kwargs);requests.append({'endpoint':urlsplit(url).path,'status':response.status_code,'elapsed_ms':round((time.monotonic()-started)*1000)});return response
        except Exception as error:
            requests.append({'endpoint':urlsplit(url).path,'error_class':type(error).__name__});raise
        finally:last[0]=time.monotonic();write(out/'requests.json',requests)
    with tempfile.TemporaryDirectory(prefix='stage2_5-agent-') as temp:
        os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false',LANG_BRIDGE='false',GNANI_TTS_CLARITY='false',STT_AUTO_LANGUAGE='false',TTS_AUDIO_TAGS='false',STT_CONTEXT_ENABLED='false')
        g.provider_post=retry_transport(attempt)
        with contextlib.redirect_stdout(io.StringIO()):client=g.GnaniClient()
        if client.mock:raise RuntimeError('Live diagnostic requires configured credentials; no request sent')
        write(out/'configuration.json',{'tts_model':client.tts_model,'tts_voice':client.tts_voice,'sample_rate':client.tts_sample_rate,'stt_model':client.stt_model,'stt_format':client.stt_format,'baseline_keyterms':client.stt_keyterms,'no_private_capture':True})
        rows=[]
        def synth(text,lang):
            audio=client.synthesize(text,lang,allow_fallback=False,max_calls=1)
            if not audio:raise RuntimeError('TTS unavailable endpoint=/api/v1/tts/inference')
            return audio
        try:
            if args.part=='context':
                old=ROOT/'tools/local_wake_data/v23-tanglish-536114d2c35141f09b5b3f24f42e2c84'
                for group,prompts,locale in [('Tanglish',TANGLISH,'ta-IN,en-IN'),('English',ENGLISH,'en-IN'),('Hindi',HINDI,'hi-IN')]:
                    for i,(text,intent,route) in enumerate(prompts):
                        audio=(old/f'clip-{i}.wav').read_bytes() if group=='Tanglish' else sapi(text) if group=='English' else convert(synth(text,'hi'))
                        file=f'{group}-{i}.wav';(out/file).write_bytes(audio)
                        row={'group':group,'prompt':text,'expected':intent,'route':route,'file':file,'sha256':hashlib.sha256(audio).hexdigest(),'duration':duration(audio)}
                        for variant in ['off','on']:
                            os.environ['STT_CONTEXT_ENABLED']=str(variant=='on').lower()
                            result=client.transcribe(audio,locale,max_attempts=1,output_format='codemix',purpose='command')
                            if not result.get('success'):raise RuntimeError('STT unavailable endpoint=/stt/v3')
                            row[variant]=result
                        rows.append(row);write(out/'results.json',rows)
            elif args.part=='tags':
                if client.tts_model!='timbre-v3.0':
                    write(out/'results.json',{'skipped':'Configured model is not timbre-v3.0; no substitution'});return
                for lang,prompts in SAFETY.items():
                    for i,text in enumerate(prompts):
                        row={'language':lang,'text':text}
                        for enabled in [False,True]:
                            os.environ['TTS_AUDIO_TAGS']=str(enabled).lower();audio=synth(text,lang);file=f'{lang}-{i}-'+('tags' if enabled else 'plain')+'.wav';(out/file).write_bytes(audio)
                            row['on' if enabled else 'off']={'file':file,'duration':duration(audio),'payload_text':g.tts_text(text,client.tts_model,'normal',client.tts_tags),'sha256':hashlib.sha256(audio).hexdigest()}
                        rows.append(row);write(out/'results.json',rows)
                (out/'index.html').write_text('<meta charset="utf-8"><h1>Generated TEST prompts — listening pending</h1>'+''.join('<p>'+r['language']+' '+r['text']+'</p>'+''.join('<div>'+v+'<audio controls src="'+r[v]['file']+'"></audio></div>' for v in ['off','on']) for r in rows),encoding='utf-8')
            else:
                from app.copilot import gnani_tts_stream as stream
                import httpx
                from types import SimpleNamespace
                original=httpx.AsyncClient
                async def mark_request(request):
                    await asyncio.sleep(max(0,1.1-(time.monotonic()-last[0])));requests.append({'endpoint':request.url.path,'transport':'SSE'});write(out/'requests.json',requests)
                async def mark_response(response):requests[-1]['status']=response.status_code;write(out/'requests.json',requests)
                def http(*a,**kw):
                    kw['event_hooks']={'request':[mark_request],'response':[mark_response]}
                    client_http=original(*a,**kw);original_send=client_http.send
                    async def send(*args,**kwargs):
                        try:return await original_send(*args,**kwargs)
                        except BaseException as error:
                            if requests:requests[-1]['error_class']=type(error).__name__
                            write(out/'requests.json',requests);raise
                    client_http.send=send
                    return client_http
                stream.httpx.AsyncClient=http
                def no_fallback(*a,**kw):raise RuntimeError('Diagnostic disables fallback calls')
                service=SimpleNamespace(gnani=client,tts_provider='gnani',text_to_speech=no_fallback)
                for i,text in enumerate(REPLIES):
                    # Pacing is outside readiness timers for BOTH transports.
                    await asyncio.sleep(max(0,1.1-(time.monotonic()-last[0])))
                    start=time.monotonic();audio=synth(text,'en');rest=(time.monotonic()-start)*1000;path=client._cache_path(g.tts_text(text,client.tts_model,'normal',client.tts_tags),'en-IN',client.tts_voice,'normal',model=client.tts_model)
                    # Only our isolated temporary cache file; force a fresh SSE measurement.
                    if path.exists():path.unlink()
                    await asyncio.sleep(max(0,1.1-(time.monotonic()-last[0])))
                    first=None;pcm=bytearray();events=[];start=time.monotonic()
                    for attempt_number in range(3):
                        async for event in stream.speak_events(service,text,'en'):
                            kind=event.split('\n')[0][7:];data=json.loads(event.split('data: ',1)[1]);events.append(kind)
                            if kind=='audio':
                                if first is None:first=(time.monotonic()-start)*1000
                                if data.get('path')!='stream':raise RuntimeError('Not an SSE stream')
                                pcm.extend(base64.b64decode(data['audio']))
                        # Never repeat partial audio; retry only a failed start.
                        if 'complete' in events or first is not None or attempt_number==2:break
                        await asyncio.sleep(30)
                    last[0]=time.monotonic()
                    row={'text':text,'rest_first_playable_ms':rest,'sse_first_pcm_ms':first,'events':events,'sse_completed':'complete' in events,'sse_total_ms':(time.monotonic()-start)*1000,'rest_duration':duration(audio),'sse_pcm_bytes':len(pcm)}
                    rows.append(row);write(out/'results.json',rows)
                    if not row['sse_completed']:break
        except Exception as error:
            write(out/'failure.json',{'error_class':type(error).__name__,'message':str(error)[:180]});raise RuntimeError(type(error).__name__+'; sanitized evidence saved') from None
        finally:write(out/'requests.json',requests)
    print('Completed; recorded HTTP attempts',len(requests),flush=True)
if __name__=='__main__':asyncio.run(main())
