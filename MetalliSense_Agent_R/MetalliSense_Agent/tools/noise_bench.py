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
import subprocess
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
sys.path.insert(0, str(AGENT_ROOT))
from app.copilot.gnani_client import get_stt_config, stt_language

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


def cache_key(file, noise, snr, config=None):
    parts = [file, noise, snr]
    if config is not None:
        parts.extend(config[field] for field in ("model", "language", "format"))
    return json.dumps(parts, separators=(",", ":"))


def apply_stt_overrides(args):
    overrides = {}
    for field in ("model", "language", "format"):
        value = getattr(args, f"stt_{field}")
        if value is not None:
            if field == "model" and value in ("v2.5", "prisma-v2.5"):
                value = ""
            if field == "language":
                value = stt_language(value)
            os.environ[f"GNANI_STT_{field.upper()}"] = value
            overrides[field] = value
    return overrides


def plan(root, phrases, cache):
    noise = {p.name: read_audio(p) for p in sorted((root / "noise").glob("*.wav"))}
    clean = {p["file"]: read_audio(root / "clean" / p["file"]) for p in phrases if (root / "clean" / p["file"]).is_file()}
    config = {**get_stt_config(), "base_url": os.getenv("GNANI_BASE_URL", "https://api.vachana.ai").strip().rstrip("/"), "mix_version": 1}
    jobs = []
    for snr in SNRS:
        for phrase in phrases:
            if phrase["file"] not in clean:
                continue
            for name in (["none"] if snr == "clean" else noise):
                audio = mix(clean[phrase["file"]], noise.get(name), snr)
                key = cache_key(phrase["file"], name, snr, config)
                fingerprint = hashlib.sha256(audio + json.dumps(config, sort_keys=True).encode()).hexdigest()
                cached = cache.get(key)
                if not isinstance(cached, dict) or cached.get("fingerprint") != fingerprint:
                    cached = None
                jobs.append({"phrase": phrase, "noise": name, "snr": snr, "audio": audio,
                             "key": key, "fingerprint": fingerprint, "cached": cached, "config": config})
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
            "error": result.get("error", ""),
            "stt_model": job.get("config", {}).get("model", "legacy-unknown"),
            "stt_language": job.get("config", {}).get("language", ""),
            "stt_format": job.get("config", {}).get("format", "")}


def score_intents(root, rows):
    """Use the actual frontend mapper, with no copied intent rules or network calls."""
    completed = subprocess.run(
        ["node", str(root / "score_intents.mjs")], input=json.dumps(rows, ensure_ascii=False),
        capture_output=True, text=True, encoding="utf-8", timeout=30,
    )
    if completed.returncode:
        raise ValueError(completed.stderr.strip() or "Frontend intent scorer failed")
    return json.loads(completed.stdout)


