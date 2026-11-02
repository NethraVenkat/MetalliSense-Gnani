"""One reserved data-only paired experiment; no downloads or activation."""
import argparse
import copy
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import time
import uuid
import wave
import kural_training as k
import kural_binary_experiment as binary
import kural_negative_context_experiment as previous
import kural_paired_v2_preflight as gate

TRAINING_SESSIONS=('S01_TRAIN','TRAIN_PAIRED_V1')
ROOT=k.TOOLS/'local_wake_data/kural-cnn-v2-paired'


def training_groups(entries):
    selected=[dict(e,session_id='S01_TRAIN') for e in entries if e['session_id'] in TRAINING_SESSIONS]
    return binary.groups(selected,'S01_TRAIN')


def contexts(entry,fc):
    # Same context algorithm for appended sources, retaining actual lineage outside it.
    proxy=dict(entry,session_id='S01_TRAIN') if entry['session_id']=='TRAIN_PAIRED_V1' else entry
    return previous.contexts(proxy,fc)


def epoch_batches(group,epoch,config):
    group=copy.deepcopy(group)
    if len(group['wake'])<40:raise ValueError('Too few training wakes')
    offset=(epoch*40)%len(group['wake'])
    group['wake']=[group['wake'][(offset+i)%len(group['wake'])] for i in range(40)]
    return previous.epoch_batches(group,epoch,config)


select_context=previous.select_context


def verify_normalization(mean,std,train_ids,np):
    prior=k.read(gate.V1/'normalization.json')
    if train_ids!=prior['fitted_recordings'] or not np.array_equal(mean,np.array(prior['mean'],dtype='float32')) or not np.array_equal(std,np.array(prior['std'],dtype='float32')):
        raise ValueError('Exact frozen v1 normalization parity failed')


def save_controls(*args):
    pass  # No extra synthesis, silence probes or auxiliary inference in this run.


def convert(entry,session,split):
    meta=entry['meta']
    return dict(recording_id=entry['recording_id'],original_recording_id=entry['recording_id'],speaker_id='manish',session_id=session,split=split,kind='positives' if entry['label']=='wake' else 'speech_negatives',echo_case=False,consent=meta['consent'],content_approved=True,wav=entry['wav'],wav_sha256=entry['wav_sha256'],pcm_sha256=entry['pcm_sha256'],frames=entry['frames'],duration_seconds=entry['duration_seconds'],annotation=dict(wake_intervals=meta['wake_intervals'],wake_absence_confirmed=meta.get('wake_absence_confirmed',False)),task_id=entry['task_id'],boundary_review_source=entry.get('boundary_review_source'))


def table_rows(dev,s02,config,s02_evaluation=None):
    if tuple(config['threshold_candidates'])!=gate.THRESHOLDS:raise ValueError('Only fixed thresholds allowed')
    rows=[]
    for threshold in gate.THRESHOLDS:
        strict=dict(config,event_match_grace_seconds=0.0)
        d=k.metrics(dev,threshold,strict);s=next(r['metrics'] for r in s02_evaluation['candidates'] if r['threshold']==threshold) if s02_evaluation else k.metrics(s02,threshold,config)
        conversation=sum(len(k.events(r['times'],r['wake_scores'],threshold,2,1)) for r in dev if r['task_id']=='manish-DC01')
        confusables=sum(len(k.events(r['times'],r['wake_scores'],threshold,2,1)) for r in dev if r['task_id'].startswith('manish-DN'))
        s02_pass=binary.qualify(s,config)
        rows.append(dict(threshold=threshold,devval_wakes_detected=10-d['missed_wakes'],devval_wakes_total=d['annotated_human_wakes'],conversation_events=conversation,confusable_events=confusables,S02_pass=s02_pass,S02=s,devval=d,PASS=d['annotated_human_wakes']==10 and d['missed_wakes']<=1 and conversation==0 and confusables==0 and s02_pass))
    return rows


def evaluate_extra(run):
    import tensorflow as tf
    import numpy as np
    from kural_audio_features import build_feature_extractor,causal_context
    fc=k.read(run/'feature-config.json');config=k.read(run/'config.json');norm=k.read(run/'normalization.json')
    feature=build_feature_extractor(fc,tf,np);mean=np.array(norm['mean'],dtype='float32');std=np.array(norm['std'],dtype='float32')
    audit=k.read(run/'dataset.json');dev=k.read(run/'devval-dataset.json');state=k.read(run/'state.json');old=k.read(gate.V1/'state.json')
    records={}
    for version,checkpoint,entries in [('v2',run/state['best_checkpoint'],dev),('v1',gate.V1/old['best_checkpoint'],dev+[e for e in audit['entries'] if e['session_id']=='S02_VALID'])]:
        model=tf.keras.models.load_model(checkpoint,compile=False);pred=[]
        for e in entries:
            if k.digest(e['wav'])!=e['wav_sha256']:raise ValueError('Evaluation audio changed')
            with wave.open(e['wav'],'rb') as source:samples=np.frombuffer(source.readframes(source.getnframes()),dtype='<i2').astype('float32')/32768
            ends=list(range(fc['replay_hop_samples'],len(samples)+1,fc['replay_hop_samples']))
            if not ends or ends[-1]!=len(samples):ends.append(len(samples))
            probabilities=[]
            for i in range(0,len(ends),32):
                x=np.stack([feature(causal_context(samples,end,fc['window_samples'],np)) for end in ends[i:i+32]])
                probabilities.extend(model(((x-mean)/std)[...,None],training=False).numpy()[:,1].tolist())
            pred.append(dict(recording_id=e['recording_id'],task_id=e.get('task_id',''),session_id=e['session_id'],duration_seconds=e['duration_seconds'],echo_case=e['echo_case'],human_wakes=[w for w in e['annotation']['wake_intervals'] if w['source']=='human'],times=[end/16000 for end in ends],wake_scores=probabilities))
        records[version]=pred;k.write_new(run/(version+'-additional-predictions.json'),pred)
    v2s02=k.read(run/'predictions.json')['records']
    results=dict(builder='Manish',thresholds=list(gate.THRESHOLDS),S03='S03 not available, not evaluated',v1=table_rows([r for r in records['v1'] if r['session_id']=='DEVVAL_V1'],[r for r in records['v1'] if r['session_id']=='S02_VALID'],config),v2=table_rows(records['v2'],v2s02,config,k.read(run/'threshold-selection.json')))
    results['qualified_thresholds']=[r['threshold'] for r in results['v2'] if r['PASS']];results['outcome']='PASS' if results['qualified_thresholds'] else 'FAIL';results['deployment_approved']=False
    k.write_new(run/'results.json',results)
    state=k.read(run/'state.json');state['s02_only_qualified_threshold']=state.pop('qualified_threshold',None);state['qualified_threshold']=results['qualified_thresholds'][0] if results['qualified_thresholds'] else None;state['overall_outcome']=results['outcome'];k.atomic_json(run/'state.json',state)
    print('RESULT:',results['outcome'],results['qualified_thresholds'],flush=True)


