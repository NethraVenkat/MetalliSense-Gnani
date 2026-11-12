import io,json,secrets,wave
from datetime import date,timedelta
from pathlib import Path
import sys
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).parents[1]/'app'))
from copilot import voice_auth as auth
from copilot.voice_audit import AUDIT,MASK,DIGIT_GROUPS,today
from copilot.voice_audio_log import AUDIO
from copilot.voice_policy import ACTIONS,forbidden
from copilot.voice_foundation import router

@pytest.fixture(autouse=True)
def isolated(tmp_path,monkeypatch):
    monkeypatch.setenv('DATA_DIR',str(tmp_path));monkeypatch.setenv('VOICE_ACTIONS_ENABLED','true');monkeypatch.setenv('VOICE_AUDIT_ENABLED','true');monkeypatch.setenv('VOICE_AUDIO_LOG_ENABLED','true')
    monkeypatch.setitem(ACTIONS,'foundation-review',{'level':'APPROVE','roles':['Supervisor']})
    auth.AUTH.private_until.clear();auth.AUTH.identities.clear();auth.AUTH.sessions.clear();auth.AUTH.readbacks.clear();auth.AUTH.tokens.clear();auth.AUTH.failures.clear();auth.AUTH.locked_until=0

def fixture_user(monkeypatch):
    code=''.join(str(secrets.randbelow(10)) for _ in range(6));u=auth.entry('synthetic-supervisor','Demo Supervisor','Supervisor',code);monkeypatch.setenv('VOICE_USERS',json.dumps([u]));return code,u

def wav():
    out=io.BytesIO()
    with wave.open(out,'wb') as w:w.setparams((1,2,16000,0,'NONE',''));w.writeframes(bytes(3200))
    return out.getvalue()

def test_debug_state_is_local_audit_only_and_never_contains_credentials(monkeypatch):
    def peer(host):
        app=FastAPI();app.include_router(router)
        @app.middleware('http')
        async def address(request,call_next):
            request.scope['client']=(host,50000)
            return await call_next(request)
        return TestClient(app)
    local=peer('127.0.0.1');remote=peer('192.0.2.10')
    sid=auth.AUTH.session();auth.AUTH.failures.append(auth.AUTH.clock());auth.AUTH.locked_until=auth.AUTH.clock()+120
    row=local.get('/copilot/voice/debug/state').json()
    assert set(row)=={'failure_count','locked','remaining_seconds'}
    assert row['failure_count']==1 and row['locked'] and 119<=row['remaining_seconds']<=120
    assert remote.get('/copilot/voice/debug/state').status_code==404
    assert remote.get('/copilot/voice/debug/state',headers={'X-Forwarded-For':'127.0.0.1'}).status_code==404
    headers={'X-Voice-Session':sid}
    assert local.post('/copilot/voice/debug/reset-lock',headers={**headers,'Origin':'https://untrusted.invalid'}).status_code==403
    reset=local.post('/copilot/voice/debug/reset-lock',headers=headers).json()
    assert reset=={'failure_count':0,'locked':False,'remaining_seconds':0}
    monkeypatch.setenv('VOICE_AUDIT_ENABLED','false');assert local.get('/copilot/voice/debug/state').status_code==404
    monkeypatch.setenv('VOICE_AUDIT_ENABLED','true');monkeypatch.setenv('APP_ENV','production');assert local.get('/copilot/voice/debug/state').status_code==404

def test_diagnostics_keep_reason_and_mask_every_private_text_field():
    sid=auth.AUTH.session()
    event={'confirmation':'passcode','transcript':'private input','heard':'private input','normalized_text':'private input','reason_code':'code_not_digits','winner':'approve_pr','candidates':[{'intent':'approve_pr','score':1}],'decision':'refused'}
    row=AUDIT.append(event,sid)
    assert row['transcript']==row['heard']==row['normalized_text']=='[passcode masked]'
    assert row['reason_code']=='code_not_digits' and row['winner']=='approve_pr'
    assert 'private input' not in AUDIT.path(today()).read_text(encoding='utf-8')

