import {normalizeSpokenNumbers} from './spokenNumbers';
export const PRIVATE_VOICE='••••••';
export function redactVoiceText(value,{transcript=false,privateTurn=false}={}){
 if(privateTurn)return PRIVATE_VOICE;
 let text=String(value??'').replace(/\b(?:passcode|password|secret|api[-_ ]?key|gnani[-_ ]?key|token)\s*[:=]\s*\S+/giu,PRIVATE_VOICE)
  .replace(/\b(?:Bearer\s+\S+|[a-f0-9]{24,}|[A-Za-z0-9_-]{32,})\b/giu,PRIVATE_VOICE);
 if(transcript)text=normalizeSpokenNumbers(text).replace(/\S*\p{N}\S*/gu,PRIVATE_VOICE);
 else text=text.replace(/(?<![\p{L}\p{N}])\p{N}{6}(?![\p{L}\p{N}])/gu,PRIVATE_VOICE);
 return text.slice(0,600);
}