def rescore_saved(root, filters=None):
    """Re-score recorded attempts using CSV reference labels and cached transcripts only."""
    with (root / "runs.csv").open(encoding="utf-8-sig", newline="") as handle:
        records = list(csv.DictReader(handle))
    if not records:
        raise ValueError("runs.csv contains no saved attempts to score")
    cache_path = root / "results_cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    if not isinstance(cache, dict):
        raise ValueError("results_cache.json must contain a JSON object")
    references = {}
    jobs = {}
    for record in records:
        phrase = {field: record[field] for field in ("file", "expected_text", "expected_intent")}
        if phrase["file"] in references and references[phrase["file"]] != phrase:
            raise ValueError(f"Conflicting CSV reference labels: {phrase['file']}")
        references[phrase["file"]] = phrase
        config = {field: record[f"stt_{field}"] for field in ("model", "language", "format")} if record.get("stt_language") else None
        key = cache_key(phrase["file"], record["noise"], record["snr"], config)
        if key in jobs:
            raise ValueError(f"Duplicate saved condition: {key}")
        jobs[key] = {"phrase": phrase, "noise": record["noise"], "snr": record["snr"], "record": record}
        if config is not None:
            jobs[key]["config"] = config
    # Include cached conditions missing from runs.csv, provided independent labels exist.
    for key in cache:
        parts = json.loads(key)
        if len(parts) not in (3, 6):
            raise ValueError(f"Invalid cache key: {key}")
        file, noise, snr = parts[:3]
        if file not in references:
            raise ValueError(f"No CSV reference labels for cached recording: {file}")
        if key not in jobs:
            jobs[key] = {"phrase": references[file], "noise": noise, "snr": snr}
            if len(parts) == 6:
                jobs[key]["config"] = dict(zip(("model", "language", "format"), parts[3:]))
    if filters:
        jobs = {key: job for key, job in jobs.items() if all(job.get("config", {}).get(field) == value for field, value in filters.items())}
    if not jobs:
        raise ValueError("No saved results match the requested STT configuration")
    variants = {tuple(job.get("config", {}).get(field) for field in ("model", "language", "format")) for job in jobs.values()}
    if len(variants) > 1:
        raise ValueError("Multiple STT configurations are cached; select one using --stt-model, --stt-language and --stt-format")
    rows = []
    ordered = sorted(jobs.items(), key=lambda item: (SNRS.index(item[1]["snr"]), item[1]["phrase"]["file"], item[1]["noise"]))
    for key, job in ordered:
        result = cache.get(key)
        source = "cache"
        if result is None:
            saved = job["record"]
            result = {"text": saved["transcript"], "success": saved["success"].lower() == "true", "error": saved.get("error", "")}
            source = "runs.csv"
        rows.append(score(job, result, source))
    write_reports(root, rows, list(jobs.values()), missing=None, calls=0)
    print(f"Re-scored {len(rows)} saved conditions with the real frontend mapper. New STT calls: 0.")
    print("Wrote report.md, report.csv and runs.csv. Transcript cache was not modified.")


