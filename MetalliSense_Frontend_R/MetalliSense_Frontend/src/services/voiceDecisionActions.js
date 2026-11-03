import {nativeActionText,nativeReadback} from './voiceActionLanguages';
import {normalizeSpokenNumbers} from './spokenNumbers';
export const decisionDefinitions=[{id:'accept_strategy',page:'/rl-optimizer',phrase:'accept',level:'APPROVE',requiredRoles:['Supervisor','Manager']},{id:'accept_strategy',page:'/full-analysis',phrase:'accept',level:'APPROVE',requiredRoles:['Supervisor','Manager']},{id:'approve_tap',page:'/mechanical-properties',phrase:'approve tap',level:'APPROVE',requiredRoles:['Supervisor','Manager']}];
export function decisionText(text,route){return normalizeSpokenNumbers(nativeActionText(text,decisionDefinitions.filter(d=>d.page===route))).trim();}
export function isDecisionCommand(text,route){const t=decisionText(text,route);return ['/rl-optimizer','/full-analysis'].includes(route)&&/^accept (balanced|conservative|aggressive)(?: strategy)?$/i.test(t)||route==='/mechanical-properties'&&/^approve tap(?: for)?(?: H[- ]?\d+)?$/i.test(t);}
export function prepareDecisionAction(text,context,services){
 if(!isDecisionCommand(text,context?.route))return null;const normalized=decisionText(text,context.route),def=decisionDefinitions.find(d=>d.page===context.route),loaded=context.loaded||{};let heatId,heat,candidate,summary;
 const check=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{refused:true});};const data=r=>r?.data?.data??r?.data;
 return {...def,scopeChange:true,async precheck(){
  const explicit=normalized.match(/H[- ]?(\d+)/i);heatId=explicit?'H-'+explicit[1]:context.selected?.heatId||loaded.flow?.heatId;check(heatId,'Which heat?');heat=data(await services.getHeat(heatId));check(heat?.status==='MELTING','Completion or strategy acceptance requires a MELTING heat.');
  if(def.id==='accept_strategy'){const name=normalized.match(/^accept (\w+)/i)[1].toLowerCase(),matches=(loaded.result?.candidates||loaded.result?.steps?.rlOptimization?.candidates||[]).filter(c=>c.strategy===name);check(matches.length===1,'Which available strategy?');candidate=structuredClone(matches[0]);check(loaded.reading?.composition,'Composition is missing.');summary='Accept '+name+' strategy for '+heatId+': '+JSON.stringify(candidate.recommended_additions)+' percent; candidate quantities will be deducted.';}
  else{check(loaded.result&&loaded.comp&&loaded.standard,'Prediction/composition/standard missing.');summary='Approve tap for '+heatId+': '+JSON.stringify({composition:loaded.comp,mechanical:loaded.result,standard:loaded.standard})+'.';}
  return {ok:true};},buildSummary:ctx=>({displayText:summary,spokenText:nativeReadback(def.id,summary,ctx?.lang)}),async execute(ctx){
   check(ctx.user?.name,'Verified identity required.');check(context.isCurrent?.(context.scope)!==false,'Page changed.');const current=data(await services.getHeat(heatId));check(current?.status==='MELTING','Heat is no longer MELTING.');
   const response=def.id==='accept_strategy'?await services.acceptHeatStrategy(heatId,candidate,loaded.reading.composition,ctx.user.name):await services.completeHeat(heatId,{approvedBy:ctx.user.name,composition:loaded.comp,mechanical:loaded.result,standard:loaded.standard,acceptedStrategy:loaded.flow?.acceptedStrategy});
   check(response.status>=200&&response.status<300,'Backend did not accept the request.');const result=data(response);if(def.id==='accept_strategy')check(result?.deductionVerified&&Array.isArray(result.deductedLines),'Backend deduction was not verified.');context.notifyAction?.({id:def.id,data:result});return {status:response.status,ids:[heatId],message:result?.feedbackWarning||'Completed'};
  }};
}
