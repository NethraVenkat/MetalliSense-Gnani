"""Offline, explicit user review overlay. Never mutates source validation/evidence."""
from collections import Counter
import argparse
import html
import json
import os
from pathlib import Path
import uuid

from import_kural_pilot import sha

BATCH = 'S01_TOPUP_701733df-155c-48ff-9777-6f58671004b5'
WAKE_ONLY = {'5342717e-cd43-41e9-8eb8-e0064515073d', '59c039aa-9b7f-465d-860f-a56961fead4a',
             '054ac5a1-c301-4125-af6b-81af1646d30f', 'd0edc637-4831-4ef9-b10b-9b5e3ec2f1f6'}
EXCLUDED = 'aff7301e-74b4-40f4-ab27-fd41140ec8a7'
AND_ONLY = '5f512dcd-2d0b-4e4e-bc9f-5aded5a1a5be'


def overlay(original, topup, approve_topup=False):
    ids = [r['record']['recording_id'] for r in original['results']]
    if len(ids) != len(set(ids)) or not WAKE_ONLY | {EXCLUDED, AND_ONLY} <= set(ids):
        raise ValueError('Required original IDs absent/ambiguous; do not guess')
    if topup['summary'].get('topup_batch_id') != BATCH:
        raise ValueError('Wrong top-up batch')
    if len(topup['results']) != 3 or {r['record']['prompt_id'] for r in topup['results']} != {'TP01', 'TN01', 'TB01'}:
        raise ValueError('Expected exactly three top-up tasks')
    entries = []
    for source, report in [('original', original), ('topup', topup)]:
        for result in report['results']:
            row = result['record']
            if (row['speaker_id'], row['session_id'], row['split']) != ('SPK01', 'S01_TRAIN', 'train'):
                raise ValueError('Cross-session/split record rejected')
            if result['file_status'] != 'valid_audio_pair' or result['issues']:
                raise ValueError('Resolve file/metadata issues before content review')
            rid = row['recording_id']
            entry = dict(recording_id=rid, original_recording_id=row['original_recording_id'], source=source,
                         speaker_id=row['speaker_id'], session_id=row['session_id'], split=row['split'],
                         kind=row['kind'], prompt_id=row['prompt_id'], source_prompt=row['prompt'],
                         duration_seconds=result['duration_seconds'], echo_case=result['echo_case'],
                         review_source='User instruction dated 2026-11-02; not independent agent listening',
                         consent=row['consent'], wav=result['wav'], wav_sha256=result['wav_sha256'],
                         wake_intervals=None, interval_status='not provided; do not infer from content approval',
                         user_reported_content=None, excluded_from_training=False,
                         content_status='user approved original content' if source == 'original' else 'pending user listening review',
                         usable_after_content_review=source == 'original',
                         utterance_type='as originally recorded; no automatic transcript inference')
            if source == 'original':
                if rid in WAKE_ONLY:
                    if row['kind'] != 'positives':
                        raise ValueError('Wake-only correction points to a nonpositive')
                    entry.update(user_reported_content='\u0b95\u0bc1\u0bb0\u0bb2\u0bcd', utterance_type='wake_only',
                                 content_status='user corrected and approved: wake-positive, not wake-plus-command')
                elif rid == EXCLUDED:
                    if row['kind'] != 'positives':
                        raise ValueError('Silent exclusion points to a nonpositive')
                    entry.update(content_status='user reports no audible audio; exclude from training',
                                 excluded_from_training=True, usable_after_content_review=False,
                                 exclusion_reason='user-reported no audible audio; original preserved')
                elif rid == AND_ONLY:
                    if row['kind'] != 'negatives':
                        raise ValueError('Speech-negative correction points to a nonnegative')
                    entry.update(user_reported_content='and', utterance_type='speech_negative',
                                 content_status='user corrected and approved: and, not verified good and coverage')
            else:
                if row.get('topup_batch_id') != BATCH:
                    raise ValueError('Top-up record batch mismatch')
                for key in ('topup_batch_id', 'replaces_recording_id', 'supplements_recording_id'):
                    if key in row:
                        entry[key] = row[key]
                if row['prompt_id'] == 'TP01' and row.get('replaces_recording_id') != EXCLUDED:
                    raise ValueError('Wrong replacement relationship')
                if row['prompt_id'] == 'TN01' and row.get('supplements_recording_id') != AND_ONLY:
                    raise ValueError('Wrong supplement relationship')
                if approve_topup:
                    entry.update(content_status='user approved top-up content; wake timings not supplied',
                                 usable_after_content_review=True,
                                 utterance_type={'TP01':'wake_only', 'TN01':'speech_negative', 'TB01':'room_fan_background'}[row['prompt_id']])
            entries.append(entry)
    if len({r['recording_id'] for r in entries}) != len(entries):
        raise ValueError('Overlapping original/top-up IDs')
    approved = [r for r in entries if r['usable_after_content_review']]
    potential = [r for r in entries if not r['excluded_from_training']]
    def counts(rows):
        kinds = Counter(r['kind'] for r in rows)
        return dict(positives=kinds['positives'], speech_negatives=kinds['negatives'],
                    background_blocks=kinds['background_seconds'],
                    background_seconds=round(sum(r['duration_seconds'] for r in rows if r['kind'] == 'background_seconds'), 6))
    return dict(schema_version=1, pilot_id='kural-personal-pilot-v1', speaker_id='SPK01', session_id='S01_TRAIN', split='train',
                user_instruction_date='2026-11-02', review_type='separate content-only overlay; not training input',
                summary=dict(original_records=len(ids), topup_pending_review=0 if approve_topup else 3,
                             user_approved_original_content=sum(r['source']=='original' for r in approved),
                             user_approved_topup_content=3 if approve_topup else 0,
                             total_content_approved=len(approved), excluded_originals=1,
                             approved_content_counts=counts(approved),
                             provisional_counts_including_pending_topup=counts(potential),
                             wake_only_corrections=4, echo_cases=sum(r['echo_case'] for r in entries),
                             fabricated_intervals=0, training_ready=False,
                             prerequisites=([] if approve_topup else ['Listen to all three new takes and approve/correct them explicitly']) +
                                           ['Wake intervals/segmentation remain unspecified; content approval supplies no timings',
                                            'S02_VALID is a separate-session prerequisite for evaluated training',
                                            'S03_TEST_RESERVED remains untouched']), entries=entries)


