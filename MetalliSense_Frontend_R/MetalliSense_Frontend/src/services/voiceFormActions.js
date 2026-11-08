import {spokenFormFields} from './voiceFormContent';
// F17B scoped, explicit form conversations. No service call occurs while collecting.
import {normalizeSpokenNumbers} from './spokenNumbers';
import {nativeActionText,nativeReadback} from './voiceActionLanguages';
import {ahpLocal} from './supplierWeights';
const OP=['Operator','Supervisor'],MAN=['Manager'],SM=['Supervisor','Manager'];
export const formDefinitions=[
 ['receive_lot','/raw-material-stock',['receive truck','receive lot'],OP,'receiveLot'],
 ['receive_alloy','/raw-material-stock',['receive alloy batch'],OP,'receiveFerroalloy'],
 ['dri_entry','/raw-material-stock',['dri lab entry'],OP,'enterDriQa'],
 ['plan_heat','/premelt-gate',['plan heat'],OP,'planHeat'],
 ['edit_charge','/premelt-gate',['edit charge','save charge'],OP,'updateCharge'],
 ['create_pr','/inventory-forecast',['create pr'],OP,'createPurchaseRequest'],
 ['issue_invoice','/sales',['issue invoice'],MAN,'createInvoice'],
 ['create_grade','/grades',['create grade spec'],MAN,'createGradeSpec'],
 ['edit_grade','/grades',['edit grade spec'],MAN,'updateGradeSpec'],
 ['edit_prices','/cost-analysis',['edit prices'],MAN,'updatePrices'],
 ['create_training','/training-data',['create training sample'],SM,'createTrainingData'],
 ['edit_training','/training-data',['edit training sample'],SM,'updateTrainingData'],
 ['apply_ahp','/supplier-scorecard',['apply ahp weights'],MAN,'updateSupplierAhp'],
 ['apply_weights','/supplier-scorecard',['apply criteria weights'],MAN,'updateSupplierWeights'],
 ['release_lot','/raw-material-stock',['manual lot release'],MAN,'setLotStatus'],
 ['reject_lot','/raw-material-stock',['manual lot reject'],MAN,'setLotStatus'],
 ['replace_argon','/yard-inspection',['replace argon'],OP,'replaceArgon'],
 ['override_start','/premelt-gate',['hold override start','override hold and start'],['Unit Controller'],'startMelting','OVERRIDE'],
 ['delete_reading','/spectrometer',['delete reading'],SM,'deleteReading','DELETE'],
 ['delete_grade','/grades',['delete grade spec'],SM,'deleteGradeSpec','DELETE'],
 ['delete_training','/training-data',['delete training sample'],SM,'deleteTrainingData','DELETE'],
 ['reset_demo','/premelt-gate',['reset demo'],MAN,'resetDemo','RESET'],
 ['clear_chat','/anomaly',['clear chat history'],SM,'clearChatHistory','CLEAR'],
 ['clear_chat','/recommendation',['clear chat history'],SM,'clearChatHistory','CLEAR'],
].map(([id,page,phrases,requiredRoles,service,confirmWord])=>({id,page,phrases,phrase:phrases[0],requiredRoles,service,confirmWord,level:'APPROVE',scopeChange:true}));
const normal=s=>String(s??'').normalize('NFKC').trim();
export function scopeFormMatch(text,route){const defs=formDefinitions.filter(d=>d.page===route),t=nativeActionText(text,defs).toLowerCase().replace(/^override hold and start/,'hold override start');if(/\bingest\b|\bcsv\b|;|\bthen\b|\band\b/i.test(t))return null;return defs.find(d=>d.phrases.some(p=>t===p||t.startsWith(p+' ')))||null;}
const fail=message=>{throw Object.assign(Error(message),{refused:true});};
const get=(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj);
function put(obj,path,value){const parts=path.split('.');if(parts.some(k=>['__proto__','constructor','prototype'].includes(k)))fail('Invalid field');let node=obj;for(let i=0;i<parts.length-1;i++)node=node[parts[i]]??(node[parts[i]]=/^\d+$/.test(parts[i+1])?[]:{});node[parts.at(-1)]=value;}
const missing=v=>v===undefined||v===null||v==='';
export function parseFormNumber(value){const text=normalizeSpokenNumbers(normal(value)).replace(/\s*(?:kg|kilograms?|percent|%)$/i,'').trim();if(!/^-?\d+(?:\.\d+)?$/.test(text)||!Number.isFinite(Number(text)))fail('Say one numeric value.');return Number(text);}
const field=(path,type='text',min,options)=>({path,type,min,options});
const textFields=(...paths)=>paths.map(p=>field(p));
const elements=['Fe','C','Si','Mn','P','S'];
const gradeFields=[field('grade'),...elements.flatMap(e=>[field('composition_ranges.'+e+'.0','number',0),field('composition_ranges.'+e+'.1','number',0)])];
const trainingFields=[field('grade'),...elements.map(e=>field(e,'number',0)),field('severity','text',null,['none','mild','moderate','severe']),field('sample_type','text',null,['normal','deviated']),field('deviated','number',0,[0,1])];
function validateField(value,spec){let v=value;
 if(spec.path==='field'&&spec.options){let name=normal(value).toLowerCase();for(const [element,aliases] of Object.entries({C:['carbon','கார்பன்','कार्बन'],Si:['silicon','சிலிக்கான்','सिलिकॉन'],Mn:['manganese','மாங்கனீஸ்','मैंगनीज'],P:['phosphorus','பாஸ்பரஸ்','फॉस्फोरस'],S:['sulphur','sulfur','சல்பர்','सल्फर'],Fe:['iron','இரும்பு','लोहा']})){if(aliases.some(a=>name.includes(a))||new RegExp('^'+element+'(?: |$)','i').test(name)){const bound=/max|maximum|அதிக|अधिकतम/.test(name)?1:/min|minimum|குறைந்த|न्यूनतम/.test(name)?0:null;const candidate=bound===null?element:'composition_ranges.'+element+'.'+bound;if(spec.options.includes(candidate)){value=candidate;break;}}}}
if(spec.type==='number')v=parseFormNumber(value);else v=normal(value);if(missing(v))fail('This field is required.');if(spec.min!==undefined&&spec.min!==null&&(spec.type==='number'?v<spec.min:v.length<spec.min))fail('Value is below the required minimum.');if(['lotId','heatId'].includes(spec.path))v=normalizeSpokenNumbers(v).replace(/\s+/g,'-').toUpperCase();if(spec.options){const key=x=>String(x).toLowerCase().replace(/[ _-]/g,'');const found=spec.options.find(x=>key(x)===key(v));if(found===undefined)fail('Choose one of: '+spec.options.join(', '));v=found;}return v;}
export function driWarnings(body,lot){const declared=lot?.declared||{},met=100*body.feMetallic/body.feTotal,w=[];const dm=declared.feTotal?100*declared.feMetallic/declared.feTotal:null;if(dm&&Math.abs(met-dm)>5)w.push('Metallization differs from supplier by more than 5 points');if(declared.feTotal&&Math.abs(body.feTotal-declared.feTotal)>3)w.push('Fe total differs from supplier by more than 3 points');if(declared.P&&body.P>2*declared.P)w.push('P exceeds twice supplier value');if(met<70)w.push('Metallization below 70 percent');return w;}
export function prepareFormAction(text,context,services){
 const def=scopeFormMatch(text,context?.route);if(!def)return null;const loaded=context.loaded||{},selected=context.selected||{};const draft=structuredClone(loaded.voiceForms?.[def.id]||{});let target,summary,lotSnapshot,config,weights;
 const data=r=>r?.data?.data??r?.data;
 const idHints=(normalizeSpokenNumbers(text).match(/\b(?:H|PR|QA|PIG|SCR|DRI|RET|ALY)[- ]?\d+\b/gi)||[]).map(id=>id.toUpperCase().replace(/\s+/g,'-'));
 const setDefault=(key,value)=>{if(missing(get(draft,key))&&!missing(value))put(draft,key,value);};
 const command=nativeActionText(text,[def]);const spoken=normalizeSpokenNumbers(command);const mass=spoken.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|கிலோ|किलो)\b/iu);
 if(mass){if(['receive_lot','receive_alloy'].includes(def.id))draft.receivedKg=Number(mass[1]);if(def.id==='plan_heat')draft.targetKg=Number(mass[1]);if(['create_pr','issue_invoice'].includes(def.id))draft.qtyKg=Number(mass[1]);}
 const gradeMatch=spoken.match(/\b(SG[- ]IRON|GREY[- ]IRON|LOW[- ]CARBON[- ]STEEL|MEDIUM[- ]CARBON[- ]STEEL|HIGH[- ]CARBON[- ]STEEL)\b/i);if(gradeMatch&&['plan_heat','create_training','create_grade'].includes(def.id))draft.grade=gradeMatch[1].toUpperCase().replaceAll(' ','-');
 if(def.id==='receive_lot')for(const [name,pattern] of Object.entries({STEEL_SCRAP:/steel scrap/i,CI_SCRAP:/ci scrap/i,PIG_IRON:/pig iron/i,DRI:/\bdri\b/i,RETURNS:/\breturns\b/i,FERROALLOY:/ferroalloy/i}))if(pattern.test(spoken))draft.materialType=name;
 if(def.id==='receive_alloy'){const match=spoken.match(/FeSi[- ]?75|HC FeMn|Recarburiser/i);if(match)draft.alloyName=match[0].toLowerCase().startsWith('fesi')?'FeSi-75':match[0].toLowerCase().startsWith('hc')?'HC FeMn':'Recarburiser';}
 if(['receive_lot','receive_alloy'].includes(def.id)){const supplier=command.match(/\b(?:from|supplier)\s+(.+?)(?=\s+(?:truck|cost|at)\b|$)/i);if(supplier)draft.supplier=supplier[1].trim();}
 if(def.id==='issue_invoice'){const customer=command.match(/\bcustomer\s+([A-Za-z0-9_-]+)/i),rate=spoken.match(/\bat\s+(\d+(?:\.\d+)?)/i);if(customer)draft.customerId=customer[1];if(rate)draft.ratePerKg=Number(rate[1]);}
 if(def.id==='dri_entry')for(const [key,label] of Object.entries({feTotal:'(?:fe total|total fe)',feMetallic:'(?:metallic fe|fe metallic)',C:'carbon',S:'(?:sulphur|sulfur)',P:'phosphorus'})){const match=spoken.match(new RegExp('\\b'+label+'\\s+(\\d+(?:\\.\\d+)?)','i'));if(match)draft[key]=Number(match[1]);}
 if(['dri_entry','release_lot','reject_lot'].includes(def.id))setDefault('lotId',idHints[0]?.replace(' ','-')||selected.lotId);
 if(['edit_charge','override_start'].includes(def.id))setDefault('heatId',idHints.find(x=>/^H/i.test(x))?.replace(' ','-')||selected.heatId);
 if(def.id==='issue_invoice')setDefault('heatId',idHints.find(x=>/^H/i.test(x))?.replace(' ','-')||selected.heatId);
 const canonicalCommand=nativeActionText(text,[def]);const matchedPhrase=def.phrases.find(p=>canonicalCommand.toLowerCase().startsWith(p));const tail=matchedPhrase?canonicalCommand.slice(matchedPhrase.length).trim():'';if(['edit_grade','delete_grade','edit_training','delete_training','delete_reading'].includes(def.id)&&tail)setDefault('target',tail);
 if(['edit_grade','delete_grade'].includes(def.id))setDefault('target',selected.grade);
 if(['edit_training','delete_training'].includes(def.id))setDefault('target',selected.sampleId);
 if(def.id==='delete_reading')setDefault('target',selected.readingId);
 if(def.id==='create_pr')setDefault('item',selected.item);
 async function requireFields(specs,ask){for(const spec of specs){if(!missing(get(draft,spec.path))){put(draft,spec.path,validateField(get(draft,spec.path),spec));continue;}let last;for(let attempt=0;attempt<2;attempt++){try{const answer=await ask(spec.path+(spec.options?' ('+spec.options.join(', ')+')':'')+(attempt?' ? invalid, try once more':''));put(draft,spec.path,validateField(answer,spec));last=null;break;}catch(error){if(error.name==='AbortError')throw error;last=error;}}if(last)throw last;}}
 const resolveRow=(rows,key,value)=>{const found=(rows||[]).filter(r=>String(r[key]).toLowerCase()===String(value).toLowerCase()||r.grade&&r.grade.toLowerCase()===String(value).toLowerCase());if(found.length!==1)fail('Target is missing or ambiguous on this page.');return found[0];};
 return {...def,async collect(ask,ctx){
  if(loaded.loading||loaded.busy)fail('Wait for this page to load.');const id=def.id;
  if(id==='receive_lot'){await requireFields([field('materialType','text',null,['STEEL_SCRAP','CI_SCRAP','PIG_IRON','DRI','RETURNS','FERROALLOY']),field('receivedKg','number',.001)],ask);if(draft.materialType==='FERROALLOY')await requireFields(textFields('alloyName'),ask);}
  else if(id==='receive_alloy')await requireFields([field('alloyName','text',null,['FeSi-75','HC FeMn','Recarburiser']),field('receivedKg','number',.001)],ask);
  else if(id==='dri_entry'){
   await requireFields([field('lotId'),...['feTotal','feMetallic','C','S','P'].map(p=>field(p,'number',0))],ask);const detail=data(await services.getLot(draft.lotId));if(detail?.lot?.materialType!=='DRI')fail('A DRI lot is required.');target=detail.lot;lotSnapshot=JSON.stringify([target.version,target.declared]);
   if(draft.feTotal>100||draft.feTotal<=0||draft.feMetallic>draft.feTotal||draft.C>3||draft.P>.5||draft.S>.5)fail('Implausible DRI values: check units.');const warnings=driWarnings(draft,target);if(warnings.length){const answer=await ask('Unusual values: '+warnings.join('; ')+'. Confirm yes or no.');if(!/^(yes|ok|okay|\u0b86\u0bae\u0bbe|\u0b86\u0bae\u0bcd|\u0939\u093e\u0901|\u0939\u093e\u0902)[.!?\u0964]*$/iu.test(normal(answer)))throw new DOMException('Unusual values not confirmed','AbortError');draft.confirmWarnings=true;}else draft.confirmWarnings=false;
  }else if(id==='plan_heat'){await requireFields([field('grade'),field('targetKg','number',.001)],ask);draft.charge=draft.charge||[];}
  else if(id==='edit_charge'){
   await requireFields(textFields('heatId'),ask);const heat=data(await services.getHeat(draft.heatId));if(/^edit charge/i.test(nativeActionText(text,[def]))&&!loaded.dirty)delete draft.charge;if(heat?.status!=='PLANNED')fail('Only PLANNED charge can change.');
   if(!draft.charge&&/^save charge/i.test(nativeActionText(text,[def])))draft.charge=structuredClone(loaded.charge);
   if(!draft.charge){await requireFields([field('lineCount','number',1)],ask);if(!Number.isInteger(draft.lineCount)||draft.lineCount>20)fail('Charge needs 1 to 20 lines.');for(let i=0;i<draft.lineCount;i++)await requireFields([field('charge.'+i+'.lotId'),field('charge.'+i+'.kg','number',.001)],ask);delete draft.lineCount;}
   if(!Array.isArray(draft.charge)||!draft.charge.length||new Set(draft.charge.map(l=>l.lotId)).size!==draft.charge.length||draft.charge.some(l=>!l.lotId||!Number.isFinite(l.kg)||l.kg<=0))fail('Charge lines must be unique and positive.');
  }else if(id==='create_pr')await requireFields([field('item'),field('qtyKg','number',.001)],ask);
  else if(id==='issue_invoice'){
   await requireFields([field('heatId'),field('customerId'),field('qtyKg','number',.001),field('ratePerKg','number',.001)],ask);
   // Speech normalization changes case; retain the actual screen customer ID.
   if(loaded.customers)draft.customerId=resolveRow(loaded.customers,'id',draft.customerId).id;
  }
  else if(id==='create_grade'){for(const range of Object.values(draft.composition_ranges||{}))if(Array.isArray(range)&&range[0]>=range[1])range[1]=undefined;await requireFields(gradeFields,ask);if((loaded.grades||[]).some(g=>g.grade?.toLowerCase()===draft.grade.toLowerCase()))fail('Grade already exists; use edit grade spec.');}
  else if(id==='create_training'){await requireFields(trainingFields,ask);}
  else if(id==='edit_grade'||id==='edit_training'){
   await requireFields(textFields('target'),ask);target=resolveRow(id==='edit_grade'?loaded.grades:loaded.trainingData,'_id',draft.target);
   const allowed=id==='edit_grade'?['standard','description',...gradeFields.filter(f=>f.path!=='grade').map(f=>f.path)]:trainingFields.map(f=>f.path);
   await requireFields([field('field','text',null,allowed)],ask);const spec=(id==='edit_grade'?gradeFields:trainingFields).find(f=>f.path===draft.field)||field(draft.field);await requireFields([{...spec,path:'value'}],ask);draft.record=structuredClone(target);delete draft.record._id;put(draft.record,draft.field,draft.value);
  }else if(id==='edit_prices'){await requireFields([field('kind','text',null,['element','grade']),field('key'),field('price','number',0)],ask);if(!(draft.key in (draft.kind==='element'?loaded.elementPrices||{}:loaded.baseMetalPrices||{})))fail('Choose a loaded element or grade price.');}
  else if(id==='apply_ahp'){
   for(const key of ['quality:cost','quality:delivery','quality:service','cost:delivery','cost:service','delivery:service'])await requireFields([field('judgements.'+key,'number',1/9)],ask);
   if(Object.values(draft.judgements).some(v=>v>9))fail('AHP ratios must be between 1/9 and 9.');weights=ahpLocal(draft.judgements);if(!Number.isFinite(weights.CR)||weights.CR>=.1)fail('AHP consistency ratio must be below 0.10.');draft.CR=weights.CR;draft.weights=Object.fromEntries(['quality','cost','delivery','service'].map((k,i)=>[k,weights.w[i]*100]));
  }else if(id==='apply_weights'){
   const criteria=loaded.data?.criteria;if(!criteria?.length)fail('Load criteria first.');for(const c of criteria)await requireFields([field('weights.'+c.key,'number',0)],ask);if(!Object.values(draft.weights).some(v=>v>0))fail('Weights cannot all be zero.');draft.CR='Not applicable: direct criterion weights';
  }else if(id==='release_lot'||id==='reject_lot'){
   await requireFields([field('lotId'),field('reason','text',10)],ask);target=data(await services.getLot(draft.lotId))?.lot;if(!target)fail('Lot unavailable.');draft.status=id==='release_lot'?'RELEASED':'REJECTED';
  }else if(id==='override_start'){
   config=data(await services.getPremeltConfig());const minimum=Math.max(20,Number(config?.settings?.overrideReasonMinLength)||20);await requireFields([field('heatId'),field('reason','text',minimum)],ask);draft.warning='This overrides a HOLD gate';
  }else if(id.startsWith('delete_')){
   await requireFields(textFields('target'),ask);const rows=id==='delete_reading'?loaded.readings:id==='delete_grade'?loaded.grades:loaded.trainingData;target=resolveRow(rows,'_id',draft.target);draft.target=target._id;
  }
  const ranges=id==='create_grade'?draft.composition_ranges:id==='edit_grade'?draft.record?.composition_ranges:null;
  if(ranges&&Object.values(ranges).some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]>=v[1]))fail('Every composition minimum must be below its maximum.');
 },async precheck(){
   if(context.isCurrent?.(context.scope)===false)fail('Page changed.');if(def.id==='override_start'){const heat=data(await services.getHeat(draft.heatId));if(loaded.dirty||heat?.status!=='PLANNED'||heat.gateResult?.decision!=='HOLD'||heat.gate?.stale||!Number.isFinite(Date.parse(heat.gateResult.validUntil))||Date.parse(heat.gateResult.validUntil)<=Date.now())fail('A fresh unchanged PLANNED HOLD gate is required.');target=heat;}
   summary=def.phrase+': '+JSON.stringify(draft)+'; actor = verified passcode identity'+(def.confirmWord?'; then say '+def.confirmWord:'');return {ok:true};
 },buildSummary:(ctx={})=>({displayText:summary,spokenText:nativeReadback(def.id,def.phrase+': '+spokenFormFields(draft,ctx.lang)+'; actor = verified passcode identity'+(def.confirmWord?'; '+def.confirmWord:''),ctx.lang)}),async execute(ctx){
  if(!ctx.user?.name||!def.requiredRoles.includes(ctx.user.role))fail('Verified required role missing.');if(context.isCurrent?.(context.scope)===false)fail('Page changed.');const name=ctx.user.name,id=def.id;let response;
  if(id==='receive_lot')response=await services.receiveLot({...draft,receivedBy:name});
  else if(id==='receive_alloy')response=await services.receiveFerroalloy({...draft,receivedBy:name});
  else if(id==='dri_entry'){const current=data(await services.getLot(draft.lotId))?.lot;if(JSON.stringify([current?.version,current?.declared])!==lotSnapshot)fail('Lot changed: review warnings again.');const {lotId,...body}=draft;response=await services.enterDriQa(lotId,{...body,analyst:name});}
  else if(id==='plan_heat')response=await services.planHeat({...draft,plannedBy:name});
  else if(id==='edit_charge')response=await services.updateCharge(draft.heatId,{charge:draft.charge});
  else if(id==='create_pr')response=await services.createPurchaseRequest({...draft,requestedBy:name});
  else if(id==='issue_invoice')response=await services.createInvoice({...draft,createdBy:name});
  else if(id==='create_grade')response=await services.createGradeSpec(draft);
  else if(id==='edit_grade')response=await services.updateGradeSpec(target._id,draft.record);
  else if(id==='create_training')response=await services.createTrainingData(draft);
  else if(id==='edit_training')response=await services.updateTrainingData(target._id,draft.record);
  else if(id==='edit_prices')response=await services.updatePrices({elementPrices:draft.kind==='element'?{[draft.key]:draft.price}:{},baseMetalPrices:draft.kind==='grade'?{[draft.key]:draft.price}:{}});
  else if(id==='apply_ahp')response=await services.updateSupplierAhp(draft.judgements,true);
  else if(id==='apply_weights')response=await services.updateSupplierWeights(draft.weights);
  else if(id==='release_lot'||id==='reject_lot')response=await services.setLotStatus(draft.lotId,{status:draft.status,reason:draft.reason,by:name,managerApproval:ctx.user.role==='Manager'});
  else if(id==='override_start'){
   if(ctx.user.role!=='Unit Controller')fail('Unit Controller required.');const fresh=data(await services.getHeat(draft.heatId));if(fresh?.status!=='PLANNED'||fresh.gateResult?.gateId!==target.gateResult.gateId||fresh.gateResult?.decision!=='HOLD'||fresh.gate?.stale||!Number.isFinite(Date.parse(fresh.gateResult.validUntil))||Date.parse(fresh.gateResult.validUntil)<=Date.now())fail('HOLD gate changed or expired.');response=await services.startMelting(draft.heatId,{operator:name,override:{engineer:name,reason:draft.reason}});
  }else if(id==='delete_reading')response=await services.deleteReading(target._id);
  else if(id==='delete_grade')response=await services.deleteGradeSpec(target._id);
  else if(id==='delete_training')response=await services.deleteTrainingData(target._id);
  else response=await services[def.service]();
  if(!response||response.status<200||response.status>=300||response.data?.success===false||['fail','error','failed'].includes(response.data?.status))throw Object.assign(Error(response?.data?.message||'Backend refused'),{response});
  const result=data(response);context.notifyAction?.({id,data:result});const ids=[result?._id,result?.lotId,result?.qaId,result?.heatId,result?.prId,result?.invoiceId,draft.lotId,draft.heatId,target?._id].filter(Boolean);
  return {status:response.status,ids:[...new Set(ids)],message:'Completed'};
 }};
}
