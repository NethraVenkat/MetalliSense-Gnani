"""Synthetic F2 bridge verification. Explicit shared budget, durable cache, no retries.

Eight TTS clips + two STT conditions each = at most 24 calls. Never records people.
Run with --max-calls 24 to permit network; default 0 only reads cached results.
Audio and the attempt journal stay in the ignored TTS cache directory.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.copilot.gnani_client import GnaniClient
from tools.noise_bench import read_audio, mix

PHRASES = [
    ('heat 1053 ka status kya hai', 'hi', 'heat_status', 1053),
    ('1053 hold kyun hai', 'hi', 'gate_reason', 1053),
    ('copper kitna hai heat 1053', 'hi', 'element_value', 1053),
    ('kaun se heat hold par hai', 'hi', 'ask_copilot', None),
    ('melting shuru karo', 'hi', 'blocked', None),
    ('approve karo', 'hi', 'blocked', None),
    ('heat 1053 status enna', 'ta', 'heat_status', 1053),
    ('1053 en hold', 'ta', 'gate_reason', 1053),
]


def score(rows):
    frontend = ROOT.parent.parent / 'MetalliSense_Frontend_R' / 'MetalliSense_Frontend'
    code = """
import { readFileSync } from 'node:fs';
import { mapIntent } from './src/services/voiceIntents.js';
import { pickReplyLanguage } from './src/services/languageBridge.js';
const rows=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(rows.map(row=>{
 const predicted=mapIntent(row.transcript,{langBridge:true});
 const picked=pickReplyLanguage(row.transcript,row.detected_language_code,'ta',true);
 return {...row,picked_reply_language:picked,predicted_intent:predicted.intent,params:predicted.params,
 pass:row.success && picked===row.expected_language && predicted.intent===row.expected_intent
 && (row.expected_heat==null || predicted.params.heatNumber===row.expected_heat)
 && (row.expected_text!=='kaun se heat hold par hai' || predicted.params.bridgeAction==='list_holds')
 && (row.expected_intent!=='element_value' || predicted.params.element==='Cu')};
})));
"""
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', code], cwd=frontend,
        input=json.dumps(rows), text=True, encoding='utf-8', capture_output=True, check=True).stdout)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-calls', type=int, default=0, choices=range(26))
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    # Process-local overrides only; production .env is never edited.
    os.environ.update(LANG_BRIDGE='on', GNANI_STT_LANGUAGE_BRIDGE='ta-IN,hi-IN,en-IN',
                      GNANI_STT_MODEL='prisma-v3.0', GNANI_TTS_MODEL='timbre-v3.0', GNANI_TTS_VOICE='Kalpana')
    client = GnaniClient()
    if args.max_calls and client.mock:
        raise RuntimeError('Live benchmark requires configured non-mock Gnani')
    folder = client.tts_cache_dir / 'f2_hindi_bridge'
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / 'attempts.json'
    saved = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls': 0, 'tts_calls': 0, 'stt_calls': 0, 'attempts': {}, 'rows': []}

    def save():
        temp = journal.with_suffix('.tmp')
        temp.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding='utf-8')
        temp.replace(journal)

    import requests
    original = requests.post
    active = None
    def bounded_post(url, **kwargs):
        if saved['calls'] >= min(args.max_calls, 25):
            raise RuntimeError('F2 hard call budget exhausted')
        saved['calls'] += 1
        saved['tts_calls' if '/tts/' in url else 'stt_calls'] += 1
        saved['attempts'][active] = True
        save()  # Count before sending, including timeouts / interrupted attempts.
        return original(url, **kwargs)
    requests.post = bounded_post
    noise = read_audio(ROOT / 'tools/noise_bench/noise/synthetic_clanks.wav')
    for index, (phrase, lang, intent, heat) in enumerate(PHRASES, 1):
        audio_file = folder / f'{index:02}.wav'
        active = f'tts-{index}'
        if not audio_file.exists() and active not in saved['attempts'] and saved['calls'] < args.max_calls:
            audio = client.synthesize(phrase, lang, allow_fallback=False, max_calls=1)
            if audio:
                audio_file.write_bytes(audio)
        if not audio_file.exists():
            continue
        clean = read_audio(audio_file)
        for snr in ('clean', '0'):
            active = f'stt-{index}-{snr}'
            if active in saved['attempts'] or saved['calls'] >= args.max_calls:
                continue
            if client.mock:
                raise RuntimeError('Live benchmark requires configured non-mock Gnani')
            result = client.transcribe(mix(clean, noise, snr), max_attempts=1)
            saved['rows'].append({'clip': index, 'snr': snr, 'expected_text': phrase,
                'expected_language': lang, 'expected_intent': intent, 'expected_heat': heat,
                'transcript': result['text'], 'detected_language_code': result.get('detected_language_code'),
                'success': result['success']})
            save()
            print(json.dumps({'calls_used': saved['calls'], **score([saved['rows'][-1]])[0]}, ensure_ascii=True), flush=True)
    saved['scored'] = score(saved['rows'])
    save()
    print(json.dumps({'calls': saved['calls'], 'tts_calls': saved['tts_calls'], 'stt_calls': saved['stt_calls'],
                      'passed': sum(r['pass'] for r in saved['scored']), 'scored': len(saved['scored'])}), flush=True)


if __name__ == '__main__':
    main()
