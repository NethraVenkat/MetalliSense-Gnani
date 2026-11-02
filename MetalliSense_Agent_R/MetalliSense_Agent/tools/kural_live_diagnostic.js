(function (root) {
  'use strict';
  function createController({ api, captureFactory, createContext, onState = () => {}, onData = () => {}, onError = () => {},
    setTimer = root.setTimeout.bind(root), clearTimer = root.clearTimeout.bind(root) }) {
    let state = 'idle', session = null, generation = 0, capture = null, context = null, abort = null;
    let sequence = 0, queued = 0, chain = Promise.resolve(), failure = null, stopPromise = null, limitTimer = null;
    let finalCaptureTime = 0;
    const audioTime = () => capture ? capture.audioTime() : finalCaptureTime;
    const emit = reason => onState({ state, session, reason, queued, audio_time: audioTime() });
    const clearLimit = () => { if (limitTimer !== null) clearTimer(limitTimer); limitTimer = null; };
    function enqueue(bytes, token) {
      if (token !== generation || !session || !['active', 'starting', 'stopping'].includes(state) || failure) return;
      if (++queued > 25) { --queued; failure = new Error('Local processing backlog exceeded two seconds; capture stopped.'); void stop(failure.message, true); onError(failure); return; }
      const sid = session, order = sequence++;
      chain = chain.then(async () => {
        if (token !== generation || failure) return;
        const data = await api.audio(sid, order, bytes);
        if (token !== generation) return;
        onData(data);
        if (data.stopped) void stop('Backend session limit reached.', true);
      }).catch(error => {
        if (token !== generation) return;
        failure = error; capture?.stop({ flushPending: false }); onError(error); void stop('Local transport failed; no automatic retry.', true);
      }).finally(() => { queued = Math.max(0, queued-1); });
    }
    async function start(metadata) {
      if (state !== 'idle') return;
      const token = ++generation;
      state = 'starting'; failure = null; sequence = 0; queued = 0; stopPromise = null; chain = Promise.resolve();
      finalCaptureTime = 0;
      abort = new AbortController();
      try {
        context = createContext(); void context.resume().catch(() => {}); emit('Requesting local session and microphone.');
        const result = await api.start({ ...metadata, browser_capture: { input_sample_rate: context.sampleRate, resampler: 'stateful area averaging to16000', output: 'mono PCM16 little-endian', requested: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } } });
        if (token !== generation || state !== 'starting') { await api.stop(result.session); return; }
        session = result.session;
        const local = await captureFactory({ context, signal: abort.signal, onFrame: bytes => enqueue(bytes, token), onError: error => { onError(error); void stop('Microphone ended or failed.', true); } });
        if (token !== generation || state !== 'starting') { local.stop({ flushPending: false }); return; }
        capture = local; state = 'active';
        limitTimer = setTimer(() => void stop('Five-minute capture limit.'), Math.min(300, result.limit_seconds || 300) * 1000);
        emit('Microphone active. Local diagnostic only.');
        return { ...result, inputRate: local.inputRate, appliedSettings: local.appliedSettings };
      } catch (error) {
        if (token === generation) { onError(error); await stop('Start failed; microphone released.', true); }
      }
    }
    function stop(reason = 'Stopped by user.', discard = false) {
      if (stopPromise) return stopPromise;
      if (state === 'idle') return Promise.resolve();
      state = 'stopping'; clearLimit(); emit(reason);
      if (capture) capture.stop({ flushPending: !discard });
      else { abort?.abort(); void context?.close().catch(() => {}); }
      const sid = session, token = generation;
      stopPromise = (async () => {
        try {
          await chain;
          if (sid) { const result = await api.stop(sid); if (token === generation) onData(result); }
        } catch (error) { onError(error); }
        finally {
          if (token === generation) { finalCaptureTime = audioTime(); abort?.abort(); capture = null; context = null; session = null; state = 'idle'; ++generation; emit(reason); }
        }
      })();
      return stopPromise;
    }
    async function expected(marker) {
      if (!session || state !== 'active') throw new Error('Start the microphone before saving a manual marker.');
      const token = generation, sid = session;
      capture.flush(); await chain;
      if (token !== generation || failure || state !== 'active') throw new Error('Session stopped before marker save.');
      return api.expected({ session: sid, ...marker });
    }
    function shutdown(beacon) {
      finalCaptureTime = audioTime();
      const sid = session; ++generation; clearLimit(); abort?.abort(); capture?.stop({ flushPending: false });
      void context?.close().catch(() => {}); capture = null; context = null; session = null; state = 'idle';
      if (sid) beacon(sid);
    }
    return { start, stop, expected, shutdown, audioTime, getState: () => ({ state, session, queued }) };
  }
  root.KuralLiveUI = { createController };
  if (!root.document) return;
  const q = id => document.getElementById(id);
  const log = [], points = [], manual = []; let lastSession = null, checkpoint = null, captureMetadata = null;
  const exercises = [
    ['Kural alone', 'Leave one second of silence, mark expected start, say “குரல் / Kural” naturally once, then mark end. Try three takes.'],
    ['Kural plus a question', 'Mark expected start/end around Kural only, then finish “Kural, நிலை என்ன?” naturally. Try three takes.'],
    ['Similar negative words', 'Say coral, curl, cruel, neural, குழல் and குரங்கு as complete natural phrases. Do not mark an expected wake unless you actually say Kural.'],
    ['Silence / room sound', 'Remain quiet for 15–20 seconds. Existing real room/fan sound is fine; nothing is generated or injected.'],
    ['Ordinary conversation', 'Speak naturally for 20–30 seconds without intentionally saying Kural. If you do say it, mark the expected wake honestly.'],
  ];
  for (const [label] of exercises) { const option = document.createElement('option'); option.value = label; option.textContent = label; q('exercise').append(option); }
  const updateExercise = () => { q('instruction').textContent = exercises.find(e => e[0] === q('exercise').value)[1]; q('label').value = q('exercise').value; };
  q('exercise').onchange = updateExercise; updateExercise();
  async function request(path, body, type = 'application/json') {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await fetch(path, { method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : type === 'application/json' ? JSON.stringify(body) : body,
        headers: body === undefined ? {} : { 'Content-Type': type }, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      const data = await result.json(); if (!result.ok) throw new Error(data.error || 'Local request failed'); return data;
    } finally { clearTimeout(timer); }
  }
  const api = { start: body => request('/start', body), audio: (sid, sequence, body) => request('/audio?session=' + encodeURIComponent(sid) + '&sequence=' + sequence, body, 'application/octet-stream'), expected: body => request('/expected', body), stop: session => request('/stop', { session }) };
  function render() {
    q('events').textContent = log.slice(-100).map(e => `t=${Number(e.audio_time).toFixed(3)}s | threshold ${e.threshold} | score ${e.score === undefined ? 'see score trace' : Number(e.score).toFixed(4)}`).join('\n') || 'No events received.';
    q('manual').textContent = manual.map(e => `${e.start_seconds.toFixed(3)}–${e.end_seconds === undefined ? '?' : e.end_seconds.toFixed(3)}s | ${e.label} | ${e.notes}`).join('\n') || 'No manual expected-wake markers yet.';
    const canvas = q('chart'), c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h); if (!points.length) return;
    const shown = points.slice(-125), end = shown[shown.length-1].audio_time, start = Math.max(0, end-10);
    c.font = '13px system-ui';
    for (const threshold of [.5,.65,.8,.9]) { const y = (1-threshold)*(h-30); c.strokeStyle = '#c8d4cf'; c.beginPath(); c.moveTo(45,y); c.lineTo(w,y); c.stroke(); c.fillText(String(threshold),2,y+4); }
    c.strokeStyle = '#136343'; c.lineWidth = 2; c.beginPath(); shown.forEach((p,i) => { const x = 45+(p.audio_time-start)/10*(w-45), y = (1-p.score)*(h-30); if (i) c.lineTo(x,y); else c.moveTo(x,y); }); c.stroke(); c.fillText(`${start.toFixed(1)}–${end.toFixed(1)} audio seconds`,45,h-5);
  }
  const controller = createController({ api, captureFactory: root.KuralLiveCapture.createMicCapture,
    createContext: () => new (root.AudioContext || root.webkitAudioContext)(),
    onState: s => { q('status').textContent = s.reason; q('startMic').disabled = s.state !== 'idle' || !checkpoint || !q('consent').checked; q('stopMic').disabled = s.state === 'idle'; },
    onData: data => {
      if (data.session) lastSession = data.session;
      for (const p of data.points || []) { points.push(p); q('score').textContent = p.score.toFixed(5); q('scoredTime').textContent = p.audio_time.toFixed(3); q('history').textContent = `${p.context_real_samples}/32000 real samples; ${p.padded_samples} padded; compute ${(p.processing_seconds * 1000).toFixed(1)} ms; delivery lag ${Math.max(0, controller.audioTime() - p.audio_time).toFixed(3)} audio seconds`; }
      for (const event of data.events || []) log.push(event);
      if (data.log_directory || data.directory || data.path || data.evidence_dir) q('saved').textContent = data.log_directory || data.directory || data.path || data.evidence_dir;
      render();
    }, onError: error => { q('status').textContent = error.message; } });
  q('consent').onchange = () => { q('startMic').disabled = !q('consent').checked || !checkpoint || controller.getState().state !== 'idle'; };
  q('startMic').onclick = async () => {
    if (!q('consent').checked) return;
    points.length = 0; log.length = 0; manual.length = 0; q('score').textContent = '?'; q('scoredTime').textContent = '0.000'; render();
    const result = await controller.start({ consent: true, condition: q('condition').value });
    if (result) { captureMetadata = { inputRate: result.inputRate, appliedSettings: result.appliedSettings }; q('saved').textContent = result.log_directory || ''; }
    if (result) q('captureInfo').textContent = `Input ${result.inputRate} Hz → mono PCM16 16000 Hz. Browser settings: ${JSON.stringify(result.appliedSettings)}. Browser processing may differ from saved recordings.`;
  };
  q('stopMic').onclick = () => void controller.stop();
  q('markStart').onclick = () => { q('expectedStart').value = (Math.floor(controller.audioTime() * 1000) / 1000).toFixed(3); };
  q('markEnd').onclick = () => { q('expectedEnd').value = (Math.floor(controller.audioTime() * 1000) / 1000).toFixed(3); };
  q('saveExpected').onclick = async () => {
    const start = Number(q('expectedStart').value), end = Number(q('expectedEnd').value);
    if (!q('expectedStart').value || !q('expectedEnd').value || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) { q('status').textContent = 'Mark or enter a valid expected start/end interval first.'; return; }
    const marker = { start_seconds: start, end_seconds: end, label: q('label').value, notes: q('notes').value };
    try { await controller.expected(marker); manual.push(marker); q('status').textContent = 'Manual expectation logged. This is not a verified listening annotation.'; q('expectedStart').value = ''; q('expectedEnd').value = ''; render(); }
    catch (error) { q('status').textContent = error.message; }
  };
  q('download').onclick = () => { const blob = new Blob([JSON.stringify({ checkpoint, lastSession, captureMetadata, events: log, expected: manual, exploratory: true, training_imported: false }, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'kural-live-diagnostic-' + (lastSession || 'notes') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  setInterval(() => { q('captureTime').textContent = controller.audioTime().toFixed(3); }, 100);
  window.addEventListener('pagehide', () => controller.shutdown(session => navigator.sendBeacon('/stop', new Blob([JSON.stringify({ session })], { type: 'application/json' }))));
  request('/status').then(data => { checkpoint = data; q('modelInfo').textContent = JSON.stringify(data, null, 2); q('status').textContent = 'Checkpoint loaded. Microphone off; Start is explicit. Model is unqualified.'; q('consent').onchange(); }).catch(error => { q('status').textContent = 'Backend unavailable: ' + error.message; });
})(globalThis);
