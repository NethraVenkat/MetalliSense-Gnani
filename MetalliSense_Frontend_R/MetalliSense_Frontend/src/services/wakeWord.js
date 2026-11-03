import {createWakeTiming} from './wakeTiming';
import {createMicCapture} from './streamCapture';
export const wakeWordEnabled=()=>import.meta.env.VITE_WAKE_WORD==='true';
export function wakeParts(text){const transcript=String(text).normalize('NFC'),words=transcript.toLocaleLowerCase().replace(/\p{P}/gu,' ').trim().split(/\s+/u).filter(Boolean),wake=['குரல்','குறள்','kural'].includes(words[0]);return {wake,transcript,remainder:wake?words.slice(1).join(' '):''};}
export function pcmWav(pcm){const result=new ArrayBuffer(44+pcm.byteLength),v=new DataView(result),u=new Uint8Array(result);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+pcm.byteLength,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,pcm.byteLength,true);u.set(new Uint8Array(pcm),44);return new File([result],'voice.wav',{type:'audio/wav'});}
// 20ms/.01 RMS/500ms pause/100ms speech; same fixed pause-v3 constants.
export function createPauseGate(onSnippet,onProgress=()=>{}){let pending=[],silence=25,streak=0,candidate=[],snippet=null;
 return {reset(){pending=[];silence=25;streak=0;candidate=[];snippet=null;},push(buffer){const v=new DataView(buffer);for(let i=0;i<v.byteLength;i+=2)pending.push(v.getInt16(i,true));while(pending.length>=320){const frame=pending.splice(0,320),rms=Math.sqrt(frame.reduce((n,x)=>n+(x/32768)**2,0)/320),speech=rms>=.01;
 onProgress(frame,rms);
 if(snippet){snippet.push(...frame);if(snippet.length>=24000){const data=new Int16Array(snippet.slice(0,24000));snippet=null;let end=24000;while(end>=320&&Math.sqrt(data.slice(end-320,end).reduce((n,x)=>n+(x/32768)**2,0)/320)<.01)end-=320;onSnippet(data.buffer,{continuing:speech,speechEndMs:end/16});}}
 if(speech){if(!streak)candidate=silence>=25?[]:null;streak++;if(candidate)candidate.push(...frame);if(streak===5&&candidate){if(!snippet)snippet=candidate;candidate=null;}}
 else{if(streak>=5)silence=0;silence++;streak=0;candidate=null;}
 }}};
}
let owner=null;
export function createWakeSession({check,transcribe,onQuery,onChange=()=>{},onLevel=()=>{},onListen=()=>{},paused=()=>false,capture=createMicCapture,setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now()}){
 let enabled=false,mic=null,abort=null,generation=0,busy=false,errors=0,command=null,timer=null,pending=null,trace=null,workAbort=null;
 const publish=(state,note='')=>onChange({enabled,state,note});
 function clearWork(){clearTimer(timer);timer=null;pending=null;command=null;}
 const gate=createPauseGate((pcm,meta)=>{if(enabled&&!busy&&!paused()&&!command&&!pending)void request(pcm,meta);},progress);
 function release(){workAbort?.abort();workAbort=null;abort?.abort();abort=null;mic?.stop();mic=null;gate.reset();clearWork();}
 function suspend(){generation++;release();busy=false;if(enabled)publish('paused');}
 function stop(note=''){enabled=false;suspend();if(owner===api)owner=null;publish('Off',note);}
 function waitCommand(){pending=null;clearTimer(timer);command={samples:[],started:false,quiet:0};publish('Listening…');onListen();timer=setTimer(()=>{if(command&&!command.started){command=null;timer=null;gate.reset();publish('Waiting for "Kural"');}},6000);}
 function progress(frame,rms){
  onLevel(Math.min(1,rms*8));if(!enabled||paused())return;
  if(command){if(!command.started){if(rms<.01)return;command.started=true;clearTimer(timer);timer=setTimer(()=>void finishCommand(),30000);}command.samples.push(...frame);command.quiet=rms<.01?command.quiet+320:0;if(command.samples.length>=480000||command.quiet>=12800)void finishCommand();}
  else if(pending&&!pending.ended){pending.samples.push(...frame);pending.quiet=rms<.01?pending.quiet+320:0;if(pending.samples.length>=480000||pending.quiet>=12800){pending.ended=true;pending.endTime=now()-(pending.samples.length>=480000?0:800);if(pending.confirmed)void finishLong();}}
 }
 async function connect(){if(!enabled||mic||abort||paused())return;const token=generation;abort=new AbortController();publish('permission');try{const value=await capture({signal:abort.signal,shouldSend:()=>enabled&&!paused(),onFrame:frame=>{if(token!==generation||paused()){gate.reset();return;}gate.push(frame);}});if(!enabled||token!==generation||paused()){value.stop();return;}mic=value;publish('Waiting for "Kural"');}catch{if(token===generation){errors++;release();publish('unavailable','Microphone unavailable; use Hold to talk.');if(errors>=3)stop('Paused after three errors.');}}}
 async function request(pcm,meta){
  busy=true;const token=generation;trace=createWakeTiming(now,now()-1500);trace.mark('speech_onset',now()-1500);trace.mark('wake_request_sent');const turn=trace;
  pending={samples:Array.from(new Int16Array(pcm)),quiet:0,ended:false,confirmed:false,continuing:meta?.continuing===true,endTime:now()-1500+(meta?.speechEndMs??1500)};
  workAbort=new AbortController();const requestAbort=workAbort;try{const answer=await check(pcmWav(pcm),{signal:requestAbort.signal});if(workAbort===requestAbort)workAbort=null;if(token!==generation||!enabled||paused())return;turn.mark('wake_response');turn.heard=answer.transcript;errors=0;
   if(!answer.wake){clearWork();gate.reset();publish('Waiting for "Kural"');}
   else if(pending?.continuing){pending.confirmed=true;publish('Listening…');onListen();timer=setTimer(()=>{if(pending){pending.ended=true;pending.endTime=now();void finishLong();}},28500);if(pending.ended)await finishLong();}
   else if(answer.remainder?.trim()){const ended=pending?.endTime;clearWork();turn.mark('command_end',ended??now());publish('Thinking');turn.routeTaken='wake-remainder';await onQuery(answer.remainder,turn);if(token===generation)publish('Waiting for "Kural"');}
   else waitCommand();
  }catch{if(token===generation){clearWork();gate.reset();if(++errors>=3)stop('Auto-paused after three errors; use Hold to talk.');else publish('Waiting for "Kural"','Wake check unavailable.');}}
  finally{if(token===generation)busy=false;}
 }
 async function submit(samples,strip,turn){let failureNote='';const token=generation;busy=true;publish('Thinking');workAbort=new AbortController();const requestAbort=workAbort;try{const text=await transcribe(pcmWav(new Int16Array(samples.slice(0,480000)).buffer),{signal:requestAbort.signal});if(workAbort===requestAbort)workAbort=null;if(token!==generation||!enabled||paused())return;turn.heard=text;const result=strip?wakeParts(text):null;const query=result?.wake?result.remainder:text;turn.routeTaken='full-utterance';console.info('kural_route',{stage:'command_stt',path:turn.routeTaken,hasText:!!query?.trim()});if(query?.trim())await onQuery(query,turn);else publish('Waiting for "Kural"');errors=0;}catch{if(token===generation){if(++errors>=3)stop('Auto-paused after three errors; use Hold to talk.');else failureNote='Command unavailable; use Hold to talk.';}}finally{if(token===generation){busy=false;gate.reset();if(enabled)publish('Waiting for "Kural"',failureNote);}}}
 async function finishLong(){if(!pending?.confirmed)return;const value=pending;clearWork();trace.mark('command_end',value.endTime||now());await submit(value.samples,true,trace);}
 async function finishCommand(){if(!command?.started)return;const samples=command.samples,ended=now()-(command.quiet>=12800?800:0);clearWork();trace.mark('command_end',ended);await submit(samples,false,trace);}
 const api={async start(){if(!wakeWordEnabled()||enabled)return;if(owner&&owner!==api)owner.stop();owner=api;enabled=true;errors=0;generation++;await connect();},stop,suspend,tick(){if(!enabled)return;if(paused()){if(mic||abort)suspend();}else void connect();},get enabled(){return enabled;}};return api;
}
