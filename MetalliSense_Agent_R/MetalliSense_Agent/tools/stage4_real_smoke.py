"""Explicit final generated-speech smoke. Hard budgets, no retries, no secrets logged."""
import argparse,contextlib,hashlib,io,json,os,sys,tempfile,time,wave
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'app')]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
    if not args.live:raise SystemExit('No calls. Explicit --live required for the final bounded smoke.')
    output=ROOT/'tools/local_wake_data/stage4-final-smoke'
    output.mkdir(exist_ok=False)
    evidence={'generated_speech_only':True,'gnani_budget':10,'groq_budget':3,'requests':[],'results':[]}
    def save(): (output/'results.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    class StopAll(BaseException):pass
    from dotenv import load_dotenv
    load_dotenv(ROOT/'.env')
    with tempfile.TemporaryDirectory(prefix='stage4-real-test-') as data:
        os.environ.update(DATA_DIR=data,GNANI_TTS_CACHE_DIR=data,GNANI_MOCK='false',STT_PROVIDER='gnani',TTS_PROVIDER='gnani',WAKE_WORD_ENABLED='true',VOICE_AUDIO_LOG_ENABLED='false',VOICE_AUDIT_ENABLED='false',VOICE_ACTIONS_ENABLED='false',STT_CONTEXT_ENABLED='false',STT_AUTO_LANGUAGE='false',TTS_AUDIO_TAGS='false',PYTHON_DOTENV_DISABLED='1')
        with contextlib.redirect_stdout(io.StringIO()):
            from app.copilot import provider_calls,gnani_client
            from tools.stage1_wake_diagnostic import sapi
            from tools.kural_gnani_wake_test import onsets_v2,snippet_v2
            from fastapi.testclient import TestClient
            import app.main as app_main
            from copilot.voice_service import VoiceService
        original=provider_calls._state.session.post
        def post(url,**kwargs):
            if len(evidence['requests'])>=10:raise StopAll('Gnani budget exhausted')
            row={'endpoint':urlsplit(url).path,'status':None};evidence['requests'].append(row);save();start=time.monotonic()
            try:
                r=original(url,**kwargs);row.update(status=r.status_code,elapsed_ms=round((time.monotonic()-start)*1000));save()
                if r.status_code in (401,403,429):raise StopAll('Stopped on HTTP '+str(r.status_code)+' '+row['endpoint'])
                return r
            except StopAll:raise
            except Exception as e:row.update(error=type(e).__name__,elapsed_ms=round((time.monotonic()-start)*1000));save();raise StopAll(type(e).__name__+' '+row['endpoint']) from None
        provider_calls._state.session.post=post
        app_main.voice_service=VoiceService()
        client=gnani_client.get_gnani_client()
        original_transcribe=client.transcribe
        client.transcribe=lambda audio,language=None,**kwargs:original_transcribe(audio,language,max_attempts=1,**{k:v for k,v in kwargs.items() if k!='max_attempts'})
        # app.main's script-compatible import aliases may refer to the same singleton.
        service_client=app_main.voice_service.gnani if hasattr(app_main.voice_service,'gnani') else None
        if service_client is not None and service_client is not client:
            service_original=service_client.transcribe
            service_client.transcribe=lambda audio,language=None,**kwargs:service_original(audio,language,max_attempts=1,**{k:v for k,v in kwargs.items() if k!='max_attempts'})
        try:
            with contextlib.redirect_stdout(io.StringIO()):english=sapi('Kural. What is the latest reading?');hold=sapi('Start melting H ten fifty three.')
            tamil=ROOT/'tools/local_wake_data/stage2_6-language-52bd9e1ccf2844d58849e504783853ba/Tanglish-0.wav'
            if not tamil.exists():raise StopAll('Saved generated Tamil clip unavailable')
            clips=[('latest','/spectrometer',english,'en-IN'),('Tamil question','/premelt-gate',tamil.read_bytes(),'ta-IN'),('HOLD refusal','/premelt-gate',hold,'en-IN')]
            api=TestClient(app_main.app,raise_server_exceptions=True)
            with wave.open(io.BytesIO(english)) as w:pcm=w.readframes(w.getnframes())
            starts=onsets_v2(pcm)
            if not starts:raise StopAll('Generated wake clip has no onset under the unchanged gate')
            snippet=snippet_v2(pcm,starts[0])
            response=api.post('/copilot/voice/wake-check',files={'audio':('snippet.wav',snippet,'audio/wav')})
            evidence['results'].append({'check':'wake endpoint','status':response.status_code,'result':response.json(),'snippet_sha256':hashlib.sha256(snippet).hexdigest()});save()
            for name,page,audio,language in clips:
                response=api.post('/copilot/voice/transcribe',files={'audio':('test.wav',audio,'audio/wav')},data={'language':language,'purpose':'command','page':page})
                body=response.json();evidence['results'].append({'check':name,'page':page,'status':response.status_code,'success':body.get('success'),'transcript':body.get('text',''),'audio_sha256':hashlib.sha256(audio).hexdigest()});save()
            with contextlib.redirect_stdout(io.StringIO()):
                audio=client.synthesize('This is a generated test reply. The HOLD gate remains locked.','en',allow_fallback=False,max_calls=1)
            evidence['results'].append({'check':'Timbre reply','obtained':bool(audio),'bytes':len(audio or b'')});save()
            if os.getenv('GROQ_API_KEY'):
                from app.copilot.groq_explainer import ExplainableAICopilot
                from groq import Groq
                copilot=ExplainableAICopilot();copilot.client=Groq(api_key=os.environ['GROQ_API_KEY'],max_retries=0,timeout=15)
                evidence['groq_calls']=1;save()
                with contextlib.redirect_stdout(io.StringIO()):reply=copilot.chat('In one sentence, why must a foundry HOLD gate not be bypassed?',include_context=False)
                evidence['results'].append({'check':'Groq explanation chat','result':{k:v for k,v in reply.items() if k in ('response','success')}});save()
            else:evidence['groq_calls']=0;evidence['groq_blocker']='Configured key unavailable to process'
            api.close()
        except StopAll as e:evidence['stopped']=str(e)
        except Exception as e:evidence['stopped']=type(e).__name__
        finally:
            provider_calls._state.session.post=original;save()
    print(json.dumps({'output':str(output),'gnani_calls':len(evidence['requests']),'stopped':evidence.get('stopped'),'results':evidence['results']},ensure_ascii=False))

if __name__=='__main__':main()
