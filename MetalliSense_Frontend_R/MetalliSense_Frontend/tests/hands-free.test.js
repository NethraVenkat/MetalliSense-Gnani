import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDownsampler, createMicCapture, downsample, floatToPcm16, streamUrl } from '../src/services/streamCapture';
import { createHandsFreeSession, handsFreeNote } from '../src/hooks/useHandsFree';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
import { isSpeechEchoGuarded, speakText } from '../src/hooks/useSpeak';
import { transcribeAudio } from '../src/services/copilotService';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post, get, interceptors: { response: { use: vi.fn() } } }) } }));

const sessions = [];
afterEach(() => {
  sessions.splice(0).forEach(session => session.stop());
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();
});
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
class Socket {
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  send(data) { this.sent.push(data); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close = vi.fn((code = 1000) => { this.readyState = 3; this.onclose?.({ code }); });
}
function fixture(options = {}) {
  const sockets = [], mics = [], changes = [];
  const createCapture = vi.fn(async callbacks => {
    const mic = { ...callbacks, stop: vi.fn() }; mics.push(mic); return mic;
  });
  const handler = options.onTranscript || vi.fn();
  const controller = createHandsFreeSession({ onTranscript: handler, createCapture,
    createSocket: () => { const socket = new Socket(); sockets.push(socket); return socket; },
    onChange: change => changes.push(change), isEchoGuarded: () => false, ...options });
  sessions.push(controller);
  const ready = async () => {
    controller.start(); await flush();
    const socket = sockets.at(-1); socket.open(); socket.message({ type: 'connected' }); return socket;
  };
  return { controller, sockets, mics, changes, handler, ready, createCapture };
}

describe('mic PCM and transport', () => {
  it('downsample 48k to 16k keeps duration', () => {
    const input = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / 48000));
    const result = downsample(input, 48000);
    expect(result.length).toBe(16000);
    expect(result.length / 16000).toBe(input.length / 48000);
    expect(result[100]).toBeCloseTo((input[300] + input[301] + input[302]) / 3);
    const converter = createDownsampler(48000);
    const chunks = [];
    for (let i = 0; i < input.length; i += 128) chunks.push(...converter.process(input.slice(i, i + 128)));
    expect(Float32Array.from(chunks)).toEqual(result);
  });
  it('keeps fractional phase across 44.1 kHz worklet chunks', () => {
    const input = new Float32Array(44100).fill(.5), converter = createDownsampler(44100);
    let size = 0;
    for (let i = 0; i < input.length; i += 128) size += converter.process(input.slice(i, i + 128)).length;
    expect(size).toBe(16000);
  });
  it('floatToPcm16 clamps and is little-endian', () => {
    const data = floatToPcm16(new Float32Array([-2, -1, -.5, 0, .5, 1, 2, NaN]));
    const view = new DataView(data);
    expect(Array.from({ length: 8 }, (_, i) => view.getInt16(i * 2, true)))
      .toEqual([-32768, -32768, -16384, 0, 16384, 32767, 32767, 0]);
    expect([...new Uint8Array(data).slice(0, 6)]).toEqual([0, 128, 0, 128, 0, 192]);
  });
  it('uses our copilot base URL and upgrades HTTPS to WSS', () => {
    expect(streamUrl('https://agent.test/base/')).toBe('wss://agent.test/base/copilot/voice/stream');
    expect(streamUrl('http://localhost:8001')).toBe('ws://localhost:8001/copilot/voice/stream');
    expect(() => streamUrl('https://key:secret@agent.test')).toThrow();
  });
  it('hands-free sends start then binary then stop', async () => {
    const f = fixture(), socket = await f.ready();
    const bytes = new ArrayBuffer(1024);
    f.mics[0].onFrame(bytes); f.controller.stop();
    expect(socket.sent).toEqual([JSON.stringify({ type: 'start', sample_rate: 16000 }), bytes, JSON.stringify({ type: 'stop' })]);
    expect(socket.close).toHaveBeenCalledWith(1000);
    expect(f.mics[0].stop).toHaveBeenCalledOnce();
    expect(f.changes.at(-1)).toEqual({ state: 'off', enabled: false, message: '' });
  });
  it('never sends audio until connected, and pauses during REST push-to-talk', async () => {
    let paused = false;
    const f = fixture({ isPaused: () => paused });
    f.controller.start(); await flush();
    const socket = f.sockets[0]; socket.open(); f.mics[0].onFrame(new ArrayBuffer(1024));
    expect(socket.sent).toHaveLength(1);
    socket.message({ type: 'connected' }); paused = true; f.mics[0].onFrame(new ArrayBuffer(1024));
    expect(socket.sent).toHaveLength(1);
    paused = false; f.mics[0].onFrame(new ArrayBuffer(1024)); expect(socket.sent).toHaveLength(2);
  });
  it('echo guard drops frames while speaking and 400 ms after', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T00:00:00Z'));
    let audio;
    vi.stubGlobal('Audio', class { constructor() { audio = this; } play() { return Promise.resolve(); } pause() {} });
    post.mockResolvedValue({ data: new Blob(['audio']) });
    const f = fixture({ isEchoGuarded: isSpeechEchoGuarded }), socket = await f.ready();
    const playback = speakText('Heat H-1053 HOLD', 'ta'); await flush();
    expect(isSpeechEchoGuarded()).toBe(true);
    f.mics[0].onFrame(new ArrayBuffer(1024)); expect(socket.sent).toHaveLength(1);
    audio.onended(); await playback;
    f.mics[0].onFrame(new ArrayBuffer(1024)); expect(socket.sent).toHaveLength(1);
    vi.advanceTimersByTime(399);
    f.mics[0].onFrame(new ArrayBuffer(1024)); expect(socket.sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    f.mics[0].onFrame(new ArrayBuffer(1024)); expect(socket.sent).toHaveLength(2);
  });
});

