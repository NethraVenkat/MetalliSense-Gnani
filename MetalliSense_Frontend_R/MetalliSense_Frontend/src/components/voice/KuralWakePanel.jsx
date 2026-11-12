import {voiceCardText} from '../../services/voiceFormContent';
import LiveWordsSlot from './LiveWordsSlot';
import {VoiceActionPanel} from './VoiceActionPanel';
import './KuralMenuLayout.css';
import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {X,MoreHorizontal} from 'lucide-react';
import {drawOrb,orbPaletteKey} from './kuralOrbCanvas';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/noto-sans-tamil/tamil-500.css';
import '@fontsource/noto-sans-tamil/tamil-600.css';
import '@fontsource/noto-sans-devanagari/devanagari-500.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import KuralWords,{useKuralReducedMotion} from './KuralWords';
import KuralControlsMenu from './KuralControlsMenu';
import {useSpeechPresentation} from '../../services/speechPresentation';
import './KuralWakePanel.css';
export function wakeVisualState(wake,{panelState='idle',muted=false,requestPending=false}={}){
 if(wake.permissionRequired||wake.enabled&&wake.state==='permission'||panelState==='permission')return 'permission';
 if(wake.autoOff)return 'unavailable';
 if(panelState==='error'||wake.note)return /unavailable|permission|denied/i.test(wake.note||'')?'unavailable':'error';
 if(panelState==='listening'||wake.enabled&&wake.state==='Listening…')return 'listening';
 if(wake.speaking&&!muted)return 'speaking';
 if(panelState==='processing'||wake.enabled&&wake.state==='Thinking'||requestPending)return 'processing';
 if(wake.state==='paused'&&wake.enabled)return 'paused';
 if(panelState==='connecting')return 'connecting';
 if(wake.enabled)return 'waiting';
 return muted?'muted':'off';
}
export function HighlightWake({text}){return String(text||'').split(/(குரல்|குறள்|\bkural\b)/giu).map((part,i)=>/^(குரல்|குறள்|kural)$/iu.test(part)?<mark key={i}>{part}</mark>:part);}

