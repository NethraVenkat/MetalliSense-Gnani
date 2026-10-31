"""Exercise OUR Agent stream endpoint; never connects directly to Gnani.

Run after enabling GNANI_STREAM_ENABLED=on and restarting the Agent:
    python tools/stream_smoke.py --max-sessions 2
No retries. Up to two sessions per invocation, each bounded to 60 seconds.
Current Prisma emits completed utterances, not provisional text; processing
acknowledgements and genuine text-partial latency are reported separately.
"""
import argparse
import asyncio
import json
import math
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit, urlunsplit

import httpx
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from websockets.asyncio.client import connect

AGENT_ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:5173"
RATE, FRAME_BYTES, TIME_LIMIT = 16000, 1024, 60


def load_pcm(path):
    rate, audio = wavfile.read(path)
    if np.issubdtype(audio.dtype, np.unsignedinteger):
        midpoint = (np.iinfo(audio.dtype).max + 1) / 2
        audio = (audio.astype(np.float64) - midpoint) / midpoint
    elif np.issubdtype(audio.dtype, np.signedinteger):
        audio = audio.astype(np.float64) / (np.iinfo(audio.dtype).max + 1)
    else:
        audio = audio.astype(np.float64)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    if audio.ndim != 1 or not audio.size or not np.isfinite(audio).all():
        raise ValueError("WAV contains empty or invalid audio")
    # Leave time for the handshake and final transcription inside the hard cap.
    if len(audio) / rate > 50:
        raise ValueError("Smoke WAV must be at most 50 seconds")
    if rate != RATE:
        divisor = math.gcd(int(rate), RATE)
        audio = resample_poly(audio, RATE // divisor, int(rate) // divisor)
    return np.rint(np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()


def status_url(url):
    parts = urlsplit(url)
    if parts.scheme not in {"ws", "wss"} or not parts.path.endswith("/stream"):
        raise ValueError("URL must be our ws(s)://Agent/copilot/voice/stream endpoint")
    return urlunsplit(("https" if parts.scheme == "wss" else "http", parts.netloc,
                       parts.path.removesuffix("/stream") + "/status", "", ""))


def session_timings(audio_bytes, began, connected_at, last_audio_sent_at, final_arrivals, ended):
    """Monotonic wall-clock measurements; never estimate latency from WAV length.

    The requested speech-end proxy is the *client's last binary send*, including
    trailing silence. A negative value is kept if final arrived before clip end.
    Use the last final when VAD splits the clip into multiple utterances.
    """
    return {
        "audio_duration_s": audio_bytes / (RATE * 2),
        "speech_end_to_final_s": (final_arrivals[-1] - last_audio_sent_at
                                  if final_arrivals and last_audio_sent_at is not None else None),
        "connect_s": connected_at - began if connected_at is not None else None,
        "total_s": ended - began,
    }


async def run_session(url, pcm, index, counts, overrides=None):
    began = time.perf_counter()
    metrics = {"first_partial": None, "first_processing": None, "first_final": None}
    finals, audio_started = [], None
    final_arrivals = []
    last_audio_sent_at = None
    close_reason = "not_closed"
    stop_sent = False
    clean_close = False
    counts["attempted"] += 1
    print(f"\nSession {index}: connecting to Agent", flush=True)
    try:
        async with asyncio.timeout(TIME_LIMIT):
            async with connect(url, origin=ORIGIN, open_timeout=10, close_timeout=1,
                               compression=None, max_size=65536) as socket:
                await socket.send(json.dumps({"type": "start", "sample_rate": RATE, **(overrides or {})}))
                async with asyncio.timeout(10):
                    event = json.loads(await socket.recv())
                if event.get("type") != "connected":
                    close_reason = event.get("code", "unknown")
                    print(f"Agent refused stream: {event.get('code', 'unknown')}", flush=True)
                    return False
                counts["connected"] += 1
                audio_started = time.perf_counter()

                async def send():
                    nonlocal last_audio_sent_at, stop_sent
                    for offset in range(0, len(pcm), FRAME_BYTES):
                        frame = pcm[offset:offset + FRAME_BYTES]
                        await socket.send(frame)
                        last_audio_sent_at = time.perf_counter()
                        await asyncio.sleep(len(frame) / (RATE * 2))
                    await socket.send(json.dumps({"type": "stop"}))
                    stop_sent = True

                async def receive():
                    nonlocal close_reason, clean_close
                    failed = False
                    while True:
                        message = json.loads(await socket.recv())
                        arrived = time.perf_counter()
                        elapsed = arrived - audio_started
                        kind, text = message.get("type"), message.get("text", "")
                        if kind == "partial" and message.get("code") == "processing":
                            if metrics["first_processing"] is None:
                                metrics["first_processing"] = elapsed
                            print(f"[{elapsed:.3f}s] processing (no partial text)", flush=True)
                        elif kind == "partial" and text:
                            if metrics["first_partial"] is None:
                                metrics["first_partial"] = elapsed
                            print(f"[{elapsed:.3f}s] partial: {text}", flush=True)
                        elif kind == "final":
                            if metrics["first_final"] is None:
                                metrics["first_final"] = elapsed
                            finals.append(text)
                            final_arrivals.append(arrived)
                            print(f"[{elapsed:.3f}s] final: {text} ({message.get('detected_language_code', 'unknown')})", flush=True)
                        elif kind == "error":
                            failed = True
                            print(f"[{elapsed:.3f}s] error: {message.get('code', 'unknown')}", flush=True)
                        elif kind == "closed":
                            close_reason = message.get("code", "unknown")
                            clean_close = bool(finals) and not failed and stop_sent and close_reason == "stopped"
                            return clean_close

                sender = asyncio.create_task(send())
                receiver = asyncio.create_task(receive())
                try:
                    done, _ = await asyncio.wait({sender, receiver}, return_when=asyncio.FIRST_COMPLETED)
                    if receiver in done:
                        return receiver.result()
                    sender.result()
                    return await receiver
                finally:
                    sender.cancel()
                    receiver.cancel()
                    await asyncio.gather(sender, receiver, return_exceptions=True)
    except TimeoutError:
        close_reason = "hard_timeout"
        print("Hard stop: session exceeded 60 seconds.", flush=True)
        return False
    except Exception as error:
        close_reason = type(error).__name__
        # Do not print handshake details from third-party exception objects.
        print(f"Session failed ({type(error).__name__}); no retry.", flush=True)
        return False
    finally:
        for label, value in metrics.items():
            suffix = "N/A (no provisional text)" if label == "first_partial" else "N/A"
            print(f"  {label}: {value:.3f}s" if value is not None else f"  {label}: {suffix}", flush=True)
        timings = session_timings(len(pcm), began, audio_started, last_audio_sent_at,
                                  final_arrivals, time.perf_counter())
        for label, value in timings.items():
            print(f"  {label}: {value:.3f}" if value is not None else f"  {label}: N/A", flush=True)
        print(f"  close_reason: {close_reason}; stop_sent: {stop_sent}; clean_close: {clean_close}", flush=True)
        summary = {"session": index, **timings, "transcripts": finals,
                   "close_reason": close_reason, "stop_sent": stop_sent, "clean_close": clean_close}
        counts.setdefault("results", []).append(summary)
        print("SESSION_RESULT " + json.dumps(summary, ensure_ascii=False), flush=True)


async def run(args):
    counts = {"attempted": 0, "connected": 0}
    try:
        async with httpx.AsyncClient(timeout=5) as http:
            response = await http.get(status_url(args.url))
            response.raise_for_status()
            status = response.json()
        if not status.get("stream_enabled"):
            print("Streaming disabled. Set GNANI_STREAM_ENABLED=on, GNANI_MOCK=false and restart Agent. No sessions opened.")
            return 1
        if status.get("stream_model") != "prisma-v3.0":
            print("Agent is not configured for Prisma v3.0; no sessions opened.")
            return 1
        pcm = load_pcm(args.wav)
        print(f"PCM: {len(pcm)} bytes, {len(pcm) / (RATE * 2):.3f}s, 16000 Hz mono signed PCM16-LE")
        success = True
        for index in range(1, args.max_sessions + 1):
            overrides = {name: getattr(args, name) for name in
                         ("vad_min_silence_ms", "vad_threshold", "idle_timeout_s")
                         if getattr(args, name) is not None}
            if not await run_session(args.url, pcm, index, counts, overrides):
                success = False
                break  # Fail closed: do not spend another session after an error.
        passed = success and all(r["speech_end_to_final_s"] is not None and r["speech_end_to_final_s"] <= 2
                                 for r in counts["results"])
        print(f"Verdict: {'PASS' if passed else 'FAIL'} (final <= 2.0 s after last client audio send).")
        return 0 if success else 1  # Latency failure never triggers a retry.
    except Exception as error:
        print(f"Preflight failed ({type(error).__name__}). No streaming retry.")
        return 1
    finally:
        print(f"Agent sessions attempted: {counts['attempted']}; upstream-connected acknowledgements: {counts['connected']}.")
        print("Credits: not reported by the WebSocket protocol; check the Gnani usage dashboard.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="ws://localhost:8001/copilot/voice/stream")
    parser.add_argument("--wav", type=Path, default=AGENT_ROOT / "tools/noise_bench/clean/heat_1051_tanglish.wav")
    parser.add_argument("--max-sessions", type=int, choices=range(0, 3), default=2,
                        help="Hard maximum of 0, 1 or 2 sessions; no retries (default 2)")
    parser.add_argument("--vad-min-silence-ms", type=int, help="Per-session x-min-silence-ms, 100-2000")
    parser.add_argument("--vad-threshold", type=float, help="Per-session x-vad-threshold, 0.0-1.0")
    parser.add_argument("--idle-timeout-s", type=int, help="Per-session x-idle-timeout-sec, 5-900")
    args = parser.parse_args(argv)
    for name, low, high in (("vad_min_silence_ms", 100, 2000), ("vad_threshold", 0, 1), ("idle_timeout_s", 5, 900)):
        value = getattr(args, name)
        if value is not None and (not math.isfinite(value) or not low <= value <= high):
            parser.error(f"--{name.replace('_', '-')} must be between {low} and {high}")
    if args.max_sessions == 0:
        print("Session budget 0: no HTTP or WebSocket connections.")
        return 0
    return asyncio.run(run(args))


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    raise SystemExit(main())
