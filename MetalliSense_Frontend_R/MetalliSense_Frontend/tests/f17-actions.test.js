import {it,expect,vi,afterEach} from 'vitest';
import {prepareVoiceAction,actionDefinitions,resolveVoiceTarget} from '../src/services/voiceActionRegistry';
import {createActionFlow,neverByVoice} from '../src/services/voiceActions';
afterEach(()=>vi.useRealTimers());
const ok=data=>({status:200,data:{data}});
const heat={heatId:'H-1051',status:'PLANNED',targetKg:1000,gateResult:{decision:'GO',gateId:'G-1',validUntil:'2099-01-01'}};
const reading={metalGrade:'SG-IRON',composition:{C:3.4,Si:2.1,Mn:.2}};
function context(d){return {route:d.page,selected:{heatId:heat.heatId,lotId:'SCR-1'},scope:'fixture',isCurrent:()=>true,notifyAction:vi.fn(),loaded:{heats:[heat],reading,result:{aiAnalysis:{}},batchWeightKg:1000,opcConnected:true,status:{server:{isRunning:true},client:{isConnected:d.id!=='gun_connect'}},lots:[{lotId:'SCR-1',qaIds:['QA-1']}],prs:[{prId:'PR-7',status:'PENDING_APPROVAL',qtyKg:10,supplier:'Fixture'}],form:{device:'XRF',pieces:15,surfacePrepared:true},materialTypes:['STEEL_SCRAP'],collection:'training_data'}};}
function phrase(d){return d.id==='supplier_plan'?'plan 10 tonnes of STEEL_SCRAP':d.id==='semantic_search'?'search carbon':d.id.endsWith('_pr')?d.phrase+' PR seven':d.phrase;}
it.each(actionDefinitions)('$id uses the page service and real response IDs',async d=>{
 const ctx=context(d),services=new Proxy({getHeat:vi.fn(async()=>ok(heat)),getLot:vi.fn(async()=>ok({qa:[{qaId:'QA-1',status:'PENDING_APPROVAL',version:1,values:{P:.02}}]}))},{get:(o,k)=>o[k]||(o[k]=vi.fn(async()=>ok({heatId:'H-1051',decision:'GO',results:[{title:'Fixture'}]})))});
 const action=prepareVoiceAction(phrase(d),ctx,services);expect(action.id).toBe(d.id);expect(await action.precheck()).toEqual({ok:true});expect(action.buildSummary().spokenText.length).toBeGreaterThan(15);const result=await action.execute({user:{name:'Synthetic Supervisor'},reason:'Quality reason'});expect(result.status).toBe(200);expect(services[d.service]).toHaveBeenCalled();expect(ctx.notifyAction).toHaveBeenCalled();
});
it.each(actionDefinitions)('$id never converts backend failure to completion',async d=>{
 const ctx=context(d),services=new Proxy({getHeat:async()=>ok(heat),getLot:async()=>ok({qa:[{qaId:'QA-1',status:'PENDING_APPROVAL'}]})},{get:(o,k)=>o[k]||(async()=>{throw Object.assign(Error('Backend refused'),{response:{status:409,data:{message:'Backend refused'}}});})});
 const action=prepareVoiceAction(phrase(d),ctx,services);await action.precheck();await expect(action.execute({user:{name:'Fixture'},reason:'Reason supplied'})).rejects.toThrow('Backend refused');expect(ctx.notifyAction).not.toHaveBeenCalled();
});
it('HOLD, ambiguous IDs, disconnected instruments, and forbidden weights fail closed',async()=>{
 const d=actionDefinitions.find(d=>d.id==='start_melting'),ctx=context(d);const action=prepareVoiceAction('start melting H-1051',ctx,{getHeat:async()=>ok({...heat,gateResult:{decision:'HOLD'}})});await expect(action.precheck()).rejects.toThrow('only an engineer');
 expect(()=>resolveVoiceTarget('H-1051 and H-1052',[heat],'heatId','H-1051','heat')).toThrow('Which heat');expect(()=>resolveVoiceTarget('run gate check',[heat],'heatId',null,'heat')).toThrow('Which heat');expect(neverByVoice('apply AHP weights')).toBe(true);
});
it('wrong role refuses before consume/execute; audit has no credential text',async()=>{
 const execute=vi.fn(),audit=vi.fn(),api={readback:vi.fn(),authorize:async()=>({ok:false}),audit};const flow=createActionFlow({api,say:async()=>{},capture:async()=>({text:'synthetic private response'}),onChange:()=>{}});
 expect(await flow.run({id:'approve_pr',level:'APPROVE',requiredRoles:['Manager'],precheck:async()=>({ok:true}),buildSummary:()=>({displayText:'PR-7 10 kg',spokenText:'PR-7 10 kg'}),execute},{originalText:'approve PR-7'})).toBe(false);expect(execute).not.toHaveBeenCalled();expect(audit).toHaveBeenCalledWith(expect.objectContaining({decision:'refused'}));expect(JSON.stringify(audit.mock.calls)).not.toContain('synthetic private response');
});

it.each(actionDefinitions)('$id completes the shared flow only after its required confirmation/identity',async d=>{
 vi.useFakeTimers();const ctx=context(d),services=new Proxy({getHeat:vi.fn(async()=>ok(heat)),getLot:vi.fn(async()=>ok({qa:[{qaId:'QA-1',status:'PENDING_APPROVAL',version:1,values:{P:.02}}]}))},{get:(o,k)=>o[k]||(o[k]=vi.fn(async()=>ok({heatId:'H-1051',decision:'GO',results:[{title:'Fixture'}]})))});
 const action=prepareVoiceAction(phrase(d),ctx,services),audit=vi.fn(),states=[];const identity={name:'Synthetic Manager',role:'Manager'};
 const api={readback:vi.fn(async()=>({ok:true})),authorize:vi.fn(async()=>({ok:true,token:'opaque-fixture',user:identity})),consume:vi.fn(async()=>({ok:true,user:identity})),audit};
 const flow=createActionFlow({api,say:async()=>{},capture:async options=>({text:options.purpose==='reason'?'Quality does not match':options.purpose==='passcode'?'private fixture':'yes',reason:'utterance'}),onChange:s=>states.push(s)});
 const result=flow.run(action,{page:ctx.route,originalText:phrase(d)});await vi.advanceTimersByTimeAsync(5100);expect(await result).toBe(true);expect(services[d.service]).toHaveBeenCalledTimes(1);expect(audit).toHaveBeenCalledWith(expect.objectContaining({decision:'executed',backend_result:expect.objectContaining({status:200})}));expect(JSON.stringify(states)).not.toContain('private fixture');if(d.level==='APPROVE')expect(api.consume).toHaveBeenCalledTimes(1);else expect(api.consume).not.toHaveBeenCalled();
});
