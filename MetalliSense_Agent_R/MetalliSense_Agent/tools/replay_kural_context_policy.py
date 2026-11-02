"""Default-off checkpoint replay with explicit history validity; never trains."""
import argparse
from collections import Counter
import copy
import json
import os
from pathlib import Path
import sys
import uuid
import wave

import kural_training as k
import kural_binary_experiment as binary
from kural_context_policy import POLICY, support, wake_coverage

RUN = k.ROOT/'binary-runs/binary-38d67c7b107b4593be674c2937fb97fd'


def replay_saved(records, config):
    augmented = []
    supports = {}
    coverage = []
    for original in records:
        row = copy.deepcopy(original)
        frames = support(row)
        row['context_eligible'] = [frame['eligible'] for frame in frames]
        supports[row['recording_id']] = frames
        coverage.extend(wake_coverage(row, frames, config['decision_consecutive_frames'], config['event_match_grace_seconds']))
        augmented.append(row)
    thresholds = []
    for threshold in config['threshold_candidates']:
        raw = k.metrics(records, threshold, config)
        gated = k.metrics(augmented, threshold, config, eligibility_key='context_eligible')
        startup = {}
        for group, subset in (
            ('positives', [r for r in augmented if r['human_wakes']]),
            ('ordinary_negatives', [r for r in augmented if not r['human_wakes'] and not r['echo_case']]),
            ('echo', [r for r in augmented if r['echo_case']]),
        ):
            ineligible_events = eligible_legacy_events = 0
            total = eligible_seconds = 0.0
            for row in subset:
                total += row['duration_seconds']
                eligible_seconds += max(0, row['duration_seconds']-2)
                emitted = k.events(row['times'], row['wake_scores'], threshold, config['decision_consecutive_frames'], config['decision_cooldown_seconds'])
                lookup = {frame['timestamp']:frame['eligible'] for frame in supports[row['recording_id']]}
                ineligible_events += sum(not lookup[t] for t in emitted)
                eligible_legacy_events += sum(lookup[t] for t in emitted)
            startup[group] = dict(total_audio_seconds=total, ineligible_history_seconds=total-eligible_seconds,
                                  eligible_history_seconds=eligible_seconds,
                                  legacy_ineligible_events=ineligible_events,
                                  legacy_full_context_events=eligible_legacy_events)
        thresholds.append(dict(threshold=threshold, qualified=binary.qualify(gated, config),
                               ungated_metrics=raw, context_gated_metrics=gated, startup=startup))
    selected = [r for r in thresholds if r['qualified']]
    selected = min(selected, key=lambda r:(r['context_gated_metrics']['missed_wakes'], r['context_gated_metrics']['false_events'], -r['threshold'])) if selected else None
    return dict(policy=POLICY, qualified_threshold=selected['threshold'] if selected else None,
                qualification_unchanged=config['qualification'], thresholds=thresholds,
                wake_coverage=coverage, wake_coverage_counts=dict(Counter(r['status'] for r in coverage)),
                all_wakes_retained=len(coverage), final_test=False, deployment_approved=False), supports


