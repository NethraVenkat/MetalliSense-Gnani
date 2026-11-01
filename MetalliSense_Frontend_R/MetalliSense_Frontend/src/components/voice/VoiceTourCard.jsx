import React,{useEffect,useRef,useState} from 'react';
import {AudioLines, Check, ChevronLeft, ChevronRight, ChevronDown, Captions, Pause, Play, Volume2, X} from 'lucide-react';

const statusCopy={
  loading:{ta:'ஆடியோ தயாராகிறது',hi:'ऑडियो तैयार हो रहा है',en:'Loading audio'},
  playing:{ta:'ஆடியோ இயங்குகிறது',hi:'ऑडियो चल रहा है',en:'Playing audio'},
  paused:{ta:'ஆடியோ இடைநிறுத்தப்பட்டது',hi:'ऑडियो रुका हुआ है',en:'Audio paused'},
  unavailable:{ta:'ஆடியோ கிடைக்கவில்லை',hi:'ऑडियो उपलब्ध नहीं है',en:'Audio unavailable'},
  muted:{ta:'ஒலி முடக்கப்பட்டுள்ளது',hi:'आवाज़ म्यूट है',en:'Audio muted'},
  finished:{ta:'ஆடியோ முடிந்தது',hi:'ऑडियो पूरा हुआ',en:'Audio finished'},
  ready:{ta:'கேட்கத் தயார்',hi:'सुनने के लिए तैयार',en:'Ready to play'},
};

