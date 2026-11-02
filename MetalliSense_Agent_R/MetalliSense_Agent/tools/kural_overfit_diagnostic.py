"""Default-off S01-only balanced memorization diagnostic. Never deployment/training baseline."""
import argparse
import os
from pathlib import Path
import sys
import time
import uuid
import wave


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',action='store_true')
    args=parser.parse_args()
    if not args.run:
        print('Disabled; explicit --run required. Diagnostic only.');return
    import kural_training as k
    if Path(sys.prefix).resolve()!=(k.ROOT/'environment').resolve():
        raise ValueError('Use isolated training interpreter')
    os.environ.update(CUDA_VISIBLE_DEVICES='-1',TF_DETERMINISTIC_OPS='1',TF_ENABLE_ONEDNN_OPTS='0')
    import tensorflow as tf
    import numpy as np
    from kural_audio_features import build_feature_extractor,training_statistics,offline_context,causal_context
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.keras.utils.set_random_seed(1729);tf.config.experimental.enable_op_determinism()
    audit=k.validate(k.read(k.CONFIG))
    if not audit['ready']:raise ValueError('Reviewed data gate required')
    choices=[]
    for kind in ('negatives','positives'):
        eligible=sorted([e for e in audit['entries'] if e['session_id']=='S01_TRAIN' and e['split']=='train' and e['kind']==kind and not e['echo_case']],key=lambda e:e['recording_id'])
        if len(eligible)<8:raise ValueError('Need eight distinct reviewed S01 recordings per class')
        choices.extend(eligible[:8])
    reservation=k.ROOT/'overfit-diagnostic-reservation.json'
    if reservation.exists():raise ValueError('One diagnostic already reserved; inspect saved evidence, no automatic repeated tuning')
    out=k.ROOT/('overfit-diagnostic-'+uuid.uuid4().hex);out.mkdir()
    k.write_new(reservation,dict(directory=str(out),diagnostic_only=True))
    baseline=k.ROOT/'runs/baseline-5f8ee6cd19174de58759932ff48938bb'
    baseline_hashes={str(p.relative_to(baseline)):k.digest(p) for p in baseline.rglob('*') if p.is_file()}
    annotations={s:k.digest(k.ROOT/('annotations/'+s+'.annotations.json')) for s in ('S01_TRAIN','S02_VALID')}
    config=k.read(k.CONFIG);feature=build_feature_extractor(config,tf,np);features=[];rows=[];labels=[]
    for entry in choices:
        assert entry['session_id']=='S01_TRAIN'
        with wave.open(entry['wav'],'rb') as source:audio=np.frombuffer(source.readframes(source.getnframes()),dtype='<i2').astype('float32')/32768
        window=k.windows(entry,config)[0]
        end=min(round(window['start_seconds']*16000)+32000,len(audio))
        first=feature(offline_context(audio,window['start_seconds'],config,np))
        second=feature(causal_context(audio,end,32000,np))
        assert np.array_equal(first,second)
        features.append(first);labels.append(int(entry['kind']=='positives'))
        rows.append(dict(recording_id=entry['recording_id'],wav_sha256=entry['wav_sha256'],session_id=entry['session_id'],original_recording_id=entry['original_recording_id'],kind=entry['kind'],window_start=window['start_seconds'],context_end_sample=end,annotation=entry['annotation']))
    for length in (0,8000,32000,48000):
        samples=np.random.default_rng(1729).normal(0,.01,length).astype('float32')
        assert np.array_equal(feature(offline_context(samples,0,config,np)),feature(causal_context(samples,min(length,32000),32000,np)))
    raw=np.stack(features);mean,std=training_statistics(raw,np);x=((raw-mean)/std)[...,None];y=np.array(labels)
    assert np.isfinite(x).all()
    experiment=dict(seed=1729,classes=['ordinary_nonwake','human_wake'],counts=[8,8],max_epochs=100,time_limit_seconds=300,batch_size=16,learning_rate=.001,architecture='Conv16/32/32 stride2 + global average pooling + Dense2 softmax',stop_rule='5 consecutive epochs 16/16 correct and cross_entropy <0.1',normalization_fit='selected S01 examples only',echo_included=False,selection='first eight recording IDs sorted within each class; first reviewed offline context',feature_source_sha256=k.digest(k.TOOLS/'kural_audio_features.py'),dataset_fingerprint=audit['dataset_fingerprint'],diagnostic_only=True,deployable=False)
    k.write_new(out/'config.json',experiment);k.write_new(out/'examples.json',dict(records=rows));k.write_new(out/'normalization.json',dict(mean=mean.tolist(),std=std.tolist(),fitted_session='S01_TRAIN selected subset'))
    model=tf.keras.Sequential([tf.keras.layers.Input(shape=x.shape[1:]),*[tf.keras.layers.Conv2D(n,3,strides=2,padding='same',activation='relu') for n in (16,32,32)],tf.keras.layers.GlobalAveragePooling2D(),tf.keras.layers.Dense(2,activation='softmax')])
    model.compile(optimizer=tf.keras.optimizers.Adam(.001),loss='sparse_categorical_crossentropy')
    started=time.monotonic();stable=0;history=[]
    for epoch in range(100):
        if time.monotonic()-started>=300:break
        model.train_on_batch(x,y)
        probs=model(x,training=False).numpy();pred=probs.argmax(axis=1);loss=float(-np.log(np.clip(probs[np.arange(16),y],1e-7,1)).mean());correct=int((pred==y).sum())
        stable=stable+1 if correct==16 and loss<.1 else 0
        row=dict(epoch=epoch+1,loss=loss,correct=correct,ordinary_correct=int((pred[:8]==0).sum()),wake_correct=int((pred[8:]==1).sum()),elapsed_seconds=time.monotonic()-started)
        history.append(row)
        with (out/'epochs.jsonl').open('a',encoding='utf-8') as log:log.write(__import__('json').dumps(row)+'\n')
        if epoch%10==0 or stable>=5:print(row,flush=True)
        if stable>=5:break
    model.save(out/'diagnostic-only.keras')
    predictions=[dict(recording_id=r['recording_id'],true_class=int(y[i]),probabilities=probs[i].tolist(),predicted_class=int(pred[i])) for i,r in enumerate(rows)]
    assert baseline_hashes=={str(p.relative_to(baseline)):k.digest(p) for p in baseline.rglob('*') if p.is_file()}
    assert all(k.digest(k.ROOT/('annotations/'+s+'.annotations.json'))==h for s,h in annotations.items())
    result=dict(passed=stable>=5,epochs=len(history),final_loss=loss,correct=correct,ordinary_correct=int((pred[:8]==0).sum()),wake_correct=int((pred[8:]==1).sum()),elapsed_seconds=time.monotonic()-started,predictions=predictions,baseline_hashes_unchanged=True,annotation_hashes_unchanged=True,offline_replay_feature_parity=True,S02_fitted=False,deployable=False)
    k.write_new(out/'result.json',result);k.write_new(out/'baseline-hashes.json',baseline_hashes)
    print(__import__('json').dumps(result,indent=2));print('Evidence:',out)


if __name__=='__main__':main()