export const statusLabel=(state,muted=false)=>state==='permission'?'Allow microphone':state==='unavailable'||state==='error'?'Unavailable — tap to retry':muted||state==='muted'?'Muted':({listening:'Listening…',processing:'Understanding…',speaking:'Speaking…',waiting:'Ready',paused:'Ready',connecting:'Allow microphone',off:'Off'})[state]||'Off';
export function KuralCanvas({state,level=0,card=false}){
 const canvas=useRef(null),clock=useRef(0),live=useRef({level});live.current={level,card};
 const [hidden,setHidden]=useState(typeof document!=='undefined'&&document.hidden),[visible,setVisible]=useState(true),[reduced,setReduced]=useState(false),[revision,setRevision]=useState(0);
 const key=orbPaletteKey(state);
 useEffect(()=>{const c=canvas.current,media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setHidden(document.hidden),motion=()=>setReduced(media.matches),resize=()=>{const size=c.getBoundingClientRect().width,dpr=window.devicePixelRatio||1;c.width=Math.round(size*dpr);c.height=c.width;setRevision(v=>v+1);};
  motion();resize();document.addEventListener('visibilitychange',change);media.addEventListener('change',motion);const io=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting));io.observe(c);const ro=new ResizeObserver(resize);ro.observe(c);const mo=new MutationObserver(()=>setRevision(v=>v+1));mo.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});window.addEventListener('resize',resize);
  return()=>{document.removeEventListener('visibilitychange',change);media.removeEventListener('change',motion);io.disconnect();ro.disconnect();mo.disconnect();window.removeEventListener('resize',resize);};
 },[]);
 useEffect(()=>{const c=canvas.current,x=c.getContext('2d');if(!x)return;let frame,last;
  const staticFrame=reduced||key==='err';
  const paint=stamp=>{if(!staticFrame){const elapsed=last===undefined?.016:Math.min(.05,Math.max(0,(stamp-last)/1000));clock.current+=elapsed;}last=stamp;drawOrb({c,x,s:key,dark:document.documentElement.classList.contains('dark')||document.documentElement.dataset.theme==='dark'},reduced?0:clock.current,live.current.level,{card:live.current.card,reduced});};
  if(hidden||!visible)return;paint(performance.now());if(!staticFrame){const tick=stamp=>{paint(stamp);frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}return()=>cancelAnimationFrame(frame);
 },[key,hidden,visible,reduced,revision,card]);
 return <canvas ref={canvas} className="kural-orb-canvas" aria-hidden="true" data-palette={key} data-motion={hidden||!visible||reduced||key==='err'?'static':'running'}/>;
}
export function collisionOffset(box,obstacles,viewportHeight){let offset=0;for(let i=0;i<8;i++){const hit=obstacles.find(r=>box.left<r.right+8&&box.right>r.left-8&&box.top-offset<r.bottom+8&&box.bottom-offset>r.top-8);if(!hit)break;const next=box.bottom-hit.top+12;if(next<=offset)break;offset=Math.min(next,Math.max(0,Math.min(viewportHeight-160,box.top-24)));}return offset;}
export function KuralAnswer({text,progress,muted,reduced,mode='speaking'}){
 const [showMore,setShowMore]=useState(false),[clipped,setClipped]=useState(false),viewport=useRef(null),id=useId();
 useLayoutEffect(()=>{setShowMore(false);},[text]);
 useLayoutEffect(()=>{
  const node=viewport.current;if(!node)return;
  const measure=()=>{if(!showMore)setClipped(node.scrollHeight>node.clientHeight+1);};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
 },[text,showMore]);
 return <div className={`kural-answer${showMore?' is-full':''}${clipped&&!showMore?' is-clipped':''}`}>
  <div id={id} ref={viewport} className="kural-answer-viewport"><KuralWords text={text} mode={mode} progress={progress} muted={muted} reduced={reduced}/></div>
  {clipped&&<button type="button" className="kural-show-more" aria-expanded={showMore} aria-controls={id} onClick={()=>setShowMore(value=>!value)}>{showMore?'Show less':'Show more'}</button>}
 </div>;
}
export default function KuralWakePanel({wake,lang='en',muted=false,panelState='idle',statusNote=wake.note,requestPending=false,level=wake.level,heard='',answer='',playingAnswer='',playbackProgress,liveWords=null,debugLine='',actionState=null,onActionCancel,menuControls={},onToggle,onRetry,onPopupDismiss,onClose,children,hidden=false}){
 const presentation=useSpeechPresentation(),reduced=useKuralReducedMotion();
 const hasAnswer=Boolean(typeof answer==='string'?answer:answer?.displayText);
 const baseState=wakeVisualState({...wake,note:statusNote},{panelState,muted,requestPending}),state=actionState?.phase==='confirm'||actionState?.capturing?'listening':['confirm-starting','passcode'].includes(actionState?.phase)?'permission':actionState?.speaking?'speaking':muted&&hasAnswer&&baseState==='waiting'?'muted':baseState,key=orbPaletteKey(state);const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[lift,setLift]=useState(0);const previous=useRef(state),wasSpeaking=useRef(false),expectPermission=useRef(false);const root=useRef(null),orb=useRef(null),popup=useRef(null);
 useEffect(()=>{let timer;const before=previous.current;previous.current=state;
  if(hidden){setExpanded(false);setOpen(false);wasSpeaking.current=false;return;}
  if(['listening','processing','speaking','error','unavailable'].includes(state))setOpen(false);
  if(actionState){setOpen(false);setExpanded(true);if(['result','error','cancelled','timeout'].includes(actionState.phase)&&!actionState.speaking)timer=setTimeout(()=>setExpanded(false),3000);return()=>clearTimeout(timer);}
  if(state==='speaking'){wasSpeaking.current=true;setExpanded(true);return;}
  if(state==='permission'){setExpanded(false);return;}
  if(state==='waiting')expectPermission.current=false;
  if(state==='listening'){setExpanded(true);return;}
  if(state==='processing'){setExpanded(true);return;}
  if(['error','unavailable'].includes(state)){wasSpeaking.current=false;setExpanded(true);timer=setTimeout(()=>setExpanded(false),3000);}
  else {wasSpeaking.current=false;setExpanded(false);}
  return()=>clearTimeout(timer);
 },[state,panelState,hidden,wake.permissionRequired,actionState]);
 useEffect(()=>{if(!muted||!hasAnswer||['listening','processing','off'].includes(state))return;setExpanded(true);const timer=setTimeout(()=>setExpanded(false),3000);return()=>clearTimeout(timer);},[muted,answer]);
 const collapse=()=>{expectPermission.current=false;setExpanded(false);setOpen(false);onClose?.();orb.current?.focus({preventScroll:true});};
 const close=(options={})=>{onPopupDismiss?.();setOpen(false);if(options.restoreFocus!==false)orb.current?.focus({preventScroll:true});};
 const toggle=()=>{if(open)close();else{setExpanded(false);setOpen(true);}};
 useEffect(()=>{if(!open&&!expanded)return;const escape=event=>{if(event.key!=='Escape')return;event.preventDefault();if(open)close();else collapse();};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open,expanded]);
 useEffect(()=>{if(!open)return;popup.current?.querySelector('button')?.focus({preventScroll:true});const outside=e=>{if(!root.current?.contains(e.target)){onPopupDismiss?.();setOpen(false);}};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 useEffect(()=>{if(hidden)return;let timer;
  const measure=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!root.current)return;const rootStyle=getComputedStyle(root.current),rest=parseFloat(rootStyle.getPropertyValue('--rest-size')),right=Math.max(24,parseFloat(rootStyle.right)||24),bottom=Math.max(24,(parseFloat(rootStyle.bottom)||24)-(parseFloat(root.current.style.getPropertyValue('--kural-lift'))||0));const box={left:innerWidth-right-Math.min(280,innerWidth-48),right:innerWidth-right,top:innerHeight-bottom-rest-252,bottom:innerHeight-bottom};
   const obstacles=[...document.querySelectorAll('main button,[data-primary-action]')].filter(e=>!root.current.contains(e)&&!e.disabled).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<box.right&&r.right>box.left);
   setLift(collisionOffset(box,obstacles,innerHeight));
  },80);};measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);const observer=new MutationObserver(records=>{if(records.some(record=>!root.current?.contains(record.target)))measure();});observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});return()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};},[hidden]);

 if(hidden)return null;
 const bodyLang=actionState?lang:(playingAnswer?.language||answer?.language||lang);
 const primary=statusLabel(state,muted);
 const onset=state==='waiting'&&Number(level)>=.08; // Existing .01 PCM RMS x8 display level, visual only.
 const displayAnswer=typeof answer==='string'?answer:answer?.displayText||'';
 const playingDisplay=typeof playingAnswer==='string'?playingAnswer:playingAnswer?.displayText||'';
 const words=state==='processing'?heard:state==='speaking'?playingDisplay:muted&&!['listening','processing','permission'].includes(state)?displayAnswer:'';
 const progress=playbackProgress===undefined?presentation.progress:playbackProgress;
 const copy=actionState?[actionState.phase==='confirm'?'LISTENING':actionState.level||'VOICE ACTION',voiceCardText(actionState.prompt||actionState.result||'Action review',bodyLang)]:muted?['MUTED','Answer on screen']:({listening:['LISTENING','Go ahead\u2026'],processing:['UNDERSTANDING','One moment\u2026'],speaking:['SPEAKING',"Here's the answer"]})[state];
 const userToggle=()=>{expectPermission.current=!wake.enabled;onToggle?.();};
 const activate=()=>{if(['permission','unavailable','error'].includes(state)){expectPermission.current=true;(onRetry||onToggle)?.();return;}if(!wake.enabled&&!wake.speaking&&!['listening','processing'].includes(state)){userToggle();return;}toggle();};
 return <div ref={root} className={`kural-floating kural-state-${key}${expanded?' is-expanded':' is-ready'}${onset?' has-onset':''}`} data-wake-state={state} data-card-open={expanded} style={{'--kural-lift':`${lift}px`}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(open)close();else if(expanded)collapse();}}}>
  {open&&<KuralControlsMenu wake={wake} onToggle={userToggle} onClose={close} controls={menuControls} menuRef={popup}>{children}</KuralControlsMenu>}
  <div className="kural-interaction-card kural-card-body" role={expanded?'region':undefined} aria-label={expanded?'Kural interaction':undefined}>
   <header className="kural-card-header" aria-hidden={!expanded}><strong>Kural</strong><button type="button" tabIndex={expanded?0:-1} aria-label="Kural microphone controls" title="Kural microphone controls" onClick={toggle}><MoreHorizontal size={18}/></button><button type="button" tabIndex={expanded?0:-1} aria-label="Close Kural interaction and stop" title="Close Kural interaction and stop" onClick={collapse}><X size={18}/></button></header>
   <div className="kural-orb-label" aria-hidden={!expanded} aria-live={expanded?'polite':'off'}>{copy?<><small>{copy[0]}</small><p>{copy[1]}</p></>:<p>{primary}</p>}</div>
   {!actionState&&['listening','processing'].includes(state)&&<LiveWordsSlot value={liveWords} reduced={reduced}/>}
   {!actionState&&words&&<KuralAnswer text={words} mode={state==='processing'?'transcript':'speaking'} progress={progress} muted={muted} reduced={reduced}/>}
   {(actionState?.phase==='confirm'||actionState?.capturing||!actionState&&state==='listening')&&<svg className="kural-live-wave" viewBox="0 0 240 28" aria-label="Microphone level">{Array.from({length:40},(_,i)=>{const h=2+Math.min(1,Number(level)||0)*22*(.4+.6*Math.abs(Math.sin(i*1.7)));return <rect key={i} x={i*6} y={(28-h)/2} width="2" height={h} rx="1"/>;})}</svg>}
   {actionState&&<VoiceActionPanel state={actionState} lang={bodyLang} onCancel={onActionCancel}/>}
   {debugLine&&<small className="kural-route-debug">{debugLine}</small>}
  </div><div className="kural-orb-stage"><button ref={orb} className="kural-floating-orb" type="button" aria-label={`Kural assistant - ${primary}. ${wake.enabled?'Open controls':'Enable hands-free'}`} aria-haspopup="dialog" aria-describedby={!expanded?'kural-ready-tooltip':undefined} aria-expanded={open} onClick={activate} onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)activate();}}} onKeyUp={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();}}}><span className="kural-orb-halo" aria-hidden="true"/><span className="kural-orb-ring" aria-hidden="true"/><KuralCanvas state={state} level={level} card={expanded}/></button></div><span id="kural-ready-tooltip" role="tooltip" className="kural-ready-tooltip">{state==='permission'?'Allow microphone':['unavailable','error'].includes(state)?'Unavailable \u2014 tap to retry':wake.enabled?<>Say <span className="kural-wake-tag">Kural</span></>:'Tap to turn on'}</span>
 </div>;
}
