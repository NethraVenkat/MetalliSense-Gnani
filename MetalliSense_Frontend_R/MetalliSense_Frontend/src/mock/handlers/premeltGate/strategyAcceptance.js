export default function(module,require){
// One atomic candidate-specific acceptance transaction in Node and browser mock.
const store=require('./store');
const additives=require('./additives');
const {lotChemistry}=require('./chemistry');
const bad=(status,message)=>Object.assign(new Error(message),{status});
function accept(heatId,{candidate,composition,by}={}){
 const heat=store.heats.get(heatId);
 if(!heat||heat.status!=='MELTING')throw bad(409,'A MELTING heat is required');
 if(!candidate||!['balanced','conservative','aggressive'].includes(candidate.strategy)||!by)throw bad(400,'Strategy and operator are required');
 const additions=candidate.recommended_additions;
 if(!additions||typeof additions!=='object'||Array.isArray(additions)||Object.entries(additions).some(([e,v])=>!['Fe','C','Si','Mn','P','S'].includes(e)||typeof v!=='number'||!Number.isFinite(v)||v<0))throw bad(422,'Additions must be finite nonnegative percentages');
 if((additions.P||0)>0||(additions.S||0)>0)throw bad(409,'No approved source for P or S additions');
 const fingerprint=JSON.stringify([candidate.strategy,Object.entries(additions).sort(),Object.entries(composition||{}).sort()]);
 if(heat.acceptedStrategy){if(heat.acceptedStrategy.acceptanceFingerprint!==fingerprint)throw bad(409,'Another strategy or quantity was already accepted');return heat.acceptedStrategy;}
 const mass=heat.gate?.prediction?.metalKg;
 if(!(Number.isFinite(mass)&&mass>0))throw bad(409,'Heat metal mass is unavailable');
 const lines=additives.suggest(additions,mass);
 if(additions.Fe>0){const lot=store.listLots().find(l=>l.materialType==='PIG_IRON'&&l.status==='RELEASED'&&store.availableKg(l.lotId)>0);if(!lot)throw bad(409,'No released pig iron for Fe');const fraction=(lotChemistry(lot).composition.Fe||0)/100;if(!(fraction>0))throw bad(409,'Pig iron Fe chemistry unavailable');lines.push({lotId:lot.lotId,kg:mass*additions.Fe/100/fraction,element:'Fe',inStock:true});}
 const totals={};for(const line of lines){if(!line.lotId||!line.inStock||!Number.isFinite(line.kg)||line.kg<=0)throw bad(409,'Accepted candidate has insufficient additive stock');totals[line.lotId]=(totals[line.lotId]||0)+line.kg;}
 for(const [id,kg] of Object.entries(totals))if(kg>store.availableKg(id))throw bad(409,'Insufficient stock in '+id);
 const snapshot=structuredClone(store.snapshot());
 try{
  for(const line of lines)store.addMovement({lotId:line.lotId,kg:-line.kg,type:'ADDITION',heatId,by,note:'Accepted '+candidate.strategy});
  heat.acceptedStrategy={...candidate,grade:heat.grade,deductedLines:lines,deductionVerified:true,acceptanceFingerprint:fingerprint};
  heat.correctionReading=composition;heat.currentComposition={...composition};heat.postCorrectionTicks=0;
  store.log('STRATEGY_ACCEPTED',heatId,by,'Accepted candidate quantities deducted');return heat.acceptedStrategy;
 }catch(error){store.restore(snapshot);throw error;}
}
module.exports={accept};

}