describe('shared transcript answers and fallback', () => {
  it('prepares queued Hindi TTS during Tamil playback without overlapping audio', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const players = [];
    vi.stubGlobal('Audio', class {
      constructor() { players.push(this); }
      play() { return Promise.resolve(); }
      pause() {}
    });
    post.mockResolvedValue({ data: new Blob(['audio']), headers: { 'x-tts-provider': 'gnani:timbre-v3.0:Kalpana', 'x-tts-source': 'cache' } });
    const first = speakText('private Tamil sentence', 'ta'); await flush();
    expect(players).toHaveLength(1);
    const second = speakText('private Hindi sentence', 'hi', 'normal', { stt_ms: 100, answer_ms: 20 }); await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(players).toHaveLength(1);
    players[0].onended(); await first; await flush();
    expect(players).toHaveLength(2);
    players[1].onended(); await second;
    expect(log).toHaveBeenLastCalledWith('voice_turn_timing', {
      stt_ms: 100, answer_ms: 20, tts_ms: expect.any(Number), queue_ms: expect.any(Number), tts_path: 'cache', language: 'hi',
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|Kalpana|key|text/);
    log.mockRestore();
  });
  it('final transcript goes through the same handler as push-to-talk', async () => {
    const heat = { heatId: 'H-1053', status: 'PLANNED', gateResult: { decision: 'HOLD' } };
    const say = vi.fn(), setHeard = vi.fn();
    const handler = vi.fn(createTranscriptHandler({ lang: 'ta', setHeard, say, navigate: vi.fn(), resolveHeat: async () => heat }));
    post.mockResolvedValue({ data: { text: 'Heat 1053 status என்ன' } });
    // The REST transcript and the socket final enter the very same answer function.
    const rest = await transcribeAudio(new Blob(['mock audio']), null);
    await handler(rest.data.text);
    const f = fixture({ onTranscript: handler }), socket = await f.ready();
    socket.message({ type: 'final', text: rest.data.text }); await flush();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(setHeard.mock.calls).toEqual([[rest.data.text], [rest.data.text]]);
    expect(say.mock.calls[0]).toEqual(say.mock.calls[1]);
    expect(say.mock.calls[1][0]).toBe('Heat H-1053: நிலை PLANNED. Gate HOLD');
  });
  it('duplicate finals within 2 s are ignored', async () => {
    let now = 0;
    const f = fixture({ now: () => now }), socket = await f.ready();
    socket.message({ type: 'final', text: 'ஏன் HOLD' }); await flush();
    now = 1999; socket.message({ type: 'final', text: 'ஏன் HOLD' }); await flush();
    expect(f.handler).toHaveBeenCalledOnce();
    now = 4000; socket.message({ type: 'final', text: 'ஏன் HOLD' }); await flush();
    socket.message({ type: 'partial', text: '', code: 'processing' }); await flush();
    expect(f.handler).toHaveBeenCalledTimes(2);
  });
  it('shows an answer failure and continues with the next final', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('Heat not found')).mockResolvedValueOnce();
    const f = fixture({ onTranscript: handler }), socket = await f.ready();
    socket.message({ type: 'final', text: 'Heat 9999 status' }); await flush();
    expect(f.changes.at(-1)).toEqual({ state: 'error', enabled: true, message: 'answer_failed' });
    expect(handsFreeNote('answer_failed', 'en')).toContain('try again');
    socket.message({ type: 'final', text: 'Heat 1053 status என்ன' }); await flush();
    expect(f.changes.at(-1).state).toBe('listening'); expect(handler).toHaveBeenCalledTimes(2);
  });
  it('stream_disabled turns hands-free off and keeps push-to-talk', async () => {
    const f = fixture(), socket = await f.ready();
    socket.message({ type: 'error', code: 'stream_disabled' });
    expect(f.changes.at(-1)).toEqual({ state: 'off', enabled: false, message: 'stream_disabled' });
    expect(socket.close).toHaveBeenCalledOnce(); expect(f.mics[0].stop).toHaveBeenCalledOnce();
    post.mockResolvedValue({ data: { text: 'Heat 1053 status என்ன' } });
    expect((await transcribeAudio(new Blob(['mock audio']))).data.text).toBe('Heat 1053 status என்ன');
    expect(handsFreeNote('stream_disabled', 'ta')).toContain('பேச பிடிக்கவும்');
    expect(handsFreeNote('stream_disabled', 'en')).toContain('Hold to talk');
  });
  it.each(['upstream_error', 'origin_error', 'invalid_config'])('turns off on %s without a reconnect loop', async code => {
    vi.useFakeTimers(); const f = fixture(), socket = await f.ready();
    socket.message({ type: 'error', code }); await vi.advanceTimersByTimeAsync(20000);
    expect(f.changes.at(-1).enabled).toBe(false); expect(f.sockets).toHaveLength(1);
  });
  it('an origin policy close turns hands-free off without affecting REST', async () => {
    const f = fixture(), socket = await f.ready(); socket.close(1008);
    expect(f.changes.at(-1)).toEqual({ state: 'off', enabled: false, message: 'origin_error' });
    expect(f.mics[0].stop).toHaveBeenCalledOnce();
  });
  it('blocked phrase via hands-free uses the general English refusal and changes nothing', async () => {
    const heat = { heatId: 'H-1053', status: 'PLANNED', gateResult: { decision: 'HOLD' }, stockKg: 1000 };
    const before = structuredClone(heat), say = vi.fn(), navigate = vi.fn(), resolveHeat = vi.fn();
    const handler = createTranscriptHandler({ lang: 'ta', setHeard: vi.fn(), say, navigate, resolveHeat });
    const f = fixture({ onTranscript: handler }), socket = await f.ready();
    for (const text of ['start melting', 'approve', 'override HOLD']) { socket.message({ type: 'final', text }); await flush(); }
    expect(say.mock.calls).toEqual(Array(3).fill(["This can't be done by voice. Please use the screen.","This can't be done by voice. Please use the screen.",'en']));
    expect(resolveHeat).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(heat).toEqual(before);
  });
});

