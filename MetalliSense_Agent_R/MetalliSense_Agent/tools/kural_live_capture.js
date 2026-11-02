// Local diagnostic capture adapter. Stateful area averaging / PCM conversion
// matches the existing src/services/streamCapture.js algorithm. No provider API.
(function (root) {
  'use strict';
  function createDownsampler(inputRate, outputRate = 16000) {
    if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0 || outputRate > inputRate) throw new Error('Invalid sample rate');
    const ratio = inputRate / outputRate;
    let pending = new Float32Array(0), phase = 0;
    return {
      process(input) {
        const joined = new Float32Array(pending.length + input.length);
        joined.set(pending); joined.set(input, pending.length);
        const count = Math.max(0, Math.floor((joined.length - phase) / ratio + 1e-9));
        const output = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const start = phase + i * ratio, end = start + ratio;
          let total = 0;
          for (let j = Math.floor(start); j < Math.ceil(end); j++) total += (joined[j] || 0) * Math.max(0, Math.min(end, j + 1) - Math.max(start, j));
          output[i] = total / ratio;
        }
        const used = phase + count * ratio, whole = Math.min(joined.length, Math.floor(used + 1e-9));
        pending = joined.slice(whole); phase = Math.max(0, used - whole);
        return output;
      },
    };
  }
  function floatToPcm16(samples) {
    const buffer = new ArrayBuffer(samples.length * 2), view = new DataView(buffer);
    for (let i = 0; i < samples.length; i++) {
      const value = Number.isNaN(samples[i]) ? 0 : Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    }
    return buffer;
  }
  async function createMicCapture({ onFrame, signal, onError = () => {}, context,
    mediaDevices = root.navigator?.mediaDevices,
    AudioContextClass = root.AudioContext || root.webkitAudioContext } = {}) {
    if (!mediaDevices?.getUserMedia || (!context && !AudioContextClass)) throw new Error('Microphone capture unavailable');
    const ctx = context || new AudioContextClass();
    let stream, source, processor, gain, stopped = false, pending = new Uint8Array(0), frames = 0;
    const flush = () => { if (!stopped && pending.length) { const bytes = pending; pending = new Uint8Array(0); onFrame(bytes.buffer); } };
    const stop = ({ flushPending = true } = {}) => {
      if (stopped) return;
      if (flushPending) flush();
      stopped = true; signal?.removeEventListener('abort', abort);
      if (processor) processor.onaudioprocess = null;
      for (const node of [source, processor, gain]) { try { node?.disconnect(); } catch {} }
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      void ctx.close().catch(() => {});
    };
    const abort = () => stop({ flushPending: false });
    const check = () => { if (stopped || signal?.aborted) throw new Error('Microphone request cancelled'); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      check(); void ctx.resume().catch(() => {});
      stream = await mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (stopped || signal?.aborted) { stream.getTracks().forEach(track => track.stop()); check(); }
      await ctx.resume(); check();
      const converter = createDownsampler(ctx.sampleRate);
      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = event => {
        if (stopped) return;
        try {
          const samples = converter.process(event.inputBuffer.getChannelData(0));
          frames += samples.length;
          const pcm = new Uint8Array(floatToPcm16(samples)), joined = new Uint8Array(pending.length + pcm.length);
          joined.set(pending); joined.set(pcm, pending.length);
          let offset = 0;
          for (; offset + 2560 <= joined.length; offset += 2560) onFrame(joined.slice(offset, offset + 2560).buffer);
          pending = joined.slice(offset);
        } catch (error) { stop({ flushPending: false }); onError(error); }
      };
      for (const track of stream.getTracks()) track.onended = () => { stop({ flushPending: false }); onError(new Error('Microphone track ended')); };
      gain = ctx.createGain(); gain.gain.value = 0;
      source.connect(processor); processor.connect(gain); gain.connect(ctx.destination); check();
      return { stop, flush, audioTime: () => frames / 16000, inputRate: ctx.sampleRate,
        appliedSettings: stream.getAudioTracks()[0]?.getSettings?.() || {} };
    } catch (error) { stop({ flushPending: false }); throw error; }
  }
  root.KuralLiveCapture = { createDownsampler, floatToPcm16, createMicCapture };
})(globalThis);