def test_partial_and_non_digit_replies_do_not_consume_attempts(monkeypatch):
    secret,_=fixture_user(monkeypatch);service=auth.VoiceAuth();sid=service.session()
    service.readback(sid,'foundation-review','Review','/dashboard')
    for reply in ['pass','four two seven','நாலு ரெண்டு ஏழு','चार दो सात',secret[:3]]:
        outcome=service.authorize(sid,'foundation-review',['Supervisor'],reply)
        assert outcome['reason_code']=='code_not_digits' and outcome['tries_remaining']==3
    assert service.debug_state()['failure_count']==0
    assert service.authorize(sid,'foundation-review',['Supervisor'],secret)['ok']

def test_only_three_real_wrong_codes_lock_and_state_survives_restart(monkeypatch):
    secret,_=fixture_user(monkeypatch);wrong=''.join(str((int(c)+1)%10) for c in secret)
    service=auth.VoiceAuth(persist=True);sid=service.session();service.readback(sid,'foundation-review','Review','/dashboard')
    for remaining in [2,1,0]:
        result=service.authorize(sid,'foundation-review',['Supervisor'],wrong)
        assert result['tries_remaining']==remaining
        assert result['reason_code']==('locked' if remaining==0 else 'wrong_code')
    restored=auth.VoiceAuth(persist=True)
    assert restored.debug_state()['locked'] and restored.debug_state()['failure_count']==3
    restored.reset_lock();assert not restored.debug_state()['locked']

def test_correct_code_with_wrong_role_does_not_consume_attempts(monkeypatch):
    secret,_=fixture_user(monkeypatch);service=auth.VoiceAuth();sid=service.session();service.readback(sid,'approve_pr','Approve PR','/inventory-forecast')
    assert service.authorize(sid,'approve_pr',['Manager'],secret)['reason_code']=='wrong_role'
    assert service.debug_state()['failure_count']==0

def test_private_digit_normalization_multilingual_and_repeat_words():
    groups=[[aliases.split('|')[0] for aliases in group] for group in DIGIT_GROUPS]
    digits=[secrets.randbelow(10) for _ in range(6)];expected=''.join(map(str,digits))
    for group in groups:
        assert bool(auth.normalize_code(' '.join(group[n] for n in digits))==expected)
    for repeat,count in [('double',2),('triple',3)]:
        digit=secrets.randbelow(10);tail=[secrets.randbelow(10) for _ in range(6-count)]
        spoken=repeat+' '+groups[0][digit]+' '+' '.join(groups[0][n] for n in tail)
        assert bool(auth.normalize_code(spoken)==str(digit)*count+''.join(map(str,tail)))

def test_ask_audit_retains_spoken_reply_and_audio_page():
    sid=auth.AUTH.session()
    row=AUDIT.append({'page':'/spectrometer','intent':'carbon','level':'ASK','decision':'executed','transcript':'carbon','spoken_reply':'Carbon is 3.5 percent.'},sid)
    assert row['page']=='/spectrometer' and row['spoken_reply']=='Carbon is 3.5 percent.'
    clip=AUDIO.store(wav(),'page-fixture',sid,page='/spectrometer')
    assert clip['page']=='/spectrometer'
    assert AUDIO.listing(today(),sid)[0]['page']=='/spectrometer'

@pytest.mark.parametrize('action',['opc_connect','opc_disconnect'])
@pytest.mark.parametrize('role',['Operator','Supervisor','Manager','Unit Controller'])
def test_opc_policy_requires_supervisor_or_controller(action,role,monkeypatch):
    code=''.join(str(secrets.randbelow(10)) for _ in range(6))
    monkeypatch.setenv('VOICE_USERS',json.dumps([auth.entry('fixture','Mock actor',role,code)]))
    service=auth.VoiceAuth();sid=service.session()
    assert service.readback(sid,action,'Spectrometer OPC instrument','/spectrometer')
    result=service.authorize(sid,action,['Supervisor','Unit Controller'],code)
    assert bool(result['ok'])==(role in ['Supervisor','Unit Controller'])

