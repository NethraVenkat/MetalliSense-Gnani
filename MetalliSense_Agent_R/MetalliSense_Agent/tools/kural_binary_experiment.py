"""One default-off binary experiment. S01 fitting, S02 selection; no activation."""
import argparse
from collections import Counter
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

CONFIG = Path(__file__).with_name('kural_binary_config.json')


def groups(entries, session):
    if session not in ('S01_TRAIN', 'S02_VALID'):
        raise ValueError('Only training/validation sessions supported')
    result = {'wake': [], 'ordinary': [], 'echo': []}
    for entry in entries:
        if entry['session_id'] != session:
            continue
        if entry['split'] != ('train' if session == 'S01_TRAIN' else 'validation'):
            raise ValueError('Session/split mismatch')
        intervals = entry['annotation']['wake_intervals']
        if entry['echo_case']:
            if intervals or not entry['annotation']['wake_absence_confirmed']:
                raise ValueError('Binary echo recipe accepts reviewed wake-free playback only')
            result['echo'].append(entry['recording_id'])
        elif entry['kind'] == 'positives':
            if not intervals:
                raise ValueError('Wake requires reviewed interval')
            result['wake'].append(entry['recording_id'])
        else:
            if intervals or not entry['annotation']['wake_absence_confirmed']:
                raise ValueError('Nonwake requires reviewed absence')
            result['ordinary'].append(entry['recording_id'])
    return {name: sorted(ids) for name, ids in result.items()}


def candidates(entry, feature_config):
    result, seen = [], set()
    for window in k.windows(entry, feature_config):
        end = min(round(window['start_seconds'] * feature_config['sample_rate']) + feature_config['window_samples'], entry['frames'])
        if end in seen:
            continue
        seen.add(end)
        result.append(dict(end_sample=end, label=int(entry['kind'] == 'positives' and not entry['echo_case'])))
    if not result:
        raise ValueError('No candidate context: ' + entry['recording_id'])
    return result


def epoch_batches(group, epoch, config):
    if len(group['wake']) != 40 or len(group['echo']) != 4 or len(group['ordinary']) < 36:
        raise ValueError('Frozen recipe requires 40 S01 wakes, 4 echo, >=36 ordinary records')
    wake = list(group['wake'])
    ordinary = group['ordinary']
    offset = (epoch * 36) % len(ordinary)
    nonwake = [ordinary[(offset+i) % len(ordinary)] for i in range(36)] + list(group['echo'])
    rng = random.Random(config['seed'] + epoch)
    rng.shuffle(wake)
    rng.shuffle(nonwake)
    batches = []
    for i in range(0, 40, 8):
        batch = [(rid, 1) for rid in wake[i:i+8]] + [(rid, 0) for rid in nonwake[i:i+8]]
        rng.shuffle(batch)
        batches.append(batch)
    return batches


def qualify(metrics, config):
    q = config['qualification']
    return (metrics['annotated_human_wakes'] == 20 and
            metrics['missed_wake_rate'] is not None and 1-metrics['missed_wake_rate'] >= q['minimum_wake_recall'] and
            metrics['false_events'] <= q['maximum_ordinary_false_events'] and
            metrics['echo_events'] <= q['maximum_echo_events'] and
            metrics['unmatched_events_in_positive_clips'] <= q['maximum_unmatched_positive_events'] and
            metrics['ordinary_negative_seconds'] >= q['minimum_ordinary_negative_seconds'] and
            metrics['echo_seconds'] >= q['minimum_echo_seconds'])


def evaluate_predictions(predictions, config):
    values = []
    for threshold in config['threshold_candidates']:
        metrics = k.metrics(predictions, threshold, config)
        values.append(dict(threshold=threshold, qualified=qualify(metrics, config), metrics=metrics))
    qualified = [v for v in values if v['qualified']]
    selected = min(qualified, key=lambda v: (v['metrics']['missed_wakes'], v['metrics']['false_events'], -v['threshold'])) if qualified else None
    return dict(qualified_threshold=selected['threshold'] if selected else None,
                qualified_metrics=selected['metrics'] if selected else None, candidates=values,
                selection_split='S02_VALID', final_test=False, deployment_approved=False)


def snapshot(folder):
    return {str(p.relative_to(folder)): k.digest(p) for p in folder.rglob('*') if p.is_file()}