const labels={
 en:{back:'Back',next:'Next',play:'Play',pause:'Pause',resume:'Resume',language:'Language',explore:'Auto-advance paused while you explore.',autoplay:'Resume autoplay'},
 ta:{back:'பின்',next:'அடுத்து',play:'கேள்',pause:'நிறுத்து',resume:'தொடரு',language:'மொழி',explore:'பார்க்கும் வரை தானாக முன்னேறாது.',autoplay:'தானாகத் தொடரு'},
 hi:{back:'पीछे',next:'आगे',play:'सुनें',pause:'रोकें',resume:'जारी रखें',language:'भाषा',explore:'देखते समय अपने आप आगे नहीं बढ़ेगा।',autoplay:'अपने आप जारी रखें'},
};
const quiet='inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2';
export default function VoiceTourCard({state,control,onLanguageChange,onResumeAutoplay,className='',style}) {
 const [expanded,setExpanded]=useState(true),[stepsOpen,setStepsOpen]=useState(false),[position,setPosition]=useState({left:12,top:80,width:320,maxHeight:300});
 const stepButton=useRef(null),stepList=useRef(null);
 useEffect(()=>{
  if(!stepsOpen)return;
  const measure=()=>{const r=stepButton.current.getBoundingClientRect(),width=Math.min(340,innerWidth-24),top=Math.min(r.bottom+8,innerHeight-160);setPosition({left:Math.max(12,Math.min(r.left,innerWidth-width-12)),top,width,maxHeight:Math.min(360,innerHeight-top-12)});};
  measure();stepList.current?.querySelector('[aria-current="step"]')?.focus();
  const outside=event=>{if(!stepList.current?.contains(event.target)&&!stepButton.current?.contains(event.target))setStepsOpen(false);};
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[stepsOpen]);
 if(!state.active)return null;
 const lang=['ta','hi','en'].includes(state.lang)?state.lang:'en',copy=labels[lang];
 const status=state.paused?'paused':state.audioStatus||'ready';
 const playing=status==='playing';
 const busy=status==='loading';
 const action=state.paused?'resume':playing||busy?'pause':'repeat';
 const accessible=state.paused?'Resume':playing||busy?'Pause':'Play';
 const playLabel=state.paused?copy.resume:playing||busy?copy.pause:copy.play;
 const explore=event=>{if(!event.target.closest('[data-tour-step-list]'))control('user-scroll');};
 const closeSteps=()=>{setStepsOpen(false);stepButton.current?.focus();};
 const entries=state.steps||[{id:state.step.id,displayName:state.step.displayName,pageName:state.step.pageName}];
 const progress=(state.index+1)/Math.max(1,state.total);
 return <aside aria-label="Voice onboarding tour" onWheelCapture={explore} onTouchMoveCapture={explore}
  onKeyDownCapture={event=>{if(['PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(event.key)&&!event.target.closest('button,select,input,textarea,[data-tour-step-list]'))explore(event);}}
  onPointerDownCapture={event=>{const node=event.target;if(node.scrollHeight>node.clientHeight&&event.clientX>=node.getBoundingClientRect().right-20)explore(event);}}
  style={style} data-guide-layout="toolbar" className={`border-b border-emerald-900/15 bg-white text-slate-900 ${className}`}>
  <style>{`@keyframes kural-guide-bars{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(1)}}.kural-guide-bar{animation:kural-guide-bars 950ms ease-in-out infinite;transform-origin:center}@media(prefers-reduced-motion:reduce){.kural-guide-bar{animation:none}}`}</style>
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
   <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2.5 lg:max-w-[22rem]">
    <span data-playback-state={status} aria-label={statusCopy[status]?.[lang]||statusCopy.ready[lang]} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-white">
     {playing?<span data-speaking-bars className="flex h-5 items-center gap-0.5" aria-hidden="true">{[10,18,14,20].map((height,index)=><span key={index} className="kural-guide-bar w-0.5 rounded-full bg-white" style={{height,animationDelay:`${index*110}ms`}}/>)}</span>:status==='paused'?<Pause size={17} aria-hidden="true"/>:busy?<span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true"/>:status==='finished'?<Check size={18} aria-hidden="true"/>:<AudioLines size={17} aria-hidden="true"/>}
    </span>
    <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Kural Guide</p><p className="break-words text-[15px] font-semibold leading-5 text-slate-900">{state.step.displayName||state.step.pageName[lang]}</p></div>
   </div>
   <button ref={stepButton} type="button" aria-label={`Tour steps, step ${state.index+1} of ${state.total}`} aria-haspopup="dialog" aria-expanded={stepsOpen} onClick={()=>setStepsOpen(value=>!value)} className={`${quiet} gap-2 border border-slate-200 bg-white tabular-nums`}>
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="#e2e8f0" strokeWidth="2"/><circle cx="10" cy="10" r="7" fill="none" stroke="#065f46" strokeWidth="2" strokeDasharray={`${progress*44} 44`} transform="rotate(-90 10 10)"/></svg>
    <span aria-label={`Step ${state.index+1} of ${state.total}`}>{String(state.index+1).padStart(2,'0')} / {state.total}</span><ChevronDown size={12} aria-hidden="true"/>
   </button>
   <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true"/>
   <nav aria-label="Tour controls" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
    <button type="button" aria-label="Previous tour step" disabled={state.index===0} onClick={()=>control('back')} className={quiet}><ChevronLeft size={15} aria-hidden="true"/>{copy.back}</button>
    <button type="button" aria-label={`${accessible} tour narration`} aria-pressed={playing} disabled={!state.ready||state.targetMissing&&action==='repeat'} onClick={()=>control(action)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-900 px-3 text-xs font-semibold text-white hover:bg-emerald-950 active:bg-emerald-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">{playing&&!state.paused||busy?<Pause size={14} aria-hidden="true"/>:<Play size={14} aria-hidden="true"/>}{playLabel}</button>
    <button type="button" aria-label="Next tour step" onClick={()=>control('next')} className={quiet}>{copy.next}<ChevronRight size={15} aria-hidden="true"/></button>
   </nav>
   <div className="ml-auto flex items-center gap-2">
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500"><span>{copy.language}</span><select aria-label="Tour language" value={lang} onChange={event=>onLanguageChange?onLanguageChange(event.target.value):control('language',event.target.value)} className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><option value="ta">{String.fromCharCode(0xba4,0xbae,0xbbf,0xbb4,0xbcd)}</option><option value="hi">{String.fromCharCode(0x939,0x93f,0x928,0x94d,0x926,0x940)}</option><option value="en">English</option></select></label>
    <button type="button" aria-label="Close tour" onClick={()=>control('stop')} className={quiet}><X size={16} aria-hidden="true"/></button>
   </div>
  </div>
  {stepsOpen&&<div ref={stepList} data-tour-step-list role="dialog" aria-label="Tour steps" onKeyDown={event=>{
   const items=[...stepList.current.querySelectorAll('button')],at=items.indexOf(document.activeElement);
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSteps();}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
   if(event.key==='Tab'){event.preventDefault();closeSteps();}
  }} style={{position:'fixed',...position,zIndex:10003}} className="overflow-y-auto rounded-xl border border-emerald-900/15 bg-white p-1.5 shadow-lg">
   <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tour steps</p>
   {entries.map((step,index)=><button key={step.id} type="button" aria-current={state.index===index?'step':undefined} aria-label={`${index+1}. ${step.displayName||step.pageName?.[lang]}${state.visited?.includes(step.id)?', visited':''}`} onClick={()=>{closeSteps();control('select-step',index);}} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 ${state.index===index?'bg-emerald-50 font-semibold text-emerald-950':'text-slate-700 hover:bg-slate-50'}`}><span className="w-5 shrink-0 tabular-nums text-slate-400">{String(index+1).padStart(2,'0')}</span><span className="min-w-0 flex-1 break-words">{step.displayName||step.pageName?.[lang]}</span>{state.visited?.includes(step.id)&&<Check size={13} aria-label="Visited"/>}</button>)}
  </div>}
  <div role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={state.total} aria-valuenow={state.index+1} className="mx-4 h-px overflow-hidden rounded-full bg-emerald-50"><div className="h-full bg-emerald-700 transition-[width] duration-200 motion-reduce:transition-none" style={{width:`${progress*100}%`}}/></div>
  <p data-tour-narration hidden={!expanded} lang={lang} tabIndex={0} className="min-h-0 overflow-y-auto break-words border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[14px] leading-7 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700" style={{maxHeight:'min(5rem, 18dvh)'}}>{state.ready?state.text:null}</p>
  <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 text-[11px] leading-4 text-slate-500">
   <div role="status" aria-live="polite" className="min-w-0 flex-1">{state.notice||statusCopy[status]?.[lang]||statusCopy.ready[lang]}{state.autoAdvancePaused&&<span> / {copy.explore}</span>}</div>
   {state.autoAdvancePaused&&<button type="button" aria-label="Resume autoplay" onClick={onResumeAutoplay||(()=>control('resume-autoplay'))} className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">{copy.autoplay}</button>}
   <button type="button" aria-label={expanded?'Hide narration':'Show narration'} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className={quiet}><Captions size={15} aria-hidden="true"/>{expanded?'Hide captions':'Show captions'}</button>
  </div>
 </aside>;
}
