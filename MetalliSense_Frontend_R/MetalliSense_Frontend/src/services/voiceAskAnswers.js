// F17 · Builder: Nethra. Pure loaded-data answers; no requests or writes.
import {voiceAskDrafts,voiceAskUnavailable} from './voiceAskContent';
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
export function matchVoiceAsk(text,route){
 const normalized=String(text||'').normalize('NFKC').toLowerCase().replace(/[?!.,]/g,' ').replace(/\s+/g,' ').trim();
 return voiceAskDrafts.find(row=>row.page===route&&new RegExp(row.pattern,'iu').test(normalized));
}
// Exact historical questions are reads, not imperative approval commands.
// Anchoring rejects appended action requests; no action/service is reachable.
export function isHistoricalVoiceAsk(text){
 const normalized=String(text||'').normalize('NFKC').trim();
 return /^(?:who approved (?:(?:this|the) (?:purchase )?request|PR[- ]?\d+|(?:this|the) tap)|who changed (?:this|the) lot(?:'s stock)?|அனுமதிச்சது யார்|மாற்றியது யார்|किसने मंजूर किया|किसने बदला)[?.!।]*$/iu.test(normalized);
}
function displayValue(value){
 if(typeof value==='object')return JSON.stringify(value);return String(value);
}
export function voiceAskReply(text,context,lang='en'){
 const unavailable=voiceAskUnavailable[lang]||voiceAskUnavailable.en;
 const empty={displayText:unavailable,spokenText:unavailable};
 if(neverByVoice(text))return null;
 const draft=matchVoiceAsk(text,context?.route);if(!draft)return null;
 if(context?.loaded?.loading||!context?.loaded)return empty;
 const snapshot=askSnapshot(context,text),value=get(snapshot,draft.path)??get(snapshot,draft.fallback);
 if(!present(value))return empty;
 const sentence=(draft[lang]||draft.en).replace('{value}',displayValue(value));return {displayText:sentence,spokenText:sentence};
}
