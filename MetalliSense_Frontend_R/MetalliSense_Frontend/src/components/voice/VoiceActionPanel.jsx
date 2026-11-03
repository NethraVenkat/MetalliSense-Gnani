import React from 'react';
export {default as VoiceLogViewer} from './VoiceLogViewer';
export function VoiceActionPanel({state,onCancel}){if(!state)return null;return <section className="voice-action-panel" aria-label="Voice action details">{state.summary&&<p className="voice-action-summary" tabIndex={0}>{state.summary}</p>}{state.masked&&<p aria-label="Private passcode">{state.masked}</p>}{state.seconds&&<p>Executing in {state.seconds}s</p>}{state.phase==='countdown'&&<button type="button" onClick={onCancel}>Cancel</button>}</section>;}
