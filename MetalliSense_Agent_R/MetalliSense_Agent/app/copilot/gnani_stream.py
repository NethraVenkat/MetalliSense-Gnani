"""Opt-in Prisma v3.0 proxy. No REST/TTS client is initialized here.

Browser protocol: start JSON (sample_rate), PCM16-LE mono binary, stop JSON.
Only http://localhost:5173 is allowed as Origin, including for CLI clients.
Prisma currently returns final utterances, not token partials. A processing
acknowledgement becomes {type: partial, text: '', code: processing}; it is not
provisional recognized text. Stop pads the last PCM frame and sends commit.
Reference: https://docs.gnani.ai/api/STT/stt-websocket.md (2026-10-31).
"""
import asyncio
from contextlib import suppress
from dataclasses import dataclass, replace
import json
import logging
import math
import os
from urllib.parse import urlsplit, urlunsplit

from fastapi import WebSocket, WebSocketDisconnect
from websockets.asyncio.client import connect

from .gnani_client import DEFAULT_BASE_URL, _env_bool, get_stt_config, stt_language

FRAME_BYTES = 1024
SESSION_SECONDS = min(15 * 60, 60)
IDLE_SECONDS = 10
STOP_GRACE_SECONDS = 1
ALLOWED_ORIGINS = frozenset({"http://localhost:5173"})
logger = logging.getLogger(__name__)
ERRORS = {
    "stream_disabled": "Streaming is disabled; use REST push-to-talk.",
    "invalid_config": "Streaming configuration is invalid; use REST push-to-talk.",
    "invalid_start": "Send start with the configured sample_rate first.",
    "invalid_audio": "Send PCM16 mono bytes, then stop.",
    "idle_timeout": "No client audio received for 10 seconds.",
    "session_limit": "Streaming session reached the 60-second limit.",
    "upstream_error": "Speech streaming failed; use REST push-to-talk.",
}


class StreamFailure(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def stream_option_headers(options):
    """Validate only the three supported overrides; browser never supplies headers.

    Environment and per-session start options use the same validation. Missing
    options omit the provider header entirely, preserving Gnani defaults.
    """
    headers = {}
    for name, header, low, high, integer in (
        ("vad_threshold", "x-vad-threshold", 0, 1, False),
        ("vad_min_silence_ms", "x-min-silence-ms", 100, 2000, True),
        ("idle_timeout_s", "x-idle-timeout-sec", 5, 900, True),
    ):
        raw = options.get(name)
        if raw is None or isinstance(raw, str) and not raw.strip():
            continue
        if isinstance(raw, bool):
            raise ValueError(f"Invalid {name}")
        value = float(raw)
        if not math.isfinite(value) or not low <= value <= high or integer and not value.is_integer():
            raise ValueError(f"Invalid {name}")
        headers[header] = str(int(value) if integer else value)
    return headers


def _stream_language():
    default = (os.getenv("GNANI_STT_LANGUAGE", "ta-IN").strip() or "ta-IN").split(",")[0]
    language = stt_language(os.getenv("GNANI_STREAM_LANGUAGE", "").strip() or default)
    if "," in language:
        raise ValueError("GNANI_STREAM_LANGUAGE must contain a single locale")
    return language


def stream_status():
    """Effective availability, with no API key, headers or provider errors."""
    model = os.getenv("GNANI_STT_MODEL", "prisma-v3.0").strip()
    try:
        language = _stream_language()
    except ValueError:
        language = None
    return {
        "stream_enabled": (_env_bool("GNANI_STREAM_ENABLED")
                           and not _env_bool("GNANI_MOCK")
                           and bool(os.getenv("GNANI_API_KEY", "").strip())
                           and model == "prisma-v3.0" and language is not None),
        "stream_model": model,
        "stream_language": language,
    }


@dataclass(frozen=True)
class StreamSettings:
    url: str
    headers: dict
    sample_rate: int

    @classmethod
    def from_env(cls):
        stt = get_stt_config()
        if stt["model"] != "prisma-v3.0":
            raise ValueError("Streaming requires Prisma v3.0")
        rate = int(os.getenv("GNANI_STREAM_SAMPLE_RATE", "16000"))
        if rate not in {8000, 16000, 44100, 48000}:
            raise ValueError("Unsupported streaming sample rate")
        base = urlsplit(os.getenv("GNANI_BASE_URL", DEFAULT_BASE_URL).strip())
        if base.scheme not in {"http", "https"} or not base.netloc or base.username or base.query or base.fragment:
            raise ValueError("Invalid Gnani base URL")
        url = urlunsplit(("wss" if base.scheme == "https" else "ws", base.netloc,
                         base.path.rstrip("/") + "/stt/v3/stream", "", ""))
        headers = {
            "x-api-key-id": os.getenv("GNANI_API_KEY", "").strip(),
            # Both spellings are documented. Send matching legacy aliases for
            # gateway compatibility; never silently fall back to another model.
            "model": stt["model"], "x-model": stt["model"],
            "language_code": _stream_language(),
            "format": stt["format"], "x-format": stt["format"],
            "x-sample-rate": str(rate),
        }
        if stt["keyterms"]:
            headers["keyterms"] = json.dumps(stt["keyterms"].split(","), ensure_ascii=True)
            headers["x-keyterms"] = headers["keyterms"]
        headers.update(stream_option_headers({
            "vad_threshold": os.getenv("GNANI_STREAM_VAD_THRESHOLD"),
            "vad_min_silence_ms": os.getenv("GNANI_STREAM_MIN_SILENCE_MS"),
            "idle_timeout_s": os.getenv("GNANI_STREAM_IDLE_TIMEOUT_S"),
        }))
        return cls(url, headers, rate)


class PcmFrames:
    """Hold incomplete frames; pad only at stop, never discard PCM samples."""
    def __init__(self):
        self.buffer = bytearray()

    def feed(self, data):
        self.buffer.extend(data)
        while len(self.buffer) >= FRAME_BYTES:
            frame = bytes(self.buffer[:FRAME_BYTES])
            del self.buffer[:FRAME_BYTES]
            yield frame

    def finish(self):
        if len(self.buffer) % 2:
            raise StreamFailure("invalid_audio")  # Incomplete 16-bit sample.
        if not self.buffer:
            return None
        frame = bytes(self.buffer).ljust(FRAME_BYTES, b"\0")
        self.buffer.clear()
        return frame


async def _client_message(client):
    try:
        async with asyncio.timeout(IDLE_SECONDS):
            message = await client.receive()
    except TimeoutError:
        raise StreamFailure("idle_timeout") from None
    if message["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code", 1000))
    return message