def run():
    if Path(sys.prefix).resolve() != (k.ROOT/'environment').resolve():
        raise ValueError('Use the isolated training interpreter; no installation or fitting here')
    os.environ.update(CUDA_VISIBLE_DEVICES='-1', TF_DETERMINISTIC_OPS='1', TF_ENABLE_ONEDNN_OPTS='0')
    import tensorflow as tf
    import numpy as np
    from kural_audio_features import build_feature_extractor, causal_context
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    protected = [RUN, k.ROOT/'runs/baseline-5f8ee6cd19174de58759932ff48938bb', k.ROOT/'overfit-diagnostic-08e2f5a619eb43b7918b66b52dca11ea']
    before = {str(folder):binary.snapshot(folder) for folder in protected}
    annotation_hashes = {session:k.digest(k.ROOT/('annotations/'+session+'.annotations.json')) for session in ('S01_TRAIN','S02_VALID')}
    config=k.read(RUN/'config.json');fc=k.read(RUN/'feature-config.json');state=k.read(RUN/'state.json')
    raw=k.read(RUN/'predictions.json');audit=k.read(RUN/'dataset.json');norm=k.read(RUN/'normalization.json')
    if k.digest(RUN/state['best_checkpoint']) != state['best_checkpoint_sha256']:
        raise ValueError('Checkpoint hash mismatch')
    if k.digest(RUN/'predictions.json') != state['predictions_sha256']:
        raise ValueError('Raw-score hash mismatch')
    if len(raw['records']) != 61 or sum(len(r['human_wakes']) for r in raw['records']) != 20:
        raise ValueError('S02 replay must retain all 61 recordings and 20 wakes')
    out=k.ROOT/('context-policy-replay-'+uuid.uuid4().hex)
    out.mkdir()
    k.write_new(out/'policy.json',POLICY)
    k.write_new(out/'frozen-config.json',config)
    k.write_new(out/'protected-hashes.json',before)
    with (out/'raw-predictions.json').open('xb') as target:
        target.write((RUN/'predictions.json').read_bytes())
    model=tf.keras.models.load_model(RUN/state['best_checkpoint'],compile=False)
    feature=build_feature_extractor(fc,tf,np)
    mean=np.array(norm['mean'],dtype='float32');std=np.array(norm['std'],dtype='float32')
    entries={e['recording_id']:e for e in audit['entries'] if e['session_id']=='S02_VALID'}
    differences=[]
    for i,row in enumerate(raw['records']):
        entry=entries[row['recording_id']]
        if k.digest(entry['wav']) != entry['wav_sha256']:raise ValueError('Audio changed')
        with wave.open(entry['wav'],'rb') as source:
            samples=np.frombuffer(source.readframes(source.getnframes()),dtype='<i2').astype('float32')/32768
        ends=[round(t*fc['sample_rate']) for t in row['times']]
        values=np.stack([feature(causal_context(samples,end,fc['window_samples'],np)) for end in ends])
        x=((values-mean)/std)[...,None]
        scores=np.concatenate([model(x[j:j+32],training=False).numpy() for j in range(0,len(x),32)])[:,1]
        delta=float(np.abs(scores-np.array(row['wake_scores'])).max())
        if delta>1e-6:raise ValueError('Unchanged-checkpoint raw scores differ beyond tolerance')
        differences.append(delta)
        if (i+1)%20==0:print('Verified checkpoint replay',i+1,'/61',flush=True)
    result,supports=replay_saved(raw['records'],config)
    result.update(training_ran=False,model_fitting=False,all_raw_scores_preserved=True,
                  maximum_recomputed_score_difference=max(differences),source_run=str(RUN),
                  checkpoint_sha256=state['best_checkpoint_sha256'],annotation_hashes=annotation_hashes)
    for folder, hashes in before.items():
        if binary.snapshot(Path(folder)) != hashes:raise ValueError('Protected run changed')
    for session,h in annotation_hashes.items():
        if k.digest(k.ROOT/('annotations/'+session+'.annotations.json')) != h:raise ValueError('Annotations changed')
    result['protected_runs_unchanged']=True
    k.write_new(out/'context-support.json',supports)
    k.write_new(out/'result.json',result)
    k.write_new(out/'artifact-hashes.json',binary.snapshot(out))
    print('Coverage:',json.dumps(result['wake_coverage_counts']),flush=True)
    for row in result['thresholds']:
        m=row['context_gated_metrics']
        print('Threshold',row['threshold'],'misses',m['missed_wakes'],'/20; ordinary',m['false_events'],'echo',m['echo_events'],'qualified',row['qualified'],flush=True)
    print('Qualified threshold:',result['qualified_threshold'],'\nEvidence:',out,flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--replay',action='store_true')
    args=parser.parse_args()
    if args.replay:run()
    else:print('Disabled; use --replay for read-only checkpoint inference. No training.')


if __name__=='__main__':main()
