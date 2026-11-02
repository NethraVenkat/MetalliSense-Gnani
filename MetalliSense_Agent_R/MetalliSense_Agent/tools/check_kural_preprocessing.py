"""Explicit local preprocessing check. No model creation, training or installation."""
import argparse
import os
from pathlib import Path
import sys
import uuid
import wave


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if not args.check:
        print('Disabled; pass --check in the isolated environment.')
        return
    import kural_training as k
    if Path(sys.prefix).resolve() != (k.ROOT / 'environment').resolve():
        raise ValueError('Use the isolated training interpreter; Agent environment is not supported')
    os.environ.update(CUDA_VISIBLE_DEVICES='-1', TF_ENABLE_ONEDNN_OPTS='0', TF_DETERMINISTIC_OPS='1')
    import tensorflow as tf
    import keras
    import numpy as np
    from kural_audio_features import build_feature_extractor, training_statistics, offline_context, causal_context
    dependencies = k.dependency_probe(Path(sys.executable))
    config = k.read(k.CONFIG)
    audit = k.validate(config)
    if not audit['ready']:
        raise ValueError('Data gate blocked preprocessing check: ' + repr(audit['missing']))
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    hashes = {s:k.digest(k.ROOT / ('annotations/' + s + '.annotations.json')) for s in ('S01_TRAIN','S02_VALID')}
    feature = build_feature_extractor(config, tf, np)
    arrays = {'train':[], 'validation':[]}
    lineage = []
    expected = ((config['window_samples']-config['stft_frame'])//config['stft_hop']+1, config['mel_bins'])
    for entry in audit['entries']:
        with wave.open(entry['wav'], 'rb') as source:
            audio = np.frombuffer(source.readframes(source.getnframes()),dtype='<i2').astype('float32') / 32768
        for window in k.windows(entry, config):
            context = offline_context(audio, window['start_seconds'], config, np)
            value = feature(context)
            end = min(round(window['start_seconds']*config['sample_rate'])+config['window_samples'],len(audio))
            replay_value = feature(causal_context(audio,end,config['window_samples'],np))
            assert np.array_equal(value,replay_value), 'Offline/replay feature mismatch'
            if value.shape != expected or not np.isfinite(value).all():
                raise ValueError('Invalid feature shape/values: ' + entry['recording_id'])
            arrays[entry['split']].append(value)
            lineage.append(dict(recording_id=entry['recording_id'],original_recording_id=entry['original_recording_id'],session_id=entry['session_id'],split=entry['split'],**window))
    train, validation = np.stack(arrays['train']), np.stack(arrays['validation'])
    mean, std = training_statistics(train, np)
    assert np.isfinite(mean).all() and np.isfinite(std).all() and (std>0).all()
    train_norm, val_norm = ((train-mean)/std)[...,None], ((validation-mean)/std)[...,None]
    assert np.isfinite(train_norm).all() and np.isfinite(val_norm).all()
    # Deliberately perturb validation features; the training-only statistics stay identical.
    validation[:] = 12345
    again_mean, again_std = training_statistics(train, np)
    assert np.array_equal(mean, again_mean) and np.array_equal(std, again_std)
    assert all(e['session_id']=='S01_TRAIN' for e in lineage if e['split']=='train')
    assert all(e['session_id']=='S02_VALID' for e in lineage if e['split']=='validation')
    assert all(k.digest(k.ROOT/('annotations/'+s+'.annotations.json'))==h for s,h in hashes.items())
    result = dict(versions=dict(tensorflow=tf.__version__,keras=keras.__version__,numpy=np.__version__),dataset_fingerprint=audit['dataset_fingerprint'],config_sha256=k.digest(k.CONFIG),worker_sha256=k.digest(k.TOOLS/'kural_training_worker.py'),train_shape=list(train_norm.shape),validation_shape=list(val_norm.shape),feature_shape=list(expected)+[1],all_raw_and_normalized_features_finite=True,statistics_fitted_session='S01_TRAIN',validation_perturbation_changes_training_statistics=False,annotation_hashes=hashes,training_ran=False)
    evidence = k.ROOT/('preprocessing-smoke-'+uuid.uuid4().hex)
    evidence.mkdir()
    k.write_new(evidence/'result.json',result)
    k.write_new(evidence/'dependencies.json',dependencies)
    k.write_new(evidence/'normalization.json',dict(mean=mean.tolist(),std=std.tolist(),fitted_session='S01_TRAIN'))
    k.write_new(evidence/'window-lineage.json',lineage)
    print(__import__('json').dumps(result,indent=2))
    print('Evidence:',evidence)


if __name__ == '__main__':
    main()
