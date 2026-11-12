import io
import json
from unittest.mock import Mock
import pytest
from app.copilot import gnani_client as g
from app.copilot.stt_context import command_context

@pytest.mark.parametrize('purpose,enabled,context', [('command',True,True),('form',True,True),('answer',True,True),('command',False,False),('private',True,False),('passcode',True,False),('wake',True,False),('unknown',True,False)])
def test_context_scope(monkeypatch,tmp_path,purpose,enabled,context):
    monkeypatch.setenv('GNANI_API_KEY','test-only');monkeypatch.setenv('GNANI_MOCK','false')
    monkeypatch.setenv('GNANI_TTS_CACHE_DIR',str(tmp_path));monkeypatch.setenv('STT_CONTEXT_ENABLED',str(enabled));monkeypatch.setenv('LANG_BRIDGE','false')
    send=Mock(return_value=Mock(status_code=200,json=lambda:{'transcript':'request reading'}));monkeypatch.setattr(g,'provider_post',send)
    c=g.GnaniClient();c.transcribe(g._silent_wav(),'en-IN',purpose=purpose,max_attempts=1)
    data=send.call_args.kwargs['data'];assert ('topic' in data)==context
    if purpose in {'private','passcode','wake'}:assert 'keyterms' not in data
    if context:assert data['keyterms']==command_context()['keyterms']

def test_context_limits_and_vocabulary():
    data=command_context();terms=json.loads(data['keyterms'])
    assert len(terms)<=200 and len(data['topic'])<=1600
    assert {'Kural','H-1053','spectrometer','receive truck','Kovai Pig Iron Co.'}<=set(terms)

@pytest.mark.parametrize('enabled',[False,True])
def test_endpoint_flag_and_purpose_forwarding(monkeypatch,enabled):
    from fastapi.testclient import TestClient
    from app import main
    from copilot import voice_foundation, voice_auth
    monkeypatch.setenv('STT_CONTEXT_ENABLED',str(enabled))
    monkeypatch.setattr(voice_auth.AUTH,'sensitive',lambda session:False)
    monkeypatch.setattr(voice_foundation,'log_interaction',lambda *a,**kw:None)
    service=Mock();service.transcribe_audio.return_value={'text':'receive truck','language':'en-IN','success':True}
    monkeypatch.setattr(main,'voice_service',service)
    response=TestClient(main.app).post('/copilot/voice/transcribe',files={'audio':('test.wav',g._silent_wav(),'audio/wav')},data={'purpose':'form','language':'en-IN'})
    assert response.status_code==200 and response.json()['text']=='receive truck'
    assert service.transcribe_audio.call_args.kwargs==({'purpose':'form'} if enabled else {})
