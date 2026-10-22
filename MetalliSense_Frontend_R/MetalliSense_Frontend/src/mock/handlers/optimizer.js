import solver from 'javascript-lp-solver';
import { risk } from './ai.js';
export function solveCharge({grade,targetKg,riskWeight=0,currentPlanCost=0},lots,config,chemistry){
 if(!Number.isFinite(Number(targetKg))||Number(targetKg)<=0)throw new Error('Target weight must be positive');
 const spec=config.GRADE_SPECS[grade];if(!spec)throw new Error('Unknown grade');
 const usable=lots.filter(l=>!l.history&&['RELEASED','RESTRICTED'].includes(l.status)&&l.availableKg>0);
 const build=(objective='cost',exclude)=>{
  const constraints={mass:{equal:Number(targetKg)}};
  const variables={};
  for(const [e,[lo,hi]]of Object.entries(spec))if(e!=='Fe'){
   constraints[e+'Min']={min:0};constraints[e+'Max']={max:0};
  }
  const residual=config.RESIDUAL_LIMITS[grade]||{};for(const e of Object.keys(residual))constraints[e+'Residual']={max:0};
  for(const lot of usable){
   if(lot.lotId===exclude)continue;
   const chem=chemistry.lotChemistry(lot),v={mass:1,cost:(objective==='risk'?.001*lot.costPerKg:lot.costPerKg)+30*(objective==='risk'?1000:riskWeight)*(lot.chemistrySource==='LAB'||lot.materialType==='RETURNS'?0:lot.status==='RESTRICTED'?1:.2)};
   constraints[lot.lotId]={max:Math.min(lot.availableKg,lot.status==='RESTRICTED'?Number(targetKg)*(lot.restriction?.maxSharePct??100)/100:Infinity)};v[lot.lotId]=1;
   for(const [e,[lo,hi]]of Object.entries(spec))if(e!=='Fe'){
    const margin=(hi-lo)*.1,min=['P','S'].includes(e)?0:lo+margin,max=hi-margin;
    v[e+'Min']=chem.yield*((chem.composition[e]||0)-min);v[e+'Max']=chem.yield*((chem.composition[e]||0)-max);
   }
   for(const [e,max]of Object.entries(residual))v[e+'Residual']=chem.yield*((chem.composition[e]||0)-max);
   variables[lot.lotId]=v;
  }
  const result=solver.Solve({optimize:'cost',opType:'min',constraints,variables});
  if(!result.feasible)return null;
  const charge=usable.filter(l=>result[l.lotId]>.001).map(l=>({lotId:l.lotId,kg:Math.round(result[l.lotId]*10000)/10000}));
  const prediction=chemistry.predictMeltdown(charge.map(c=>({...c,lot:lots.find(l=>l.lotId===c.lotId)})));
  const totalCost=charge.reduce((s,c)=>s+c.kg*lots.find(l=>l.lotId===c.lotId).costPerKg,0);
  return {label:objective==='risk'?'Lowest risk':'Cheapest safe mix',charge,prediction,totalCost,costPerKg:totalCost/targetKg,risk:risk(grade,prediction.composition).risk,savings:currentPlanCost-totalCost,requires_human_approval:true};
 };
 const cheapest=build();if(!cheapest)return {feasible:false,candidates:[],blockingConstraint:'No mix satisfies grade safety margin, residual caps, released stock and restricted-lot share limits.'};
 const main=cheapest.charge.reduce((a,c)=>c.kg>a.kg?c:a,cheapest.charge[0]);
 const candidates=[cheapest,build('risk'),build('cost',main.lotId)].filter(Boolean);
 if(candidates[2])candidates[2].label='Alternative without '+main.lotId;
 return {feasible:true,grade,targetKg,candidates,blockingConstraint:null};
}
