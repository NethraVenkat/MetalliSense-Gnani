import {useEffect,useRef,useState} from 'react';
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
  useEffect(()=>{tour?.routeChanged({route:pageContext?.route,scope:pageContext?.scope,tourToken:pageContext?.tourNavigationToken});},[tour,pageContext?.route,pageContext?.scope,pageContext?.tourNavigationToken]);
  useEffect(()=>{
    if(!state.active||!state.step?.target||state.step.route!==pageContext?.route)return;
    const reveal=()=>{const target=document.querySelector(state.step.target);if(!target)return false;target.scrollIntoView?.({block:'center'});return true;};
    if(reveal())return;
    const observer=new MutationObserver(()=>{if(reveal())observer.disconnect();});observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[state.active,state.step,pageContext?.route]);
  return {visible:voiceTourEnabled(),state,isActive:()=>tour?.snapshot().active??false,control:(action,voiceLang)=>tour?.control(action,voiceLang||lang)??false};
}
