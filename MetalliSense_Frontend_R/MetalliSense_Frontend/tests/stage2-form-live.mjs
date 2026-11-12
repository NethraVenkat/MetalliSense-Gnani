import {selectFixtureAudioLabel,publicFixtureTranscript} from './stage2-fixtures.mjs';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const agent='http://127.0.0.1:5199',base='http://127.0.0.1:5200',out='../../.overnight_backup/v23-stage2';process.env.ROUND2_AGENT_URL=agent;
let server,browser;const results=[];
try{
 server=await createServer({configFile:'tests/real-app.vite.config.js',configLoader:'runner',mode:'mock',server:{host:'127.0.0.1',port:5200,strictPort:true}});await server.listen();
 for(let n=0;n<80;n++){try{if((await fetch(agent+'/__stage2/ready')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route('**/*',r=>[base,agent].some(url=>r.request().url().startsWith(url+'/'))?r.continue():r.abort());
 await page.addInitScript('window.stage2Pick='+selectFixtureAudioLabel.toString()+';');
 await page.addInitScript(({agent})=>{
  localStorage.setItem('metallisense.voice.language','en');localStorage.setItem('metallisense.voice.muted','false');localStorage.setItem('kural.handsfree','off');
  window.MediaRecorder=class{static isTypeSupported(){return true;}constructor(){this.mimeType='audio/wav';this.state='inactive';}start(){this.state='recording';window.startSource();}stop(){if(this.state==='inactive')return;this.state='inactive';const bytes=Uint8Array.from(atob(window.stage2Audio.command),c=>c.charCodeAt(0));this.ondataavailable?.({data:new Blob([bytes],{type:'audio/wav'})});this.onstop?.();}};
  window.audioLabels=[];window.activeMics=0;window.maxMics=0;window.consumed=[];window.startSource=()=>{const pending=window.pendingSource;if(pending&&!pending.started){pending.started=true;pending.source.start(pending.context.currentTime+.1);}};const originalInfo=console.info;console.info=(tag,details,...rest)=>{if(tag==='voice_action_capture'&&details?.stage==='reply_listen_start')window.startSource();originalInfo(tag,details,...rest);};
  navigator.mediaDevices.getUserMedia=async()=>{
   const prompt=document.querySelector('.kural-orb-label p')?.textContent||'';const label=window.stage2Pick(prompt,Boolean(document.querySelector('[aria-label="Private passcode"]')),window.audioLabels[0]);if(label===window.audioLabels[0])window.audioLabels.shift();window.lastCaptureLabel=label;window.consumed.push(label);
   const context=new AudioContext(),destination=context.createMediaStreamDestination();let source;
   if(label!=='silence'){
    const bytes=Uint8Array.from(atob(window.stage2Audio[label]),c=>c.charCodeAt(0));
    const buffer=await context.decodeAudioData(bytes.buffer);source=context.createBufferSource();source.buffer=buffer;source.connect(destination);window.pendingSource={source,context,label,duration:buffer.duration,started:false};
   }else{source=context.createOscillator();const gain=context.createGain();gain.gain.value=0;source.connect(gain);gain.connect(destination);source.start();}
   await context.resume();window.activeMics++;window.maxMics=Math.max(window.maxMics,window.activeMics);
   destination.stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);let done=false;track.stop=()=>{if(done)return;done=true;window.activeMics--;stop();try{source.stop();}catch{}void context.close();};});return destination.stream;
  };
 },{agent});
 let audit=[],transcripts=[],receipts=[];
 page.on('response',async response=>{
  const url=response.url();
  if(url.endsWith('/copilot/voice/audit')&&response.request().method()==='POST'&&response.ok()){
   const e=response.request().postDataJSON();audit.push({decision:e.decision,intent:e.intent,reason:e.reason_code});
  }
  if(url.endsWith('/copilot/voice/transcribe')&&!(response.request().headers()['x-voice-no-store']==='true')){
   try{const r=await response.json();const text=String(r.text||'');transcripts.push({text:publicFixtureTranscript(text),success:r.success});}catch{}
  }
  if(url.includes('/api/v2/premelt/lots')&&response.request().method()==='POST')try{receipts.push(await response.json());}catch{}
 });
 await page.goto(base+'/#/raw-material-stock');await page.waitForSelector('main');await page.waitForTimeout(1500);
 const fixture=await page.evaluate(async()=>{const m=await import('/src/services/premeltService.js');const response=await m.getLots();const data=response.data.data;return (Array.isArray(data)?data:data.lots).find(l=>l.lotId==='PIG-0901');});
 if(!fixture||fixture.receivedKg!==4000)throw Error('Expected loaded mock fixture missing');
 const cases=['receive truck','receive lot','receive the truck'];
 for(let trial=0;trial<3;trial++){
  if(trial){await page.reload();await page.waitForSelector('main');await page.waitForTimeout(1200);}
  await fetch(agent+'/__stage2/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cases[trial],material:fixture.materialType.replaceAll('_',' ').toLowerCase(),weight:trial===1?'four tonnes':'four thousand kilograms'})}).then(r=>{if(!r.ok)throw Error('Setup failed')});
  const audio=Object.fromEntries(await Promise.all(['command','material','weight','approval'].map(async label=>[label,Buffer.from(await (await fetch(agent+'/__stage2/audio/'+label)).arrayBuffer()).toString('base64')])));
  await page.evaluate(value=>{window.stage2Audio=value;},audio);
  audit=[];transcripts=[];receipts=[];
  await page.getByRole('button',{name:/Kural assistant/}).evaluate(node=>node.click());await page.locator('[data-wake-state=waiting]').waitFor();await page.getByRole('button',{name:/Kural assistant/}).evaluate(node=>node.click());await page.getByRole('switch',{name:'Hands-free',exact:true}).evaluate(node=>node.click());await page.locator('[data-wake-state=off]').waitFor();
  await page.evaluate(()=>{window.audioLabels=['command'];window.consumed=[];});
  const before=await page.evaluate(async()=>{const m=await import('/src/services/premeltService.js');return (await m.getLots()).data.data;});
  await page.getByRole('button',{name:'Hold to talk',exact:true}).evaluate(node=>node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1})));await page.waitForFunction(()=>window.pendingSource?.label==='command'&&window.pendingSource.started);const seconds=await page.evaluate(()=>window.pendingSource.duration);await page.waitForTimeout((seconds+.4)*1000);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1})));
  let timedOut=true;for(let i=0;i<480;i++){if(audit.length){timedOut=false;await page.waitForTimeout(150);break;}await page.waitForTimeout(250);}
  const snapshot=await page.evaluate(async()=>{const m=await import('/src/services/premeltService.js');return {lots:(await m.getLots()).data.data,maxMics:window.maxMics,consumed:window.consumed,card:document.querySelector('.kural-floating')?.innerText};});
  const count=v=>(Array.isArray(v)?v:v?.lots||[]).length;
  results.push({trial:trial+1,command:cases[trial],fixture:{material:fixture.materialType,receivedKg:fixture.receivedKg,supplier:fixture.supplier},timedOut,audit:[...audit],transcripts:[...transcripts],lotsBefore:count(before),lotsAfter:count(snapshot.lots),maxMics:snapshot.maxMics,consumed:snapshot.consumed,card:snapshot.card,passed:!timedOut&&count(snapshot.lots)===count(before)+1&&audit.some(e=>e.intent==='receive_lot'&&e.decision==='executed')});
  await writeFile(out+'/form-results.json',JSON.stringify(results,null,2));
  await page.screenshot({path:out+'/form-trial-'+(trial+1)+'.png'});
  if(!results.at(-1).passed)break;
 }
 await writeFile(out+'/form-provider.json',JSON.stringify(await (await fetch(agent+'/__stage2/results')).json(),null,2));console.log(JSON.stringify(results.map(r=>({trial:r.trial,passed:r.passed,audit:r.audit,consumed:r.consumed}))));
}finally{await browser?.close();if(server){server.httpServer?.closeAllConnections();await server.close();}}