def test_sensitive_audit_cannot_persist_extra_reply_fields():
    app=FastAPI();app.include_router(router)
    with TestClient(app) as client:
        sid=client.post('/copilot/voice/session',json={}).json()['session_id']
        auth.AUTH.private_until[sid]=auth.AUTH.clock()+60
        sentinel=secrets.token_hex(20)
        result=client.post('/copilot/voice/audit',headers={'X-Voice-Session':sid},json={'intent':'approval','level':'APPROVE','decision':'refused','summary':sentinel,'spoken_reply':sentinel,'transcript':sentinel})
        assert result.status_code==200
        assert sentinel not in json.dumps(result.json())

def test_confirmation_timeout_is_an_auditable_nonexecution():
    app=FastAPI();app.include_router(router)
    with TestClient(app) as client:
        sid=client.post('/copilot/voice/session',json={}).json()['session_id']
        response=client.post('/copilot/voice/audit',headers={'X-Voice-Session':sid},json={'intent':'test-action','level':'RUN','decision':'timeout','error':'confirmation_timeout','summary':'No reply — action not done.'})
        assert response.status_code==200
        assert response.json()['event']['decision']=='timeout'
        assert response.json()['event']['backend_result'] is None
        assert AUDIT.verify(today())['ok']

def test_hash_roundtrip_digits_and_roles(monkeypatch):
    code,u=fixture_user(monkeypatch);assert code not in json.dumps(u);assert len(u['salt'])==32;assert u['iterations']>=200000
    for group in DIGIT_GROUPS:
        text=' '.join(group[int(d)].split('|')[0] for d in code);assert auth.normalize_code(text)==code
    clock=[10.];service=auth.VoiceAuth(lambda:clock[0]);sid=service.session();assert not service.authorize(sid,'foundation-review',['Supervisor'],code)['ok']
    assert service.readback(sid,'foundation-review','Review foundation only','/dashboard')
    assert not service.authorize(sid,'foundation-review',['Operator'],code)['ok']
    result=service.authorize(sid,'foundation-review',['Supervisor'],code);assert result['ok'];assert service.sensitive(sid);token=result['token']
    assert not service.consume(sid,token,'other')['ok'];assert service.consume(sid,token,'foundation-review')['ok'];assert not service.consume(sid,token,'foundation-review')['ok']
    assert code not in AUDIT.path(today()).read_text(encoding='utf-8')

def test_expiry_same_session_lockout_and_readback(monkeypatch):
    code,_=fixture_user(monkeypatch);clock=[0.];s=auth.VoiceAuth(lambda:clock[0]);sid=s.session();other=s.session();s.readback(sid,'foundation-review','Review','/x');clock[0]=15.01;assert not s.authorize(sid,'foundation-review',['Supervisor'],code)['ok']
    s.readback(sid,'foundation-review','Review','/x');assert not s.authorize(other,'foundation-review',['Supervisor'],code)['ok']
    wrong=str((int(code)+1)%1000000).zfill(6)
    for _ in range(3):result=s.authorize(sid,'foundation-review',['Supervisor'],wrong)
    assert result['locked'];assert not s.authorize(sid,'foundation-review',['Supervisor'],code)['ok'];clock[0]+=600;s.readback(sid,'foundation-review','Review','/x');result=s.authorize(sid,'foundation-review',['Supervisor'],code);assert result['ok'];clock[0]+=60;assert not s.consume(sid,result['token'],'foundation-review')['ok']

@pytest.mark.parametrize('text',['delete reading','reset demo','HOLD override','engineer override','clear chat history','edit grade','edit price','edit training data','receive lot','receive additive','DRI lab entry','manual lot release','manual lot reject','issue invoice','approve tap','accept strategy','bypass HOLD'])
def test_hard_deny(text):
    assert forbidden(text);s=auth.VoiceAuth();assert not s.readback(s.session(),'foundation-review',text,'/x')

def test_audit_chain_edit_detection_and_masking():
    sid='synthetic-session';row=AUDIT.append({'intent':'test-action','level':'RUN','decision':'executed','transcript':'one two three four five six','backend_result':{'status':200,'ids':[]}},sid);assert MASK in row['transcript'];assert AUDIT.verify(today())['ok']
    AUDIT.append({'confirmation':'passcode','decision':'refused','transcript':'never persisted'},sid);assert 'never persisted' not in AUDIT.path(today()).read_text()
    path=AUDIT.path(today());path.write_text(path.read_text().replace('test-action','changed-action'));assert AUDIT.verify(today())=={'ok':False,'first_broken_seq':1}
    with pytest.raises(ValueError):AUDIT.append({'decision':'failed'},sid)

