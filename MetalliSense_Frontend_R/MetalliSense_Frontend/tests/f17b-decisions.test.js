import {it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import strategyFactory from '../src/mock/handlers/premeltGate/strategyAcceptance';
import {prepareDecisionAction} from '../src/services/voiceDecisionActions';
const require=createRequire(import.meta.url),store=require('../../../MetalliSense_Backend_Simple/premeltGate/store.js'),acceptance=require('../../../MetalliSense_Backend_Simple/premeltGate/strategyAcceptance.js'),sales=require('../../../MetalliSense_Backend_Simple/premeltGate/sales.js');
it('regular backend blocks PLANNED resume tap without movement or status change',()=>{store.seed();const heat=store.heats.list().find(h=>h.status==='PLANNED'),before=store.listMovements().length;expect(()=>sales.completeHeat(heat.heatId,{approvedBy:'Fixture',resume:true})).toThrow(/start melting/);expect(heat.status).toBe('PLANNED');expect(store.listMovements().length).toBe(before);});
it('candidate quantities, failure atomicity and idempotent acceptance agree in Node and mock port',()=>{
 const mock={exports:{}};strategyFactory(mock,name=>require('../../../MetalliSense_Backend_Simple/premeltGate/'+name.replace('./','')+'.js'));
 for(const handler of [acceptance,mock.exports]){
  store.seed();const heat=store.heats.list().find(h=>h.status==='PLANNED');heat.status='MELTING';heat.gate={prediction:{metalKg:1000}};const before=store.listMovements().length;
  expect(()=>handler.accept(heat.heatId,{candidate:{strategy:'balanced',recommended_additions:{Si:100000}},composition:{C:3},by:'Fixture'})).toThrow();expect(store.listMovements().length).toBe(before);expect(heat.acceptedStrategy).toBeFalsy();
  const candidate={strategy:'balanced',recommended_additions:{Si:.1}};const result=handler.accept(heat.heatId,{candidate,composition:{C:3},by:'Fixture'});expect(result.deductionVerified).toBe(true);expect(result.deductedLines[0].pct).toBe(.1);const movements=store.listMovements().length;expect(handler.accept(heat.heatId,{candidate,composition:{C:3},by:'Fixture'})).toEqual(result);expect(store.listMovements().length).toBe(movements);expect(()=>handler.accept(heat.heatId,{candidate:{...candidate,recommended_additions:{Si:.2}},by:'Fixture'})).toThrow();
 }
});
it('voice uses the same acceptance service, verified identity and exact selected candidate',async()=>{
 const candidate={strategy:'balanced',recommended_additions:{Si:.1}},response={status:200,data:{data:{...candidate,deductionVerified:true,deductedLines:[]}}},service=vi.fn(async()=>response);const context={route:'/rl-optimizer',selected:{heatId:'H-1'},loaded:{reading:{composition:{C:3}},result:{candidates:[candidate]}}};const action=prepareDecisionAction('accept balanced strategy',context,{getHeat:async()=>({data:{data:{status:'MELTING'}}}),acceptHeatStrategy:service});await action.precheck();await action.execute({user:{name:'Fixture Supervisor'}});expect(service).toHaveBeenCalledWith('H-1',candidate,{C:3},'Fixture Supervisor');
});
