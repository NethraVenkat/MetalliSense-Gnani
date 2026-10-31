import React from 'react';
export default function VoiceTourCard({state,control}) {
  if(!state.active)return null;
  return <aside aria-label="Voice onboarding tour" className="absolute right-0 top-full z-30 mt-2 w-full max-w-sm rounded-xl border border-emerald-300 bg-white p-3 shadow-lg space-y-2">
    <p className="text-xs">Step {state.index+1}/{state.total}</p>
    <p role="status">Tour mode{state.paused?' · Paused':''}</p>
    <h2 className="font-semibold">{state.step.displayName||state.step.pageName[state.lang]}</h2>
    <p lang={state.lang} className="text-sm">{state.text}</p>
    <div className="flex flex-wrap gap-2">{[['back','Back'],['next','Next'],['repeat','Repeat'],[state.paused?'resume':'pause',state.paused?'Resume':'Pause'],['stop','Stop']].map(([action,label])=>
      <button key={action} type="button" disabled={action==='back'&&state.index===0} onClick={()=>control(action)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{label}</button>)}</div>
  </aside>;
}
