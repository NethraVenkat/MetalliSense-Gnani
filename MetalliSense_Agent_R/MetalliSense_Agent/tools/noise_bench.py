"""Reproducible, credit-limited Gnani Prisma noise benchmark (no network in dry-run)."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import sys
import wave
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from scipy.io import wavfile
from scipy.signal import resample_poly

AGENT_ROOT = Path(__file__).resolve().parents[1]
BENCH = Path(__file__).resolve().parent / "noise_bench"
RATE = 16000
SNRS = ("clean", "20", "10", "5", "0")
ELEMENTS = {
    "C": ("carbon", "c", "கார்பன்"),
    "Si": ("silicon", "si", "சிலிக்கான்"),
    "Mn": ("manganese", "mn", "மாங்கனீசு"),
    "P": ("phosphorus", "p"),
    "S": ("sulfur", "sulphur", "s"),
}
SMALL = dict(zip(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(),
    range(20),
))
SMALL.update(dict(zip("twenty thirty forty fifty sixty seventy eighty ninety".split(), range(20, 100, 10))))
NUMBER_TOKEN = "(?:" + "|".join(SMALL) + "|hundred|thousand)"
NUMBER_PHRASE = re.compile(r"\b" + NUMBER_TOKEN + r"(?:(?:[\s-]+(?:and[\s-]+)?)" + NUMBER_TOKEN + r")*\b")


def tokens(text):
    """Case/punctuation-insensitive WER; preserve Tamil combining marks."""
    return "".join(c if c.isalnum() or c.isspace() or "\u0300" <= c <= "\u036f" or "\u0b80" <= c <= "\u0bff" else " " for c in text.casefold()).split()


def word_errors(expected, actual):
    reference, hypothesis = tokens(expected), tokens(actual)
    previous = list(range(len(hypothesis) + 1))
    for i, word in enumerate(reference, 1):
        current = [i]
        for j, other in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (word != other)))
        previous = current
    return previous[-1], len(reference)


def number_value(match):
    words = [w for w in re.split(r"[\s-]+", match.group()) if w != "and"]
    if not {"hundred", "thousand"}.intersection(words) and len(words) > 1 and SMALL[words[0]] >= 10 and SMALL[words[1]] >= 20:
        return str(SMALL[words[0]] * 100 + sum(SMALL[w] for w in words[1:]))
    total = group = 0
    for word in words:
        if word == "hundred":
            group = (group or 1) * 100
        elif word == "thousand":
            total += (group or 1) * 1000
            group = 0
        else:
            group += SMALL[word]
    return str(total + group)


def slots(text):
    normalized = NUMBER_PHRASE.sub(number_value, text.casefold())
    heat = re.search(r"\b(?:heat|heath|sheet|hit|hate|eat|heet|he['’]t|h)[\s-]*(\d+)\b", normalized)
    if not heat:
        heat = re.search(r"\b(\d{3,4})\b", normalized)
    words = set(tokens(normalized))
    elements = {element for element, aliases in ELEMENTS.items() if words.intersection(aliases)}
    return str(int(heat[1])) if heat else "", elements


def rms(audio):
    return float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))


def wav_bytes(audio):
    """16-bit mono WAV; caller normalizes peaks before encoding."""
    data = np.rint(np.clip(audio, -1, 1) * 32767).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(data.tobytes())
    return output.getvalue()


def read_audio(path):
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
    if not audio.size or not np.isfinite(audio).all():
        raise ValueError(f"Empty or non-finite audio: {path}")
    if rate != RATE:
        divisor = math.gcd(rate, RATE)
        audio = resample_poly(audio, RATE // divisor, rate // divisor)
    audio -= audio.mean()
    if rms(audio) < 1e-8:
        raise ValueError(f"Silent audio: {path}")
    return audio


def generate_noise(folder):
    folder.mkdir(parents=True, exist_ok=True)
    if list(folder.glob("*.wav")):
        return
    rng = np.random.default_rng(1051)
    length = RATE * 12
    time = np.arange(length) / RATE
    brown = np.cumsum(rng.normal(size=length))
    brown -= brown.mean()
    hum = sum(np.sin(2 * np.pi * hz * time + rng.uniform(0, 2 * np.pi)) / (index + 1)
              for index, hz in enumerate((50, 100, 150, 200, 300, 400, 600)))
    clanks = rng.normal(0, 0.008, length)
    for _ in range(28):
        duration = int(rng.uniform(0.06, 0.4) * RATE)
        start = int(rng.integers(0, length - duration))
        t = np.arange(duration) / RATE
        burst = (np.sin(2 * np.pi * rng.uniform(700, 3200) * t)
                 + 0.5 * rng.normal(size=duration)) * np.exp(-t * rng.uniform(15, 45))
        clanks[start:start + duration] += burst
    for name, audio in (("synthetic_brown", brown), ("synthetic_hum", hum), ("synthetic_clanks", clanks)):
        (folder / f"{name}.wav").write_bytes(wav_bytes(audio / np.max(np.abs(audio)) * 0.8))
    print("Generated 3 replayable synthetic noise WAVs (seed 1051, 12 seconds each).")


def mix(clean, noise, snr):
    if snr == "clean":
        audio = clean.copy()
    else:
        # Deterministic tiling, with equal full-clip RMS used for every condition.
        noise = np.tile(noise, math.ceil(len(clean) / len(noise)))[:len(clean)].copy()
        noise -= noise.mean()
        if rms(noise) < 1e-8:
            raise ValueError("Noise segment is silent")
        audio = clean + noise * (rms(clean) / (rms(noise) * 10 ** (float(snr) / 20)))
    # Scale the entire mixture, preserving SNR rather than clipping its peaks.
    return wav_bytes(audio * min(1, 0.95 / max(np.max(np.abs(audio)), 1e-8)))


def atomic_json(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_phrases(root):
    with (root / "phrases.csv").open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not {"file", "expected_text", "expected_intent"}.issubset(reader.fieldnames or []):
            raise ValueError("phrases.csv needs file,expected_text,expected_intent columns")
        phrases = list(reader)
    seen = set()
    for phrase in phrases:
        name = phrase["file"]
        if not name or Path(name).name != name or not name.lower().endswith(".wav"):
            raise ValueError(f"file must be a WAV basename inside clean/: {name!r}")
        if name in seen or not phrase["expected_text"].strip() or not phrase["expected_intent"].strip():
            raise ValueError(f"Duplicate file or missing expected text/intent: {name}")
        seen.add(name)
    return phrases


def plan(root, phrases, cache):
    noise = {p.name: read_audio(p) for p in sorted((root / "noise").glob("*.wav"))}
    clean = {p["file"]: read_audio(root / "clean" / p["file"]) for p in phrases if (root / "clean" / p["file"]).is_file()}
    config = {"language": os.getenv("GNANI_STT_LANGUAGE", "ta-IN"), "format": os.getenv("GNANI_STT_FORMAT", "transcribe"),
              "base_url": os.getenv("GNANI_BASE_URL", "https://api.vachana.ai"), "mix_version": 1}
    jobs = []
    for snr in SNRS:
        for phrase in phrases:
            if phrase["file"] not in clean:
                continue
            for name in (["none"] if snr == "clean" else noise):
                audio = mix(clean[phrase["file"]], noise.get(name), snr)
                key = json.dumps([phrase["file"], name, snr], separators=(",", ":"))
                fingerprint = hashlib.sha256(audio + json.dumps(config, sort_keys=True).encode()).hexdigest()
                cached = cache.get(key)
                if not isinstance(cached, dict) or cached.get("fingerprint") != fingerprint:
                    cached = None
                jobs.append({"phrase": phrase, "noise": name, "snr": snr, "audio": audio,
                             "key": key, "fingerprint": fingerprint, "cached": cached})
    return jobs, len(clean), len(noise)


def score(job, result, source):
    phrase = job["phrase"]
    expected, expected_elements = slots(phrase["expected_text"])
    actual, actual_elements = slots(result.get("text", ""))
    # A bare "42" still preserves the digits even without a recognized heat prefix.
    if expected and not actual:
        digits = {str(int(value)) for value in re.findall(r"\b\d+\b", NUMBER_PHRASE.sub(number_value, result.get("text", "").casefold()))}
        if expected in digits:
            actual = expected
    errors, count = word_errors(phrase["expected_text"], result.get("text", ""))
    success = bool(result.get("success"))
    return {"file": phrase["file"], "noise": job["noise"], "snr": job["snr"], **phrase,
            "source": source, "success": success, "transcript": result.get("text", ""),
            "wer": errors / max(count, 1), "word_errors": errors, "reference_words": count,
            "exact_match": success and tokens(phrase["expected_text"]) == tokens(result.get("text", "")),
            "expected_heat": expected, "actual_heat": actual,
            "heat_ok": success and expected == actual if expected else "",
            "expected_elements": " ".join(sorted(expected_elements)), "actual_elements": " ".join(sorted(actual_elements)),
            "elements_ok": success and expected_elements.issubset(actual_elements) if expected_elements else "",
            "error": result.get("error", "")}


def write_reports(root, rows, jobs, missing, calls):
    fields = list(rows[0]) if rows else [
        "file", "noise", "snr", "expected_text", "expected_intent", "source", "success", "transcript",
        "wer", "word_errors", "reference_words", "exact_match", "expected_heat", "actual_heat", "heat_ok",
        "expected_elements", "actual_elements", "elements_ok", "error",
    ]
    with (root / "runs.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    groups = defaultdict(list)
    for row in rows:
        groups[row["snr"]].append(row)
    lines = ["# Gnani Prisma noise benchmark", "", f"Generated: {datetime.now(timezone.utc).isoformat()}", "",
             f"New STT calls: {calls}. Cached results: {sum(r['source'] == 'cache' for r in rows)}. Missing recordings: {missing}.", "",
             "| SNR (dB) | Scored / planned | STT success | WER | Word accuracy | Exact text | Heat slot | Element slots |",
             "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
    def percentage(values):
        return f"{sum(values) / len(values):.1%}" if values else "N/A"
    summaries = []
    for snr in SNRS:
        group = groups[snr]
        words = sum(r["reference_words"] for r in group)
        wer = sum(r["word_errors"] for r in group) / words if words else None
        summaries.append({
            "snr": snr, "scored": len(group), "planned": sum(j["snr"] == snr for j in jobs),
            "stt_success": percentage([r["success"] for r in group]),
            "wer": wer if wer is not None else "",
            "word_accuracy": max(0, 1 - wer) if wer is not None else "",
            "exact_text_accuracy": percentage([r["exact_match"] for r in group]),
            "heat_slot_accuracy": percentage([r["heat_ok"] for r in group if r["heat_ok"] != ""]),
            "element_slot_accuracy": percentage([r["elements_ok"] for r in group if r["elements_ok"] != ""]),
        })
        lines.append(f"| {snr} | {len(group)} / {sum(j['snr'] == snr for j in jobs)} | "
                     f"{percentage([r['success'] for r in group])} | {f'{wer:.1%}' if wer is not None else 'N/A'} | "
                     f"{f'{max(0, 1 - wer):.1%}' if wer is not None else 'N/A'} | {percentage([r['exact_match'] for r in group])} | "
                     f"{percentage([r['heat_ok'] for r in group if r['heat_ok'] != ''])} | "
                     f"{percentage([r['elements_ok'] for r in group if r['elements_ok'] != ''])} |")
    lines += ["", "WER is micro-averaged edit distance / reference words; it may exceed 100%. Word accuracy is max(0, 1 - WER).",
              "Failed STT attempts count as empty transcripts; unattempted jobs are excluded from scores and remain visible in planned counts.",
              "Clean is measured once per phrase, not repeated for every noise. SNR uses full-clip RMS including pauses.",
              "Slot scoring normalizes English number words and checks heat digits and element aliases; extra elements do not erase a surviving expected slot.",
              "expected_intent is a dataset label, not measured intent accuracy. No frontend intent mapper is invoked.",
              "Synthetic noise is a repeatable stress test, not proof of performance in a foundry. See runs.csv for individual outcomes.", ""]
    with (root / "report.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summaries[0]))
        writer.writeheader()
        writer.writerows(summaries)
    (root / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Prepare/validate noise and count calls; never import/call the Gnani client")
    parser.add_argument("--max-calls", type=int, default=60, help="Maximum new STT attempts per invocation (default: 60)")
    args = parser.parse_args(argv)
    if args.max_calls < 0:
        parser.error("--max-calls must be nonnegative")
    load_dotenv(AGENT_ROOT / ".env", override=False)
    root = BENCH
    phrases = load_phrases(root)
    cache_path = root / "results_cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    if not isinstance(cache, dict):
        raise ValueError("results_cache.json must contain a JSON object")
    generate_noise(root / "noise")
    jobs, present, noises = plan(root, phrases, cache)
    cached = sum(j["cached"] is not None for j in jobs)
    pending = len(jobs) - cached
    print(f"STT language: {os.getenv('GNANI_STT_LANGUAGE', 'ta-IN')} (backend environment; no override)")
    print(f"Phrases: {len(phrases)}; clean WAVs present: {present}; missing: {len(phrases) - present}; noise WAVs: {noises}")
    for phrase in phrases:
        if not (root / "clean" / phrase["file"]).is_file():
            print(f"  Missing: clean/{phrase['file']}")
    print(f"Full dataset plan when all recordings exist: {len(phrases) * (1 + 4 * noises)} conditions")
    print(f"Runnable conditions: {len(jobs)}; cache hits: {cached}; uncached: {pending}")
    print(f"STT calls this invocation would make: {min(pending, args.max_calls)} (limit {args.max_calls}); deferred: {max(0, pending - args.max_calls)}")
    if args.dry_run:
        print("DRY RUN: 0 STT calls made. No client initialized; no mixtures, cache, or reports written.")
        return 0
    if not jobs:
        print("No recordings to benchmark. Add the listed WAV files and rerun.")
        return 1
    client = None
    if pending and args.max_calls:
        sys.path.insert(0, str(AGENT_ROOT))
        from app.copilot.gnani_client import get_gnani_client
        client = get_gnani_client()
        if client.mock:
            raise ValueError("Gnani is in mock mode. Configure GNANI_API_KEY and GNANI_MOCK=false; use --dry-run to plan without credits.")
    calls = 0
    rows = []
    for index, job in enumerate(jobs, 1):
        result = job["cached"]
        source = "cache"
        if result is None:
            if calls >= args.max_calls:
                continue
            mixed = root / "mixed" / Path(job["phrase"]["file"]).stem
            mixed.mkdir(parents=True, exist_ok=True)
            (mixed / f"{Path(job['noise']).stem}_{job['snr']}dB.wav").write_bytes(job["audio"])
            calls += 1  # Count every attempt, including failures; never auto-retry.
            try:
                result = client.transcribe(job["audio"], language=None)
            except Exception as error:
                result = {"text": "", "success": False, "error": str(error)}
            cache[job["key"]] = {**result, "fingerprint": job["fingerprint"], "at": datetime.now(timezone.utc).isoformat()}
            atomic_json(cache_path, cache)  # Save after each attempt, even a provider failure.
            source = "live"
        rows.append(score(job, result, source))
        print(f"[{index}/{len(jobs)}] {job['phrase']['file']} / {job['noise']} / {job['snr']} dB: {source}")
    write_reports(root, rows, jobs, len(phrases) - present, calls)
    print(f"Wrote report.csv, report.md and runs.csv. New STT calls: {calls}; deferred conditions: {len(jobs) - len(rows)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, csv.Error) as error:
        print(f"Noise bench error: {error}", file=sys.stderr)
        raise SystemExit(2)
