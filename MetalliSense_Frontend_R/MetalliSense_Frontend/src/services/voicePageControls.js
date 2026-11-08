import {normalizeCommandText} from './voiceCommandText';
import {pageVoiceIntent} from './voicePages';

export const pageControlRegistry=[
 {id:'go_back',phrases:{en:['go back'],ta:['பின்னால் போ'],hi:['वापस जाओ']}},
 {id:'next_row',phrases:{en:['next row'],ta:['அடுத்த வரிசை'],hi:['अगली पंक्ति']}},
 {id:'previous_row',phrases:{en:['previous row'],ta:['முந்தைய வரிசை'],hi:['पिछली पंक्ति']}},
 {id:'scroll_down',phrases:{en:['scroll down'],ta:['கீழே நகர்த்து'],hi:['नीचे स्क्रॉल करो']}},
 {id:'scroll_up',phrases:{en:['scroll up'],ta:['மேலே நகர்த்து'],hi:['ऊपर स्क्रॉल करो']}},
 {id:'refresh',phrases:{en:['refresh'],ta:['புதுப்பி'],hi:['रीफ्रेश करो']}},
 {id:'read_row',phrases:{en:['read this row'],ta:['இந்த வரிசையை படி'],hi:['यह पंक्ति पढ़ो']}},
 {id:'select_row',phrases:{en:['select','open'],ta:['தேர்ந்தெடு','திற'],hi:['चुनो','खोलो']},argument:true},
 {id:'open_tab',phrases:{en:['open tab'],ta:['தாவல் திற'],hi:['टैब खोलो']},argument:true},
].map(row=>({...row,level:'ASK'}));
export function matchPageControl(text){
 const normalized=normalizeCommandText(text);
 const navigation=pageVoiceIntent(text);if(navigation?.intent==='open_screen')return {id:'navigate',route:navigation.params.route};
 for(const row of [...pageControlRegistry].sort((a,b)=>Number(b.id==='open_tab')-Number(a.id==='open_tab'))){
  for(const phrase of Object.values(row.phrases).flat()){
   if(normalized===phrase&&!row.argument)return {id:row.id};
   if(row.argument&&normalized.startsWith(phrase+' '))return {id:row.id,target:normalized.slice(phrase.length+1)};
   if(row.argument&&normalized.endsWith(' '+phrase))return {id:row.id,target:normalized.slice(0,-phrase.length-1)};
  }
 }
 return null;
}
const key=value=>normalizeCommandText(value).replace(/[\s_-]/g,'');
const visible=node=>Boolean(node&&node.getClientRects().length&&!node.closest('[hidden],[aria-hidden="true"]'));
export function loadedControlRows(context){
 const data=context?.loaded||{},groups=[['heatId',data.heats],['prId',data.prs],['lotId',data.lots],['grade',data.grades],['readingId',data.readings],['supplier',data.data?.suppliers],['invoiceId',data.invoices],['sampleId',data.trainingData]];
 return groups.flatMap(([field,rows])=>(rows||[]).map(row=>({field,id:row[field]||row._id||row.supplierId||row.name,row})).filter(row=>row.id));
}
export function createPageControls({getContext,navigate,select,document:doc=globalThis.document}){
 const main=()=>doc?.querySelector('main');
 const marked=()=>{
  const nodes=[...(main()?.querySelectorAll('[data-voice-row-id]')||[])].filter(n=>n.tagName==='OPTION'?visible(n.parentElement):visible(n));
  const rank=node=>node.tagName==='TR'?3:node.tagName==='OPTION'?2:1;
  const rows=new Map();
  for(const node of nodes.sort((a,b)=>rank(b)-rank(a))){const id=(node.dataset.voiceRowKey||'rowId')+':'+key(node.dataset.voiceRowId);if(!rows.has(id))rows.set(id,node);}
  return [...rows.values()];
 };
 const locate=target=>marked().filter(node=>key(node.dataset.voiceRowId)===key(target));
 function choose(node){
  if(!node)return false;
  if(node.tagName==='OPTION'){
   const input=node.parentElement;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,node.value);input.dispatchEvent(new Event('change',{bubbles:true}));select({[node.dataset.voiceRowKey]:node.dataset.voiceRowId});return true;
  }
  // Only explicit row/view handlers are clicked. Never choose an arbitrary action button.
  const view=node.querySelector('[data-voice-open],button[title="View"],button[title="View Details"],button[aria-label="View details"]')||[...node.querySelectorAll('button[data-voice-row-id]')].find(button=>key(button.dataset.voiceRowId)===key(node.dataset.voiceRowId));
  if(view&&!view.disabled)view.click();else node.click();
  const option=[...(main()?.querySelectorAll('option[data-voice-row-id]')||[])].find(option=>option.dataset.voiceRowKey===node.dataset.voiceRowKey&&key(option.dataset.voiceRowId)===key(node.dataset.voiceRowId)&&visible(option.parentElement));
  if(option){const input=option.parentElement;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,option.value);input.dispatchEvent(new Event('change',{bubbles:true}));}
  select({[node.dataset.voiceRowKey||'rowId']:node.dataset.voiceRowId});
  node.scrollIntoView({block:'nearest'});node.focus?.({preventScroll:true});return true;
 }
 return async command=>{
  const context=getContext(),lang=command.lang||'en';
  const say=(en,ta,hi)=>({ok:true,text:{en,ta,hi}[lang]||en,reason_code:'executed'});
  const unavailable=()=>({ok:false,reason_code:'no_target',text:{en:'That row or control is not available on this page.',ta:'அந்த வரிசை அல்லது கட்டுப்பாடு இந்தப் பக்கத்தில் இல்லை.',hi:'वह पंक्ति या नियंत्रण इस पेज पर उपलब्ध नहीं है।'}[lang]});
  if(command.id==='navigate'){if(command.route!==context.route)navigate(command.route);return {...say('Page opened.','பக்கம் திறக்கப்பட்டது.','पेज खुल गया।'),reason_code:'nav_matched'};}
  if(command.id==='go_back'){navigate(-1);return {...say('Going back.','பின்னால் செல்கிறேன்.','वापस जा रहा हूँ।'),reason_code:'nav_matched'};}
  if(command.id==='scroll_down'||command.id==='scroll_up'){main()?.scrollBy({top:(command.id==='scroll_down'?1:-1)*Math.max(200,main()?.clientHeight*.7||400),behavior:'smooth'});return say('Scrolled.','நகர்த்தப்பட்டது.','स्क्रॉल किया।');}
  if(command.id==='refresh'){
   const button=[...(main()?.querySelectorAll('button')||[])].find(n=>visible(n)&&!n.disabled&&/^(refresh|reload)$/i.test(n.textContent.trim()));
   if(button)button.click();else if(context.refresh)await context.refresh();else return {...say('Refreshed.','புதுப்பிக்கப்பட்டது.','रीफ़्रेश किया।'),afterReply:()=>navigate(0)};
   return say('Refreshed.','புதுப்பிக்கப்பட்டது.','रीफ्रेश किया।');
  }
  if(command.id==='open_tab'){
   const aliases={invoice:['invoice','tax invoice','விலைப்பட்டியல்','चालान'],certificate:['certificate','test certificate','சான்றிதழ்','प्रमाणपत्र']};
   const target=Object.entries(aliases).find(([,names])=>names.some(name=>key(name)===key(command.target)))?.[0]||command.target;
   const tabs=[...(doc?.querySelectorAll('[role="tab"],[data-voice-tab]')||[])].filter(n=>visible(n)&&!n.disabled&&key(n.dataset.voiceTab||n.textContent)===key(target));
   if(tabs.length!==1)return unavailable();tabs[0].click();return say('Tab opened.','தாவல் திறக்கப்பட்டது.','टैब खुल गया।');
  }
  if(command.id==='select_row'){
   const matches=locate(command.target);if(matches.length!==1)return unavailable();choose(matches[0]);return say(`Selected ${matches[0].dataset.voiceRowId}.`,`${matches[0].dataset.voiceRowId} தேர்ந்தெடுக்கப்பட்டது.`,`${matches[0].dataset.voiceRowId} चुना गया।`);
  }
  const selection=context.focusedRow||context.selected||{},fields=Object.keys(selection).filter(field=>selection[field]);
  const allRows=marked(),focusedField=fields.find(field=>allRows.some(node=>node.dataset.voiceRowKey===field&&key(node.dataset.voiceRowId)===key(selection[field])));
  const rows=focusedField?allRows.filter(node=>node.dataset.voiceRowKey===focusedField):allRows;
  const index=rows.findIndex(node=>key(selection[node.dataset.voiceRowKey])===key(node.dataset.voiceRowId));
  if(command.id==='read_row'){if(index<0)return unavailable();return say(rows[index].innerText,rows[index].innerText,rows[index].innerText);}
  if(command.id==='next_row'||command.id==='previous_row'){
   const next=index<0?(command.id==='next_row'?0:rows.length-1):index+(command.id==='next_row'?1:-1);if(next<0||next>=rows.length)return unavailable();choose(rows[next]);return say(`Selected ${rows[next].dataset.voiceRowId}.`,`${rows[next].dataset.voiceRowId} தேர்ந்தெடுக்கப்பட்டது.`,`${rows[next].dataset.voiceRowId} चुना गया।`);
  }
  return unavailable();
 };
}

