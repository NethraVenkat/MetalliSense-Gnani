import asyncio
import base64
import io
import json
import sys
import wave
from types import SimpleNamespace
from unittest.mock import Mock, AsyncMock

import httpx
import pytest
from app.copilot import gnani_tts_stream as stream
from app.copilot.gnani_client import GnaniClient, _silent_wav, tts_text


@pytest.fixture
def service(monkeypatch, tmp_path):
    for name,value in {'GNANI_API_KEY':'private-test-key','GNANI_MOCK':'false','GNANI_TTS_MODEL':'timbre-v3.0',
                       'GNANI_TTS_VOICE':'Kalpana','GNANI_TTS_CACHE_DIR':str(tmp_path),'GNANI_TTS_SAMPLE_RATE':'22050'}.items(): monkeypatch.setenv(name,value)
    client = GnaniClient()
    service = SimpleNamespace(gnani=client,tts_provider='gnani',last_provider_used='gnani:timbre-v3.0:Kalpana',last_media_type='audio/wav')
    service.text_to_speech = Mock(return_value=_silent_wav())
    monkeypatch.setattr(httpx.AsyncClient,'send',AsyncMock(side_effect=AssertionError('No live calls in tests')))
    return service


class Body(httpx.AsyncByteStream):
    def __init__(self, frames, delay=0): self.frames,self.delay,self.closed=frames,delay,False
    async def __aiter__(self):
        for frame in self.frames:
            if self.delay: await asyncio.sleep(self.delay)
            yield frame.encode()
    async def aclose(self): self.closed=True


def chunk(audio): return f'event: chunk\ndata: {json.dumps({"audio":base64.b64encode(audio).decode()})}\n\n'
COMPLETE = 'event: complete\ndata: {"is_final":true,"audio":""}\n\n'


def upstream(monkeypatch, frames, delay=0):
    body=Body(frames,delay)
    response=httpx.Response(200,stream=body,request=httpx.Request('POST','https://api.vachana.ai/api/v1/tts/sse'))
    send=AsyncMock(return_value=response);monkeypatch.setattr(httpx.AsyncClient,'send',send)
    return send,body


def collect(service,text='spoken final text',style='normal'):
    async def run():
        result=[]
        async for frame in stream.speak_events(service,text,'ta',style):
            result.append((frame.splitlines()[0][7:],json.loads(frame.split('data: ',1)[1])))
        return result
    return asyncio.run(run())


def test_chunk_forwarding_and_cache_written_after_complete(service,monkeypatch):
    send,body=upstream(monkeypatch,[chunk(b'\x01\x00\x02'),chunk(b'\x00'),COMPLETE])
    rows=collect(service)
    assert b''.join(base64.b64decode(row['audio']) for kind,row in rows if kind=='audio') == b'\x01\x00\x02\x00'
    assert rows[-1] == ('complete',{'path':'stream'}) and body.closed
    path=service.gnani._cache_path('spoken final text','ta-IN','Kalpana')
    with wave.open(str(path),'rb') as wav:
        assert wav.readframes(wav.getnframes()) == b'\x01\x00\x02\x00'
    assert collect(service)[0][1]['path'] == 'cache'
    assert send.await_count == 1


def test_first_pcm_reaches_caller_before_upstream_completes(service,monkeypatch):
    async def run():
        release=asyncio.Event()
        class PausedBody(httpx.AsyncByteStream):
            async def __aiter__(self):
                yield chunk(b'\x01\0').encode()
                await release.wait()
                yield COMPLETE.encode()
        response=httpx.Response(200,stream=PausedBody(),request=httpx.Request('POST','https://api.vachana.ai/api/v1/tts/sse'))
        monkeypatch.setattr(httpx.AsyncClient,'send',AsyncMock(return_value=response))
        proxy=stream.speak_events(service,'spoken final text','ta')
        first=await anext(proxy)
        assert first.startswith('event: audio')
        path=service.gnani._cache_path('spoken final text','ta-IN','Kalpana')
        assert not path.exists()
        release.set()
        remaining=[frame async for frame in proxy]
        assert remaining[-1].startswith('event: complete') and path.exists()
    asyncio.run(run())


