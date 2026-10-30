"""Bounded TTS audition: four v3 voices plain/tagged plus the legacy v2.5 voice.

Default: 9 variants, at most 10 HTTP attempts, no retries or hidden fallback.
Run again to reuse successful disk-cached variants with zero new calls.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from dotenv import load_dotenv

AGENT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT))
from app.copilot.gnani_client import GnaniClient, V3_VOICES

OUTPUT = Path(__file__).resolve().parent / "tts_audition"


def hold_sentence():
    result = subprocess.run(["node", str(OUTPUT / "hold_sentence.mjs")],
                            capture_output=True, text=True, encoding="utf-8", timeout=30, check=True)
    return json.loads(result.stdout)["text"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voices", default="Shivani,Kalpana,Avinash,Harshad")
    parser.add_argument("--with-tags", action=argparse.BooleanOptionalAction, default=True,
                        help="Include both plain and tagged v3 variants (default on); --no-with-tags gives plain only")
    parser.add_argument("--max-calls", type=int, default=10)
    args = parser.parse_args(argv)
    if not 0 <= args.max_calls <= 10:
        parser.error("--max-calls must be between 0 and the hard ceiling of 10")
    voices = list(dict.fromkeys(voice.strip() for voice in args.voices.split(",") if voice.strip()))
    if not voices or any(voice not in V3_VOICES for voice in voices):
        parser.error("--voices must contain valid Timbre v3.0 voice names")
    text = hold_sentence()
    load_dotenv(AGENT / ".env", override=False)  # Read only; never edit credentials.
    client = GnaniClient()
    if not client.api_key:
        parser.error("GNANI_API_KEY is missing; no live calls made")
    client.mock = False  # This explicit audition opts into live TTS, independent of app mock mode.
    variants = [("timbre-v3.0", voice, tagged) for voice in voices
                for tagged in ([False, True] if args.with_tags else [False])]
    variants.append(("timbre-v2.5", "Kamakshi", False))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print(f"Fixed app HOLD sentence: {text}")
    print("| File | Voice | Bytes | Source |")
    print("|---|---|---:|---|")
    calls = 0
    failures = 0
    records = []
    for model, voice, tagged in variants:
        client.tts_model, client.tts_voice, client.tts_tags = model, voice, tagged
        before = client.stats["tts_calls"]
        audio = client.synthesize(text, "ta-IN", style="alert", allow_fallback=False,
                                  max_calls=args.max_calls - calls)
        calls += client.stats["tts_calls"] - before
        assert calls <= args.max_calls
        path = OUTPUT / f"{model}_{voice}_{'tags' if tagged else 'plain'}.wav"
        source = client.last_tts_source if audio else "failed"
        if audio:
            path.write_bytes(audio)
        else:
            failures += 1
        record = {"file": path.name, "voice": voice, "model": model, "tags": tagged,
                  "bytes": len(audio or b""), "source": source,
                  "provider": client.last_provider_used, "error": client.last_error if not audio else None}
        records.append(record)
        print(f"| {path.name} | {voice} | {record['bytes']} | {source} |", flush=True)
        if not audio:
            print(f"  {model}/{voice}: {client.last_error}", flush=True)
    (OUTPUT / "audition.json").write_text(json.dumps({"text": text, "live_calls": calls,
        "max_calls": args.max_calls, "variants": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Live TTS calls used: {calls}/{args.max_calls}. STT calls: 0. Failed variants: {failures}.")
    return 1 if failures else 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    raise SystemExit(main())
