// Typed, read-only ASK presentation. Unknown shapes stay unavailable, never JSON.
export const askGet=(object,path)=>path?.split('.').reduce((value,key)=>value?.[key],object);
const choose=(lang,en,ta,hi)=>({en,ta,hi}[lang]??en);
export const askNumber=value=>typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='string'&&/^[-+]?\d+(?:\.\d+)?$/.test(value.trim())&&Number.isFinite(Number(value))?value.trim():null;
export const askText=value=>typeof value==='string'&&value.trim()&&!/\[object|[{}]|\[\s*(?:"|[-+\d]|true\b|false\b|null\b|[\[{])|\b(?:undefined|null)\b/iu.test(value)?value.trim():null;
export const askKg=lang=>choose(lang,'kg','கிலோ','किलो');
// Formatting metadata follows the owning page: shared percentages 2dp,
// FullAnalysis/TrainingData 3dp, MechanicalProperties 1dp; no data is rounded in storage.
export function askDisplayNumber(value,options={}){
 const valid=askNumber(value);if(valid===null)return null;const number=Number(valid);
 if(options.money){const rounded=Number(number.toFixed(2)),decimals=Number.isInteger(rounded)?0:2;return new Intl.NumberFormat('en-IN',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(rounded);}
 if(options.fixedDecimals)return options.decimals===undefined?valid:number.toFixed(options.decimals);
 const decimals=options.decimals??options.maxDecimals??2;
 if(options.grouped)return new Intl.NumberFormat('en-IN',{maximumFractionDigits:decimals}).format(number);
 return String(Number(number.toFixed(decimals)));
}
export function askTime(value,now=new Date(),dateOnly=false,lang='en'){
 if(!(typeof value==='string'||typeof value==='number'||value instanceof Date)||value===''||value===null)return null;
 if(typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}(?:T| |$)/.test(value))return null;
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
 const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
 const p=parts(date),n=parts(new Date(now));
 const months={en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],ta:['ஜனவரி','பிப்ரவரி','மார்ச்','ஏப்ரல்','மே','ஜூன்','ஜூலை','ஆகஸ்ட்','செப்டம்பர்','அக்டோபர்','நவம்பர்','டிசம்பர்'],hi:['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर']};
 const month=(months[lang]??months.en)[Number(p.month)-1];const day=(lang==='hi'?`${p.day} ${month}`:`${month} ${p.day}`)+(p.year===n.year?'':` ${p.year}`),time=Number(p.hour)+':'+p.minute;
 return dateOnly?day:p.year===n.year&&p.month===n.month&&p.day===n.day?time:day+' '+time;
}
export function askEnum(value,kind,lang){
 const labels=kind==='severity'?{none:['no deviation','டீவியேஷன் இல்ல','कोई बदलाव नहीं'],low:['low','குறைவு','कम'],mild:['mild','லேசானது','हल्का'],medium:['moderate','நடுத்தரம்','मध्यम'],moderate:['moderate','நடுத்தரம்','मध्यम'],high:['high','அதிகம்','ज़्यादा'],severe:['severe','கடுமையானது','गंभीर']}: {normal:['a normal sample','சாதாரண சாம்பிள்','सामान्य सैंपल'],deviated:['a sample with deviation','டீவியேஷன் உள்ள சாம்பிள்','बदलाव वाला सैंपल']};
 const text=askText(value);return text?labels[text.toLowerCase()]?.[{en:0,ta:1,hi:2}[lang]??0]??null:null;
}
export function askList(items,format,lang='en',limit=3){
 if(!Array.isArray(items)||!items.length)return null;limit=Number.isInteger(limit)?Math.max(1,Math.min(3,limit)):3;const values=items.slice(0,limit).map(format);if(values.some(v=>!askText(v)))return null;
 const rest=items.length-values.length;return values.join(', ')+(rest?choose(lang,`, and ${rest} more on screen`,`, மீதி ${rest} ஸ்கிரீன்ல`,`, बाकी ${rest} स्क्रीन पर`):'');
}
const words={Cu:['copper','காப்பர்','कॉपर'],C:['carbon','கார்பன்','कार्बन'],Si:['silicon','சிலிக்கான்','सिलिकॉन'],Mn:['manganese','மாங்கனீஸ்','मैंगनीज'],P:['phosphorus','பாஸ்பரஸ்','फॉस्फोरस'],S:['sulfur','சல்பர்','सल्फर']};
const elementName=(e,lang)=>words[e]?.[{en:0,ta:1,hi:2}[lang]??0]??askText(e);
// Known element-limit fragments only; preserve other explanations and written IDs.
export function elementLimitReason(text,lang='en'){
 if(lang!=='en'||typeof text!=='string')return text;
 const elements={cu:'copper',copper:'copper',sn:'tin',tin:'tin',mn:'manganese',manganese:'manganese',c:'carbon',carbon:'carbon',si:'silicon',silicon:'silicon',p:'phosphorus',phosphorus:'phosphorus',s:'sulfur',sulfur:'sulfur'};
 const token='(?:copper|tin|manganese|carbon|silicon|phosphorus|sulfur|sulphur|Cu|Sn|Mn|Si|C|P|S)';
 const pattern=new RegExp('\\b('+token+'(?:(?:,? and |, )'+token+')*)\\s+(?:(?:is|are)\\s+)?(above|below)\\s+(?:the )?(selected range|range|limit)\\b','gi');
 return text.replace(pattern,(_,names,direction,limit)=>{const parts=names.split(/,? and |, /i).map(n=>elements[n.toLowerCase()]||n.toLowerCase());const subject=parts.length>1?parts.slice(0,-1).join(', ')+' and '+parts.at(-1):parts[0];return subject+' '+(parts.length>1?'are':'is')+' '+direction.toLowerCase()+' the '+limit.toLowerCase();});
}
const translatedReason={
 'Copper above limit':['Copper above limit','காப்பர் லிமிட்டுக்கு மேல','कॉपर सीमा से ज़्यादा है'],
 'Chemistry from certificate / parent heat':['chemistry from certificate or parent heat','சான்றிதழ் அல்லது முந்தைய heat கலவை இருக்கு','प्रमाणपत्र या पिछले हीट की संरचना उपलब्ध है'],
};
export function askStatus(value,lang){const status=askText(value);if(!status)return null;const labels={RELEASED:['released','ரிலீஸ் ஆனது','रिलीज़ हुआ'],QUARANTINED:['in quarantine','க்வாரண்டைன்ல இருக்கு','क्वारंटीन में है'],AWAITING_QA:['awaiting QA','QA-க்குக் காத்திருக்கு','QA का इंतज़ार है'],PROVISIONAL:['provisional','தற்காலிக நிலையில் இருக்கு','अस्थायी स्थिति में है'],CONSUMED:['used up','பயன்படுத்தியாச்சு','इस्तेमाल हो गया'],QUARANTINE:['in quarantine','க்வாரண்டைன்ல இருக்கு','क्वारंटीन में है'],REJECTED:['rejected','ரிஜெக்ட்','अस्वीकृत'],RESTRICTED:['restricted','கட்டுப்பாட்டுல இருக்கு','सीमित है']};return labels[status]?.[{en:0,ta:1,hi:2}[lang]??0]??status;}
const decisionNoun=(value,lang)=>{const labels={QUARANTINED:['quarantined','க்வாரண்டைன்','क्वारंटीन'],QUARANTINE:['quarantined','க்வாரண்டைன்','क्वारंटीन'],RELEASED:['released','ரிலீஸ்','रिलीज़'],REJECTED:['rejected','ரிஜெக்ட்','अस्वीकृत'],RESTRICTED:['restricted','கட்டுப்பாடு','सीमित']};return labels[value]?.[{en:0,ta:1,hi:2}[lang]??0]??askText(value);};
const reason=(value,owner,lang)=>elementLimitReason(askText(owner?.['reason_'+lang])??askText(owner?.['statusReason_'+lang])??translatedReason[value]?.[{en:0,ta:1,hi:2}[lang]??0]??askText(value),lang);
const pairs=value=>Array.isArray(value)?value:typeof value==='object'&&value?Object.entries(value).map(([element,value])=>({element,value})):null;
function charge(line,lang){const id=askText(line?.lotId),kg=askDisplayNumber(line?.kg,{grouped:true,maxDecimals:1});return id&&kg!==null?`${id} ${kg} ${askKg(lang)}`:null;}
function addition(line,row){const element=askText(line?.element),value=askDisplayNumber(line?.value??line?.pct,row);return element&&value!==null?`${element} ${Number(value)>=0?'+':''}${value}%`:null;}
function chemistry(line,row){const element=askText(line?.element),value=askDisplayNumber(line?.value,row);return element&&value!==null?`${element} ${value}%`:null;}
function tap(value,lang,now){if(!value||typeof value!=='object')return null;const kg=askNumber(value.castingsKg),grade=askText(value.soldGrade),by=askText(value.approvedBy),time=askTime(value.at,now,false,lang);if(kg===null||!grade||!by||!time)return null;return choose(lang,`${kg} kg, ${grade}, approved by ${by} at ${time}`,`${kg} கிலோ, ${grade}, ${by} அப்ரூவ் பண்ணது ${time}`,`${kg} किलो, ${grade}, ${by} ने ${time} पर मंज़ूर किया`);}
function blocking(value,s,lang){
 if(!Array.isArray(value)||!value.length)return null;
 const first=s.heat?.gateResult?.checks?.find(c=>c.status==='FAIL');
 const detail=first?.details?.find(d=>d.status==='FAIL'&&Number(d.value)>Number(d.max));
 const number=d=>askNumber(d);let text;
 if(detail&&number(detail.value)!==null&&number(detail.max)!==null&&elementName(detail.element,lang)){
  const el=elementName(detail.element,lang),v=number(detail.value),limit=number(detail.max);
  text=choose(lang,`It can't start because ${el} ${v}% is above the ${limit}% limit.`,`${el} ${v}%, லிமிட் ${limit}%-க்கு மேல; அதனால ஸ்டார்ட் பண்ண முடியாது.`,`${el} ${v}% है, सीमा ${limit}% से ज़्यादा, इसलिए शुरू नहीं हो सकता।`);
 }else{const message=elementLimitReason(askText(value[0])??askText(value[0]?.text),lang);if(!message)return null;text=choose(lang,`It can't start because ${message}.`,`${message}, அதனால ஸ்டார்ட் பண்ண முடியாது.`,`${message}, इसलिए शुरू नहीं हो सकता।`);}
 const extra=value.length-1;return text+(extra?choose(lang,` And ${extra} more on screen.`,` மீதி ${extra} ஸ்கிரீன்ல.`,` बाकी ${extra} स्क्रीन पर।`):'');
}
export function formatAskValue(row,value,s,lang='en',now=new Date()){
 switch(row.format){
 case 'number':return askDisplayNumber(value,row);
 case 'severity':return askEnum(value,'severity',lang);
 case 'sampleType':return askEnum(value,'sampleType',lang);
 case 'text':{const original=askText(value),text=elementLimitReason(original,lang);return text&&lang==='en'&&text!==original&&row.en.includes('is {value}')&&!text.startsWith('that ')?'that '+text:text;}
 case 'price':return askDisplayNumber(value,row)??askDisplayNumber(value?.costPerKg,row)??askDisplayNumber(value?.pricePerKg,row);
 case 'time':return askTime(value,now,false,lang);
 case 'range':{if(!(Array.isArray(value)&&value.length===2||value&&typeof value==='object'&&!Array.isArray(value)&&'min' in value&&'max' in value))return null;const min=askNumber(value?.[0]??value?.min),max=askNumber(value?.[1]??value?.max);return min!==null&&max!==null?choose(lang,`${min} to ${max}`,`${min} முதல் ${max}`,`${min} से ${max}`):null;}
 case 'connected':return typeof value==='boolean'?value?choose(lang,'The gun is connected.','கன் கனெக்ட் ஆகி இருக்கு.','गन कनेक्टेड है।'):choose(lang,'The gun is not connected.','கன் கனெக்ட் ஆகல.','गन कनेक्टेड नहीं है।'):null;
 case 'service':return typeof value==='boolean'?value?choose(lang,'The service is available.','சேவை கிடைக்குது.','सेवा उपलब्ध है।'):choose(lang,'The service is unavailable.','சேவை கிடைக்கல.','सेवा उपलब्ध नहीं है।'):null;
 case 'quality':return typeof value==='boolean'?value?choose(lang,'pass','தேர்ச்சி','पास'):choose(lang,'fail','தேர்ச்சி இல்ல','फेल'):askText(value)??askText(value?.overall)??askText(value?.status);
 case 'reason':return reason(value,row.page==='/yard-inspection'?s.live?.result?.decision:s.lot,lang);
 case 'stockReason':{const text=reason(value,s.lot,lang);if(!text)return null;return lang==='en'?text.replace(/\b[A-Z]{1,8}-\d+\b|\b(?:Cu|Cr|Ni|Mo|Sn|Fe|Si|Mn|C|P|S)\b|[A-Za-z]+/g,word=>/^[A-Z]{1,8}-\d+$/.test(word)||words[word]?word:word.toLowerCase()):text;}
 case 'blocking':return blocking(value,s,lang);
 case 'list':return askList(value,askText,lang);
 case 'grades':return askList(value,v=>askText(v)??askText(v?.grade)??askText(v?.metalGrade),lang);
 case 'charge':return askList(value,v=>charge(v,lang),lang);
 case 'additions':return askList(pairs(value),v=>addition(v,row),lang);
 case 'chemistry':return askList(pairs(value),v=>chemistry(v,row),lang);
 case 'pillars':return askList(value,v=>{const label=askText(v?.label)??askText(v?.key),score=askNumber(v?.score);return label&&score!==null?`${label} ${score}`:null;},lang);
 case 'drivers':return askList(value,v=>{const label=askText(v?.label),kwh=askDisplayNumber(v?.kwh);return label&&kwh!==null?`${label} ${kwh} kWh`:null;},lang);
 case 'alerts':return askList(value,v=>askText(v)??askText(v?.message)??askText(v?.text)??askText(v?.title),lang);
 case 'search':return askList(value,v=>askText(v?.title)??askText(v?.metadata?.title),lang);
 case 'movements':{
  if(!Array.isArray(value)||!value.length)return null;const v=value[0],signedKg=askNumber(v?.kg),kg=signedKg===null?null:String(Math.abs(Number(signedKg))),heat=askText(v?.heatId),by=askText(v?.by),time=askTime(v?.at,now,false,lang);if(kg===null||!heat||!time||lang==='en'&&!by)return null;
  if(Number(signedKg)>0)return choose(lang,`${kg} kg from ${heat} by ${by}, ${time}`,`${kg} கிலோ ${heat}-ல இருந்து வந்தது, ${time}`,`${kg} किलो ${heat} से, ${time}`);
  return choose(lang,`${kg} kg to ${heat} by ${by}, ${time}`,`${kg} கிலோ ${heat}-க்கு போச்சு, ${time}`,`${kg} किलो ${heat} को, ${time}`);
 }
 case 'compliance':{
  const count=askNumber(value?.within_spec??value?.within_range??value?.compliant),total=askNumber(value?.total??value?.total_elements);if(count===null||total===null)return askText(value);
  return choose(lang,`${count} of ${total} elements are within range.`,`${total}-ல ${count} element ரேஞ்சுக்குள்ள இருக்கு.`,`${total} में से ${count} तत्व सीमा में हैं।`);
 }
 case 'anomaly':{
  const severity=askEnum(value?.severity,'severity',lang),score=askDisplayNumber(value?.anomaly_score,{decimals:3});return severity&&score!==null?choose(lang,`The deviation severity is ${severity}, with score ${score}.`,`Deviation தீவிரம் ${severity}, ஸ்கோர் ${score}.`,`बदलाव की गंभीरता ${severity} है, स्कोर ${score} है।`):null;
 }
 case 'tap':return tap(value,lang,now);
 case 'meter':{
  const kwh=askNumber(value);if(kwh===null)return null;const simulated=['SIMULATED','METER_SIMULATED'].includes(s.energy?.actual?.source)||s.energy?.actual?.simulated===true;
  return simulated?choose(lang,`Simulated meter energy is ${kwh} kWh.`,`சிமுலேட் செய்த மீட்டர் Energy ${kwh} kWh.`,`सिमुलेटेड मीटर ऊर्जा ${kwh} kWh है।`):choose(lang,`Recorded meter energy is ${kwh} kWh.`,`பதிவான மீட்டர் Energy ${kwh} kWh.`,`दर्ज मीटर ऊर्जा ${kwh} kWh है।`);
 }
 default:return null;
 }
}
export function renderAskSentence(row,value,s,lang='en',now=new Date()){
 const formatted=formatAskValue(row,value,s,lang,now);if(formatted===null)return null;
 const values={value:formatted,heat:askText(s.heat?.heatId),item:askText(s.item?.label)??askText(s.item?.item),pr:askText(s.pr?.prId),lot:askText(s.lot?.lotId),grade:askText(s.grade?.grade),date:askTime(s.item?.stockOutAt,now,true,lang),planned:askNumber(s.live?.piecesPlanned),n:askNumber(s.live?.result?.evidence?.worst?.Cu?.pieceNo),sigma:askDisplayNumber(s.heat?.gateResult?.prediction?.sigma?.Cu,{decimals:row.sigmaDecimals,fixedDecimals:true}),status:(()=>{const text=askStatus(s.lot?.status,lang);return text&&lang==='en'?text[0].toUpperCase()+text.slice(1):text;})(),decision:decisionNoun(s.live?.result?.decision?.status??s.live?.result?.decision?.decision??s.live?.result?.decision,lang)};
 let missing=false;const sentence=(row[lang]??row.en).replace(/\{(\w+)\}/g,(_,key)=>{if(values[key]===null||values[key]===undefined){missing=true;return '';}return values[key];});
 return missing||!askText(sentence)?null:sentence;
}
