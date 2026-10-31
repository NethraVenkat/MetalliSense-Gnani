import { useCallback, useSyncExternalStore } from 'react';
import { synthesizeSpeechWithMeta } from '../services/copilotService';
const listeners = new Set();
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
let muted = read('metallisense.voice.muted', 'false') === 'true';
let language = read('metallisense.voice.language', 'ta');
let queue = Promise.resolve();
let cancelPlayback;
let generation = 0;
let speaking = false;
let echoGuardUntil = 0;
// Synchronous check in the capture callback, including queued HOLD announcements.
export const isSpeechEchoGuarded = (now = Date.now()) => speaking || now < echoGuardUntil;
function persist(key, value) { try { localStorage.setItem(key, value); } catch { /* optional storage */ } listeners.forEach(fn => fn()); }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function useVoiceLanguage() {
  const lang = useSyncExternalStore(subscribe, () => language);
  const setLang = useCallback(value => { language = value === 'en' ? 'en' : 'ta'; persist('metallisense.voice.language', language); }, []);
  return [lang, setLang];
}
export function speakText(text, lang = 'ta', style = 'normal', timing = {}) {
  if (muted || !text) return Promise.resolve();
  const ticket = generation;
  const queuedAt = performance.now();
  // Prepare audio while prior playback finishes; playback itself stays serial.
  // Resolve errors into data immediately so canceled queued turns cannot leave
  // an unhandled rejection. Muting still prevents every queued playback.
  const prepared = synthesizeSpeechWithMeta(text, lang, style).then(
    meta => ({ ...meta, tts_ms: performance.now() - queuedAt }),
    () => ({ failed: true, tts_ms: performance.now() - queuedAt }));
  queue = queue.then(async () => {
    if (muted || ticket !== generation) return;
    const queue_ms = performance.now() - queuedAt;
    const { blob, provider, source, tts_ms, failed } = await prepared;
    console.info('voice_turn_timing', { stt_ms: timing?.stt_ms ?? null, answer_ms: timing?.answer_ms ?? null,
      tts_ms, queue_ms,
      tts_path: failed ? 'error' : source === 'mock' ? 'mock' : source === 'cache' ? 'cache' : provider?.includes('timbre-v3.0') ? 'timbre-v3.0'
        : provider?.includes('timbre-v2.5') ? 'v2.5 fallback' : provider === 'gtts' ? 'gTTS' : 'unknown', language: lang });
    if (failed) return;
    if (muted || ticket !== generation) return;
    const url = URL.createObjectURL(blob);
    try {
      speaking = true;
      await new Promise(resolve => {
        const audio = new Audio(url);
        let timer;
        const finish = () => { clearTimeout(timer); audio.pause(); audio.onended = null; audio.onerror = null; cancelPlayback = undefined; resolve(); };
        cancelPlayback = finish;
        audio.onended = finish;
        audio.onerror = finish;
        timer = setTimeout(finish, 120000);
        Promise.resolve(audio.play()).catch(finish);
      });
    } finally { speaking = false; echoGuardUntil = Date.now() + 400; URL.revokeObjectURL(url); }
  }).catch(() => {});
  return queue;
}
export default function useSpeak() {
  const isMuted = useSyncExternalStore(subscribe, () => muted);
  const toggleMute = useCallback(() => {
    muted = !muted;
    generation++;
    if (muted) cancelPlayback?.();
    persist('metallisense.voice.muted', String(muted));
  }, []);
  const speak = useCallback(speakText, []);
  return { speak, muted: isMuted, toggleMute };
}