// Mark existing visible rows from loaded IDs. Clicks and voice share selection.
export function markVoiceRows(context,doc=globalThis.document){
 const main=doc?.querySelector('main');if(!main)return;
 const rows=loadedControlRows(context);
 for(const node of main.querySelectorAll('tbody tr,[data-voice-row],select option,[role="button"],button')){
  if(node.closest('.kural-floating,[aria-label="Shop floor voice"]'))continue;
  if(node.tagName==='BUTTON'&&!/^[A-Za-z]+[- ]?\d+\b/.test(node.textContent.trim()))continue;
  if(node.dataset.voiceRowId){
   const match=(node.dataset.voiceRecordId&&rows.find(row=>row.row._id===node.dataset.voiceRecordId))||rows.find(row=>key(row.id)===key(node.dataset.voiceRowId));
   if(match){node.dataset.voiceRowKey=match.field;node.dataset.voiceRowId=match.id;}
   continue;
  }
  const text=key(node.textContent),matches=rows.filter(row=>{
   const id=key(row.id);
   if(node.tagName==='OPTION')return key(node.value)===id;
   if(node.tagName==='TR')return [...node.querySelectorAll('td')].some(cell=>key(cell.textContent)===id);
   return text===id||node.textContent.trim().toLowerCase().startsWith(String(row.id).toLowerCase()+' ');
  });
  if(matches.length===1){node.dataset.voiceRowId=matches[0].id;node.dataset.voiceRowKey=matches[0].field;node.tabIndex=0;}
 }
}
