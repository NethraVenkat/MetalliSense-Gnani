import {createHandsFreeSession} from '../hooks/useHandsFree';
import {createPttRecordingLifecycle} from './pttRecording';
import {transcribeAudio} from './copilotService';

// Explicit opt-in only; no stored preference. Uses the existing capture/STT paths.
export function createTourMicrophone({onTranscript,control,onChange=()=>{},
 createSession=createHandsFreeSession,getMedia=()=>navigator.mediaDevices.getUserMedia({audio:true}),
 Recorder=globalThis.MediaRecorder,transcribe=transcribeAudio}={}){
 let active=false,lang='ta',scope=null,generation=0,recording=null,stream=null,held=false,busy=false,disposed=false,inflight=false;
 const publish=value=>{if(!disposed)onChange(value);};
 const session=createSession({dedupeMode:'utterance',rejectGuardedFinals:true,
  onTranscript:(text,metadata)=>{if(active&&!busy&&!held)return onTranscript(text,metadata);},
  isPaused:()=>!active||busy||held,
  onChange:value=>publish(value)});
 const cancelPtt=()=>{generation++;held=false;busy=false;recording?.cancel();recording=null;stream?.getTracks().forEach(t=>t.stop());stream=null;};
 const stop=()=>{session.stop();cancelPtt();publish({enabled:false,state:'off',message:''});};
 return {
  context(next){
   if(active&&!next.active||lang!==next.lang)stop();
   else if(scope!==next.scope)cancelPtt();
   active=next.active;lang=next.lang;scope=next.scope;
  },
  start(){if(active&&!busy&&!held&&!inflight)session.start();},stop,
  async startPtt(){
   if(!active||busy||held||inflight)return;
   control('voice-pause');held=true;busy=true;
   const ticket=++generation;
   const current=()=>!disposed&&active&&ticket===generation;
   publish({enabled:false,state:'connecting',message:''});
   try{
    if(session.stopAndWait)await session.stopAndWait();else session.stop();
    if(!current()||!held){if(current()){busy=false;publish({enabled:false,state:'off',message:''});}return;}
    const media=await getMedia();
    if(!current()||!held){media.getTracks().forEach(t=>t.stop());if(current()){busy=false;publish({enabled:false,state:'off',message:''});}return;}
    stream=media;
    if(!Recorder)throw Error('Recorder unavailable');
    const type=['audio/webm','audio/mp4'].find(t=>Recorder.isTypeSupported?.(t));
    const recorder=new Recorder(media,type?{mimeType:type}:undefined),chunks=[];
    recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
    const lifecycle=createPttRecordingLifecycle({recorder,stream:media,onLimit:()=>{held=false;},onStop:async()=>{
     held=false;if(!current())return;
     publish({enabled:false,state:'processing',message:''});
     try{
      if(!chunks.length){publish({enabled:false,state:'off',message:''});return;}
      const blob=new Blob(chunks,{type:recorder.mimeType||type||'audio/webm'});
      inflight=true;const response=await transcribe(blob,lang);
      if(!current())return;
      if(response.data?.success===false)throw Error('STT failed');
      const text=response.data?.text||response.data?.transcript||'';
      if(text.trim())await onTranscript(text,response.data);
      if(current())publish({enabled:false,state:'off',message:''});
     }catch{if(current())publish({enabled:false,state:'error',message:'stt'});}
     finally{inflight=false;if(current()){busy=false;recording=null;stream=null;}}
    }});
    recording=lifecycle;
    recorder.onerror=()=>{lifecycle.cancel();if(current()){cancelPtt();publish({enabled:false,state:'error',message:'microphone'});}};
    lifecycle.start();publish({enabled:false,state:'recording',message:''});
   }catch{if(current()){cancelPtt();publish({enabled:false,state:'error',message:'microphone'});}}
  },
  stopPtt(){held=false;recording?.stop();},
  dispose(){disposed=true;stop();},
 };
}