def save_review(original_path, topup_path, approve_topup=False, previous_overlay=None):
    original_path, topup_path = Path(original_path).resolve(), Path(topup_path).resolve()
    before = {str(p): sha(p) for p in [original_path, topup_path]}
    result = overlay(json.loads(original_path.read_text(encoding='utf-8')), json.loads(topup_path.read_text(encoding='utf-8')), approve_topup)
    if previous_overlay is not None:
        previous_overlay = Path(previous_overlay).resolve()
        before[str(previous_overlay)] = sha(previous_overlay)
        result['previous_overlay'] = dict(file=str(previous_overlay), sha256=sha(previous_overlay))
    sources = {'original': original_path, 'topup': topup_path}
    for row in result['entries']:
        wav = sources[row['source']].parent / row['wav']
        if sha(wav) != row['wav_sha256']:
            raise ValueError('Reviewed WAV changed')
        before[str(wav)] = row['wav_sha256']
    out = original_path.parent.parent / ('review-overlay-' + uuid.uuid4().hex)
    out.mkdir()
    result['source_validation_reports'] = before
    (out / 'review-overlay.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    cards = []
    ordered = sorted(result['entries'], key=lambda r: (r['source'] != 'topup', not r['excluded_from_training'], r['recording_id']))
    for row in ordered:
        wav = sources[row['source']].parent / row['wav']
        relative = Path(os.path.relpath(wav, out)).as_posix()
        detail = dict(recording_id=row['recording_id'], source=row['source'], kind=row['kind'], duration_seconds=row['duration_seconds'],
                      content_status=row['content_status'], user_reported_content=row['user_reported_content'],
                      utterance_type=row['utterance_type'], excluded=row['excluded_from_training'],
                      echo_case=row['echo_case'], wake_intervals=None,
                      replaces_recording_id=row.get('replaces_recording_id'), supplements_recording_id=row.get('supplements_recording_id'))
        cards.append('<section><h2>' + html.escape(row['prompt_id'] + ' / ' + row['recording_id']) + '</h2><pre>' + html.escape(json.dumps(detail, ensure_ascii=False, indent=2)) + '</pre><audio controls preload="none" src="' + html.escape(relative, quote=True) + '"></audio></section>')
    intro = ('Three top-up contents approved by the user; timings remain unspecified.' if approve_topup else 'Three top-up takes pending listening review.')
    (out / 'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src \'self\' file:; style-src \'unsafe-inline\'"><title>S01 corrected review</title><style>body{font:16px/1.7 system-ui;max-width:900px;margin:24px auto;padding:16px}section{padding:12px;border:1px solid #ccc;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}audio{width:100%}h2{font-size:16px}</style><h1>S01 content review overlay — no training</h1><p>' + intro + ' Decisions come from the user, not agent listening. No wake timings inferred. Narration echo remains flagged. This index is read-only.</p><pre>' + html.escape(json.dumps(result['summary'], indent=2)) + '</pre>' + ''.join(cards), encoding='utf-8')
    for path, expected in before.items():
        if sha(path) != expected:
            raise ValueError('Source evidence changed')
    print(json.dumps(result['summary'], indent=2))
    print('Review:', out / 'index.html')
    return result, out


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--save-overlay', action='store_true')
    parser.add_argument('--original', type=Path)
    parser.add_argument('--topup', type=Path)
    parser.add_argument('--approve-topup-content', action='store_true')
    parser.add_argument('--previous-overlay', type=Path)
    args = parser.parse_args()
    if not args.save_overlay:
        print('Disabled. No writes, inference or training.')
    elif not args.original or not args.topup:
        parser.error('Explicit --original and --topup validation report paths required')
    else:
        save_review(args.original, args.topup, args.approve_topup_content, args.previous_overlay)
