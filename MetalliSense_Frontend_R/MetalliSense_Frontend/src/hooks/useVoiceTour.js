import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createVoiceTour,voiceTourEnabled} from '../services/voiceTour';

export default function useVoiceTour({pageContext,navigate,speak,muted,lang}) {
  const latest=useRef({navigate,speak,muted});latest.current={navigate,speak,muted};
  const [state,setState]=useState({active:false,done:false});
  const controller=useRef(null);
  if(voiceTourEnabled()&&!controller.current)controller.current=createVoiceTour({
    navigate:(...args)=>latest.current.navigate(...args),speak:(...args)=>latest.current.speak(...args),isMuted:()=>latest.current.muted,
    location:{route:pageContext?.route,scope:pageContext?.scope},onChange:setState,
  });
  const tour=controller.current;
  useEffect(()=>{if(tour){tour.attach();setState(tour.snapshot());}return()=>tour?.dispose();},[tour]);
  useLayoutEffect(()=>{tour?.routeChanged({route:pageContext?.route,scope:pageContext?.scope,tourToken:pageContext?.tourNavigationToken});},[tour,pageContext?.route,pageContext?.scope,pageContext?.tourNavigationToken]);
  useEffect(()=>{if(state.active&&['ta','hi','en'].includes(lang)&&state.lang!==lang)tour?.control('language',lang);},[tour,state.active,state.lang,lang]);
  useEffect(()=>{
    if(!state.active||!state.targetMissing||state.step?.route!==pageContext?.route||pageContext?.source==='route')return;
    const retry=()=>{
      const target=document.querySelector(state.step.target||'main'),rect=target?.getBoundingClientRect();
      if(rect?.width>0&&rect?.height>0&&!target.querySelector('[aria-busy="true"]'))tour.control('retry-target');
    };
    retry();const observer=new MutationObserver(retry);observer.observe(document.body,{childList:true,subtree:true,attributes:true});
    return()=>observer.disconnect();
  },[tour,state.active,state.targetMissing,state.step,pageContext?.route,pageContext?.source,pageContext?.scope]);
  useEffect(()=>{
    if(!state.active||state.ready||state.targetMissing||!state.step?.route||state.step.route!==pageContext?.route)return;
    // Route metadata is published by the mounted page. Require a visible target
    // with stable geometry across animation frames before committing this step.
    let cancelled=false,frame=null,previous=null,stable=0,positioned=false;
    const step=state.step;
    const check=()=>{
      if(cancelled)return;
      const target=document.querySelector(step.target||'main');
      const rect=target?.getBoundingClientRect();
      if(pageContext?.source!=='route'&&target&&rect?.width>0&&rect?.height>0&&!target.querySelector('[aria-busy="true"]')){
        const geometry=[rect.x,rect.y,rect.width,rect.height].join(':');
        stable=geometry===previous?stable+1:0;previous=geometry;
        if(!positioned){target.scrollIntoView?.({block:'nearest',behavior:'instant'});positioned=true;stable=0;}
        if(stable>=2){tour.control('target-ready');return;}
      }else{stable=0;previous=null;}
      frame=requestAnimationFrame(check);
    };
    frame=requestAnimationFrame(check);
    const timer=setTimeout(()=>{cancelled=true;cancelAnimationFrame(frame);tour.control('target-missing');},5000);
    return()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);};
  },[tour,state.active,state.ready,state.targetMissing,state.step,pageContext?.route,pageContext?.scope,pageContext?.source]);
  return {visible:voiceTourEnabled(),state,isActive:()=>tour?.snapshot().active??false,control:(action,value)=>tour?.control(action,value===undefined?lang:value)??false};
}
