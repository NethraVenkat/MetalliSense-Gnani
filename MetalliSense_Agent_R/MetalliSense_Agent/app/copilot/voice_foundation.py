"""Opt-in voice action foundation endpoints; no plant service imports."""
import asyncio,secrets,os,ipaddress
from urllib.parse import urlparse
from fastapi import APIRouter,Body,File,UploadFile,Form,Header,HTTPException,Depends,Request
from fastapi.responses import FileResponse,Response
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from .voice_audit import AUDIT,flag,today
from .voice_auth import AUTH
from .voice_audio_log import AUDIO
from contextlib import asynccontextmanager,suppress
@asynccontextmanager
async def foundation_lifespan(app):
    if flag('VOICE_AUDIO_LOG_ENABLED'):AUDIO.purge()
    async def daily():
        while True:
            await asyncio.sleep(86400)
            if flag('VOICE_AUDIO_LOG_ENABLED'):await asyncio.to_thread(AUDIO.purge)
    task=asyncio.create_task(daily())
    try:yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):await task
def feature_gate(request:Request):
    path=request.url.path
    flags=['VOICE_ACTIONS_ENABLED','VOICE_AUDIT_ENABLED','VOICE_AUDIO_LOG_ENABLED'] if path.endswith('/session') else ['VOICE_AUDIO_LOG_ENABLED'] if '/audio' in path else ['VOICE_AUDIT_ENABLED'] if '/audit' in path or '/debug/' in path else ['VOICE_ACTIONS_ENABLED']
    if not any(flag(name) for name in flags):raise HTTPException(404,'Voice feature disabled')
class FoundationRoute(APIRoute):
    def get_route_handler(self):
        original=super().get_route_handler()
        async def handle(request):
            feature_gate(request)
            try:return await original(request)
            except RequestValidationError:raise HTTPException(422,'Invalid voice foundation request') from None
        return handle
router=APIRouter(prefix='/copilot/voice',tags=['Voice foundation'],lifespan=foundation_lifespan,dependencies=[Depends(feature_gate)],route_class=FoundationRoute)

def enabled(name):
    if not flag(name):raise HTTPException(404,'Voice feature disabled')
def session(value):
    if not value or not AUTH.valid_session(value):raise HTTPException(401,'Voice session required')
    return value
def payload(body,keys):
    if not isinstance(body,dict) or any(k not in keys for k in body):raise HTTPException(422,'Invalid request')
    return body
def local_debug(request):
    enabled('VOICE_AUDIT_ENABLED')
    def loopback(host):
        try:return ipaddress.ip_address(host).is_loopback
        except ValueError:return host=='localhost'
    if os.getenv('APP_ENV','development').lower() not in ['development','dev','test'] or not request.client or not loopback(request.client.host):raise HTTPException(404,'Debug endpoint unavailable')
    origin=request.headers.get('origin')
    if origin and not loopback(urlparse(origin).hostname or ''):raise HTTPException(403,'Local origin required')
@router.get('/debug/state')
def debug_state(request:Request):
    local_debug(request);return AUTH.debug_state()
@router.post('/debug/reset-lock')
def debug_reset_lock(request:Request,x_voice_session:str=Header('')):
    local_debug(request);session(x_voice_session);return AUTH.reset_lock()
@router.post('/session')
def start_session(x_voice_session:str=Header('')):
    if not any(flag(k) for k in ['VOICE_ACTIONS_ENABLED','VOICE_AUDIT_ENABLED','VOICE_AUDIO_LOG_ENABLED']):raise HTTPException(404)
    return {'session_id':x_voice_session if AUTH.valid_session(x_voice_session) else AUTH.session(),'actions':flag('VOICE_ACTIONS_ENABLED'),'audit':flag('VOICE_AUDIT_ENABLED'),'audio':flag('VOICE_AUDIO_LOG_ENABLED')}
@router.post('/readback')
def readback(body:dict=Body(...),x_voice_session:str=Header('')):
    enabled('VOICE_ACTIONS_ENABLED');sid=session(x_voice_session);payload(body,{'action_id','summary','page'})
    if not flag('VOICE_AUDIT_ENABLED'):raise HTTPException(503,'Voice actions require audit logging')
    if not AUTH.readback(sid,body.get('action_id'),body.get('summary',''),body.get('page','')):raise HTTPException(403,'Action not registered or screen-only')
    return {'ok':True}
@router.post('/authorize')
def authorize(body:dict=Body(...),x_voice_session:str=Header('')):
    enabled('VOICE_ACTIONS_ENABLED');sid=session(x_voice_session);payload(body,{'action_id','required_roles','spoken_code_text'})
    try:return AUTH.authorize(sid,str(body.get('action_id','')),body.get('required_roles',[]),str(body.get('spoken_code_text',''))[:250])
    except (ValueError,TypeError):raise HTTPException(503,'Voice approval configuration unavailable') from None
@router.post('/token/confirm')
def confirm_word(body:dict=Body(...),x_voice_session:str=Header('')):
    enabled('VOICE_ACTIONS_ENABLED');sid=session(x_voice_session);payload(body,{'token','action_id','spoken_word'})
    return AUTH.confirm_word(sid,body.get('token'),body.get('action_id'),str(body.get('spoken_word',''))[:50])
@router.post('/token/consume')
def consume(body:dict=Body(...),x_voice_session:str=Header('')):
    enabled('VOICE_ACTIONS_ENABLED');return AUTH.consume(session(x_voice_session),body.get('token',''),body.get('action_id',''))
@router.post('/cancel')
def cancel(x_voice_session:str=Header('')):
    enabled('VOICE_ACTIONS_ENABLED');AUTH.cancel(session(x_voice_session));return {'ok':True}
