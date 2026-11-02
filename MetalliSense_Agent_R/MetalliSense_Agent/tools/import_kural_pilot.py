"""Explicit offline S01_TRAIN import. Never trains, downloads or uploads."""
import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess
import uuid
import wave

ROOT = Path(__file__).resolve().parent / 'local_wake_data'
DEST = ROOT / 'kural-personal-pilot-v1/SPK01/S01_TRAIN'
IDENTITY = ('pilot_id', 'recording_id', 'original_recording_id', 'speaker_id', 'session_id',
            'split', 'kind', 'prompt_id', 'prompt', 'condition', 'echo_playback', 'consent', 'filename')


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def copy_original(source, destination):
    source, destination = Path(source), Path(destination)
    expected = sha(source)
    if destination.exists():
        if sha(destination) != expected:
            raise ValueError('Conflicting destination preserved: ' + str(destination))
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open('rb') as src, destination.open('xb') as dst:
            shutil.copyfileobj(src, dst)
    if sha(destination) != expected or sha(source) != expected:
        raise ValueError('Source/copy changed: ' + str(source))
    return dict(source=str(source), copy=str(destination), source_sha256=expected, copy_sha256=expected)


def wav_info(path):
    with wave.open(str(path), 'rb') as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, 'NONE'):
            raise ValueError('Expected mono PCM16 16000 Hz')
        frames = audio.getnframes()
        if frames <= 0 or len(audio.readframes(frames)) != frames * 2:
            raise ValueError('Empty or incomplete PCM frames')
    return dict(channels=1, bits=16, sample_rate=16000, frames=frames, duration_seconds=frames / 16000)


def inspect(journal, source, session_id='S01_TRAIN', split='train'):
    data = json.loads(Path(journal).read_text(encoding='utf-8'))
    if data.get('pilot_id') != 'kural-personal-pilot-v1':
        raise ValueError('Wrong pilot manifest')
    records = data['records']
    ids = Counter(r.get('recording_id') for r in records)
    filenames = Counter(r.get('filename') for r in records)
    selected, excluded = [], []
    for row in records:
        if (row.get('speaker_id'), row.get('session_id'), row.get('split')) != ('SPK01', session_id, split):
            excluded.append(dict(recording_id=row.get('recording_id'), reason='Not SPK01/' + session_id + '/' + split))
            continue
        issues, files = [], []
        if data.get('collection_type') == 's01_topup_v1':
            tasks = {
                'TP01': ('positives', 'replaces_recording_id', 'aff7301e-74b4-40f4-ab27-fd41140ec8a7'),
                'TN01': ('negatives', 'supplements_recording_id', '5f512dcd-2d0b-4e4e-bc9f-5aded5a1a5be'),
                'TB01': ('background_seconds', None, None),
            }
            task = tasks.get(row.get('prompt_id'))
            if (not task or row.get('kind') != task[0] or
                    row.get('collection_type') != 's01_topup_v1' or
                    not data.get('topup_batch_id') or row.get('topup_batch_id') != data['topup_batch_id'] or
                    not row.get('capture_requirement_met')):
                issues.append('topup_task_or_batch_mismatch')
            if task and task[1] and row.get(task[1]) != task[2]:
                issues.append('topup_relationship_mismatch')
        name = row.get('filename', '')
        if not name or Path(name).name != name or '\\' in name or Path(name).suffix not in ('.webm', '.mp4'):
            issues.append('unsafe_or_unrecognized_filename')
        elif ids[row.get('recording_id')] != 1 or filenames[name] != 1:
            issues.append('duplicate_recording_id_or_filename_in_manifest')
        else:
            audio = source / name
            metadata = source / (Path(name).stem + '.json')
            for file in [audio, metadata]:
                if not file.is_file():
                    issues.append('missing_pair: ' + file.name)
                else:
                    files.append(file)
            if audio.is_file() and not audio.stat().st_size:
                issues.append('empty_original_audio')
            if metadata.is_file():
                try:
                    capture = json.loads(metadata.read_text(encoding='utf-8'))
                    for key in (set(capture) | set(row)) - {'heard_wake_intervals', 'intended_wake_intervals', 'annotation_status'}:
                        if capture.get(key) != row.get(key):
                            issues.append('metadata_mismatch: ' + key)
                except (ValueError, UnicodeError):
                    issues.append('invalid_capture_metadata')
            if not row.get('consent', {}).get('granted') or not row.get('consent', {}).get('at'):
                issues.append('missing_consent')
            if row.get('kind') not in ('positives', 'negatives', 'background_seconds'):
                issues.append('unknown_kind')
        annotations = []
        if name and Path(name).name == name and '\\' not in name:
            annotations = sorted(source.glob(Path(name).stem + '*.annotation*.json'))
        selected.append(dict(record=row, files=files, annotations=annotations, issues=issues))
    return data, selected, excluded