describe('session lifetime', () => {
  it('auto-reconnect after closed, gives up after 3 failures', async () => {
    vi.useFakeTimers(); const f = fixture(), first = await f.ready();
    first.message({ type: 'closed', code: 'session_limit' });
    expect(f.changes.at(-1).state).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.sockets).toHaveLength(2);
    for (const delay of [1000, 2000]) {
      f.sockets.at(-1).close(1006); await vi.advanceTimersByTimeAsync(delay);
    }
    f.sockets.at(-1).close(1006); await vi.advanceTimersByTimeAsync(20000);
    expect(f.sockets).toHaveLength(4); // original + cap rotation + two bounded retries
    expect(f.changes.at(-1)).toEqual({ state: 'off', enabled: false, message: 'connection_failed' });
  });
  it('start is idempotent and only one mounted panel owns capture', async () => {
    const f = fixture(), socket = await f.ready();
    f.controller.start(); await flush(); expect(f.sockets).toHaveLength(1);
    const other = fixture(); await other.ready();
    expect(socket.close).toHaveBeenCalledOnce(); expect(f.mics[0].stop).toHaveBeenCalledOnce();
    expect(f.changes.at(-1).enabled).toBe(false);
  });
  it('stop during a pending permission prompt cleans up the late mic', async () => {
    let finish;
    const mic = { stop: vi.fn() }, createCapture = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const f = fixture({ createCapture }); f.controller.start(); f.controller.stop(); finish(mic); await flush();
    expect(mic.stop).toHaveBeenCalledOnce(); expect(f.sockets).toHaveLength(0);
  });
  it('stop cancels reconnect timers and ignores late finals', async () => {
    vi.useFakeTimers(); const f = fixture(), socket = await f.ready();
    const late = socket.onmessage;
    socket.close(1006); f.controller.stop();
    late({ data: JSON.stringify({ type: 'final', text: 'show dashboard' }) });
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.handler).not.toHaveBeenCalled(); expect(f.sockets).toHaveLength(1);
  });
  it('a microphone refusal cleans up and leaves an explanatory note', async () => {
    const f = fixture({ createCapture: vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError'); }) });
    f.controller.start(); await flush();
    expect(f.changes.at(-1)).toEqual({ state: 'error', enabled: false, message: 'microphone' });
    expect(f.sockets).toHaveLength(0);
  });
});

