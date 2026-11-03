// Presentation only. Historical records have no turn ID: sequence grouping is
// explicitly labelled, never written back as audit evidence.
export const voiceLogZone='Asia/Calcutta';
export function localLogDate(value=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:voiceLogZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 return ['year','month','day'].map(key=>parts.find(p=>p.type===key)?.value).join('-');
}
export const localLogTime=value=>value?new Intl.DateTimeFormat('en-GB',{timeZone:voiceLogZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)):'—';
export function auditDays(date){return [new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10),date];}
export function transcriptSnippet(row){return row.confirmation==='passcode'?'••••••':String(row.transcript||'').replace(/\S*\d\S*/gu,'••••••').slice(0,160);}
export function groupVoiceLog(events,audio,date){
 const groups=[],current=new Map(),used=new Set();
 const clips=new Map(audio.filter(a=>['wake','command'].includes(a.purpose)&&!a.no_store).map(a=>[`${a.date}:${a.event_id}`,a]));
 const ordered=[...events].filter(r=>r.ts&&localLogDate(r.ts)===date).sort((a,b)=>Date.parse(a.ts)-Date.parse(b.ts)||a.seq-b.seq);
 const make=(r,clip)=>{const g={id:`${r.date||r.ts.slice(0,10)}:${r.seq}`,ts:r.ts,page:r.page||'',intent:'Voice capture',summary:'',decision:null,transcript:'',clips:[],sequenceGrouped:true,session:r.session_id,last:r.ts};groups.push(g);current.set(r.session_id,g);return g;};
 for(const r of ordered){
  const clip=clips.get(`${r.date||r.ts.slice(0,10)}:${r.event_id}`),raw=r.intent==='audio-capture';let g=current.get(r.session_id);
  const nearby=g&&Date.parse(r.ts)-Date.parse(g.last)<=45000&&!g.decision;
  if(raw){
   if(!clip)continue;
   // A wake begins a new capture turn; commands follow it. A standalone PTT
   // command is a separate turn. No passcode is ever offered for playback.
   if(!nearby||clip.purpose==='wake'||!g.clips.some(c=>c.purpose==='wake')&&g.clips.some(c=>c.purpose==='command'))g=make(r);
   g.clips.push(clip);used.add(`${clip.date}:${clip.event_id}`);g.last=r.ts;
  }else{
   if(!nearby)g=make(r);
   Object.assign(g,{ts:r.ts,last:r.ts,page:r.page||g.page,intent:r.intent||'Voice interaction',summary:r.summary||'',decision:r.decision,transcript:transcriptSnippet(r)});
   if(clip&&!used.has(`${clip.date}:${clip.event_id}`)){g.clips.push(clip);used.add(`${clip.date}:${clip.event_id}`);}
  }
 }
 // No timestamp exists in old orphan audio metadata; do not invent a turn/time.
 return groups.sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts));
}
