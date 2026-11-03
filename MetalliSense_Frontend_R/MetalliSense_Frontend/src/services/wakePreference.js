import {createWakeSession} from './wakeWord';
import {createMicCapture} from './streamCapture';
export const HANDSFREE_KEY='kural.handsfree';
const local=()=>globalThis.localStorage;
export function readHandsFreePreference(storage=local){try{return storage()?.getItem(HANDSFREE_KEY)==='on';}catch{return false;}}
export function saveHandsFreePreference(enabled,storage=local){try{storage()?.setItem(HANDSFREE_KEY,enabled?'on':'off');}catch{/* Optional browser storage. */}}
// Presentation/consent wrapper only. The existing session still owns capture,
// gate constants, spacing, retries/error ceiling and every request lifecycle.
export function createRememberedWake(options,{storage=local}={}){
 let permissionRequired=false,autoOff=false,session;
 const publish=value=>{
  if(permissionRequired&&value.state==='unavailable'&&value.enabled){session.stop('Allow microphone');return;}
  if(!value.enabled&&/three errors/i.test(value.note||''))autoOff=true;
  options.onChange?.({...value,permissionRequired,autoOff});
 };
 session=createWakeSession({...options,onChange:publish,capture:async args=>{
  try{return await (options.capture||createMicCapture)(args);}catch(error){
   if(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name)){permissionRequired=true;saveHandsFreePreference(false,storage);}
   throw error;
  }
 }});
 const start=async(persist=true)=>{if(persist)saveHandsFreePreference(true,storage);permissionRequired=false;autoOff=false;await session.start();};
 return {
  start:()=>start(true),
  restore:()=>readHandsFreePreference(storage)?start(false):Promise.resolve(),
  disable(){permissionRequired=false;autoOff=false;saveHandsFreePreference(false,storage);session.stop();},
  permissionDenied(){permissionRequired=true;saveHandsFreePreference(false,storage);session.stop('Allow microphone');},
  stop:note=>session.stop(note),suspend:()=>session.suspend(),tick:()=>session.tick(),
  get enabled(){return session.enabled;}
 };
}
