let serial=0;
const listeners=new Set();let snapshot=[];
export const voiceTimingEnabled=()=>import.meta.env.DEV&&import.meta.env.VITE_VOICE_TIMING==='true';
export const subscribeWakeTiming=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const wakeTimingSnapshot=()=>snapshot;
export function createWakeTiming(now=()=>performance.now(),started=now()){
 const id=++serial,events=[];
 return {id,events,mark(stage,at=now()){
  if(events.some(e=>e.stage===stage))return;
  const event={turn:id,stage,ms:Math.round(at-started),observed_ms:Math.round(now()-started)};events.push(event);snapshot=[...events];
  console.info('kural_timing',event);listeners.forEach(fn=>fn());return event;
 }};
}
export function playListeningCue(muted=false){
 if(muted)return;const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
 let context;try{context=new Context();const oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=880;gain.gain.value=.035;oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.07);oscillator.onended=()=>{void context.close().catch(()=>{});};void context.resume().catch(()=>context.close());}catch{void context?.close?.().catch(()=>{});}
}
