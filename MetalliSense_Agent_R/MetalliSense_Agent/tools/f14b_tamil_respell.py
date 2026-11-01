"""F14b Tamil A/B/C audition. Default cache-only; opt in with --max-calls 60."""
import argparse
import html
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
WORDS = [
    ("டாஷ்போர்டு", "dashboard", "டேஷ் போர்டு"),
    ("ஸ்பெக்ட்ரோ மீட்டர்", "spectrometer", "ஸ்பெக்ட்ராமீட்டர்"),
    ("கிரேடு ஸ்பெக்ஸ்", "grade specs", "க்ரேட் ஸ்பெக்ஸ்"),
    ("சப்ளையர் ஸ்கோர் கார்டு", "supplier scorecard", "சப்ளையர் ஸ்கோர்கார்ட்"),
    ("ரா மெட்டீரியல் ஸ்டாக்", "raw material stock", "ரா மெடீரியல் ஸ்டாக்"),
    ("யார்டு இன்ஸ்பெக்ஷன்", "yard inspection", "யார்ட் இன்ஸ்பெக்ஷன்"),
    ("ப்ரீ மெல்ட் கேட்", "pre-melt gate", "ப்ரீமெல்ட் கேட்"),
    ("ஷிஃப்ட் ஹேண்டோவர்", "shift handover", "ஷிஃப்ட் ஹேண்ட் ஓவர்"),
    ("காம்போசிஷன் டிவியேஷன்", "composition deviation", "கம்பொசிஷன் டீவியேஷன்"),
    ("மெல்ட் கரெக்ஷன் பிளானர்", "melt correction planner", "மெல்ட் கரக்ஷன் ப்ளானர்"),
    ("அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர்", "adaptive strategy optimizer", "அடாப்டிவ் ஸ்ட்ராட்டஜி ஆப்டிமைஸர்"),
    ("ஃபுல் அனாலிசிஸ்", "full analysis", "ஃபுல் அனாலிஸிஸ்"),
    ("மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ்", "mechanical properties", "மெக்கானிக்கல் ப்ராபர்டீஸ்"),
    ("சேல்ஸ் அண்ட் டிஸ்பேட்ச்", "sales and dispatch", "சேல்ஸ் அண்ட் டிஸ்பாட்ச்"),
    ("இன்வென்டரி ஃபோர்காஸ்ட்", "inventory forecast", "இன்வெண்டரி ஃபோர்கேஸ்ட்"),
    ("காஸ்ட் அனாலிசிஸ்", "cost analysis", "காஸ்ட் அனாலிஸிஸ்"),
    ("சிந்தெடிக் டேட்டா", "synthetic data", "சின்தடிக் டேட்டா"),
    ("ட்ரெயினிங் டேட்டா", "training data", "ட்ரெய்னிங் டேட்டா"),
    ("செமான்டிக் சர்ச்", "semantic search", "சிமாண்டிக் சர்ச்"),
    ("எலிமென்ட்", "element", "எலிமெண்ட்"),
]


def variants():
    return [{"id": f"{n:02d}_{label}", "word": words[0], "variant": label,
             "spelling": spelling, "text": f"இது {spelling}. இங்கே பாக்கலாம்."}
            for n, words in enumerate(WORDS, 1)
            for label, spelling in zip("ABC", words)]


