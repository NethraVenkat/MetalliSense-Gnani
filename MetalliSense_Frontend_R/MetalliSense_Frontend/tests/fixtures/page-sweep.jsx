import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import KuralWakePanel from '../../src/components/voice/KuralWakePanel';
import {createTranscriptHandler} from '../../src/services/voiceTranscript';
import {createActionFlow,registry} from '../../src/services/voiceActions';
import {captureActionReply} from '../../src/services/voiceActionCapture';
import {actionDefinitions,prepareVoiceAction} from '../../src/services/voiceActionRegistry';
import {formDefinitions} from '../../src/services/voiceFormActions';
import {decisionDefinitions} from '../../src/services/voiceDecisionActions';
import {nativeActions} from '../../src/services/voiceActionLanguages';
import {voiceAskDrafts} from '../../src/services/voiceAskContent';
import {voiceAskReply,matchVoiceAsk} from '../../src/services/voiceAskAnswers';
import {voicePages} from '../../src/services/voicePages';
import {spy,ok,heat,reading,runContext,runPhrase,formSetup} from './sweep-action-fixtures';
import fixtures from './f17-ask-v2.json';
import golden from './f17-ask-v2-expected.json';
import '../../src/index.css';

const definitions=[...actionDefinitions,...formDefinitions,...decisionDefinitions,...registry.map(d=>({...d,page:'/dashboard',phrase:d.phrases.en[0]}))];
function nativeQuestion(row,lang){
 if(lang==='en')return golden.find(g=>g.page===row.page&&g.intent===row.intent).question;
 if(row.intent==='approver')return lang==='ta'?'அனுமதிச்சது யார்':'किसने मंजूर किया';
 if(row.page==='/cost-analysis'&&row.intent==='additions')return lang==='ta'?'சேர்க்கை செலவு':'जोड़ने की लागत';
 if(row.page==='/recommendation'&&row.intent==='available')return lang==='ta'?'AI சேவை கிடைக்குமா':'AI सेवा उपलब्ध है';
 const script=lang==='ta'?/[\u0b80-\u0bff]/u:/[\u0900-\u097f]/u;
 return row.pattern.split('|').find(part=>script.test(part))?.replace(/\\[bs]|\(\?:|[()^$?]/g,'').replace(/\.\*/g,' ').trim()||'';
}
function actionPhrase(d,lang){
 if(d.phrases?.[lang])return d.phrases[lang][0];
 let phrase=d.phrase;
 if(actionDefinitions.includes(d))phrase=runPhrase(d);
 if(d.id==='accept_strategy')phrase='accept balanced strategy';
 if(lang==='en')return phrase;
 return phrase.replace(d.phrase,nativeActions[d.id]?.[lang]?.[0]||d.phrase);
}
const plan=[];
for(const p of voicePages){
 for(const row of voiceAskDrafts.filter(r=>r.page===p.route))for(const lang of ['en','ta','hi'])plan.push({kind:'ask',page:p.route,id:row.intent,lang,text:nativeQuestion(row,lang),expected:'answered'});
 for(const d of definitions.filter(d=>d.page===p.route)){
  for(const lang of ['en','ta','hi'])plan.push({kind:'action',page:p.route,id:d.id,lang,text:actionPhrase(d,lang),scenario:'success',expected:'executed'});
  for(const scenario of d.level==='APPROVE'?['wrong-role','wrong-passcode','cancel-countdown','backend-refused']:d.level==='RUN'?['no','backend-refused']:d.cancelWindow?['cancel-countdown','backend-refused']:['backend-refused'])plan.push({kind:'action',page:p.route,id:d.id,lang:'en',text:actionPhrase(d,'en'),scenario,expected:scenario==='cancel-countdown'||scenario==='no'?'cancelled':'refused'});
 }
 if(!voiceAskDrafts.some(r=>r.page===p.route))for(const lang of ['en','ta','hi'])plan.push({kind:'help',page:p.route,id:'page_help',lang,text:{en:'what can I ask here',ta:'இங்க என்ன கேக்கலாம்',hi:'यहाँ क्या पूछ सकते हैं'}[lang],expected:'answered'});
}
for(const scenario of ['hold','missing-target'])plan.push({kind:'action',page:'/premelt-gate',id:'start_melting',lang:'en',text:scenario==='hold'?'start melting H-1053':'start melting H-9999',scenario,expected:'refused'});
plan.push({kind:'action',page:'/spectrometer',id:'request_reading',lang:'en',text:'request reading',scenario:'opc-disconnected',expected:'refused'});
window.sweepPlan=plan;
function contextAndServices(d,scenario){
 let context,services;
 if(formDefinitions.includes(d))({context,services}=formSetup(d));
 else{
  context=runContext(d);context.loaded.opcConnected=d.id!=='opc_connect';
  let current=structuredClone(heat);
  if(decisionDefinitions.includes(d)){
   current.status='MELTING';context.loaded={...context.loaded,comp:reading.composition,standard:'SG-IRON',result:{tensileStrength:450,candidates:[{strategy:'balanced',recommended_additions:{Si:.1}}]}};
  }
  if(scenario==='hold'){current.heatId='H-1053';current.gateResult.decision='HOLD';context.loaded.heats=[current];context.selected.heatId=current.heatId;}
  if(scenario==='opc-disconnected')context.loaded.opcConnected=false;
  services=new Proxy({getHeat:spy(async()=>ok(current)),getLot:spy(async()=>ok({qa:[{qaId:'QA-1',status:'PENDING_APPROVAL',version:1,values:{P:.02}}]}))},{get:(o,k)=>o[k]||(o[k]=spy(async()=>ok({heatId:current.heatId,decision:current.gateResult.decision,results:[{title:'Fixture result'}],deductionVerified:true,deductedLines:[]})))});
 }
 if(scenario==='backend-refused'){
  const service=d.service||(d.id==='accept_strategy'?'acceptHeatStrategy':'completeHeat');
  services[service]=spy(async()=>{throw Object.assign(Error('Backend refused'),{response:{status:409,data:{message:'Backend refused'}}});});
 }
 return {context,services};
}
function Harness(){
 const [state,setState]=useState(null),[level,setLevel]=useState(0),[speech,setSpeech]=useState('');
 window.beginSweep=index=>{
  const item=plan[index];window.sweepDone=false;window.sweepResult=null;setState(null);
  const run=async()=>{
   const record={...item,heard:item.text,level:item.kind==='action'?definitions.find(d=>d.id===item.id&&d.page===item.page).level:'ASK',spoken:'',decision:'',transcriptions:0,executions:0,checks:[]};
   if(item.kind!=='action'){
    const row=voiceAskDrafts.find(r=>r.page===item.page&&r.intent===item.id),context={route:item.page,loaded:structuredClone(fixtures.overrides?.[item.page+'/'+item.id]??fixtures.pages[item.page]??{}),selected:{},pageName:voicePages.find(p=>p.route===item.page).pageName};
    let answer;
    const handler=createTranscriptHandler({lang:item.lang,setHeard:()=>{},say:(display,spoken)=>{answer=display;record.spoken=spoken||display;setSpeech(answer);},audit:event=>{record.decision=event.decision;record.auditIntent=event.intent;},navigate:()=>{},resolveHeat:async()=>context.loaded.heat,pageContext:context});
    await handler(item.text);
    const expected=row?voiceAskReply(item.text,context,item.lang):null;
    record.checks=[Boolean(item.text),Boolean(answer),!row||matchVoiceAsk(item.text,item.page)?.intent===row.intent,!row||answer===expected?.displayText,!row||!answer.includes('not loaded')];record.decision=record.decision||'executed';
   }else{
    const d=definitions.find(d=>d.id===item.id&&d.page===item.page),{context,services}=contextAndServices(d,item.scenario),action=d.phrases?.en?{...d}:prepareVoiceAction(item.text,context,services);
    if(d.phrases?.en&&item.scenario==='backend-refused')action.execute=async()=>{throw Object.assign(Error('Backend refused'),{response:{status:409}});};
    if(!action){record.checks=[false];record.decision='unmatched';return record;}
    const original=action.execute;action.execute=async ctx=>{const result=await original(ctx);record.executions++;return result;};
    const user={name:'Mock verified actor',role:d.requiredRoles[0]||'Supervisor'};let approvalAt=0,flow,spoken=false;
    const api={readback:async()=>({ok:true}),authorize:async()=>{approvalAt=Date.now();return {ok:!['wrong-role','wrong-passcode'].includes(item.scenario),token:'opaque-fixture',user};},confirmWord:async()=>({ok:true}),consume:async()=>{record.checks.push(Date.now()-approvalAt>=5000);return {ok:true,user};},audit:async event=>{record.decision=event.decision;record.spoken=event.spoken_reply;},cancel:async()=>({})};
    flow=createActionFlow({api,say:async text=>{record.spoken=text;setSpeech(text);spoken=true;await new Promise(r=>setTimeout(r,20));spoken=false;},onChange:value=>{setState(value);if(['countdown','safe-cancel'].includes(value?.phase)&&item.scenario==='cancel-countdown')setTimeout(()=>flow.cancel(),1000);},capture:options=>{
     record.checks.push(!spoken);
     if(options.purpose==='cancel'){options.onState('listening');options.onCountdown(2);return new Promise(resolve=>setTimeout(()=>resolve({text:''}),2000));}
     if(options.purpose!=='confirmation'||options.no_store)return Promise.resolve({text:options.purpose==='reason'?'Reviewed fixture reason':options.purpose==='passcode'?'••••••':action.confirmWord});
     return captureActionReply(options,setLevel,{capture:async o=>{let stopped=false;setTimeout(()=>{if(!stopped){o.onFrame(new Int16Array(1600).fill(492).buffer);o.onFrame(new Int16Array(11200).buffer);}},1);return {stop(){stopped=true;}};},transcribe:async()=>{record.transcriptions++;return {data:{text:item.scenario==='no'?'no':'yes'}};}});
    }});
    await flow.run(action,{page:item.page,lang:item.lang,originalText:item.text});
    record.checks.push(record.executions===(item.scenario==='success'?1:0));
    record.checks.push(record.decision===(item.expected==='refused'?'refused':item.expected));
    if(d.level==='RUN'&&!['opc-disconnected'].includes(item.scenario))record.checks.push(record.transcriptions===1);
   }
   record.pass=record.checks.every(Boolean);return record;
  };
  run().then(record=>{window.sweepResult=record;window.sweepDone=true;}).catch(()=>{window.sweepResult={...item,pass:false,decision:'fixture-error'};window.sweepDone=true;});
 };
 return <main><h1>Mocked route voice sweep</h1><KuralWakePanel wake={{enabled:true,state:'Waiting'}} actionState={state} level={level} answer={speech}/></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
