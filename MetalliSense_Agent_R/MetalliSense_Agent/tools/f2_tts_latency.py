"""Six-attempt Tamil/Hindi TTS latency probe; no STT, no voice/model changes.

Each language uses the same eight-token sentence three times, with isolated cold
disk caches per trial. Immediate cache-only repeats cost zero requests.
"""
import io
import json
import sys
import time
import wave
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.copilot.gnani_client import GnaniClient

TEXT = {'ta': 'ஹீட் ஹோல்டில் உள்ளது. தயவு செய்து திரையில் விவரங்களை பார்க்கவும்.',
        'hi': 'हीट होल्ड पर है। कृपया स्क्रीन पर देखें।'}


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    load_dotenv(ROOT / '.env')
    client = GnaniClient()
    if client.mock:
        raise RuntimeError('A configured non-mock client is required')
    folder = client.tts_cache_dir / 'f2_real_mic_latency'
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / 'results.json'
    saved = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls': 0, 'attempts': [], 'rows': []}
    def save():
        temporary = journal.with_suffix('.tmp')
        temporary.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(journal)
    import requests
    original = requests.post
    trial = None
    def post(url, **kwargs):
        if '/tts/' not in url or saved['calls'] >= 6:
            raise RuntimeError('TTS-only six-call budget exhausted')
        saved['calls'] += 1
        saved['attempts'].append(trial)
        save()
        return original(url, **kwargs)
    requests.post = post
    for trial in range(6):
        if trial in saved['attempts']:
            continue
        lang = 'ta' if trial % 2 == 0 else 'hi'
        client.tts_cache_dir = folder / str(trial)
        began = time.perf_counter()
        audio = client.synthesize(TEXT[lang], lang, max_calls=1)
        elapsed = (time.perf_counter() - began) * 1000
        row = {'trial': trial + 1, 'language': lang, 'model': client.tts_model, 'voice': client.tts_voice,
               'tts_ms': round(elapsed, 1), 'source': client.last_tts_source,
               'provider': client.last_provider_used, 'fallback': bool(client.last_tts_fallback_reason), 'success': bool(audio)}
        if audio:
            with wave.open(io.BytesIO(audio), 'rb') as wav:
                row['audio_s'] = round(wav.getnframes() / wav.getframerate(), 2)
            began = time.perf_counter()
            warm = client.synthesize(TEXT[lang], lang, max_calls=0)
            row['cache_ms'] = round((time.perf_counter() - began) * 1000, 1)
            row['cache_source'] = client.last_tts_source
            assert warm == audio
        saved['rows'].append(row)
        save()
        print(json.dumps(row), flush=True)
    print(json.dumps({'live_tts_calls': saved['calls'], 'stt_calls': 0}), flush=True)


if __name__ == '__main__':
    main()
