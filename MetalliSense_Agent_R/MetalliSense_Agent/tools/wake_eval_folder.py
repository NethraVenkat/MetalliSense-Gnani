"""Folder pause-v3 evaluator. Dry run by default; no microphone or model training."""
import argparse
import asyncio
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import time
import uuid
import wave

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from tools.kural_gnani_wake_test import onsets_v2, snippet_v2
from app.copilot.wake_check import WakeChecker
from app.copilot.wake_rules import RULE_V2, payload_fields


def prepare(folder):
    rows = []
    for path in sorted(Path(folder).glob('*.wav')):
        kind = path.name.split('_', 1)[0].lower()
        if kind not in {'wake', 'conf', 'conv'}:
            raise ValueError('Unknown filename label: ' + path.name)
        data = path.read_bytes()
        with wave.open(io.BytesIO(data)) as w:
            if (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getcomptype()) != (1, 2, 16000, 'NONE'):
                raise ValueError('Expected mono PCM16 16000 Hz: ' + path.name)
            frames = w.getnframes()
            pcm = w.readframes(frames)
            if not frames or len(pcm) != frames * 2:
                raise ValueError('Empty or incomplete WAV: ' + path.name)
        rows.append(dict(file=path.name, expected=kind == 'wake', category=kind,
                         sha256=hashlib.sha256(data).hexdigest(), duration=frames / 16000,
                         onsets=onsets_v2(pcm), pcm=pcm))
    if not rows:
        raise ValueError('No labelled WAVs found')
    return rows


async def evaluate(rows, output, *, live=False, max_calls=30, checker=None):
    count = sum(len(row['onsets']) for row in rows)
    if count > max_calls or max_calls < 1:
        raise ValueError('Call plan exceeds explicit ceiling')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    plan = dict(rule=RULE_V2, fields=payload_fields('v3'), live=live,
                planned_calls=count, max_calls=max_calls,
                files=[{k: v for k, v in row.items() if k != 'pcm'} for row in rows])
    (output / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
    checker = checker or WakeChecker()
    results = []
    attempts = 0
    try:
        for row in rows:
            result = dict(file=row['file'], expected=row['expected'], category=row['category'],
                          got=False if live else 'not_run', latency_ms='', calls=0)
            results.append(result)
            for index, onset in enumerate(row['onsets']):
                audio = snippet_v2(row['pcm'], onset)
                (output / (row['file'] + f'.{index:03}.wav')).write_bytes(audio)
                if not live:
                    continue
                # Reserve evidence before a call. Failed/ambiguous calls are never retried.
                attempts += 1
                result['calls'] += 1
                (output / 'attempt.json').write_text(json.dumps(dict(attempts=attempts, file=row['file'], onset=onset)), encoding='utf-8')
                started = time.monotonic()
                try:
                    answer = await checker.check(audio)
                except Exception:
                    result['got'] = 'error'
                    raise
                finally:
                    result['latency_ms'] = round(float(result['latency_ms'] or 0) + (time.monotonic() - started) * 1000, 1)
                result['got'] = result['got'] or bool(answer['wake'])
    finally:
        with (output / 'results.csv').open('w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['file', 'expected', 'category', 'got', 'latency_ms', 'calls'])
            writer.writeheader(); writer.writerows(results)
        totals = dict(actual_attempts=attempts, planned_calls=count, evaluated_files=len(results) if live else 0,
                      correct=sum(r['got'] == r['expected'] for r in results if isinstance(r['got'], bool)),
                      errors=sum(r['got'] == 'error' for r in results), dry_run=not live)
        (output / 'totals.json').write_text(json.dumps(totals, indent=2), encoding='utf-8')
    return totals


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--max-calls', type=int, default=30)
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/local_wake_data' / ('folder-eval-' + uuid.uuid4().hex))
    args = parser.parse_args()
    if args.live:
        # Same existing backend configuration; never echo credentials.
        import app.config
    print(json.dumps(asyncio.run(evaluate(prepare(args.folder), args.output, live=args.live, max_calls=args.max_calls))))
    print((args.output / 'results.csv').read_text(encoding='utf-8'))
    print(args.output)

if __name__ == '__main__':
    main()