def _control(message, error, max_length=4096):
    text = message.get("text")
    if not isinstance(text, str) or len(text) > max_length:
        raise StreamFailure(error)
    try:
        data = json.loads(text)
    except ValueError:
        raise StreamFailure(error) from None
    if not isinstance(data, dict):
        raise StreamFailure(error)
    return data


def _provider_message(raw):
    if not isinstance(raw, str):
        raise StreamFailure("upstream_error")
    try:
        data = json.loads(raw)
    except ValueError:
        raise StreamFailure("upstream_error") from None
    if isinstance(data, dict) and data.get("type") == "error":
        logger.warning("Gnani stream provider error")  # No echoed context or keys.
        raise StreamFailure("upstream_error")
    if not isinstance(data, dict):
        # Never relay provider error strings/handshake headers: they can contain keys.
        raise StreamFailure("upstream_error")
    return data


async def _pump(client, upstream, settings):
    from .context_bias import BiasUpdates,enabled
    bias=BiasUpdates(upstream,client,get_stt_config()['keyterms'])
    stopped = asyncio.Event()
    open_utterances = set()
    pending_processing = 0
    saw_final = False
    interval = (FRAME_BYTES // 2) / settings.sample_rate
    next_send = 0.0

    async def send_frame(frame):
        nonlocal next_send
        loop = asyncio.get_running_loop()
        await asyncio.sleep(max(0, next_send - loop.time()))
        await upstream.send(frame)
        # Schedule from actual send time: never catch up with a burst after a delay.
        next_send = loop.time() + interval

    async def send_audio():
        frames, received = PcmFrames(), 0
        while True:
            message = await _client_message(client)
            if message.get("bytes") is not None:
                data = message["bytes"]
                # One second per browser message bounds buffering and backpressure.
                if len(data) > settings.sample_rate * 2:
                    raise StreamFailure("invalid_audio")
                received += len(data)
                if received > settings.sample_rate * 2 * SESSION_SECONDS:
                    raise StreamFailure("session_limit")
                for frame in frames.feed(data):
                    await send_frame(frame)
            else:
                control=_control(message,'invalid_audio',16384 if enabled() else 4096)
                if control.get('type')=='context_terms':
                    bias.update(control.get('terms'))
                    continue
                if control.get('type')!='stop':raise StreamFailure('invalid_audio')
                tail=frames.finish()
                if tail is not None:await send_frame(tail)
                await asyncio.sleep(max(0,next_send-asyncio.get_running_loop().time()))
                stopped.set()
                await upstream.send(json.dumps({'type':'commit'}))
                return

    async def receive_transcripts():
        nonlocal pending_processing, saw_final
        while True:
            event = _provider_message(await upstream.recv())
            if event.get('type')=='settings_updated':
                await bias.acknowledged()
            elif event.get("type") == "speech_start":
                utterance = event.get("utterance_id")
                open_utterances.add(utterance if isinstance(utterance, str) else "open")
            elif event.get("type") == "processing":
                pending_processing += 1
                await client.send_json({"type": "partial", "text": "", "code": "processing"})
            elif event.get("type") == "transcript":
                # The current protocol always sends is_final=true (older examples omit it).
                # Preserve an explicit false defensively if the provider adds partials.
                final = event.get("is_final", True) is not False
                text = event.get("text", "")
                if not isinstance(text, str):
                    raise StreamFailure("upstream_error")
                text = text.replace(settings.headers["x-api-key-id"], "[redacted]")
                reply = {"type": "final" if final else "partial", "text": text}
                language = event.get("detected_language_code")
                if language in {"en-IN", "hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN"}:
                    reply["detected_language_code"] = language
                await client.send_json(reply)
                if final:
                    saw_final = True
                    pending_processing = max(0, pending_processing - 1)
                    utterance = event.get("utterance_id")
                    if utterance in open_utterances:
                        open_utterances.discard(utterance)
                    elif open_utterances:
                        open_utterances.pop()  # Older examples omit utterance_id.
                    if stopped.is_set() and not pending_processing and not open_utterances:
                        return

    sender = asyncio.create_task(send_audio())
    receiver = asyncio.create_task(receive_transcripts())
    try:
        done, _ = await asyncio.wait({sender, receiver}, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
        if sender in done and not receiver.done():
            # Empty/silent audio or already-finalized speech may yield no commit result.
            # A final can arrive just BEFORE the client sends stop. In that case,
            # allow late speech_start/processing events to arrive, then close if
            # nothing remains outstanding instead of waiting for provider idle.
            with suppress(TimeoutError):
                async with asyncio.timeout(IDLE_SECONDS):
                    if saw_final and not pending_processing and not open_utterances:
                        done, _ = await asyncio.wait({receiver}, timeout=STOP_GRACE_SECONDS)
                        if receiver in done:
                            receiver.result()
                            return
                        if not pending_processing and not open_utterances:
                            return
                    await receiver
    finally:
        await bias.close()
        for task in (sender, receiver):
            task.cancel()
        await asyncio.gather(sender, receiver, return_exceptions=True)


async def proxy_stream(client: WebSocket):
    """One upstream per accepted client; no reconnection or hidden paid retries."""
    if client.headers.get("origin") not in ALLOWED_ORIGINS:
        await client.close(code=1008)
        return
    await client.accept()
    reason, close_code = "stopped", 1000
    phase = "configuration"
    try:
        async with asyncio.timeout(SESSION_SECONDS):
            if not stream_status()["stream_enabled"]:
                raise StreamFailure("stream_disabled")
            try:
                settings = StreamSettings.from_env()
            except (TypeError, ValueError):
                raise StreamFailure("invalid_config") from None
            start = _control(await _client_message(client), "invalid_start")
            if start.get("type") != "start" or type(start.get("sample_rate")) is not int or start["sample_rate"] != settings.sample_rate:
                raise StreamFailure("invalid_start")
            try:
                settings = replace(settings, headers={**settings.headers, **stream_option_headers(start)})
            except (TypeError, ValueError, OverflowError):
                raise StreamFailure("invalid_start") from None
            phase = "upstream handshake"
            async with connect(settings.url, additional_headers=settings.headers,
                               open_timeout=IDLE_SECONDS, close_timeout=1,
                               ping_interval=20, ping_timeout=10, compression=None,
                               max_size=65536, max_queue=16) as upstream:
                phase = "upstream ready event"
                try:
                    async with asyncio.timeout(IDLE_SECONDS):
                        event = _provider_message(await upstream.recv())
                except TimeoutError:
                    raise StreamFailure("upstream_error") from None
                if event.get("type") != "connected":
                    raise StreamFailure("upstream_error")
                active_rate = event.get("config", {}).get("sample_rate", settings.sample_rate)
                if active_rate != settings.sample_rate:
                    raise StreamFailure("upstream_error")
                await client.send_json({"type": "connected", "text": "",
                                        "sample_rate": settings.sample_rate,
                                        "frame_bytes": FRAME_BYTES,
                                        "session_limit_seconds": SESSION_SECONDS})
                phase = "audio streaming"
                await _pump(client, upstream, settings)
    except WebSocketDisconnect:
        reason = "client_disconnected"
    except TimeoutError:
        reason, close_code = "session_limit", 1008
    except StreamFailure as error:
        reason, close_code = error.code, 1008
        if reason == "upstream_error":
            logger.warning("Gnani stream failed during %s", phase)
    except Exception as error:
        reason, close_code = "upstream_error", 1011
        # Class + HTTP status identify auth/TLS/transport failures without logging
        # exception repr (which can include handshake headers and the API key).
        http_status = getattr(getattr(error, "response", None), "status_code", None)
        logger.warning("Gnani stream failed during %s: %s; HTTP status=%s",
                       phase, type(error).__name__, http_status if isinstance(http_status, int) else "n/a")
    finally:
        # Fixed messages only; no exception repr, upstream config, or close reason leaks.
        with suppress(WebSocketDisconnect, RuntimeError, OSError):
            if reason in ERRORS:
                await client.send_json({"type": "error", "code": reason, "text": ERRORS[reason]})
            await client.send_json({"type": "closed", "code": reason, "text": ""})
            await client.close(code=close_code)
