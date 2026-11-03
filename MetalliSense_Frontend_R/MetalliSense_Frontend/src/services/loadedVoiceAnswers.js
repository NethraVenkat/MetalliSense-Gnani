import {formatNumber,formatDate} from '../utils/formatters';
export const loadedPageAnswersEnabled=()=>import.meta.env.VITE_VOICE_PAGE_ANSWERS==='true';
const normalize=text=>String(text??'').normalize('NFKC').toLowerCase();
const gradeKey=text=>normalize(text).replace(/[^a-z0-9]/g,'').replace(/^sgi$/,'sgiron');
export const loadedUnavailable={ta:'இந்த பேஜ்ல அந்த தகவல் இன்னும் வரல.',hi:'इस पेज पर वह जानकारी अभी नहीं आई है।',en:'That information is not loaded on this page yet.'};
const valid=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const stockNumber=value=>String(Number(value));
const statusWords={ta:{RELEASED:'ரிலீஸ் ஆனது',QUARANTINE:'க்வாரண்டைன்ல இருக்கு',QUARANTINED:'க்வாரண்டைன்ல இருக்கு'},hi:{RELEASED:'रिलीज़ किया गया',QUARANTINE:'क्वारंटीन में है',QUARANTINED:'क्वारंटीन में है'},en:{RELEASED:'released',QUARANTINE:'in quarantine',QUARANTINED:'in quarantine'}};
const lead={ta:{stock:'இந்த பேஜ்ல இருக்கற ஸ்டாக்',reading:'கடைசியாக கிடைத்த ரீடிங்',grade:'கிரேடு வரம்பு'},hi:{stock:'इस पेज पर स्टॉक',reading:'आखिरी उपलब्ध रीडिंग',grade:'ग्रेड की सीमा'},en:{stock:'Stock on this page',reading:'Latest available reading',grade:'Grade specification ranges'}};
export function isLoadedPageQuestion(text,route){const t=normalize(text);return route==='/raw-material-stock'?/stock|இருப்பு|ஸ்டாக்|स्टॉक/u.test(t):route==='/spectrometer'?/latest|last|readings?|லேட்டஸ்ட்|கடைசி|ரீடிங்|रीडिंग/u.test(t):route==='/grades'?/specs?|range|limit|கிரேடு|ரேஞ்ச்|ஸ்பெக்|ग्रेड|रेंज|स्पेक/u.test(t):false;}
export function loadedPageAnswer(text,context,lang='en'){
 const t=normalize(text),data=context?.loaded,labels=lead[lang]||lead.en,missing=loadedUnavailable[lang]||loadedUnavailable.en;
 if(!data)return missing;
 if(context.route==='/raw-material-stock'){
  const list=[...(data.lots||[]),...(data.additives||[])];const named=list.filter(row=>[row.lotId,row.alloyName,row.materialLabel,row.materialType].filter(Boolean).some(name=>t.includes(normalize(name))));
  const candidates=named.length?named:list.slice(0,3);const rows=candidates.filter(r=>valid(r.availableKg)).map(r=>`${r.lotId||r.alloyName||r.materialLabel||r.materialType}, ${stockNumber(r.availableKg)} ${lang==='ta'?'கிலோ':lang==='hi'?'किलो':'kg'}${r.status?`, ${statusWords[lang]?.[r.status]||r.status}`:''}`);
  return rows.length?`${labels.stock}: ${rows.join('. ')}.`:missing;
 }
 if(context.route==='/spectrometer'){
  const reading=data.latestReading;if(!reading)return missing;const time=reading.timestamp||reading.createdAt;
  if(!time||!Number.isFinite(Date.parse(time)))return missing;
  const c=reading.composition||reading;const values=['C','Si','Mn'].filter(e=>valid(c[e])).map(e=>`${e} ${formatNumber(c[e])}%`);
  const id=reading.heatId||({ta:'ஹீட் ID கிடைக்கல',hi:'हीट ID उपलब्ध नहीं',en:'heat ID unavailable'}[lang]);
  return values.length?`${labels.reading}: ${id}, ${formatDate(time)}; ${values.join(', ')}.`:missing;
 }
 if(context.route==='/grades'){
  const specs=data.grades||[];const key=gradeKey(text);const explicit=specs.filter(s=>s.grade&&(key.includes(gradeKey(s.grade))||(/\bsgi\b/i.test(text)&&gradeKey(s.grade)==='sgiron')));const spec=explicit.length===1?explicit[0]:explicit.length>1?null:specs.find(s=>gradeKey(s.grade)===gradeKey(context.selected?.grade))||specs[0];
  if(!spec)return missing;
  const fields=['C','Si','Mn','Fe','P','S'].filter(e=>Array.isArray(spec.composition_ranges?.[e])&&spec.composition_ranges[e].length===2&&spec.composition_ranges[e].every(valid)).slice(0,3);
  return fields.length?`${labels.grade}: ${spec.grade}; ${fields.map(e=>`${e} ${formatNumber(spec.composition_ranges[e][0])}–${formatNumber(spec.composition_ranges[e][1])}%`).join(', ')}.`:missing;
 }
 return missing;
}
