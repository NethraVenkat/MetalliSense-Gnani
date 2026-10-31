import { toSpokenText } from './spokenText.js';
import { gatePhraseFacts } from './gatePhraseFacts.js';
import { formatGateLimit, hindiElements } from './hindiVoice.js';
import { spokenRegister, colloquialInput, colloquialWords } from './voiceRegister.js';

export const voiceClarityEnabled = () => import.meta.env.VITE_VOICE_CLARITY === 'true';
const taElements = {C:'கார்பன்',Si:'சிலிக்கான்',Mn:'மாங்கனீசு',P:'பாஸ்பரஸ்',S:'சல்பர்',Cu:'செம்பு',Cr:'குரோமியம்',Ni:'நிக்கல்',Mo:'மாலிப்டினம்',Sn:'தகரம்',Fe:'இரும்பு'};
const vocabulary = {
  HOLD:['ஹோல்ட்','होल्ड'],WARN:['எச்சரிக்கை','चेतावनी'],warning:['எச்சரிக்கை','चेतावनी'],GO:['கோ','गो'],
  Gate:['கேட்','गेट'],Heat:['ஹீட்','हीट'],Lot:['லாட்','लॉट'],PIG:['பிக்','पिग'],status:['நிலை','स्थिति'],
  PLANNED:['திட்டமிடப்பட்டது','योजना में'],screen:['திரை','स्क्रीन'],approve:['அப்ரூவ்','अप्रूव'],
  quarantined:['தனிமையில் உள்ளது','क्वारंटीन में'],quarantine:['தனிமையில் உள்ளது','क्वारंटीन में'],
};
export function nativeSpeech(text, lang, register=spokenRegister()) {
  if(register==='colloquial') text=colloquialInput(text,lang);
  let output = String(text).replace(/<[^>]*>/g,'').replace(/\(([A-Z][a-z]?)\)/g,(_,symbol)=>taElements[symbol]||hindiElements[symbol]?'':symbol);
  // IDs must be expanded before individual words/symbols, preserving their number.
  output = toSpokenText(output,lang);
  if (lang==='ta'||lang==='hi') {
    output = output.replace(/\b(?:HOLD|WARN|warning|GO|Gate|Heat|Lot|PIG|status|PLANNED|screen|approve|quarantined|quarantine)\b/gi,
      word => {const entry=Object.entries(vocabulary).find(([key])=>key.toLowerCase()===word.toLowerCase());return entry[1][lang==='ta'?0:1];});
    output = output.replace(/\b(?:Cu|Si|Mn|Cr|Ni|Mo|Sn|Fe|C|P|S)\b/g,symbol=>(lang==='ta'?taElements:{...hindiElements,Fe:'लोहा',Sn:'टिन'})[symbol]);
  }
  return register==='colloquial'?colloquialWords(output,lang):output;
}
function sentences(lines,lang,register=spokenRegister()) {
  const end=lang==='hi'?'।':'.';
  return lines.flatMap(line => nativeSpeech(line,lang,register).replace(/[;()[\]]/g,' ').split(/(?<!\d)[.!?।]+|[.!?।]+(?!\d)/u))
    .map(line=>line.trim()).filter(Boolean).flatMap(line=>{
      const words=line.split(/\s+/);const chunks=[];
      for(let index=0;index<words.length;index+=8) chunks.push(words.slice(index,index+8).join(' '));
      return chunks;
    }).map(line=>line+end).join(' ');
}
const choose=(lang,ta,hi,en)=>lang==='ta'?ta:lang==='hi'?hi:en;
export function clarityText(text,lang,register=spokenRegister()) {
  if(register==='colloquial') {
    if(/^(?:திரையில்\s+(?:approve|அப்ரூவ்)\s+செய்யவும்|Please approve on screen|वॉइस से अप्रूव या मेल्टिंग नहीं होगी। यह स्क्रीन पर करें।)$/iu.test(text.trim()))
      text=choose(lang,'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல அப்ரூவ் பண்ணுங்க.','वॉइस से अप्रूव नहीं होगा। मेल्टिंग नहीं होगी।','Voice cannot approve. Voice cannot start melting.');
    else if(['மீண்டும் சொல்லுங்கள்','समझ नहीं आया, कृपया फिर से बोलिए।','Could not hear you. Tap a suggestion below.'].includes(text.trim()))
      text=choose(lang,'சரியா கேக்கல, திரும்ப சொல்லுங்க','समझ नहीं आया, फिर से बोलिए।','Could not hear you. Please say that again.');
  }
  return sentences([text],lang,register);
}