def test_first_chunk_deadline_includes_start_heartbeats(service,monkeypatch):
    monkeypatch.setattr(stream,'FIRST_AUDIO_TIMEOUT',.005)
    _,body=upstream(monkeypatch,['event: start\ndata: {"text":"private-test-key"}\n\n',chunk(b'\0\0'),COMPLETE],delay=.02)
    rows=collect(service)
    service.text_to_speech.assert_called_once()
    assert rows[0][1]['path'] == 'rest' and body.closed
    assert 'private-test-key' not in json.dumps(rows)


def test_midstream_error_resets_then_falls_back_without_partial_cache(service,monkeypatch):
    upstream(monkeypatch,[chunk(b'\x01\0'),'event: error\ndata: {"message":"private-test-key provider body"}\n\n'])
    rows=collect(service)
    assert [kind for kind,_ in rows] == ['audio','reset','audio','complete']
    assert rows[2][1]['encoding'] == 'wav' and rows[2][1]['path'] == 'rest'
    assert not service.gnani._cache_path('spoken final text','ta-IN','Kalpana').exists()
    assert 'private-test-key' not in json.dumps(rows)


def test_eof_without_complete_falls_back(service,monkeypatch):
    upstream(monkeypatch,[chunk(b'\0\0')])
    assert any(kind=='reset' for kind,_ in collect(service))


def test_cache_uses_final_spoken_text_and_existing_alert_tag_key(service,monkeypatch):
    service.gnani.tts_tags=True
    send,_=upstream(monkeypatch,[chunk(b'\0\0'),COMPLETE])
    text='heat ten fifty-three HOLD'
    collect(service,text,'alert')
    final=tts_text(text,service.gnani.tts_model,'alert',True)
    assert service.gnani._cache_path(final,'ta-IN','Kalpana','alert').exists()
    payload=json.loads(send.call_args.args[0].content)
    assert payload['text']==final and payload['audio_config']['container']=='raw'
    assert payload['voice']=='Kalpana' and payload['audio_config']['sample_rate']==22050
    assert send.call_args.args[0].headers['X-API-Key-ID']=='private-test-key'


def test_clarity_sse_speed_tags_and_same_rest_cache_key(service,monkeypatch):
    monkeypatch.setenv('GNANI_TTS_CLARITY','on')
    service.gnani.tts_speed=.9
    send,_=upstream(monkeypatch,[chunk(b'\0\0'),COMPLETE])
    collect(service,'Heat H-1053. Value 0.50.')
    payload=json.loads(send.call_args.args[0].content)
    assert payload['speed']==.9
    assert '<slow>' in payload['text'] and '<pauses>' in payload['text']
    assert service.gnani._cache_path(payload['text'],'ta-IN','Kalpana').exists()


@pytest.mark.parametrize('provider,media,encoding',[('gnani:timbre-v2.5:Kamakshi','audio/wav','wav'),('gtts','audio/mpeg','mp3')])
def test_existing_fallback_path_is_reported(service,monkeypatch,provider,media,encoding):
    upstream(monkeypatch,['event: error\ndata: {"message":"private-test-key"}\n\n'])
    service.last_provider_used=provider;service.last_media_type=media
    rows=collect(service)
    assert rows[0][1]['path']=='fallback' and rows[0][1]['encoding']==encoding


def test_stream_route_disabled_and_enabled_without_secrets(service,monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    api=TestClient(main.app);monkeypatch.setenv('GNANI_TTS_STREAM','off')
    assert api.post('/copilot/voice/speak-stream',json={'text':'hello','language':'ta'}).status_code==404
    module=sys.modules['copilot.gnani_tts_stream']
    async def fake(*args): yield module.event('complete',{'path':'cache'})
    monkeypatch.setattr(module,'speak_events',fake);monkeypatch.setattr(main,'voice_service',service)
    monkeypatch.setenv('GNANI_TTS_STREAM','on')
    response=api.post('/copilot/voice/speak-stream',json={'text':'hello','language':'ta'})
    assert response.status_code==200 and 'text/event-stream' in response.headers['content-type']
    assert 'private-test-key' not in response.text
