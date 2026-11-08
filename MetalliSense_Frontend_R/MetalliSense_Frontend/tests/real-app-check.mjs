// Real UI + isolated Agent smoke check. No secrets, audio, HAR or traces saved.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const agent=process.env.ROUND2_AGENT_URL||'http://127.0.0.1:5199';
const base='http://127.0.0.1:5200';
const server=spawn('npm.cmd',['run','dev:mock','--','--config','tests/real-app.vite.config.js','--port','5200','--strictPort'],{shell:true,windowsHide:true,stdio:'ignore',env:{...process.env,ROUND2_AGENT_URL:agent}});
const rows=[];let browser;
const add=(page,check,expected,result,reason)=>{rows.push([page,check,expected,result,reason]);console.log(`${page} | ${check} | ${result} | ${reason}`);};
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));}
 if(!(await (await fetch(agent+'/__test_voice/ready')).json()).mock)throw Error('Isolated mock Agent required');
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage();
 await page.route('**/*',route=>[base,agent].some(url=>route.request().url().startsWith(url+'/'))?route.continue():route.abort());
 await page.addInitScript(()=>{
  localStorage.setItem('metallisense.voice.muted','true');
  window.replyMode='speech';
  const info=console.info;
  console.info=(tag,details,...rest)=>{
   if(tag==='voice_action_capture'&&details?.stage==='reply_listen_start'&&window.testGain){
    const gain=window.testGain;gain.gain.value=window.replyMode==='silence'?0:.022;
    setTimeout(()=>gain.gain.value=0,1100);
   }
   info(tag,details,...rest);
  };
  navigator.mediaDevices.getUserMedia=async()=>{
   const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),dest=context.createMediaStreamDestination();
   osc.frequency.value=220;gain.gain.value=0;window.testGain=gain;
   osc.connect(gain);gain.connect(dest);osc.start();await context.resume();
   dest.stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{stop();void context.close();};});
   return dest.stream;
  };
 });
 let audits=[],transcribes=0;
 page.on('response',async response=>{
  const url=response.url();
  if(url===agent+'/copilot/voice/transcribe')transcribes++;
  if(url===agent+'/copilot/voice/audit'&&response.request().method()==='POST'){
   // A completed audit response can be followed immediately by reload. Read
   // only public decision fields from the accepted request, not a body that
   // Chromium may discard when its document unloads.
   if(response.ok()){const event=response.request().postDataJSON();if(event)audits.push({decision:event.decision,reason:event.reason_code,intent:event.intent,page:event.page});}
  }
 });
 await page.goto(base);await page.waitForSelector('main');
 const routes=await page.evaluate(()=>new Function('return import("/src/services/voicePages.js").then(m=>m.voicePages.map(p=>p.route))')());
 async function command(text,replies=[],silence=false){
  await fetch(agent+'/__test_voice/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replies})});
  await page.evaluate(value=>{window.replyMode=value?'silence':'speech';},silence);
  audits=[];transcribes=0;
  await page.locator('[aria-label="Kural microphone controls"]').evaluate(node=>node.click());
  const details=page.locator('details').filter({has:page.getByText('Demo transcripts',{exact:true})});
  if(!await details.evaluate(node=>node.open))await page.getByText('Demo transcripts',{exact:true}).click();
  await page.getByLabel('Demo voice command').fill(text);
  await page.getByRole('button',{name:'Run demo command',exact:true}).click();
  for(let i=0;i<150;i++){if(audits.length)return {...audits.at(-1),transcribes};await page.waitForTimeout(200);}
  return {decision:'missing',reason:'no_audit',transcribes};
 }
 const only=process.env.ROUND2_CHECK_PAGE;
 const debug=method=>page.evaluate(method=>new Function('method','return import("/src/services/voiceActionApi.js").then(m=>m.voiceActionApi[method]())')(method),method);
 if(process.env.ROUND2_WORKFLOW_PAGE){
  const destination=process.env.ROUND2_WORKFLOW_PAGE;
  const visit=async route=>{await page.goto(base+'/#'+route);await page.waitForSelector('main');await page.waitForTimeout(2000);};
  const run=async(route,phrase,replies=[],safe=false)=>{
   if(process.env.ROUND2_WORKFLOW_PRIVATE==='true'&&replies.some(reply=>reply.startsWith('@right:'))){
    for(const [label,attempts,decision,reason] of [
     ['non-digit retry',['@word','@word'],'refused','code_not_digits'],
     ['wrong role',['@right:Operator'],'refused','wrong_role'],
     ['three wrong credentials',['@wrong','@wrong','@wrong'],'locked','locked'],
    ]){
     await debug('resetLock');const attempt=await command(phrase,attempts),state=await debug('debugState');
     const passed=attempt.decision===decision&&attempt.reason===reason&&attempt.transcribes===attempts.length&&(reason!=='code_not_digits'||state.failure_count===0)&&(reason!=='locked'||state.locked);
     add(route,'workflow private '+label,'refusal without mutation',passed?'PASS':'FAIL',attempt.reason);
     if(!passed)throw Error('Workflow private check failed: '+attempt.reason);
    }
    const reset=await debug('resetLock');add(route,'workflow reset','unlocked',!reset.locked&&reset.failure_count===0?'PASS':'FAIL','executed');
    replies=['@wrong',...replies];
   }
   const result=await command(phrase,replies,safe),ok=result.decision==='executed'&&result.transcribes===replies.length;
   add(route,(process.env.ROUND2_WORKFLOW_PRIVATE==='true'&&replies.length?'workflow retry ':'workflow ')+phrase,'executed with exact reply count',ok?'PASS':'FAIL',result.reason);
   if(!ok)throw Error('Workflow step refused: '+result.reason);
  };
  await visit('/premelt-gate');await run('/premelt-gate','select H-1051');
  await run('/premelt-gate','run gate check H-1051',[],true);
  await page.waitForTimeout(1000);
  await run('/premelt-gate','start melting H-1051',['@right:Supervisor']);
  if(destination==='/rl-optimizer'){
   await visit('/anomaly');await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('metallisense.meltFlow.v1')||'{}').anomalyResult,{},{timeout:10000});
   await visit('/recommendation');await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('metallisense.meltFlow.v1')||'{}').alloyResult,{},{timeout:10000});
   await visit(destination);await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('metallisense.meltFlow.v1')||'{}').rlResult,{},{timeout:10000});
   await run(destination,'accept balanced',['@right:Supervisor']);
  }else{
   await visit('/full-analysis');await run('/full-analysis','run full analysis',[],true);
   await run('/full-analysis','accept balanced',['@right:Supervisor']);
   await visit('/mechanical-properties');await run('/mechanical-properties','predict',[],true);
   await run('/mechanical-properties','approve tap H-1051',['@right:Supervisor']);
   await visit('/sales');await run('/sales','issue invoice H-1051 customer C-001 10 kg at 50',['@right:Manager']);
  }
 }
 const nativeCases={
  '/premelt-gate':{phrase:'plan heat SG-IRON 100 kg',role:'Supervisor'},
  '/raw-material-stock':{phrase:'receive truck steel scrap 100 kg',role:'Supervisor'},
  '/yard-inspection':{phrase:'replace argon',role:'Supervisor'},
  '/inventory-forecast':{phrase:'create pr 100 kg',fields:['STEEL_SCRAP'],role:'Supervisor'},
  '/grades':{phrase:'edit grade spec SG-IRON',fields:['description','Round two mock review'],role:'Manager'},
  '/cost-analysis':{phrase:'edit prices',fields:['element','C','1'],role:'Manager'},
  '/supplier-scorecard':{phrase:'apply ahp weights',fields:Array(6).fill('1'),role:'Manager'},
  '/anomaly':{phrase:'clear chat history',role:'Supervisor',word:'CLEAR'},
  '/recommendation':{phrase:'clear chat history',role:'Supervisor',word:'CLEAR'},
  '/training-data':{phrase:'edit training sample',fields:['severity','none'],role:'Supervisor',rowTarget:true},
 };
 for(const route of routes.filter(route=>!process.env.ROUND2_WORKFLOW_PAGE&&(!only||only.split(',').includes(route)))){
  await page.goto(base+'/#'+route);await page.waitForSelector('main');
  await page.waitForTimeout(700);
  if(process.env.ROUND2_SAFE_MATRIX==='true'){
   const cases={
    '/premelt-gate':['run gate check'],
    '/supplier-scorecard':['plan 10 tonnes of STEEL_SCRAP'],
    '/semantic-search':['search carbon'],
    '/anomaly':['run analysis','Generate'],
    '/recommendation':['generate plan','Generate & Get Recommendations'],
    '/full-analysis':['run full analysis','Generate Reading'],
    '/mechanical-properties':['predict','Generate Reading for Mechanical Check'],
    '/agent':['run analysis','Generate & Run AI Agent Analysis'],
   };
   const entry=cases[route];if(!entry){add(route,'safe action','no safe registered action with loaded prerequisites','N/A','no_target');continue;}
   await page.waitForTimeout(2500);
   try{
    if(entry[1]){
     const connect=page.getByRole('button',{name:'Connect',exact:true});if(await connect.count())await connect.first().click();
     const grade=page.locator('main select').filter({has:page.locator('option').filter({hasText:'Choose grade...'})}).first();
     await grade.selectOption({index:1});await page.locator('main').getByRole('button',{name:'C',exact:true}).first().click();
     const generate=page.locator('main button').filter({hasText:entry[1]}).first();await generate.click();await page.waitForTimeout(3000);
    }
    const result=await command(entry[0],[],true);
    add(route,'safe action '+entry[0],'executed without yes/no',result.decision==='executed'&&result.transcribes===0?'PASS':'FAIL',result.reason);
    if(result.decision!=='executed')console.log('safe diagnostic',(await page.locator('.kural-orb-label').innerText()).replace(/\p{Nd}/gu,'*'));
   }catch(error){add(route,'safe action '+entry[0],'executed without yes/no','FAIL',error.name);console.log('safe setup diagnostic',String(error.message).replace(/\p{Nd}/gu,'*').slice(0,700));}
   continue;
  }
  if(process.env.ROUND2_CONTROL_MATRIX==='true'){
   await page.waitForTimeout(1800);
   for(const phrase of ['what can i ask here','இங்க என்ன கேக்கலாம்','यहाँ क्या पूछ सकते हैं','scroll down','மேலே நகர்த்து','नीचे स्क्रॉल करो']){
    const result=await command(phrase);add(route,'ASK/control '+phrase,'executed',result.decision==='executed'?'PASS':'FAIL',result.reason);
   }
   const ids=await page.locator('main [data-voice-row-id]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.voiceRowId))]);
   if(ids.length){
    for(const phrase of ['select '+ids[0],'தேர்ந்தெடு '+ids[0],'चुनो '+ids[0],'read this row']){
     const result=await command(phrase);add(route,'row control '+phrase,'executed',result.decision==='executed'?'PASS':'FAIL',result.reason);
     const close=page.locator('main button:visible,[role=dialog] button:visible').filter({has:page.locator('svg.lucide-x')});if(await close.count())await close.first().click();
    }
   }else add(route,'row controls','no loaded rows','N/A','no_target');
   // Navigation and reload are exercised through the actual transcript path.
   const destination=route==='/dashboard'?'/energy':'/dashboard';
   let result=await command('go to '+destination.slice(1));
   add(route,'navigate','destination opened',page.url().endsWith('#'+destination)&&result.reason==='nav_matched'?'PASS':'FAIL',result.reason);
   result=await command('go back');await page.waitForURL('**/#'+route);
   add(route,'go back','original page restored',result.reason==='nav_matched'?'PASS':'FAIL',result.reason);
   await page.waitForTimeout(500);
   const reload=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:3000}).catch(()=>null);
   result=await command('refresh');await reload;await page.waitForSelector('main');
   add(route,'refresh','executed and audited',result.decision==='executed'?'PASS':'FAIL',result.reason);
   continue;
  }
  if(process.env.ROUND2_NATIVE_MATRIX==='true'){
   const native=nativeCases[route];
   if(!native){add(route,'native APPROVE matrix','requires route-specific setup','PENDING','no_target');continue;}
   await page.waitForTimeout(2500);
   let phrase=native.phrase;
   if(native.rowTarget){await page.waitForSelector('main tr[data-voice-row-id]');phrase+=' '+await page.locator('main tr[data-voice-row-id]').first().getAttribute('data-voice-row-id');}
   for(const [name,privateReplies,decision,reason] of [
    ['right credential',['@right:'+native.role],'executed','executed'],
    ['non-digit retry',['@word','@word'],'refused','code_not_digits'],
    ['wrong credential then retry',['@wrong','@right:'+native.role],'executed','executed'],
    ['three wrong credentials',['@wrong','@wrong','@wrong'],'locked','locked'],
   ]){
    await debug('resetLock');
    const fields=route==='/inventory-forecast'&&name==='wrong credential then retry'?['CI_SCRAP']:native.fields||[];
    const replies=[...fields,...privateReplies,...(decision==='executed'&&native.word?[native.word]:[])];
    const result=await command(phrase,replies),state=await debug('debugState');
    const ok=result.decision===decision&&result.reason===reason&&result.transcribes===replies.length&&(reason!=='code_not_digits'||state.failure_count===0)&&(reason!=='locked'||state.locked);
    add(route,'native APPROVE '+name,decision,ok?'PASS':'FAIL',result.reason);
    if(!ok){await page.waitForTimeout(100);console.log('native approval diagnostic',result.intent,(await page.locator('.kural-orb-label').innerText()).replace(/\p{Nd}/gu,'*'));}
    await page.waitForTimeout(1000);
   }
   const reset=await debug('resetLock');add(route,'native reset approval lock','unlocked; zero failures',!reset.locked&&reset.failure_count===0?'PASS':'FAIL','executed');
   continue;
  }
  try{
   let result=await command('what can i ask here');add(route,'ASK','answered and audited',result.decision==='executed'?'PASS':'FAIL',result.reason);
   result=await command('scroll down');add(route,'page control','executed',result.decision==='executed'?'PASS':'FAIL',result.reason);
   const firstRow=page.locator('main [data-voice-row-id]').first();
   const rowId=await firstRow.count()?await firstRow.getAttribute('data-voice-row-id'):null;
   if(rowId){result=await command('select '+rowId);add(route,'select loaded row','selected',result.decision==='executed'?'PASS':'FAIL',result.reason);}
   else add(route,'select loaded row','no loaded rows','N/A','no_target');
   for(const [reply,decision] of [['yes','executed'],['no','cancelled'],['silence','timeout']]){
    result=await command('test action',reply==='silence'?[]:[reply],reply==='silence');
    const ok=result.decision===decision&&result.transcribes===(reply==='silence'?0:1);
    add(route,'RUN voice '+reply,decision+'; one STT per spoken reply',ok?'PASS':'FAIL',result.reason);
   }
  }catch(error){add(route,'UI check','completed','FAIL',error.name);}
 }
 if(!process.env.ROUND2_WORKFLOW_PAGE&&process.env.ROUND2_NATIVE_MATRIX!=='true'&&process.env.ROUND2_CONTROL_MATRIX!=='true'&&process.env.ROUND2_SAFE_MATRIX!=='true'&&(!only||only==='/spectrometer')){
  const route='/spectrometer';await page.goto(base+'/#'+route);await page.waitForSelector('main');await page.waitForTimeout(3500);
  await debug('resetLock');
  for(const [name,replies,expected] of [
   ...Array.from({length:process.env.ROUND2_APPROVAL_STRESS==='true'?8:1},(_,index)=>[index?'right credential repeat '+index:'right credential',['@right:Supervisor'],'executed']),
   ['non-digit retry',['@word','@word'],'refused'],
   ['wrong credential then retry',['@wrong','@right:Supervisor'],'executed'],
   ['three wrong credentials',['@wrong','@wrong','@wrong'],'locked'],
  ]){
   await debug('resetLock');await page.waitForTimeout(3500);
   const connected=await page.getByText('Status: Connected',{exact:true}).count();
   const result=await command(connected?'disconnect spectrometer':'connect spectrometer',replies);
   const state=await debug('debugState');
   const expectedReason=name==='non-digit retry'?'code_not_digits':expected==='locked'?'locked':'executed';
   const valid=result.decision===expected&&result.reason===expectedReason&&result.transcribes===replies.length&&(name!=='non-digit retry'||state.failure_count===0)&&(name!=='three wrong credentials'||state.locked);
   add(route,'APPROVE '+name,expected,valid?'PASS':'FAIL',result.reason);
   if(!valid){
    await page.waitForTimeout(100);
    const note=await page.locator('.kural-orb-label').innerText();
    const known=['already in that connection state','connection status is not loaded','Approval expired','screen-only','Page changed','Backend action failed','Network Error','Request failed with status code'];
    // This is the displayed error, never the captured reply; remove all digits.
    console.log('approval diagnostic',result.intent,result.decision,known.find(value=>note.includes(value))||note.replace(/\p{Nd}/gu,'*'));
   }
  }
  const reset=await debug('resetLock');add(route,'reset approval lock','unlocked; zero failures',!reset.locked&&reset.failure_count===0?'PASS':'FAIL','executed');
  await page.waitForTimeout(3500);
  if(!await page.getByText('Status: Connected',{exact:true}).count()){
   const connection=await command('connect spectrometer',['@right:Supervisor']);
   add(route,'safe-action connection setup','executed',connection.decision==='executed'?'PASS':'FAIL',connection.reason);
  }
  await page.getByText('Status: Connected',{exact:true}).waitFor({timeout:10000});
  const safe=await command('request reading',[],true);add(route,'safe request reading','executed without yes/no',safe.decision==='executed'?'PASS':'FAIL',safe.reason);
  if(safe.decision!=='executed'){
   const note=await page.locator('.kural-orb-label').innerText();
   console.log('safe failure category',/not connected/i.test(note)?'disconnected':/scope|changed|stale/i.test(note)?'scope_changed':/microphone/i.test(note)?'microphone':/audit/i.test(note)?'audit':'other');
  }
 }
}finally{
 await browser?.close();
 if(server.pid)await new Promise(resolve=>spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
 if(process.env.ROUND2_WORKFLOW_PAGE||process.env.ROUND2_CHECK_PAGE||process.env.ROUND2_CONTROL_MATRIX==='true'||process.env.ROUND2_SAFE_MATRIX==='true'||process.env.ROUND2_NATIVE_MATRIX==='true'){try{const old=await readFile('../../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/REAL_APP_CHECK_REPORT.md','utf8');const previous=old.split('\n').filter(line=>line.startsWith('| /')).map(line=>line.split('|').slice(1,-1).map(value=>value.trim()));for(const row of previous)if(!rows.some(next=>next[0]===row[0]&&next[1]===row[1]))rows.push(row);}catch{}}
 const report='# Round 2 real-app check\n\nReal dev:mock UI, isolated mock Agent, Chromium synthetic microphone. Initial commands use the development transcript control; replies use real browser capture and the Agent transcription endpoint. TTS is muted in this check; TTS completion ordering is covered by the unit tests. RUN uses the registered test action (no plant effect). No live plant services are called.\n\n| Page | Check | Expected | Result | reason_code |\n|---|---|---|---|---|\n'+rows.map(row=>'| '+row.join(' | ')+' |').join('\n')+'\n\nCoverage: each row records the scenario actually exercised. Private approval matrices cover the routes listed below; absent scenarios are not implied to pass. Routes without loaded rows are explicitly N/A. Synthetic audio and muted TTS do not replace a human live microphone check.\n';
 await writeFile('../../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/REAL_APP_CHECK_REPORT.md',report);
}
if(rows.some(row=>row[3]==='FAIL'))process.exitCode=1;