def write_reports(root, rows, jobs, missing, calls):
    rows = score_intents(root, rows)
    fields = list(rows[0]) if rows else [
        "file", "noise", "snr", "expected_text", "expected_intent", "source", "success", "transcript",
        "wer", "word_errors", "reference_words", "exact_match", "expected_heat", "actual_heat", "heat_ok",
        "expected_elements", "actual_elements", "elements_ok", "error", "predicted_intent", "predicted_params",
        "intent_correct", "intent_heat_correct", "stt_model", "stt_language", "stt_format",
    ]
    with (root / "runs.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    groups = defaultdict(list)
    for row in rows:
        groups[row["snr"]].append(row)
    lines = ["# Gnani Prisma noise benchmark", "", f"Generated: {datetime.now(timezone.utc).isoformat()}", "",
             f"New STT calls: {calls}. Cached results: {sum(r['source'] == 'cache' for r in rows)}. "
             + (f"Missing recordings: {missing}." if missing is not None else "Re-scored from saved attempts; audio availability was not checked."), "",
             "| SNR (dB) | Scored / planned | STT success | WER | Word accuracy | Exact text | Heat slot | Element slots | Intent correct | Intent + heat correct |",
             "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    if rows:
        lines[4:4] = [f"STT model: {rows[0]['stt_model'] or 'prisma-v2.5 (model omitted)'}. Language: {rows[0]['stt_language'] or 'legacy/unknown'}. Format: {rows[0]['stt_format'] or 'legacy/unknown'}.", ""]
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
            "intent_accuracy": percentage([r["intent_correct"] for r in group]),
            "intent_heat_accuracy": percentage([r["intent_heat_correct"] for r in group]),
        })
        lines.append(f"| {snr} | {len(group)} / {sum(j['snr'] == snr for j in jobs)} | "
                     f"{percentage([r['success'] for r in group])} | {f'{wer:.1%}' if wer is not None else 'N/A'} | "
                     f"{f'{max(0, 1 - wer):.1%}' if wer is not None else 'N/A'} | {percentage([r['exact_match'] for r in group])} | "
                     f"{percentage([r['heat_ok'] for r in group if r['heat_ok'] != ''])} | "
                     f"{percentage([r['elements_ok'] for r in group if r['elements_ok'] != ''])} | "
                     f"{percentage([r['intent_correct'] for r in group])} | {percentage([r['intent_heat_correct'] for r in group])} |")
    lines += ["", "WER is micro-averaged edit distance / reference words; it may exceed 100%. Word accuracy is max(0, 1 - WER).",
              "Failed STT attempts count as empty transcripts; unattempted jobs are excluded from scores and remain visible in planned counts.",
              "Clean is measured once per phrase, not repeated for every noise. SNR uses full-clip RMS including pauses.",
              "Slot scoring normalizes English number words and checks heat digits and element aliases; extra elements do not erase a surviving expected slot.",
              "Intent correct compares the real frontend mapIntent result with expected_intent. Intent + heat correct also requires the expected heat number when present; prompts without a heat use intent correctness alone.",
              "Failed STT attempts count as incorrect for both intent metrics. All scored attempts are included in their denominators.",
              "Element slots remains the original lexical alias metric; frontend aliases such as magnus -> Mn affect intent scoring, not the literal transcript or WER. Intent correctness alone does not guarantee the element or alloy parameter is correct; inspect predicted_params in runs.csv.",
              "For a saved-only re-score, planned counts describe saved conditions, not recordings or unattempted conditions that might exist on disk.",
              "Synthetic noise is a repeatable stress test, not proof of performance in a foundry. See runs.csv for individual outcomes.", ""]
    with (root / "report.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summaries[0]))
        writer.writeheader()
        writer.writerows(summaries)
    (root / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Prepare/validate noise and count calls; never import/call the Gnani client")
    parser.add_argument("--rescore-only", action="store_true", help="Use results_cache.json/runs.csv only; no audio, client initialization or STT calls")
    parser.add_argument("--max-calls", type=int, default=60, help="Maximum new STT attempts per invocation (default: 60)")
    parser.add_argument("--stt-model", choices=("prisma-v3.0", "prisma-v2.5", "v2.5", ""), help="Override model; v2.5 (or empty) omits the model field")
    parser.add_argument("--stt-language", help="Override locale, comma list of up to four locales, or indic-auto")
    parser.add_argument("--stt-format", choices=("verbatim", "transcribe", "codemix", "transliterate"), help="Override STT output format")
    args = parser.parse_args(argv)
    if args.max_calls < 0:
        parser.error("--max-calls must be nonnegative")
    if args.rescore_only:
        if args.dry_run:
            parser.error("Choose --rescore-only or --dry-run")
        rescore_saved(BENCH, apply_stt_overrides(args))
        return 0
    load_dotenv(AGENT_ROOT / ".env", override=False)
    apply_stt_overrides(args)
    config = get_stt_config()
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
    print(f"STT model: {config['model'] or 'prisma-v2.5 (model omitted)'}; language: {config['language']}; format: {config['format']}")
    print(f"Phrases: {len(phrases)}; clean WAVs present: {present}; missing: {len(phrases) - present}; noise WAVs: {noises}")
    for phrase in phrases:
        if not (root / "clean" / phrase["file"]).is_file():
            print(f"  Missing: clean/{phrase['file']}")
    print(f"Full dataset plan when all recordings exist: {len(phrases) * (1 + 4 * noises)} conditions")
    print(f"Runnable conditions: {len(jobs)}; cache hits: {cached}; uncached: {pending}")
    print(f"STT calls this invocation would make: {min(pending, args.max_calls)} (limit {args.max_calls}); deferred: {max(0, pending - args.max_calls)}")
    print("Call estimate excludes retries; retries share the same --max-calls budget.")
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
            before = client.stats["stt_calls"]
            try:
                result = client.transcribe(job["audio"], language=None, max_attempts=min(2, args.max_calls - calls))
            except Exception as error:
                result = {"text": "", "success": False, "error": str(error)}
            calls += max(1, client.stats["stt_calls"] - before)
            cache[job["key"]] = {**result, "fingerprint": job["fingerprint"], "config": job["config"], "at": datetime.now(timezone.utc).isoformat()}
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
