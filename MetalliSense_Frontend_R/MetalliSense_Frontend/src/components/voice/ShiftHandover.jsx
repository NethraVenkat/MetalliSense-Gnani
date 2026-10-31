import React, { useEffect, useRef, useState } from 'react';
import { crossCheckHandover, submitHandover } from '../../services/handover';
import { getHeats } from '../../services/premeltService';
import useSpeak, { useVoiceLanguage } from '../../hooks/useSpeak';
import sample from '../../fixtures/handover-sample.json';
import { voiceClarityEnabled, clarityHandoverSummary } from '../../services/voiceClarity';

export default function ShiftHandover(props) {
  return import.meta.env.VITE_HANDOVER === 'true' ? <HandoverPanel {...props} /> : null;
}

export function HandoverPanel({ heats = [] }) {
  const [phase, setPhase] = useState('idle'), [result, setResult] = useState(null), [note, setNote] = useState('');
  const [snapshot, setSnapshot] = useState(heats);
  const capture = useRef(null), timer = useRef(null), request = useRef(null), alive = useRef(true);
  const { speak } = useSpeak(); const [lang] = useVoiceLanguage();
  useEffect(() => { setSnapshot(heats); }, [heats]);
  const stop = () => {
    clearTimeout(timer.current);
    const recording = capture.current;
    if (recording?.recorder?.state === 'recording') recording.recorder.stop();
    recording?.stream?.getTracks().forEach(track => track.stop());
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stop(); request.current?.abort(); };
  }, []);
  async function send(file) {
    if (!alive.current) return;
    if (!file.size || file.size > 10000000) { setNote('Audio must be non-empty and at most 10 MB.'); return; }
    request.current?.abort(); request.current = new AbortController();
    setPhase('processing'); setNote('Uploading and transcribing… Batch processing may take up to two minutes.'); setResult(null);
    try {
      const data = await submitHandover(file, request.current.signal);
      const response = await getHeats();
      if (alive.current) { setSnapshot(response.data?.data ?? response.data); setResult(data); setNote('Read-only cross-check against current gate decisions.'); }
    } catch (error) {
      if (alive.current) setNote(error.message === 'handover_disabled' ? 'Handover is disabled on the Agent.'
        : error.message === 'audio_duration_limit' ? 'Audio must be between 0.1 and 90 seconds.'
        : error.message === 'audio_size_limit' ? 'Audio exceeds 10 MB.'
        : error.message === 'invalid_audio' ? 'Audio could not be decoded. Try a supported audio file.'
        : error.message === 'audio_decoder_unavailable' ? 'Agent audio decoder unavailable. Upload 16-bit PCM WAV or configure ffmpeg.'
        : error.message === 'batch_timeout' ? 'Batch processing timed out. No live result was produced.'
        : error.message === 'batch_failed' ? 'Batch transcription failed. No live result was produced.'
        : 'Agent unavailable or handover could not be processed. No live result was produced.');
    } finally { if (alive.current) setPhase('idle'); }
  }
  async function record() {
    setNote(''); setPhase('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.getTracks().forEach(track => track.stop()); return; }
      capture.current = { stream };
      const recorder = new MediaRecorder(stream); capture.current.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); if (alive.current) void send(new File(chunks, 'handover.webm', { type: recorder.mimeType })); };
      recorder.onerror = () => { stream.getTracks().forEach(track => track.stop()); clearTimeout(timer.current); if (alive.current) { setPhase('idle'); setNote('Microphone recording failed. Upload an audio file instead.'); } };
      recorder.start(1000); setPhase('recording'); setNote('Recording — stops automatically at 90 seconds.');
      timer.current = setTimeout(stop, 90000);
    } catch { capture.current?.stream?.getTracks().forEach(track => track.stop()); setPhase('idle'); setNote('Microphone unavailable. Upload an audio file instead.'); }
  }
  const checks = result ? crossCheckHandover(result.segments, snapshot) : [];
  const summary = checks.filter(check => check.severity !== 'green').map(check => lang === 'ta'
    ? `${check.heatId}: ${check.decision}. கூற்றும் Gate தகவலும் திரையில் சரிபார்க்கவும்.`
    : `${check.heatId}: ${check.label}. Gate ${check.decision}. Check the screen.`).join(' ');
  return <section aria-label="Shift handover" className="rounded-xl border bg-white p-4 space-y-3">
    <h2 className="text-lg font-semibold">Shift handover</h2>
    <p className="text-sm">Read-only. Speaker 1 / Speaker 2. Up to 90 seconds, 10 MB. Transcript claims never change gates, stock or approvals.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={phase === 'processing' || phase === 'connecting'} onClick={phase === 'recording' ? stop : record} className="rounded border px-3 py-2">{phase === 'recording' ? 'Stop recording' : 'Record handover'}</button>
      <label>Upload audio <input type="file" aria-label="Upload handover audio" accept="audio/*" disabled={phase !== 'idle'} onChange={event => { if (event.target.files?.[0]) void send(event.target.files[0]); event.target.value = ''; }} /></label>
      <button type="button" disabled={phase !== 'idle'} onClick={() => { setResult(sample); setSnapshot(heats); setNote('Sample, not live — synthetic test fixture.'); }} className="rounded border px-3 py-2">Load sample result (test only)</button>
    </div>
    <p role="status">{note}</p>
    {phase === 'processing' && <progress aria-label="Processing handover" />}
    {result && <>
      <p className="font-semibold">{result.sample ? 'Sample, not live' : 'Batch transcript'} · {result.duration_s} s</p>
      {result.segments.map((segment, index) => <article key={index} className="rounded border p-2">
        <strong>{segment.speaker}</strong> <span>{segment.start.toFixed(1)}–{segment.end.toFixed(1)} s</span>
        <span className="mx-2 rounded bg-slate-100 px-2">Emotion: {segment.emotion || 'unavailable'}</span>
        <span>Sentiment: {segment.sentiment || 'unavailable'}</span><p>{segment.text}</p>
      </article>)}
      <h3 className="font-semibold">Cross-check</h3>
      <button type="button" onClick={async () => { try { const response = await getHeats(); setSnapshot(response.data?.data ?? response.data); } catch { setNote('Current gates unavailable. Try refresh again.'); } }}>Refresh gate cross-check</button>
      <ul>{checks.map((check, index) => <li key={index} className={check.severity === 'red' ? 'text-red-700' : check.severity === 'amber' ? 'text-amber-800' : 'text-emerald-700'}>{check.heatId}: {check.claim} · Gate {check.decision} · {check.label}</li>)}</ul>
      <button type="button" onClick={() => void speak(voiceClarityEnabled()?clarityHandoverSummary(checks,lang):summary || (lang === 'ta' ? 'முரண்பாடுகள் இல்லை' : 'No mismatches found'), lang)}>Speak cross-check summary</button>
    </>}
  </section>;
}
