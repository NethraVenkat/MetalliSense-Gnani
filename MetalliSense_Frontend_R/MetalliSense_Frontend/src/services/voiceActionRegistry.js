// F17 · Builder: Manish. Same page services, no alternate plant endpoints.
import * as plant from './premeltService';
import * as inventory from './inventoryService';
import * as insights from './insightsService';
import * as ai from './aiService';
import * as spectrometer from './spectrometerService';
import * as copilot from './copilotService';
import {runFullAnalysis} from './workflowService';
import {semanticSearch} from './semanticSearchService';
import {predictMechanical} from './mechanicalService';
import {normalizeSpokenNumbers} from './spokenNumbers';
export const actionDefinitions=[
 ['request_reading','/spectrometer','RUN',[],'request reading','requestOPCReading'],
 ['gate_check','/premelt-gate','RUN',[],'run gate check','runGateCheck'],
 ['deviation_analyze','/anomaly','RUN',[],'run analysis','predictAnomaly'],
 ['deviation_explain','/anomaly','RUN',[],'explain','getExplanation'],
 ['correction_plan','/recommendation','RUN',[],'generate plan','analyzeIndividual'],
 ['correction_explain','/recommendation','RUN',[],'explain','getExplanation'],
 ['full_analysis','/full-analysis','RUN',[],'run full analysis','runFullAnalysis'],
 ['agent_analyze','/agent','RUN',[],'run analysis','analyzeAgent'],
 ['agent_explain','/agent','RUN',[],'explain','explainResult'],
 ['mechanical_predict','/mechanical-properties','RUN',[],'predict','predictMechanical'],
 ['supplier_plan','/supplier-scorecard','RUN',[],'plan','getOrderPlan'],
 ['gun_connect','/yard-inspection','RUN',[],'connect gun','connectGun'],
 ['gun_disconnect','/yard-inspection','RUN',[],'disconnect gun','disconnectGun'],
 ['energy_meter','/energy','RUN',[],'read meter','simulateHeatEnergy'],
 ['semantic_search','/semantic-search','ASK',[],'search','semanticSearch'],
 ['start_melting','/premelt-gate','APPROVE',['Supervisor','Unit Controller'],'start melting','startMelting'],
 ['approve_pr','/inventory-forecast','APPROVE',['Manager'],'approve pr','approvePurchaseRequest'],
 ['reject_pr','/inventory-forecast','APPROVE',['Manager'],'reject pr','rejectPurchaseRequest'],
 ['approve_dri_qa','/raw-material-stock','APPROVE',['Supervisor','Manager'],'approve dri qa','approveDriQa'],
 ['reject_dri_qa','/raw-material-stock','APPROVE',['Supervisor','Manager'],'reject dri qa','rejectDriQa'],
 ['inspect_lot','/yard-inspection','APPROVE',['Supervisor'],'inspect lot','startInspection'],
].map(([id,page,level,requiredRoles,phrase,service])=>({id,page,level,requiredRoles,phrase,service}));
const defaults={...plant,...inventory,...insights,...ai,...spectrometer,...copilot,runFullAnalysis,semanticSearch,predictMechanical};
export const unwrapAction=r=>r?.data?.data??r?.data;
const canonical=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'');
function requireValue(ok,message){if(!ok){const error=Error(message);error.refused=true;throw error;}}
export function resolveVoiceTarget(text,rows,key,selected,label){
 const normalized=normalizeSpokenNumbers(text).replace(/\b(?:h|pr|qa)\s*[- ]\s*/gi,'$&');
 const ids=[...normalized.matchAll(/\b(H|heat|PR|QA)\s*-?\s*(\d+)\b/gi)].map(m=>canonical((m[1].toLowerCase()==='heat'?'H':m[1])+m[2]));
 if(ids.length){const found=rows.filter(r=>ids.includes(canonical(r[key]))||ids.some(id=>id.match(/^[a-z]+/)?.[0]===canonical(r[key]).match(/^[a-z]+/)?.[0]&&Number(id.replace(/^\D+/,''))===Number(String(r[key]).replace(/^\D+/,''))));requireValue(new Set(ids).size===1&&found.length===1,`Which ${label}? The target is missing or ambiguous.`);return found[0];}
 // Non-numeric lot IDs are matched exactly against the loaded list, not guessed.
 const named=rows.filter(r=>String(r[key]||'').length>2&&canonical(normalized).includes(canonical(r[key])));
 if(named.length){requireValue(named.length===1,`Which ${label}?`);return named[0];}
 const lotTail=normalized.match(/\blot\s+(.+)$/i)?.[1]?.trim();if(key==='lotId'&&lotTail)requireValue(false,`Which ${label}? The spoken lot is not loaded.`);
 const selectedRows=rows.filter(r=>selected&&canonical(r[key])===canonical(selected));requireValue(selectedRows.length===1,`Which ${label}? Select one on this page or say its ID.`);return selectedRows[0];
}
export function prepareVoiceAction(text,pageContext,services=defaults){
 const normalized=normalizeSpokenNumbers(text).normalize('NFKC').toLowerCase().replace(/[.!?]/g,'').trim();
 const definition=actionDefinitions.find(d=>d.page===pageContext?.route&&(normalized===d.phrase||normalized.startsWith(d.phrase+' ')));
 if(!definition)return null;
 const loaded=pageContext.loaded||{},selected=pageContext.selected||{};let target,payload,summary,prepared=false;
 const fail=message=>requireValue(false,message);
 const prepare=async()=>{
  requireValue(!loaded.loading&&!loaded.busy,'Wait for this page to finish loading.');
  const id=definition.id,reading=loaded.reading;
  if(['gate_check','start_melting','energy_meter'].includes(id)){
   target=resolveVoiceTarget(text,loaded.heats||[], 'heatId',selected.heatId,'heat');
   if(id==='gate_check')requireValue(target.status==='PLANNED'&&!loaded.dirty,'Only a saved PLANNED charge can be checked. Save changes on screen first.');
   if(id==='start_melting'){
    const current=unwrapAction(await services.getHeat(target.heatId));requireValue(current?.heatId===target.heatId,'Heat unavailable.');target=current;
    const gate=current.gateResult;requireValue(gate?.decision!=='HOLD',`${target.heatId} is on HOLD — only an engineer can override, on screen.`);
    requireValue(current.status==='PLANNED'&&['GO','WARN'].includes(gate?.decision),'Run a valid gate check first.');
    requireValue(!loaded.dirty&&!current.gate?.stale&&Date.parse(gate.validUntil)>Date.now(),'Gate check is stale or expired. Run it again.');
    requireValue(gate.decision!=='WARN'||/\backnowledge\b/i.test(text),'Say acknowledge for this WARN heat.');payload={acknowledgeWarnings:gate.decision==='WARN'};
   }
   summary=`${definition.phrase}: ${target.heatId}, ${target.targetKg??target.charge?.reduce((n,l)=>n+Number(l.kg),0)??'weight unavailable'} kg${id==='energy_meter'?' — simulated meter reading':''}${id==='start_melting'?`, gate ${target.gateResult.decision}`:''}.`;
  }else if(/_pr$/.test(id)){
   target=resolveVoiceTarget(text,loaded.prs||[],'prId',selected.prId,'purchase request');requireValue(target.status==='PENDING_APPROVAL','Only a pending purchase request can be reviewed.');summary=`${definition.phrase}: ${target.prId}, ${target.qtyKg} kg, supplier ${target.supplier}.`;
  }else if(/_dri_qa$/.test(id)){
   const qaToken=normalizeSpokenNumbers(text).match(/\bQA[- ]?\d+\b/i)?.[0];const qaLot=qaToken?(loaded.lots||[]).filter(l=>(l.qaIds||[]).some(id=>canonical(id)===canonical(qaToken))):[];requireValue(qaLot.length<=1,'Which QA record?');const lot=qaLot[0]||resolveVoiceTarget(text,loaded.lots||[],'lotId',selected.lotId,'lot');const detail=unwrapAction(await services.getLot(lot.lotId));
   const pending=(detail?.qa||[]).filter(q=>q.status==='PENDING_APPROVAL');const explicit=normalizeSpokenNumbers(text).match(/\bQA[- ]?\d+\b/i)?.[0];const found=explicit?pending.filter(q=>canonical(q.qaId)===canonical(explicit)):pending;
   requireValue(found.length===1,'Which QA record? Select its lot; exactly one pending QA is required.');target=found[0];summary=`${definition.phrase}: ${target.qaId}, lot ${lot.lotId}, version ${target.version}, P ${target.values?.P??'unavailable'}%.`;
  }else if(id==='inspect_lot'){
   target=resolveVoiceTarget(text,loaded.lots||[],'lotId',selected.lotId,'lot');const form=loaded.form;
   requireValue(form&&['XRF','LIBS'].includes(form.device)&&Number(form.pieces)>0,'Inspection form unavailable.');requireValue(loaded.status?.client?.isConnected&&!loaded.running,'Connect the gun and wait for the previous inspection.');
   payload={...form,lotId:target.lotId};summary=`Inspect ${target.lotId}: ${form.device}, ${form.pieces} pieces, surface prepared ${Boolean(form.surfacePrepared)}. This may change the lot status.`;
  }else if(id==='supplier_plan'){
   const m=normalized.match(/^plan (\d+(?:\.\d+)?) (?:tonnes?|tons?) of (.+)$/);requireValue(m&&Number(m[1])>0,'Say plan, quantity in tonnes, and the material.');const types=loaded.materialTypes||[];const matches=types.filter(t=>canonical(t)===canonical(m[2]));requireValue(matches.length===1,'Which material? Use a material shown on this page.');payload={tonnes:Number(m[1]),materialType:matches[0]};summary=`Plan ${payload.tonnes} tonnes of ${payload.materialType}; calculation only, no purchase order.`;
  }else if(id==='semantic_search'){
   payload={query:text.replace(/^search\s+/i,''),collection:loaded.collection};requireValue(payload.query.trim()&&payload.collection,'Search words or collection missing.');summary=`Search ${payload.collection}: ${payload.query}.`;
  }else if(id==='request_reading'){
   requireValue(loaded.opcConnected===true,'Spectrometer OPC is not connected.');summary='Request one Spectrometer reading from the connected OPC instrument.';
  }else if(id.startsWith('gun_')){
   requireValue(loaded.status?.server?.isRunning,'Gun simulator unavailable.');requireValue(id==='gun_connect'?!loaded.status.client?.isConnected:loaded.status.client?.isConnected,'Gun is already in that connection state.');summary=`${definition.phrase}: handheld gun simulator.`;
  }else{
   requireValue(reading?.composition&&(reading.metalGrade||reading.grade),'Generate or load a composition on this page first.');
   if(loaded.flowLocked)fail('This page is locked by the current process gate.');
   if(id.endsWith('_explain'))requireValue(loaded.result,'Run this page analysis before asking for an explanation.');
   payload={metalGrade:reading.metalGrade||reading.grade,composition:reading.composition};
   if(id==='full_analysis'){requireValue(Number(loaded.batchWeightKg)>0,'Batch weight is missing.');payload={...payload,batchWeightKg:Number(loaded.batchWeightKg),topK:3};}
   summary=`${definition.phrase}: ${selected.heatId||payload.metalGrade}, C ${reading.composition.C??'unavailable'}%, Si ${reading.composition.Si??'unavailable'}%, Mn ${reading.composition.Mn??'unavailable'}%${payload.batchWeightKg?`, ${payload.batchWeightKg} kg`:''}.`;
  }
  prepared=true;return {ok:true};
 };
 return {...definition,needsReason:definition.id.startsWith('reject_'),precheck:prepare,buildSummary:()=>({displayText:summary,spokenText:summary}),async execute(ctx){
  requireValue(prepared,'Read-back was not prepared.');requireValue(pageContext.isCurrent?.(pageContext.scope)!==false,'Page changed; action cancelled.');let response;const id=definition.id;
  if(id==='start_melting'){
   const fresh=unwrapAction(await services.getHeat(target.heatId));requireValue(fresh?.gateResult?.decision!=='HOLD',`${target.heatId} is on HOLD — only an engineer can override, on screen.`);requireValue(fresh?.gateResult?.gateId===target.gateResult?.gateId&&fresh.status==='PLANNED'&&Date.parse(fresh.gateResult.validUntil)>Date.now()&&!fresh.gate?.stale,'Gate changed or expired; run the check again.');
   requireValue(ctx.user?.name,'Verified operator unavailable.');response=await services.startMelting(target.heatId,{...payload,operator:ctx.user.name});
  }else if(id==='gate_check')response=await services.runGateCheck(target.heatId,'Melt shop');
  else if(id==='energy_meter')response=await services.simulateHeatEnergy(target.heatId);
  else if(/_pr$/.test(id)){requireValue(ctx.user?.name,'Verified approver unavailable.');response=id==='approve_pr'?await services.approvePurchaseRequest(target.prId,ctx.user.name):await services.rejectPurchaseRequest(target.prId,ctx.user.name,ctx.reason);}
  else if(/_dri_qa$/.test(id)){requireValue(ctx.user?.name,'Verified approver unavailable.');response=id==='approve_dri_qa'?await services.approveDriQa(target.qaId,ctx.user.name):await services.rejectDriQa(target.qaId,ctx.user.name,ctx.reason);}
  else if(id==='inspect_lot'){requireValue(ctx.user?.name,'Verified inspector unavailable.');response=await services.startInspection({...payload,inspector:ctx.user.name});}
  else if(id==='supplier_plan')response=await services.getOrderPlan(payload.materialType,payload.tonnes);
  else if(id==='semantic_search')response=await services.semanticSearch(payload.query,payload.collection,8);
  else if(id==='mechanical_predict')response=await services.predictMechanical(payload.metalGrade,payload.composition);
  else if(id==='deviation_analyze')response=await services.predictAnomaly({grade:payload.metalGrade,composition:payload.composition});
  else if(['deviation_explain','correction_explain'].includes(id))response=await services.getExplanation({grade:payload.metalGrade,composition:payload.composition,analysisResult:loaded.result});
  else if(id==='agent_explain')response=await services.explainResult({...payload,anomalyResult:loaded.result.aiAnalysis?.anomalyDetection||{},alloyResult:loaded.result.aiAnalysis?.alloyRecommendation||{}});
  else response=await services[definition.service](...(['request_reading','gun_connect','gun_disconnect'].includes(id)?[]:[payload]));
  const data=unwrapAction(response);requireValue(response?.status>=200&&response.status<300,'Backend returned no successful response.');
  if(response.data?.success===false||['error','failed'].includes(response.data?.status)){const e=Error(response.data.message||'Backend refused the action.');e.response=response;throw e;}
  const ids=[data?.qa?.qaId,data?.lot?.lotId,target?.heatId,target?.prId,target?.qaId,target?.lotId,data?.heatId,data?.prId,data?.qaId,data?.lotId,data?.gateId,data?.sessionId,data?._id].filter(Boolean);
  if(pageContext.isCurrent?.(pageContext.scope)!==false)pageContext.notifyAction?.({id,data});
  let message=id.endsWith('_explain')?(data?.explanation||data?.geminiExplanation?.explanation||data?.text||'Explanation returned; see the page.') : id==='gate_check'?`${target.heatId}: ${data.decision}.`:id==='energy_meter'?`${target.heatId}: simulated meter reading saved.`:id==='semantic_search'?(data.results||[]).slice(0,3).map(r=>r.title||r.text).join('; '):id==='supplier_plan'?JSON.stringify(data.allocations||data.split||data.plan||data).slice(0,650):'Completed';
  return {status:response.status,ids:[...new Set(ids)],message:message||'No results returned.'};
 }};
}
