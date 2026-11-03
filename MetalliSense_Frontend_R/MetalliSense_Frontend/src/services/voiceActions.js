// Foundation only: the public registry contains one no-effect RUN action.
import {normalizeSpokenNumbers} from './spokenNumbers';
export const voiceActionsEnabled=()=>import.meta.env.VITE_VOICE_ACTIONS==='true';
export const screenOnly={ta:'\u0b87\u0ba4\u0bc8 \u0bb8\u0bcd\u0b95\u0bbf\u0bb0\u0bc0\u0ba9\u0bcd\u0bb2 \u0bae\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0bb2\u0bbe\u0bae\u0bcd.',hi:'\u092f\u0939 \u0915\u0947\u0935\u0932 \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u092a\u0930 \u0915\u093f\u092f\u093e \u091c\u093e \u0938\u0915\u0924\u093e \u0939\u0948\u0964',en:'This one is screen-only.'};
const deny=[/\b(?:delete|remove|reset(?: demo)?|(?:hold|engineer) override|override|bypass|clear chat(?: history)?|edit (?:grade|price|training)(?: data)?|receive (?:lot|additive)|dri lab(?: entry)?|(?:manual lot )?(?:release|reject)|issue invoice|approve tap|accept strategy)\b/iu,/\u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bc1|\u0b85\u0bb4\u0bbf|\u0b93\u0bb5\u0bb0\u0bcd\u0bb0\u0bc8\u0b9f\u0bc1|\u0939\u091f\u093e\u0913|\u092e\u093f\u091f\u093e\u0913|\u0913\u0935\u0930\u0930\u093e\u0907\u0921/u];
export const neverByVoice=text=>deny.some(rule=>rule.test(String(text).normalize('NFKC')));
export const registry=Object.freeze([{id:'test-action',page:'*',level:'RUN',phrases:{ta:['\u0b9f\u0bc6\u0bb8\u0bcd\u0b9f\u0bcd \u0b86\u0b95\u0bcd\u0bb7\u0ba9\u0bcd'],hi:['\u091f\u0947\u0938\u094d\u091f \u090f\u0915\u094d\u0936\u0928'],en:['test action']},requiredRoles:[],buildSummary:()=>({displayText:'Test action: no plant or backend effect.',spokenText:'Test action. No plant or backend effect. Say yes to continue.'}),precheck:()=>({ok:true}),execute:async()=>({status:200,ids:[],demo:true})}]);
export const normalizePasscode=text=>normalizeSpokenNumbers(text).replace(/\s+/g,'');
export const MASK='\u2022'.repeat(6);
// Only explicit non-speech markers are ignored; unfamiliar real words are not
// silently classified as silence, and no transcript is inferred from RMS.
export const hasConfirmationWords=text=>/[\p{L}\p{N}]/u.test(String(text||'').replace(/[\[(]\s*(?:noise|silence|music|inaudible|no speech)\s*[\])]/giu,''));
export const yesNo=text=>/^(?:yes|ok|okay|\u0b86\u0bae\u0bcd|\u0b86\u0bae\u0bbe|\u0b86\u0bae\u0bbe\u0bae\u0bcd|\u0939\u093e\u0901|\u0939\u093e\u0902)$/iu.test(String(text).normalize('NFKC').replace(/\p{P}/gu,'').trim())?'yes':/^(?:no|\u0b87\u0bb2\u0bcd\u0bb2\u0bc8|\u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bbe\u0bae\u0bcd|\u0928\u0939\u0940\u0902|\u0928\u0939\u0940)$/iu.test(String(text).normalize('NFKC').replace(/\p{P}/gu,'').trim())?'no':null;
export const matchAction=text=>registry.find(a=>Object.values(a.phrases).flat().includes(String(text).normalize('NFKC').toLowerCase().replace(/[.!?]/g,'').trim()));
// Dependency-injected state machine: no microphone, transport, navigation or plant service owner.
export function createActionFlow({api,say,capture,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let active=false,generation=0,timer,abort,currentPage='',originalText='';
 const publish=value=>onChange(value);
 async function audit(action,decision,extra={}){await api.audit({page:currentPage,transcript:action.level==='APPROVE'?MASK:originalText,level:action.level,intent:action.id,confirmation:action.level==='APPROVE'?'passcode':'yes',decision,...extra});}
 const wait=ms=>new Promise((resolve,reject)=>{timer=setTimer(resolve,ms);abort.signal.addEventListener('abort',()=>{clearTimer(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
 return {get active(){return active;},cancel(){if(!active)return;generation++;abort?.abort();clearTimer(timer);api.cancel?.().catch(()=>{});publish(null);},async run(action,ctx={}){
  if(active)return false;active=true;currentPage=ctx.page||'';originalText=ctx.originalText||'';const ticket=++generation;abort=new AbortController();const signal=abort.signal;let decision='failed',reason='action_failed';
  try{
   if(neverByVoice(action.id)||neverByVoice(ctx.originalText||'')||ctx.gate?.decision==='HOLD'&&action.level==='APPROVE')throw Error('screen-only');
   const check=await action.precheck(ctx);if(!check?.ok){decision='refused';throw Error('Precheck refused');}
   const summary=action.buildSummary(ctx);publish({phase:'readback',level:action.level,summary:summary.displayText});await say(summary.spokenText);if(signal.aborted)throw Error('cancelled');
   await api.readback({action_id:action.id,summary:summary.displayText,page:ctx.page});
   if(action.level==='RUN'){
    const base={level:'RUN',summary:summary.displayText};publish({...base,phase:'confirm-starting',prompt:'Starting confirmation microphone...'});
    const response=await capture({signal,timeout:8000,no_store:false,purpose:'confirmation',onState:phase=>{if(!signal.aborted)publish({...base,phase:phase==='listening'?'confirm':phase==='processing'?'confirm-processing':'confirm-starting',prompt:phase==='listening'?'Listening... say yes or no':phase==='processing'?'Checking confirmation...':'Starting confirmation microphone...'});}});if(signal.aborted)throw Error('cancelled');
    const text=typeof response==='string'?response:response.text;const outcome=typeof response==='string'&&!response?'no_speech_timeout':response.reason;
    if(outcome==='no_speech_timeout'||!hasConfirmationWords(text)){decision='timeout';reason='confirmation_timeout';throw Error('No reply — action not done.');}
    const answer=yesNo(text);
    if(answer==='no'){decision='cancelled';reason='confirmation_no';throw Error('Declined');}
    if(answer!=='yes'){reason='confirmation_unrecognized';throw Error('Confirmation not understood; action not executed');}
   }else if(action.level==='APPROVE'){
    publish({phase:'passcode',level:'APPROVE',summary:summary.displayText,prompt:'Say your passcode',masked:MASK});
    const response=await capture({signal,timeout:12000,no_store:true,purpose:'passcode'});const text=typeof response==='string'?response:response.text;if(signal.aborted)throw Error('cancelled');
    const auth=await api.authorize({action_id:action.id,required_roles:action.requiredRoles,spoken_code_text:text});
    if(!auth.ok){decision=auth.locked?'locked':'refused';throw Error(auth.locked?'Voice approvals locked for 10 minutes':'Approval refused');}
    for(let seconds=5;seconds>0;seconds--){publish({phase:'countdown',level:'APPROVE',summary:summary.displayText,seconds,user:auth.user});await wait(1000);}
    if(signal.aborted)throw Error('cancelled');const consumed=await api.consume({token:auth.token,action_id:action.id});if(!consumed.ok)throw Error('Approval expired');
   }
   if(signal.aborted||ticket!==generation)throw Error('cancelled');publish({phase:'executing',level:action.level,summary:summary.displayText});
   const result=await action.execute(ctx);if(!result||result.status<200||result.status>=300)throw Error('Backend action failed');decision='executed';
   await audit(action,decision,{summary:summary.displayText,backend_result:{status:result.status,ids:result.ids||[]}});publish({phase:'result',level:action.level,result:'Completed',summary:summary.displayText});return true;
  }catch(error){if(signal.aborted)decision='cancelled';try{await audit(action,decision,{error:signal.aborted?'cancelled_by_user_or_context':reason,summary:signal.aborted?'Cancelled':String(error.message).slice(0,120)});}catch{publish({phase:'error',result:'Audit unavailable; no success recorded'});return false;}
   if(ticket===generation)publish({phase:decision==='cancelled'?'cancelled':decision==='timeout'?'timeout':'error',level:action.level,result:decision==='cancelled'?'Cancelled':error.message});return false;
  }finally{active=false;clearTimer(timer);}
 }};
}
