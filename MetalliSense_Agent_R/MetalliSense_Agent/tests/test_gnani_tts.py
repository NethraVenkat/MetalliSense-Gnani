"""TTS integration tests: no keys, provider credits or network access required."""
import hashlib
import importlib.util
import io
import json
import sys
import wave
from pathlib import Path
from unittest.mock import Mock

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.copilot.gnani_client import GnaniClient, _silent_wav, _finalize_wav, tts_text
from app.copilot.schemas import TTSRequest
from app.copilot.voice_service import VoiceService


@pytest.fixture
def client(monkeypatch, tmp_path):
    settings = {
        "GNANI_API_KEY": "test-key-not-a-credential", "GNANI_MOCK": "false",
        "GNANI_TTS_MODEL": "timbre-v3.0", "GNANI_TTS_VOICE": "Shivani",
        "GNANI_TTS_TAGS": "on", "GNANI_TTS_LANGUAGE": "ta-IN",
        "GNANI_TTS_SAMPLE_RATE": "22050", "GNANI_TTS_CACHE_DIR": str(tmp_path),
        "GNANI_TTS_TIMEOUT_S": "8",
        "GNANI_TTS_FALLBACK_MODEL": "timbre-v2.5", "GNANI_TTS_FALLBACK_VOICE": "Kamakshi",
    }
    for key, value in settings.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr("requests.sessions.Session.request", Mock(side_effect=AssertionError("No network in tests")))
    return GnaniClient()


def response(status=200):
    return Mock(status_code=status, content=_silent_wav(), text=f"HTTP {status}")


def test_tts_cache_key_includes_model_voice_style(client):
    text = "Heat H-1053: Gate HOLD. Tamil reason"
    fields = dict(text=text, lang="ta-IN", voice="Shivani", style="alert", model="timbre-v3.0")
    key = client._cache_path(**fields)
    for field, value in {"model": "timbre-v2.5", "voice": "Kalpana", "style": "normal", "lang": "en-IN", "text": "<slow> " + text}.items():
        assert client._cache_path(**{**fields, field: value}) != key
    client.tts_sample_rate = 48000
    assert client._cache_path(**fields) != key
    old = f"timbre-v3.0|Shivani|ta-IN|22050|{text}"
    assert key.name != hashlib.sha256(old.encode()).hexdigest() + ".wav"