def launch():
    config = k.read(CONFIG)
    if config['seed'] != 1729 or config['max_epochs'] != 50 or config['wall_limit_seconds'] != 3600:
        raise ValueError('Frozen seed/limits mismatch')
    audit = k.validate(k.read(k.CONFIG))
    if not audit['ready']:
        raise ValueError('Data gate blocked: ' + repr(audit['missing']))
    epoch_batches(groups(audit['entries'], 'S01_TRAIN'), 0, config)
    dependencies = k.dependency_probe(k.ROOT/'environment/Scripts/python.exe')
    reservation = k.ROOT/'binary-v1-reservation.json'
    if reservation.exists():
        raise ValueError('Binary v1 already reserved; preserve evidence, no automatic repeated run')
    run = k.ROOT/'binary-runs'/('binary-'+uuid.uuid4().hex)
    run.mkdir(parents=True)
    protected = [k.ROOT/'runs/baseline-5f8ee6cd19174de58759932ff48938bb', k.ROOT/'overfit-diagnostic-08e2f5a619eb43b7918b66b52dca11ea']
    k.write_new(run/'protected-hashes.json', {str(p): snapshot(p) for p in protected})
    k.write_new(run/'config.json', config)
    k.write_new(run/'feature-config.json', k.read(k.CONFIG))
    k.write_new(run/'dataset.json', audit)
    k.write_new(run/'dependencies.json', dependencies)
    identity = dict(dataset_fingerprint=audit['dataset_fingerprint'], config_sha256=k.digest(CONFIG),
                    sources={p.name:k.digest(p) for p in (Path(__file__), k.TOOLS/'kural_audio_features.py', k.TOOLS/'kural_training.py')},
                    annotation_hashes={s:k.digest(k.ROOT/('annotations/'+s+'.annotations.json')) for s in ('S01_TRAIN','S02_VALID')})
    k.write_new(run/'identity.json', identity)
    k.write_new(run/'state.json', dict(status='reserved',epochs=0,best_loss=None,wait=0))
    k.write_new(reservation, dict(run=str(run),identity=k.fingerprint(identity)))
    print('Frozen binary run:', run, '\nLog:', run/'attempt.log', flush=True)
    env = os.environ.copy()
    env.update(CUDA_VISIBLE_DEVICES='-1', TF_DETERMINISTIC_OPS='1', TF_ENABLE_ONEDNN_OPTS='0', PYTHONHASHSEED='1729', KURAL_BINARY_GATED='1')
    started = time.monotonic()
    try:
        with (run/'attempt.log').open('x',encoding='utf-8') as log:
            subprocess.run([str(k.ROOT/'environment/Scripts/python.exe'), str(Path(__file__).resolve()), '--worker', str(run)], stdout=log, stderr=subprocess.STDOUT, env=env, timeout=3600, check=True)
    except (subprocess.SubprocessError,OSError) as error:
        state=k.read(run/'state.json')
        state.update(status='interrupted',error_type=type(error).__name__,total_elapsed_seconds=time.monotonic()-started)
        k.atomic_json(run/'state.json',state)
        raise
    state=k.read(run/'state.json')
    state['total_elapsed_seconds']=time.monotonic()-started
    k.atomic_json(run/'state.json',state)
    for folder, hashes in k.read(run/'protected-hashes.json').items():
        if snapshot(Path(folder)) != hashes:
            raise ValueError('Protected evidence changed')
    for s,h in identity['annotation_hashes'].items():
        if k.digest(k.ROOT/('annotations/'+s+'.annotations.json')) != h:
            raise ValueError('Annotations changed')
    k.write_new(run/'artifact-hashes.json',snapshot(run))
    print('Finished:', json.dumps(state), flush=True)


