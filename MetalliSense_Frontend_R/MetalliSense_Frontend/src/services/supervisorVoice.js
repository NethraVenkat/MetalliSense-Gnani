import { useSyncExternalStore } from 'react';
const listeners=new Set();
let selected=true;
export const supervisorVoiceMode=()=>['alerts','all'].includes(import.meta.env.VITE_SUPERVISOR_VOICE)?import.meta.env.VITE_SUPERVISOR_VOICE:'off';
export const supervisorVoiceFor=(style='normal')=>selected&&(supervisorVoiceMode()==='all'||supervisorVoiceMode()==='alerts'&&style==='alert')?'supervisor':undefined;
export function useSupervisorVoice() {
  const enabled=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>selected,()=>selected);
  return {mode:supervisorVoiceMode(),enabled,toggle:()=>{selected=!selected;listeners.forEach(fn=>fn());}};
}
