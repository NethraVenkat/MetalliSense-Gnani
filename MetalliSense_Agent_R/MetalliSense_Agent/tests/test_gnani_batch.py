import asyncio
import io
import json
import sys
import wave
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from app.copilot import gnani_batch as batch
from app.copilot.gnani_client import _silent_wav


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    monkeypatch.setenv('GNANI_API_KEY', 'unit-key-not-real')
    monkeypatch.setenv('GNANI_MOCK', 'false')
    monkeypatch.setenv('LANG_BRIDGE', 'off')
    monkeypatch.setenv('GNANI_BASE_URL', 'https://api.vachana.ai')
    monkeypatch.setattr(httpx.AsyncClient, 'send', AsyncMock(side_effect=AssertionError('No live HTTP in tests')))


def fake_http(monkeypatch, states=('STARTING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'), failure=None):
    calls, delays = [], []
    states = iter(states)
    async def request(self, method, url, **kwargs):
        calls.append((method, url, kwargs))
        if failure: return httpx.Response(failure, text='provider body unit-key-not-real secret', request=httpx.Request(method,url))
        if method == 'POST' and url.endswith('/jobs'): data = {'job_id': 'job-1'}
        elif url.endswith('/start'): data = {'status': 'STARTING'}
        elif url.endswith('/files'): data = {'data': [{'transcript_url':'https://results.s3.amazonaws.com/a.json?secret=hidden'}]}
        else: data = {'status': next(states)}
        return httpx.Response(200, json=data, request=httpx.Request(method,url))
    async def download(self, url, **kwargs):
        calls.append(('DOWNLOAD',url,kwargs))
        return httpx.Response(200, json={'segments':[{'speaker_id':0,'start_time':0,'end_time':1,'text':'Heat 1053 fine','emotion':None,'language_detected':'en-IN'},
            {'speaker_id':1,'start_time':1,'end_time':2,'text':'Heat 1053 hold','sentiment':'neutral'}]},request=httpx.Request('GET',url))
    async def sleep(delay): delays.append(delay)
    monkeypatch.setattr(httpx.AsyncClient, 'request', request)
    monkeypatch.setattr(httpx.AsyncClient, 'get', download)
    monkeypatch.setattr(batch.asyncio, 'sleep', sleep)
    return calls, delays


def test_batch_flow_upload_start_states_result_and_no_key_on_download(monkeypatch):
    calls, delays = fake_http(monkeypatch)
    result = asyncio.run(batch.GnaniBatchClient().transcribe(b'wav', 2))
    assert result['job_id'] == 'job-1'
    assert [s['speaker'] for s in result['segments']] == ['Speaker 1','Speaker 2']
    assert result['segments'][0]['emotion'] is None
    assert result['segments'][1]['sentiment'] == 'neutral'
    assert delays == [10,15,20,20]
    config = json.loads(calls[0][2]['files']['config'][1])
    assert config['model'] == 'prisma-v3.0' and config['format'] == 'codemix'
    assert config['language_code'] == 'ta-IN,en-IN'
    assert config['num_speakers'] == 2 and config['with_diarization'] is True
    assert isinstance(config['keyterms'], list)
    assert calls[1][1].endswith('/job-1/start')
    assert calls[1][2]['json'] == {}
    assert calls[-1][2] == {}  # No API-key header on signed download.
    assert 'unit-key-not-real' not in json.dumps(result) and 'https://' not in json.dumps(result)


def test_language_bridge_only_changes_batch_hints(monkeypatch):
    monkeypatch.setenv('LANG_BRIDGE', 'on')
    assert batch.batch_config()['language_code'] == 'ta-IN,en-IN,hi-IN'


def test_resume_internal_job_only_polls_and_downloads(monkeypatch):
    calls, _ = fake_http(monkeypatch, ('COMPLETED',))
    assert asyncio.run(batch.GnaniBatchClient().transcribe(b'',2,job_id='job-1'))['segments']
    assert all(call[0] != 'POST' for call in calls)