describe('browser capture lifecycle without real mic access', () => {
  function audioFixture(worklet = false) {
    let processor;
    const track = { stop: vi.fn() };
    const mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) };
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    const context = { sampleRate: 48000, resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
      createMediaStreamSource: vi.fn(node), createGain: () => ({ ...node(), gain: {} }), destination: {},
      createScriptProcessor: vi.fn(() => { processor = node(); return processor; }),
      ...(worklet ? { audioWorklet: { addModule: vi.fn(async () => {}) } } : {}),
    };
    const WorkletNode = class { constructor() { processor = { ...node(), port: {} }; return processor; } };
    return { context, track, processor: () => processor, options: { mediaDevices,
      AudioContextClass: class { constructor() { return context; } }, AudioWorkletNodeClass: WorkletNode } };
  }
  it.each([false, true])('captures with worklet=%s, drops guarded buffers and releases resources', async worklet => {
    const f = audioFixture(worklet), frames = []; let send = true;
    const capture = await createMicCapture({ ...f.options, onFrame: frame => frames.push(frame), shouldSend: () => send });
    const emit = () => worklet ? f.processor().port.onmessage({ data: new Float32Array(2048).fill(.5) })
      : f.processor().onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(.5) } });
    emit(); expect(frames.length).toBeGreaterThan(0);
    const before = frames.length; send = false; emit(); expect(frames).toHaveLength(before);
    capture.stop(); capture.stop(); expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.context.close).toHaveBeenCalledOnce();
    if (worklet) expect(f.context.createScriptProcessor).not.toHaveBeenCalled();
  });
  it('falls back to ScriptProcessor if AudioWorklet loading fails', async () => {
    const f = audioFixture(true); f.context.audioWorklet.addModule.mockRejectedValue(new Error('unsupported'));
    const capture = await createMicCapture({ ...f.options, onFrame: vi.fn() });
    expect(f.context.createScriptProcessor).toHaveBeenCalledOnce(); capture.stop();
  });
  it('does not leak a partial PCM buffer across the echo guard', async () => {
    const f = audioFixture(true), frames = []; let send = true;
    const capture = await createMicCapture({ ...f.options, onFrame: frame => frames.push(frame), shouldSend: () => send });
    const emit = (count, value) => f.processor().port.onmessage({ data: new Float32Array(count).fill(value) });
    emit(300, .8); expect(frames).toHaveLength(0);
    send = false; emit(2048, 1); expect(frames).toHaveLength(0);
    send = true; emit(1536, .25); expect(frames).toHaveLength(1);
    expect([...new Int16Array(frames[0])].every(sample => sample === 8192)).toBe(true);
    capture.stop();
  });
  it('stops late microphone tracks if permission finishes after cancellation', async () => {
    const f = audioFixture(); let grant;
    f.options.mediaDevices.getUserMedia = () => new Promise(resolve => { grant = resolve; });
    const abort = new AbortController();
    const capture = createMicCapture({ ...f.options, signal: abort.signal, onFrame: vi.fn() });
    abort.abort(); grant({ getTracks: () => [f.track] });
    await expect(capture).rejects.toHaveProperty('name', 'AbortError');
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.context.close).toHaveBeenCalledOnce();
  });
});
