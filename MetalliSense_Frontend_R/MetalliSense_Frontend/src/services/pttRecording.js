export const PTT_MAX_RECORDING_MS = 30_000;

// Own the browser recording timer and stop-event submission boundary. The
// timer is intentionally independent of React so teardown and cap behavior
// can be exercised with deterministic fake recorders.
export function createPttRecordingLifecycle({ recorder, stream, onStop, onLimit = () => {}, maxDurationMs = PTT_MAX_RECORDING_MS, timers = globalThis }) {
  let timer = null;
  let cancelled = false;
  let submitted = false;
  let released = false;

  const clearTimer = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const release = () => {
    if (released) return;
    released = true;
    stream?.getTracks?.().forEach(track => track.stop());
  };
  const finish = () => {
    clearTimer();
    release();
    if (cancelled || submitted) return;
    submitted = true;
    return onStop?.();
  };
  const stop = () => {
    clearTimer();
    if (recorder?.state === 'recording') recorder.stop();
    release();
  };
  const cancel = () => {
    cancelled = true;
    clearTimer();
    if (recorder?.state === 'recording') recorder.stop();
    release();
  };
  const start = () => {
    recorder.onstop = finish;
    recorder.start();
    timer = timers.setTimeout(() => {
      if (recorder?.state !== 'recording') return;
      onLimit();
      stop();
    }, maxDurationMs);
  };

  return { start, stop, cancel, finish };
}
