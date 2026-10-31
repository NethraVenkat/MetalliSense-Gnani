import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import { transcribeAudio } from '../../services/copilotService';
import { getHeat, getHeats } from '../../services/premeltService';
import { createTranscriptHandler } from '../../services/voiceTranscript';
import { useMeltFlow } from '../../context/MeltFlowContext';
import useSpeak, { useVoiceLanguage } from '../../hooks/useSpeak';
import useHandsFree from '../../hooks/useHandsFree';
import { langBridgeEnabled } from '../../services/languageBridge';
import { shiftSummaryEnabled } from '../../services/shiftSummary';
const unwrap = response => response.data?.data ?? response.data;
// Only the focused/most recently used voice panel owns the global Space shortcut.
let owner = null;
const panels = new Set();
export function VoicePhraseBadge({ source }) {
  return source ? <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{source === 'evon' ? 'Evon v3.3' : 'template'}</span> : null;
}
export default function PushToTalk(props) {
  // Keep the inner panel unmounted when hidden: no capture, socket or shortcut.
  return import.meta.env.VITE_SHOW_VOICE_PANEL !== 'false' ? <VoicePanel {...props} /> : null;
}
function VoicePanel({ heatId }) {
  const navigate = useNavigate();
  const { flow } = useMeltFlow();
  const { speak, muted, toggleMute } = useSpeak();
  const [lang, setLang] = useVoiceLanguage();
  const [state, setState] = useState('idle');
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const [phraseSource, setPhraseSource] = useState(null);
  const panel = useRef(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const held = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const choose = (ta, en) => lang === 'ta' ? ta : en;
  const say = (text, spokenText = text, replyLang = lang, timing) => { if (!alive.current) return; setAnswer(text); void speak(spokenText, replyLang, 'normal', timing); };
  async function resolveHeat(params) {
    if (params.heatNumber == null && (heatId || flow.heatId)) return unwrap(await getHeat(heatId || flow.heatId));
    const heats = unwrap(await getHeats());
    const selected = params.heatNumber != null
      ? heats.find(h => String(h.heatId).match(/\d+$/)?.[0].replace(/^0+/, '') === String(params.heatNumber).replace(/^0+/, ''))
      : [...heats].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || Number(String(b.heatId).match(/\d+$/)?.[0] || 0) - Number(String(a.heatId).match(/\d+$/)?.[0] || 0))[0];
    if (!selected) return null;
    return unwrap(await getHeat(selected.heatId));
  }
  const handleTranscript = createTranscriptHandler({ lang, setHeard, say, navigate, resolveHeat, setPhraseSource });
  // REST bridge only: hands-free retains the current single-locale Tamil path.
  const handlePushToTalk = createTranscriptHandler({ lang, setHeard, say, navigate, resolveHeat, setPhraseSource, langBridge: langBridgeEnabled() });
  const handsFree = useHandsFree({ onTranscript: handleTranscript, lang, paused: () => busy.current || held.current });
  async function run(text) {
    if (busy.current) return;
    busy.current = true; setState('processing');
    try { await handlePushToTalk(text, { voiceTiming: true }); if (alive.current) setState('idle'); }
    catch { if (alive.current) { setState('error'); say(choose('தகவல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Unable to get information. Tap a suggestion below.')); } }
    finally { busy.current = false; }
  }
  function stop() {
    held.current = false;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }
  async function start() {
    if (busy.current || held.current) return;
    owner = panel.current; held.current = true; busy.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone unavailable');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!held.current || !alive.current) { media.getTracks().forEach(t => t.stop()); busy.current = false; return; }
      stream.current = media;
      const type = ['audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
      recorder.current = rec;
      const chunks = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onerror = () => { stop(); if (alive.current) setState('error'); busy.current = false; };
      rec.onstop = async () => {
        media.getTracks().forEach(t => t.stop());
        if (!alive.current) return;
        setState('processing');
        try {
          const blob = new Blob(chunks, { type: rec.mimeType });
          const sttStarted = performance.now();
          const response = await transcribeAudio(new File([blob], rec.mimeType.includes('mp4') ? 'voice.mp4' : 'voice.webm', { type: blob.type }), null);
          const stt_ms = performance.now() - sttStarted;
          if (response.data.success === false) throw new Error('STT failed');
          const text = response.data.text?.trim() || '';
          if (alive.current) {
            try { await handlePushToTalk(text, { ...response.data, voiceTiming: true, stt_ms }); if (alive.current) setState('idle'); }
            catch { if (alive.current) { setState('error'); say(choose('தகவல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Unable to get information. Tap a suggestion below.')); } }
          }
        } catch { if (alive.current) { setState('error'); say(choose('குரல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Could not hear you. Tap a suggestion below.')); } }
        finally { busy.current = false; }
      };
      rec.start(); setState('listening');
    } catch { stream.current?.getTracks().forEach(track => track.stop()); held.current = false; busy.current = false; if (alive.current) { setState('error'); setAnswer(choose('மைக்ரோஃபோன் கிடைக்கவில்லை. கீழே தொடவும்.', 'Microphone unavailable. Tap a suggestion below.')); } }
  }
  const actions = useRef({ start, stop });
  actions.current = { start, stop };
  useEffect(() => {
    alive.current = true;
    const currentPanel = panel.current;
    panels.add(currentPanel);
    if (!owner) owner = currentPanel;
    const typing = target => target?.closest?.('input, textarea, select, button, [contenteditable="true"], [role="textbox"]');
    const down = event => {
      if (event.code !== 'Space' || event.repeat || typing(event.target) || owner !== currentPanel) return;
      event.preventDefault(); actions.current.start();
    };
    const up = event => { if (event.code === 'Space' && held.current) { event.preventDefault(); actions.current.stop(); } };
    const blur = () => actions.current.stop();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => {
      alive.current = false; actions.current.stop();
      panels.delete(currentPanel);
      if (owner === currentPanel) owner = panels.values().next().value || null;
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
    };
  }, []);
  return <section ref={panel} onFocusCapture={() => { owner = panel.current; }} onPointerDownCapture={() => { owner = panel.current; }} aria-label="Shop floor voice" className="rounded-xl border border-emerald-200 bg-white p-3 text-slate-800 shadow-sm space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={choose('பேச அழுத்திப் பிடிக்கவும்', 'Hold to talk')} aria-pressed={state === 'listening'} disabled={state === 'processing'}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(); }}
        onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) start(); } }}
        onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stop(); } }}
        className={`min-h-16 min-w-16 touch-none select-none rounded-xl px-4 font-semibold text-white ${state === 'listening' ? 'bg-red-600' : 'bg-emerald-700'} disabled:opacity-50`}>
        <Mic className="inline mr-2" size={22} />{choose('பேச பிடிக்கவும்', 'Hold to talk')}
      </button>
      <select aria-label="Voice language" value={lang} disabled={state === 'listening' || state === 'processing'} onChange={e => setLang(e.target.value)} className="rounded border p-2"><option value="ta">தமிழ்</option><option value="en">English</option></select>
      <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'} aria-pressed={muted} className="rounded border p-3">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      <button type="button" aria-pressed={handsFree.enabled} onClick={handsFree.enabled ? handsFree.stop : handsFree.start}
        className={`rounded border px-3 py-2 text-sm ${handsFree.enabled ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : ''}`}>
        கைகள் இல்லாமல் / Hands-free
      </button>
      {handsFree.enabled && <span role="status" className="inline-flex items-center gap-1 text-xs text-emerald-800">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full bg-emerald-600 ${handsFree.state === 'listening' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
        {handsFree.state}
      </span>}
      <span role="status" className="text-xs">{state}</span>
    </div>
    <div aria-live="polite" className="text-sm break-words">{heard && <p>Heard: {heard}</p>}{answer && <p>{answer}</p>}</div>
    <VoicePhraseBadge source={phraseSource} />
    {handsFree.note && <p role="status" className="text-sm text-amber-800">{handsFree.note}</p>}
    {import.meta.env.VITE_MOCK_MODE === 'true' && <details className="text-sm">
      <summary className="cursor-pointer">Demo transcripts</summary>
      <p className="my-2 text-xs text-slate-600">Try the voice flow without recording audio. Replies use the selected voice language.</p>
      <div className="flex flex-wrap gap-2">{[`Heat ${String(heatId || flow.heatId || 'H-1053').replace(/^H-/, '')} status என்ன`, 'ஏன் HOLD', 'why hold heat 1053', 'approve', 'start melting', ...(shiftSummaryEnabled()?['Shift summary']:[])].map(text =>
        <button type="button" key={text} disabled={state === 'processing' || state === 'listening'} onClick={() => run(text)} className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-900 disabled:opacity-50">{text}</button>
      )}</div>
    </details>}
    {state === 'error' && <div className="flex flex-wrap gap-2">{['Heat status', 'carbon evvalavu', 'why hold', 'stock evvalavu', 'spectrometer kaattu'].map(text => <button type="button" key={text} onClick={() => run(text)} className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{text}</button>)}</div>}
  </section>;
}
