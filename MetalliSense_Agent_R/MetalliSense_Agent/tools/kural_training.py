"""Default-off offline personal CNN pilot. Data gates precede every training launch."""
import argparse
from array import array
import base64
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time
import uuid
import wave

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS / 'local_wake_data/kural-cnn-v1'
CONFIG = TOOLS / 'kural_training_config.json'
OVERLAY = TOOLS / 'local_wake_data/kural-personal-pilot-v1/SPK01/S01_TRAIN/review-overlay-49e087ab681b48ae820b096ad84baa88/review-overlay.json'
EXCLUDED = 'aff7301e-74b4-40f4-ab27-fd41140ec8a7'
PINS = {'tensorflow': '2.20.0', 'keras': '3.11.3', 'numpy': '2.2.6'}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        for data in iter(lambda: source.read(1048576), b''):
            h.update(data)
    return h.hexdigest()


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_new(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    if path.exists():
        if read(path) != value:
            raise ValueError('Existing evidence differs; preserved: ' + str(path))
        return
    with path.open('x', encoding='utf-8') as output:
        output.write(text)


def atomic_json(path, value):
    path = Path(path)
    pending = path.with_name(path.name + '.' + uuid.uuid4().hex + '.pending')
    pending.write_text(json.dumps(value, indent=2), encoding='utf-8')
    os.replace(pending, path)


def pcm_info(path):
    with wave.open(str(path), 'rb') as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getcomptype()) != (1, 2, 16000, 'NONE'):
            raise ValueError('Requires complete mono PCM16/16000 WAV: ' + str(path))
        frames = source.getnframes()
        data = source.readframes(frames)
        if not frames or len(data) != frames * 2:
            raise ValueError('Empty/truncated audio: ' + str(path))
    return dict(frames=frames, duration_seconds=frames / 16000, pcm_sha256=hashlib.sha256(data).hexdigest())


def prepare_s01(root=ROOT, overlay_path=OVERLAY):
    """Translate the explicit user overlay into immutable, hash-bound input metadata."""
    overlay = read(overlay_path)
    sources = overlay['source_validation_reports']
    reports = [read(p) for p in sources if Path(p).suffix == '.json' and 'validation-' in str(p)]
    report_rows = {r['record']['recording_id']:r for report in reports for r in report['results']}
    for path, expected in sources.items():
        if digest(path) != expected:
            raise ValueError('Overlay source hash mismatch: ' + str(path))
    entries, excluded = [], []
    for entry in overlay['entries']:
        row = report_rows[entry['recording_id']]['record']
        candidates = [Path(p) for p, h in sources.items() if h == entry['wav_sha256'] and Path(p).suffix == '.wav' and Path(p).stem == entry['recording_id']]
        if len(candidates) != 1:
            raise ValueError('Ambiguous reviewed WAV')
        wav = candidates[0]
        info = pcm_info(wav)
        if entry['excluded_from_training'] or entry['recording_id'] == EXCLUDED:
            excluded.append(entry['recording_id'])
            continue
        entries.append(dict(recording_id=entry['recording_id'], original_recording_id=entry['original_recording_id'],
            speaker_id=entry['speaker_id'], session_id=entry['session_id'], split=entry['split'],
            kind=entry['kind'], echo_case=entry['echo_case'], consent=entry['consent'],
            content_approved=entry['usable_after_content_review'], review_source=entry['review_source'],
            wav=str(wav), wav_sha256=digest(wav), **info))
    manifest = dict(schema_version=1, session_id='S01_TRAIN', split='train', speaker_id='SPK01',
                    source_overlay=str(Path(overlay_path).resolve()), source_overlay_sha256=digest(overlay_path),
                    excluded_recording_ids=excluded, entries=entries)
    write_new(Path(root) / 'datasets/S01_TRAIN.json', manifest)
    return manifest