def test_rate_limited_start_and_files_back_off_without_duplicate_job(monkeypatch):
    calls, delays = fake_http(monkeypatch, ('COMPLETED',))
    original = httpx.AsyncClient.request
    limited = set()
    async def request(self, method, url, **kwargs):
        if url.endswith(('/start','/files')) and url not in limited:
            limited.add(url)
            return httpx.Response(429, headers={'Retry-After':'1'}, request=httpx.Request(method,url))
        return await original(self,method,url,**kwargs)
    monkeypatch.setattr(httpx.AsyncClient,'request',request)
    assert asyncio.run(batch.GnaniBatchClient().transcribe(b'wav',2))['segments']
    assert sum(call[1].endswith('/jobs') for call in calls) == 1
    assert len(limited) == 2 and delays == [10,10,10]


@pytest.mark.parametrize('state', ['FAILED','START_FAILED','CANCELLED'])
def test_terminal_failures_are_clear_and_safe(monkeypatch, state):
    fake_http(monkeypatch, (state,))
    with pytest.raises(batch.HandoverError, match='batch_failed'):
        asyncio.run(batch.GnaniBatchClient().transcribe(b'wav', 2))


def test_partial_failure_fetches_completed_file(monkeypatch):
    fake_http(monkeypatch, ('PARTIAL_FAILURE',))
    assert asyncio.run(batch.GnaniBatchClient().transcribe(b'wav',2))['segments']


def test_total_timeout_covers_polling(monkeypatch):
    original_sleep = asyncio.sleep
    fake_http(monkeypatch)
    monkeypatch.setattr(batch, 'TOTAL_TIMEOUT', .01)
    async def wait(_): await original_sleep(.03)
    monkeypatch.setattr(batch.asyncio, 'sleep', wait)
    with pytest.raises(batch.HandoverError, match='batch_timeout'):
        asyncio.run(batch.GnaniBatchClient().transcribe(b'wav',2))


@pytest.mark.parametrize('status', [400,401,429,500])
def test_upstream_body_and_key_never_escape(monkeypatch, status):
    fake_http(monkeypatch, failure=status)
    with pytest.raises(batch.HandoverError) as error:
        asyncio.run(batch.GnaniBatchClient().transcribe(b'wav',2))
    assert str(error.value) == 'batch_upstream_error'


def test_size_and_invalid_audio_are_rejected_before_network():
    with pytest.raises(batch.HandoverError, match='audio_size_limit'): batch.validate_audio(b'x' * (batch.MAX_BYTES + 1))
    with pytest.raises(batch.HandoverError, match='invalid_audio'): batch.validate_audio(b'not audio')


def test_decoded_duration_limit_and_supported_wave():
    data, duration = batch.validate_audio(_silent_wav(1))
    assert duration == 1
    with wave.open(io.BytesIO(data)) as audio:
        assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (16000,1,2)
    with pytest.raises(batch.HandoverError, match='audio_duration_limit'): batch.validate_audio(_silent_wav(90.1))
    with pytest.raises(batch.HandoverError, match='audio_duration_limit'): batch.validate_audio(_silent_wav(.05))


def test_flag_off_rejects_and_on_passes_only_safe_fields(monkeypatch):
    from app import main
    monkeypatch.setenv('HANDOVER_ENABLED', 'off')
    api = TestClient(main.app)
    assert api.post('/copilot/handover', files={'audio':('a.wav',b'a')}).json()['error']['code'] == 'handover_disabled'
    module = sys.modules['copilot.gnani_batch']
    monkeypatch.setenv('HANDOVER_ENABLED', 'on')
    monkeypatch.setattr(module, 'validate_audio', lambda data: (b'validated',1))
    transcribe = AsyncMock(return_value={'segments':[],'job_id':'job-1','duration_s':1})
    monkeypatch.setattr(module.GnaniBatchClient,'transcribe',transcribe)
    assert api.post('/copilot/handover',files={'audio':('a.wav',b'a')}).status_code == 200
    transcribe.assert_awaited_once_with(b'validated',1)
    transcribe.side_effect = RuntimeError('provider secret unit-key-not-real')
    response = api.post('/copilot/handover',files={'audio':('a.wav',b'a')})
    assert response.json() == {'error':{'code':'handover_unavailable'}, 'status_code':502}


def test_secret_in_transcript_rejected():
    with pytest.raises(batch.HandoverError, match='invalid_result'):
        batch.safe_result({'segments':[{'start_time':0,'end_time':1,'text':'unit-key-not-real'}]},'job-1',1,'unit-key-not-real')
