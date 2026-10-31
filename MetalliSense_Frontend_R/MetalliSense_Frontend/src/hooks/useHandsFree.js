import { useEffect, useRef, useState } from 'react';
import { createMicCapture, streamUrl } from '../services/streamCapture';
import { isSpeechEchoGuarded } from './useSpeak';
import {contextBiasEnabled} from '../services/contextTerms';

const STORAGE_KEY = 'metallisense.voice.handsFree';
let activeSession = null;
const readPreference = () => { try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; } };
const savePreference = value => { try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* optional storage */ } };
export const handsFreeNote = (code, lang) => {
  const ta = lang === 'ta';
  if (!code) return '';
  if (code === 'answer_failed') return ta ? 'பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'No answer available. Please try again.';
  if (code === 'microphone') return ta ? 'மைக்ரோஃபோன் கிடைக்கவில்லை. பேச பிடிக்கவும் பொத்தானைப் பயன்படுத்தவும்.' : 'Microphone unavailable. Use Hold to talk.';
  return ta ? 'கைகள் இல்லா குரல் இணைப்பு கிடைக்கவில்லை. பேச பிடிக்கவும் பொத்தானைப் பயன்படுத்தவும்.' : 'Hands-free unavailable. Use Hold to talk.';
};

// The hook delegates socket/resource lifetime to this testable controller.
// Multiple mounted voice panels share one active owner, never multiple mics.
export function createHandsFreeSession({ onTranscript, onChange = () => {},
  createCapture = createMicCapture, createSocket = url => new WebSocket(url),
  url = streamUrl(), isEchoGuarded = isSpeechEchoGuarded, isPaused = () => false,
  now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let enabled = false, generation = 0, socket = null, capture = null, abort = null;
  let activation = 0;
  let retryTimer, connectionTimer, started = false, ready = false, failures = 0;
  let lastFinal = '', lastFinalAt = -Infinity, answers = Promise.resolve();
  let contextTerms=[],lastContext='';
  const sendContext=()=>{
    if(!contextBiasEnabled()||!ready||socket?.readyState!==1)return;
    const key=JSON.stringify(contextTerms);
    if(key===lastContext)return;
    try{socket.send(JSON.stringify({type:'context_terms',terms:contextTerms}));lastContext=key;}catch{/* audio path handles connection recovery */}
  };
  const publish = (state, message = '') => onChange({ state, enabled, message });
  const canSend = () => enabled && ready && !isPaused() && !isEchoGuarded();
  function cleanup(sendStop = true) {
    clearTimer(connectionTimer); connectionTimer = undefined;
    const old = socket;
    socket = null; ready = false;lastContext='';
    if (old) {
      old.onopen = old.onmessage = old.onerror = old.onclose = null;
      try { if (sendStop && started && old.readyState === 1) old.send(JSON.stringify({ type: 'stop' })); } catch { /* connection lost */ }
      try { if (old.readyState < 2) old.close(1000); } catch { /* already closed */ }
    }
    started = false;
    abort?.abort(); abort = null;
    capture?.stop(); capture = null;
  }
  function stop(message = '', state = 'off') {
    enabled = false; generation++; activation++;
    clearTimer(retryTimer); retryTimer = undefined;
    cleanup();
    if (activeSession === session) activeSession = null;
    publish(state, message);
  }
  function reconnect(reason) {
    if (!enabled) return;
    generation++; cleanup(false);
    // A session cap is a normal rotation. Failures reset only on a final or
    // normal cap, rather than on handshakes that might immediately fail again.
    if (reason === 'session_limit' || reason === 'stopped') failures = 0;
    else failures++;
    if (failures >= 3) { stop('connection_failed'); return; }
    publish('reconnecting');
    retryTimer = setTimer(() => { retryTimer = undefined; void connect(true); }, 1000 * 2 ** Math.max(0, failures - 1));
  }
  async function connect(retrying = false) {
    if (!enabled) return;
    const ticket = ++generation;
    publish(retrying ? 'reconnecting' : 'connecting');
    const current = () => enabled && ticket === generation;
    abort = new AbortController();
    try {
      const mic = await createCapture({ signal: abort.signal, shouldSend: canSend, onFrame: frame => {
        if (!current() || !canSend() || socket?.readyState !== 1) return;
        // Do not accumulate stale speech while the network is backpressured.
        if (socket.bufferedAmount > 32000) { reconnect('backpressure'); return; }
        try { socket.send(frame); } catch { reconnect('transport'); }
      } });
      if (!current()) { mic.stop(); return; }
      capture = mic;
      const ws = createSocket(url);
      socket = ws;
      let serverReason = '';
      connectionTimer = setTimer(() => { if (current()) reconnect('connect_timeout'); }, 12000);
      ws.onopen = () => {
        if (!current()) return;
        try { ws.send(JSON.stringify({ type: 'start', sample_rate: 16000 })); started = true; }
        catch { reconnect('transport'); }
      };
      ws.onmessage = event => {
        if (!current()) return;
        let message;
        try { message = JSON.parse(event.data); } catch { stop('protocol'); return; }
        if (message.type === 'connected') {
          clearTimer(connectionTimer); connectionTimer = undefined;
          ready = true; publish('listening');sendContext();
        } else if (message.type === 'partial') {
          publish('processing'); // Processing acknowledgements carry no text.
        } else if (message.type === 'final') {
          const text = typeof message.text === 'string' ? message.text.trim() : '';
          if (!text) return;
          failures = 0;
          const at = now();
          const duplicate = text === lastFinal && at - lastFinalAt < 2000;
          lastFinal = text; lastFinalAt = at;
          if (duplicate) return;
          publish('processing');
          const answerActivation = activation;
          answers = answers.then(async () => {
            if (!enabled || activation !== answerActivation) return;
            try {
              await onTranscript(text);
              if (enabled && ready && activation === answerActivation) publish('listening');
            } catch {
              if (enabled && activation === answerActivation) publish('error', 'answer_failed');
            }
          });
        } else if (message.type === 'error') {
          serverReason = message.code || 'upstream_error';
          if (!['session_limit', 'idle_timeout'].includes(serverReason)) stop(serverReason);
        } else if (message.type === 'closed') {
          reconnect(message.code || serverReason || 'closed');
        }
      };
      // Browsers hide handshake/origin error details. A close 1008 is terminal;
      // opaque network/handshake failures use the bounded three-attempt backoff.
      ws.onerror = () => { if (current()) publish('reconnecting'); };
      ws.onclose = event => {
        if (!current()) return;
        if (event.code === 1008 && !serverReason) stop('origin_error');
        else reconnect(serverReason || 'transport');
      };
    } catch (error) {
      if (!current()) return;
      if (error?.name === 'NotAllowedError' || error?.name === 'NotFoundError') stop('microphone', 'error');
      else reconnect('capture_or_transport');
    }
  }
  const session = {
    setContextTerms(terms){contextTerms=Array.isArray(terms)?terms:[];sendContext();},
    start() {
      if (enabled) return;
      if (activeSession && activeSession !== session) activeSession.stop();
      activeSession = session;
      enabled = true; activation++; failures = 0; lastFinal = ''; lastFinalAt = -Infinity;
      void connect();
    },
    stop,
  };
  return session;
}

export default function useHandsFree({ onTranscript, lang = 'ta', paused = false, contextTerms=[] }) {
  const latest = useRef({ onTranscript, paused });
  latest.current = { onTranscript, paused };
  const [status, setStatus] = useState({ state: 'off', enabled: false, message: '' });
  const session = useRef(null);
  useEffect(() => {
    let alive = true;
    const controller = createHandsFreeSession({
      onTranscript: text => latest.current.onTranscript(text),
      isPaused: () => typeof latest.current.paused === 'function' ? latest.current.paused() : latest.current.paused,
      onChange: value => {
        if (!alive) return;
        setStatus(value);
        if (value.message && !value.enabled) savePreference(false);
      },
    });
    session.current = controller;
    if (readPreference()) controller.start();
    return () => { alive = false; controller.stop(); session.current = null; };
  }, []);
  const contextKey=JSON.stringify(contextTerms);
  useEffect(()=>{session.current?.setContextTerms(contextTerms);},[contextKey]);
  return {
    ...status, note: handsFreeNote(status.message, lang),
    start() { savePreference(true); session.current?.start(); },
    stop() { savePreference(false); session.current?.stop(); },
  };
}