// Structured numbers here are the exact formatted strings used by the templates.
export function clarityGateSpeech(heat, lang='ta', kind='reasons',register=spokenRegister()) {
  const facts=gatePhraseFacts(heat), id=heat.heatId, decision=facts.decision;
  const lines=[`Heat ${id}, ${decision||choose(lang,'தகவல் இல்லை','जानकारी नहीं','not checked')}`];
  if(kind==='alert') return sentences([...lines,choose(lang,'திரையில் பார்க்கவும்','स्क्रीन देखें','Check the screen')],lang,register);
  if(kind==='status') lines.push(`${choose(lang,'நிலை','स्थिति','Status')}, ${heat.status||''}`);
  if(decision==='GO') return sentences([...lines,choose(lang,'தடைகள் இல்லை','कोई रुकावट नहीं','No blocking issues')],lang,register);
  for(const reason of facts.reasons.slice(0,2)) {
    if(reason.lot_id) {
      const heldLot=register==='colloquial' && heat.gateResult?.checks?.find(check=>check.id==='lot_status')?.details?.some(detail=>detail.lotId===reason.lot_id&&/\bHOLD\b/.test(detail.text||''));
      lines.push(`Lot ${reason.lot_id}, ${reason.lot_status==='QUARANTINED'
        ? choose(lang,'தனிமையில் உள்ளது','क्वारंटीन में','in quarantine')
        : (reason.lot_status==='HOLD'||heldLot)&&register==='colloquial'?choose(lang,'ஹோல்ட்ல இருக்கு','होल्ड पर है','on hold')
        : reason.lot_status==='RESTRICTED'?choose(lang,'பயன்பாட்டுக் கட்டுப்பாடு','उपयोग सीमित है','use restricted')
          :choose(lang,'பயன்படுத்த அனுமதி இல்லை','उपयोग की अनुमति नहीं','not released')}`);
    } else if(reason.element) {
      const name=lang==='ta'?taElements[reason.element]||reason.element:lang==='hi'?hindiElements[reason.element]||reason.element:reason.element;
      const low=reason.direction==='low';
      lines.push(`${name} ${reason.risk?choose(lang,'வரம்பை நெருங்குகிறது','सीमा के पास है','near the limit')
        :low?choose(lang,'அளவு குறைவு','कम है','is low'):choose(lang,'அளவு அதிகம்','ज़्यादा है','is high')}`);
      lines.push(`${reason.value.toFixed(2)} ${choose(lang,'சதவீதம்','प्रतिशत','percent')}`);
      const limit=low?reason.min:reason.max;
      if(Number.isFinite(limit)) lines.push(`${choose(lang,low?'குறைந்தபட்சம்':'வரம்பு',low?'न्यूनतम':'सीमा',low?'Minimum':'Limit')}, ${formatGateLimit(limit,low)}`);
    } else lines.push(choose(lang,'சோதனை விவரம் திரையில்','जाँच का विवरण स्क्रीन पर','Check details on screen'));
  }
  if(facts.remaining_reasons) lines.push(choose(lang,'மேலும் விவரம் திரையில்','बाकी स्क्रीन पर','More details on screen'));
  return sentences(lines,lang,register);
}
export function clarityReply(intent,heat,params,lang,fallback) {
  if(['heat_status','gate_reason'].includes(intent)) return clarityGateSpeech(heat,lang,intent==='heat_status'?'status':'reasons');
  if(intent==='element_value') {
    const detail=heat.gateResult?.checks?.flatMap(check=>check.details||[]).find(detail=>detail.element===params.element&&Number.isFinite(detail.value));
    if(detail) return sentences([`Heat ${heat.heatId}`,`${params.element} ${choose(lang,'அளவு','की मात्रा','value')}`,`${detail.value.toFixed(2)} ${choose(lang,'சதவீதம்','प्रतिशत','percent')}`],lang);
  }
  return clarityText(fallback,lang);
}

export function clarityHandoverSummary(checks,lang='ta',register=spokenRegister()) {
  const issues=checks.filter(check=>check.severity!=='green');
  if(!issues.length) return sentences([choose(lang,'முரண்பாடுகள் இல்லை','कोई अंतर नहीं','No mismatches found')],lang,register);
  return sentences(issues.flatMap(check=>[
    `Heat ${check.heatId}, ${check.decision}`,
    choose(lang,'கூற்றை திரையில் சரிபார்க்கவும்','बात स्क्रीन पर जाँचें','Check the claim on screen'),
  ]),lang,register);
}
