import {formatNumber} from '../utils/formatters';
import {toSpokenText} from './spokenText';
export const loadedPageAnswersEnabled=()=>import.meta.env.VITE_VOICE_PAGE_ANSWERS==='true';
const normalize=text=>String(text??'').normalize('NFKC').toLowerCase().replace(/\p{P}/gu,' ').replace(/\s+/gu,' ').trim();
export function oneEditSG(token){if(token==='sg')return true;if(token.length===2)return token[0]==='s'||token[1]==='g';if(token.length===1)return 'sg'.includes(token);if(token.length===3)return [...token].some((_,i)=>token.slice(0,i)+token.slice(i+1)==='sg');return false;}
const gradeKey=text=>normalize(text).replace(/\u090f\u0938\s*\u091c\u0940/gu,'sg').replace(/\u0b8e\u0bb8\u0bcd\s*\u0b9c\u0bbf|\u0b8e\u0bb8\u0bcd\u0b9c\u0bbf/gu,'sg').replace(/\u0b90\u0baf\u0bb0\u0bcd\u0ba9\u0bcd|\u0906\u092f\u0930\u0928/gu,'iron').replace(/\bs\s+g\b/gu,'sg').replace(/\b([a-z]{1,3})\s*iron\b/gu,(all,token)=>oneEditSG(token)?'sgiron':all).replace(/[^a-z0-9]/g,'').replace(/^sgi$/,'sgiron');
export const loadedUnavailable={ta:'இந்த பேஜ்ல அந்த தகவல் இன்னும் வரல.',hi:'इस पेज पर वह जानकारी अभी नहीं आई है।',en:'That information is not loaded on this page yet.'};
const valid=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const stockNumber=value=>String(Number(value));
const statusWords={ta:{RELEASED:'ரிலீஸ் ஆனது',QUARANTINE:'க்வாரண்டைன்ல இருக்கு',QUARANTINED:'க்வாரண்டைன்ல இருக்கு'},hi:{RELEASED:'रिलीज़ किया गया',QUARANTINE:'क्वारंटीन में है',QUARANTINED:'क्वारंटीन में है'},en:{RELEASED:'released',QUARANTINE:'in quarantine',QUARANTINED:'in quarantine'}};
const lead={ta:{stock:'இந்த பேஜ்ல இருக்கற ஸ்டாக்',reading:'கடைசியாக கிடைத்த ரீடிங்',grade:'கிரேடு வரம்பு'},hi:{stock:'इस पेज पर स्टॉक',reading:'आखिरी उपलब्ध रीडिंग',grade:'ग्रेड की सीमा'},en:{stock:'Stock on this page',reading:'Latest available reading',grade:'Grade specification ranges'}};
export function isLoadedPageQuestion(text,route){const t=normalize(text);return route==='/raw-material-stock'?/stock|இருப்பு|ஸ்டாக்|स्टॉक/u.test(t):route==='/spectrometer'?/latest|last|readings?|\u0928\u0935\u0940\u0928\u0924\u092e|\u0906\u0916\u093f\u0930\u0940|லேட்டஸ்ட்|கடைசி|ரீடிங்|रीडिंग/u.test(t):route==='/grades'?/specs?|range|limit|கிரேடு|ரேஞ்ச்|ஸ்பெக்|ग्रेड|रेंज|स्पेक/u.test(t):false;}
export function latestReadingReply(reading,lang='en',now=new Date()){
 const missing=loadedUnavailable[lang]||loadedUnavailable.en;
 const unavailable=()=>({displayText:missing,spokenText:missing});
 const timestamp=reading?.timestamp||reading?.createdAt;
 if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return unavailable();
 const composition=reading.composition||reading;
 const elements=['C','Si','Mn'].filter(element=>valid(composition[element]));
 if(!elements.length)return unavailable();
 // The foundry/client timezone is Asia/Calcutta, independent of the server TZ.
 const timeZone='Asia/Kolkata',date=new Date(timestamp);
 const clock=new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true});
 const parts=clock.formatToParts(date),part=kind=>parts.find(p=>p.type===kind)?.value;
 const time=`${part('hour')}:${part('minute')}`,displayTime=`${time} ${part('dayPeriod')}`;
 const calendar=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const datePrefix=calendar.format(date)===calendar.format(now)?'':`${new Intl.DateTimeFormat('en-US',{timeZone,month:'short',day:'numeric'}).format(date)}, `;
 const words={ta:{lead:'லேட்டஸ்ட் ரீடிங்',C:'கார்பன்',Si:'சிலிகான்',Mn:'மாங்கனீஸ்',percent:'பர்சென்ட்',time:'நேரம்',heat:'ஹீட்'},hi:{lead:'ताज़ा रीडिंग',C:'कार्बन',Si:'सिलिकॉन',Mn:'मैंगनीज़',percent:'प्रतिशत',time:'समय',heat:'हीट'},en:{lead:'Latest reading',C:'carbon',Si:'silicon',Mn:'manganese',percent:'percent',time:'Taken at',heat:'Heat'}};
 const labels=words[lang]||words.en,heat=reading.heatId?` ${labels.heat} ${reading.heatId}.`:'';
 const values=elements.map(element=>`${element} ${formatNumber(composition[element])}%`).join(' · ');
 const spokenValues=elements.map((element,index)=>`${labels[element]} ${formatNumber(composition[element])}${index===0?` ${labels.percent}`:''}`).join(', ');
 const spokenText=`${labels.lead}: ${spokenValues}. ${labels.time} ${time}.${heat}`;
 return {displayText:`${values} — ${datePrefix}${displayTime}${heat?'.'+heat:''}`,spokenText:toSpokenText(spokenText,lang)};
}
export function loadedPageReply(text,context,lang='en'){
 if(context?.route==='/spectrometer')return latestReadingReply(context.loaded?.latestReading,lang);
 const displayText=loadedPageAnswer(text,context,lang);
 return {displayText,spokenText:displayText};
}
export function loadedPageAnswer(text,context,lang='en'){
 const t=normalize(text),data=context?.loaded,labels=lead[lang]||lead.en,missing=loadedUnavailable[lang]||loadedUnavailable.en;
 if(!data)return missing;
 if(context.route==='/raw-material-stock'){
  const list=[...(data.lots||[]),...(data.additives||[])];const named=list.filter(row=>[row.lotId,row.alloyName,row.materialLabel,row.materialType].filter(Boolean).some(name=>t.includes(normalize(name))));
  const candidates=named.length?named:list.slice(0,3);const rows=candidates.filter(r=>valid(r.availableKg)).map(r=>`${r.lotId||r.alloyName||r.materialLabel||r.materialType}, ${stockNumber(r.availableKg)} ${lang==='ta'?'கிலோ':lang==='hi'?'किलो':'kg'}${r.status?`, ${statusWords[lang]?.[r.status]||r.status}`:''}`);
  return rows.length?`${labels.stock}: ${rows.join('. ')}.`:missing;
 }
 if(context.route==='/spectrometer'){
  return latestReadingReply(data.latestReading,lang).displayText;
 }
 if(context.route==='/grades'){
  const specs=data.grades||[];const key=gradeKey(text);const explicit=specs.filter(s=>s.grade&&(key.includes(gradeKey(s.grade))||(/\bsgi\b/i.test(text)&&gradeKey(s.grade)==='sgiron')));const spec=explicit.length===1?explicit[0]:explicit.length>1?null:specs.find(s=>gradeKey(s.grade)===gradeKey(context.selected?.grade))||specs[0];
  if(!spec)return missing;
  const fields=['C','Si','Mn','Fe','P','S'].filter(e=>Array.isArray(spec.composition_ranges?.[e])&&spec.composition_ranges[e].length===2&&spec.composition_ranges[e].every(valid)).slice(0,3);
  return fields.length?`${labels.grade}: ${spec.grade}; ${fields.map(e=>`${e} ${formatNumber(spec.composition_ranges[e][0])}–${formatNumber(spec.composition_ranges[e][1])}%`).join(', ')}.`:missing;
 }
 return missing;
}
