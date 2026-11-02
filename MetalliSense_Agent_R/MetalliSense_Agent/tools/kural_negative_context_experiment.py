"""One bounded negative-support repair. No S02 fit, validity gate or activation."""
import argparse
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import time
import uuid

import kural_training as k
import kural_binary_experiment as binary

CONFIG = Path(__file__).with_name('kural_negative_context_config.json')
PRIOR = k.ROOT/'binary-runs/binary-38d67c7b107b4593be674c2937fb97fd'
PREFIX_SECONDS = (.08, .16, .5, 1.0)


def contexts(entry, feature_config):
    regular = [dict(w, regular=True, prefix_seconds=[]) for w in binary.candidates(entry, feature_config)]
    if entry['session_id'] != 'S01_TRAIN' or entry['kind'] == 'positives':
        return regular
    if entry['split'] != 'train' or entry['annotation']['wake_intervals'] or not entry['annotation']['wake_absence_confirmed']:
        raise ValueError('Prefix negatives require reviewed whole-record S01 absence')
    for seconds in PREFIX_SECONDS:
        end = min(round(seconds*feature_config['sample_rate']), entry['frames'])
        existing = next((w for w in regular if w['end_sample']==end), None)
        if existing is None:
            existing = dict(end_sample=end, label=0, regular=False, prefix_seconds=[])
            regular.append(existing)
        existing['prefix_seconds'].append(seconds)
    return regular


def epoch_batches(group, epoch, config):
    if len(group['wake'])!=40 or len(group['echo'])!=4 or len(group['ordinary'])<36:
        raise ValueError('Frozen S01 class counts not met')
    rng=random.Random(config['seed']+epoch)
    ordinary=group['ordinary'];offset=(epoch*36)%len(ordinary)
    chosen=[ordinary[(offset+i)%len(ordinary)] for i in range(36)]
    rng.shuffle(chosen)
    echo=list(group['echo']);rng.shuffle(echo)
    prefix_ids=chosen[:18]+echo[:2]
    rng.shuffle(prefix_ids)
    prefixes=[dict(recording_id=rid,label=0,stratum='prefix',prefix_seconds=PREFIX_SECONDS[(epoch+i)%4]) for i,rid in enumerate(prefix_ids)]
    regular_ids=chosen[18:]+echo[2:]
    quiet=set(chosen[18:27]+echo[2:3])
    regular=[dict(recording_id=rid,label=0,stratum='quiet_regular' if rid in quiet else 'regular_rotating') for rid in regular_ids]
    wakes=[dict(recording_id=rid,label=1,stratum='complete_wake') for rid in group['wake']]
    rng.shuffle(wakes);rng.shuffle(regular)
    result=[]
    for i in range(5):
        batch=wakes[i*8:(i+1)*8]+prefixes[i*4:(i+1)*4]+regular[i*4:(i+1)*4]
        rng.shuffle(batch);result.append(batch)
    return result


def select_context(spec, candidates, rms, epoch):
    if spec['stratum']=='prefix':
        return next(i for i,w in enumerate(candidates) if spec['prefix_seconds'] in w['prefix_seconds'])
    regular=[i for i,w in enumerate(candidates) if w['regular']]
    if spec['stratum']=='quiet_regular':
        return min(regular,key=lambda i:(rms[i],i))
    return regular[epoch%len(regular)]


def verify_normalization(mean, std, train_ids, np):
    prior=k.read(PRIOR/'normalization.json')
    if prior['fitted_recordings']!=train_ids or not np.array_equal(mean,np.array(prior['mean'],dtype='float32')) or not np.array_equal(std,np.array(prior['std'],dtype='float32')):
        raise ValueError('Sampler-only repair requires exact prior S01 normalization')


def save_controls(run, model, feature, mean, std, audio, entries, config, np):
    from kural_audio_features import causal_context
    def score(samples,end):
        value=feature(causal_context(samples,end,32000,np))
        return float(model((((value-mean[0])/std[0])[None,...,None]),training=False).numpy()[0,1])
    controls=[]
    for seconds in (0,.08,.16,.5,1,2,3):
        samples=np.zeros(round(seconds*16000),dtype='float32')
        controls.append(dict(real_silent_seconds=seconds,wake_score=score(samples,len(samples)),synthetic_padding_seconds=max(0,2-seconds)))
    prefixes=[]
    for rid,e in entries.items():
        if e['session_id']!='S01_TRAIN' or e['kind']=='positives':continue
        for seconds in PREFIX_SECONDS:
            end=min(round(seconds*16000),len(audio[rid]))
            prefixes.append(dict(recording_id=rid,session_id='S01_TRAIN',echo_case=e['echo_case'],prefix_seconds=seconds,end_sample=end,wake_score=score(audio[rid],end)))
    summary={}
    for seconds in PREFIX_SECONDS:
        values=np.array([p['wake_score'] for p in prefixes if p['prefix_seconds']==seconds])
        summary[str(seconds)]=dict(count=len(values),minimum=float(values.min()),median=float(np.median(values)),maximum=float(values.max()))
    k.write_new(run/'silence-controls.json',dict(digital_silence=controls,reviewed_negative_prefix_summary=summary,reviewed_negative_prefixes=prefixes,diagnostic_only=True,used_in_qualification=False))