def test_audio_secret_suppression_retention_and_no_overwrite(monkeypatch):
    sid='synthetic-session';assert AUDIO.store(wav(),'event-synthetic',sid,no_store=True)=={'stored':False};assert AUDIO.store(wav(),'event-synthetic',sid,sensitive=True)=={'stored':False};assert not AUDIO.folder(today()).exists()
    row=AUDIO.store(wav(),'event-synthetic',sid);assert row['duration']==.1
    with pytest.raises(ValueError):AUDIO.store(wav(),'event-synthetic',sid)
    assert not AUDIO.listing(today(),'other');assert AUDIO.export(today(),sid)[:2]==b'PK'
    old=(date.today()-timedelta(days=10)).isoformat();AUDIO.folder(old).mkdir(parents=True);AUDIO.purge();assert not AUDIO.folder(old).exists();assert AUDIO.folder(today()).exists()

def test_http_flags_sessions_no_store_admin(monkeypatch):
    app=FastAPI();app.include_router(router)
    with TestClient(app) as client:
        session=client.post('/copilot/voice/session').json()['session_id'];h={'X-Voice-Session':session}
        assert client.post('/copilot/voice/readback',headers=h,json={'action_id':'foundation-review','summary':'Review','page':'/x'}).status_code==200
        result=client.post('/copilot/voice/audio',headers=h,data={'event_id':'event-synthetic','purpose':'command'},files={'audio':('a.wav',wav(),'audio/wav')});assert result.json()=={'stored':False}
        assert client.delete('/copilot/voice/audio/'+today()).status_code==403
        for key in ['VOICE_ACTIONS_ENABLED','VOICE_AUDIT_ENABLED','VOICE_AUDIO_LOG_ENABLED']:monkeypatch.setenv(key,'false')
        for method,path,kwargs in [('post','authorize',{'json':{}}),('get','audit',{}),('get','audio',{}),('post','readback',{'json':{}})]:assert getattr(client,method)('/copilot/voice/'+path,headers=h,**kwargs).status_code==404


def test_persistent_lock_and_cancel_invalidate_tokens(monkeypatch):
    code,_=fixture_user(monkeypatch);clock=[1000.];s=auth.VoiceAuth(lambda:clock[0],persist=True);sid=s.session();s.readback(sid,'foundation-review','Review','/x');wrong=str((int(code)+1)%1000000).zfill(6)
    for _ in range(3):s.authorize(sid,'foundation-review',['Supervisor'],wrong)
    restored=auth.VoiceAuth(lambda:clock[0],persist=True);other=restored.session();restored.readback(other,'foundation-review','Review','/x');assert restored.authorize(other,'foundation-review',['Supervisor'],code)['locked']
    clock[0]+=600;restored.readback(other,'foundation-review','Review','/x');result=restored.authorize(other,'foundation-review',['Supervisor'],code);assert result['ok'];restored.cancel(other);assert not restored.consume(other,result['token'],'foundation-review')['ok']

def test_audio_endpoint_no_store_even_without_challenge_and_flag_off(monkeypatch):
    app=FastAPI();app.include_router(router)
    with TestClient(app) as c:
        sid=c.post('/copilot/voice/session').json()['session_id'];h={'X-Voice-Session':sid}
        response=c.post('/copilot/voice/audio',headers=h,data={'event_id':'event-synthetic','no_store':'true','purpose':'command'},files={'audio':('voice.wav',wav(),'audio/wav')});assert response.json()=={'stored':False};assert not AUDIO.folder(today()).exists()
        monkeypatch.setenv('VOICE_AUDIO_LOG_ENABLED','false');assert c.post('/copilot/voice/audio',headers=h,data={'event_id':'event-synthetic'},files={'audio':('voice.wav',wav(),'audio/wav')}).status_code==404
        assert c.post('/copilot/voice/audio',headers=h).status_code==404