@pytest.mark.parametrize("enabled,style,tagged", [(True, "alert", True), (False, "alert", False), (True, "normal", False)])
def test_tags_only_for_v3_when_enabled(client, monkeypatch, enabled, style, tagged):
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    client.tts_tags = enabled
    plain = "Heat H-1053: Gate HOLD. reason"
    assert client.synthesize(plain, "ta", style=style)
    payload = post.call_args.kwargs["json"]
    assert payload["language"] == "ta-IN"
    assert ("<slow>" in payload["text"]) is tagged
    assert ("<pauses>" in payload["text"]) is tagged
    assert "</" not in payload["text"] and "<shouting>" not in payload["text"]
    expected = {"version": 2, "model": "timbre-v3.0", "voice": "Shivani", "language": "ta-IN",
                "sample_rate": 22050, "style": style, "text": payload["text"]}
    digest = hashlib.sha256(json.dumps(expected, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    assert (client.tts_cache_dir / f"{digest}.wav").exists()


def test_no_tags_for_v25(client, monkeypatch):
    client.tts_model, client.tts_voice = "timbre-v2.5", "Kamakshi"
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    assert client.synthesize("<slow> Heat H-1053: <pauses> HOLD", "ta", style="alert")
    assert post.call_args.kwargs["json"]["text"] == "Heat H-1053:  HOLD"
    assert tts_text("Heat H-1053: HOLD", "timbre-v2.5", "alert", True) == "Heat H-1053: HOLD"


def test_fallback_to_v25_on_v3_error(client, monkeypatch):
    post = Mock(side_effect=[response(500), response()])
    monkeypatch.setattr("requests.post", post)
    assert client.synthesize("Heat H-1053: HOLD", "ta", style="alert") == _silent_wav()
    primary, fallback = [call.kwargs["json"] for call in post.call_args_list]
    assert (primary["model"], primary["voice"]) == ("timbre-v3.0", "Shivani")
    assert "<slow>" in primary["text"]
    assert (fallback["model"], fallback["voice"]) == ("timbre-v2.5", "Kamakshi")
    assert "<" not in fallback["text"]
    assert client.last_provider_used == "gnani:timbre-v2.5:Kamakshi"
    assert "500" in client.status()["last_tts_fallback_reason"]
    assert client.stats["tts_calls"] == 2


@pytest.mark.parametrize("model,voice", [("timbre-v3.0", "Kamakshi"), ("timbre-v2.5", "Shivani"), ("timbre-v3.0", "Nobody")])
def test_invalid_voice_model_pair_skips_to_fallback(client, monkeypatch, model, voice):
    client.tts_model, client.tts_voice = model, voice
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    assert client.synthesize("Heat H-1053: HOLD", "ta", style="alert")
    post.assert_called_once()
    assert post.call_args.kwargs["json"]["model"] == "timbre-v2.5"
    assert post.call_args.kwargs["json"]["voice"] == "Kamakshi"


def test_identical_audition_uses_cache_and_zero_budget_still_allows_cache(client, monkeypatch):
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    audio = client.synthesize("Heat H-1053: HOLD", "ta", style="alert", allow_fallback=False, max_calls=1)
    assert client.synthesize("Heat H-1053: HOLD", "ta", style="alert", allow_fallback=False, max_calls=0) == audio
    post.assert_called_once()
    assert client.last_tts_source == "cache"
    assert client.last_provider_used == "gnani:timbre-v3.0:Shivani"


def test_audition_budget_and_labels_cannot_be_bypassed_by_fallback(client, monkeypatch):
    post = Mock(return_value=response(500))
    monkeypatch.setattr("requests.post", post)
    assert client.synthesize("HOLD", "ta", allow_fallback=False, max_calls=1) is None
    assert post.call_count == 1
    assert client.synthesize("other", "ta", max_calls=0) is None
    assert post.call_count == 1
    assert client.last_provider_used is None


def test_service_style_provider_and_gtts_fallback(client, monkeypatch):
    monkeypatch.setenv("STT_PROVIDER", "gnani")
    monkeypatch.setenv("TTS_PROVIDER", "gnani")
    monkeypatch.setenv("GROQ_API_KEY", "")
    monkeypatch.setattr("app.copilot.voice_service.get_gnani_client", lambda: client)
    service = VoiceService()
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    assert service.text_to_speech("Heat H-1053: HOLD", "ta", style="alert")
    assert "<slow>" in post.call_args.kwargs["json"]["text"]
    assert service.status()["last_provider_used"] == "gnani:timbre-v3.0:Shivani"
    assert service.last_media_type == "audio/wav"
    post.side_effect = [response(500), response(500)]
    gtts = Mock(return_value=b"mp3")
    monkeypatch.setattr(service, "_gtts_tts", gtts)
    assert service.text_to_speech("Different HOLD", "ta-IN", style="alert") == b"mp3"
    gtts.assert_called_once_with("Different HOLD", "ta", False)
    assert service.last_provider_used == "gtts"


def test_request_style_validation():
    assert TTSRequest(text="Hello").style == "normal"
    assert TTSRequest(text="HOLD", style="alert").style == "alert"
    with pytest.raises(ValueError):
        TTSRequest(text="HOLD", style="shouting")


@pytest.mark.parametrize('setting,expected', [(None, 8), ('2.5', 2.5), ('8', 8), ('60', 8), ('0', 8), ('-1', 8), ('bad', 8), ('nan', 8), ('inf', 8)])
def test_timbre_timeout_default_validation_and_hard_cap(client, monkeypatch, setting, expected):
    if setting is None:
        monkeypatch.delenv('GNANI_TTS_TIMEOUT_S')
    else:
        monkeypatch.setenv('GNANI_TTS_TIMEOUT_S', setting)
    configured = GnaniClient()
    post = Mock(return_value=response())
    monkeypatch.setattr('requests.post', post)
    assert configured.synthesize('timeout setting test', 'hi')
    assert post.call_args.kwargs['timeout'] == expected
    assert configured.status()['tts_timeout_s'] == expected


@pytest.mark.parametrize('error', [requests.exceptions.ReadTimeout('provider secret text'), requests.exceptions.ConnectionError(ConnectionResetError(10054, 'reset'))])
def test_timeout_or_reset_immediately_uses_v25_without_retry_or_sleep(client, monkeypatch, caplog, error):
    post = Mock(side_effect=[error, response()])
    monkeypatch.setattr('requests.post', post)
    sleep = Mock(side_effect=AssertionError('No sleep before fallback'))
    monkeypatch.setattr('time.sleep', sleep)
    with caplog.at_level('INFO'):
        assert client.synthesize('private transcript', 'hi') == _silent_wav()
    assert [call.kwargs['json']['model'] for call in post.call_args_list] == ['timbre-v3.0', 'timbre-v2.5']
    assert [call.kwargs['timeout'] for call in post.call_args_list] == [8, 8]
    assert client.last_provider_used == 'gnani:timbre-v2.5:Kamakshi'
    assert 'tts_served path=v2.5 fallback language=hi-IN' in caplog.text
    assert 'private transcript' not in caplog.text and client.api_key not in caplog.text
    assert 'provider secret text' not in caplog.text
    sleep.assert_not_called()


def test_timeout_then_reset_immediately_serves_gtts_after_v25(client, monkeypatch, caplog):
    monkeypatch.setenv('STT_PROVIDER', 'gnani')
    monkeypatch.setenv('TTS_PROVIDER', 'gnani')
    monkeypatch.setenv('GROQ_API_KEY', '')
    monkeypatch.setattr('app.copilot.voice_service.get_gnani_client', lambda: client)
    service = VoiceService()
    post = Mock(side_effect=[requests.exceptions.Timeout(), requests.exceptions.ConnectionError(ConnectionResetError(10054, 'reset'))])
    monkeypatch.setattr('requests.post', post)
    monkeypatch.setattr('time.sleep', Mock(side_effect=AssertionError('No sleep before fallback')))
    gtts = Mock(return_value=b'mocked mp3')
    monkeypatch.setattr(service, '_gtts_tts', gtts)
    with caplog.at_level('INFO'):
        assert service.text_to_speech('private transcript', 'hi-IN') == b'mocked mp3'
    assert [call.kwargs['json']['model'] for call in post.call_args_list] == ['timbre-v3.0', 'timbre-v2.5']
    gtts.assert_called_once_with('private transcript', 'hi', False)
    assert service.last_provider_used == 'gtts'
    assert 'tts_served path=gTTS language=hi' in caplog.text
    assert 'private transcript' not in caplog.text and client.api_key not in caplog.text


def test_timeout_can_use_cached_v25_with_no_second_http_attempt(client, monkeypatch, caplog):
    fallback = client._cache_path('private transcript', 'hi-IN', 'Kamakshi', model='timbre-v2.5')
    fallback.write_bytes(_silent_wav())
    post = Mock(side_effect=requests.exceptions.ReadTimeout())
    monkeypatch.setattr('requests.post', post)
    with caplog.at_level('INFO'):
        assert client.synthesize('private transcript', 'hi', max_calls=1)
    post.assert_called_once()
    assert client.last_tts_source == 'cache'
    assert client.last_provider_used == 'gnani:timbre-v2.5:Kamakshi'
    assert 'tts_served path=cache language=hi-IN' in caplog.text


def test_streaming_wav_lengths_are_finalized_without_changing_pcm(client, monkeypatch):
    original = _silent_wav()
    streamed = bytearray(original)
    streamed[4:8] = streamed[40:44] = b"\xff\xff\xff\xff"
    post = Mock(return_value=Mock(status_code=200, content=bytes(streamed)))
    monkeypatch.setattr("requests.post", post)
    audio = client.synthesize("HOLD", "ta")
    assert audio == original
    assert _finalize_wav(audio) == audio
    with wave.open(io.BytesIO(audio), "rb") as wav:
        assert wav.getnframes() == 8820


def test_audition_global_limit_and_free_cached_rerun(client, monkeypatch, tmp_path):
    script = Path(__file__).resolve().parents[1] / "tools" / "tts_audition.py"
    spec = importlib.util.spec_from_file_location("tts_audition", script)
    audition = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audition)
    monkeypatch.setattr(audition, "OUTPUT", tmp_path / "audition")
    monkeypatch.setattr(audition, "hold_sentence", lambda: "Heat H-1053: Gate HOLD. reason")
    monkeypatch.setattr(audition, "load_dotenv", lambda *args, **kwargs: None)
    post = Mock(return_value=response())
    monkeypatch.setattr("requests.post", post)
    assert audition.main(["--voices", "Shivani", "--max-calls", "2"]) == 1  # Two v3 variants, baseline deferred.
    assert post.call_count == 2
    assert audition.main(["--voices", "Shivani", "--max-calls", "1"]) == 0  # Only the baseline needs a call.
    assert post.call_count == 3
    assert audition.main(["--voices", "Shivani", "--max-calls", "0"]) == 0
    assert post.call_count == 3
    manifest = json.loads((audition.OUTPUT / "audition.json").read_text(encoding="utf-8"))
    assert manifest["live_calls"] == 0
    assert [row["source"] for row in manifest["variants"]] == ["cache"] * 3


def test_synthesis_route_passes_style_and_reports_model_voice(client, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    service = Mock(last_media_type="audio/wav", last_provider_used="gnani:timbre-v3.0:Shivani")
    service.text_to_speech.return_value = _silent_wav()
    monkeypatch.setattr(main, "voice_service", service)
    # No lifespan context: no real providers/models are initialized.
    api = TestClient(main.app)
    result = api.post("/copilot/voice/synthesize", json={"text": "HOLD", "language": "ta", "style": "alert"})
    assert result.status_code == 200
    assert result.headers["X-TTS-Provider"] == "gnani:timbre-v3.0:Shivani"
    service.text_to_speech.assert_called_once_with(text="HOLD", language="ta", slow=False, style="alert")
    assert api.post("/copilot/voice/synthesize", json={"text": "HOLD", "style": "invalid"}).status_code == 422
