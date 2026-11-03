import {useSyncExternalStore} from 'react';
const empty=Object.freeze({active:false,progress:null});
let snapshot=empty,owner;
const listeners=new Set();
const publish=value=>{snapshot=value;listeners.forEach(fn=>fn());};
export const speechPresentationSnapshot=()=>snapshot;
export const subscribeSpeechPresentation=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const useSpeechPresentation=()=>useSyncExternalStore(subscribeSpeechPresentation,speechPresentationSnapshot,()=>empty);
// Read-only presentation observer: never plays, pauses, seeks or owns audio.
export function observeSpeechPresentation(read,{setTimer=setInterval,clearTimer=clearInterval}={}){
 const token={};owner=token;let timer,closed=false;
 const update=()=>{if(closed||owner!==token)return;let value;try{value=read();}catch{value=null;}const progress=Number.isFinite(value?.progress)?Math.max(0,Math.min(1,value.progress)):null;
  if(!snapshot.active||snapshot.progress!==progress)publish({active:true,progress});
 };
 update();timer=setTimer(update,80);
 return()=>{if(closed)return;closed=true;clearTimer(timer);if(owner===token){owner=null;publish(empty);}};
}
export function readElementProgress(audio){
 return {progress:Number.isFinite(audio.duration)&&audio.duration>0&&Number.isFinite(audio.currentTime)?audio.currentTime/audio.duration:null};
}
