"""WebSocket protocol tests with a mocked upstream: never use provider credits."""
import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import main

# main.py imports copilot as a top-level package; patch its actual route module.
stream = sys.modules[main.proxy_stream.__module__]
ORIGIN = {"origin": "http://localhost:5173"}
SECRET = "test-server-only-api-key"


class Upstream:
    def __init__(self, events=None, handshake=None):
        self.events = events if events is not None else [
            {"type": "processing"},
            {"type": "transcript", "text": "heat one zero five three status என்ன",
             "is_final": True, "detected_language_code": "ta-IN"},
        ]
        self.queue = asyncio.Queue()
        self.queue.put_nowait(handshake or {"type": "connected", "config": {"secret": SECRET}})
        self.sent, self.times = [], []
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        self.closed = True

    async def send(self, data):
        self.sent.append(data)
        self.times.append(asyncio.get_running_loop().time())
        if isinstance(data, str) and json.loads(data)["type"] == "commit":
            for event in self.events:
                self.queue.put_nowait(event)

    async def recv(self):
        event = await self.queue.get()
        if isinstance(event, Exception):
            raise event
        return json.dumps(event)


@pytest.fixture
def proxy(monkeypatch):
    for key, value in {
        "GNANI_STREAM_ENABLED": "on", "GNANI_STREAM_SAMPLE_RATE": "16000",
        "GNANI_API_KEY": SECRET, "GNANI_MOCK": "false",
        "GNANI_BASE_URL": "https://api.vachana.ai", "GNANI_STT_MODEL": "prisma-v3.0",
        "GNANI_STT_LANGUAGE": "ta-IN,en-IN", "GNANI_STT_FORMAT": "codemix",
        "GNANI_STT_KEYTERMS": "heat,கார்பன்",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("GNANI_STREAM_VAD_THRESHOLD", raising=False)
    monkeypatch.delenv("GNANI_STREAM_MIN_SILENCE_MS", raising=False)
    monkeypatch.delenv("GNANI_STREAM_IDLE_TIMEOUT_S", raising=False)
    monkeypatch.delenv("GNANI_STREAM_LANGUAGE", raising=False)
    monkeypatch.setattr("requests.sessions.Session.request", Mock(side_effect=AssertionError("No network")))
    upstream = Upstream()
    connector = Mock(return_value=upstream)
    monkeypatch.setattr(stream, "connect", connector)
    return TestClient(main.app), upstream, connector


def start(socket):
    socket.send_json({"type": "start", "sample_rate": 16000})
    assert socket.receive_json()["type"] == "connected"


def finish(socket):
    result = []
    while True:
        event = socket.receive_json()
        result.append(event)
        if event["type"] == "closed":
            with pytest.raises(WebSocketDisconnect):
                socket.receive_json()
            return result


def test_rechunks_pcm_into_exact_frames(proxy):
    api, upstream, connector = proxy
    chunks = [bytes([i % 256 for i in range(n)]) for n in (513, 1025, 250)]
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        for chunk in chunks:
            socket.send_bytes(chunk)
        socket.send_json({"type": "stop"})
        finish(socket)
    frames = [item for item in upstream.sent if isinstance(item, bytes)]
    assert len(frames) == 2 and all(len(frame) == 1024 for frame in frames)
    original = b"".join(chunks)
    assert b"".join(frames) == original.ljust(2048, b"\0")
    assert upstream.times[1] - upstream.times[0] >= .030
    assert json.loads(upstream.sent[-1]) == {"type": "commit"}
    assert upstream.closed
    connector.assert_called_once()


@pytest.mark.parametrize("flag,mock", [("off", "false"), ("on", "true"), (None, "false")])
def test_disabled_flag_returns_stream_disabled_and_closes(proxy, monkeypatch, flag, mock):
    api, _, connector = proxy
    if flag is None:
        monkeypatch.delenv("GNANI_STREAM_ENABLED")
    else:
        monkeypatch.setenv("GNANI_STREAM_ENABLED", flag)
    monkeypatch.setenv("GNANI_MOCK", mock)
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        messages = finish(socket)
    assert messages[0]["type"] == "error" and messages[0]["code"] == "stream_disabled"
    connector.assert_not_called()


def test_relays_partial_and_final_messages(proxy):
    api, upstream, _ = proxy
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        socket.send_bytes(bytes(1024))
        socket.send_json({"type": "stop"})
        messages = finish(socket)
    assert messages == [
        {"type": "partial", "text": "", "code": "processing"},
        {"type": "final", "text": "heat one zero five three status என்ன", "detected_language_code": "ta-IN"},
        {"type": "closed", "text": "", "code": "stopped"},
    ]
    assert upstream.closed


def test_upstream_error_closes_client_cleanly(proxy, caplog):
    api, upstream, _ = proxy
    upstream.events = [{"type": "error", "message": "Bad key: " + SECRET}]
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        socket.send_json({"type": "stop"})
        messages = finish(socket)
    assert messages[0]["code"] == "upstream_error"
    assert upstream.closed and SECRET not in json.dumps(messages)
    assert SECRET not in caplog.text and "[redacted]" in caplog.text


@pytest.mark.parametrize("kind", ["before_start", "audio_idle", "session"])
def test_session_and_idle_timeouts(proxy, monkeypatch, kind):
    api, upstream, _ = proxy
    monkeypatch.setattr(stream, "IDLE_SECONDS", .03 if kind != "session" else 1)
    monkeypatch.setattr(stream, "SESSION_SECONDS", .08 if kind == "session" else 1)
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        if kind != "before_start":
            start(socket)
        messages = finish(socket)
    assert messages[0]["code"] == ("session_limit" if kind == "session" else "idle_timeout")
    if kind != "before_start":
        assert upstream.closed


def test_api_key_never_in_client_messages(proxy):
    api, upstream, connector = proxy
    upstream.events = [{"type": "transcript", "text": "echo " + SECRET, "is_final": True,
                        "detected_language_code": SECRET, "headers": {"x-api-key-id": SECRET}}]
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        socket.send_json({"type": "start", "sample_rate": 16000})
        connected = socket.receive_json()
        socket.send_json({"type": "stop"})
        messages = [connected, *finish(socket)]
    assert SECRET not in json.dumps(messages)
    headers = connector.call_args.kwargs["additional_headers"]
    assert headers["x-api-key-id"] == SECRET
    assert headers["model"] == "prisma-v3.0"
    assert headers["x-model"] == headers["model"]
    assert headers["language_code"] == "ta-IN" and headers["format"] == "codemix"
    assert headers["x-format"] == headers["format"]
    assert headers["x-sample-rate"] == "16000" and "x-idle-timeout-sec" not in headers
    assert json.loads(headers["keyterms"]) == ["heat", "கார்பன்"]
    assert headers["keyterms"].isascii()
    assert headers["x-keyterms"] == headers["keyterms"]
    assert connector.call_args.args[0] == "wss://api.vachana.ai/stt/v3/stream"


@pytest.mark.parametrize("origin", [None, "http://evil.example", "http://localhost:5174"])
def test_rejects_unapproved_or_missing_origin(proxy, origin):
    api, _, connector = proxy
    with pytest.raises(WebSocketDisconnect) as closed:
        with api.websocket_connect("/copilot/voice/stream", headers={"origin": origin} if origin else {}):
            pass
    assert closed.value.code == 1008
    connector.assert_not_called()


@pytest.mark.parametrize("message", [
    {"type": "stop"}, {"type": "start", "sample_rate": 8000},
    {"type": "start", "sample_rate": True}, {"type": "start", "sample_rate": 16000.0},
])
def test_rejects_bad_start_before_opening_upstream(proxy, message):
    api, _, connector = proxy
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        socket.send_json(message)
        assert finish(socket)[0]["code"] == "invalid_start"
    connector.assert_not_called()


@pytest.mark.parametrize("bad_input", ["odd_sample", "duplicate_start"])
def test_odd_final_sample_and_duplicate_start_are_rejected(proxy, bad_input):
    api, upstream, _ = proxy
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        if bad_input == "odd_sample":
            socket.send_bytes(b"\0")
            socket.send_json({"type": "stop"})
        else:
            socket.send_json({"type": "start", "sample_rate": 16000})
        assert finish(socket)[0]["code"] == "invalid_audio"
    assert upstream.closed and upstream.sent == []


def test_client_disconnect_closes_upstream(proxy):
    api, upstream, _ = proxy
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
    assert upstream.closed


def test_status_contains_only_nonsecret_stream_fields(proxy, monkeypatch):
    api, _, _ = proxy
    monkeypatch.setattr(main, "voice_service", None)
    response = api.get("/copilot/voice/status").json()
    assert {k: v for k, v in response.items() if k != 'evon'} == {"available": False, "stream_enabled": True, "stream_model": "prisma-v3.0", "stream_language": "ta-IN"}
    assert set(response['evon']) == {'enabled', 'mode', 'last_latency_ms', 'last_reject_reason'}
    monkeypatch.setenv("GNANI_MOCK", "true")
    assert not api.get("/copilot/voice/status").json()["stream_enabled"]
    assert SECRET not in json.dumps(response)


def test_vad_headers_only_sent_when_set(proxy, monkeypatch):
    assert "x-vad-threshold" not in stream.StreamSettings.from_env().headers
    assert "x-min-silence-ms" not in stream.StreamSettings.from_env().headers
    assert "x-idle-timeout-sec" not in stream.StreamSettings.from_env().headers
    for name in ("GNANI_STREAM_VAD_THRESHOLD", "GNANI_STREAM_MIN_SILENCE_MS", "GNANI_STREAM_IDLE_TIMEOUT_S"):
        monkeypatch.setenv(name, "")
    assert not {"x-vad-threshold", "x-min-silence-ms", "x-idle-timeout-sec"} & stream.StreamSettings.from_env().headers.keys()
    monkeypatch.setenv("GNANI_STREAM_VAD_THRESHOLD", "0.55")
    monkeypatch.setenv("GNANI_STREAM_MIN_SILENCE_MS", "400")
    monkeypatch.setenv("GNANI_STREAM_IDLE_TIMEOUT_S", "30")
    headers = stream.StreamSettings.from_env().headers
    assert headers["x-vad-threshold"] == "0.55" and headers["x-min-silence-ms"] == "400"
    assert headers["x-idle-timeout-sec"] == "30"
    monkeypatch.setenv("GNANI_STREAM_VAD_THRESHOLD", "nan")
    with pytest.raises(ValueError):
        stream.StreamSettings.from_env()


def test_legacy_gateway_receives_explicit_v3_model_header(proxy):
    api, upstream, connector = proxy

    def legacy_gateway(url, **kwargs):
        headers = kwargs["additional_headers"]
        # Model routing on older gateways reads the documented legacy spelling.
        assert headers["x-model"] == "prisma-v3.0"
        assert headers["model"] == headers["x-model"]
        assert headers["language_code"] == "ta-IN"
        return upstream

    connector.side_effect = legacy_gateway
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        socket.send_json({"type": "stop"})
        assert any(event["type"] == "final" for event in finish(socket))
    connector.assert_called_once()


def test_stream_language_defaults_to_first_locale_without_changing_rest(proxy, monkeypatch):
    assert stream.StreamSettings.from_env().headers["language_code"] == "ta-IN"
    assert stream.get_stt_config()["language"] == "ta-IN,en-IN"
    monkeypatch.setenv("GNANI_STREAM_LANGUAGE", "en-IN")
    settings = stream.StreamSettings.from_env()
    assert settings.headers["language_code"] == "en-IN"
    assert settings.headers["format"] == "codemix"
    assert stream.get_stt_config()["language"] == "ta-IN,en-IN"
    monkeypatch.setenv("GNANI_STREAM_LANGUAGE", "ta-IN,en-IN")
    with pytest.raises(ValueError):
        stream.StreamSettings.from_env()


def test_stop_drains_all_known_pending_utterances(proxy):
    api, upstream, _ = proxy
    upstream.events = [
        {"type": "speech_start", "utterance_id": "u1"}, {"type": "processing"},
        {"type": "speech_start", "utterance_id": "u2"}, {"type": "processing"},
        {"type": "transcript", "utterance_id": "u1", "text": "first", "is_final": True},
        {"type": "transcript", "utterance_id": "u2", "text": "second", "is_final": True},
    ]
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        socket.send_json({"type": "stop"})
        messages = finish(socket)
    assert [r["text"] for r in messages if r["type"] == "final"] == ["first", "second"]
    assert upstream.closed


def test_upstream_handshake_timeout_is_not_reported_as_session_limit(proxy, monkeypatch):
    api, upstream, _ = proxy
    upstream.queue.get_nowait()
    # Leave enough time for TestClient's cross-thread start delivery on Windows.
    monkeypatch.setattr(stream, "IDLE_SECONDS", .2)
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        socket.send_json({"type": "start", "sample_rate": 16000})
        assert finish(socket)[0]["code"] == "upstream_error"
    assert upstream.closed


def test_silent_stop_closes_without_manufacturing_final_text(proxy, monkeypatch):
    api, upstream, _ = proxy
    upstream.events = []
    monkeypatch.setattr(stream, "IDLE_SECONDS", .04)
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        socket.send_json({"type": "stop"})
        assert finish(socket) == [{"type": "closed", "code": "stopped", "text": ""}]
    assert upstream.closed


def test_final_before_stop_closes_without_waiting_for_provider_idle(proxy, monkeypatch):
    api, upstream, _ = proxy
    monkeypatch.setattr(stream, "STOP_GRACE_SECONDS", .02)
    monkeypatch.setattr(stream, "IDLE_SECONDS", .2)
    # Replay the live single-locale sequence: speech_start -> final, no processing.
    upstream.events = []
    upstream.queue.put_nowait({"type": "speech_start", "utterance_id": "ue9f82ad9"})
    upstream.queue.put_nowait({"type": "transcript", "text": "heat one zero five one status என்ன?",
                               "utterance_id": "ue9f82ad9", "is_final": True,
                               "detected_language_code": "en-IN"})
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        start(socket)
        assert socket.receive_json() == {"type": "final", "text": "heat one zero five one status என்ன?",
                                         "detected_language_code": "en-IN"}
        socket.send_json({"type": "stop"})
        assert finish(socket) == [{"type": "closed", "code": "stopped", "text": ""}]
    assert upstream.closed
    assert json.loads(upstream.sent[-1]) == {"type": "commit"}


def test_smoke_zero_budget_never_connects(monkeypatch):
    from tools import stream_smoke as smoke
    connector = Mock(side_effect=AssertionError("No socket without budget"))
    monkeypatch.setattr(smoke, "connect", connector)
    monkeypatch.setattr(smoke.httpx, "AsyncClient", connector)
    assert smoke.main(["--max-sessions", "0"]) == 0
    with pytest.raises(SystemExit):
        smoke.main(["--max-sessions", "3"])
    connector.assert_not_called()


def test_smoke_two_session_budget_and_latency_output(monkeypatch, capsys):
    from tools import stream_smoke as smoke

    class AgentSocket(Upstream):
        async def send(self, data):
            self.sent.append(data)
            if isinstance(data, str) and json.loads(data)["type"] == "stop":
                for event in [
                    {"type": "partial", "text": "", "code": "processing"},
                    {"type": "final", "text": "heat 1051", "detected_language_code": "ta-IN"},
                    {"type": "closed", "text": "", "code": "stopped"},
                ]:
                    self.queue.put_nowait(event)

    sockets = [AgentSocket(), AgentSocket()]
    connector = Mock(side_effect=sockets)
    monkeypatch.setattr(smoke, "connect", connector)
    counts = {"attempted": 0, "connected": 0}

    async def exercise():
        for index in (1, 2):
            assert await smoke.run_session("ws://localhost:8001/copilot/voice/stream", bytes(1024), index, counts)

    asyncio.run(exercise())
    assert counts["attempted"] == counts["connected"] == len(counts["results"]) == 2
    assert all(r["clean_close"] and r["speech_end_to_final_s"] is not None for r in counts["results"])
    assert connector.call_count == 2 and all(socket.closed for socket in sockets)
    assert connector.call_args.kwargs["origin"] == "http://localhost:5173"
    output = capsys.readouterr().out
    assert "final: heat 1051" in output and "first_partial: N/A (no provisional text)" in output
    assert "first_processing:" in output and "first_final:" in output and "total_s:" in output


def test_smoke_hard_timeout_closes_and_does_not_retry(monkeypatch):
    from tools import stream_smoke as smoke
    socket = Upstream(events=[])
    connector = Mock(return_value=socket)
    monkeypatch.setattr(smoke, "connect", connector)
    monkeypatch.setattr(smoke, "TIME_LIMIT", .02)
    counts = {"attempted": 0, "connected": 0}
    assert not asyncio.run(smoke.run_session("ws://localhost:8001/copilot/voice/stream", bytes(4096), 1, counts))
    assert socket.closed and connector.call_count == 1


def test_smoke_converts_stereo_wav_to_raw_pcm16_16k(tmp_path):
    import numpy as np
    from scipy.io import wavfile
    from tools import stream_smoke as smoke
    path = tmp_path / "recording.wav"
    wavfile.write(path, 48000, np.full((4800, 2), 16384, dtype=np.int16))
    pcm = smoke.load_pcm(path)
    assert len(pcm) == 3200 and not pcm.startswith(b"RIFF")
    assert abs(float(np.frombuffer(pcm, dtype="<i2")[50:-50].mean()) - 16384) < 2


@pytest.mark.parametrize("name,value", [
    ("GNANI_STREAM_VAD_THRESHOLD", "-0.1"), ("GNANI_STREAM_VAD_THRESHOLD", "1.1"),
    ("GNANI_STREAM_VAD_THRESHOLD", "nan"), ("GNANI_STREAM_VAD_THRESHOLD", "inf"),
    ("GNANI_STREAM_MIN_SILENCE_MS", "99"), ("GNANI_STREAM_MIN_SILENCE_MS", "2001"),
    ("GNANI_STREAM_MIN_SILENCE_MS", "300.5"), ("GNANI_STREAM_IDLE_TIMEOUT_S", "4"),
    ("GNANI_STREAM_IDLE_TIMEOUT_S", "901"), ("GNANI_STREAM_IDLE_TIMEOUT_S", "5.5"),
])
def test_vad_values_validated(proxy, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(ValueError):
        stream.StreamSettings.from_env()


def test_session_overrides_reach_only_allowlisted_server_headers(proxy, monkeypatch):
    api, _, connector = proxy
    monkeypatch.setenv("GNANI_STREAM_MIN_SILENCE_MS", "800")
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        socket.send_json({"type": "start", "sample_rate": 16000, "vad_min_silence_ms": 300,
                          "vad_threshold": .5, "idle_timeout_s": 20,
                          "x-api-key-id": "browser-supplied-key", "model": "different"})
        assert socket.receive_json()["type"] == "connected"
        socket.send_json({"type": "stop"})
        finish(socket)
    headers = connector.call_args.kwargs["additional_headers"]
    assert headers["x-min-silence-ms"] == "300"
    assert headers["x-vad-threshold"] == "0.5" and headers["x-idle-timeout-sec"] == "20"
    assert headers["x-api-key-id"] == SECRET and headers["model"] == "prisma-v3.0"
    assert "x-min-speech-ms" not in headers and "x-max-speech-s" not in headers


@pytest.mark.parametrize("options", [
    {"vad_min_silence_ms": 99}, {"vad_threshold": 2}, {"idle_timeout_s": 901},
    {"vad_threshold": True}, {"vad_min_silence_ms": [300]},
])
def test_bad_session_overrides_cannot_open_upstream(proxy, options):
    api, _, connector = proxy
    with api.websocket_connect("/copilot/voice/stream", headers=ORIGIN) as socket:
        socket.send_json({"type": "start", "sample_rate": 16000, **options})
        assert finish(socket)[0]["code"] == "invalid_start"
    connector.assert_not_called()


def test_speech_end_to_final_timing_computed():
    from tools import stream_smoke as smoke
    timings = smoke.session_timings(160000, began=10, connected_at=12,
                                   last_audio_sent_at=18.25, final_arrivals=[17, 19.75], ended=21)
    assert timings == {"audio_duration_s": 5, "speech_end_to_final_s": 1.5,
                       "connect_s": 2, "total_s": 11}
    early = smoke.session_timings(32000, 0, 1, 5, [4.5], 6)
    assert early["speech_end_to_final_s"] == -.5  # Never clamp or substitute WAV duration.
    assert smoke.session_timings(32000, 0, None, None, [], 2)["speech_end_to_final_s"] is None


def test_smoke_sends_explicit_overrides_in_start_only(monkeypatch):
    from tools import stream_smoke as smoke

    class AgentSocket(Upstream):
        async def send(self, data):
            self.sent.append(data)
            if isinstance(data, str) and json.loads(data)["type"] == "stop":
                self.queue.put_nowait({"type": "final", "text": "why hold"})
                self.queue.put_nowait({"type": "closed", "code": "stopped"})

    socket = AgentSocket()
    connector = Mock(return_value=socket)
    monkeypatch.setattr(smoke, "connect", connector)
    options = {"vad_min_silence_ms": 300, "vad_threshold": .7, "idle_timeout_s": 60}
    assert asyncio.run(smoke.run_session("ws://localhost:8001/copilot/voice/stream", bytes(1024), 1,
                                        {"attempted": 0, "connected": 0}, options))
    assert json.loads(socket.sent[0]) == {"type": "start", "sample_rate": 16000, **options}
    assert "additional_headers" not in connector.call_args.kwargs


@pytest.mark.parametrize("args", [
    ["--vad-min-silence-ms", "99"], ["--vad-min-silence-ms", "2001"],
    ["--vad-threshold", "nan"], ["--vad-threshold", "1.01"],
    ["--idle-timeout-s", "4"], ["--idle-timeout-s", "901"],
])
def test_smoke_rejects_invalid_vad_before_any_connection(monkeypatch, args):
    from tools import stream_smoke as smoke
    connector = Mock(side_effect=AssertionError("No connection"))
    monkeypatch.setattr(smoke, "connect", connector)
    with pytest.raises(SystemExit):
        smoke.main(["--max-sessions", "0", *args])
    connector.assert_not_called()
