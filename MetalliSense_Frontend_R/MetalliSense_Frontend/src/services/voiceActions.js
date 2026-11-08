import {spokenOnly} from './voiceWording';
import {voiceDiagnostics,reasonCode,approvalReason} from './voiceDiagnostics';
import {redactVoiceText} from './voiceAuditText';
import {runConfirmationPrompt,approvalPrompt} from './voiceActionLanguages';
import {formFieldLabel} from './voiceFormContent';
import {scopeFormMatch} from './voiceFormActions';
import {isDecisionCommand} from './voiceDecisionActions';
// Existing foundation demo plus page-scoped F17 adapters; defaults remain off.
import {normalizeSpokenNumbers} from './spokenNumbers';
import {prepareVoiceAction} from './voiceActionRegistry';
export const voiceActionsEnabled=()=>import.meta.env.VITE_VOICE_ACTIONS==='true';
export const screenOnly={ta:'\u0b87\u0ba4\u0bc8 \u0bb8\u0bcd\u0b95\u0bbf\u0bb0\u0bc0\u0ba9\u0bcd\u0bb2 \u0bae\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0bb2\u0bbe\u0bae\u0bcd.',hi:'\u092f\u0939 \u0915\u0947\u0935\u0932 \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u092a\u0930 \u0915\u093f\u092f\u093e \u091c\u093e \u0938\u0915\u0924\u093e \u0939\u0948\u0964',en:'This one is screen-only.'};
const deny=[/\b(?:ingest|upload).*\bcsv\b/iu,/\b(?:delete|remove|reset(?: demo)?|(?:hold|engineer) override|override|bypass|clear chat(?: history)?|edit (?:grade|price|training)(?: data)?|receive (?:lot|additive)|dri lab(?: entry)?|(?:manual (?:lot )?(?:release|reject)|(?:release|reject) lot|release)|issue invoice|approve tap|accept strategy|apply (?:ahp|criteria) weights)\b/iu,/\u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bc1|\u0b85\u0bb4\u0bbf|\u0b93\u0bb5\u0bb0\u0bcd\u0bb0\u0bc8\u0b9f\u0bc1|\u0939\u091f\u093e\u0913|\u092e\u093f\u091f\u093e\u0913|\u0913\u0935\u0930\u0930\u093e\u0907\u0921/u];
export const neverByVoice=(text,route)=>!isDecisionCommand(text,route)&&!scopeFormMatch(text,route)&&deny.some(rule=>rule.test(String(text).normalize('NFKC')));
export const registry=Object.freeze([{id:'test-action',page:'*',level:'RUN',phrases:{ta:['\u0b9f\u0bc6\u0bb8\u0bcd\u0b9f\u0bcd \u0b86\u0b95\u0bcd\u0bb7\u0ba9\u0bcd'],hi:['\u091f\u0947\u0938\u094d\u091f \u090f\u0915\u094d\u0936\u0928'],en:['test action']},requiredRoles:[],buildSummary:()=>({displayText:'Test action: no plant or backend effect.',spokenText:'Test action. No plant or backend effect. Say yes to continue.'}),precheck:()=>({ok:true}),execute:async()=>({status:200,ids:[],demo:true})}]);
export const normalizePasscode=text=>normalizeSpokenNumbers(text).replace(/\s+/g,'');
export const MASK='\u2022'.repeat(6);
// Only explicit non-speech markers are ignored; unfamiliar real words are not
// silently classified as silence, and no transcript is inferred from RMS.
export const hasConfirmationWords=text=>/[\p{L}\p{N}]/u.test(String(text||'').replace(/[\[(]\s*(?:noise|silence|music|inaudible|no speech)\s*[\])]/giu,''));
export const yesNo=text=>/^(?:yes|yeah|ok|okay|\u0938\u0939\u0940|\u0b86\u0bae\u0bcd|\u0b86\u0bae\u0bbe|\u0b86\u0bae\u0bbe\u0bae\u0bcd|\u0939\u093e\u0901|\u0939\u093e\u0902)$/iu.test(String(text).normalize('NFKC').replace(/\p{P}/gu,'').trim())?'yes':/^(?:no|\u0b87\u0bb2\u0bcd\u0bb2\u0bc8|\u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bbe\u0bae\u0bcd|\u0928\u0939\u0940\u0902|\u0928\u0939\u0940)$/iu.test(String(text).normalize('NFKC').replace(/\p{P}/gu,'').trim())?'no':null;
export const matchAction=(text,context)=>registry.find(a=>Object.values(a.phrases).flat().includes(String(text).normalize('NFKC').toLowerCase().replace(/[.!?]/g,'').trim()))||prepareVoiceAction(text,context);
// Dependency-injected state machine: no microphone, transport, navigation or plant service owner.
export function createActionFlow({api,say:speak,capture,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}){
 let active=false,generation=0,timer,abort,currentPage='',originalText='',wordVerified=false,lastSpoken='',diagnosticContext=null,heardText='';
 const say=async text=>{lastSpoken=spokenOnly(text);return speak(lastSpoken);};
 const publish=value=>onChange(value);
 async function audit(action,decision,extra={}){await api.audit({...voiceDiagnostics(heardText,{winner:action.id,level:action.level,context:diagnosticContext,privateTurn:action.level==='APPROVE',reason:extra.reason_code||reasonCode(null,decision)}),page:currentPage,transcript:action.level==='APPROVE'?MASK:originalText,level:action.level,intent:action.id,confirmation:action.level==='APPROVE'?'passcode':'yes',decision,confirmation_word:action.confirmWord||null,confirmation_word_verified:wordVerified,spoken_reply:redactVoiceText(extra.spoken_reply??lastSpoken),...extra});}
 const wait=ms=>new Promise((resolve,reject)=>{const signal=abort.signal;const cancel=()=>{clearTimer(timer);reject(new DOMException('Aborted','AbortError'));};timer=setTimer(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();});
 return {get active(){return active;},cancel(){if(!active)return;generation++;abort?.abort();clearTimer(timer);api.cancel?.().catch(()=>{});publish(null);},async run(action,ctx={}){
  if(active)return false;active=true;wordVerified=false;currentPage=ctx.page||'';diagnosticContext=ctx.context;heardText=ctx.originalText||'';originalText=redactVoiceText(ctx.originalText||'',{transcript:true});lastSpoken='';const ticket=++generation;abort=new AbortController();const signal=abort.signal;let decision='failed',reason='action_failed';
  try{
   if(!action.scopeChange&&(neverByVoice(action.id)||neverByVoice(ctx.originalText||''))||ctx.gate?.decision==='HOLD'&&action.level==='APPROVE'&&action.id!=='override_start')throw Error('screen-only');
   const ask=async prompt=>{
    const label=formFieldLabel(prompt,ctx.lang);const wording=ctx.lang==='ta'?label+' — சொல்லுங்க.':ctx.lang==='hi'?label+' — बताइए।':prompt;
    publish({phase:'form',level:action.level,prompt:wording});await say(wording);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const response=await capture({signal,timeout:15000,no_store:false,purpose:'form',page:ctx.page,onState:state=>publish({phase:state==='listening'?'confirm':'form',level:action.level,prompt:wording})});if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const text=String(typeof response==='string'?response:response.text||'').trim();if(/^(cancel|stop|ரத்து|வேண்டாம்|रद्द)[.!?।]*$/iu.test(text))throw new DOMException('Cancelled','AbortError');
    if(!hasConfirmationWords(text)){const error=Error('No reply — action not done.');error.timeout=true;throw error;}if(/^(skip|விடு|छोड़ो)[.!?।]*$/iu.test(text))throw Object.assign(Error('Required field cannot be skipped.'),{refused:true});return text;
   };
   if(action.collect)await action.collect(ask,ctx);
   const check=await action.precheck(ctx);if(!check?.ok){decision='refused';throw Error('Precheck refused');}
   const summary=action.buildSummary(ctx);publish({phase:'readback',level:action.level,summary:summary.displayText});await say(summary.spokenText);if(signal.aborted)throw Error('cancelled');
   if(action.needsReason){publish({phase:'reason',level:action.level,prompt:'Reason?',summary:summary.displayText});await say('Reason?');const reply=await capture({signal,timeout:12000,no_store:false,purpose:'reason',page:ctx.page});ctx.reason=String(typeof reply==='string'?reply:reply.text||'').trim();if(ctx.reason.length<5){decision='refused';throw Error('A reason of at least 5 characters is required.');}}
   if(action.level!=='ASK')await api.readback({action_id:action.id,summary:summary.displayText,page:ctx.page});
   if(action.cancelWindow){
    const prompt=ctx.lang==='ta'?`செய்கிறேன்: ${summary.spokenText} ரத்து செய்ய ரத்து சொல்லுங்கள்.`:ctx.lang==='hi'?`कर रहा हूँ: ${summary.spokenText} रद्द करने के लिए रद्द बोलिए।`:`Doing it: ${summary.spokenText} Say cancel to stop.`;
    publish({phase:'safe-prompt',level:'ASK',summary:summary.displayText,prompt,speaking:true});await say(prompt);
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    let until=null,current={phase:'safe-starting',level:'ASK',summary:summary.displayText,prompt:'Opening cancellation microphone...'};
    const update=patch=>{current={...current,...patch};publish(current);};
    let response;
    try{response=await capture({signal,timeout:2000,no_store:false,purpose:'cancel',page:ctx.page,onCountdown:remaining=>{if(until===null)until=now()+2000;update({remaining});},onState:state=>{if(state==='listening'&&until===null)until=now()+2000;update({phase:'safe-cancel',capturing:state==='listening',prompt:state==='processing'?'Checking cancellation...':'Say cancel to stop'});}});}
    catch(error){if(signal.aborted)throw error;throw Object.assign(Error('Cancellation microphone unavailable. Action not done.'),{refused:true,reason_code:'private_capture_failed'});}
    const reply=String(typeof response==='string'?response:response?.text||'').normalize('NFKC');
    if(/\b(?:cancel|stop)\b|ரத்து|வேண்டாம்|रद्द|रुको/iu.test(reply))throw new DOMException('Cancelled','AbortError');
    // Injected captures may omit readiness callbacks; never shorten the window.
    if(until===null)until=now()+2000;
    while(now()<until){const remaining=until-now();update({remaining:Math.ceil(remaining/1000),capturing:false});await wait(Math.min(1000,remaining));}
   }else if(action.level==='RUN'){
    const question=runConfirmationPrompt[ctx.lang]||runConfirmationPrompt.en;
    const base={level:'RUN',summary:summary.displayText,question};
    publish({...base,phase:'confirm-prompt',prompt:'Confirmation'});await say(question);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const replyAbort=new AbortController();let settleTap;
    const tap=new Promise((resolve,reject)=>{settleTap=resolve;replyAbort.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});
    const stopReply=()=>replyAbort.abort();signal.addEventListener('abort',stopReply,{once:true});
    let current={...base,phase:'confirm-starting',prompt:'Starting confirmation microphone...'};
    const update=patch=>{current={...current,...patch};if(!replyAbort.signal.aborted&&!signal.aborted)publish(current);};
    current.onReply=answer=>{if(!replyAbort.signal.aborted)settleTap({text:answer});};publish(current);
    let response;
    try{
     const voice=Promise.resolve().then(()=>capture({signal:replyAbort.signal,timeout:8000,no_store:false,purpose:'confirmation',page:ctx.page,runConfirmation:true,
      onCountdown:remaining=>update({remaining}),
      onState:phase=>update({phase:phase==='listening'?'confirm':phase==='processing'?'confirm-processing':'confirm-starting',prompt:phase==='listening'?'Listening...':phase==='processing'?'Checking confirmation...':'Starting confirmation microphone...',...(phase==='processing'?{remaining:null}:{})})
     })).catch(error=>{if(!error.micUnavailable)throw error;update({phase:'confirm-unavailable',remaining:null,prompt:'Mic not available \u2014 tap Yes or No'});return tap;});
     response=await Promise.race([tap,voice]);
    }finally{signal.removeEventListener('abort',stopReply);replyAbort.abort();}
    if(signal.aborted)throw Error('cancelled');
    const text=typeof response==='string'?response:response.text;const outcome=typeof response==='string'&&!response?'no_speech_timeout':response.reason;
    if(outcome==='no_speech_timeout'||!hasConfirmationWords(text)){decision='timeout';reason='confirmation_timeout';throw Error('No reply — action not done.');}
    const answer=yesNo(text);
    if(answer==='no'){decision='cancelled';reason='confirmation_no';throw Error('Declined');}
    if(answer!=='yes'){reason='confirmation_unrecognized';throw Error('Confirmation not understood; action not executed');}
   }else if(action.level==='APPROVE'){
    let auth,invalidReplies=0;
    let prompt=approvalPrompt[ctx.lang]||approvalPrompt.en;
    for(let attempt=0;attempt<4;attempt++){
     publish({phase:'passcode-prompt',level:'APPROVE',summary:summary.displayText,prompt,masked:MASK});await say(prompt);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
     let response;let remaining=null;
     try{response=await capture({signal,timeout:12000,no_store:true,purpose:'passcode',page:ctx.page,language:ctx.lang==='hi'?'hi-IN,en-IN':'ta-IN,en-IN',onCountdown:value=>{remaining=value;},onState:state=>publish({phase:'passcode',level:'APPROVE',summary:summary.displayText,prompt:state==='processing'?'Checking approval...':prompt,masked:MASK,capturing:state==='listening',remaining})});}
     catch(error){if(signal.aborted)throw error;throw Object.assign(Error(approvalReason({reason_code:'private_capture_failed'},ctx.lang)),{refused:true,reason_code:'private_capture_failed'});}
     const text=typeof response==='string'?response:response.text;if(signal.aborted)throw new DOMException('Cancelled','AbortError');
     if(response?.reason==='no_speech_timeout'){decision='timeout';throw Object.assign(Error('No reply — action not done.'),{reason_code:'timeout'});}
     // Renew the same reviewed action after capture; the server's 15 s expiry
     // stays unchanged and never includes provider transcription latency.
     if(ctx.context?.isCurrent?.(ctx.context.scope)===false)throw Object.assign(Error('Page changed; action cancelled.'),{reason_code:'stale_target'});
     await api.readback({action_id:action.id,summary:summary.displayText,page:ctx.page});
     auth=await api.authorize({action_id:action.id,required_roles:action.requiredRoles,spoken_code_text:text});
     if(auth.ok)break;
     const feedback=approvalReason(auth,ctx.lang);
     if(auth.reason_code==='code_not_digits'&&invalidReplies++===0){prompt=feedback;continue;}
     if(auth.reason_code==='wrong_code'&&auth.tries_remaining>0){prompt=feedback+' '+(approvalPrompt[ctx.lang]||approvalPrompt.en);continue;}
     decision=auth.locked?'locked':'refused';throw Object.assign(Error(feedback),{reason_code:auth.reason_code||'backend_refused'});
    }
    if(!auth?.ok){decision='refused';throw Object.assign(Error(approvalReason(auth||{},ctx.lang)),{reason_code:auth?.reason_code||'backend_refused'});}
    if(action.confirmWord){
     publish({phase:'word',level:action.level,prompt:'Say '+action.confirmWord,masked:MASK});await say(ctx.lang==='ta'?action.confirmWord+' சொல்லுங்க.':ctx.lang==='hi'?action.confirmWord+' बोलिए।':'Say '+action.confirmWord);
     const reply=await capture({signal,timeout:8000,no_store:true,purpose:'confirmation',onState:state=>publish({phase:state==='listening'?'confirm':'word',level:action.level,prompt:'Say '+action.confirmWord,masked:MASK})});
     const word=String(typeof reply==='string'?reply:reply.text||'').normalize('NFKC').replace(/\p{P}/gu,'').trim().toUpperCase();
     if(!word){decision='timeout';reason='confirmation_word_timeout';throw Error('No reply — action not done.');}
     if(word!==action.confirmWord){decision='cancelled';reason='confirmation_word_mismatch';throw Error('Confirmation word did not match.');}const verified=await api.confirmWord({token:auth.token,action_id:action.id,spoken_word:word});if(!verified.ok){decision='refused';throw Error('Confirmation token unavailable.');}wordVerified=true;
    }
    const executeAt=now()+5000;while(now()<executeAt){const remaining=executeAt-now();publish({phase:'countdown',level:'APPROVE',summary:summary.displayText,seconds:Math.ceil(remaining/1000),user:auth.user});await wait(Math.min(1000,remaining));}
    if(signal.aborted)throw Error('cancelled');const consumed=await api.consume({token:auth.token,action_id:action.id});if(!consumed.ok)throw Error('Approval expired');ctx.user=consumed.user||auth.user;
   }
   if(signal.aborted||ticket!==generation)throw Error('cancelled');publish({phase:'executing',level:action.level,summary:summary.displayText});
   const result=await action.execute(ctx);if(!result||result.status<200||result.status>=300)throw Error('Backend action failed');decision='executed';
   await audit(action,decision,{summary:summary.displayText,spoken_reply:redactVoiceText(result.message||lastSpoken),backend_result:{status:result.status,ids:result.ids||[]}});publish({phase:'result',level:action.level,result:result.message||'Completed',summary:summary.displayText,speaking:Boolean(result.message)});if(result.message)await say(result.message==='Completed'?(ctx.lang==='ta'?'முடிஞ்சது.':ctx.lang==='hi'?'पूरा हुआ।':result.message):result.message);publish({phase:'result',level:action.level,result:result.message||'Completed',summary:summary.displayText,speaking:false});return true;
  }catch(error){if(error.timeout)decision='timeout';if(error.name==='AbortError')decision='cancelled';if(error.refused||[400,403,409,422].includes(error.response?.status))decision='refused';if(signal.aborted)decision='cancelled';const message=error.response?.data?.message||error.message;try{await audit(action,decision,{reason_code:reasonCode(error,decision),spoken_reply:redactVoiceText(decision==='refused'?message:lastSpoken),error:signal.aborted?'cancelled_by_user_or_context':reason,summary:signal.aborted?'Cancelled':String(message).slice(0,200),...(error.response?{backend_result:{status:error.response.status,ids:[]}}:{})});}catch{publish({phase:'error',result:'Audit unavailable; no success recorded'});return false;}
   if(ticket===generation){const terminal={phase:decision==='cancelled'?'cancelled':decision==='timeout'?'timeout':'error',level:action.level,result:decision==='cancelled'?'Cancelled':error.message};publish({...terminal,speaking:['refused','locked'].includes(decision)});if(['refused','locked'].includes(decision)){await say(message);if(ticket===generation)publish({...terminal,speaking:false});}}return false;
  }finally{if(decision!=='executed')await api.cancel?.().catch(()=>{});active=false;clearTimer(timer);}
 }};
}