def render_sheet(folder, saved):
    rows = []
    for n, words in enumerate(WORDS, 1):
        cells = []
        for item in variants()[(n-1)*3:n*3]:
            row = saved["rows"].get(item["id"], {})
            ready = row.get("success") and row.get("text") == item["text"] and (folder / (item["id"] + ".wav")).exists()
            player = f'<audio controls preload="none" src="{item["id"]}.wav"></audio>' if ready else '<p>Audio pending</p>'
            cells.append(f'<td lang="ta"><b>{item["variant"]}: {html.escape(item["spelling"])}</b><p>{html.escape(item["text"])}</p>{player}</td>')
        rows.append(f'<tr><th>{n}. {html.escape(words[0])}</th>{"".join(cells)}<td><select aria-label="Choice for word {n}"><option>Choose</option><option>A</option><option>B</option><option>C</option></select></td></tr>')
    index = folder / "index.html"
    index.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>F14b Tamil respelling audition</title><style>body{font:16px sans-serif}td,th{padding:12px;border:1px solid #ccc;vertical-align:top}td{min-width:280px}p{line-height:1.7}</style><h1>F14b Tamil respelling audition</h1><p>Kalpana v3.0; ta-IN; default speed; no tags. A: current Tamil, B: English, C: alternate Tamil. Choices are review notes only; nothing is applied to the tour automatically.</p><table><thead><tr><th>Word</th><th>A</th><th>B</th><th>C</th><th>Team choice</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></html>', encoding="utf-8")
    return index


def run(client, folder, max_calls=0, *, post=None, clock=time.time, sleep=time.sleep):
    """Injectable transport/time make the budget and socket guard testable offline."""
    import requests
    if not 0 <= max_calls <= 60:
        raise ValueError("max_calls must be between 0 and 60")
    if (client.tts_model, client.tts_voice, client.tts_speed, client.tts_tags) != ("timbre-v3.0", "Kalpana", None, False):
        raise ValueError("Requires Kalpana v3.0, default speed, no tags")
    if client.mock:
        raise ValueError("Audition requires production configuration; mock silence is not pronunciation audio")
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / "results.json"
    saved = json.loads(journal.read_text(encoding="utf-8")) if journal.exists() else {"calls": 0, "rows": {}}
    items = variants()
    saved["script"] = items
    def save():
        journal.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
    save()
    transport = post or requests.post
    diagnostic = {}
    def guarded(url, **kwargs):
        nonlocal diagnostic
        if url != client.base_url + "/api/v1/tts/inference" or saved["calls"] >= max_calls:
            raise ValueError("F14b TTS-only cumulative 60-call budget exhausted")
        if saved.get("last_start") is not None:
            sleep(max(0, 1.1 - (clock() - saved["last_start"])))
        saved["last_start"] = clock()
        saved["calls"] += 1
        save()  # Reserve before HTTP; failures consume budget too.
        diagnostic = {"status": None, "error": None}
        try:
            response = transport(url, **kwargs)
            diagnostic["status"] = response.status_code
            if response.status_code != 200:
                diagnostic["error"] = response.text[:300]
            return response
        except Exception as error:
            diagnostic["error"] = type(error).__name__ + ": " + str(error)
            raise
    def record(item, audio, source):
        if audio:
            (folder / (item["id"] + ".wav")).write_bytes(audio)
        saved["rows"][item["id"]] = {**item, "success": bool(audio), "source": source,
            "status": diagnostic.get("status") if source == "live" else None,
            "error": (diagnostic.get("error") or client.last_error) if source == "live" and not audio else None}
        save()
    with patch("requests.post", guarded):
        # The diagnostic is also variant 01_A, so a cold sheet fits 60 calls.
        if max_calls and "test" not in saved:
            item = items[0]
            normal_cache = client.tts_cache_dir
            client.tts_cache_dir = folder / "diagnostic"
            try:
                audio = client.synthesize(item["text"], "ta-IN", allow_fallback=False, max_calls=1)
            finally:
                client.tts_cache_dir = normal_cache
            record(item, audio, "live")
            saved["test"] = saved["rows"][item["id"]]
            if audio:
                cache = client._cache_path(item["text"], "ta-IN", client.tts_voice)
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_bytes(audio)
            save()
        failed = "test" in saved and not saved["test"]["success"]
        if not failed:
            for item in items:
                prior = saved["rows"].get(item["id"], {})
                if prior.get("success") and prior.get("text") == item["text"] and (folder / (item["id"] + ".wav")).exists():
                    continue
                audio = client.synthesize(item["text"], "ta-IN", allow_fallback=False, max_calls=0)
                source = "cache"
                if not audio and saved.get("test", {}).get("success") and saved["calls"] < max_calls and prior.get("source") != "live":
                    source = "live"
                    audio = client.synthesize(item["text"], "ta-IN", allow_fallback=False, max_calls=1)
                record(item, audio, source)
                if source == "live" and not audio:
                    break  # No automatic retries after any live failure.
    index = render_sheet(folder, saved)
    print("Index: " + str(index.resolve()), flush=True)
    print(json.dumps({"tts_calls": saved["calls"], "stt_calls": 0, "ready": sum(row["success"] for row in saved["rows"].values()), "expected": 60}), flush=True)
    failures = [row for row in saved["rows"].values() if row["source"] == "live" and not row["success"]]
    if failures:
        error = failures[0]
        prefix = "NETWORK/SOCKET ERROR (no HTTP response)" if error["status"] is None else f'HTTP {error["status"]}'
        print(f'STOP: {prefix}: {error["error"]}', flush=True)
        return 2
    return 0


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-calls", type=int, choices=range(61), default=0)
    args = parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    from app.copilot.gnani_client import GnaniClient, _env_bool
    if _env_bool("GNANI_TTS_CLARITY"):
        raise ValueError("Audition needs the unchanged production Agent clarity-off setting")
    return run(GnaniClient(), ROOT / "app/data/tts_cache/f14b_respell", args.max_calls)


if __name__ == "__main__":
    raise SystemExit(main())
