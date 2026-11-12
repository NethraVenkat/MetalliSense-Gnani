// Full-mode UI + four real services, isolated GNANI_MOCK Agent. No production audit stores.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const agent=process.env.ROUND2_AGENT_URL||'http://127.0.0.1:8001';
const base=process.env.STAGE4_FRONTEND_URL||'http://127.0.0.1:5173';
const backend=process.env.STAGE4_BACKEND_URL||'http://127.0.0.1:3000';
const rows=[];let browser;
const resultFile=process.env.STAGE4_RESULT_FILE||new URL('../../../.overnight_backup/stage4/full-voice.json',import.meta.url);
const add=(page,check,expected,result,reason)=>{rows.push([page,check,expected,result,reason]);console.log(`${page} | ${check} | ${result} | ${reason}`);};
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));}
 if(!(await (await fetch(agent+'/__test_voice/ready')).json()).mock)throw Error('Isolated mock Agent required');
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage();
 await page.route('**/*',route=>[base,backend,agent].some(url=>route.request().url().startsWith(url+'/'))?route.continue():route.abort());
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
 const routes=await page.evaluate(()=>new Function('return import("/src/services/voicePages.js").then(m=>m.voicePages.map(p=>p.route).filter(r=>r!=="/charge-optimizer"))')());
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
 const cases=[
 ['/spectrometer','what is the latest reading',[],'executed'],
 ['/spectrometer','oru reading edu',[],'executed'],
 ['/spectrometer','reading लो',[],'executed'],
 ['/premelt-gate','H-1053 status enna?',[],'executed'],
 ['/premelt-gate','start melting H-1053',[],'refused'],
 ['/dashboard','stock page ku po',[],'executed'],
 ['/dashboard','spectrometer open pannu',[],'executed'],
 ['/dashboard','morning briefing',[],'executed'],
 ['/raw-material-stock','receive truck',['STEEL_SCRAP','100','@right:Supervisor'],'executed'],
 ['/raw-material-stock','truck receive करो',['STEEL_SCRAP','100','@right:Supervisor'],'executed'],
 ];
 // Prerequisites mirror the reported live flow: actually connect and obtain
 // one instrument reading, and run the demo HOLD check before asking status.
 for(const path of ['/api/v1/spectrometer/opc-connect','/api/v1/spectrometer/opc-reading','/api/v2/premelt/heats/H-1053/gate-check']){
  const response=await fetch(backend+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({by:'TEST Stage4'})});if(!response.ok)throw Error('Fixture prerequisite refused: '+path);
 }
 for(const [route,phrase,replies,expected] of cases){
  await page.goto(base+route);await page.waitForSelector('main');await page.waitForTimeout(900);
  if(route==='/spectrometer')await page.getByText('Status: Connected',{exact:true}).waitFor({timeout:10000});
  await debug('resetLock');const r=await command(phrase,replies,replies.length===0);
  add(route,'phrase '+phrase,expected,r.decision===expected&&r.reason!=='no_match'?'PASS':'FAIL',r.reason);
 }
 // Additional disposable workflow checks; no production heat is overridden.
 const seed=(await (await fetch(backend+'/api/v2/premelt/heats/H-1053')).json()).data;
 let created=await fetch(backend+'/api/v2/premelt/heats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade:seed.grade,targetKg:400,charge:seed.charge.map(line=>({...line,kg:line.kg*400/seed.targetKg})),plannedBy:'TEST disposable HOLD'})});
 const disposable=(await created.json()).data;
 await page.goto(base+'/premelt-gate');await page.waitForSelector('main');await page.waitForTimeout(700);
 let r=await command('select '+disposable.heatId);add('/premelt-gate','select disposable HOLD heat','executed',r.decision==='executed'?'PASS':'FAIL',r.reason);
 r=await command('run gate check '+disposable.heatId,[],true);add('/premelt-gate','disposable HOLD gate check','executed',r.decision==='executed'?'PASS':'FAIL',r.reason);
 r=await command('hold override start '+disposable.heatId,['Controlled disposable diagnostic override only','@right:Unit Controller','OVERRIDE']);add('/premelt-gate','Unit Controller disposable override','executed',r.decision==='executed'?'PASS':'FAIL',r.reason);
 const original=(await (await fetch(backend+'/api/v2/premelt/heats/H-1053')).json()).data;
 add('/premelt-gate','normal H-1053 remains PLANNED HOLD','unchanged',original.status==='PLANNED'&&original.gateResult?.decision==='HOLD'?'PASS':'FAIL',original.status);
 await page.goto(base+'/spectrometer');await page.waitForSelector('main');await page.waitForTimeout(700);
 await page.getByText('Status: Connected',{exact:true}).waitFor({timeout:10000});
 const cancelling=command('oru reading edu',[],true);
 await page.locator('.voice-action-panel button').first().waitFor();await page.locator('.voice-action-panel button').first().click();r=await cancelling;
 add('/spectrometer','two-second safe action cancel','cancelled',r.decision==='cancelled'?'PASS':'FAIL',r.reason);
 await page.locator('[aria-label="Kural microphone controls"]').evaluate(node=>node.click());
 await page.getByRole('button',{name:'Voice log',exact:true}).click();
 const log=page.getByRole('dialog',{name:'Voice log',exact:true});await log.waitFor();
 await log.getByRole('button',{name:'Verify chain',exact:true}).click();await page.getByText(/Chain OK/).waitFor();
 const download=page.waitForEvent('download');await log.getByRole('button',{name:'Export test log',exact:true}).click();const exported=await download;
 add('/voice-log','viewer, chain verification and export','valid grouped audit and export',!!exported.suggestedFilename()?'PASS':'FAIL',await log.locator('[role=status]').innerText());
}finally{
 await browser?.close();
 await writeFile(new URL('../../../.overnight_backup/stage4/voice-phrases.json',import.meta.url),JSON.stringify({mode:'full',mockGnani:true,rows},null,2));
}
if(rows.some(r=>r[3]==='FAIL'))process.exitCode=1;