def run(journal, source, destination, converter, runner=subprocess.run, session_id='S01_TRAIN', split='train'):
    journal, source, destination = Path(journal).resolve(), Path(source).resolve(), Path(destination).resolve()
    if (session_id, split) not in [('S01_TRAIN', 'train'), ('S02_VALID', 'validation')]:
        raise ValueError('Only explicit S01 training or S02 validation import is supported; test stays reserved')
    data, selected, excluded = inspect(journal, source, session_id, split)
    # Preflight every destination before copying anything. Never overwrite evidence.
    originals = destination / 'originals'
    all_sources = [journal] + [p for r in selected for p in r['files'] + r['annotations']]
    for file in all_sources:
        target = originals / file.name
        if target.exists() and sha(target) != sha(file):
            raise ValueError('Conflicting destination preserved: ' + str(target))
    evidence = destination / ('validation-' + uuid.uuid4().hex)
    evidence.mkdir(parents=True)
    (evidence / 'wav').mkdir()
    copies = [copy_original(file, originals / file.name) for file in all_sources]
    results = []
    for index, item in enumerate(selected):
        row = item['record']
        result = dict(record=row, issues=list(item['issues']), file_status='not_validated',
                      label_status='pending ground-truth review; prompt is not a verified label',
                      echo_case=bool(row.get('echo_playback')) or row.get('prompt_id') in ('KB09', 'KB10'))
        if not result['issues']:
            wav = evidence / 'wav' / (row['recording_id'] + '.wav')
            # UUID identity is metadata, not trusted filesystem syntax.
            if wav.parent.resolve() != (evidence / 'wav').resolve():
                result['issues'].append('unsafe_recording_id')
            else:
                args = [str(converter), '-nostdin', '-n', '-hide_banner', '-loglevel', 'error',
                        '-i', str(originals / row['filename']), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', str(wav)]
                result['conversion_command'] = args
                try:
                    converted = runner(args, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, check=True)
                    result.update(wav_info(wav))
                    result.update(file_status='valid_audio_pair', wav=str(wav.relative_to(evidence)), wav_sha256=sha(wav),
                                  conversion_returncode=converted.returncode, conversion_stdout=converted.stdout, conversion_stderr=converted.stderr)
                    if data.get('collection_type') == 's01_topup_v1' and row['kind'] == 'background_seconds' and result['duration_seconds'] < 10:
                        result['issues'].append('topup_background_below_10_decoded_seconds')
                except (ValueError, OSError, EOFError, wave.Error, subprocess.SubprocessError) as error:
                    result.update(file_status='decode_or_validation_error', error_type=type(error).__name__, error=str(error))
                    result['conversion_stderr'] = str(getattr(error, 'stderr', ''))
        annotation_candidates = [row]
        for file in item['annotations']:
            try:
                annotation = json.loads(file.read_text(encoding='utf-8'))
                if any(annotation.get(k) != row.get(k) for k in IDENTITY):
                    result['issues'].append('annotation_identity_mismatch: ' + file.name)
                else:
                    annotation_candidates.append(annotation)
            except (ValueError, UnicodeError):
                result['issues'].append('invalid_annotation: ' + file.name)
        annotated = [a for a in annotation_candidates if a.get('heard_wake_intervals') is not None]
        unique = {json.dumps({k: a.get(k) for k in ('heard_wake_intervals', 'intended_wake_intervals', 'annotation_status')}, sort_keys=True) for a in annotated}
        if len(unique) > 1:
            result['issues'].append('conflicting_annotations; none selected')
        elif annotated:
            annotation = annotated[0]
            intervals = annotation['heard_wake_intervals']
            valid = isinstance(intervals, list) and result['file_status'] == 'valid_audio_pair'
            if valid:
                for interval in intervals:
                    try:
                        valid = valid and 0 <= interval['start_seconds'] < interval['end_seconds'] <= result['duration_seconds']
                    except (TypeError, KeyError):
                        valid = False
            if valid:
                result['annotation'] = annotation
                result['label_status'] = 'user annotation present; review required before acceptance'
                if row['kind'] == 'positives' and not intervals:
                    result['issues'].append('prompted_positive_annotated_no_wake')
                if row['kind'] != 'positives' and intervals and not result['echo_case']:
                    result['issues'].append('negative_contains_annotated_wake')
            else:
                result['issues'].append('annotation_intervals_invalid_or_unvalidated')
        results.append(result)
        if (index + 1) % 20 == 0:
            print('Validated', index + 1, 'of', len(selected), flush=True)
    valid = [r for r in results if r['file_status'] == 'valid_audio_pair']
    counts = Counter(r['record']['kind'] for r in valid)
    audio_hashes = Counter(r['wav_sha256'] for r in valid)
    summary = dict(manifest_records=len(data['records']), training_records=len(selected), excluded_records=len(excluded),
                   session_id=session_id, split=split,
                   duplicate_manifest_ids={str(k):v for k,v in Counter(r.get('recording_id') for r in data['records']).items() if v > 1},
                   matched_positives=counts['positives'], target_positives=40 if split=='train' else 20, matched_speech_negatives=counts['negatives'], target_speech_negatives=60 if split=='train' else 30,
                   valid_background_blocks=counts['background_seconds'], decoded_background_seconds=sum(r['duration_seconds'] for r in valid if r['record']['kind'] == 'background_seconds'),
                   target_background_seconds=300, valid_audio_pairs=len(valid), decode_errors=sum(r['file_status'] == 'decode_or_validation_error' for r in results),
                   records_with_issues=sum(bool(r['issues']) for r in results), annotations_present=sum('annotation' in r for r in results),
                   echo_cases=sum(r['echo_case'] for r in results), duplicate_decoded_audio_hashes={h:n for h,n in audio_hashes.items() if n > 1},
                   accepted_ground_truth_labels=0)
    if data.get('collection_type') == 's01_topup_v1':
        summary.update(collection_type='s01_topup_v1', topup_batch_id=data.get('topup_batch_id'),
                       target_positives=1, target_speech_negatives=1, target_background_seconds=10,
                       manifest_complete=data.get('complete', False),
                       relationship_policy='Metadata only; do not automatically delete/exclude originals or merge accepted training data')
    for copy in copies:
        if sha(copy['source']) != copy['source_sha256'] or sha(copy['copy']) != copy['copy_sha256']:
            raise ValueError('Original/copy changed during validation')
    report = dict(source_journal=str(journal), copies=copies, summary=summary, excluded=excluded, results=results,
                  converter=str(converter), converter_sha256=sha(converter), training_runs=0, provider_requests=0)
    (evidence / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    cards = []
    for result in results:
        row = result['record']
        audio = '<audio controls preload="none" src="' + html.escape(result['wav'], quote=True) + '"></audio>' if 'wav' in result else '<p>No validated audio.</p>'
        cards.append('<section><h2>' + html.escape(row['prompt_id'] + ' / ' + row['recording_id']) + '</h2><p>' + html.escape(row['kind'] + ' / ' + row['condition'] + ' / ' + row['prompt']) + '</p><p>' + html.escape(result['file_status'] + ' / ' + result['label_status'] + (' / ECHO: not ordinary wake-free negative' if result['echo_case'] else '')) + '</p><p>' + html.escape('; '.join(result['issues'])) + '</p>' + audio + '</section>')
    (evidence / 'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src \'self\' file:; style-src \'unsafe-inline\'"><title>S01 training collection review</title><style>body{font:16px/1.8 system-ui;max-width:900px;margin:24px auto;padding:16px}section{border:1px solid #ccc;padding:12px;margin:12px 0;overflow-wrap:anywhere}audio{width:100%}h2{font-size:16px}</style><h1>SPK01 / S01_TRAIN — file validation, labels pending</h1><p>No training. Prompt classes do not verify listening labels. Replay every take, annotate wakes and distinguish narration echo. No autoplay or uploads.</p><pre>' + html.escape(json.dumps(summary, indent=2)) + '</pre>' + ''.join(cards), encoding='utf-8')
    if session_id != 'S01_TRAIN':
        page = evidence / 'index.html'
        page.write_text(page.read_text(encoding='utf-8').replace('S01 training collection review', 'S02 validation collection review').replace('SPK01 / S01_TRAIN', 'SPK01 / S02_VALID'), encoding='utf-8')
    print(json.dumps(summary, indent=2), flush=True)
    print('Review:', evidence / 'index.html', flush=True)
    return report, evidence


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--import-collection', action='store_true')
    parser.add_argument('--journal', type=Path)
    parser.add_argument('--source', type=Path, default=Path.home() / 'Downloads')
    parser.add_argument('--session', choices=['S01_TRAIN','S02_VALID'], default='S01_TRAIN')
    args = parser.parse_args()
    if not args.import_collection:
        print('Disabled; no copying, decoding or training.')
    elif not args.journal:
        parser.error('Explicit reviewed --journal required; never guesses between exports')
    else:
        old = json.loads((ROOT / 'smoke-P01-20261102-01/smoke-manifest.json').read_text(encoding='utf-8'))
        converter = Path(old['converter'])
        if sha(converter) != old['converter_sha256']:
            raise ValueError('Existing converter hash mismatch')
        run(args.journal, args.source, DEST.parent / args.session, converter,
            session_id=args.session, split='train' if args.session=='S01_TRAIN' else 'validation')
