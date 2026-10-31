// No provider credentials or Gnani endpoint are exposed here. The browser only
// talks to our Agent, including in dev:mock (WebSockets bypass the HTTP mock).
export function streamUrl(base = import.meta.env.VITE_COPILOT_BASE_URL || 'http://localhost:8001') {
  const url = new URL(base, globalThis.location?.href || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid Agent URL');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/copilot/voice/stream`;
  url.search = ''; url.hash = '';
  return url.href;
}

// Area averaging, retaining fractional samples between worklet callbacks. At
// 48 kHz each output sample averages 3 inputs; 44.1 kHz keeps its fractional phase.
export function createDownsampler(inputRate, outputRate = 16000) {
  if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0 || outputRate > inputRate) throw new Error('Invalid sample rate');
  const ratio = inputRate / outputRate;
  let pending = new Float32Array(0), phase = 0;
  return {
    reset() { pending = new Float32Array(0); phase = 0; },
    process(input) {
      const joined = new Float32Array(pending.length + input.length);
      joined.set(pending); joined.set(input, pending.length);
      const count = Math.max(0, Math.floor((joined.length - phase) / ratio + 1e-9));
      const output = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const start = phase + i * ratio, end = start + ratio;
        let total = 0;
        for (let j = Math.floor(start); j < Math.ceil(end); j++) {
          total += (joined[j] || 0) * Math.max(0, Math.min(end, j + 1) - Math.max(start, j));
        }
        output[i] = total / ratio;
      }
      const used = phase + count * ratio;
      const whole = Math.min(joined.length, Math.floor(used + 1e-9));
      pending = joined.slice(whole); phase = Math.max(0, used - whole);
      return output;
    },
  };
}

export const downsample = (input, inputRate, outputRate = 16000) => createDownsampler(inputRate, outputRate).process(input);

export function floatToPcm16(samples) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = Number.isNaN(samples[i]) ? 0 : Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}

export async function createMicCapture({ onFrame, shouldSend = () => true, signal,
  mediaDevices = globalThis.navigator?.mediaDevices,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  AudioWorkletNodeClass = globalThis.AudioWorkletNode } = {}) {
  if (!mediaDevices?.getUserMedia || !AudioContextClass) throw new Error('Microphone unavailable');
  const context = new AudioContextClass();
  let media, source, processor, gain, stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal?.removeEventListener('abort', stop);
    if (processor?.port) processor.port.onmessage = null;
    if (processor) processor.onaudioprocess = null;
    for (const node of [source, processor, gain]) { try { node?.disconnect(); } catch { /* already disconnected */ } }
    media?.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  };
  const checkActive = () => { if (stopped || signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    checkActive();
    // Request resume in the click gesture, but do not wait for autoplay policy
    // before asking for mic permission (a restored preference may have no gesture).
    void context.resume().catch(() => {});
    media = await mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    // A permission prompt can finish after the user turned listening off.
    if (stopped || signal?.aborted) { media.getTracks().forEach(track => track.stop()); checkActive(); }
    await context.resume();
    checkActive();
    const converter = createDownsampler(context.sampleRate);
    let pending = new Uint8Array(0);
    const accept = samples => {
      if (stopped) return;
      if (!shouldSend()) { pending = new Uint8Array(0); converter.reset(); return; }
      const pcm = new Uint8Array(floatToPcm16(converter.process(samples)));
      const joined = new Uint8Array(pending.length + pcm.length);
      joined.set(pending); joined.set(pcm, pending.length);
      let offset = 0;
      for (; offset + 1024 <= joined.length; offset += 1024) onFrame(joined.slice(offset, offset + 1024).buffer);
      pending = joined.slice(offset);
    };
    source = context.createMediaStreamSource(media);
    if (context.audioWorklet && AudioWorkletNodeClass) {
      try {
        await context.audioWorklet.addModule(new URL('./pcmCapture.worklet.js', import.meta.url));
        checkActive();
        processor = new AudioWorkletNodeClass(context, 'metallisense-pcm-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        processor.port.onmessage = event => accept(event.data);
      } catch (error) { checkActive(); if (!context.createScriptProcessor) throw error; }
    }
    if (!processor) {
      processor = context.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = event => accept(event.inputBuffer.getChannelData(0));
    }
    gain = context.createGain(); gain.gain.value = 0;
    source.connect(processor); processor.connect(gain); gain.connect(context.destination);
    checkActive();
    return { stop };
  } catch (error) { stop(); throw error; }
}
