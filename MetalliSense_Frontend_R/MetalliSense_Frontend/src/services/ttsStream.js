import { synthesizeSpeechWithMeta } from './copilotService';

function bytes(value) {
  const raw = atob(value); return Uint8Array.from(raw, character => character.charCodeAt(0));
}
export async function* readAudioEvents(response) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let split;
      while ((split = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, split); pending = pending.slice(split + 2);
        const type = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        if (data) yield { type, ...JSON.parse(data) };
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function playSpeechStream(text, lang, style, { signal, onAudioStart = () => {}, isCurrent = () => true } = {}) {
  const started = performance.now();
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) throw new Error('web_audio_unavailable');
  const context = new AudioContext();
  let next = 0, first = null, audioMs = 0, path = 'stream', ended = false;
  const nodes = new Set(), finishes = [];
  const stop = () => {
    for (const item of nodes) { try { item.node.stop(); } catch {} item.finish(); }
    nodes.clear(); next = context.currentTime + .02;
  };
  signal?.addEventListener('abort', stop);
  async function enqueue(data, encoding, rate) {
    if (signal?.aborted || !isCurrent()) throw new DOMException('Aborted','AbortError');
    let buffer;
    if (encoding === 'pcm_s16le') {
      if (data.length % 2 || ![8000,16000,22050,24000,44100,48000].includes(rate)) throw new Error('invalid_audio');
      buffer = context.createBuffer(1,data.length/2,rate);
      const samples = buffer.getChannelData(0), view = new DataView(data.buffer,data.byteOffset,data.byteLength);
      for (let index=0; index<samples.length; index++) samples[index] = view.getInt16(index*2,true)/32768;
    } else buffer = await context.decodeAudioData(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
    if (signal?.aborted || !isCurrent()) throw new DOMException('Aborted','AbortError');
    const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination);
    let item;
    finishes.push(new Promise(resolve => {
      item = { node, finish: () => { nodes.delete(item); resolve(); } }; node.onended = item.finish;
    }));
    nodes.add(item);
    next = Math.max(next,context.currentTime + .02);
    if (first == null) { first = performance.now()-started + (next-context.currentTime)*1000; onAudioStart(); }
    node.start(next); next += buffer.duration; audioMs += buffer.duration*1000;
  }
  try {
    await context.resume();
    try {
      const response = await fetch(`${(import.meta.env.VITE_COPILOT_BASE_URL || 'http://localhost:8001').replace(/\/$/,'')}/copilot/voice/speak-stream`,
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:lang,style}),signal});
      if (!response.ok) throw new Error('stream_unavailable');
      for await (const message of readAudioEvents(response)) {
        if (message.type === 'reset') { stop(); audioMs = 0; }
        if (message.type === 'audio') { path = message.path; await enqueue(bytes(message.audio),message.encoding,message.sample_rate); }
        if (message.type === 'error') throw new Error('stream_failed');
        if (message.type === 'complete') { ended = true; path = message.path; break; }
      }
      if (!ended || first == null) throw new Error('incomplete_stream');
    } catch (error) {
      stop(); audioMs = 0;
      if (signal?.aborted || !isCurrent()) throw error;
      const result = await synthesizeSpeechWithMeta(text,lang,style);
      if (signal?.aborted) throw new DOMException('Aborted','AbortError');
      path = result.source === 'cache' ? 'cache' : result.provider?.includes('timbre-v2.5') || result.provider === 'gtts' ? 'fallback' : 'rest';
      await enqueue(new Uint8Array(await result.blob.arrayBuffer()),'file');
    }
    await Promise.all(finishes);
    return { time_to_first_audio_ms:first, total_audio_ms:audioMs, total_ms:performance.now()-started, path };
  } finally {
    signal?.removeEventListener('abort',stop); stop(); await context.close();
  }
}
