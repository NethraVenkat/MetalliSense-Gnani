// Offline classification only. Never calls collect/precheck/execute or a service.
import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
const flags=['VITE_VOICE_EVERYWHERE','VITE_VOICE_ACTIONS','VITE_VOICE_PAGE_ANSWERS','VITE_VOICE_DATA_READS','VITE_VOICE_DASHBOARD_BRIEFING','VITE_MORNING_BRIEFING'];
const server=await createServer({configFile:false,envDir:false,logLevel:'silent',server:{middlewareMode:true},define:Object.fromEntries(flags.map(k=>['import.meta.env.'+k,JSON.stringify('true')]))});
try{
 const {prepareVoiceAction}=await server.ssrLoadModule('/src/services/voiceActionRegistry.js');
 const {mapIntent}=await server.ssrLoadModule('/src/services/voiceIntents.js');
 const {pageVoiceIntent}=await server.ssrLoadModule('/src/services/voicePages.js');
 const path=process.argv[2];const rows=JSON.parse(readFileSync(path+'/results.json','utf8'));
 for(const row of rows)for(const mode of ['off','on']){
  const text=row[mode].text;const context={route:row.route,selected:{heatId:'H-1051',prId:'PR-1001'},loaded:{opcConnected:true,heats:[{heatId:'H-1051',status:'PLANNED'},{heatId:'H-1053',status:'HOLD'}],purchaseRequests:[{id:'PR-1001',status:'PENDING'}]}};
  try{row[mode].routed=prepareVoiceAction(text,context)?.id||pageVoiceIntent(text)?.intent||mapIntent(text)?.intent||null;}
  catch(e){row[mode].routed=null;row[mode].routingError=e.message;}
  row[mode].correct=row[mode].routed===row.expected;
 }
 writeFileSync(path+'/routing.json',JSON.stringify(rows,null,2));const totals={};
 for(const group of ['Tanglish','English','Hindi']){const subset=rows.filter(r=>r.group===group);totals[group]={n:subset.length,off:subset.filter(r=>r.off.correct).length,on:subset.filter(r=>r.on.correct).length};}
 writeFileSync(path+'/routing-summary.json',JSON.stringify(totals,null,2));console.log(totals);
}finally{await server.close();}
