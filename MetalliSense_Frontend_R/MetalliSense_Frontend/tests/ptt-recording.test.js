import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPttRecordingLifecycle, PTT_MAX_RECORDING_MS } from '../src/services/pttRecording';

afterEach(() => vi.useRealTimers());

function recordingFixture() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const recorder = {
    state: 'inactive',
    start: vi.fn(function () { this.state = 'recording'; }),
    stop: vi.fn(function () { this.state = 'inactive'; this.onstop?.(); }),
  };
  const submit = vi.fn();
  const onLimit = vi.fn();
  const lifecycle = createPttRecordingLifecycle({ recorder, stream, onStop: submit, onLimit });
  return { track, recorder, submit, onLimit, lifecycle };
}

describe('push-to-talk recording lifetime', () => {
  it('stops at 30 seconds, releases the mic and submits once', () => {
    vi.useFakeTimers();
    const { track, recorder, submit, onLimit, lifecycle } = recordingFixture();
    lifecycle.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(PTT_MAX_RECORDING_MS - 1);
    expect(recorder.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLimit).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
    recorder.onstop();
    expect(submit).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the cap on normal stop and cancellation; cancellation never submits', () => {
    vi.useFakeTimers();
    const normal = recordingFixture();
    normal.lifecycle.start(); normal.lifecycle.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(normal.submit).toHaveBeenCalledOnce();

    const cancelled = recordingFixture();
    cancelled.lifecycle.start(); cancelled.lifecycle.cancel();
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelled.track.stop).toHaveBeenCalledOnce();
    expect(cancelled.submit).not.toHaveBeenCalled();
  });
});
