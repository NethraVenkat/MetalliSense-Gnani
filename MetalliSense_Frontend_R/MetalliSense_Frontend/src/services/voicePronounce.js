import {toSpokenText} from './spokenText';

// TTS input only. No SSML, provider parameters, display mutation or audio editing.
export const pronunciationTerms={
 Cu:['copper','காப்பர்','कॉपर'], Sn:['tin','டின்','टिन'], Mn:['manganese','மாங்கனீஸ்','मैंगनीज़'],
 C:['carbon','கார்பன்','कार्बन'], Si:['silicon','சிலிக்கான்','सिलिकॉन'], P:['phosphorus','பாஸ்பரஸ்','फॉस्फोरस'], S:['sulfur','சல்பர்','सल्फर'],
 CO2:['carbon dioxide','கார்பன் டை ஆக்சைடு','कार्बन डाइऑक्साइड'],
 MPa:['megapascal','மெகாபாஸ்கல்','मेगापास्कल'], ppm:['parts per million','பார்ட்ஸ் பெர் மில்லியன்','पार्ट्स पर मिलियन'],
 '°C':['degrees','டிகிரி','डिग्री'], '%':['percent','சதவீதம்','प्रतिशत'],
 rupees:['rupees','ரூபாய்','रुपये'], MetalliSense:['Metalli Sense','மெட்டல்லி சென்ஸ்','मेटल्ली सेंस'],
 SGI:['S G iron','எஸ் ஜி அயர்ன்','एस जी आयरन'], 'SG Iron':['S G iron','எஸ் ஜி அயர்ன்','एस जी आयरन'],
};
const index=lang=>({en:0,ta:1,hi:2})[String(lang).split('-')[0]];
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const token=term=>new RegExp('(?<![\\p{L}\\p{N}_-])'+escape(term)+'(?![\\p{L}\\p{N}_-])','gu');
export const pronunciationPassEnabled=()=>import.meta.env.VITE_PRONOUNCE_PASS==='true';
export function speakableText(text,lang='en'){
 const i=index(lang);let result=String(text??'');if(i===undefined)return result;
 const base=String(lang).split('-')[0];
 result=result.replace(/(?<![\p{L}\p{N}_-])H-(\d{1,8})(?![\p{L}\p{N}_-])/gu,(_,number)=>{
  const spoken=toSpokenText('H-'+number,base);return spoken.replace(/^(heat|ஹீட்|हीट) /,(['H','எச்','एच'][i])+' ');
 });
 // ISO dates only: unambiguous real calendar days, no locale-dependent slash dates.
 result=result.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,(original,y,m,d)=>{
  const value=new Date(`${y}-${m}-${d}T00:00:00Z`);if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==original)return original;
  return new Intl.DateTimeFormat(['en-IN','ta-IN','hi-IN'][i],{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(value);
 });
 // One replacement pass: generated grade initials must not become elements.
 const names=Object.keys(pronunciationTerms).filter(t=>t!=='%'&&t!=='°C').sort((a,b)=>b.length-a.length).map(escape).join('|');
 const terms=new RegExp('°C|%|(?<![\\p{L}\\p{N}_-])(?:'+names+')(?![\\p{L}\\p{N}_-])','gu');
 result=result.replace(terms,term=>(term==='%'||term==='°C'?' ':'')+pronunciationTerms[term][i]);
 result=result.replace(/₹\s*(\d[\d,.]*)/g,(_,amount)=>amount+' '+pronunciationTerms.rupees[i]);
 return result.replace(/[ \t]{2,}/g,' ').trim();
}
