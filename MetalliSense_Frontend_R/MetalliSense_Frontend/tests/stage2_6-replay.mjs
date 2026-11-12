// Local saved-output analysis; no collect/execute/provider calls.
import {createServer} from 'vite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const input=resolve(process.argv[2]),out=resolve(process.argv[3]);
const baseline=process.argv.includes('--before');
const repo=resolve('../..'),before=resolve(repo,'.overnight_backup/v23-stage2_6/before/MetalliSense_Frontend_R/MetalliSense_Frontend');
const flags=['VITE_VOICE_EVERYWHERE','VITE_VOICE_ACTIONS','VITE_VOICE_PAGE_ANSWERS','VITE_VOICE_DATA_READS','VITE_VOICE_DASHBOARD_BRIEFING','VITE_MORNING_BRIEFING'];
const server=await createServer({configFile:false,envDir:false,logLevel:'silent',server:{middlewareMode:true},plugins:baseline?[{name:'preserved-before',enforce:'pre',load(id){const suffix=id.replaceAll('\\','/').split('/src/')[1];const p=suffix&&resolve(before,'src',suffix);if(p&&existsSync(p))return readFileSync(p,'utf8');}}]:[],define:Object.fromEntries(flags.map(k=>['import.meta.env.'+k,JSON.stringify('true')]))});
try{
 const {prepareVoiceAction}=await server.ssrLoadModule('/src/services/voiceActionRegistry.js');
 const {mapIntent}=await server.ssrLoadModule('/src/services/voiceIntents.js');
 const {pageVoiceIntent}=await server.ssrLoadModule('/src/services/voicePages.js');
 const {questionReplyLanguage}=await server.ssrLoadModule('/src/services/languageBridge.js');
 const {autoReplyLanguage}=await server.ssrLoadModule('/src/services/autoReplyLanguage.js').catch(()=>({}));
 const rows=JSON.parse(readFileSync(input,'utf8'));const result=[];
 for(const row of rows){
  const entry={...row};for(const mode of row.result?['result']:['off','on']){
   const value=row[mode];if(!value)continue;const text=value.text;
   const ctx={route:row.route,selected:{heatId:'H-1051',prId:'PR-1001'},loaded:{opcConnected:true,heats:[{heatId:'H-1051',status:'PLANNED'},{heatId:'H-1053',status:'PLANNED'}],prs:[{prId:'PR-1001',status:'PENDING_APPROVAL'}]}};
   const action=prepareVoiceAction(text,ctx);const nav=pageVoiceIntent(text,{currentRoute:row.route});const mapped=mapIntent(text,{currentRoute:row.route});
   entry[mode]={...value,routed:action?.id||nav?.intent||mapped?.intent,target:nav?.params?.route||mapped?.params?.route,heatNumber:mapped?.params?.heatNumber};
   entry[mode].correct=entry[mode].routed===row.expected&&(!row.target||row.target===entry[mode].target);
   if(row.expected_language){const old=questionReplyLanguage(text,value.detected_language_code,row.current_language);entry[mode].reply_language=mode==='on'?autoReplyLanguage(text,value.detected_language_code,row.current_language,true):old;entry[mode].language_correct=entry[mode].reply_language===row.expected_language;}
   if(action?.id==='start_melting'){const blocked=prepareVoiceAction(text,ctx,{getHeat:async id=>({data:{data:{heatId:id,status:'PLANNED',gateResult:{decision:'HOLD'}}}})});try{await blocked.precheck();entry[mode].holdRefused=false;}catch{entry[mode].holdRefused=true;}}
  }result.push(entry);
 }
 writeFileSync(out,JSON.stringify(result,null,2));const groups=[...new Set(result.map(r=>r.group||'all'))];console.log(Object.fromEntries(groups.map(group=>{const set=result.filter(r=>(r.group||'all')===group);return [group,{n:set.length,...Object.fromEntries(['result','off','on'].filter(m=>set[0]?.[m]).map(m=>[m,{routes:set.filter(r=>r[m].correct).length,...(set[0].expected_language?{languages:set.filter(r=>r[m].language_correct).length}:{})}]))}];})));
}finally{await server.close();}
