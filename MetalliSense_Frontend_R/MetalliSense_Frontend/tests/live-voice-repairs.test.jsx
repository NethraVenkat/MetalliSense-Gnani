import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {loadedPageAnswer,oneEditSG,loadedUnavailable} from '../src/services/loadedVoiceAnswers';
import {isMorningBriefing} from '../src/services/morningBriefing';
import KuralWakePanel from '../src/components/voice/KuralWakePanel';
afterEach(()=>vi.unstubAllEnvs());
const context=(route,loaded)=>({route,scope:'current',loaded,isCurrent:()=>true});
for(const lang of ['ta','hi','en'])it(`real STT aliases use the identical shared answer path for PTT/remainder/full utterance ${lang}`,async()=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');vi.stubEnv('VITE_MORNING_BRIEFING','true');
 const grades=context('/grades',{grades:[{grade:'GREY-IRON',composition_ranges:{C:[2,3]}},{grade:'SG-IRON',composition_ranges:{C:[3.1,3.6]}}]});
 const reading=context('/spectrometer',{latestReading:{heatId:'H-1053',timestamp:'2026-11-03T00:00:00Z',composition:{C:3.4}}});
 for(const [text,page] of [['latest reading',reading],['Latest readings.',reading],['reading enna',reading],['sd iron specs',grades],['S G iron specs',grades],['SGI range',grades],['\u090f\u0938 \u091c\u0940 \u0906\u092f\u0930\u0928 specs',grades],['\u0b8e\u0bb8\u0bcd\u0b9c\u0bbf \u0b90\u0baf\u0bb0\u0bcd\u0ba9\u0bcd specs',grades]]){
  const results=[];
  for(const routeTaken of ['PTT','wake-remainder','full-utterance']){const say=vi.fn();await createTranscriptHandler({lang,setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:page})(text,{routeTaken});expect(say).toHaveBeenCalledTimes(1);results.push(say.mock.calls[0][0]);}
  expect(new Set(results).size).toBe(1);expect(results[0]).toContain(page===grades?'SG-IRON':'H-1053');
 }
 const say=vi.fn(),detail={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[]}};
 for(const routeTaken of ['PTT','wake-remainder','full-utterance'])await createTranscriptHandler({lang,setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:context('/dashboard',{}),dashboardBriefingServices:{getShiftSummaryHeats:async()=>({data:[detail]}),getHeat:async()=>({data:detail})}})('\u0b87\u0ba9\u0bcd\u0ba9\u0bc8\u0b95\u0bcd\u0b95\u0bc1 briefing',{routeTaken});
 expect(say).toHaveBeenCalledTimes(3);expect(new Set(say.mock.calls.map(c=>c[0])).size).toBe(1);expect(say.mock.calls[0][0]).toContain('HOLD 1');
 const missing=vi.fn();await createTranscriptHandler({lang,setHeard:vi.fn(),say:missing,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:grades})('unrecognized page information');expect(missing.mock.calls[0][0]).toBe(loadedUnavailable.en);
});
it('bounded short-token edit tolerance and briefing equivalents',()=>{for(const token of ['sg','sd','s','g','sag'])expect(oneEditSG(token)).toBe(true);for(const token of ['cast','zz','pig'])expect(oneEditSG(token)).toBe(false);for(const text of ['brief','briefing','\u0baa\u0bcd\u0bb0\u0bc0\u0b83\u0baa\u0bbf\u0b99\u0bcd','\u0906\u091c \u0915\u0940 \u092c\u094d\u0930\u0940\u092b\u093f\u0902\u0917'])expect(isMorningBriefing(text)).toBe(true);});
it('Listening has waveform only; returned transcript belongs to Understanding without a caret',()=>{
 const listening=renderToStaticMarkup(<KuralWakePanel wake={{enabled:true,state:'Listening\u2026'}} heard="old words"/>);expect(listening).not.toContain('old words');expect(listening).toContain('kural-live-wave');expect(listening).not.toContain('kural-caret');
 const processing=renderToStaticMarkup(<KuralWakePanel wake={{enabled:true,state:'Thinking'}} heard="Kural sd iron specs"/>);expect(processing).toContain('sd');expect(processing).toContain('kural-wake-tag');expect(processing).not.toContain('kural-caret');
});
it('StrictMode effect setup replaces the aborted cleanup signal and logs routing without transcript content',()=>{
 const code=readFileSync('src/components/voice/PushToTalk.jsx','utf8');expect(code).toContain('if(speechAbort.current.signal.aborted)speechAbort.current=new AbortController()');expect(code).toContain('await handlePushToTalk(text');expect(code).toContain("stage:'handler'");expect(code).toContain('VITE_VOICE_TIMING');
});
it('a handler retained during recording resolves the current streaming snapshot at transcript arrival',async()=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');
 const initial=context('/spectrometer',{latestReading:null,loading:true});let current=initial;
 const say=vi.fn(),handle=createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:initial,getPageContext:()=>current});
 for(let tick=0;tick<20;tick++){
  current=context('/spectrometer',{loading:tick%2===0,latestReading:{timestamp:'2026-11-03T00:00:00Z',composition:{C:3.51,Si:2.31,Mn:.67}}});
  await handle('Kural, latest reading');expect(say.mock.calls.at(-1)[0]).toContain('C 3.51% · Si 2.31% · Mn 0.67%');
 }
 // The old snapshot reproduces the reported refusal even while current has data.
 const stale=vi.fn();await createTranscriptHandler({lang:'en',setHeard:vi.fn(),say:stale,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:initial})('latest reading');expect(stale.mock.calls[0][0]).toBe(loadedUnavailable.en);
});
it('Chromium: streaming PTT uses the fresh registered page and the bounded card renders display text without scrolling',async()=>{
 const {build,preview}=await import('vite'),{chromium}=await import('@playwright/test'),{randomUUID}=await import('node:crypto'),{resolve}=await import('node:path');
 const outDir='node_modules/.cache/live-voice-repairs-'+randomUUID();let server,browser;
 const fixture={name:'streaming-page-boundaries',enforce:'pre',load(id){const p=id.replaceAll('\\','/').split('?')[0];
  if(p.endsWith('/src/index.css'))return readFileSync(p,'utf8').replace(/^@import url\("[^"]+"\);/,'');
  if(p.endsWith('/src/context/AuthContext.jsx'))return 'export const useAuth=()=>({user:null});';
  if(p.endsWith('/src/context/MeltFlowContext.jsx'))return 'export const useMeltFlow=()=>({flow:{}});';
  if(p.endsWith('/src/services/premeltService.js'))return `const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',blocking:['Copper 0.50% exceeds limit 0.30%.'],checks:[{id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]}]}},wrap=data=>({data:{data}});export const getHeat=async()=>wrap(heat);export const getHeats=async()=>wrap([heat]);export const getShiftSummaryHeats=getHeats;export const getAdditives=async()=>wrap([]);`;
  if(p.endsWith('/src/services/spectrometerService.js'))return `export const getAllReadings=()=>new Promise(resolve=>{(window.readingRequests||=[]).push(rows=>resolve({data:{data:rows}}));});export const requestOPCReading=async()=>({});export const deleteReading=async()=>({});export const connectSpectrometerOPC=async()=>({});export const disconnectSpectrometerOPC=async()=>({});`;
  if(p.endsWith('/src/services/copilotService.js'))return `export const transcribeAudio=()=>new Promise(resolve=>{window.returnTranscript=text=>resolve({data:{success:true,text}});});export const transliterateAudio=async()=>({data:{unavailable:true}});export const checkWake=async()=>({data:{wake:false}});export const sendChatMessage=async()=>({data:{response:'fixture'}});export const phraseGateFacts=async()=>({source:'template'});export const synthesizeSpeechWithMeta=async text=>{(window.ttsInputs||=[]).push(text);return {blob:new Blob(['mock']),provider:'mock',source:'mock'};};`;
 }};
 try{
  await build({configFile:false,envFile:false,logLevel:'error',plugins:[fixture],define:Object.fromEntries(Object.entries({DEV:false,VITE_MOCK_MODE:'true',VITE_WAKE_WORD:'true',VITE_VOICE_EVERYWHERE:'true',VITE_VOICE_PAGE_ANSWERS:'true',VITE_SHOW_VOICE_PANEL:'true',VITE_TRANSLITERATE:'false',VITE_VOICE_TOUR:'false',VITE_VOICE_CLARITY:'false',VITE_SPOKEN_NORMALIZE:'true',VITE_TTS_STREAM:'false'}).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)])),build:{outDir,emptyOutDir:true,rollupOptions:{input:resolve('tests/fixtures/live-voice-repairs.html')}}});
  server=await preview({configFile:false,logLevel:'error',build:{outDir},preview:{host:'127.0.0.1',port:0}});const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:650}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.addInitScript(()=>{
   localStorage.setItem('metallisense.voice.language','en');localStorage.setItem('metallisense.voice.muted','false');localStorage.setItem('kural.handsfree','off');
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
   window.MediaRecorder=class{static isTypeSupported(){return true;}constructor(){this.mimeType='audio/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['fixture'])});this.onstop?.();}};
   window.AudioContext=undefined;window.webkitAudioContext=undefined;
   window.Audio=class{constructor(){window.lastAudio=this;this.duration=10;this.currentTime=0;}play(){queueMicrotask(()=>this.onplaying?.());return Promise.resolve();}pause(){}};
  });
  await page.clock.install();await page.goto(base+'/tests/fixtures/live-voice-repairs.html');await page.getByTestId('snapshot').waitFor();
  // Start capture before the initial request completes; the retained callback
  // must read updates published by the real Spectrometer/VoicePageProvider.
  await page.keyboard.down('Space');await page.locator('[data-wake-state="listening"]').waitFor();
  const publish=async(c=3.51)=>{await page.evaluate(c=>{const requests=window.readingRequests.splice(0);for(const done of requests)done([{_id:'stream',timestamp:'2026-11-03T00:00:00Z',composition:{C:c,Si:2.31,Mn:.67}}]);},c);await page.waitForFunction(c=>JSON.parse(document.querySelector('[data-testid="snapshot"]').textContent).loaded?.latestReading?.composition.C===c,c);};
  await publish(3.50);
  for(let n=0;n<3;n++){await page.clock.fastForward(3000);await publish(3.51);}
  await page.keyboard.up('Space');await page.waitForFunction(()=>Boolean(window.returnTranscript));
  // Answer during another in-flight refresh: cached values remain available.
  await page.clock.fastForward(3000);await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="snapshot"]').textContent).loaded?.loading===true);
  await page.evaluate(()=>window.returnTranscript('Kural, latest reading'));await page.clock.fastForward(160);await page.locator('[data-wake-state="speaking"]').waitFor();
  expect(await page.locator('.kural-words').innerText()).toContain('C 3.51% · Si 2.31% · Mn 0.67%');expect(await page.locator('.kural-words').innerText()).not.toContain('not loaded');
  expect(await page.evaluate(()=>window.ttsInputs.at(-1))).toMatch(/^Latest reading: carbon 3\.51 percent, silicon 2\.31, manganese 0\.67\. Taken at \d{1,2}:\d{2}\.$/);await publish(3.52);
  // Refresh changes the page snapshot, not the answer already being spoken.
  expect(await page.locator('.kural-words').innerText()).toContain('C 3.51%');
  await page.evaluate(()=>{window.lastAudio.onended?.();window.returnTranscript=null;});await page.clock.fastForward(600);
  await page.keyboard.down('Space');await page.locator('[data-wake-state="listening"]').waitFor();await page.keyboard.up('Space');await page.waitForFunction(()=>Boolean(window.returnTranscript));
  await page.evaluate(()=>window.returnTranscript('why hold heat 1053'));await page.clock.fastForward(160);await page.locator('[data-wake-state="speaking"]').waitFor();
  const cardText=await page.locator('.kural-words').innerText(),ttsText=await page.evaluate(()=>window.ttsInputs.at(-1));
  expect(cardText).toContain('0.50%');expect(cardText).toContain('0.30%');expect(ttsText).not.toBe(cardText);expect(ttsText).not.toContain('0.50%');expect(ttsText).toMatch(/point|percent/i);
  await page.goto(base+'/tests/fixtures/live-voice-repairs.html?visual');
  const displayText=Array.from({length:24},(_,i)=>`Heat H-1053: HOLD. Copper 0.50% above 0.30% limit; lot PIG-0901 needs review ${i}.`).join(' '),spokenText='ஹீட் one zero five three ஜீரோ பாயிண்ட் ஃபைவ்';
  await page.evaluate(({displayText,spokenText})=>window.setRepairPreview({wake:{enabled:true,state:'Waiting',speaking:true},playingAnswer:{displayText,spokenText},playbackProgress:0}),{displayText,spokenText});
  await page.getByRole('button',{name:'Show more',exact:true}).waitFor();
  expect(await page.locator('.kural-words').textContent()).toBe(displayText);expect(await page.locator('.kural-tag-id').first().textContent()).toBe('H-1053');expect(await page.locator('.kural-tag-percent').first().textContent()).toBe('0.50%');expect(await page.locator('.kural-tag-hold').count()).toBe(24);
  const geometry=()=>page.evaluate(()=>{const card=document.querySelector('.kural-card-body'),header=card.querySelector('header'),answer=card.querySelector('.kural-answer-viewport');return {top:card.getBoundingClientRect().top,bottom:card.getBoundingClientRect().bottom,headerBottom:header.getBoundingClientRect().bottom,answerTop:answer.getBoundingClientRect().top,lines:answer.clientHeight/parseFloat(getComputedStyle(answer.querySelector('.kural-words')).lineHeight),scroll:answer.scrollTop,cardScroll:card.scrollTop,pageScroll:scrollY};});
  const before=await geometry();expect(before.top).toBeGreaterThanOrEqual(0);expect(before.bottom).toBeLessThanOrEqual(650);expect(before.headerBottom).toBeLessThan(before.answerTop);expect(before.lines).toBeLessThanOrEqual(5.1);
  for(const progress of [.1,.45,.9]){await page.evaluate(playbackProgress=>window.setRepairPreview(old=>({...old,playbackProgress})),progress);await page.clock.fastForward(160);expect(await geometry()).toEqual(before);}
  expect(await page.locator('.kural-word--done').count()).toBeGreaterThan(0);expect(await page.locator('.kural-word--future').count()).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Show more',exact:true}).click();expect(await page.getByRole('button',{name:'Show less'}).getAttribute('aria-expanded')).toBe('true');
  await page.locator('.kural-answer-viewport').evaluate(node=>node.scrollTop=100);const expanded=await geometry();
  await page.evaluate(()=>window.setRepairPreview(old=>({...old,playbackProgress:.95})));await page.clock.fastForward(160);expect((await geometry()).scroll).toBe(expanded.scroll);expect((await geometry()).headerBottom).toBeLessThan((await geometry()).answerTop);
  await page.getByRole('button',{name:'Show less'}).click();expect(await page.getByRole('button',{name:'Show more',exact:true}).getAttribute('aria-expanded')).toBe('false');
  for(const height of [450,320]){await page.setViewportSize({width:360,height});await page.clock.fastForward(300);expect((await geometry()).top).toBeGreaterThanOrEqual(0);expect((await geometry()).bottom).toBeLessThanOrEqual(height);}
  expect(errors).toEqual([]);
 }finally{await browser?.close();if(server)await new Promise(resolve=>{server.httpServer.closeAllConnections();server.httpServer.close(resolve);});}
},90000);
