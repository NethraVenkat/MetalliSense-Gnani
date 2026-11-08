import {voiceDiagnostics} from '../../services/voiceDiagnostics';
import {redactVoiceText} from '../../services/voiceAuditText';
import useLiveWords from '../../hooks/useLiveWords';
import {createActionFlow,matchAction,voiceActionsEnabled,screenOnly} from '../../services/voiceActions';
import {voiceActionApi} from '../../services/voiceActionApi';
import {captureActionReply} from '../../services/voiceActionCapture';
import {attachMicLevel} from '../../services/micLevel';
import KuralWakePanel from './KuralWakePanel';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import { transcribeAudio, transliterateAudio } from '../../services/copilotService';
import { getHeat, getHeats } from '../../services/premeltService';
import { createTranscriptHandler } from '../../services/voiceTranscript';
import { useMeltFlow } from '../../context/MeltFlowContext';
import useSpeak, { useVoiceLanguage } from '../../hooks/useSpeak';
import {useVoicePage} from '../../context/VoicePageContext';
import {voiceEverywhereEnabled,scopeVoiceCallbacks} from '../../services/voicePages';
import useHandsFree from '../../hooks/useHandsFree';
import { langBridgeEnabled, questionReplyLanguage } from '../../services/languageBridge';
import { shiftSummaryEnabled } from '../../services/shiftSummary';
import {transliterateEnabled,readTransliteratePreference,saveTransliteratePreference,createLatinDisplay} from '../../services/transcriptDisplay';
import {createPttRecordingLifecycle} from '../../services/pttRecording';
import useWakeWord from '../../hooks/useWakeWord';
import {wakeWordEnabled} from '../../services/wakeWord';
const unwrap = response => response.data?.data ?? response.data;
// Only the focused/most recently used voice panel owns the global Space shortcut.
let owner = null;
const panels = new Set();
export function VoicePhraseBadge({ source }) {
  return source ? <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{source === 'evon' ? 'Evon v3.3' : 'template'}</span> : null;
}
export function TransliterationToggle({enabled,onChange,disabled=false}){
  return transliterateEnabled()?<label className="text-sm"><input type="checkbox" checked={enabled} disabled={disabled} onChange={event=>onChange(event.target.checked)} /> Show in English letters</label>:null;
}
export function TransliterationLine({text,show}){
  return transliterateEnabled()&&show&&text?<p className="text-xs text-slate-500">Heard (English letters): {text}</p>:null;
}
export default function PushToTalk(props) {
  if((voiceEverywhereEnabled()||wakeWordEnabled())&&!props.shared)return null;
  // Keep the inner panel unmounted when hidden: no capture, socket or shortcut.
  return import.meta.env.VITE_SHOW_VOICE_PANEL !== 'false' ? <VoicePanel {...props} /> : null;
}
function VoicePanel({ heatId,tour:suppliedTour,hidden=false }) {
  const pageContext=useVoicePage();
  const pageContextRef=useRef(pageContext);pageContextRef.current=pageContext;
  const sharedContext=voiceEverywhereEnabled()||wakeWordEnabled();
  if(sharedContext)heatId=pageContext?.selected?.heatId || heatId;
  const scope=sharedContext?pageContext?.scope:null;
  const currentScope=useRef(scope);currentScope.current=scope;
  const currentRoute=useRef(pageContext?.route);currentRoute.current=pageContext?.route;
  const interactionEpoch=useRef(0);const epoch=interactionEpoch.current;
  const isCurrent=()=>alive.current&&epoch===interactionEpoch.current&&(!sharedContext||scope===currentScope.current);
  const navigate = useNavigate();
  const { flow } = useMeltFlow();
  const { speak, muted, toggleMute } = useSpeak();
  const [lang, setLang] = useVoiceLanguage();
  const hiddenRef=useRef(hidden);hiddenRef.current=hidden;
  const languageRef=useRef(lang);languageRef.current=lang;
  const dashboardRequest=useRef(0);
  const tour=suppliedTour||{visible:false,state:{active:false},isActive:()=>false,control:()=>false};
  const [state, setState] = useState('idle');
  const [micLevel,setMicLevel]=useState(0);const stopMeter=useRef(()=>{});
  const speechAbort=useRef(new AbortController());const speechTicket=useRef(0);
  const floating=wakeWordEnabled();
  const [heard, setHeard] = useState('');
  const [showLatin,setShowLatin]=useState(readTransliteratePreference);
  const [heardLatin,setHeardLatin]=useState('');
  const [answer, setAnswer] = useState({displayText:'',spokenText:''});
  const [voiceDebug,setVoiceDebug]=useState('');
  const [playingAnswer,setPlayingAnswer]=useState(null);
  const clearAnswer=()=>setAnswer({displayText:'',spokenText:''});
  const [phraseSource, setPhraseSource] = useState(null);
  const panel = useRef(null);
  const recorder = useRef(null);
  const recording = useRef(null);
  const stream = useRef(null);
  const held = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const answerSpeech=useRef(Promise.resolve());
  const wakeTurn=useRef(null);
  const [demoCommand,setDemoCommand]=useState('');const [actionState,setActionState]=useState(null);const actionFlow=useRef(null);const actionDeps=useRef(null);
  const latinDisplay=useRef(null);
  if(!latinDisplay.current)latinDisplay.current=createLatinDisplay({request:transliterateAudio,afterSpeech:()=>answerSpeech.current,onText:text=>{if(alive.current)setHeardLatin(text);}});
  const choose = (ta, en) => lang === 'ta' ? ta : en;
  const say = (text, spokenText = text, replyLang = lang, timing) => {
    if (!isCurrent()) return;
    const reply={displayText:text,spokenText};
    setAnswer(reply);
    console.info('kural_route',{stage:'answer',route:pageContext?.route,scopeCurrent:isCurrent(),speechAborted:speechAbort.current.signal.aborted});
    const ticket=++speechTicket.current;
    const turn=wakeTurn.current;turn?.mark('answer_received');
    const audioStart=timing?.onAudioStart;timing={...timing,signal:timing?.signal||(floating?speechAbort.current.signal:undefined),onAudioStart:()=>{if(!isCurrent()||speechTicket.current!==ticket)return;setPlayingAnswer(reply);audioStart?.();turn?.mark('first_audio_played');}};
    // A navigation confirmation may play on its destination, but not after a
    // subsequent navigation elsewhere. Other replies belong to their scope.
    const speechCurrent=timing?.navigation?()=>alive.current&&(isCurrent()||currentRoute.current===timing.navigation):isCurrent;
    answerSpeech.current=Promise.resolve(speak(reply.spokenText, replyLang, 'normal', sharedContext?{...timing,isCurrent:speechCurrent}:timing)).finally(()=>{if(alive.current&&speechTicket.current===ticket)setPlayingAnswer(null);});
  };
  async function resolveHeat(params) {
    if (params.heatNumber == null && (heatId || flow.heatId)) return unwrap(await getHeat(heatId || flow.heatId));
    const heats = unwrap(await getHeats());
    const selected = params.heatNumber != null
      ? heats.find(h => String(h.heatId).match(/\d+$/)?.[0].replace(/^0+/, '') === String(params.heatNumber).replace(/^0+/, ''))
      : [...heats].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || Number(String(b.heatId).match(/\d+$/)?.[0] || 0) - Number(String(a.heatId).match(/\d+$/)?.[0] || 0))[0];
    if (!selected) return null;
    return unwrap(await getHeat(selected.heatId));
  }
  actionDeps.current={say:async text=>{say(text);await answerSpeech.current;},capture:options=>captureActionReply(options,value=>{if(alive.current)setMicLevel(value);})};
  if(!actionFlow.current)actionFlow.current=createActionFlow({api:voiceActionApi,say:text=>actionDeps.current.say(text),capture:options=>actionDeps.current.capture(options),onChange:value=>{if(alive.current)setActionState(value);}});
  async function actionControl(text,context,options={}){if(options.refused){await voiceActionApi.audit({...voiceDiagnostics(text,{winner:'screen-only',context,reason:'legacy_readonly_guard'}),page:context?.route,transcript:redactVoiceText(text,{transcript:true}),level:'ASK',intent:'screen-only',decision:'refused',spoken_reply:screenOnly[questionReplyLanguage(text,null,lang)],summary:'Not permitted by voice.'});return true;}const action=matchAction(text,context);if(!action)return false;wake.suspend();setHeard('');setHeardLatin('');await actionFlow.current.run(action,{page:context?.route,originalText:text,lang,context});return true;}
  const recordHeard=text=>{if(isCurrent()){setHeard(wakeTurn.current?.heard||text);setHeardLatin('');}};
  const callbacks=sharedContext?scopeVoiceCallbacks({say,navigate,setPhraseSource,tourControl:tour.control,tourActive:tour.isActive},isCurrent):{say,navigate,setPhraseSource};
  const dashboardBriefingLifecycle={
    begin:()=>++dashboardRequest.current,
    isCurrent:(token,replyLang,requestScope,panelLang)=>token===dashboardRequest.current&&isCurrent()&&languageRef.current===panelLang&&(requestScope??null)===(scope??null)&&pageContext?.isCurrent?.(requestScope)!==false,
  };
  const handleTranscript = createTranscriptHandler({ lang, setHeard:text=>{latinDisplay.current.invalidate();recordHeard(text);}, ...callbacks, resolveHeat, pageContext, getPageContext:()=>pageContextRef.current, actionControl, dashboardBriefingLifecycle });
  // REST bridge only: hands-free retains the current single-locale Tamil path.
  const handlePushToTalk = createTranscriptHandler({ lang, setHeard:recordHeard, ...callbacks, resolveHeat, pageContext, getPageContext:()=>pageContextRef.current, actionControl, langBridge: langBridgeEnabled(), dashboardBriefingLifecycle });
  const handsFree = useHandsFree({ onTranscript: handleTranscript, lang, paused: () => busy.current || held.current, suspended:hidden||floating });
  const wake=useWakeWord({page:pageContext?.route,onQuery:(text,turn)=>run(text,turn),muted,paused:()=>busy.current||held.current||hiddenRef.current||tour.isActive()||handsFree.enabled});
  const liveWords=useLiveWords({lang,active:state==='listening'||wake.state==='Listening…',transcript:heard,blocked:Boolean(actionState)||hidden||tour.isActive()});
  useEffect(()=>{if(wake.state==='Listening\u2026'){setHeard('');setHeardLatin('');clearAnswer();}},[wake.state]);
  async function run(text,turn=null) {
    if (busy.current) return;
    wakeTurn.current=turn;busy.current = true; setState('processing');clearAnswer();setPlayingAnswer(null);
    console.info('kural_route',{stage:'handler',route:pageContext?.route,loaded:!!pageContext?.loaded,path:turn?.routeTaken||'PTT',scopeCurrent:isCurrent()});
    latinDisplay.current.invalidate();
    try { await handlePushToTalk(text, { voiceTiming: true,routeTaken:turn?.routeTaken||'PTT',onIntent:intent=>{setVoiceDebug(`${turn?.routeTaken||'PTT'} / ${intent}`);console.info('kural_route',{stage:'matched',route:pageContext?.route,path:turn?.routeTaken||'PTT',intent});} }); await answerSpeech.current; if (isCurrent()) setState('idle'); }
    catch (error) { console.info('kural_route',{stage:'error',type:error?.name,route:pageContext?.route});if (isCurrent()) { setState('error'); say(choose('தகவல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Unable to get information. Tap a suggestion below.')); } }
    finally { if(wakeTurn.current===turn)wakeTurn.current=null;if(isCurrent())busy.current = false; }
  }
  function stop() {
    stopMeter.current();
    held.current = false;
    if (recording.current) recording.current.stop();
    else stream.current?.getTracks().forEach(track => track.stop());
    stream.current=null;
  }
  function cancelRecording() {
    stopMeter.current();
    held.current = false;
    if(recording.current)recording.current.cancel();
    else stream.current?.getTracks().forEach(track => track.stop());
    recording.current = null;
    recorder.current = null;
    stream.current=null;
  }
  useEffect(()=>{
    if(!sharedContext)return;
    setHeard('');setHeardLatin('');clearAnswer();setPhraseSource(null);setState('idle');busy.current=false;
    latinDisplay.current.invalidate();
    return ()=>{dashboardRequest.current++;latinDisplay.current.invalidate();actions.current.cancelRecording();};
  },[scope]);
  useEffect(()=>{if(hidden)cancelRecording();},[hidden]);
  async function start() {
    if (hiddenRef.current || busy.current || held.current) return;
    wake.suspend();if(floating){setHeard('');setHeardLatin('');setPlayingAnswer(null);}owner = panel.current; held.current = true; busy.current = true;
    const latinTicket=latinDisplay.current.invalidate();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone unavailable');
      if(floating)setState('permission');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (hiddenRef.current || !held.current || !isCurrent()) { media.getTracks().forEach(t => t.stop()); if(isCurrent())busy.current = false; return; }
      stream.current = media;
      if(floating)stopMeter.current=attachMicLevel(media,value=>{if(alive.current)setMicLevel(value);});
      const type = ['audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
      recorder.current = rec;
      const chunks = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const lifecycle=createPttRecordingLifecycle({recorder:rec,stream:media,onLimit:()=>{held.current=false;},onStop:async()=>{
        if(recording.current===lifecycle)recording.current=null;
        if(stream.current===media)stream.current=null;
        if (!isCurrent()) return;
        stopMeter.current();setState('processing');
        try {
          const blob = new Blob(chunks, { type: rec.mimeType });
          const file=new File([blob],rec.mimeType.includes('mp4')?'voice.mp4':'voice.webm',{type:blob.type});
          if(transliterateEnabled())await latinDisplay.current.beforeMain();
          if(!isCurrent())return;
          const sttStarted = performance.now();
          const response = await (floating?transcribeAudio(file,null,{signal:speechAbort.current.signal,page:pageContext?.route}):transcribeAudio(file,null,{page:pageContext?.route}));
          if(!isCurrent())return;
          const stt_ms = performance.now() - sttStarted;
          if (response.data.success === false) throw new Error('STT failed');
          if (alive.current) {
            try { await latinDisplay.current.afterMain(response.data,handlePushToTalk,file,showLatin,latinTicket,{voiceTiming:true,stt_ms,routeTaken:'PTT',onIntent:intent=>setVoiceDebug(`PTT / ${intent}`)}); if (isCurrent()) setState('idle'); }
            catch { if (isCurrent()) { setState('error'); say(choose('தகவல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Unable to get information. Tap a suggestion below.')); } }
          }
        } catch { if (isCurrent()) { setState('error'); say(choose('குரல் கிடைக்கவில்லை. கீழே உள்ள பொத்தானைத் தொடவும்.', 'Could not hear you. Tap a suggestion below.')); } }
        finally { if(isCurrent())busy.current = false; }
      }});
      recording.current=lifecycle;
      rec.onerror = () => { stopMeter.current();lifecycle.cancel(); if(recording.current===lifecycle)recording.current=null; if(!isCurrent())return; setState('error'); busy.current = false; };
      lifecycle.start(); setState('listening');
    } catch { stopMeter.current();recording.current?.cancel();recording.current=null;recorder.current=null;if(!isCurrent())return;stream.current?.getTracks().forEach(track => track.stop()); held.current = false; busy.current = false; setState('error'); setAnswer({displayText:choose('மைக்ரோஃபோன் கிடைக்கவில்லை. கீழே தொடவும்.', 'Microphone unavailable. Tap a suggestion below.'),spokenText:''}); }
  }
  const actions = useRef({ start, stop, cancelRecording });
  actions.current = { start, stop, cancelRecording };
  useEffect(() => {
    alive.current = true;
    // StrictMode replays effect setup after cleanup: never reuse its aborted signal.
    if(speechAbort.current.signal.aborted)speechAbort.current=new AbortController();
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
      actionFlow.current?.cancel();speechAbort.current.abort();
      alive.current = false; dashboardRequest.current++; latinDisplay.current.invalidate();actions.current.cancelRecording();
      panels.delete(currentPanel);
      if (owner === currentPanel) owner = panels.values().next().value || null;
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
    };
  }, []);
  function resetInteraction(){
    if(actionFlow.current?.active)actionFlow.current.cancel();setActionState(null);
    interactionEpoch.current++;wakeTurn.current=null;dashboardRequest.current++;latinDisplay.current.invalidate();
    cancelRecording();held.current=false;busy.current=false;speechTicket.current++;speechAbort.current.abort();speechAbort.current=new AbortController();setState('idle');setPlayingAnswer(null);
  }
  function closeAssistant(){wake.suspend();handsFree.stop();resetInteraction();setHeard('');setHeardLatin('');clearAnswer();}
  function changeLanguage(value){if(floating){wake.suspend();handsFree.stop();resetInteraction();}dashboardRequest.current++;setLang(value);if(tour.isActive())tour.control('language',value);}
  const changeLatin=value=>{setShowLatin(value);saveTransliteratePreference(value);if(!value)latinDisplay.current.invalidate();};
  const menuControls={lang,onLanguageChange:changeLanguage,languageOptions:tour.visible?['ta','hi','en']:['ta','en'],muted,onToggleMute:toggleMute,showLatin,onLatinChange:changeLatin,latinAvailable:transliterateEnabled(),latinDisabled:state==='listening'||state==='processing'};
  const controls=<>
    {voiceEverywhereEnabled()&&<p className="text-xs text-slate-500">Kural · {pageContext?.pageName?.[lang] || pageContext?.pageName?.en}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={choose('பேச அழுத்திப் பிடிக்கவும்', 'Hold to talk')} aria-pressed={state === 'listening'} disabled={state === 'processing'}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(); }}
        onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) start(); } }}
        onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stop(); } }}
        className={`${floating?'min-h-10 min-w-10':'min-h-16 min-w-16'} touch-none select-none rounded-xl px-4 font-semibold text-white ${state === 'listening' ? 'bg-red-600' : 'bg-emerald-700'} disabled:opacity-50`}>
        <Mic className="inline mr-2" size={22} />{choose('பேச பிடிக்கவும்', 'Hold to talk')}
      </button>
      <select aria-label="Voice language" value={lang} disabled={!floating&&(state === 'listening' || state === 'processing')} onChange={e=>changeLanguage(e.target.value)} className="rounded border p-2"><option value="ta">தமிழ்</option><option value="en">English</option>{tour.visible&&<option value="hi">हिन्दी</option>}</select>
      <button type="button" onClick={toggleMute} title={muted?'Unmute spoken replies':'Mute spoken replies'} aria-label={muted ? 'Unmute voice' : 'Mute voice'} aria-pressed={muted} className="rounded border p-3">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      {!floating&&<button type="button" aria-pressed={handsFree.enabled} onClick={handsFree.enabled ? handsFree.stop : ()=>{wake.stop();handsFree.start();}}
        className={`rounded border px-3 py-2 text-sm ${handsFree.enabled ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : ''}`}>
        கைகள் இல்லாமல் / Hands-free
      </button>}

      {!floating&&handsFree.enabled && <span role="status" className="inline-flex items-center gap-1 text-xs text-emerald-800">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full bg-emerald-600 ${handsFree.state === 'listening' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
        {handsFree.state}
      </span>}
      {!floating&&<span role="status" className="text-xs">{state}</span>}
      <TransliterationToggle enabled={showLatin} disabled={state==='listening'||state==='processing'} onChange={changeLatin} />
    </div>
    {!wakeWordEnabled()&&<div aria-live="polite" className="text-sm break-words">{heard && <p>Heard: {heard}</p>}<TransliterationLine text={heardLatin} show={showLatin} />{answer.displayText && <p>{answer.displayText}</p>}</div>}
    <VoicePhraseBadge source={phraseSource} />
    {handsFree.note && <p role="status" className="text-sm text-amber-800">{handsFree.note}</p>}
    {(floating?import.meta.env.DEV:import.meta.env.VITE_MOCK_MODE === 'true') && <details className="text-sm">
      <summary className="cursor-pointer">Demo transcripts</summary>
      {import.meta.env.DEV&&import.meta.env.VITE_VOICE_ACTIONS==='true'&&<form onSubmit={event=>{event.preventDefault();void run(demoCommand);}}><label>Demo voice command<input aria-label="Demo voice command" value={demoCommand} onChange={event=>setDemoCommand(event.target.value)}/></label><button type="submit">Run demo command</button></form>}
      <p className="my-2 text-xs text-slate-600">Try the voice flow without recording audio. Replies use the selected voice language.</p>
      <div className="flex flex-wrap gap-2">{[`Heat ${String(heatId || flow.heatId || 'H-1053').replace(/^H-/, '')} status என்ன`, 'ஏன் HOLD', 'why hold heat 1053', 'approve', 'start melting', ...(shiftSummaryEnabled()?['Shift summary']:[])].map(text =>
        <button type="button" key={text} disabled={state === 'processing' || state === 'listening'} onClick={() => run(text)} className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-900 disabled:opacity-50">{text}</button>
      )}</div>
    </details>}
    {state === 'error' && <div className="flex flex-wrap gap-2">{['Heat status', 'carbon evvalavu', 'why hold', 'stock evvalavu', 'spectrometer kaattu'].map(text => <button type="button" key={text} onClick={() => run(text)} className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{text}</button>)}</div>}
  </>;
  return <section ref={panel} hidden={hidden} aria-hidden={hidden||undefined} onFocusCapture={() => { owner = panel.current; }} onPointerDownCapture={() => { owner = panel.current; }} aria-label="Shop floor voice" style={hidden?{display:'none'}:floating?{display:'contents'}:undefined} className={`${tour.visible?'relative ':''}rounded-xl border border-emerald-200 bg-white p-3 text-slate-800 shadow-sm space-y-2`}>
    {floating?<KuralWakePanel liveWords={liveWords} actionState={voiceActionsEnabled()?actionState:null} onActionCancel={()=>actionFlow.current.cancel()} debugLine={import.meta.env.DEV&&import.meta.env.VITE_VOICE_TIMING==='true'?voiceDebug:''} menuControls={menuControls} hidden={hidden} wake={wake} lang={lang} muted={muted} panelState={handsFree.enabled&&state==='idle'?(handsFree.state==='listening'?'listening':handsFree.state==='processing'?'processing':'connecting'):state} statusNote={state==='error'?answer.displayText:wake.note} requestPending={state==='processing'} level={state==='listening'||actionState?.capturing||['confirm','passcode'].includes(actionState?.phase)?micLevel:wake.level} heard={showLatin&&heardLatin?heardLatin:heard} answer={answer} playingAnswer={playingAnswer} onToggle={()=>{if(wake.enabled)wake.disable();else{handsFree.stop();wake.start();}}} onRetry={()=>{handsFree.stop();wake.stop();wake.start();}} onPopupDismiss={()=>{if(held.current)stop();}} onClose={closeAssistant} onStopCapture={()=>{wake.stop();handsFree.stop();resetInteraction();}}>{controls}</KuralWakePanel>:controls}
  </section>;
}
