from unittest.mock import Mock

import pytest

from app.copilot.gnani_client import GnaniClient, _silent_wav
from app.copilot.schemas import TranscriptionResponse


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv('GNANI_API_KEY', 'unit-test-not-a-key')
    monkeypatch.setenv('GNANI_MOCK', 'false')
    monkeypatch.setenv('LANG_BRIDGE', 'off')
    monkeypatch.setenv('GNANI_STT_LANGUAGE', 'ta-IN,en-IN')
    monkeypatch.setenv('GNANI_STT_FORMAT', 'transcribe')
    monkeypatch.setenv('GNANI_TTS_MODEL', 'timbre-v3.0')
    monkeypatch.setenv('GNANI_TTS_VOICE', 'Kalpana')
    monkeypatch.setenv('GNANI_TTS_CACHE_DIR', str(tmp_path))
    return GnaniClient()


def test_bridge_off_retains_exact_request_params(client, monkeypatch):
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'transcript': 'test'}))
    monkeypatch.setattr('requests.post', post)
    client.transcribe(_silent_wav(), 'en-IN', max_attempts=1)
    assert post.call_args.kwargs['data'] == {
        'language_code': 'en-IN', 'format': 'transcribe', 'model': client.stt_model, 'keyterms': client.stt_keyterms}


@pytest.mark.parametrize('hint', [None, 'en', 'ta-IN'])
def test_bridge_on_uses_language_list_and_codemix(client, monkeypatch, hint):
    monkeypatch.setenv('LANG_BRIDGE', 'on')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'transcript': 'test', 'detected_language_code': 'hi-IN'}))
    monkeypatch.setattr('requests.post', post)
    result = client.transcribe(_silent_wav(), hint, max_attempts=1)
    assert post.call_args.kwargs['data'] == {
        'language_code': 'ta-IN,hi-IN,en-IN', 'format': 'codemix', 'model': client.stt_model, 'keyterms': client.stt_keyterms}
    assert TranscriptionResponse(**result).model_dump()['detected_language_code'] == 'hi-IN'


def test_bridge_language_override(client, monkeypatch):
    monkeypatch.setenv('LANG_BRIDGE', 'on')
    monkeypatch.setenv('GNANI_STT_LANGUAGE_BRIDGE', 'indic-auto')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'transcript': 'test'}))
    monkeypatch.setattr('requests.post', post)
    client.transcribe(_silent_wav(), max_attempts=1)
    assert post.call_args.kwargs['data']['language_code'] == 'indic-auto'


def test_hindi_tts_uses_same_voice_model_and_language_cache(client, monkeypatch):
    post = Mock(return_value=Mock(status_code=200, content=_silent_wav()))
    monkeypatch.setattr('requests.post', post)
    assert client.synthesize('unit test', 'hi', max_calls=1)
    payload = post.call_args.kwargs['json']
    assert (payload['model'], payload['voice'], payload['language']) == ('timbre-v3.0', 'Kalpana', 'hi-IN')
    assert client._cache_path('unit test', 'hi-IN', 'Kalpana') != client._cache_path('unit test', 'ta-IN', 'Kalpana')


def test_detected_code_reaches_rest_response(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    service = Mock()
    service.transcribe_audio.return_value = {'text': 'हीट', 'language': 'ta-IN,hi-IN,en-IN', 'success': True, 'detected_language_code': 'hi-IN'}
    monkeypatch.setattr(main, 'voice_service', service)
    response = TestClient(main.app).post('/copilot/voice/transcribe', files={'audio': ('test.wav', _silent_wav(), 'audio/wav')})
    assert response.status_code == 200
    assert response.json()['detected_language_code'] == 'hi-IN'


def test_tts_response_exposes_actual_cache_path_without_secrets(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    service = Mock(last_media_type='audio/wav', last_provider_used='gnani:timbre-v3.0:Kalpana')
    service.text_to_speech.return_value = _silent_wav()
    service.gnani.last_tts_source = 'cache'
    monkeypatch.setattr(main, 'voice_service', service)
    response = TestClient(main.app).post('/copilot/voice/synthesize', json={'text': 'test', 'language': 'hi'})
    assert response.status_code == 200
    assert response.headers['x-tts-provider'] == 'gnani:timbre-v3.0:Kalpana'
    assert response.headers['x-tts-source'] == 'cache'
    service.text_to_speech.assert_called_once_with(text='test', language='hi', slow=False, style='normal')
