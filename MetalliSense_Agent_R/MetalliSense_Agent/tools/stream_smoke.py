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


async def run_session(url, pcm, index, counts):
    began = time.perf_counter()
    metrics = {"first_partial": None, "first_processing": None, "first_final": None}
    finals, audio_started = [], None
    counts["attempted"] += 1
    print(f"\nSession {index}: connecting to Agent", flush=True)
    try:
        async with asyncio.timeout(TIME_LIMIT):
            async with connect(url, origin=ORIGIN, open_timeout=10, close_timeout=1,
                               compression=None, max_size=65536) as socket:
                await socket.send(json.dumps({"type": "start", "sample_rate": RATE}))
                async with asyncio.timeout(10):
                    event = json.loads(await socket.recv())
                if event.get("type") != "connected":
                    print(f"Agent refused stream: {event.get('code', 'unknown')}", flush=True)
                    return False
                counts["connected"] += 1
                audio_started = time.perf_counter()

                async def send():
                    for offset in range(0, len(pcm), FRAME_BYTES):
                        frame = pcm[offset:offset + FRAME_BYTES]
                        await socket.send(frame)
                        await asyncio.sleep(len(frame) / (RATE * 2))
                    await socket.send(json.dumps({"type": "stop"}))

                async def receive():
                    failed = False
                    while True:
                        message = json.loads(await socket.recv())
                        elapsed = time.perf_counter() - audio_started
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
                            print(f"[{elapsed:.3f}s] final: {text} ({message.get('detected_language_code', 'unknown')})", flush=True)
                        elif kind == "error":
                            failed = True
                            print(f"[{elapsed:.3f}s] error: {message.get('code', 'unknown')}", flush=True)
                        elif kind == "closed":
                            return bool(finals) and not failed

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
        print("Hard stop: session exceeded 60 seconds.", flush=True)
        return False
    except Exception as error:
        # Do not print handshake details from third-party exception objects.
        print(f"Session failed ({type(error).__name__}); no retry.", flush=True)
        return False
    finally:
        for label, value in metrics.items():
            suffix = "N/A (no provisional text)" if label == "first_partial" else "N/A"
            print(f"  {label}: {value:.3f}s" if value is not None else f"  {label}: {suffix}", flush=True)
        print(f"  total: {time.perf_counter() - began:.3f}s", flush=True)


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
            if not await run_session(args.url, pcm, index, counts):
                success = False
                break  # Fail closed: do not spend another session after an error.
        return 0 if success else 1
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
    args = parser.parse_args(argv)
    if args.max_sessions == 0:
        print("Session budget 0: no HTTP or WebSocket connections.")
        return 0
    return asyncio.run(run(args))


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    raise SystemExit(main())