@router.post('/audit')
def append(body:dict=Body(...),x_voice_session:str=Header('')):
    enabled('VOICE_AUDIT_ENABLED');sid=session(x_voice_session)
    # During an approval challenge, a malicious/mistaken client cannot persist secret text.
    if AUTH.sensitive(sid):body={**body,'transcript':'','summary':'Private approval interaction','spoken_reply':'Private approval interaction','confirmation':'passcode','heard':'[passcode masked]','normalized_text':'[passcode masked]','target':'','candidates':[]}
    if body.get('decision') not in ['executed','refused','cancelled','timeout','failed','locked']:raise HTTPException(422,'Invalid decision')
    body={**body,'user':AUTH.identities.get(sid)}
    try:return {'event':AUDIT.append(body,sid),'source':'client-reported; not independent backend verification'}
    except ValueError:raise HTTPException(409,'Audit integrity check failed') from None
@router.get('/audit/verify')
def verify(date:str='',x_voice_session:str=Header('')):
    enabled('VOICE_AUDIT_ENABLED');session(x_voice_session)
    try:return AUDIT.verify(date or today())
    except ValueError:raise HTTPException(422,'Invalid date') from None
@router.get('/audit')
def audit_list(date:str='',limit:int=100,x_voice_session:str=Header('')):
    enabled('VOICE_AUDIT_ENABLED');sid=session(x_voice_session)
    try:return {'events':[r for r in AUDIT.rows(date or today()) if r['session_id']==sid][-max(1,min(limit,500)):]}
    except ValueError:raise HTTPException(422,'Invalid audit date') from None
@router.post('/audio')
async def audio_store(audio:UploadFile=File(...),event_id:str=Form(...),purpose:str=Form('command'),no_store:bool=Form(False),page:str=Form('/'),x_voice_session:str=Header('')):
    enabled('VOICE_AUDIO_LOG_ENABLED');sid=session(x_voice_session)
    try:
        if no_store or AUTH.sensitive(sid):return {'stored':False}
        data=await audio.read(1_920_045)
        if len(data)>1_920_044:raise HTTPException(413,'Audio too large')
        try:return AUDIO.store(data,event_id,sid,purpose,no_store,AUTH.sensitive(sid),page=page)
        except Exception:raise HTTPException(422,'Invalid or duplicate WAV') from None
    finally:await audio.close()
@router.get('/audio')
def audio_list(date:str='',x_voice_session:str=Header('')):
    enabled('VOICE_AUDIO_LOG_ENABLED');sid=session(x_voice_session)
    try:return {'audio':AUDIO.listing(date or today(),sid)}
    except ValueError:raise HTTPException(422,'Invalid date') from None
@router.get('/audio/export')
def export(date:str='',x_voice_session:str=Header('')):
    enabled('VOICE_AUDIO_LOG_ENABLED');sid=session(x_voice_session)
    try:return Response(AUDIO.export(date or today(),sid),media_type='application/zip',headers={'Content-Disposition':'attachment; filename="voice-audio.zip"'})
    except ValueError:raise HTTPException(422,'Invalid date') from None
@router.get('/audio/{date}/{event_id}')
def play(date:str,event_id:str,x_voice_session:str=Header('')):
    enabled('VOICE_AUDIO_LOG_ENABLED');sid=session(x_voice_session)
    try:return FileResponse(AUDIO.file(date,event_id,sid),media_type='audio/wav')
    except (ValueError,FileNotFoundError):raise HTTPException(404) from None
@router.delete('/audio/{date}')
def delete(date:str,x_voice_admin:str=Header('')):
    enabled('VOICE_AUDIO_LOG_ENABLED');key=os.getenv('VOICE_LOG_ADMIN_KEY','')
    if not key or not secrets.compare_digest(key,x_voice_admin):raise HTTPException(403,'Admin credential required')
    try:AUDIO.delete(date)
    except ValueError:raise HTTPException(422,'Invalid date') from None
    return {'ok':True}

def log_interaction(content,sid,purpose,no_store=False,page='/'):
    """Opt-in ordinary capture evidence. Never log challenge audio or transcript."""
    if not flag('VOICE_AUDIO_LOG_ENABLED') or not sid or not AUTH.valid_session(sid) or no_store or AUTH.sensitive(sid) or purpose=='passcode':return None
    from .gnani_batch import validate_audio
    try:
        wav,_=validate_audio(content);event_id=secrets.token_hex(16)
        stored=AUDIO.store(wav,event_id,sid,'wake' if purpose=='wake' else 'command',page=page)
        AUDIT.append(dict(event_id=event_id,page=page,level='ASK',intent='audio-capture',summary='Local audio evidence; not an action',confirmation='none',decision='executed',backend_result={'status':'stored'}),sid)
        return stored
    except Exception:
        # Optional evidence failure cannot silently claim successful logging.
        import logging
        logging.getLogger('uvicorn.error').warning('voice_audio_log unavailable; capture evidence not saved')
        return None


def private_transcription(content,language):
    """Passcodes stay in memory, never in temp/audio logs or shared error summaries."""
    import io,wave
    from .gnani_client import get_gnani_client
    try:
        if len(content)>1_920_044:raise ValueError()
        with wave.open(io.BytesIO(content)) as w:
            if not 0<w.getnframes()<=960000 or (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(1,2,16000,'NONE') or len(w.readframes(w.getnframes()))!=w.getnframes()*2:raise ValueError()
    except Exception:raise HTTPException(422,'Private capture requires complete PCM WAV') from None
    client=get_gnani_client()
    try:
        result=client.transcribe(content,language,max_attempts=1,output_format='codemix')
        return {k:v for k,v in result.items() if k in ['text','language','success','detected_language_code']}
    except Exception:raise HTTPException(502,'Private transcription unavailable') from None
    finally:client.last_error=None
