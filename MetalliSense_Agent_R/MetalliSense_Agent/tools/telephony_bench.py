"""Isolated phone tracks for noise_bench; never write to the original 16 kHz track."""
import audioop  # Python 3.11 stdlib: actual G.711 mu-law encode/decode, not a log approximation.
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import wave
from datetime import datetime, timezone

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

PHONE_RATE = 8000
SYNTHETIC = "synthetic_telephony_8k"
REAL = "real_calls"
REAL_FILE = re.compile(r"real_(?P<speaker>[a-z0-9_-]+)_(?P<number>\d{2})\.(?:m4a|wav|mp3|ogg|aac)", re.I)


def _float_mono(audio):
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
        raise ValueError("Empty or invalid audio")
    return audio


def _resample(audio, rate, target):
    divisor = math.gcd(int(rate), target)
    return resample_poly(audio, target // divisor, int(rate) // divisor) if rate != target else audio


def _pcm_wav(pcm, rate=PHONE_RATE):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm)
    return output.getvalue()


def _pcm(audio):
    return np.rint(np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()


def validate_rest_wav(data):
    with wave.open(io.BytesIO(data), "rb") as wav:
        frames = wav.readframes(wav.getnframes())
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (PHONE_RATE, 1, 2):
            raise ValueError("Phone-track upload must be 8 kHz mono 16-bit WAV")
        duration = len(frames) / 2 / PHONE_RATE
    if not 0 < duration <= 30:
        raise ValueError(f"REST clip must be nonempty and at most 30 seconds; got {duration:.3f}s")
    return duration


def phone_band_wav(data):
    """Filter the existing 16 kHz mixture, then 8 kHz and one G.711 mu-law round-trip."""
    rate, values = wavfile.read(io.BytesIO(data))
    audio = _float_mono(values)
    if len(audio) / rate > 30:
        raise ValueError("REST clip exceeds 30 seconds; split it before benchmarking")
    audio = _resample(audio, rate, 16000)
    filtered = sosfilt(butter(4, (300, 3400), btype="bandpass", fs=16000, output="sos"), audio)
    phone = _resample(filtered, 16000, PHONE_RATE)
    peak = np.max(np.abs(phone))
    if peak > .95:
        phone *= .95 / peak
    decoded = audioop.ulaw2lin(audioop.lin2ulaw(_pcm(phone), 2), 2)
    result = _pcm_wav(decoded)
    validate_rest_wav(result)
    return result


def convert_real_call(path):
    """Format conversion only: no synthetic band-pass, companding or added noise."""
    if path.suffix.lower() == ".wav":
        rate, values = wavfile.read(path)
        audio = _float_mono(values)
        if len(audio) / rate > 30:
            raise ValueError("REST clip exceeds 30 seconds; split the recording")
        result = _pcm_wav(_pcm(_resample(audio, rate, PHONE_RATE)))
    else:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise ValueError("ffmpeg is required to decode M4A/MP3/OGG/AAC; add it to PATH")
        decoded = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(path),
            "-vn", "-ar", str(PHONE_RATE), "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=60)
        if decoded.returncode:
            raise ValueError(f"Audio decode failed: {decoded.stderr.decode(errors='replace')[:200]}")
        # ffmpeg's pipe WAV can have unknown length fields; finalize the actual PCM length.
        with wave.open(io.BytesIO(decoded.stdout), "rb") as wav:
            result = _pcm_wav(wav.readframes(wav.getnframes()))
    validate_rest_wav(result)
    return result


def load_real_phrases(root):
    with (root / "phrases.csv").open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not {"file", "expected_text", "expected_intent"}.issubset(reader.fieldnames or []):
            raise ValueError("real_calls/phrases.csv needs file,expected_text,expected_intent")
        phrases = list(reader)
    seen = set()
    for phrase in phrases:
        match = REAL_FILE.fullmatch(phrase["file"])
        if not match or Path(phrase["file"]).name != phrase["file"]:
            raise ValueError(f"Invalid real-call basename: {phrase['file']}")
        if phrase["file"] in seen or not phrase["expected_text"].strip() or not phrase["expected_intent"].strip():
            raise ValueError(f"Duplicate or unlabeled real-call phrase: {phrase['file']}")
        seen.add(phrase["file"])
        phrase["speaker"] = match["speaker"].lower()
    return phrases


def _config(config, track):
    return {**config, "base_url": os.getenv("GNANI_BASE_URL", "https://api.vachana.ai").strip().rstrip("/"),
            "mix_version": 1, "telephony": "8k", "track": track,
            "phone_processing": "butter4-300-3400-resample8k-g711mulaw-v1" if track == SYNTHETIC else "decode-mono-pcm16-8k-v1"}


def _job(bench, phrase, audio, noise, snr, config, cache):
    validate_rest_wav(audio)
    key = bench.cache_key(phrase["file"], noise, snr, config)
    fingerprint = hashlib.sha256(audio + json.dumps(config, sort_keys=True).encode()).hexdigest()
    saved = cache.get(key)
    if not isinstance(saved, dict) or saved.get("fingerprint") != fingerprint:
        saved = None
    return {"phrase": phrase, "audio": audio, "noise": noise, "snr": snr,
            "config": config, "key": key, "fingerprint": fingerprint, "cached": saved}


def plan_phone(bench, phrases, config, cache):
    # Reuse the exact original mixing pipeline before applying phone degradation.
    base, present, noises = bench.plan(bench.BENCH, phrases, {})
    cfg = _config(config, SYNTHETIC)
    jobs = [_job(bench, job["phrase"], phone_band_wav(job["audio"]), job["noise"], job["snr"], cfg, cache) for job in base]
    missing = [p["file"] for p in phrases if not (bench.BENCH / "clean" / p["file"]).is_file()]
    return jobs, missing, []


def plan_real(bench, root, phrases, config, cache):
    jobs, missing, invalid = [], [], []
    cfg = _config(config, REAL)
    for phrase in phrases:
        path = root / phrase["file"]
        if not path.is_file():
            missing.append(phrase["file"])
            continue
        try:
            audio = convert_real_call(path)
            jobs.append(_job(bench, phrase, audio, "none", "real", cfg, cache))
        except (OSError, ValueError, wave.Error, subprocess.SubprocessError) as error:
            invalid.append(f"{phrase['file']}: {error}")
    return jobs, missing, invalid


def _execute(bench, jobs, root, cache, max_calls):
    client = None
    if max_calls and any(job["cached"] is None for job in jobs):
        from app.copilot.gnani_client import get_gnani_client
        client = get_gnani_client()
        if client.mock:
            raise ValueError("Gnani mock mode is enabled; no paid benchmark was run")
    calls, attempts = 0, []
    for index, job in enumerate(jobs, 1):
        result, source = job["cached"], "cache"
        if result is None:
            if calls >= max_calls:
                continue
            replay = root / "mixed" / Path(job["phrase"]["file"]).stem
            replay.mkdir(parents=True, exist_ok=True)
            (replay / f"{Path(job['noise']).stem}_{job['snr']}_8k.wav").write_bytes(job["audio"])
            before = client.stats["stt_calls"]
            try:
                # One attempt per condition: no hidden retry consumes another condition's budget.
                result = client.transcribe(job["audio"], language=None, max_attempts=1)
            except Exception as error:
                result = {"text": "", "success": False, "error": str(error)}
            calls += max(1, client.stats["stt_calls"] - before)
            cache[job["key"]] = {**result, "fingerprint": job["fingerprint"], "config": job["config"],
                                 "at": datetime.now(timezone.utc).isoformat()}
            bench.atomic_json(root / "results_cache.json", cache)
            source = "live"
        attempts.append((job, result, source))
        print(f"[{index}/{len(jobs)}] {job['phrase']['file']} / {job['noise']} / {job['snr']}: {source}", flush=True)
    rows = bench.score_attempts(attempts) if attempts else []
    for row, (job, _, _) in zip(rows, attempts):
        row["track"] = job["config"]["track"]
        if job["config"]["track"] == REAL:
            row["speaker"] = job["phrase"]["speaker"]
    return rows, calls


def _pct(values):
    return f"{sum(values) / len(values):.1%}" if values else "N/A"


def _summary(group):
    words = sum(row["reference_words"] for row in group)
    return {"scored": len(group), "stt_success": _pct([r["success"] for r in group]),
            "wer": sum(r["word_errors"] for r in group) / words if words else "",
            "intent_accuracy": _pct([r["intent_correct"] for r in group]),
            "intent_heat_accuracy": _pct([r["intent_heat_correct"] for r in group])}


def write_real_reports(bench, root, rows, phrases, missing, invalid, calls):
    if any(row.get("track") != REAL or row.get("snr") != "real" for row in rows):
        raise ValueError("Real-call reports reject synthetic or unmarked rows")
    rows = bench.frontend_score(rows) if rows else []
    root.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0]) if rows else ["file", "speaker", "track", "expected_text", "expected_intent", "transcript", "source",
        "success", "wer", "predicted_intent", "predicted_params", "intent_correct", "intent_heat_correct"]
    with (root / "runs.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    lines = ["# REAL phone-call recordings only", "", f"New STT calls: {calls}. No synthetic rows are included.", "",
             "No real-call recordings yet." if not rows else "Each recording is converted to 8 kHz mono PCM; no noise, band-pass or simulated codec is added.", "",
             "| Speaker | Scored / planned | STT success | WER | Intent | Intent + heat |",
             "|---|---:|---:|---:|---:|---:|"]
    speakers = sorted({p["speaker"] for p in phrases})
    summaries = []
    for speaker in [*speakers, "combined real-only"]:
        group = rows if speaker == "combined real-only" else [r for r in rows if r["speaker"] == speaker]
        planned = len(phrases) if speaker == "combined real-only" else sum(p["speaker"] == speaker for p in phrases)
        summary = {"speaker": speaker, "track": REAL, "planned": planned, **_summary(group)}
        summaries.append(summary)
        wer = f"{summary['wer']:.1%}" if summary["wer"] != "" else "N/A"
        lines.append(f"| {speaker} | {len(group)} / {planned} | {summary['stt_success']} | {wer} | {summary['intent_accuracy']} | {summary['intent_heat_accuracy']} |")
    for speaker in speakers:
        lines += ["", f"## Speaker: {speaker}", "", "| Recording | STT success | WER | Intent | Intent + heat |", "|---|---:|---:|---|---|"]
        group = [r for r in rows if r["speaker"] == speaker]
        lines += [f"| {r['file']} | {r['success']} | {r['wer']:.1%} | {r['intent_correct']} | {r['intent_heat_correct']} |" for r in group]
        if not group:
            lines += ["", "No scored recordings for this speaker."]
    lines += ["", "## Missing recordings", "", *[f"- {name}" for name in missing], "", "## Invalid recordings", "", *[f"- {name}" for name in invalid], "",
              "WER uses the same frontend normalization and intent mapper as the other tracks. Missing/unattempted clips are excluded from accuracy denominators; failed STT attempts count as empty/incorrect. No real and synthetic metrics are pooled.", ""]
    (root / "report.md").write_text("\n".join(lines), encoding="utf-8")
    with (root / "report.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summaries[0]))
        writer.writeheader()
        writer.writerows(summaries)


def run_track(bench, args, config):
    real = args.real_calls
    root = bench.BENCH / ("real_calls" if real else "telephony_8k")
    cache_path = root / "results_cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    if not isinstance(cache, dict):
        raise ValueError("Phone-track cache must be a JSON object")
    phrases = load_real_phrases(root) if real else bench.load_phrases(bench.BENCH)
    jobs, missing, invalid = plan_real(bench, root, phrases, config, cache) if real else plan_phone(bench, phrases, config, cache)
    pending = sum(job["cached"] is None for job in jobs)
    print(f"Track: {REAL if real else SYNTHETIC}; upload: 8000 Hz mono 16-bit WAV")
    print(f"STT model: {config['model']}; language: {config['language']}; format: {config['format']}; keyterms: {config['keyterms']}")
    if real and not jobs:
        print("no real-call recordings yet")
    for name in missing:
        print(f"  Missing (skipped): {name}")
    for error in invalid:
        print(f"  Invalid (skipped): {error}")
    print(f"Runnable conditions: {len(jobs)}; cache hits: {len(jobs) - pending}; uncached: {pending}")
    if not real:
        for snr in bench.SNRS:
            print(f"  {snr} dB: {sum(job['snr'] == snr for job in jobs)} conditions")
    print(f"Planned new STT calls: {min(pending, args.max_calls)} (limit {args.max_calls}); deferred: {max(0, pending - args.max_calls)}")
    if args.dry_run:
        print("DRY RUN: 0 STT calls. No client initialized; no audio, reports or cache written.")
        return 0
    rows, calls = _execute(bench, jobs, root, cache, args.max_calls)
    if real:
        write_real_reports(bench, root, rows, phrases, missing, invalid, calls)
    else:
        if any(row.get("track") != SYNTHETIC for row in rows):
            raise ValueError("Synthetic telephony report rejects non-synthetic rows")
        bench.write_reports(root, rows, jobs, len(missing), calls)
        report = (root / "report.md").read_text(encoding="utf-8")
        report = report.replace("# Gnani Prisma noise benchmark", "# SYNTHETIC telephony 8 kHz benchmark", 1)
        report += "\nSynthetic track only: original mixtures -> 300-3400 Hz Butterworth band-pass -> 8 kHz -> one G.711 mu-law encode/decode round-trip. Configured SNR is measured before phone processing. No real-call recordings are included.\n"
        (root / "report.md").write_text(report, encoding="utf-8")
    print(f"Wrote separate reports in {root}. Live STT calls used: {calls}; deferred conditions: {len(jobs) - len(rows)}", flush=True)
    return 0
