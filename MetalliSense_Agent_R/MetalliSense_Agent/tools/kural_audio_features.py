"""Shared offline/replay causal context and fixed log-mel features. No training."""


def causal_context(samples, end_sample, size, np):
    if not isinstance(end_sample, int) or not 0 <= end_sample <= len(samples) or size <= 0:
        raise ValueError('Invalid causal window endpoint/size')
    segment = samples[max(0, end_sample-size):end_sample]
    return np.pad(segment, (max(0, size-len(segment)), 0))


def offline_context(samples, start_seconds, config, np):
    end = min(round(start_seconds*config['sample_rate'])+config['window_samples'], len(samples))
    return causal_context(samples, end, config['window_samples'], np)


def build_feature_extractor(config, tf, np):
    mel = tf.signal.linear_to_mel_weight_matrix(config['mel_bins'], config['fft_length'] // 2 + 1,
        config['sample_rate'], config['mel_lower_hz'], config['mel_upper_hz'])
    size = config['window_samples']

    def feature(segment):
        # Fixed 2-second raw amplitude window; no per-clip normalization/denoising.
        if len(segment) != size:
            raise ValueError('Feature extractor requires a complete shared causal context')
        stft = tf.signal.stft(segment, config['stft_frame'], config['stft_hop'], fft_length=config['fft_length'],
                              window_fn=tf.signal.hann_window, pad_end=False)
        energy = tf.matmul(tf.abs(stft) ** 2, mel)
        return tf.math.log(tf.maximum(energy, config['log_floor'])).numpy().astype('float32')

    return feature


def training_statistics(x_train, np):
    return x_train.mean(axis=(0,1), keepdims=True), np.maximum(x_train.std(axis=(0,1), keepdims=True), 1e-5)


