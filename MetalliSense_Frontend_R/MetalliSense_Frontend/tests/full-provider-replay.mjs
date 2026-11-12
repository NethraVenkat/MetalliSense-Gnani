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
 const evidence=JSON.parse(await readFile(new URL('../../../MetalliSense_Agent_R/MetalliSense_Agent/tools/local_wake_data/stage4-final-smoke/results.json',import.meta.url),'utf8'));
 for(const item of evidence.results.filter(r=>['latest','Tamil question','HOLD refusal'].includes(r.check))){
  await page.goto(base+item.page);await page.waitForSelector('main');await page.waitForTimeout(1200);if(item.page==='/spectrometer')await page.getByText('Status: Connected',{exact:true}).waitFor();
  const result=await command(item.transcript,[],true);const expected=item.check==='HOLD refusal'?'refused':'executed';
  add(item.page,'saved real Prisma '+item.check,expected,result.decision===expected&&result.reason!=='no_match'?'PASS':'FAIL',result.intent+'; '+result.reason);
 }
}finally{await browser?.close();await writeFile(new URL('../../../.overnight_backup/stage4/real-provider-routing.json',import.meta.url),JSON.stringify({mode:'full',savedRealTranscripts:true,newProviderCalls:0,rows},null,2));}
