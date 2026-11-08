import {createMicCapture} from './streamCapture';
import {pcmWav} from './wakeWord';
import {transcribeAudio} from './copilotService';

// RUN only: callers await spoken read-back and question before entering here.
export function captureRunReply({signal,timeout=8000,no_store=false,purpose='confirmation',page,language=null,runConfirmation=true,onState=()=>{},onCountdown=()=>{}},onLevel=()=>{},dependencies={}) {
 const capture=dependencies.capture||createMicCapture,transcribe=dependencies.transcribe||transcribeAudio;
 const setTimer=dependencies.setTimer||setTimeout,clearTimer=dependencies.clearTimer||clearTimeout;
 const now=dependencies.now||Date.now,minimumSpeech=runConfirmation?1600:1,silenceSamples=runConfirmation?11200:12800;
 const log=(stage,details={})=>{if(import.meta.env.VITE_VOICE_TIMING==='true')console.info('voice_action_capture',{stage,...details});};
 return new Promise((resolve,reject)=>{
  let mic,finished=false,opened=false,ready=false,speech=0,quiet=0,total=0,started=false,peak=0,elapsed=0;
  let gap,startup,deadline,tick,limit;const chunks=[];
  const cleanup=()=>{[gap,startup,deadline,tick,limit].forEach(clearTimer);signal.removeEventListener('abort',abort);mic?.stop();onLevel(0);};
  const fail=error=>{if(finished)return;finished=true;log('capture_failed',{kind:error.name,ready});cleanup();reject(error);};
  const abort=()=>fail(new DOMException('Aborted','AbortError'));
  const done=async()=>{
   if(finished)return;finished=true;cleanup();log('peak_rms',{value:peak});log(started?'sent':'no_speech');
   if(!started){resolve({text:'',reason:'no_speech_timeout'});return;}
   const samples=new Int16Array(total);let offset=0;for(const chunk of chunks){samples.set(chunk,offset);offset+=chunk.length;}
   onState('processing');
   try{const r=await transcribe(pcmWav(samples.buffer),language,{signal,no_store,purpose,page});if(r.data.success===false)throw Error('Confirmation transcription unavailable');resolve({text:r.data.text||'',reason:'utterance'});}catch(error){reject(error);}
  };
  const countUntil=end=>{clearTimer(tick);const remaining=Math.max(0,Math.ceil((end-now())/1000));onCountdown(remaining);if(remaining>0)tick=setTimer(()=>countUntil(end),Math.min(1000,end-now()));};
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});onState('starting');
  gap=setTimer(()=>{
   startup=setTimer(()=>fail(Object.assign(Error('Microphone did not produce audio'),{micUnavailable:true})),10000);
   log('mic_requested');
   Promise.resolve().then(()=>capture({signal,shouldSend:()=>!finished,onFrame:buffer=>{
    if(finished||!buffer.byteLength)return;
    if(!opened){opened=true;log('mic_open');}
    const pcm=new Int16Array(buffer);
    if(!ready){ready=true;clearTimer(startup);log('reply_listen_start');onState('listening');countUntil(now()+timeout);deadline=setTimer(done,timeout);}
    const rms=Math.sqrt(pcm.reduce((n,x)=>n+(x/32768)**2,0)/pcm.length);peak=Math.max(peak,rms);onLevel(Math.min(1,rms*8));
    elapsed+=pcm.length/16;
    if(!started){
     // Keep unvoiced consonants and brief gaps inside a short yes/no. The
     // speech requirement stays 100 ms; silence must last 700 ms to reset it.
     if(rms>=.01){speech+=pcm.length;quiet=0;}else quiet+=pcm.length;
     if(speech){chunks.push(pcm.slice());total+=pcm.length;}
     if(quiet>=silenceSamples){speech=0;chunks.length=0;total=0;}
     if(speech>=minimumSpeech){started=true;log('first_speech_ms',{value:elapsed-total/16});if(runConfirmation){clearTimer(deadline);const duration=Math.max(0,4000-total/16);countUntil(now()+duration);limit=setTimer(done,duration);}}
    }else{chunks.push(pcm.slice());total+=pcm.length;quiet=rms<.01?quiet+pcm.length:0;if(quiet>=silenceSamples||runConfirmation&&total>=64000)void done();}
   }})).then(value=>{mic=value;if(finished){value.stop();return;}if(!opened){opened=true;log('mic_open');}}).catch(error=>fail(Object.assign(error,{micUnavailable:true})));
  },300);
 });
}
