import {normalizeSpokenNumbers} from './spokenNumbers';
import {nativeActions} from './voiceActionLanguages';
import {redactVoiceText} from './voiceAuditText';
import {normalizeCommandText} from './voiceCommandText';

export const privateTranscript='[passcode masked]';
export const normalizeVoiceMatch=normalizeCommandText;
// Scores are deterministic phrase/token match scores, never model probabilities.
export function voiceDiagnostics(text,{winner='no_match',level='ASK',context,privateTurn=false,reason='no_match'}={}){
 const normalized=normalizeVoiceMatch(text),tokens=new Set(normalized.split(' '));
 const candidates=Object.entries(nativeActions).map(([intent,row])=>{
  const phrases=[row.canonical,...(row.en||[]),...(row.ta||[]),...(row.hi||[]),...(row.tanglish||[])];
  const score=Math.max(...phrases.map(phrase=>{const value=normalizeVoiceMatch(phrase);return normalized===value?1:normalized.startsWith(value+' ')?0.95:value.split(' ').filter(t=>tokens.has(t)).length/Math.max(tokens.size,value.split(' ').length)*0.7;}));
  return {intent,score:Math.round(score*1000)/1000};
 }).sort((a,b)=>b.score-a.score||a.intent.localeCompare(b.intent));
 if(winner!=='no_match'&&winner!=='no match'&&!candidates.some(c=>c.intent===winner))candidates.unshift({intent:winner,score:1});
 else if(candidates.some(c=>c.intent===winner)){const row=candidates.find(c=>c.intent===winner);row.score=1;candidates.sort((a,b)=>b.score-a.score);}
 const spokenTarget=normalized.match(/\b(?:h|heat|pr|qa|lot)\s*-?\s*[a-z]*\d+\b/iu)?.[0];
 return {heard:privateTurn?privateTranscript:redactVoiceText(text),normalized_text:privateTurn?privateTranscript:redactVoiceText(normalized),candidates:candidates.slice(0,3),winner,level,target:redactVoiceText(spokenTarget||Object.values(context?.selected||{}).find(Boolean)||''),reason_code:reason};
}
export function reasonCode(error,decision){
 if(error?.reason_code)return error.reason_code;
 if(decision==='cancelled'||decision==='timeout'||decision==='executed')return decision;
 if(error?.micUnavailable)return 'private_capture_failed';
 if(/stale|expired|page changed/i.test(error?.message||''))return 'stale_target';
 if(/which |select |target.*missing|not loaded|unavailable/i.test(error?.message||''))return 'no_target';
 return 'backend_refused';
}
export function approvalReason(result,lang='en'){
 const tries=result.tries_remaining??0,minutes=Math.max(1,Math.ceil((result.retry_after||result.remaining_seconds||0)/60));
 const messages={
  wrong_code:{en:`Wrong code, ${tries} tries left.`,ta:`குறியீடு தவறு. இன்னும் ${tries} முயற்சிகள் உள்ளன.`,hi:`गलत कोड। ${tries} प्रयास बाकी हैं।`},
  wrong_role:{en:'Your role cannot approve this action.',ta:'உங்கள் பணிப்பங்கிற்கு இந்த அனுமதி இல்லை.',hi:'आपकी भूमिका को इस कार्रवाई की अनुमति नहीं है।'},
  code_not_digits:{en:"I didn't catch 6 digits. Say only the 6 digits.",ta:'ஆறு இலக்கங்கள் கிடைக்கவில்லை. ஆறு இலக்கங்களை மட்டும் சொல்லுங்கள்.',hi:'छह अंक नहीं मिले। केवल छह अंक बोलिए।'},
  locked:{en:`Approvals locked, try again in ${minutes} minutes.`,ta:`அனுமதிகள் பூட்டப்பட்டுள்ளன. ${minutes} நிமிடங்களில் முயற்சிக்கவும்.`,hi:`अनुमोदन लॉक है। ${minutes} मिनट बाद कोशिश करें।`},
  stale_target:{en:'The approval request expired. Please try the action again.',ta:'அனுமதி கோரிக்கை காலாவதியானது. மீண்டும் முயற்சிக்கவும்.',hi:'अनुमोदन अनुरोध समाप्त हो गया। फिर कोशिश करें।'},
  private_capture_failed:{en:'Private microphone capture failed. Please try again.',ta:'தனிப்பட்ட ஒலிப்பதிவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',hi:'निजी ऑडियो रिकॉर्ड नहीं हुआ। फिर कोशिश करें।'},
 };
 return messages[result.locked?'locked':result.reason_code]?.[lang]||messages[result.locked?'locked':result.reason_code]?.en||'Approval refused by the Agent.';
}
