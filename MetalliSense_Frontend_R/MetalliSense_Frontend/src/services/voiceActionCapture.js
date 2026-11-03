// Reuses the existing capture implementation after the wake owner is suspended.
import {createMicCapture} from './streamCapture';
import {pcmWav} from './wakeWord';
import {transcribeAudio} from './copilotService';
export async function captureActionReply({signal,timeout,no_store,purpose},onLevel=()=>{}){
 let mic,timer;const chunks=[];let started=false,quiet=0,finished=false;
 try{return await new Promise((resolve,reject)=>{
  const fail=()=>{if(finished)return;finished=true;mic?.stop();reject(new DOMException('Aborted','AbortError'));};
  const done=async()=>{if(finished)return;finished=true;clearTimeout(timer);mic?.stop();if(!started){resolve('');return;}
   const samples=new Int16Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){samples.set(c,at);at+=c.length;}
   try{const r=await transcribeAudio(pcmWav(samples.buffer),null,{signal,no_store,purpose});resolve(r.data.success===false?'':r.data.text||'');}catch(e){reject(e);}
  };
  if(signal.aborted){fail();return;}signal.addEventListener('abort',fail,{once:true});timer=setTimeout(done,timeout);
  createMicCapture({signal,shouldSend:()=>!finished,onFrame:buffer=>{if(finished)return;const pcm=new Int16Array(buffer);const rms=Math.sqrt(pcm.reduce((n,x)=>n+(x/32768)**2,0)/pcm.length);onLevel(Math.min(1,rms*8));if(rms>=.01)started=true;if(started){chunks.push(pcm.slice());quiet=rms<.01?quiet+pcm.length:0;if(quiet>=12800)void done();}}}).then(value=>{mic=value;if(finished)value.stop();}).catch(reject);
 });}finally{clearTimeout(timer);mic?.stop();onLevel(0);}
}
