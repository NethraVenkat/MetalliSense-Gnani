"""History-support policy. No acoustic threshold, fitting or label changes."""
import math


POLICY = {
    'id': 'full-real-history-v1',
    'scope': 'Diagnostic replay only; never filter fitting examples or replace primary all-wake evaluation',
    'sample_rate': 16000,
    'window_samples': 32000,
    'eligible': 'At least 32000 real samples since this recording/session starts',
    'ineligible_action': 'Preserve raw scores; reset streak; no event or cooldown update',
    'acoustic_gate': 'none; full-context silence remains eligible',
    'denominators': 'Keep all recordings and all 20 S02 wakes, including unsupported clips',
}


def support(row, sample_rate=16000, window_samples=32000):
    if len(row['times']) != len(row['wake_scores']):
        raise ValueError('Mismatched raw timeline and scores')
    frames = round(row['duration_seconds'] * sample_rate)
    result = []
    previous = 0
    for timestamp, score in zip(row['times'], row['wake_scores']):
        if not math.isfinite(timestamp) or not math.isfinite(score):
            raise ValueError('Nonfinite raw timeline or score')
        end = round(timestamp * sample_rate)
        if abs(timestamp * sample_rate-end) > 1e-6 or not previous < end <= frames:
            raise ValueError('Non-increasing/off-sample/out-of-range endpoint')
        previous = end
        real = min(end, window_samples)
        result.append(dict(timestamp=timestamp, end_sample=end, real_history_samples=real,
                           synthetic_left_padding_samples=window_samples-real,
                           eligible=end >= window_samples))
    return result


def wake_coverage(row, supported, consecutive=2, grace=1.0):
    """Score-independent opportunity assessment; never removes wakes from metrics."""
    candidates = []
    streak = 0
    for frame in supported:
        streak = streak+1 if frame['eligible'] else 0
        if streak >= consecutive:
            candidates.append(frame['timestamp'])
    result = []
    for wake in row['human_wakes']:
        possible = [t for t in candidates if wake['start_seconds'] <= t <= wake['end_seconds']+grace]
        if possible:
            status = 'eligible_detection_opportunity'
        elif not any(frame['eligible'] for frame in supported):
            status = 'clip_shorter_than_required_real_history'
        elif not candidates:
            status = 'insufficient_consecutive_eligible_frames'
        else:
            status = 'matching_deadline_before_eligible_detection_opportunity'
        result.append(dict(recording_id=row['recording_id'], duration_seconds=row['duration_seconds'],
                           wake=wake, status=status, first_eligible_event_opportunity=possible[0] if possible else None,
                           retained_in_wake_denominator=True))
    return result
