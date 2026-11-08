// F17 · Builder: Nethra. Pure loaded-data answers; no requests or writes.
import {voiceAskDrafts,voiceAskUnavailable} from './voiceAskContent';
import {toSpokenText} from './spokenText';
import {renderAskSentence} from './voiceAskFormatters';
import {neverByVoice} from './voiceActions';
const get=(object,path)=>path?.split('.').reduce((value,key)=>value?.[key],object);
const present=value=>value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length>0);
const one=(rows,predicate)=>{const matches=(rows||[]).filter(predicate);return matches.length===1?matches[0]:null;};
const key=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s_-]/g,'');
function selectedRow(rows,selected,id,text){
 const named=(rows||[]).filter(r=>r[id]&&key(text).includes(key(r[id])));if(named.length)return named.length===1?named[0]:null;
 return one(rows,r=>selected&&key(r[id])===key(selected))||((rows||[]).length===1?rows[0]:null);
}
export function askSnapshot(context,text){
 const data=context?.loaded||{},selected=context?.selected||{},rows=data.data?.items;
 return {...data,
  grade:selectedRow(data.grades,selected.grade,'grade',text),
  supplier:selectedRow(data.data?.suppliers,selected.supplier,'supplier',text),
  item:selectedRow(rows,selected.item,'item',text),pr:selectedRow(data.prs,selected.prId,'prId',text),
  lot:selectedRow(data.lots,selected.lotId,'lotId',text),
  candidate:one(data.result?.candidates,c=>text.toLowerCase().includes(String(c.strategy).toLowerCase()))||(data.result?.candidates?.length===1?data.result.candidates[0]:null),
  saleHeat:selectedRow(data.heats,selected.heatId,'heatId',text),invoice:selectedRow(data.invoices,selected.invoiceId,'invoiceId',text),
  sample:data.selectedSample||selectedRow(data.trainingData,selected.sampleId,'_id',text),
  searchResult:data.results?.length===1?data.results[0]:null,
  costRecord:data.history?.length===1?data.history[0]:null,
 };
}
// Plain English nouns match whole words (and plurals), not entity names such
// as scorecard/countdown. Explicit regex phrases keep their own boundaries.
const askPattern=(row,text)=>new RegExp(row.pattern.includes('(')?row.pattern:row.pattern.split('|').map(term=>/^[a-z][a-z ]*$/i.test(term)?'\\b'+term+'s?\\b':term).join('|'),'iu').test(text);
export function matchVoiceAsk(text,route){
 const normalized=String(text||'').normalize('NFKC').toLowerCase().replace(/[?!.,]/g,' ').replace(/\s+/g,' ').trim();
 const rows=voiceAskDrafts.filter(row=>row.page===route).sort((a,b)=>(b.priority||0)-(a.priority||0));
 const emissions=/\bco2\b|\bemissions?\b|\bcarbon footprint\b|கார்பன் உமிழ்வு|उत्सर्जन/iu.test(normalized);
 if(emissions)return rows.find(row=>row.intent==='co2');
 if(route==='/anomaly'&&/\bseverity\b|தீவிரம்|गंभीर/iu.test(normalized))return rows.find(row=>row.intent==='severity');
 // A quantity/cost request must not fall through to a different dimension.
 const additions=/\badditions?\b|சேர்க்கை|जोड़|मिश्रण/iu.test(normalized);
 const cost=/\bcosts?\b|செலவு|लागत/iu.test(normalized);
 if(route==='/cost-analysis'&&additions)return rows.find(row=>row.intent==='additions'&&askPattern(row,normalized));
 if(additions&&cost)return rows.find(row=>row.intent==='cost');
 return rows.find(row=>askPattern(row,normalized));
}
// Exact historical questions are reads, not imperative approval commands.
// Anchoring rejects appended action requests; no action/service is reachable.
export function isHistoricalVoiceAsk(text){
 const normalized=String(text||'').normalize('NFKC').trim();
 return /^(?:who approved (?:(?:this|the) (?:purchase )?request|PR[- ]?\d+|(?:this|the) tap)|who changed (?:this|the) lot(?:'s stock)?|அனுமதிச்சது யார்|மாற்றியது யார்|किसने मंजूर किया|किसने बदला)[?.!।]*$/iu.test(normalized);
}
// Exact invoice reads only; appended commands remain blocked.
export function isInvoiceVoiceAsk(text,route){
 return route==='/sales'&&/^(?:what is the invoice|what weight is ready for invoice)[?.!]*$/iu.test(String(text||'').normalize('NFKC').trim());
}
export function voiceAskReply(text,context,lang='en',options={}){
 lang=['ta','hi','en'].includes(lang)?lang:'en';
 const unavailable=voiceAskUnavailable[lang]||voiceAskUnavailable.en;
 const empty={displayText:unavailable,spokenText:unavailable};
 if(neverByVoice(text))return null;
 const draft=matchVoiceAsk(text,context?.route);if(!draft)return null;
 if(context?.loaded?.loading||!context?.loaded)return empty;
 const snapshot=askSnapshot(context,text);let value=get(snapshot,draft.path)??get(snapshot,draft.fallback);
 if(draft.page==='/raw-material-stock'&&draft.intent==='phosphorus'&&snapshot.detail?.qa?.[0]?.lotId&&snapshot.detail.qa[0].lotId!==snapshot.lot?.lotId)value=get(snapshot,draft.fallback);
 if(!present(value))return empty;
 const sentence=renderAskSentence(draft,value,snapshot,lang,options.now);if(!sentence)return empty;
 return {displayText:sentence,spokenText:toSpokenText(sentence.replace(/(?<=\d),(?=\d)/g,''),lang)};
}