def prepare_s02(report_path, root=ROOT):
    report = read(report_path)
    entries = []
    for item in report['results']:
        row = item['record']
        if (row['speaker_id'], row['session_id'], row['split']) != ('SPK01', 'S02_VALID', 'validation'):
            raise ValueError('S02 input must be separately recorded SPK01/S02_VALID/validation')
        if item['file_status'] != 'valid_audio_pair' or item['issues']:
            raise ValueError('Resolve S02 file issues first')
        wav = (Path(report_path).resolve().parent / item['wav']).resolve()
        if digest(wav) != item['wav_sha256']:
            raise ValueError('S02 hash mismatch')
        entries.append(dict(recording_id=row['recording_id'], original_recording_id=row['original_recording_id'],
            speaker_id=row['speaker_id'], session_id=row['session_id'], split=row['split'], kind=row['kind'],
            echo_case=item['echo_case'], consent=row['consent'], content_approved=False,
            review_source='pending user review through annotation tool', wav=str(wav), wav_sha256=digest(wav), **pcm_info(wav)))
    manifest = dict(schema_version=1, session_id='S02_VALID', split='validation', speaker_id='SPK01',
                    source_report=str(Path(report_path).resolve()), source_report_sha256=digest(report_path), entries=entries)
    write_new(Path(root) / 'datasets/S02_VALID.json', manifest)
    return manifest


def suggest_speech_regions(samples, sample_rate=16000):
    """Unreviewed RMS activity proposals, never wake labels or model inputs."""
    if not samples:
        return []
    frame = max(1, round(sample_rate * 0.02))
    envelope = [math.sqrt(sum((v / 32768) ** 2 for v in samples[i:i+frame]) / len(samples[i:i+frame]))
                for i in range(0, len(samples), frame)]
    ordered = sorted(envelope)
    noise = ordered[int((len(ordered)-1) * 0.2)]
    threshold = max(0.004, noise * 3, noise + 0.003)
    active = [i for i, rms in enumerate(envelope) if rms > threshold]
    groups = []
    for i in active:
        if not groups or (i - groups[-1][-1] - 1) * frame / sample_rate > 0.18:
            groups.append([i])
        else:
            groups[-1].append(i)
    duration = len(samples) / sample_rate
    regions = []
    for group in groups:
        if len(group) * frame / sample_rate < 0.08:
            continue
        start = max(0, group[0] * frame / sample_rate - 0.2)
        end = min(duration, (group[-1]+1) * frame / sample_rate + 0.25)
        if regions and start <= regions[-1]['end_seconds']:
            regions[-1]['end_seconds'] = round(end, 3)
        else:
            regions.append(dict(start_seconds=round(start, 3), end_seconds=round(end, 3)))
    return regions


