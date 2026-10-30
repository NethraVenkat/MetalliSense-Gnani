import { useCallback, useSyncExternalStore } from 'react';
import { synthesizeSpeech } from '../services/copilotService';
const listeners = new Set();
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
let muted = read('metallisense.voice.muted', 'false') === 'true';
let language = read('metallisense.voice.language', 'ta');
let queue = Promise.resolve();
let cancelPlayback;
let generation = 0;
function persist(key, value) { try { localStorage.setItem(key, value); } catch { /* optional storage */ } listeners.forEach(fn => fn()); }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function useVoiceLanguage() {
  const lang = useSyncExternalStore(subscribe, () => language);
  const setLang = useCallback(value => { language = value === 'en' ? 'en' : 'ta'; persist('metallisense.voice.language', language); }, []);
  return [lang, setLang];
}
export default function useSpeak() {
  const isMuted = useSyncExternalStore(subscribe, () => muted);
  const toggleMute = useCallback(() => {
    muted = !muted;
    generation++;
    if (muted) cancelPlayback?.();
    persist('metallisense.voice.muted', String(muted));
  }, []);
  const speak = useCallback((text, lang = 'ta') => {
    if (muted || !text) return Promise.resolve();
    const ticket = generation;
    queue = queue.then(async () => {
      if (muted || ticket !== generation) return;
      const blob = await synthesizeSpeech(text, lang);
      if (muted || ticket !== generation) return;
      const url = URL.createObjectURL(blob);
      try {
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
      } finally { URL.revokeObjectURL(url); }
    }).catch(() => {});
    return queue;
  }, []);
  return { speak, muted: isMuted, toggleMute };
}
