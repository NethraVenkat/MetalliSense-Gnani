import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createTourMicrophone} from '../services/tourMicrophone';
import {createTranscriptHandler} from '../services/voiceTranscript';
import {tourVoiceCommandsEnabled} from '../services/tourVoiceCommands';

export default function useTourMicrophone({tour,lang,scope}){
 const [state,setState]=useState({enabled:false,state:'off',message:''});
 const latest=useRef({tour,lang});latest.current={tour,lang};
 const owner=useRef(null);
 useEffect(()=>{
  if(!tourVoiceCommandsEnabled())return;
  const microphone=createTourMicrophone({onChange:setState,
   control:(...args)=>latest.current.tour.control(...args),
   onTranscript:(text,metadata)=>{
    if(!latest.current.tour.isActive())return;
    return createTranscriptHandler({lang:latest.current.lang,setHeard:()=>{},say:()=>{},navigate:()=>{},resolveHeat:()=>{},
     tourControl:(...args)=>latest.current.tour.control(...args),tourActive:()=>latest.current.tour.isActive(),langBridge:true})(text,metadata);
   }});
  owner.current=microphone;
  microphone.context({active:tour.state.active,lang,scope});
  return()=>{microphone.dispose();owner.current=null;};
 },[]);
 useLayoutEffect(()=>{owner.current?.context({active:tour.state.active,lang,scope});},[tour.state.active,lang,scope]);
 return {...state,visible:tourVoiceCommandsEnabled(),toggle:()=>state.enabled?owner.current?.stop():owner.current?.start(),
  startPtt:()=>owner.current?.startPtt(),stopPtt:()=>owner.current?.stopPtt()};
}
