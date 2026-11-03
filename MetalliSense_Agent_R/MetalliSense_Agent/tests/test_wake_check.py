import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
import threading
import pytest
sys.path.insert(0,str(Path(__file__).parents[1]/'app'))
from copilot.wake_check import WakeChecker
from fastapi import HTTPException
from tools.kural_gnani_wake_test import wav_bytes,wake_parts,payload_fields

def test_all25_parity_and_no_keyterms():
    rows=json.loads((Path(__file__).parent/'fixtures/wake-v3-parity.json').read_text(encoding='utf-8'))
    assert len(rows)==25
    for r in rows:assert wake_parts(r['transcript'])['wake']==r['wake']
    assert 'keyterms' not in payload_fields('v3')
    assert wake_parts('குரல், approve heat')['remainder']=='approve heat'

def test_off_format_rate_and_spacing(monkeypatch):
    # This test exercises flag-off even when the owner's local .env enables it.
    monkeypatch.setenv('WAKE_WORD_ENABLED','false')
    clock=[0];wait=[]
    async def sleep(seconds):wait.append(seconds);clock[0]+=seconds
    checker=WakeChecker(lambda:clock[0],sleep);audio=wav_bytes(bytes(48000));calls=[]
    with pytest.raises(HTTPException) as ex:asyncio.run(checker.check(audio,lambda _:calls.append(1)))
    assert ex.value.status_code==404 and calls==[]
    monkeypatch.setenv('WAKE_WORD_ENABLED','true')
    with pytest.raises(HTTPException):asyncio.run(checker.check(b'bad',lambda _:calls.append(1)))
    for _ in range(15):assert asyncio.run(checker.check(audio,lambda _:'குரல் carbon எவ்வளவு?'))['wake']
    assert len(wait)==14 and all(t>=1.099999 for t in wait)
    with pytest.raises(HTTPException) as ex:asyncio.run(checker.check(audio,lambda _:calls.append(1)))
    assert ex.value.status_code==429 and calls==[]

def test_concurrent_rejected_without_provider(monkeypatch):
    monkeypatch.setenv('WAKE_WORD_ENABLED','true');checker=WakeChecker();entered=threading.Event();release=threading.Event()
    def send(_):entered.set();assert release.wait(3);return 'குரல்'
    with ThreadPoolExecutor() as pool:
        future=pool.submit(asyncio.run,checker.check(wav_bytes(bytes(48000)),send));assert entered.wait(3)
        try:
            with pytest.raises(HTTPException) as ex:asyncio.run(checker.check(wav_bytes(bytes(48000)),lambda _:pytest.fail('parallel call')))
            assert ex.value.status_code==429
        finally:release.set()
        assert future.result()['wake']

def test_spacing_begins_after_transport_completes(monkeypatch):
    monkeypatch.setenv('WAKE_WORD_ENABLED','true')
    clock=[0];delays=[]
    async def sleep(seconds):delays.append(seconds);clock[0]+=seconds
    checker=WakeChecker(lambda:clock[0],sleep)
    def queued_send(_):clock[0]+=30;return 'kural'
    audio=wav_bytes(bytes(48000))
    asyncio.run(checker.check(audio,queued_send))
    asyncio.run(checker.check(audio,queued_send))
    assert delays==[1.1] and checker.last==61.1

@pytest.mark.parametrize('status,message',[(403,'denied synthetic-secret'),(502,'upstream unavailable')])
def test_provider_diagnostic_and_request_parity(monkeypatch,caplog,status,message):
    from types import SimpleNamespace
    from tools import kural_gnani_wake_test as harness
    import requests
    import dotenv
    monkeypatch.setenv('GNANI_MOCK','false');monkeypatch.setenv('GNANI_API_KEY','synthetic-secret');monkeypatch.setenv('GNANI_BASE_URL','https://api.vachana.ai')
    monkeypatch.setattr(dotenv,'dotenv_values',lambda _:dict(GNANI_API_KEY='synthetic-secret',GNANI_BASE_URL='https://api.vachana.ai'))
    calls=[]
    response=SimpleNamespace(status_code=status,headers={},json=lambda:{'success':False,'error':{'code':'DENIED','message':message}})
    def post(url,**kwargs):calls.append((url,kwargs));return response
    monkeypatch.setattr('app.copilot.provider_calls._state.session.post',post)
    monkeypatch.setattr(requests.Session,'post',lambda self,url,**kwargs:post(url,**kwargs))
    audio=wav_bytes(bytes(48000))
    harness.sender('v3')(audio)
    with caplog.at_level('WARNING',logger='uvicorn.error'):
        with pytest.raises(HTTPException):WakeChecker.send(audio)
    expected=calls[0];actual=calls[1]
    assert actual[0]==expected[0]
    assert {k:v for k,v in actual[1].items() if k!='timeout'}=={k:v for k,v in expected[1].items() if k!='timeout'}
    assert actual[1]['timeout']==5 and expected[1]['timeout']==60
    assert 'DENIED' in caplog.text and str(status) in caplog.text and 'elapsed_ms=' in caplog.text
    assert 'synthetic-secret' not in caplog.text and 'audio_file' not in caplog.text
    assert 'lease=not_rejected' in caplog.text


def test_transport_timeout_is_logged_safely(monkeypatch,caplog):
    import requests
    monkeypatch.setenv('GNANI_MOCK','false');monkeypatch.setenv('GNANI_API_KEY','synthetic-secret');monkeypatch.setenv('GNANI_BASE_URL','https://api.vachana.ai')
    def fail(*a,**k):raise requests.Timeout('timeout synthetic-secret')
    monkeypatch.setattr('app.copilot.provider_calls._state.session.post',fail)
    with caplog.at_level('WARNING',logger='uvicorn.error'):
        with pytest.raises(HTTPException):WakeChecker.send(wav_bytes(bytes(48000)))
    assert 'type=Timeout' in caplog.text and 'http_status=none' in caplog.text
    assert 'synthetic-secret' not in caplog.text


def test_real_pause_v3_fixture_validates_offline(monkeypatch):
    import io,wave
    path=Path(__file__).parents[1]/'tools/local_wake_data/kural-prisma-pause-v3/evaluation/2c520de30585837d26bb/manish-DW01-01.wav'
    if not path.exists():pytest.skip('Local evidence is not distributed with tests')
    audio=path.read_bytes();assert len(audio)==48044
    with wave.open(io.BytesIO(audio)) as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,16000,24000)
    monkeypatch.setenv('WAKE_WORD_ENABLED','true')
    assert asyncio.run(WakeChecker().check(audio,lambda _:'kural'))['wake']
