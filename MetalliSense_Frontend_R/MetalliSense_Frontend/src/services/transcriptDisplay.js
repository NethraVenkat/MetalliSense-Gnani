export const transliterateEnabled=()=>import.meta.env.VITE_TRANSLITERATE==='true';
const KEY='metallisense.voice.transliterate';
export function readTransliteratePreference(){
 if(!transliterateEnabled())return false;
 try{return localStorage.getItem(KEY)==='true';}catch{return false;}
}
export function saveTransliteratePreference(value){try{localStorage.setItem(KEY,String(value));}catch{/* optional storage */}}
export function latinTranscript(data,requested){
 return transliterateEnabled()&&requested&&typeof data?.transcript_latin==='string'?data.transcript_latin.trim():'';
}
export function handleDisplayTranscription(data,handler,onLatin,requested,metadata={}){
 const {transcript_latin,...normal}=data;
 // Only the normal transcript and normal metadata cross the answer boundary.
 const answer=handler(normal.text?.trim()||'',{...normal,...metadata});
 onLatin(''); // Main responses never supply display text, even if a stale server does.
 return answer;
}

export function createLatinDisplay({request,onText,afterSpeech=()=>Promise.resolve()}){
 let generation=0,pending=Promise.resolve();
 return {
  invalidate(){generation++;onText('');return generation;},
  // A previous turn's optional request must finish before a new primary upload.
  // Recording and already-started answers remain independent of this request.
  beforeMain(){return pending;},
  async afterMain(data,handler,audio,requested,ticket,metadata={}){
   const result=await handleDisplayTranscription(data,handler,onText,false,metadata);
   if(!transliterateEnabled()||!requested||data.success===false||ticket!==generation)return result;
   // Observe existing playback completion in the background. This also keeps
   // the optional STT away from an in-flight Gnani TTS/SSE request.
   void Promise.resolve(afterSpeech()).then(()=>{
    if(ticket!==generation)return;
    pending=pending.catch(()=>{}).then(async()=>{
     if(ticket!==generation)return;
     try{
      const response=await request(audio);
      if(ticket===generation)onText(latinTranscript(response.data,true));
     }catch{if(ticket===generation)onText('');}
    });
   }).catch(()=>{});
   // Never await the optional request to finish the primary answer path.
   return result;
  },
 };
}