def test_transcript_source_alias_values_are_the_existing_browser_grammar():
    import ast,re
    from copilot.voice_numbers import NUMBERS
    source=(Path(__file__).parents[3]/'MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/spokenNumbers.js').read_text(encoding='utf-8')
    for name in ['tamilUnits','hindiCardinals','hinglish']:
        rows=ast.literal_eval(re.search(name+r' = (\[[^\[\]]*\]);',source).group(1))
        for i,aliases in enumerate(rows):
            for alias in aliases.split('|'):assert NUMBERS[alias]==i


def test_private_transcription_uses_memory_and_clears_provider_error(monkeypatch):
    from copilot.voice_foundation import private_transcription
    from copilot import gnani_client
    secret=''.join(str(secrets.randbelow(10)) for _ in range(6))
    class Client:
        last_error=secret
        def transcribe(self,content,language,max_attempts,output_format,purpose):
            assert content==wav() and max_attempts==1 and output_format=='codemix' and purpose=='private'
            return {'success':True,'text':secret,'language':'ta','error':secret}
    client=Client();monkeypatch.setattr(gnani_client,'get_gnani_client',lambda:client)
    result=private_transcription(wav(),'ta');assert result['text']==secret;assert 'error' not in result;assert client.last_error is None
    assert not AUDIO.folder(today()).exists()


def test_audit_preserves_audio_link_and_backend_ids_while_masking_transcript():
    event='event-'+secrets.token_hex(16)
    row=AUDIT.append({'event_id':event,'decision':'executed','transcript':'H-1053','backend_result':{'status':200,'ids':['H-1053']}},'synthetic-session')
    assert row['event_id']==event
    assert row['backend_result']['ids']==['H-1053']
    assert row['transcript']==MASK
    assert AUDIT.verify(today())['ok']


def test_hash_tool_hidden_prompt_roundtrip(monkeypatch,capsys):
    import hashlib,getpass
    from tools.voice_passcode_hash import main
    code=''.join(str(secrets.randbelow(10)) for _ in range(6));answers=iter([code,code])
    monkeypatch.setattr(getpass,'getpass',lambda _:next(answers));monkeypatch.setattr(sys,'argv',['voice_passcode_hash.py','--id','demo-operator','--name','Demo Operator','--role','Operator'])
    main();row=json.loads(capsys.readouterr().out)
    assert hashlib.pbkdf2_hmac('sha256',code.encode(),bytes.fromhex(row['salt']),row['iterations']).hex()==row['hash']
    assert 'code' not in row
    assert auth.normalize_code(', '.join(code)+'.')==code


def test_verify_reports_exact_malformed_json_sequence():
    for _ in range(3):AUDIT.append({'decision':'executed','intent':'test-action'},'synthetic-session')
    p=AUDIT.path(today());lines=p.read_text(encoding='utf-8').splitlines();lines[1]='{ malformed';p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    assert AUDIT.verify(today())=={'ok':False,'first_broken_seq':2}


def test_bad_authorize_body_never_echoes_secret(monkeypatch):
    app=FastAPI();app.include_router(router);secret=''.join(str(secrets.randbelow(10)) for _ in range(6))
    with TestClient(app) as c:
        response=c.post('/copilot/voice/authorize',json=secret)
        assert response.status_code==422 and secret not in response.text
        monkeypatch.setenv('VOICE_ACTIONS_ENABLED','false')
        assert c.post('/copilot/voice/authorize',json=secret).status_code==404

@pytest.mark.parametrize('action,roles',[('start_melting',['Supervisor','Unit Controller']),('approve_pr',['Manager']),('reject_pr',['Manager']),('approve_dri_qa',['Supervisor','Manager']),('reject_dri_qa',['Supervisor','Manager']),('inspect_lot',['Supervisor'])])
def test_f17_roles_are_server_owned(action,roles):
    assert ACTIONS[action]['roles']==roles
    s=auth.VoiceAuth();sid=s.session()
    assert s.readback(sid,action,'Fixture target PR-7 10 kg','/fixture')
    assert not s.authorize(sid,action,[], 'not a credential')['ok']
    assert not s.readback(sid,'start_melting','H-1053 HOLD','/premelt-gate')

