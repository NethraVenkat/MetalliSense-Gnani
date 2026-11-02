"""Run only via the isolated, data-gated parent. No downloads, capture or activation."""
from pathlib import Path
import json
import os
import sys
import time
import uuid
import wave

from kural_training import atomic_json, digest, read, windows, checkpoint_progress
from kural_audio_features import build_feature_extractor, training_statistics, offline_context, causal_context


def train(run, tf, np):
    config, audit, state = read(run / 'config.json'), read(run / 'dataset.json'), read(run / 'state.json')
    if not audit['ready'] or any(e['session_id'] not in ('S01_TRAIN', 'S02_VALID') for e in audit['entries']):
        raise ValueError('Invalid gated dataset')
    seed = config['seed']
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.keras.utils.set_random_seed(seed)
    tf.config.experimental.enable_op_determinism()
    size = config['window_samples']
    feature = build_feature_extractor(config, tf, np)
    def load(entry):
        if digest(entry['wav']) != entry['wav_sha256']:
            raise ValueError('Audio changed before feature preparation')
        with wave.open(entry['wav'], 'rb') as source:
            return np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').astype('float32') / 32768

    audio = {e['recording_id']:load(e) for e in audit['entries']}

    features, labels = {'train':[], 'validation':[]}, {'train':[], 'validation':[]}
    lineage = []
    for entry in audit['entries']:
        split = entry['split']
        for window in windows(entry, config):
            features[split].append(feature(offline_context(audio[entry['recording_id']], window['start_seconds'], config, np)))
            labels[split].append(window['label'])
            lineage.append(dict(recording_id=entry['recording_id'], original_recording_id=entry['original_recording_id'],
                                session_id=entry['session_id'], split=split, **window))
    x_train, x_val = np.stack(features['train']), np.stack(features['validation'])
    # Statistics fitted solely to training features, per mel channel.
    mean, std = training_statistics(x_train, np)
    stats = dict(mean=mean.tolist(), std=std.tolist(), fitted_session='S01_TRAIN',
                 feature_config=config, dataset_fingerprint=audit['dataset_fingerprint'])
    if (run / 'features.json').exists() and read(run / 'features.json') != stats:
        raise ValueError('Resume preprocessing-statistics mismatch')
    if not (run / 'features.json').exists():
        (run / 'features.json').write_text(json.dumps(stats, indent=2), encoding='utf-8')
        (run / 'window-lineage.json').write_text(json.dumps(lineage, indent=2), encoding='utf-8')
        np.savez_compressed(run / 'features.npz', train=x_train, validation=x_val,
                            train_labels=np.array(labels['train']), validation_labels=np.array(labels['validation']))
    x_train, x_val = ((x_train-mean)/std)[...,None], ((x_val-mean)/std)[...,None]
    if state.get('latest_checkpoint'):
        if digest(run / state['latest_checkpoint']) != state['latest_checkpoint_sha256']:
            raise ValueError('Resume checkpoint hash mismatch')
        model = tf.keras.models.load_model(run / state['latest_checkpoint'])
    else:
        model = tf.keras.Sequential([tf.keras.layers.Input(shape=x_train.shape[1:]),
            *[tf.keras.layers.Conv2D(n, 3, strides=2, padding='same', activation='relu') for n in config['conv_filters']],
            tf.keras.layers.GlobalAveragePooling2D(), tf.keras.layers.Dense(3, activation='softmax')])
        model.compile(optimizer=tf.keras.optimizers.Adam(config['learning_rate']),
                      loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    checkpoints = run / 'checkpoints'
    checkpoints.mkdir(exist_ok=True)
    started, elapsed_before = time.monotonic(), state.get('training_elapsed_seconds', 0)
    limit = config['training_wall_limit_seconds'] - elapsed_before

    class SaveProgress(tf.keras.callbacks.Callback):
        def on_train_batch_end(self, batch, logs=None):
            if time.monotonic()-started >= limit:
                self.model.stop_training = True

        def on_epoch_end(self, epoch, logs=None):
            # Full checkpoints include optimizer state; prior best checkpoints are never overwritten.
            name = f'checkpoints/epoch-{epoch+1:02}-' + uuid.uuid4().hex + '.keras'
            pending = run / ('checkpoint-' + uuid.uuid4().hex + '.keras')
            self.model.save(pending)
            os.replace(pending, run / name)
            loss = float(logs['val_loss'])
            checkpoint_progress(state, run, name, loss, epoch+1, elapsed_before+time.monotonic()-started)
            with (run / 'epoch-log.jsonl').open('a', encoding='utf-8') as log:
                log.write(json.dumps(dict(epoch=epoch+1, metrics={k:float(v) for k,v in logs.items()}))+'\n')
            atomic_json(run / 'state.json', state)
            print('Saved epoch', epoch+1, 'val_loss', loss, 'best', state['best_checkpoint'], flush=True)
            if state['wait'] >= config['early_stopping_patience'] or time.monotonic()-started >= limit:
                self.model.stop_training = True

    if state.get('wait', 0) < config['early_stopping_patience']:
        for epoch in range(state['epochs'], config['max_epochs']):
            if time.monotonic()-started >= limit:
                break
            # Independent deterministic epoch order permits a faithful boundary resume without RNG state guessing.
            order = np.random.default_rng(seed+epoch).permutation(len(x_train))
            model.fit(x_train[order], np.array(labels['train'])[order],
                      validation_data=(x_val, np.array(labels['validation'])),
                      epochs=epoch+1, initial_epoch=epoch, batch_size=config['batch_size'], shuffle=False,
                      callbacks=[SaveProgress()], verbose=2)
            if state['wait'] >= config['early_stopping_patience']:
                break
    if not state.get('best_checkpoint'):
        raise ValueError('No completed checkpoint; preserve interrupted run')
    state['training_elapsed_seconds'] = elapsed_before + time.monotonic()-started
    if state['training_elapsed_seconds'] >= config['training_wall_limit_seconds']:
        state['status'] = 'budget_exhausted'
        atomic_json(run / 'state.json', state)
        print('Training budget exhausted; checkpoints preserved; no repeated tuning.', flush=True)
        return
    atomic_json(run / 'state.json', state)
    if digest(run / state['best_checkpoint']) != state['best_checkpoint_sha256']:
        raise ValueError('Best checkpoint changed')
    loading = time.perf_counter()
    model = tf.keras.models.load_model(run / state['best_checkpoint'])
    model_loading_seconds = time.perf_counter()-loading
    predictions, processing = [], 0.0
    for entry in audit['entries']:
        if entry['split'] != 'validation':
            continue
        samples = audio[entry['recording_id']]
        ends = list(range(config['replay_hop_samples'], len(samples)+1, config['replay_hop_samples']))
        if not ends or ends[-1] != len(samples):
            ends.append(len(samples))
        began = time.perf_counter()
        replay = []
        for end in ends:
            # Causal replay only: no future samples. Left-pad before the first full window.
            segment = causal_context(samples, end, size, np)
            replay.append(feature(segment))
        probabilities = model.predict((((np.stack(replay)-mean)/std)[...,None]), batch_size=32, verbose=0)
        duration = time.perf_counter()-began
        processing += duration
        predictions.append(dict(recording_id=entry['recording_id'], session_id=entry['session_id'], duration_seconds=entry['duration_seconds'],
            echo_case=entry['echo_case'], human_wakes=[w for w in entry['annotation']['wake_intervals'] if w['source']=='human'],
            times=[end/config['sample_rate'] for end in ends], wake_scores=probabilities[:,1].tolist(),
            class_probabilities=probabilities.tolist(), feature_and_inference_processing_seconds=duration))
    output = dict(evaluation_split='S02_VALID', dataset_fingerprint=audit['dataset_fingerprint'],
                  best_checkpoint=state['best_checkpoint'], checkpoint_sha256=state['best_checkpoint_sha256'],
                  model_loading_seconds=model_loading_seconds, inference_processing_seconds=processing,
                  timing_note='Offline causal audio-timeline replay; not live microphone streaming latency', records=predictions)
    pending = run / ('predictions-' + uuid.uuid4().hex + '.pending')
    pending.write_text(json.dumps(output, indent=2), encoding='utf-8')
    os.replace(pending, run / 'predictions.json')
    state.update(status='early_stopped' if state['wait'] >= config['early_stopping_patience'] else 'complete',
                 best_model_bytes=(run / state['best_checkpoint']).stat().st_size,
                 predictions_sha256=digest(run / 'predictions.json'))
    atomic_json(run / 'state.json', state)
    print('Baseline complete. Saved validation predictions; no final test or activation approval.', flush=True)


if __name__ == '__main__':
    # Imported only by the isolated environment after all parent gates.
    if len(sys.argv) != 2 or os.environ.get('KURAL_GATED_WORKER') != '1':
        print('Disabled. Use the data-gated kural_training.py command.')
        raise SystemExit(0)
    import tensorflow as tf
    import numpy as np
    train(Path(sys.argv[1]).resolve(), tf, np)