def launch(preflight):
    report=k.read(preflight)
    if report['status']!='DATA_CHECK_PASSED_NOT_TRAINED' or report['missing_training_boundaries']:raise ValueError('Preflight gate failed')
    for p,digest in report['protected_hashes'].items():
        if k.digest(p)!=digest:raise ValueError('Preflight evidence changed')
    prior=k.read(gate.V1/'dataset.json');train=report['training_list'];original=[e for e in train if 'session_id' in e];paired=[convert(e,'TRAIN_PAIRED_V1','train') for e in train if 'meta' in e]
    dev,_=gate.accepted('devval-v1');dev=[convert(e,'DEVVAL_V1','validation') for e in dev]
    s02=[e for e in prior['entries'] if e['session_id']=='S02_VALID'];forbidden={h for e in dev+s02 for h in (e['wav_sha256'],e['pcm_sha256'])};gate.no_leakage(original+paired,forbidden)
    if len(original)!=125 or len(paired)!=40 or len({e['recording_id'] for e in original+paired})!=165:raise ValueError('Training list mismatch')
    reservation=ROOT/'single-run-reservation.json'
    if reservation.exists():raise ValueError('Single authorized run already reserved; do not repeat')
    dependencies=k.dependency_probe(k.ROOT/'environment/Scripts/python.exe');config=k.read(gate.V1/'config.json')
    run=ROOT/('kural-cnn-v2-paired-'+uuid.uuid4().hex);run.mkdir()
    k.write_new(run/'config.json',config);k.write_new(run/'feature-config.json',k.read(gate.V1/'feature-config.json'));k.write_new(run/'dataset.json',dict(ready=True,entries=original+paired+s02));k.write_new(run/'devval-dataset.json',dev);k.write_new(run/'dependencies.json',dependencies);k.write_new(run/'protected-hashes.json',report['protected_hashes'])
    k.write_new(run/'identity.json',dict(annotation_hashes=k.read(gate.V1/'identity.json')['annotation_hashes'],preflight_sha256=k.digest(preflight),source_hashes={p.name:k.digest(p) for p in (Path(__file__),k.TOOLS/'kural_binary_experiment.py',k.TOOLS/'kural_audio_features.py',k.TOOLS/'kural_negative_context_experiment.py')}))
    k.write_new(run/'state.json',dict(status='reserved',epochs=0,best_loss=None,wait=0));k.write_new(reservation,dict(run=str(run),preflight=str(preflight)))
    env=os.environ.copy();env.update(CUDA_VISIBLE_DEVICES='-1',TF_DETERMINISTIC_OPS='1',TF_ENABLE_ONEDNN_OPTS='0',PYTHONHASHSEED='1729',KURAL_BINARY_GATED='1')
    print('ONE RUN:',run,flush=True);started=time.monotonic()
    try:
        with (run/'attempt.log').open('x',encoding='utf-8') as log:subprocess.run([str(k.ROOT/'environment/Scripts/python.exe'),str(Path(__file__).resolve()),'--worker',str(run)],stdout=log,stderr=subprocess.STDOUT,env=env,timeout=3600,check=True)
    except Exception as error:
        state=k.read(run/'state.json');state.update(status='interrupted',error_type=type(error).__name__,total_elapsed_seconds=time.monotonic()-started);k.atomic_json(run/'state.json',state);raise
    state=k.read(run/'state.json');state['total_elapsed_seconds']=time.monotonic()-started;k.atomic_json(run/'state.json',state)
    for p,digest in report['protected_hashes'].items():
        if k.digest(p)!=digest:raise ValueError('Protected evidence changed')
    k.write_new(run/'artifact-hashes.json',binary.snapshot(run));print('FINISHED:',run,json.dumps(state),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',type=Path);parser.add_argument('--worker',type=Path);args=parser.parse_args()
    if args.worker:
        binary.worker(args.worker,repair=sys.modules[__name__]);evaluate_extra(args.worker)
    elif args.run:launch(args.run)
    else:print('Disabled. --run requires a passed frozen preflight; one reservation only.')