def worker(run, repair=None):
    if os.environ.get('KURAL_BINARY_GATED') != '1' or Path(sys.prefix).resolve() != (k.ROOT/'environment').resolve():
        raise ValueError('Use the gated isolated parent')
    import tensorflow as tf
    import numpy as np
    from kural_audio_features import build_feature_extractor, causal_context, training_statistics
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.keras.utils.set_random_seed(1729)
    tf.config.experimental.enable_op_determinism()
    config=k.read(run/'config.json');fc=k.read(run/'feature-config.json');audit=k.read(run/'dataset.json')
    for s,h in k.read(run/'identity.json')['annotation_hashes'].items():
        if k.digest(k.ROOT/('annotations/'+s+'.annotations.json')) != h:raise ValueError('Labels changed')
    entries={e['recording_id']:e for e in audit['entries']}
    train_group=repair.training_groups(audit['entries']) if repair and hasattr(repair,'training_groups') else groups(audit['entries'],'S01_TRAIN');val_group=groups(audit['entries'],'S02_VALID')
    training_sessions=getattr(repair,'TRAINING_SESSIONS',('S01_TRAIN',))
    feature=build_feature_extractor(fc,tf,np);audio={};pool={};lineage=[];context_specs={};rms_pool={}
    for rid,e in entries.items():
        if k.digest(e['wav']) != e['wav_sha256']:raise ValueError('Audio changed')
        with wave.open(e['wav'],'rb') as source:
            samples=np.frombuffer(source.readframes(source.getnframes()),dtype='<i2').astype('float32')/32768
        audio[rid]=samples
        windows=repair.contexts(e,fc) if repair else candidates(e,fc)
        context_specs[rid]=windows
        if repair and e['session_id'] in training_sessions:
            rms_pool[rid]=[float(np.sqrt(np.mean(causal_context(samples,w['end_sample'],fc['window_samples'],np)**2))) for w in windows]
        pool[rid]=np.stack([feature(causal_context(samples,w['end_sample'],fc['window_samples'],np)) for w in windows])
        lineage.extend(dict(recording_id=rid,session_id=e['session_id'],split=e['split'],echo_case=e['echo_case'],**w) for w in windows)
    train_ids=sorted(rid for rid,e in entries.items() if e['session_id']=='S01_TRAIN')
    mean,std=training_statistics(np.stack([pool[rid][0] for rid in train_ids]),np)
    if repair:repair.verify_normalization(mean,std,train_ids,np)
    k.write_new(run/'normalization.json',dict(mean=mean.tolist(),std=std.tolist(),fitted_recordings=train_ids,fitted_session='S01_TRAIN',context_index=0))
    k.write_new(run/'window-lineage.json',dict(records=lineage))
    for rid in pool:
        pool[rid]=((pool[rid]-mean)/std)[...,None]
        if not np.isfinite(pool[rid]).all():raise ValueError('Nonfinite features')
    model=tf.keras.Sequential([tf.keras.layers.Input(shape=(198,40,1)),*[tf.keras.layers.Conv2D(n,3,strides=2,padding='same',activation='relu') for n in config['conv_filters']],tf.keras.layers.GlobalAveragePooling2D(),tf.keras.layers.Dense(2,activation='softmax')])
    model.compile(optimizer=tf.keras.optimizers.Adam(config['learning_rate']),loss='sparse_categorical_crossentropy')
    def infer(x):
        return np.concatenate([model(x[i:i+32],training=False).numpy() for i in range(0,len(x),32)])
    def monitor(group):
        losses={0:[],1:[]};correct={0:0,1:0}
        for key,ids in group.items():
            label=int(key=='wake')
            for rid in ids:
                values=pool[rid][[i for i,w in enumerate(context_specs[rid]) if w['regular']]] if repair else pool[rid]
                p=infer(values);losses[label].append(float(-np.log(np.clip(p[:,label],1e-7,1)).mean()))
                correct[label]+=int((p[:,1].max()>=.5)==bool(label))
        return dict(loss=.5*(float(np.mean(losses[0]))+float(np.mean(losses[1]))),class_losses={str(c):float(np.mean(v)) for c,v in losses.items()},record_correct=correct,record_totals={0:len(group['ordinary'])+len(group['echo']),1:len(group['wake'])})
    state=k.read(run/'state.json');(run/'checkpoints').mkdir()
    start=time.monotonic()
    for epoch in range(config['max_epochs']):
        chosen=[]
        batches=repair.epoch_batches(train_group,epoch,config) if repair else epoch_batches(train_group,epoch,config)
        for batch in batches:
            x=[];y=[]
            for item in batch:
                if repair:
                    rid,label=item['recording_id'],item['label']
                    index=repair.select_context(item,context_specs[rid],rms_pool[rid],epoch)
                else:
                    rid,label=item
                    index=epoch%len(pool[rid])
                if entries[rid]['session_id'] not in training_sessions:raise ValueError('Only explicitly allowed training sessions may fit')
                x.append(pool[rid][index]);y.append(label)
                selected=dict(recording_id=rid,session_id=entries[rid]['session_id'],context_index=index,label=label)
                if repair:selected.update(stratum=item['stratum'],prefix_seconds=item.get('prefix_seconds'),end_sample=context_specs[rid][index]['end_sample'],rms=rms_pool[rid][index],echo_case=entries[rid]['echo_case'])
                chosen.append(selected)
            model.train_on_batch(np.stack(x),np.array(y))
        train=monitor(train_group);val=monitor(val_group)
        name=f'checkpoints/epoch-{epoch+1:02}.keras'
        model.save(run/name)
        improved=state['best_loss'] is None or val['loss']<state['best_loss']
        state.update(status='training',epochs=epoch+1,wait=0 if improved else state['wait']+1)
        if improved:state.update(best_loss=val['loss'],best_checkpoint=name,best_checkpoint_sha256=k.digest(run/name))
        row=dict(epoch=epoch+1,train=train,validation=val,selected=chosen,epoch_phase_elapsed_seconds=time.monotonic()-start)
        with (run/'epochs.jsonl').open('a',encoding='utf-8') as log:log.write(json.dumps(row)+'\n')
        k.atomic_json(run/'state.json',state)
        print('Epoch',epoch+1,'train',train['loss'],'val',val['loss'],'wake records',val['record_correct'][1],'/20','wait',state['wait'],flush=True)
        if state['wait']>=config['early_stopping_patience']:break
    state['epoch_phase_seconds']=time.monotonic()-start
    if k.digest(run/state['best_checkpoint']) != state['best_checkpoint_sha256']:raise ValueError('Checkpoint changed')
    loading=time.perf_counter();model=tf.keras.models.load_model(run/state['best_checkpoint'],compile=False);load_seconds=time.perf_counter()-loading
    if repair:repair.save_controls(run,model,feature,mean,std,audio,entries,config,np)
    predictions=[];processing=0
    for rid,e in entries.items():
        if e['session_id']!='S02_VALID':continue
        samples=audio[rid];ends=list(range(fc['replay_hop_samples'],len(samples)+1,fc['replay_hop_samples']))
        if not ends or ends[-1]!=len(samples):ends.append(len(samples))
        began=time.perf_counter()
        raw=np.stack([feature(causal_context(samples,end,fc['window_samples'],np)) for end in ends])
        probabilities=infer(((raw-mean)/std)[...,None]);processing+=time.perf_counter()-began
        predictions.append(dict(recording_id=rid,echo_case=e['echo_case'],duration_seconds=e['duration_seconds'],human_wakes=[w for w in e['annotation']['wake_intervals'] if w['source']=='human'],times=[end/fc['sample_rate'] for end in ends],wake_scores=probabilities[:,1].tolist(),class_probabilities=probabilities.tolist()))
    k.write_new(run/'predictions.json',dict(evaluation_split='S02_VALID',records=predictions,model_loading_seconds=load_seconds,inference_processing_seconds=processing))
    selection=evaluate_predictions(predictions,config)
    k.write_new(run/'threshold-selection.json',selection)
    distributions={}
    for name,subset in [('positives',[r for r in predictions if r['human_wakes']]),('ordinary_negatives',[r for r in predictions if not r['human_wakes'] and not r['echo_case']]),('echo',[r for r in predictions if r['echo_case']])]:
        scores=np.array([s for r in subset for s in r['wake_scores']]);maxima=np.array([max(r['wake_scores']) for r in subset])
        distributions[name]=dict(frames=len(scores),frame_min=float(scores.min()),frame_median=float(np.median(scores)),frame_max=float(scores.max()),clip_max_min=float(maxima.min()),clip_max_median=float(np.median(maxima)),clip_max_max=float(maxima.max()))
    k.write_new(run/'score-distributions.json',distributions)
    state.update(status='early_stopped' if state['wait']>=config['early_stopping_patience'] else 'complete',model_bytes=(run/state['best_checkpoint']).stat().st_size,predictions_sha256=k.digest(run/'predictions.json'),qualified_threshold=selection['qualified_threshold'])
    k.atomic_json(run/'state.json',state)
    print('Complete. Qualified threshold:',selection['qualified_threshold'],'no deployment approval.',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',action='store_true');parser.add_argument('--worker',type=Path)
    args=parser.parse_args()
    if args.worker:worker(args.worker)
    elif args.run:launch()
    else:print('Disabled; use --run only for the authorized single binary experiment.')


if __name__=='__main__':main()
