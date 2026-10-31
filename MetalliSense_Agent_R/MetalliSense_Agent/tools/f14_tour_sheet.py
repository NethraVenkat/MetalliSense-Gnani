"""F14 v4 pronunciation sheet: diagnostic first, sequential, cache-first, 70 calls."""
import argparse
import html
import json
import logging
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-calls", type=int, choices=range(71), default=0)
    args = parser.parse_args()
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
