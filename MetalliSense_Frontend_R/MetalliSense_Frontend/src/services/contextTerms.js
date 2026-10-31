export const contextBiasEnabled=()=>import.meta.env.VITE_CONTEXT_BIAS==='true';
export const MAX_CONTEXT_TERMS=200;
export const MAX_CONTEXT_TERM_LENGTH=64; // Local guard, not a provider length claim.
export const STATIC_FOUNDRY_TERMS='heat,carbon,silicon,manganese,phosphorus,sulphur,FeSi,FeMn,spectrometer,dashboard,premelt,status,stock,hold'.split(',');
const active=heat=>['PLANNED','MELTING','ACTIVE','IN_PROGRESS','MELT_IN_PROGRESS','MELTING_IN_PROGRESS','IN_PROGRESS_MELT'].includes(String(heat.status||'').toUpperCase().replace(/[ -]/g,'_'));
export function buildContextTerms(heats,selectedHeatId,{enabled=contextBiasEnabled(),staticTerms=STATIC_FOUNDRY_TERMS,maxHeats=10}={}) {
 if(!enabled)return [];
 const seen=new Set(staticTerms.map(term=>term.toLowerCase()));
 const capacity=Math.max(0,MAX_CONTEXT_TERMS-seen.size),terms=[];
 const add=term=>{
  if(typeof term!=='string'||term.length>MAX_CONTEXT_TERM_LENGTH||!/^\w[\w -]*$/u.test(term)||term.includes('_'))return;
  if(!seen.has(term.toLowerCase())&&terms.length<capacity){seen.add(term.toLowerCase());terms.push(term);}
 };
 const ordered=heats.filter(heat=>heat.heatId===selectedHeatId||active(heat)).slice()
  .sort((a,b)=>(b.heatId===selectedHeatId)-(a.heatId===selectedHeatId)||String(a.heatId).localeCompare(String(b.heatId),'en',{numeric:true}));
 const ids=new Set();
 for(const heat of ordered){
  if(ids.size>=Math.min(10,maxHeats))break;
  if(!/^H-\d{1,8}$/i.test(heat.heatId)||ids.has(heat.heatId))continue;
  ids.add(heat.heatId);
  const id=heat.heatId.toUpperCase(),digits=id.slice(2);
  add(id);add('heat '+digits);add(digits);
  for(const lot of [...(heat.charge||[])].sort((a,b)=>String(a.lotId).localeCompare(String(b.lotId),'en',{numeric:true}))) {
   if(/^[A-Za-z]+-\d{1,8}$/u.test(lot.lotId||''))add(lot.lotId.toUpperCase());
  }
 }
 return terms;
}
