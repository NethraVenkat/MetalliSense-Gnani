// The confirmation window starts only after the existing mic implementation is ready.
import {createMicCapture} from './streamCapture';
import {pcmWav} from './wakeWord';
import {transcribeAudio} from './copilotService';
export async function captureActionReply({signal,timeout,no_store,purpose,onState=()=>{}},onLevel=()=>{},dependencies={}){
 const capture=dependencies.capture||createMicCapture,transcribe=dependencies.transcribe||transcribeAudio,setTimer=dependencies.setTimer||setTimeout,clearTimer=dependencies.clearTimer||clearTimeout;
 let mic,timer,startupTimer,abortListener;const chunks=[];let started=false,quiet=0,finished=false,ready=false;
 try{return await new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimer(timer);clearTimer(startupTimer);signal.removeEventListener('abort',abortListener);mic?.stop();};
  const fail=error=>{if(finished)return;finished=true;cleanup();reject(error);};
  abortListener=()=>fail(new DOMException('Aborted','AbortError'));
  const done=async reason=>{if(finished)return;finished=true;cleanup();console.info('voice_action_capture',{stage:'capture_end',purpose,reason:started?reason:'no_speech_timeout',samples:chunks.reduce((n,c)=>n+c.length,0)});if(!started){resolve({text:'',reason:'no_speech_timeout'});return;}
   const samples=new Int16Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){samples.set(c,at);at+=c.length;}
   onState('processing');
   try{const r=await transcribe(pcmWav(samples.buffer),null,{signal,no_store,purpose});if(r.data.success===false)throw Error('Confirmation transcription unavailable');resolve({text:r.data.text||'',reason:reason==='timeout'?'utterance_limit':'utterance'});}catch(e){reject(e);}
  };
  if(signal.aborted){abortListener();return;}signal.addEventListener('abort',abortListener,{once:true});onState('starting');console.info('voice_action_capture',{stage:'mic_start',purpose});
  startupTimer=setTimer(()=>fail(Error('Confirmation microphone did not become ready')),10000);
  capture({signal,shouldSend:()=>ready&&!finished,onFrame:buffer=>{if(!ready||finished)return;const pcm=new Int16Array(buffer);const rms=Math.sqrt(pcm.reduce((n,x)=>n+(x/32768)**2,0)/pcm.length);onLevel(Math.min(1,rms*8));if(rms>=.01)started=true;if(started){chunks.push(pcm.slice());quiet=rms<.01?quiet+pcm.length:0;if(quiet>=12800)void done('utterance');}}}).then(value=>{mic=value;if(finished){value.stop();return;}clearTimer(startupTimer);ready=true;onState('listening');console.info('voice_action_capture',{stage:'listening_ready',purpose,window_ms:timeout});timer=setTimer(()=>void done('timeout'),timeout);}).catch(fail);
 });}finally{clearTimer(timer);clearTimer(startupTimer);signal.removeEventListener('abort',abortListener);mic?.stop();onLevel(0);}
}
