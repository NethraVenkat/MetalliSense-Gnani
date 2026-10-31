import asyncio
import threading
import time
from types import SimpleNamespace
from unittest.mock import Mock,AsyncMock

import httpx
import pytest
from app.copilot.gnani_client import GnaniClient,_silent_wav
from app.copilot import transliteration as display

MAIN={'text':'heat 1053 status என்ன','language':'ta-IN,en-IN','detected_language_code':'ta-IN','success':True}

@pytest.fixture
def client(monkeypatch):
 for name,value in {'GNANI_API_KEY':'private-key','GNANI_MOCK':'false','GNANI_STT_MODEL':'prisma-v3.0',
                    'GNANI_STT_FORMAT':'codemix','GNANI_STT_LANGUAGE':'ta-IN,en-IN','LANG_BRIDGE':'off'}.items():monkeypatch.setenv(name,value)
 monkeypatch.setattr('requests.sessions.Session.request',Mock(side_effect=AssertionError('No live calls')))
 return GnaniClient()

@pytest.mark.parametrize('flag,requested',[('off',True),('on',False),('off',False)])
def test_flag_off_or_toggle_off_one_call_response_unchanged(client,monkeypatch,flag,requested):
 from fastapi.testclient import TestClient
 from app import main
 monkeypatch.setenv('GNANI_TRANSLITERATE',flag)
 post=Mock(return_value=Mock(status_code=200,json=lambda:{'transcript':MAIN['text'],'detected_language_code':'ta-IN'}))
 monkeypatch.setattr('requests.post',post);client.transliterate=AsyncMock()
 service=SimpleNamespace(stt_provider='gnani',gnani=client,transcribe_audio=lambda path,lang:client.transcribe(_silent_wav(),lang,max_attempts=1))
 monkeypatch.setattr(main,'voice_service',service)
 result=TestClient(main.app).post('/copilot/voice/transcribe',files={'audio':('audio.wav',_silent_wav(),'audio/wav')},data={'transliterate':str(requested).lower()})
 assert result.status_code==200 and result.json()=={**MAIN,'error':None}
 assert post.call_count==1;client.transliterate.assert_not_called()
 assert post.call_args.kwargs['data']=={'language_code':'ta-IN,en-IN','format':'codemix','model':'prisma-v3.0','keyterms':client.stt_keyterms}

def test_client_latin_params_no_language_or_main_state_mutation(client,monkeypatch):
 client.detected_language_code='ta-IN';client.last_error='main error'
 post=AsyncMock(return_value=httpx.Response(200,json={'transcript':'aayirathi aimbathi moonu'}))
 monkeypatch.setattr(httpx.AsyncClient,'post',post)
 assert asyncio.run(client.transliterate(_silent_wav()))=='aayirathi aimbathi moonu'
 payload=post.call_args.kwargs
 assert payload['data']=={'model':'prisma-v3.0','format':'transliterate','keyterms':client.stt_keyterms}
 assert payload['files']['audio_file'][1]==_silent_wav()
 assert client.detected_language_code=='ta-IN' and client.last_error=='main error'
 assert client.stats['stt_calls']==1

@pytest.mark.parametrize('failure',[httpx.ReadTimeout('private-key'),httpx.ConnectError('private-key'),500])
def test_latin_http_failure_omitted_no_secret(client,monkeypatch,failure,caplog):
 post=AsyncMock(return_value=httpx.Response(500,text='private-key')) if failure==500 else AsyncMock(side_effect=failure)
 monkeypatch.setattr(httpx.AsyncClient,'post',post)
 assert asyncio.run(client.transliterate(_silent_wav())) is None
 assert client.last_error is None and 'private-key' not in caplog.text

def test_separate_endpoint_timeout_omits_text(client,monkeypatch):
 monkeypatch.setattr(display,'LATIN_TIMEOUT_S',.01)
 async def latin(audio):await asyncio.sleep(10)
 client.transliterate=AsyncMock(side_effect=latin)
 service=SimpleNamespace(stt_provider='gnani',gnani=client)
 assert asyncio.run(display.transliterate_display(service,_silent_wav())) is None


def test_main_then_latin_routes_strict_order_and_safe_failures(client,monkeypatch):
 from fastapi.testclient import TestClient
 from app import main
 calls=[]
 def primary(path,language):calls.append('main');return dict(MAIN)
 async def latin(audio):
  assert calls==['main'];calls.append('latin');return 'Latin display'
 client.transliterate=AsyncMock(side_effect=latin)
 service=SimpleNamespace(stt_provider='gnani',gnani=client,transcribe_audio=Mock(side_effect=primary))
 monkeypatch.setattr(main,'voice_service',service);monkeypatch.setenv('GNANI_TRANSLITERATE','on')
 api=TestClient(main.app)
 result=api.post('/copilot/voice/transcribe',files={'audio':('audio.wav',_silent_wav(),'audio/wav')},data={'transliterate':'true'})
 assert result.json()=={**MAIN,'error':None};client.transliterate.assert_not_called()
 result=api.post('/copilot/voice/transliterate',files={'audio':('audio.wav',_silent_wav(),'audio/wav')})
 assert result.json()=={'transcript_latin':'Latin display'} and calls==['main','latin']
 assert service.transcribe_audio.call_count==1
 client.transliterate=AsyncMock(side_effect=RuntimeError('private-key provider-body'))
 result=api.post('/copilot/voice/transliterate',files={'audio':('audio.wav',_silent_wav(),'audio/wav')})
 assert result.json()=={'unavailable':True} and 'private-key' not in result.text
 client.mock=True;client.transliterate.reset_mock()
 assert api.post('/copilot/voice/transliterate',files={'audio':('audio.wav',_silent_wav(),'audio/wav')}).json()=={'unavailable':True}
 client.transliterate.assert_not_called()
 monkeypatch.setenv('GNANI_TRANSLITERATE','off')
 assert api.post('/copilot/voice/transliterate',files={'audio':('audio.wav',_silent_wav(),'audio/wav')}).status_code==404