def test_f17_frontend_and_server_action_policy_parity():
    import re,ast
    source=(Path(__file__).resolve().parents[3]/'MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceActionRegistry.js').read_text(encoding='utf-8')
    entries=re.findall(r"\['([^']+)','[^']+','([^']+)',(\[[^\]]*\]),'[^']+','[^']+'\]",source)
    assert len(entries)==23
    assert {'opc_connect','opc_disconnect'} <= {entry[0] for entry in entries}
    for action,level,roles in entries:
        assert ACTIONS[action]=={'level':level,'roles':ast.literal_eval(roles)}

@pytest.mark.parametrize('action',list(__import__('copilot.voice_policy',fromlist=['SCOPE_ROLES']).SCOPE_ROLES))
def test_f17b_scope_roles_cannot_be_lowered(action):
    from copilot.voice_policy import SCOPE_ROLES
    assert ACTIONS[action]['roles']==SCOPE_ROLES[action]
    s=auth.VoiceAuth();sid=s.session();summary='This overrides a HOLD gate; H-1053; reason reviewed' if action=='override_start' else action.replace('_',' ')+' target fixture'
    assert s.readback(sid,action,summary,'/fixture')
    assert not s.authorize(sid,action,[], 'not a credential')['ok']

@pytest.mark.parametrize('action,word',[('delete_reading','DELETE'),('delete_grade','DELETE'),('delete_training','DELETE'),('reset_demo','RESET'),('clear_chat','CLEAR'),('override_start','OVERRIDE')])
def test_f17b_server_requires_word_before_token_consumption(action,word,monkeypatch):
    from copilot.voice_policy import ACTIONS
    role=ACTIONS[action]['roles'][0];code=''.join(str(secrets.randbelow(10)) for _ in range(6));monkeypatch.setenv('VOICE_USERS',json.dumps([auth.entry('fixture','Synthetic Actor',role,code)]))
    s=auth.VoiceAuth();sid=s.session();assert s.readback(sid,action,'Reviewed target and all fields','/fixture')
    approval=s.authorize(sid,action,ACTIONS[action]['roles'],code);assert approval['ok'];token=approval['token']
    assert not s.consume(sid,token,action)['ok']
    assert not s.confirm_word(s.session(),token,action,word)['ok']
    assert s.confirm_word(sid,token,action,word)['ok']
    assert not s.confirm_word(sid,token,action,word)['ok']
    assert s.consume(sid,token,action)['ok']
    assert not s.consume(sid,token,action)['ok']
    assert s.readback(sid,action,'Reviewed target','/fixture');approval=s.authorize(sid,action,ACTIONS[action]['roles'],code);assert approval['ok']
    assert not s.confirm_word(sid,approval['token'],action,'NO')['ok']
    assert not s.consume(sid,approval['token'],action)['ok']

def test_f17b_hold_override_identity_is_unit_controller_only(monkeypatch):
    first=''.join(str(secrets.randbelow(10)) for _ in range(6));second=str((int(first)+1)%1000000).zfill(6)
    monkeypatch.setenv('VOICE_USERS',json.dumps([auth.entry('manager','Synthetic Manager','Manager',first),auth.entry('controller','Synthetic Controller','Unit Controller',second)]))
    s=auth.VoiceAuth();sid=s.session();assert not s.readback(sid,'approve_tap','H-1053 HOLD','/fixture')
    assert s.readback(sid,'override_start','This overrides a HOLD gate H-1053; reviewed reason','/fixture')
    assert not s.authorize(sid,'override_start',['Unit Controller'],first)['ok']
    approval=s.authorize(sid,'override_start',['Unit Controller'],second);assert approval['ok'];assert approval['user']['role']=='Unit Controller'


def test_private_capture_reads_multi_locale_from_multipart_form(monkeypatch):
    import main
    from copilot import voice_foundation
    captured=[]
    def transcribe(content,language):
        captured.append(language)
        return {'text':'[passcode masked]','language':language,'success':True}
    monkeypatch.setattr(voice_foundation,'private_transcription',transcribe)
    response=TestClient(main.app).post('/copilot/voice/transcribe',data={'no_store':'true','language':'ta-IN,en-IN'},files={'audio':('private.wav',wav(),'audio/wav')})
    assert response.status_code==200 and captured==['ta-IN,en-IN']