def launch():
    config=k.read(CONFIG);prior=k.read(PRIOR/'config.json')
    unchanged=('seed','max_epochs','wall_limit_seconds','early_stopping_patience','early_stopping_min_delta','conv_filters','learning_rate','threshold_candidates','qualification','decision_consecutive_frames','decision_cooldown_seconds','event_match_grace_seconds')
    if any(config[key]!=prior[key] for key in unchanged):raise ValueError('Repair changed frozen non-sampling settings')
    audit=k.validate(k.read(k.CONFIG))
    if not audit['ready']:raise ValueError('Data gate blocked')
    epoch_batches(binary.groups(audit['entries'],'S01_TRAIN'),0,config)
    dependencies=k.dependency_probe(k.ROOT/'environment/Scripts/python.exe')
    reservation=k.ROOT/'negative-context-v2-reservation.json'
    if reservation.exists():raise ValueError('Repair already reserved; no automatic repeats')
    run=k.ROOT/'negative-context-runs'/('negative-context-'+uuid.uuid4().hex)
    run.mkdir(parents=True)
    protected=[k.ROOT/'runs/baseline-5f8ee6cd19174de58759932ff48938bb',k.ROOT/'overfit-diagnostic-08e2f5a619eb43b7918b66b52dca11ea',PRIOR,k.ROOT/'context-policy-replay-ffae2a7a725d457783217e9410a6be2e']
    k.write_new(run/'protected-hashes.json',{str(p):binary.snapshot(p) for p in protected})
    k.write_new(run/'config.json',config);k.write_new(run/'feature-config.json',k.read(k.CONFIG));k.write_new(run/'dataset.json',audit);k.write_new(run/'dependencies.json',dependencies)
    identity=dict(dataset_fingerprint=audit['dataset_fingerprint'],config_sha256=k.digest(CONFIG),source_sha256={p.name:k.digest(p) for p in (Path(__file__),k.TOOLS/'kural_binary_experiment.py',k.TOOLS/'kural_audio_features.py',k.TOOLS/'kural_training.py')},annotation_hashes={s:k.digest(k.ROOT/('annotations/'+s+'.annotations.json')) for s in ('S01_TRAIN','S02_VALID')})
    k.write_new(run/'identity.json',identity);k.write_new(run/'state.json',dict(status='reserved',epochs=0,best_loss=None,wait=0));k.write_new(reservation,dict(run=str(run),identity=k.fingerprint(identity)))
    print('Frozen negative-context repair:',run,'\nLog:',run/'attempt.log',flush=True)
    env=os.environ.copy();env.update(CUDA_VISIBLE_DEVICES='-1',TF_DETERMINISTIC_OPS='1',TF_ENABLE_ONEDNN_OPTS='0',PYTHONHASHSEED='1729',KURAL_BINARY_GATED='1')
    started=time.monotonic()
    try:
        with (run/'attempt.log').open('x',encoding='utf-8') as log:
            subprocess.run([str(k.ROOT/'environment/Scripts/python.exe'),str(Path(__file__).resolve()),'--worker',str(run)],stdout=log,stderr=subprocess.STDOUT,env=env,timeout=config['wall_limit_seconds'],check=True)
    except (subprocess.SubprocessError,OSError) as error:
        state=k.read(run/'state.json');state.update(status='interrupted',error_type=type(error).__name__,total_elapsed_seconds=time.monotonic()-started);k.atomic_json(run/'state.json',state);raise
    state=k.read(run/'state.json');state['total_elapsed_seconds']=time.monotonic()-started;k.atomic_json(run/'state.json',state)
    for folder,hashes in k.read(run/'protected-hashes.json').items():
        if binary.snapshot(Path(folder))!=hashes:raise ValueError('Protected evidence changed')
    for s,h in identity['annotation_hashes'].items():
        if k.digest(k.ROOT/('annotations/'+s+'.annotations.json'))!=h:raise ValueError('Annotations changed')
    k.write_new(run/'artifact-hashes.json',binary.snapshot(run));print('Finished:',json.dumps(state),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',action='store_true');parser.add_argument('--worker',type=Path);args=parser.parse_args()
    if args.worker:
        import kural_negative_context_experiment as repair
        binary.worker(args.worker,repair=repair)
    elif args.run:launch()
    else:print('Disabled; --run authorizes one bounded sampler-only experiment.')


if __name__=='__main__':main()
