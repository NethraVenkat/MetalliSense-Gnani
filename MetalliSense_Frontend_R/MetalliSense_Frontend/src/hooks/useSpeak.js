import { useCallback, useSyncExternalStore } from 'react';
import { synthesizeSpeechWithMeta } from '../services/copilotService';
import { toSpokenText } from '../services/spokenText';
import { playSpeechStream } from '../services/ttsStream';
import { clarityText, voiceClarityEnabled } from '../services/voiceClarity';
import { supervisorVoiceFor } from '../services/supervisorVoice';
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
  if (voiceClarityEnabled()) text = clarityText(text,lang);
  else if (import.meta.env.VITE_SPOKEN_NORMALIZE === 'true') text = toSpokenText(text,lang);
  const voice=supervisorVoiceFor(style);
  const ticket = generation;
  const queuedAt = performance.now();
  if (import.meta.env.VITE_TTS_STREAM === 'true' && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
    queue = queue.then(async () => {
      if (muted || ticket !== generation) return;
      const controller = new AbortController(); cancelPlayback = () => controller.abort();
      const queue_ms = performance.now()-queuedAt;
      try {
        const metrics = await playSpeechStream(text,lang,style,{signal:controller.signal,onAudioStart:() => { speaking = true; },...(voice?{voice}:{})});
        console.info('voice_turn_timing',{stt_ms:timing?.stt_ms ?? null,answer_ms:timing?.answer_ms ?? null,
          ...metrics,time_to_first_audio_ms:metrics.time_to_first_audio_ms+queue_ms,total_ms:metrics.total_ms+queue_ms,queue_ms,language:lang});
      } catch {
        console.info('voice_turn_timing',{stt_ms:timing?.stt_ms ?? null,answer_ms:timing?.answer_ms ?? null,
          time_to_first_audio_ms:null,total_audio_ms:0,total_ms:performance.now()-queuedAt,queue_ms,
          path:controller.signal.aborted?'cancelled':'error',language:lang});
      } finally { cancelPlayback = undefined; speaking = false; echoGuardUntil = Date.now()+400; }
    }).catch(() => {});
    return queue;
  }
  // Prepare audio while prior playback finishes; playback itself stays serial.
  // Resolve errors into data immediately so canceled queued turns cannot leave
  // an unhandled rejection. Muting still prevents every queued playback.
  const prepared = synthesizeSpeechWithMeta(text, lang, style, ...(voice?[voice]:[])).then(
    meta => ({ ...meta, tts_ms: performance.now() - queuedAt }),
    () => ({ failed: true, tts_ms: performance.now() - queuedAt }));
  queue = queue.then(async () => {
    if (muted || ticket !== generation) return;
    const queue_ms = performance.now() - queuedAt;
    const { blob, provider, source, tts_ms, failed } = await prepared;
    const instrument = import.meta.env.VITE_TTS_STREAM === 'true' || import.meta.env.VITE_SPOKEN_NORMALIZE === 'true';
    if (!instrument || failed) console.info('voice_turn_timing', { stt_ms: timing?.stt_ms ?? null, answer_ms: timing?.answer_ms ?? null,
      tts_ms, queue_ms,
      tts_path: failed ? 'error' : source === 'mock' ? 'mock' : source === 'cache' ? 'cache' : provider?.includes('timbre-v3.0') ? 'timbre-v3.0'
        : provider?.includes('timbre-v2.5') ? 'v2.5 fallback' : provider === 'gtts' ? 'gTTS' : 'unknown', language: lang,
      ...(instrument && failed ? {time_to_first_audio_ms:null,total_audio_ms:0,total_ms:performance.now()-queuedAt,path:'error'} : {}) });
    if (failed) return;
    if (muted || ticket !== generation) return;
    const url = URL.createObjectURL(blob);
    try {
      speaking = true;
      await new Promise(resolve => {
        const audio = new Audio(url);
        let timer;
        let first = null, finished = false;
        const finish = () => {
          if (finished) return; finished = true;
          clearTimeout(timer); audio.pause(); audio.onended = null; audio.onerror = null; cancelPlayback = undefined;
          if (instrument) {
            audio.onplaying = null;
            console.info('voice_turn_timing',{stt_ms:timing?.stt_ms ?? null,answer_ms:timing?.answer_ms ?? null,tts_ms,queue_ms,
              time_to_first_audio_ms:first,total_audio_ms:Number.isFinite(audio.duration)?audio.duration*1000:null,total_ms:performance.now()-queuedAt,
              path:source==='cache'?'cache':provider?.includes('timbre-v2.5')||provider==='gtts'?'fallback':'rest',language:lang});
          }
          resolve();
        };
        cancelPlayback = finish;
        audio.onended = finish;
        audio.onerror = finish;
        if (instrument) audio.onplaying = () => { first ??= performance.now()-queuedAt; };
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
