"""Full-sentence ID audition only. Sequential, cache-first, nine attempts maximum."""
import argparse
import html
import json
import logging
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-calls', type=int, choices=range(10), default=0)
    args = parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
    logging.disable(logging.CRITICAL)
    from app.copilot.gnani_client import GnaniClient, _env_bool
    client = GnaniClient()
    if (client.tts_model, client.tts_voice, client.tts_speed, client.tts_tags,
            _env_bool('GNANI_TTS_CLARITY')) != ('timbre-v3.0', 'Kalpana', None, False, False):
        raise ValueError('Current production Kalpana v3.0 / default-speed / no-tags settings required')
    if client.mock:
        raise ValueError('Non-mock configuration required')
    previous = json.loads((ROOT / 'app/data/tts_cache/f11d_final/results.json').read_text(encoding='utf-8'))
    originals = {row['lang']: row['text'] for row in previous['rows'] if row['name'].endswith('hold_reason')}
    variants = [
        ('V1', 'ta', 'ஒன், ஜீரோ, ஃபைவ், த்ரீ'),
        ('V2', 'ta', 'one zero five three'),
        ('V3', 'ta', 'டென் ஃபிஃப்டி த்ரீ'),
        ('V4', 'ta', '1053'),
        ('V5', 'ta', 'ஆயிரத்து ஐம்பத்தி மூணு'),
        ('H1', 'hi', 'वन, ज़ीरो, फाइव, थ्री'),
        ('H2', 'hi', 'one zero five three'),
        ('H3', 'hi', '1053'),
        ('H4', 'hi', 'एक हज़ार तिरपन'),
    ]
    original_ids = {'ta': 'ஒன் ஜீரோ ஃபைவ் த்ரீ', 'hi': 'वन ज़ीरो फाइव थ्री'}
    folder = ROOT / 'app/data/tts_cache/f11d_ids'
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / 'results.json'
    saved = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls': 0, 'attempted': [], 'rows': []}

    def save():
        journal.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding='utf-8')

    import requests
    original_post = requests.post

    def guarded(url, **kwargs):
        if url != client.base_url + '/api/v1/tts/inference' or saved['calls'] >= min(args.max_calls, 9):
            raise ValueError('Nine-call TTS-only budget exhausted')
        saved['calls'] += 1
        save()
        return original_post(url, **kwargs)

    requests.post = guarded
    for name, lang, id_text in variants:
        source = originals[lang]
        if source.count(original_ids[lang]) != 2:
            raise ValueError('Expected exactly two ID phrases; refusing to alter other text')
        text = source.replace(original_ids[lang], id_text)
        path = folder / f'{name}_{lang}.wav'
        if name in saved['attempted'] or path.exists():
            continue
        audio = client.synthesize(text, lang, allow_fallback=False, max_calls=0)
        if not audio and saved['calls'] < args.max_calls:
            saved['attempted'].append(name)
            save()
            audio = client.synthesize(text, lang, allow_fallback=False, max_calls=1)
        if audio:
            path.write_bytes(audio)
        saved['rows'].append({'name': name, 'lang': lang, 'text': text, 'file': path.name, 'success': bool(audio)})
        save()
        print(f'{name}: {"ready" if audio else "unavailable"}', flush=True)

    cells = []
    for name, lang, id_text in variants:
        text = originals[lang].replace(original_ids[lang], id_text)
        file = f'{name}_{lang}.wav'
        player = f'<audio controls preload="none" src="{file}"></audio>' if (folder / file).exists() else '<p>Unavailable</p>'
        cells.append(f'<td><h2>{name} ({lang})</h2><p>{html.escape(text)}</p>{player}</td>')
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><title>F11d full-sentence ID audition</title><style>body{font:16px sans-serif;margin:24px}td{min-width:330px;padding:16px;vertical-align:top;border:1px solid #ccc}p{line-height:1.7}</style><h1>F11d: full-sentence ID audition</h1><p>Kalpana v3.0, default speed, no tags. Only the two ID phrases vary. Listening candidates only.</p><table><tbody><tr>' + ''.join(cells) + '</tr></tbody></table></html>'
    index = folder / 'index.html'
    index.write_text(page, encoding='utf-8')
    print(f'Index: {index.resolve()}', flush=True)
    print(json.dumps({'tts_calls': saved['calls'], 'stt_calls': 0, 'ready': sum((folder / f'{name}_{lang}.wav').exists() for name, lang, _ in variants)}), flush=True)


if __name__ == '__main__':
    main()
