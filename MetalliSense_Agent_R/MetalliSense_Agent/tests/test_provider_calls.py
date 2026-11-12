"""Exercise real client entry points against synthetic blocking transports."""
import asyncio
import threading
import time
from types import SimpleNamespace
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'app'))
import httpx
from app.copilot.gnani_client import GnaniClient, _silent_wav
from app.copilot import provider_calls as gate
from app.copilot.evon_explainer import _EvonCompletions
from copilot.wake_check import WakeChecker
from copilot import provider_calls as alternate_gate


def test_stt_tts_transliterate_wake_share_one_provider_lease(monkeypatch,tmp_path):
    for key,value in {'GNANI_MOCK':'false','GNANI_API_KEY':'synthetic-key','GNANI_BASE_URL':'https://api.vachana.ai','GNANI_TTS_MODEL':'timbre-v3.0','GNANI_TTS_VOICE':'Kalpana','GNANI_TTS_CACHE_DIR':str(tmp_path)}.items():monkeypatch.setenv(key,value)
    assert gate._state is alternate_gate._state
    client=GnaniClient();client.mock=False;client.tts_cache_dir=tmp_path
    monkeypatch.setattr(client,'_to_wav_16k',lambda audio:audio)
    lock=threading.Lock();active=0;maximum=0;paths=[]
    def enter(path):
        nonlocal active,maximum
        with lock:active+=1;maximum=max(maximum,active);paths.append(path)
    def leave():
        nonlocal active
        with lock:active-=1
    audio=_silent_wav()
    def post(url,**kwargs):
        enter('evon' if '/chat/completions' in url else 'tts' if '/tts/' in url else 'wake' if kwargs.get('files',{}).get('audio_file',('',))[0]=='snippet.wav' else 'stt')
        try:
            time.sleep(.02)
            return SimpleNamespace(status_code=200,content=audio,text='',json=lambda:{'success':True,'transcript':'kural carbon','detected_language_code':'en-IN','choices':[{'message':{'content':'synthetic reply'}}]})
        finally:leave()
    monkeypatch.setattr('app.copilot.provider_calls._state.session.post',post)
    sleep=asyncio.sleep
    async def short_sleep(_):await sleep(0)
    async def request(self,method,url,**kwargs):
        enter('transliterate')
        try:
            await sleep(.02)
            if url.endswith('/files'):data={'data':[{'transcript_url':'https://x.s3.amazonaws.com/a'}]}
            elif 'amazonaws' in url:data={'segments':[]}
            elif '/batch/' in url:data={'status':'COMPLETED'}
            else:data={'transcript':'carbon'}
            return httpx.Response(200,json=data,request=httpx.Request(method,url))
        finally:leave()
    monkeypatch.setattr(httpx.AsyncClient,'request',request)
    async def run():
        await asyncio.gather(asyncio.to_thread(client.transcribe,audio),asyncio.to_thread(client.synthesize,'synthetic unique','ta',allow_fallback=False),client.transliterate(audio),asyncio.to_thread(WakeChecker.send,audio),asyncio.to_thread(_EvonCompletions('https://synthetic.invalid','',False).create,'synthetic-model',[{'role':'user','content':'synthetic'}]))
    asyncio.run(run())
    assert set(paths)=={'stt','tts','transliterate','wake','evon'}
    assert maximum==1 and active==0 and not gate._state.lock.locked()


def test_cancelled_async_waiter_does_not_leak_or_release_other_owner():
    async def run():
        async with gate.provider_slot():
            waiter=asyncio.create_task(acquire())
            await asyncio.sleep(.01);waiter.cancel()
            try:await waiter
            except asyncio.CancelledError:pass
            assert gate._state.lock.locked()
        async with gate.provider_slot():pass
    async def acquire():
        async with gate.provider_slot():raise AssertionError('must not acquire')
    asyncio.run(run())
    assert not gate._state.lock.locked()


def test_keepalive_session_is_reused_and_has_no_retries(monkeypatch):
    import requests
    session=gate._state.session
    assert isinstance(session,requests.Session)
    assert session.get_adapter('https://api.vachana.ai').max_retries.total==0
    calls=[]
    def send(url,**kwargs):
        assert gate._state.lock.locked()
        calls.append((id(gate._state.session),url));return 'mock'
    monkeypatch.setattr(session,'post',send)
    assert gate.post('https://api.vachana.ai/stt/v3')=='mock'
    assert alternate_gate.post('https://api.vachana.ai/api/v1/tts/inference')=='mock'
    assert len(calls)==2 and calls[0][0]==calls[1][0]

def test_legacy_audition_budget_guard_is_not_bypassed_by_pool(monkeypatch):
    import requests
    calls=[]
    def bounded(url,**kwargs):
        assert gate._state.lock.locked()
        calls.append(url);return 'budgeted'
    monkeypatch.setattr(requests,'post',bounded)
    assert gate.post('https://offline.invalid/stt/v3')=='budgeted'
    assert calls==['https://offline.invalid/stt/v3']