def annotation_page(manifest, root=ROOT, resume_after=None, resume_next=None, update_page=None):
    payload = dict(dataset_fingerprint=fingerprint(manifest), session_id=manifest['session_id'], entries=[])
    if resume_after is not None:
        ids = [entry['recording_id'] for entry in manifest['entries']]
        if resume_after not in ids or (resume_next is not None and (resume_next not in ids or ids.index(resume_next) != ids.index(resume_after) + 1)):
            raise ValueError('Resume checkpoint/next ID does not match dataset order')
        payload['navigation_resume'] = dict(after_recording_id=resume_after, next_recording_id=resume_next,
                                             source='user stated checkpoint; no annotation approval or timings')
    for entry in manifest['entries']:
        path = Path(entry['wav'])
        if digest(path) != entry['wav_sha256']:
            raise ValueError('Audio changed before annotation')
        with wave.open(str(path), 'rb') as source:
            samples = array('h', source.readframes(source.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        step = max(1, len(samples) // 700)
        peaks = [[min(samples[i:i+step]) / 32768, max(samples[i:i+step]) / 32768] for i in range(0, len(samples), step)]
        payload['entries'].append(dict(entry, speech_suggestions=suggest_speech_regions(samples) if entry['kind']=='positives' and not entry['echo_case'] else [], suggestion_method='20ms RMS; adaptive 20th-percentile noise threshold; 200ms/250ms padding; unreviewed activity only', waveform=peaks, waveform_step_seconds=step / 16000, audio='data:audio/wav;base64,' + base64.b64encode(path.read_bytes()).decode()))
    destination = Path(update_page) if update_page is not None else Path(root) / ('annotation-' + manifest['session_id'] + '-' + uuid.uuid4().hex + '.html')
    if update_page is not None:
        if not destination.resolve().is_relative_to(Path(root).resolve()) or not destination.is_file():
            raise ValueError('Update requires an existing annotation page inside the local experiment root')
        prior = destination.read_text(encoding='utf-8')
        match = re.search(r'const DATA=(.*?);\s*const q=', prior, re.S)
        if not match or json.loads(match.group(1))['dataset_fingerprint'] != payload['dataset_fingerprint']:
            raise ValueError('Existing page dataset mismatch; preserved')
        backup = destination.with_name(destination.name + '.before-resume-' + uuid.uuid4().hex + '.bak')
        with backup.open('xb') as target:
            target.write(destination.read_bytes())
    text = (TOOLS / 'kural_boundary_annotation.html').read_text(encoding='utf-8')
    destination.write_text(text.replace('/*ANNOTATION_DATA*/null', json.dumps(payload, ensure_ascii=True).replace('<', '\\u003c')), encoding='utf-8')
    return destination


def validate(config, root=ROOT):
    if not 1 <= config['max_epochs'] <= 50 or not 1 <= config['training_wall_limit_seconds'] <= 3600:
        raise ValueError('Baseline limits exceed 50 epochs / 60 minutes')
    if config['sample_rate'] != 16000 or config['window_samples'] != 32000 or config['augmentation'] != 'none' or config['pretrained_components'] != 'none':
        raise ValueError('Only the fixed scratch baseline is supported')
    root = Path(root)
    missing, audit, manifests, seen_ids, seen_pcm, seen_origins = [], [], {}, {}, {}, {}
    for session, split, positive_target, negative_target in [('S01_TRAIN', 'train', 40, 60), ('S02_VALID', 'validation', 20, 30)]:
        path = root / ('datasets/' + session + '.json')
        ann_path = root / ('annotations/' + session + '.annotations.json')
        if not path.exists():
            missing.append('Missing separate reviewed dataset: ' + session)
            continue
        manifest = read(path)
        manifests[session] = manifest
        if (manifest['session_id'], manifest['split'], manifest['speaker_id']) != (session, split, 'SPK01'):
            raise ValueError('Manifest split/speaker mismatch')
        annotations = read(ann_path) if ann_path.exists() else {}
        if annotations and annotations.get('dataset_fingerprint') != fingerprint(manifest):
            raise ValueError('Annotations belong to a different dataset snapshot')
        records = annotations.get('records', {})
        if set(records) - {entry['recording_id'] for entry in manifest['entries']}:
            raise ValueError('Annotations contain unknown/cross-session recording IDs')
        counts = Counter()
        background = 0
        for entry in manifest['entries']:
            rid = entry['recording_id']
            if rid == EXCLUDED or rid in manifest.get('excluded_recording_ids', []) or entry.get('excluded_from_training'):
                raise ValueError('Excluded recording entered dataset: ' + rid)
            if (entry['session_id'], entry['split'], entry['speaker_id']) != (session, split, 'SPK01'):
                raise ValueError('Cross-session/split row: ' + rid)
            origin = entry['original_recording_id']
            if origin == EXCLUDED or origin in manifest.get('excluded_recording_ids', []):
                raise ValueError('Excluded original lineage entered dataset')
            if rid in seen_ids or (origin in seen_origins and seen_origins[origin] != split):
                raise ValueError('Duplicate/cross-split lineage: ' + rid)
            seen_ids[rid], seen_origins[origin] = split, split
            if rid != origin:
                raise ValueError('Baseline inputs must be originals; derived windows keep lineage internally')
            if entry.get('consent', {}).get('granted') is not True or not entry['consent'].get('at'):
                raise ValueError('Missing explicit consent: ' + rid)
            if digest(entry['wav']) != entry['wav_sha256']:
                raise ValueError('Audio hash changed: ' + rid)
            info = pcm_info(entry['wav'])
            if info['pcm_sha256'] in seen_pcm and seen_pcm[info['pcm_sha256']] != split:
                raise ValueError('Cross-split duplicate PCM audio')
            seen_pcm[info['pcm_sha256']] = split
            if info['pcm_sha256'] != entry['pcm_sha256'] or info['frames'] != entry['frames']:
                raise ValueError('Dataset PCM properties changed')
            ann = records.get(rid, {})
            if ann.get('human_reviewed') is not True or ann.get('content_approved') is not True:
                missing.append(session + ': review/annotation required: ' + rid)
                continue
            intervals = ann.get('wake_intervals')
            if not isinstance(intervals, list):
                missing.append(session + ': explicit wake intervals or reviewed absence required: ' + rid)
                continue
            previous_end = -1
            for interval in intervals:
                start, end = interval.get('start_seconds'), interval.get('end_seconds')
                if (not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or
                        not math.isfinite(start) or not math.isfinite(end) or
                        not 0 <= start < end <= info['duration_seconds'] or start < previous_end or
                        end - start > config['window_samples'] / config['sample_rate']):
                    raise ValueError('Invalid/unwindowable wake interval: ' + rid)
                previous_end = end
                expected_source = 'playback' if entry['echo_case'] else 'human'
                if interval.get('source') != expected_source:
                    raise ValueError('Echo/human source mismatch: ' + rid)
            if entry['kind'] == 'positives' and (not intervals or entry['echo_case']):
                missing.append(session + ': positive requires human wake boundaries: ' + rid)
                continue
            if entry['kind'] != 'positives' and intervals and not entry['echo_case']:
                raise ValueError('Negative contains a wake; explicit content correction needed: ' + rid)
            if not intervals and ann.get('wake_absence_confirmed') is not True:
                missing.append(session + ': explicit no-wake listening confirmation required: ' + rid)
                continue
            counts[entry['kind']] += 1
            if entry['kind'] == 'background_seconds':
                background += info['duration_seconds']
            audit.append(dict(entry, annotation=ann))
        if counts['positives'] < positive_target or counts['negatives'] < negative_target or background < 300:
            missing.append(f'{session}: reviewed minimum not met (positive {counts["positives"]}/{positive_target}, negative {counts["negatives"]}/{negative_target}, background {background:.2f}/300 seconds)')
    return dict(ready=not missing and len(manifests) == 2, missing=missing, entries=audit,
                dataset_fingerprint=fingerprint(dict(config=config, manifests=manifests,
                    annotations={s: read(root / ('annotations/' + s + '.annotations.json')) for s in manifests if (root / ('annotations/' + s + '.annotations.json')).exists()})))


def windows(entry, config):
    """Training windows: only verified fully-contained wakes get a positive label."""
    size = config['window_samples'] / config['sample_rate']
    duration = entry['duration_seconds']
    intervals = entry['annotation']['wake_intervals']
    result = []
    for interval in intervals:
        start = max(0, min(interval['end_seconds'] + config['positive_postroll_seconds'] - size, interval['start_seconds'], duration - size))
        if not start <= interval['start_seconds'] < interval['end_seconds'] <= start + size:
            raise ValueError('Wake would be cut by window')
        result.append(dict(start_seconds=start, label=2 if entry['echo_case'] else 1))
    if entry['kind'] != 'positives':
        hop = config['training_negative_hop_samples'] / config['sample_rate']
        start = 0.0
        while start < duration:
            end = min(start + size, duration)
            if not any(start < wake['end_seconds'] and end > wake['start_seconds'] for wake in intervals):
                result.append(dict(start_seconds=start, label=2 if entry['echo_case'] else 0))
            start += hop
    return result


def dependency_probe(python, runner=subprocess.run, check_pins=True):
    script = """import importlib.metadata as m,json,sys,hashlib
ds=list(m.distributions());licenses={}
for d in ds:
 files=[]
 for f in d.files or []:
  if any(word in str(f).upper() for word in ['LICENSE','COPYING','NOTICE']):
   p=d.locate_file(f)
   if p.is_file():files.append({'file':str(f),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 licenses[d.metadata['Name'].lower()]={'license':d.metadata.get('License-Expression') or d.metadata.get('License'),'notice_files':files}
print(json.dumps({'prefix':sys.prefix,'versions':{d.metadata['Name'].lower():d.version for d in ds},'licenses':licenses}))
"""
    result = runner([str(python), '-c', script], check=True, capture_output=True, text=True, timeout=30)
    data = json.loads(result.stdout)
    if Path(data['prefix']).resolve() != Path(python).resolve().parent.parent:
        raise ValueError('Wrong isolated interpreter prefix')
    for package, version in PINS.items():
        if check_pins and data['versions'].get(package) != version:
            raise ValueError('Missing/mismatched isolated dependency: ' + package)
    return data


def setup(root=ROOT, runner=subprocess.run):
    root = Path(root).resolve()
    env = root / 'environment'
    if sys.version_info[:2] != (3, 11) or platform.architecture()[0] != '64bit':
        raise ValueError('Pinned setup requires Python 3.11 x64')
    root.mkdir(parents=True, exist_ok=True)
    python = env / 'Scripts/python.exe'
    if not env.exists():
        runner([sys.executable, '-m', 'venv', str(env)], check=True, timeout=120)
    if not python.is_file():
        raise ValueError('Partial environment preserved; isolated python missing')
    if not python.resolve().is_relative_to(root):
        raise ValueError('Isolated interpreter escapes experiment root')
    data = dependency_probe(python, runner, check_pins=False)  # Fail closed on wrong prefix; never pip into Agent.
    for package, version in PINS.items():
        if package in data['versions'] and data['versions'][package] != version:
            raise ValueError('Existing pinned version differs; preserved, not overwritten: ' + package)
    if any(package not in data['versions'] for package in PINS):
        log = root / ('setup-' + uuid.uuid4().hex + '.log')
        command = [str(python), '-m', 'pip', '--isolated', '--disable-pip-version-check', '--verbose', 'install',
                   '--retries', '0', '--timeout', '15', '--only-binary=:all:', '--index-url', 'https://pypi.org/simple',
                   '-r', str(TOOLS / 'kural_cnn_requirements.txt')]
        try:
            result = runner(command, capture_output=True, text=True, timeout=600)
        except subprocess.TimeoutExpired as error:
            def text(value):
                return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''
            log.write_text(text(error.stdout) + text(error.stderr), encoding='utf-8')
            raise ValueError('Isolated pip timed out; partial environment/log preserved; no retry: ' + str(log)) from error
        text = re.sub(r'(https?://)[^/\s]*@', r'\1[redacted]@', result.stdout + result.stderr)
        log.write_text(text, encoding='utf-8')
        if result.returncode:
            raise ValueError('Isolated pip setup failed; no retries. See ' + str(log))
        data = dependency_probe(python, runner)
    result = runner([str(python), '-c', 'import tensorflow as t,keras,numpy;print(t.__version__,keras.__version__,numpy.__version__)'], capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise ValueError('Installed dependency load failed: ' + result.stderr[-2000:])
    write_new(root / ('dependencies-' + fingerprint(data)[:16] + '.json'), data)
    return data


def resume_check(state, identity):
    if state.get('identity') != identity:
        raise ValueError('Resume configuration/dataset/dependency/source mismatch')
    if state.get('status') in ('complete', 'early_stopped'):
        raise ValueError('Baseline already complete; evaluate saved predictions, never retrain')
    if state.get('epochs', 0) >= 50 or state.get('training_elapsed_seconds', 0) >= 3600:
        raise ValueError('Baseline budget exhausted')


def checkpoint_progress(state, run, name, loss, epoch, elapsed):
    if not math.isfinite(loss):
        raise ValueError('Nonfinite validation loss; preserve prior checkpoint')
    checksum = digest(Path(run) / name)
    improved = state['best_loss'] is None or loss < state['best_loss']
    state.update(latest_checkpoint=name, latest_checkpoint_sha256=checksum,
                 epochs=epoch, status='training', training_elapsed_seconds=elapsed)
    if improved:
        state.update(best_loss=loss, best_checkpoint=name, best_checkpoint_sha256=checksum, wait=0)
    else:
        state['wait'] += 1
    return state


def launch(config, audit, dependencies, root=ROOT, resume=None, runner=subprocess.run):
    if not audit['ready']:
        raise ValueError('Data gate blocked training')
    root = Path(root).resolve()
    identity = dict(config=config, dataset_fingerprint=audit['dataset_fingerprint'], dependencies=dependencies,
                    worker_sha256=digest(TOOLS / 'kural_training_worker.py'), pipeline_sha256=digest(__file__),
                    feature_source_sha256=digest(TOOLS / 'kural_audio_features.py'))
    reservation = root / 'baseline-reservation.json'
    if resume:
        run = Path(resume).resolve()
        if not run.is_relative_to(root / 'runs') or not reservation.exists() or Path(read(reservation)['run']).resolve() != run:
            raise ValueError('Resume must match the one reserved baseline')
        state = read(run / 'state.json')
        resume_check(state, identity)
    else:
        if reservation.exists():
            raise ValueError('One baseline is already reserved; use exact --resume directory')
        run = root / 'runs' / ('baseline-' + uuid.uuid4().hex)
        run.mkdir(parents=True)
        state = dict(identity=identity, status='reserved', epochs=0, training_elapsed_seconds=0, best_loss=None, wait=0)
        write_new(run / 'dataset.json', audit)
        write_new(run / 'config.json', config)
        write_new(run / 'dependencies.json', dependencies)
        write_new(run / 'state.json', state)
        write_new(reservation, dict(run=str(run), identity=fingerprint(identity)))
    remaining = config['training_wall_limit_seconds'] - state.get('training_elapsed_seconds', 0)
    env = os.environ.copy()
    env.update(CUDA_VISIBLE_DEVICES='-1', TF_DETERMINISTIC_OPS='1', TF_ENABLE_ONEDNN_OPTS='0', PYTHONHASHSEED=str(config['seed']), KURAL_GATED_WORKER='1')
    attempt = run / ('attempt-' + uuid.uuid4().hex + '.log')
    print('Single baseline run:', run, '\nProgress log:', attempt, flush=True)
    started = time.monotonic()
    try:
        with attempt.open('x', encoding='utf-8') as log:
            result = runner([str(root / 'environment/Scripts/python.exe'), str(TOOLS / 'kural_training_worker.py'), str(run)],
                            stdout=log, stderr=subprocess.STDOUT, env=env, timeout=remaining, check=True)
    except (subprocess.SubprocessError, OSError) as error:
        latest = read(run / 'state.json')
        latest.update(status='interrupted', training_elapsed_seconds=state.get('training_elapsed_seconds', 0) + time.monotonic() - started,
                      error_type=type(error).__name__)
        atomic_json(run / 'state.json', latest)  # Checkpoints remain untouched.
        raise
    latest = read(run / 'state.json')
    latest['training_elapsed_seconds'] = max(latest.get('training_elapsed_seconds', 0),
        state.get('training_elapsed_seconds', 0) + time.monotonic() - started)
    atomic_json(run / 'state.json', latest)
    return run


def events(times, scores, threshold, consecutive, cooldown, eligible=None):
    if len(times) != len(scores) or (eligible is not None and len(eligible) != len(times)):
        raise ValueError('Event timeline/score/eligibility lengths differ')
    if eligible is not None and any(type(value) is not bool for value in eligible):
        raise ValueError('Eligibility must contain explicit booleans')
    result, streak, last = [], 0, -float('inf')
    for index, (timestamp, score) in enumerate(zip(times, scores)):
        if eligible is not None and not eligible[index]:
            # Break consecutive evidence; do not create an event or update cooldown.
            streak = 0
            continue
        streak = streak + 1 if score >= threshold else 0
        if streak >= consecutive and timestamp - last >= cooldown:
            result.append(timestamp)
            last, streak = timestamp, 0
    return result


def metrics(predictions, threshold, config, eligibility_key=None):
    missed = total = 0
    negative_seconds = echo_seconds = 0.0
    negative_events = echo_events = unmatched_positive_events = 0
    delays, clips = [], []
    for row in predictions:
        eligible = row[eligibility_key] if eligibility_key is not None else None
        emitted = events(row['times'], row['wake_scores'], threshold, config['decision_consecutive_frames'], config['decision_cooldown_seconds'], eligible=eligible)
        wakes = row['human_wakes']
        used = set()
        for wake in wakes:
            total += 1
            match = next((i for i, timestamp in enumerate(emitted) if i not in used and wake['start_seconds'] <= timestamp <= wake['end_seconds'] + config['event_match_grace_seconds']), None)
            if match is None:
                missed += 1
            else:
                used.add(match)
                delays.append(emitted[match] - wake['end_seconds'])
        if row['echo_case']:
            echo_seconds += row['duration_seconds']
            echo_events += len(emitted)
        elif not wakes:
            negative_seconds += row['duration_seconds']
            negative_events += len(emitted)
        else:
            unmatched_positive_events += len(emitted) - len(used)
        considered = row['wake_scores'] if eligible is None else [score for score, valid in zip(row['wake_scores'], eligible) if valid]
        clips.append(dict(recording_id=row['recording_id'], expected_human_wake=bool(wakes),
                          predicted_clip_contains_wake=bool(considered and max(considered) >= threshold),
                          event_times_seconds=emitted, echo_case=row['echo_case']))
    clip_positive = [r for r in clips if r['expected_human_wake']]
    clip_negative = [r for r in clips if not r['expected_human_wake'] and not r['echo_case']]
    clip_echo = [r for r in clips if r['echo_case']]
    return dict(clips=clips, clip_level=dict(positive_clips=len(clip_positive),
                missed_positive_clips=sum(not r['predicted_clip_contains_wake'] for r in clip_positive),
                ordinary_negative_clips=len(clip_negative), false_positive_negative_clips=sum(r['predicted_clip_contains_wake'] for r in clip_negative),
                echo_clips=len(clip_echo), echo_clips_with_wake_prediction=sum(r['predicted_clip_contains_wake'] for r in clip_echo)),
                missed_wakes=missed, annotated_human_wakes=total,
                missed_wake_rate=missed / total if total else None,
                ordinary_negative_seconds=negative_seconds, false_events=negative_events,
                false_events_per_hour=negative_events / (negative_seconds / 3600) if negative_seconds else None,
                echo_seconds=echo_seconds, echo_events=echo_events,
                echo_events_per_hour=echo_events / (echo_seconds / 3600) if echo_seconds else None,
                unmatched_events_in_positive_clips=unmatched_positive_events,
                offline_audio_timeline_delay_from_annotated_wake_end_seconds=delays,
                streaming_latency_measured=False)


def evaluate(run):
    run = Path(run)
    config, predictions = read(run / 'config.json'), read(run / 'predictions.json')
    state = read(run / 'state.json')
    if state.get('predictions_sha256') != digest(run / 'predictions.json') or state['identity']['config'] != config:
        raise ValueError('Saved prediction/configuration integrity mismatch')
    if predictions['dataset_fingerprint'] != read(run / 'dataset.json')['dataset_fingerprint']:
        raise ValueError('Prediction dataset mismatch')
    if predictions['evaluation_split'] != 'S02_VALID':
        raise ValueError('Only validation selection is implemented; held-out test stays untouched')
    candidates = [(threshold, metrics(predictions['records'], threshold, config)) for threshold in config['threshold_candidates']]
    threshold, selected = min(candidates, key=lambda item: (item[1]['missed_wakes'] + item[1]['false_events'] + item[1]['echo_events'] + item[1]['unmatched_events_in_positive_clips'], -item[0]))
    result = dict(threshold=threshold, consecutive=config['decision_consecutive_frames'], cooldown_seconds=config['decision_cooldown_seconds'],
                  dataset_fingerprint=predictions['dataset_fingerprint'], predictions_sha256=digest(run / 'predictions.json'),
                  selection_split='S02_VALID', subject='SPK01 only', final_test=False, live_activation_approved=False,
                  metrics=selected, candidates=[dict(threshold=t, metrics=m) for t,m in candidates],
                  model_loading_seconds=predictions['model_loading_seconds'], inference_processing_seconds=predictions['inference_processing_seconds'])
    write_new(run / 'validation-decision-frozen.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--annotation-resume-after')
    parser.add_argument('--annotation-next')
    parser.add_argument('--annotation-update-page', type=Path)
    parser.add_argument('--s02-report', type=Path)
    parser.add_argument('--setup', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--train', action='store_true')
    parser.add_argument('--resume', type=Path)
    parser.add_argument('--evaluate', type=Path)
    args = parser.parse_args()
    if not any([args.prepare, args.setup, args.check, args.train, args.evaluate]):
        print('Disabled. No installation, inference or training.')
        return
    config = read(CONFIG)
    if args.setup:
        setup()
        print('Isolated dependency setup validated.')
    if args.prepare:
        ROOT.mkdir(parents=True, exist_ok=True)
        s01 = prepare_s01()
        print('S01 annotation page:', annotation_page(s01, resume_after=args.annotation_resume_after, resume_next=args.annotation_next, update_page=args.annotation_update_page))
        if args.s02_report:
            print('S02 annotation page:', annotation_page(prepare_s02(args.s02_report)))
    if args.check or args.train:
        audit = validate(config)
        print(json.dumps(dict(ready=audit['ready'], missing=audit['missing'], dataset_fingerprint=audit['dataset_fingerprint']), indent=2))
        write_new(ROOT / ('gate-' + uuid.uuid4().hex + '.json'), audit)
        if args.train:
            if not audit['ready']:
                print('BLOCKED: no training was launched.')
                return 2
            deps = dependency_probe(ROOT / 'environment/Scripts/python.exe')
            print('Run:', launch(config, audit, deps, resume=args.resume))
    if args.evaluate:
        print(json.dumps(evaluate(args.evaluate), indent=2))


if __name__ == '__main__':
    raise SystemExit(main() or 0)
