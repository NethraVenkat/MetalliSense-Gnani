"""F14 v4 pronunciation sheet: diagnostic first, sequential, cache-first, 70 calls."""
import argparse
import hashlib
import html
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from io import BytesIO

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SELECTIVE_MAX_CALLS = 19


def _sha256(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def text_fingerprint(clip_id, language, display_text, spoken_text):
    payload = {"clip_id": clip_id, "language": language,
        "display_text": display_text, "intended_spoken_text": spoken_text}
    return _sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def validate_selective_selection(journal, selected_ids, current_steps):
    """Validate the entire explicit selection against both journal and live script."""
    if not selected_ids:
        raise ValueError("select at least one explicit Tamil clip ID")
    if len(selected_ids) != len(set(selected_ids)):
        raise ValueError("duplicate clip IDs are not allowed")
    if len(selected_ids) > SELECTIVE_MAX_CALLS:
        raise ValueError(f"selection cannot exceed {SELECTIVE_MAX_CALLS} clip IDs")
    if journal.get("mode") != "offline_metadata_only" or not isinstance(journal.get("items"), list):
        raise ValueError("selection source is not an offline respell journal")
    journal_items = {item.get("clip_id"): item for item in journal["items"]}
    current = {}
    for step in current_steps:
        clip_id = f"{step['number']:02d}_{step['id']}_ta"
        if step.get("spoken_text") != step.get("display_text"):
            current[clip_id] = step
    selected = []
    for clip_id in selected_ids:
        item = journal_items.get(clip_id)
        if not item:
            raise ValueError(f"clip ID is not an affected item in the selected journal: {clip_id}")
        if item.get("language") != "ta" or not clip_id.endswith("_ta"):
            raise ValueError(f"only journaled Tamil clips are eligible: {clip_id}")
        step = current.get(clip_id)
        if not step:
            raise ValueError(f"journal item is no longer an affected current Tamil clip: {clip_id}")
        if (item.get("display_text") != step["display_text"] or
                item.get("intended_spoken_text") != step["spoken_text"]):
            raise ValueError(f"journal text is outdated for clip: {clip_id}")
        fingerprint = text_fingerprint(clip_id, "ta", step["display_text"], step["spoken_text"])
        if item.get("text_fingerprint") not in (None, fingerprint):
            raise ValueError(f"journal text fingerprint is outdated for clip: {clip_id}")
        selected.append({"clip_id": clip_id, "number": step["number"], "step_id": step["id"],
            "language": "ta", "display_text": step["display_text"],
            "intended_spoken_text": step["spoken_text"], "text_fingerprint": fingerprint})
    return selected


def _valid_audio(data, sample_rate):
    try:
        with wave.open(BytesIO(data), "rb") as wav:
            return (wav.getnframes() > 0 and wav.getnchannels() == 1 and
                    wav.getsampwidth() == 2 and wav.getframerate() == sample_rate)
    except (wave.Error, EOFError, OSError):
        return False


def _tts_settings(client, item, to_gnani_language, tts_text, clarity_enabled=False):
    language = to_gnani_language("ta", client.tts_language)
    final_text = tts_text(item["intended_spoken_text"], client.tts_model, "normal", client.tts_tags)
    settings = {"model": client.tts_model, "voice": client.tts_voice, "language": language,
        "sample_rate": client.tts_sample_rate, "speed": client.tts_speed,
        "tags": client.tts_tags, "clarity": bool(clarity_enabled), "style": "normal", "fallback": False,
        "text": final_text}
    settings_fingerprint = _sha256(json.dumps(settings, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    cache_path = client._cache_path(final_text, language, client.tts_voice, "normal", model=client.tts_model)
    cache_audio = None
    cache_compatible = (client.tts_model, client.tts_voice, language, client.tts_speed,
        client.tts_tags, client.tts_sample_rate, bool(clarity_enabled)) == (
        "timbre-v3.0", "Kalpana", "ta-IN", None, False, 22050, False)
    if cache_compatible and cache_path.is_file():
        try:
            candidate = cache_path.read_bytes()
            if _valid_audio(candidate, client.tts_sample_rate):
                cache_audio = candidate
        except OSError:
            pass
    return settings, settings_fingerprint, cache_path, cache_audio


def _read_selective_state(path):
    if not path.exists():
        return {"schema_version": 1, "mode": "selective_tamil_repair", "runs": [], "attempts": []}
    state = json.loads(path.read_text(encoding="utf-8"))
    if state.get("mode") != "selective_tamil_repair" or not isinstance(state.get("runs"), list) or not isinstance(state.get("attempts"), list):
        raise ValueError("selective provenance journal has an unsupported format")
    return state


def _write_json_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def build_selective_plan(selected, client, target_folder, provenance_path,
                         to_gnani_language, tts_text, clarity_enabled=False):
    state = _read_selective_state(provenance_path)
    plan = []
    for item in selected:
        settings, settings_fp, cache_path, cache_audio = _tts_settings(client, item, to_gnani_language, tts_text, clarity_enabled)
        target = Path(target_folder) / f"{item['clip_id']}.wav"
        target_hash = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
        target_valid = False
        if target_hash:
            try:
                target_valid = _valid_audio(target.read_bytes(), client.tts_sample_rate)
            except OSError:
                pass
        completed = any(attempt.get("clip_id") == item["clip_id"] and attempt.get("success") is True and
            attempt.get("text_fingerprint") == item["text_fingerprint"] and
            attempt.get("settings_fingerprint") == settings_fp and attempt.get("target_sha256") == target_hash and target_valid
            for attempt in reversed(state["attempts"]))
        status = "already_completed" if completed else "cache_hit" if cache_audio else "request_required"
        plan.append({**item, "settings": settings, "settings_fingerprint": settings_fp,
            "cache_path": str(cache_path), "cache_hit": bool(cache_audio),
            "_cache_audio": cache_audio,
            "cache_sha256": hashlib.sha256(cache_audio).hexdigest() if cache_audio else None,
            "target_path": str(target), "target_sha256": target_hash, "status": status})
    return plan, state


def _safe_error(client, exc=None):
    if exc is not None:
        return type(exc).__name__
    error = str(getattr(client, "last_error", "") or "")
    if "budget exhausted" in error.lower():
        return "TTS call budget exhausted"
    if "timeout" in error.lower():
        return "TTS timeout"
    if "connection_error" in error.lower() or "connection error" in error.lower():
        return "TTS connection error"
    if "non-wav" in error.lower() or "invalid wav" in error.lower():
        return "Invalid TTS audio"
    import re
    status = re.search(r"TTS\s+(\d{3})", error)
    return f"TTS provider error (HTTP {status.group(1)})" if status else "TTS provider error"


def _install_audio_atomically(target, audio, folder, item):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=target.stem + ".", suffix=".tmp", dir=target.parent)
    backup = None
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(audio)
            stream.flush()
            os.fsync(stream.fileno())
        if not _valid_audio(Path(temporary).read_bytes(), item["settings"]["sample_rate"]):
            raise ValueError("new audio failed WAV validation")
        if target.is_file():
            old = target.read_bytes()
            old_hash = hashlib.sha256(old).hexdigest()
            recovery = Path(folder) / "recovery"
            recovery.mkdir(parents=True, exist_ok=True)
            backup = recovery / f"{item['clip_id']}.{old_hash}.wav"
            if not backup.exists():
                fd2, temp_backup = tempfile.mkstemp(prefix=backup.name + ".", suffix=".tmp", dir=recovery)
                try:
                    with os.fdopen(fd2, "wb") as stream:
                        stream.write(old)
                        stream.flush()
                        os.fsync(stream.fileno())
                    os.replace(temp_backup, backup)
                finally:
                    if os.path.exists(temp_backup): os.unlink(temp_backup)
        os.replace(temporary, target)
        return backup
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def _install_cache_atomically(target, audio, folder, item):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(audio).digest():
        return None
    backup = None
    if target.is_file():
        previous = target.read_bytes()
        recovery = Path(folder) / "recovery"
        recovery.mkdir(parents=True, exist_ok=True)
        backup = recovery / f"{item['clip_id']}.cache.{hashlib.sha256(previous).hexdigest()}.wav"
        if not backup.exists():
            fd_backup, temp_backup = tempfile.mkstemp(prefix=backup.name + ".", suffix=".tmp", dir=recovery)
            try:
                with os.fdopen(fd_backup, "wb") as stream:
                    stream.write(previous)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temp_backup, backup)
            finally:
                if os.path.exists(temp_backup): os.unlink(temp_backup)
    fd, temporary = tempfile.mkstemp(prefix=target.name + ".", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(audio)
            stream.flush()
            os.fsync(stream.fileno())
        if not _valid_audio(Path(temporary).read_bytes(), item["settings"]["sample_rate"]):
            raise ValueError("new cache audio failed WAV validation")
        os.replace(temporary, target)
        return backup
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def run_selective(plan, state, client, target_folder, provenance_path, *, max_calls=SELECTIVE_MAX_CALLS,
                  live=False, sleep=time.sleep, clock=time.monotonic):
    if not 1 <= max_calls <= SELECTIVE_MAX_CALLS:
        raise ValueError(f"max_calls must be between 1 and {SELECTIVE_MAX_CALLS}")
    if live and getattr(client, "mock", False):
        raise ValueError("live mode requires a non-mock TTS client")
    calls_used = 0
    run_record = {"selection": [item["clip_id"] for item in plan],
        "text_fingerprints": {item["clip_id"]: item["text_fingerprint"] for item in plan},
        "settings_fingerprints": {item["clip_id"]: item["settings_fingerprint"] for item in plan},
        "status": "dry_run" if not live else "running", "completed": [], "remaining": [item["clip_id"] for item in plan],
        "requests_used": 0, "max_requests": max_calls}
    if not live:
        return {"run": run_record, "cache_hits": sum(i["cache_hit"] for i in plan),
            "required_requests": sum(i["status"] == "request_required" for i in plan),
            "network_calls": 0, "tts_calls": 0}
    state["runs"].append(run_record)
    _write_json_atomic(Path(provenance_path), state)
    last_request = None
    for index, item in enumerate(plan):
        if item["status"] == "already_completed":
            run_record["completed"].append(item["clip_id"])
            run_record["remaining"] = run_record["remaining"][1:]
            _write_json_atomic(Path(provenance_path), state)
            continue
        audio = item.get("_cache_audio")
        source = "cache" if audio else None
        if audio is None:
            if calls_used >= max_calls:
                run_record["status"] = "stopped_call_limit"
                break
            if last_request is not None:
                sleep(max(0, 1.1 - (clock() - last_request)))
            before = client.stats["tts_calls"]
            actual = 0
            last_request = clock()
            _write_json_atomic(Path(provenance_path), state)
            staging = tempfile.mkdtemp(prefix=f".f14-{item['clip_id']}-", dir=target_folder)
            original_cache_dir = client.tts_cache_dir
            try:
                client.tts_cache_dir = Path(staging)
                audio = client.synthesize(item["intended_spoken_text"], "ta", allow_fallback=False, max_calls=1)
                actual = client.stats["tts_calls"] - before
                calls_used += actual
                run_record["requests_used"] = calls_used
                if actual > 1:
                    raise RuntimeError("client exceeded one-request per clip limit")
                if actual == 0:
                    # A matching cache may have appeared between plan and run.
                    source = "cache"
                else:
                    source = "live"
            except Exception as exc:
                calls_used += max(0, client.stats["tts_calls"] - before - actual)
                run_record["requests_used"] = calls_used
                error = _safe_error(client, exc)
                state["attempts"].append({"clip_id": item["clip_id"], "success": False,
                    "source": "live", "error": error, "text_fingerprint": item["text_fingerprint"],
                    "settings_fingerprint": item["settings_fingerprint"]})
                run_record["status"] = "stopped_provider_error"
                run_record["error_clip"] = item["clip_id"]
                run_record["remaining"] = [entry["clip_id"] for entry in plan[index:]]
                _write_json_atomic(Path(provenance_path), state)
                break
            finally:
                client.tts_cache_dir = original_cache_dir
                shutil.rmtree(staging, ignore_errors=True)
            if not audio:
                error = _safe_error(client)
                state["attempts"].append({"clip_id": item["clip_id"], "success": False,
                    "source": source or "live", "error": error, "text_fingerprint": item["text_fingerprint"],
                    "settings_fingerprint": item["settings_fingerprint"]})
                run_record["status"] = "stopped_provider_error"
                run_record["error_clip"] = item["clip_id"]
                run_record["remaining"] = [entry["clip_id"] for entry in plan[index:]]
                _write_json_atomic(Path(provenance_path), state)
                break
        if not _valid_audio(audio, item["settings"]["sample_rate"]):
            state["attempts"].append({"clip_id": item["clip_id"], "success": False,
                "source": source or "live", "error": "Invalid TTS audio", "text_fingerprint": item["text_fingerprint"],
                "settings_fingerprint": item["settings_fingerprint"]})
            run_record["status"] = "stopped_invalid_audio"
            run_record["error_clip"] = item["clip_id"]
            run_record["remaining"] = [entry["clip_id"] for entry in plan[index:]]
            _write_json_atomic(Path(provenance_path), state)
            break
        target = Path(item["target_path"])
        try:
            cache_backup = _install_cache_atomically(item["cache_path"], audio, target_folder, item) if source == "live" else None
            backup = _install_audio_atomically(target, audio, target_folder, item)
        except Exception as exc:
            state["attempts"].append({"clip_id": item["clip_id"], "success": False,
                "source": source, "error": _safe_error(client, exc), "text_fingerprint": item["text_fingerprint"],
                "settings_fingerprint": item["settings_fingerprint"]})
            run_record["status"] = "stopped_install_error"
            run_record["error_clip"] = item["clip_id"]
            run_record["remaining"] = [entry["clip_id"] for entry in plan[index:]]
            _write_json_atomic(Path(provenance_path), state)
            break
        target_bytes = target.read_bytes()
        attempt = {"clip_id": item["clip_id"], "success": True, "source": source,
            "text_fingerprint": item["text_fingerprint"], "settings_fingerprint": item["settings_fingerprint"],
            "target_sha256": hashlib.sha256(target_bytes).hexdigest(), "target_path": str(target),
            "cache_path": item["cache_path"], "cache_recovery_path": str(cache_backup) if cache_backup else None,
            "recovery_path": str(backup) if backup else None}
        state["attempts"].append(attempt)
        run_record["completed"].append(item["clip_id"])
        run_record["remaining"] = [entry["clip_id"] for entry in plan[index + 1:]]
        _write_json_atomic(Path(provenance_path), state)
    else:
        run_record["status"] = "complete"
    run_record["requests_used"] = calls_used
    if run_record["status"] == "running":
        run_record["status"] = "stopped_call_limit"
    _write_json_atomic(Path(provenance_path), state)
    return {"run": run_record, "cache_hits": sum(i["cache_hit"] for i in plan),
        "required_requests": sum(i["status"] == "request_required" for i in plan),
        "network_calls": calls_used, "tts_calls": calls_used}


def offline_respell_journal(folder, steps, manifest_paths=None):
    """Write a new metadata-only report; never opens a TTS client or WAV for writing."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    if manifest_paths is None:
        manifest_paths = [folder / name for name in
            ("results-v4.json", "results-v3.json", "results.json")]
    manifests = []
    for path in manifest_paths:
        path = Path(path)
        if not path.is_file():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data.get("rows", [])
        if isinstance(rows, dict):
            rows = [dict(value, id=value.get("id", key)) for key, value in rows.items()]
        manifests.append({"name": path.name, "calls": data.get("calls"),
            "rows": {row["id"]: row for row in rows if row.get("id")}})

    items = []
    for step in steps:
        base_text = step.get("display_text", step.get("texts", {}).get("ta", ""))
        spoken_text = step.get("spoken_text", base_text)
        if spoken_text == base_text:
            continue
        clip_id = f"{step['number']:02d}_{step['id']}_ta"
        audio_path = folder / f"{clip_id}.wav"
        provenance = None
        latest_attempt = None
        for manifest in manifests:  # caller passes newest journal first
            row = manifest["rows"].get(clip_id)
            if row and latest_attempt is None:
                latest_attempt = {"journal": manifest["name"], "text": row.get("text"),
                    "source": row.get("source"), "success": row.get("success"),
                    "status": row.get("status"), "error": row.get("error")}
            if row and row.get("success") is True:
                provenance = {"journal": manifest["name"], "text": row.get("text"),
                    "source": row.get("source"), "success": True}
                break
        present = audio_path.is_file()
        if not present:
            status = "missing"
        elif provenance and provenance["text"] == spoken_text:
            status = "existing"
        else:
            status = "stale"
        items.append({"clip_id": clip_id, "language": "ta",
            "display_text": base_text, "intended_spoken_text": spoken_text,
            "text_fingerprint": text_fingerprint(clip_id, "ta", base_text, spoken_text),
            "audio_path": str(audio_path), "audio_present": present,
            "audio_sha256": hashlib.sha256(audio_path.read_bytes()).hexdigest() if present else None,
            "status": status, "regeneration_status": "not_regenerated",
            "latest_success_provenance": provenance,
            "latest_attempt_provenance": latest_attempt,
            "evidence": "A matching success row plus the named file is classified existing; a file without matching success metadata is stale; absent file is missing."})
    journal = {"schema_version": 1, "mode": "offline_metadata_only",
        "network_calls": 0, "tts_calls": 0, "audio_files_modified": 0,
        "affected_count": len(items), "counts": {key: sum(i["status"] == key for i in items)
            for key in ("existing", "missing", "stale")},
        "source_journals": [{"name": m["name"], "calls": m["calls"]} for m in manifests],
        "items": items}
    destination = folder / "offline-respell-journal.json"
    suffix = 2
    while destination.exists():
        destination = folder / f"offline-respell-journal-{suffix:02d}.json"
        suffix += 1
    destination.write_text(json.dumps(journal, ensure_ascii=False, indent=2), encoding="utf-8")
    return destination, journal


def load_tour_script(frontend):
    source = """
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const {voiceTourSteps,tourStepText,tourSpokenText}=await vite.ssrLoadModule('/src/services/voiceTour.js');
const steps=voiceTourSteps(true).map((step,n)=>({number:n+1,id:step.id,display_text:tourStepText(step,'ta'),spoken_text:tourSpokenText(step,'ta'),texts:{ta:tourStepText(step,'ta')}}));
console.log('OFFLINE_SCRIPT:'+JSON.stringify(steps));await vite.close();process.exit(0);
"""
    output = subprocess.check_output(["node", "--input-type=module"], input=source.encode(), cwd=frontend).decode("utf-8")
    return json.loads(next(line[len("OFFLINE_SCRIPT:"):] for line in output.splitlines()
        if line.startswith("OFFLINE_SCRIPT:")))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-calls", type=int, choices=range(SELECTIVE_MAX_CALLS + 1), default=SELECTIVE_MAX_CALLS,
        help="hard cap for an explicitly selected repair (maximum 19 provider requests)")
    parser.add_argument("--offline-journal", action="store_true",
        help="write an offline spoken-text/audio-provenance journal; never initializes TTS")
    parser.add_argument("--select-journal", type=Path,
        help="offline-respell journal that authorizes an explicit clip selection")
    parser.add_argument("--select-id", action="append", default=[],
        help="Tamil clip ID from --select-journal; repeat for each exact ID")
    parser.add_argument("--live", action="store_true",
        help="allow TTS requests for the explicit selection; default is dry-run")
    args = parser.parse_args()
    if args.offline_journal:
        if args.select_journal or args.select_id or args.live:
            parser.error("--offline-journal cannot be combined with selection or --live")
        folder = ROOT / "app/data/tts_cache/f14_tour_sheet"
        frontend = ROOT.parent.parent / "MetalliSense_Frontend_R/MetalliSense_Frontend"
        destination, journal = offline_respell_journal(folder,
            load_tour_script(frontend), [folder / name for name in
                ("results-v4.json", "results-v3.json", "results.json")])
        print("Offline journal: " + str(destination.resolve()), flush=True)
        print(json.dumps({"network_calls": 0, "tts_calls": 0,
            "affected": journal["affected_count"], **journal["counts"]}, ensure_ascii=False), flush=True)
        return 0
    selection_requested = bool(args.select_journal or args.select_id)
    if selection_requested:
        if not args.select_journal or not args.select_id:
            parser.error("selective repair requires both --select-journal and one or more --select-id values")
        try:
            source_journal = json.loads(args.select_journal.read_text(encoding="utf-8"))
            frontend = ROOT.parent.parent / "MetalliSense_Frontend_R/MetalliSense_Frontend"
            current_steps = load_tour_script(frontend)
            selected = validate_selective_selection(source_journal, args.select_id, current_steps)
        except (OSError, json.JSONDecodeError, ValueError) as error:
            parser.error(str(error))
        if args.live and args.max_calls < 1:
            parser.error("live repair requires --max-calls between 1 and 19")
        # Selection and current-script validation finish before configuration or TTS client setup.
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        logging.disable(logging.CRITICAL)
        from app.copilot.gnani_client import GnaniClient, _env_bool, to_gnani_language, tts_text
        client = GnaniClient()
        clarity = _env_bool("GNANI_TTS_CLARITY")
        if args.live and (client.mock or
                (client.tts_model, client.tts_voice, client.tts_speed, client.tts_tags,
                 client.tts_language, client.tts_sample_rate, clarity) !=
                ("timbre-v3.0", "Kalpana", None, False, "ta-IN", 22050, False)):
            parser.error("live repair requires non-mock Kalpana v3.0, ta-IN, 22050 Hz, default speed, no tags/clarity")
        folder = ROOT / "app/data/tts_cache/f14_tour_sheet"
        provenance = folder / "results-selective.json"
        plan, state = build_selective_plan(selected, client, folder, provenance,
            to_gnani_language, tts_text, clarity)
        summary = {"mode": "live" if args.live else "dry_run", "journal": str(args.select_journal),
            "selection": [{"clip_id": row["clip_id"], "status": row["status"],
                "text_fingerprint": row["text_fingerprint"], "settings_fingerprint": row["settings_fingerprint"],
                "cache_sha256": row["cache_sha256"]} for row in plan],
            "cache_hits": sum(row["cache_hit"] for row in plan),
            "already_completed": sum(row["status"] == "already_completed" for row in plan),
            "required_requests": sum(row["status"] == "request_required" for row in plan),
            "request_limit": args.max_calls}
        if not args.live:
            summary.update({"network_calls": 0, "tts_calls": 0,
                "provenance_journal": str(provenance), "written": False})
            print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
            return 0
        result = run_selective(plan, state, client, folder, provenance, max_calls=args.max_calls, live=True)
        summary.update(result)
        summary["provenance_journal"] = str(provenance)
        print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
        return 0 if result["run"]["status"] == "complete" else 2
    if args.live:
        parser.error("live TTS is disabled without an explicit --select-journal and --select-id selection")
    # Legacy whole-sheet path remains cache-only. It cannot make provider calls.
    args.max_calls = 0
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    logging.disable(logging.CRITICAL)
    from app.copilot.gnani_client import GnaniClient, _env_bool, to_gnani_language, tts_text
    client = GnaniClient()
    if (client.tts_model, client.tts_voice, client.tts_speed, client.tts_tags, _env_bool("GNANI_TTS_CLARITY")) != ("timbre-v3.0", "Kalpana", None, False, False):
        raise ValueError("Requires unchanged Kalpana v3.0, default speed, no tags/Agent clarity")
    folder = ROOT / "app/data/tts_cache/f14_tour_sheet"
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / "results-v4.json"
    saved = json.loads(journal.read_text(encoding="utf-8")) if journal.exists() else {"version": 4, "calls": 0, "rows": []}
    def save():
        journal.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
    frontend = ROOT.parent.parent / "MetalliSense_Frontend_R/MetalliSense_Frontend"
    source = """
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const {voiceTourSteps,tourSpokenText}=await vite.ssrLoadModule('/src/services/voiceTour.js');
const steps=voiceTourSteps(true);
console.log('SHEET:'+JSON.stringify(steps.map((step,n)=>({id:step.id,number:n+1,name:step.displayName,route:step.route,texts:Object.fromEntries(['ta','hi','en'].map(lang=>[lang,tourSpokenText(step,lang)]))}))));
await vite.close();process.exit(0);
"""
    output = subprocess.check_output(["node", "--input-type=module"], input=source.encode(), cwd=frontend).decode("utf-8")
    steps = json.loads(next(line[6:] for line in output.splitlines() if line.startswith("SHEET:")))
    saved["script"] = steps
    save()
    import requests
    original = requests.post
    last_call = None
    diagnostic = {}
    def guarded(url, **kwargs):
        nonlocal last_call, diagnostic
        if url != client.base_url + "/api/v1/tts/inference" or saved["calls"] >= min(args.max_calls, 70):
            raise ValueError("F14 v4 TTS-only call budget exhausted")
        if last_call is not None:
            time.sleep(max(0, 1.1 - (time.monotonic() - last_call)))
        saved["calls"] += 1
        save()
        last_call = time.monotonic()
        diagnostic = {"status": None, "error": None}
        try:
            response = original(url, **kwargs)
            diagnostic["status"] = response.status_code
            if response.status_code != 200:
                diagnostic["error"] = response.text[:300]
            return response
        except Exception as error:
            diagnostic["error"] = type(error).__name__ + ": " + str(error)
            raise
    requests.post = guarded
    def record(step, lang, text, audio, source):
        key = f"{step['number']:02d}_{step['id']}_{lang}"
        if audio:
            (folder / (key + ".wav")).write_bytes(audio)
        row = {"id": key, "text": text, "lang": lang, "success": bool(audio), "source": source,
               "status": diagnostic.get("status") if source == "live" else None,
               "error": (diagnostic.get("error") or client.last_error) if not audio else None}
        saved["rows"] = [old for old in saved["rows"] if old["id"] != key] + [row]
        save()
        print(json.dumps(row, ensure_ascii=False), flush=True)
        return row
    # One real diagnostic request, including on a fully warm cache. It is also
    # the first sheet clip and counts against this new version's 70-call ceiling.
    if "test" not in saved and args.max_calls:
        if client.mock:
            raise ValueError("Diagnostic requires production non-mock configuration")
        step = steps[0]
        text = step["texts"]["ta"]
        normal_cache = client.tts_cache_dir
        client.tts_cache_dir = folder / "diagnostic-v4"
        try:
            audio = client.synthesize(text, "ta", allow_fallback=False, max_calls=1)
        finally:
            client.tts_cache_dir = normal_cache
        row = record(step, "ta", text, audio, "live")
        saved["test"] = row
        if audio:
            cache = client._cache_path(tts_text(text, client.tts_model, "normal", client.tts_tags), to_gnani_language("ta", client.tts_language), client.tts_voice)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(audio)
        save()
    failed_test = "test" in saved and not saved["test"]["success"]
    if not failed_test:
        for step in steps:
            for lang, text in step["texts"].items():
                key = f"{step['number']:02d}_{step['id']}_{lang}"
                existing = next((row for row in saved["rows"] if row["id"] == key), {})
                if existing.get("success") and existing.get("text") == text and (folder / (key + ".wav")).exists():
                    continue
                audio = client.synthesize(text, lang, allow_fallback=False, max_calls=0)
                source = "cache"
                if not audio and saved.get("test", {}).get("success") and saved["calls"] < args.max_calls and existing.get("source") != "live":
                    source = "live"
                    audio = client.synthesize(text, lang, allow_fallback=False, max_calls=1)
                record(step, lang, text, audio, source)
                # Do not repeat failed requests automatically.
                if source == "live" and not audio:
                    break
            else:
                continue
            break
    rows = []
    for step in steps:
        cells = []
        for lang, text in step["texts"].items():
            key = f"{step['number']:02d}_{step['id']}_{lang}"
            valid = any(row['id'] == key and row['text'] == text and row['success'] for row in saved['rows'])
            player = f'<audio controls preload="none" src="{key}.wav"></audio>' if valid else '<b>Unavailable: v4 audio pending</b>'
            cells.append(f'<td lang="{lang}"><p>{html.escape(text)}</p>{player}</td>')
        rows.append(f"<tr><th>{step['number']}. {html.escape(step['name'])}</th>{''.join(cells)}<td><input aria-label=\"Team OK or fix for step {step['number']}\"></td></tr>")
    index = folder / "index.html"
    index.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>F14 v4 pronunciation</title><style>body{font:16px sans-serif}td,th{padding:12px;border:1px solid #ccc;vertical-align:top}td{min-width:300px}p{line-height:1.7}</style><h1>F14 v4 pronunciation review</h1><p>Verbatim team script. Handover enabled. Kalpana v3.0, default speed, no tags.</p><table><thead><tr><th>Step</th><th>Tamil</th><th>Hindi</th><th>English</th><th>Team OK / fix</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></html>', encoding="utf-8")
    print("Index: " + str(index.resolve()), flush=True)
    print(json.dumps({"tts_calls": saved["calls"], "stt_calls": 0, "ready": sum(row["success"] for row in saved["rows"]), "expected": len(steps)*3}), flush=True)
    if failed_test:
        if saved['test'].get('status') is None:
            print("NETWORK/SOCKET ERROR: no HTTP response. Check network permissions before retrying outside the sandbox.", flush=True)
        print("STOP: first diagnostic failed: " + json.dumps(saved["test"], ensure_ascii=False), flush=True)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
