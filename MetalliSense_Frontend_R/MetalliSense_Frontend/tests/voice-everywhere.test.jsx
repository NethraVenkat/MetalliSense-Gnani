import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {voicePages,pagePurposes,pageHelp,navigationAnswer,scopeVoiceCallbacks} from '../src/services/voicePages';
import {mapIntent} from '../src/services/voiceIntents';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import PushToTalk from '../src/components/voice/PushToTalk';
import {blockedVoiceReplies,questionReplyLanguage} from '../src/services/languageBridge';
import {createHoldAnnouncer} from '../src/services/voiceGateAnswers';
import {clarityText} from '../src/services/voiceClarity';
import englishHelpBaseline from './f13a-english-help-baseline.json';
afterEach(()=>vi.unstubAllEnvs());
const params={everywhere:true,langBridge:true};
it.each(voicePages.flatMap(page=>[
 [page.route,'en',`open ${page.pageName.en}`],
 [page.route,'ta',`${page.pageName.ta} காட்டு`],
 [page.route,'hi',`${page.pageName.hi} दिखाओ`],
]))('all content navigation %s (%s): %s',(route,lang,text)=>{
 vi.stubEnv('VITE_MOCK_MODE','true');
 expect(mapIntent(text,params)).toEqual({intent:'open_screen',params:{route,pageAware:true}});
 expect(navigationAnswer(route,lang).toLowerCase()).toContain(voicePages.find(page=>page.route===route).pageName[lang].toLowerCase());
});
it.each([['stock page போ','/raw-material-stock'],['spectrometer kaattu','/spectrometer'],['energy dikhao','/energy'],['open grades','/grades'],['supplier scorecard kholo','/supplier-scorecard'],['dashboard போ','/dashboard']])('mixed navigation %s',(text,route)=>{
 vi.stubEnv('VITE_MOCK_MODE','true');expect(mapIntent(text,params).params.route).toBe(route);
});
it.each(['approve page போ','summary approve karo','start melting energy dikhao','release stock page','delete grades page'])('safety still first: %s',text=>expect(mapIntent(text,params).intent).toBe('blocked'));
it.each(['Heat 1053 status என்ன','why hold heat 1053','heat 1053 carbon evvalavu','FeSi stock evvalavu','stock enna','இந்த shift சுருக்கம் சொல்.'])('global intent unchanged: %s',text=>{
 expect(mapIntent(text,{...params,shiftSummary:true})).toEqual(mapIntent(text,{...params,everywhere:false,shiftSummary:true}));
});
it('flag off keeps old matching; charge route only available in mock; no auth navigation',()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','false');expect(mapIntent('energy dikhao').intent).toBe('ask_copilot');
 expect(mapIntent('what can I ask here?').intent).toBe('ask_copilot');
 vi.stubEnv('VITE_MOCK_MODE','false');expect(mapIntent('open charge optimizer',params).intent).not.toBe('open_screen');
 expect(voicePages).toHaveLength(21);expect(voicePages.some(page=>/login|signup/.test(page.route))).toBe(false);
});
it.each(['show stock heat one zero five three','open grades heat ஆயிரத்து ஐம்பத்தி மூணு','energy dikhao heat एक हजार तिरपन'])('spoken heat IDs retain existing intent precedence: %s',text=>{
 expect(mapIntent(text,params)).toEqual(mapIntent(text,{...params,everywhere:false}));
});
it.each(['अप्रूव energy दिखाओ','मेल्टिंग शुरू energy दिखाओ','stock kam karo stock page'])('existing Hindi safety predicate also guards new navigation with bridge off: %s',text=>{
 expect(mapIntent(text,{everywhere:true,langBridge:false}).intent).toBe('blocked');
});
it.each(['இங்க என்ன கேக்கலாம்?','yahan kya pooch sakte hain?','what can I ask here?'])('page help intent %s',text=>expect(mapIntent(text,params).intent).toBe('page_help'));
it.each(voicePages)('honest help for $route',page=>{
 for(const lang of ['ta','hi','en']){
  const help=pageHelp({route:page.route},lang);
  expect(help.startsWith(pagePurposes[page.route][lang==='ta'?0:lang==='hi'?1:2])).toBe(true);
  expect(help).not.toMatch(/[?？]/u);expect(help).not.toContain('1053');
  if(!['/premelt-gate','/raw-material-stock'].includes(page.route))expect(help).toContain(lang==='ta'?'இப்போ இங்க நேவிகேஷன் மட்டும்.':lang==='hi'?'अभी यहाँ सिर्फ नेविगेशन।':'Only navigation on this page for now');
 }
});
it.each(voicePages.flatMap(page=>['ta','hi'].map(lang=>[page.route,lang])))('colloquial native-script help and names %s (%s)',(route,lang)=>{
 const help=pageHelp({route},lang);
 expect(help).not.toMatch(/[A-Za-z]/u); // No IDs are used in page descriptions.
 expect(help).not.toMatch(/மூலப்பொருள்|இருப்பு|தெரியும்|உள்ளது|செய்யப்படவில்லை/u);
 for(const sentence of help.split(/[.!?।]/u).filter(text=>text.trim()))expect(sentence.trim().split(/\s+/u).length).toBeLessThanOrEqual(8);
 expect(help).not.toMatch(/[?？]/u);
 const name=voicePages.find(page=>page.route===route).pageName[lang];
 expect(name).not.toMatch(/[A-Za-z]/u);
 expect(navigationAnswer(route,lang)).not.toMatch(/[A-Za-z]/u);
});
it.each(voicePages)('English help remains byte-for-byte unchanged for $route',page=>{
 expect(pageHelp({route:page.route},'en')).toBe(englishHelpBaseline[page.route]);
});
it('navigation/help are read-only and use localized confirmations',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');
 const say=vi.fn(),navigate=vi.fn(),resolveHeat=vi.fn();
 const handler=createTranscriptHandler({lang:'en',say,navigate,resolveHeat,setHeard:vi.fn(),pageContext:{route:'/energy'}});
 await handler('energy dikhao');expect(say.mock.lastCall).toEqual(['एनर्जी पेज खोला गया','एनर्जी पेज खोला गया','hi',{navigation:'/energy'}]);expect(navigate).toHaveBeenCalledWith('/energy');
 await handler('what can I ask here?');expect(say.mock.lastCall[0]).toBe(pageHelp({route:'/energy'},'en'));expect(resolveHeat).not.toHaveBeenCalled();
 expect(navigationAnswer('/raw-material-stock','ta')).toBe('ஸ்டாக் பேஜ் ஓப்பன் செய்யப்பட்டது');
});
it('late heat answer after navigation is dropped at the shared callback boundary',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');let route='/premelt-gate',finish;
 const say=vi.fn(),navigate=vi.fn(),setPhraseSource=vi.fn();
 const callbacks=scopeVoiceCallbacks({say,navigate,setPhraseSource},()=>route==='/premelt-gate');
 const handler=createTranscriptHandler({lang:'en',...callbacks,setHeard:vi.fn(),resolveHeat:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=handler('heat 1053 status');route='/energy';finish({heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[]}});await pending;
 expect(say).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();expect(setPhraseSource).toHaveBeenCalledTimes(1); // initial clear only
});
it('page/chat mounts skip the entire inner panel in shared mode',()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');expect(renderToStaticMarkup(<PushToTalk/>)).toBe('');
});
it('shared mode still honors VITE_SHOW_VOICE_PANEL=false without mounting hooks',()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_SHOW_VOICE_PANEL','false');
 expect(renderToStaticMarkup(<PushToTalk shared/>)).toBe('');
});

// Real React DOM + route effects in local Chromium; every network request is
// restricted to the local fixture server. No hardware or provider is contacted.
it('one persistent panel, selection unregister, late STT/answer isolation, HOLD alert and old mounts',async()=>{
 const {build,preview}=await import('vite');
 const {chromium}=await import('@playwright/test');
 const root=process.cwd();
 const fixturePlugin={name:'voice-fixture-mocks',enforce:'pre',load(id){
  const path=id.replaceAll('\\','/').split('?')[0];
  if(path.endsWith('/src/hooks/useSpeak.js'))return readFileSync('src/hooks/useSpeak.js','utf8').replace("export function speakText(text, lang = 'ta', style = 'normal', timing = {}) {", "export function speakText(text, lang = 'ta', style = 'normal', timing = {}) { if(timing?.signal)window.lastTourSignal=timing.signal;");
  if(path.endsWith('/src/context/MeltFlowContext.jsx'))return `export const useMeltFlow=()=>({flow:{}});`;
  if(path.endsWith('/src/services/copilotService.js'))return `export const transcribeAudio=()=>new Promise(resolve=>{window.sttCalls=(window.sttCalls||0)+1;window.finishSTT=()=>resolve({data:{success:true,text:window.nextTranscript||'heat 1053 status'}});});export const transliterateAudio=async()=>({data:{unavailable:true}});export const sendChatMessage=async()=>({data:{response:''}});export const phraseGateFacts=async()=>({source:'template'});export const synthesizeSpeechWithMeta=async(text,lang,style)=>{window.spoken||=[];window.spoken.push([text,lang,style]);return {blob:new Blob(['mock audio']),provider:'mock',source:'mock'};};`;
  if(path.endsWith('/src/components/layout/Sidebar.jsx')||path.endsWith('/src/components/layout/TopBar.jsx'))return `export default function(){return null;}`;
  if(path.endsWith('/src/services/premeltService.js'))return `const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[]}};const wrap=x=>({data:{data:x}});export const getHeat=async()=>window.deferHeat?new Promise(r=>{window.finishHeat=()=>r(wrap(heat));}):wrap(heat);export const getHeats=async()=>wrap([heat]);export const getShiftSummaryHeats=getHeats;export const getAdditives=async()=>wrap([]);`;
 }};
 let server,browser;
 try{
  // Run both modes against real component mounts without local env overrides.
  for(const flag of ['true','false']){
   const outDir=`node_modules/.cache/f13-voice-${flag}`;
   await build({root,configFile:false,envFile:false,logLevel:'error',plugins:[fixturePlugin],define:{'import.meta.env.VITE_VOICE_EVERYWHERE':JSON.stringify(flag),'import.meta.env.VITE_VOICE_TOUR':'"true"','import.meta.env.VITE_HANDOVER':'"true"','import.meta.env.VITE_SHOW_VOICE_PANEL':'"true"','import.meta.env.VITE_MOCK_MODE':'"true"','import.meta.env.VITE_TRANSLITERATE':'"false"','import.meta.env.VITE_VOICE_CLARITY':'"false"'},build:{outDir,emptyOutDir:false,target:'esnext',rollupOptions:{input:root+'/tests/fixtures/voice-everywhere.html'}}});
   const hosted=await preview({root,configFile:false,logLevel:'error',build:{outDir},preview:{port:0,host:'127.0.0.1'}});
   server={httpServer:hosted.httpServer,close:()=>new Promise(resolve=>{hosted.httpServer.closeAllConnections();hosted.httpServer.close(resolve);})};
   const base=`http://127.0.0.1:${server.httpServer.address().port}`;
   browser=await chromium.launch({headless:true});const page=await browser.newPage();
   await page.addInitScript(()=>{
    window.spoken=[];localStorage.setItem('metallisense.voice.language','en');window.Audio=class{constructor(){this.duration=.1;}play(){this.onended?.();return Promise.resolve();}pause(){}};
    window.voiceKeys=new Set();const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
    window.addEventListener=(type,fn,...rest)=>{if(type==='keydown')window.voiceKeys.add(fn);return add(type,fn,...rest);};
    window.removeEventListener=(type,fn,...rest)=>{if(type==='keydown')window.voiceKeys.delete(fn);return remove(type,fn,...rest);};
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})},configurable:true});
    window.MediaRecorder=class{static isTypeSupported(){return true;}constructor(){this.mimeType='audio/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['mock audio'])});void this.onstop?.();}};
   });
   page.on('pageerror',error=>console.error('fixture browser:',error.message));
   page.on('console',message=>{if(message.type()==='error')console.error('fixture console:',message.text());});
   await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
   await page.goto(base+'/tests/fixtures/voice-everywhere.html');
   await page.getByRole('link',{name:'/dashboard',exact:true}).waitFor({timeout:10000});
   for(const target of voicePages){
    await page.getByRole('link',{name:target.route,exact:true}).click();
    await page.locator('[data-testid="route"]').filter({hasText:target.route}).waitFor();
    await expect.poll(()=>page.getByRole('region',{name:'Shop floor voice'}).count()).toBe(flag==='true'?1:(['/dashboard','/spectrometer','/premelt-gate'].includes(target.route)?2:1));
    if(flag==='true'){
     const context=JSON.parse(await page.getByTestId('context').innerText());expect(context.route).toBe(target.route);expect(context.source).toBe('fixture screen');
     if(target.route==='/premelt-gate')expect(context.selected.heatId).toBe('H-1053');else expect(context.selected.heatId).toBeUndefined();
     if(target.route==='/dashboard')await page.getByRole('region',{name:'Shop floor voice',exact:true}).evaluate(node=>node.dataset.mountProbe='same');
     expect(await page.getByRole('region',{name:'Shop floor voice',exact:true}).getAttribute('data-mount-probe')).toBe('same');
     expect(await page.evaluate(()=>window.voiceKeys.size)).toBe(1);
    }
   }
   expect(await page.evaluate(()=>window.spoken)).toEqual([]); // saved HOLD never announces on entry
   await page.getByRole('link',{name:'/premelt-gate',exact:true}).click();
   await page.getByRole('button',{name:'Fixture GO check',exact:true}).click();
   await page.getByRole('button',{name:'Fixture HOLD check',exact:true}).click();
   await page.getByRole('button',{name:'Fixture HOLD check',exact:true}).click();
   expect(await page.evaluate(()=>window.spoken.map(call=>[call[1],call[2]]))).toEqual([['en','alert']]);
   if(flag==='true'){
    await page.getByRole('link',{name:'/premelt-gate',exact:true}).click();
    await page.evaluate(()=>{window.deferHeat=true;window.spoken=[];});
    await page.getByText('Demo transcripts',{exact:true}).click();
    await page.getByRole('button',{name:'Heat 1053 status என்ன',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>typeof window.finishHeat)).toBe('function');
    await page.getByRole('link',{name:'/energy',exact:true}).click();
    await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/energy');
    await page.evaluate(()=>window.finishHeat());
    await expect.poll(()=>page.locator('[aria-live="polite"]').innerText()).toBe('');
    expect(await page.evaluate(()=>window.spoken)).toEqual([]);
    // A main REST transcript arriving after navigation must not start an answer.
    const mic=page.getByRole('button',{name:'Hold to talk',exact:true});
    await mic.hover();await page.mouse.down();
    await expect.poll(()=>mic.getAttribute('aria-pressed')).toBe('true');await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>typeof window.finishSTT)).toBe('function');
    await page.getByRole('link',{name:'/grades',exact:true}).click();
    await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/grades');
    await page.evaluate(()=>window.finishSTT());
    await expect.poll(()=>page.locator('[aria-live="polite"]').innerText()).toBe('');
    expect(await page.evaluate(()=>window.spoken)).toEqual([]);
    // F14 mounted controls: all provider/media traffic remains mocked.
    const card=page.locator('[aria-label="Voice onboarding tour"]');
    const startTour=page.getByRole('button',{name:'Start tour / டூர் / टूर',exact:true});
    expect(await startTour.count()).toBe(1);expect(await card.count()).toBe(0);
    await page.getByText('Take the tour',{exact:true}).waitFor();
    for(const language of ['ta','hi','en']){
     await page.getByLabel('Voice language',{exact:true}).selectOption(language);
     await startTour.click();await expect.poll(()=>card.innerText()).toContain('Step 1/22');
     await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/dashboard');
     await page.getByRole('button',{name:'Next',exact:true}).click();await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/spectrometer');
     await page.getByRole('button',{name:'Repeat',exact:true}).click();
     expect(await page.evaluate(()=>window.spoken.at(-1)[1])).toBe(language);
     await page.getByRole('button',{name:'Back',exact:true}).click();await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/dashboard');
     await page.getByRole('button',{name:'Stop',exact:true}).click();await expect.poll(()=>card.count()).toBe(0);
    }
    const voice=async(text)=>{
     const count=await page.evaluate(()=>window.sttCalls||0);
     await page.evaluate(text=>window.nextTranscript=text,text);
     const button=page.getByRole('button',{name:/^(?:Hold to talk|பேச அழுத்திப் பிடிக்கவும்)$/});
     await expect.poll(()=>button.isEnabled()).toBe(true);await button.hover();await page.mouse.down();await expect.poll(()=>button.getAttribute('aria-pressed')).toBe('true');await page.mouse.up();
     await expect.poll(()=>page.evaluate(()=>window.sttCalls)).toBe(count+1);await page.evaluate(()=>window.finishSTT());
    };
    for(const commands of [['டூர் ஆரம்பி','அடுத்தது','முன்னாடி','திரும்ப சொல்லு','டூர் நிறுத்து'],['tour start karo','aage','peeche','dobara','tour band karo'],['start tour','next','back','repeat','stop tour']]){
     await voice(commands[0]);await expect.poll(()=>card.innerText()).toContain('Step 1/22');
     await voice(commands[1]);await expect.poll(()=>card.innerText()).toContain('Step 2/22');
     await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/spectrometer');
     await voice(commands[2]);await expect.poll(()=>card.innerText()).toContain('Step 1/22');
     await expect.poll(()=>page.getByTestId('route').innerText()).toBe('/dashboard');
     await voice(commands[3]);await voice(commands[4]);await expect.poll(()=>card.count()).toBe(0);
    }
    await startTour.click();
    for(let step=2;step<=22;step++){
     await page.getByRole('button',{name:'Next',exact:true}).click();await expect.poll(()=>card.innerText()).toContain(`Step ${step}/22`);
     // Wait for each requested page before advancing to exercise the real router.
     const route=['/dashboard','/spectrometer','/grades','/supplier-scorecard','/raw-material-stock','/yard-inspection','/premelt-gate','/premelt-gate','/anomaly','/recommendation','/rl-optimizer','/full-analysis','/agent','/energy','/mechanical-properties','/sales','/inventory-forecast','/cost-analysis','/synthetic','/training-data','/semantic-search'][step-1];
     if(route)await expect.poll(()=>page.getByTestId('route').innerText()).toBe(route);
    }
    expect(await page.evaluate(()=>localStorage.getItem('metallisense.voice.tour.done'))).toBe('true');
    await page.getByRole('button',{name:'Stop',exact:true}).click();expect(await page.getByText('Take the tour',{exact:true}).count()).toBe(0);
    await page.getByRole('button',{name:'Mute voice',exact:true}).click();await page.evaluate(()=>window.spoken=[]);
    await startTour.click();await expect.poll(()=>card.count()).toBe(1);expect(await card.innerText()).toContain('Step 1/22');expect(await page.evaluate(()=>window.spoken)).toEqual([]);
    await page.getByRole('link',{name:'/energy',exact:true}).click();await expect.poll(()=>card.count()).toBe(0);
    await page.getByRole('button',{name:'Unmute voice',exact:true}).click();await startTour.click();
    await expect.poll(()=>page.evaluate(()=>Boolean(window.lastTourSignal))).toBe(true);
    await page.getByRole('link',{name:'/grades',exact:true}).click();await expect.poll(()=>card.count()).toBe(0);
    expect(await page.evaluate(()=>window.lastTourSignal.aborted)).toBe(true);
   }
   if(flag==='false')expect(await page.getByRole('button',{name:'Start tour / டூர் / टूर',exact:true}).count()).toBe(0);
   await page.getByRole('link',{name:'/login',exact:true}).click();
   await expect.poll(()=>page.getByRole('region',{name:'Shop floor voice'}).count()).toBe(0);
   expect(await page.evaluate(()=>window.voiceKeys.size)).toBe(0);
   await browser.close();browser=null;await server.close();server=null;
  }
 }finally{await browser?.close();await server?.close();}
},90000);

it('all route pages register metadata and the existing Pre-Melt HOLD effect remains',()=>{
 const app=readFileSync('src/App.jsx','utf8');for(const page of voicePages)expect(app).toContain(`path="${page.route.slice(1)}"`);
 const premelt=readFileSync('src/pages/PreMeltGate.jsx','utf8');expect(premelt).toContain('holdAnnouncer.observe(heat?.heatId, gate)');expect(premelt).toContain('holdAnnouncer.checkResult(heat.heatId, r.data.data,');expect(premelt).toContain('useRegisterVoicePage({heatId,grade:');
});

it.each([
 ['open stock','ta','en'],['what can I ask here?','ta','en'],['approve','ta','en'],['start melting','ta','en'],
 ['stock page போ','en','ta'],['stock page po','en','ta'],['approve pannu','en','ta'],['இங்க என்ன கேக்கலாம்?','en','ta'],
 ['energy dikhao','ta','hi'],['supplier scorecard kholo','en','hi'],['approve karo','en','hi'],['अप्रूव','en','hi'],
 ['yahan kya pooch sakte hain?','en','hi'],['...','ta','ta'],
])('question language wins over toggle: %s',(text,toggle,expected)=>expect(questionReplyLanguage(text,'en-IN',toggle)).toBe(expected));

it.each([
 ['ta','ஸ்டாக் பேஜ் ஓப்பன் செய்யப்பட்டது'],['hi','स्टॉक पेज खोला गया'],['en','Stock page opened'],
])('professional confirmation %s',(lang,expected)=>expect(navigationAnswer('/raw-material-stock',lang)).toBe(expected));
it('legacy bare navigation also keeps its spoken confirmation on the destination',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');const say=vi.fn();
 await createTranscriptHandler({lang:'en',say,navigate:vi.fn(),resolveHeat:vi.fn(),setHeard:vi.fn()})('dashboard');
 expect(say.mock.lastCall).toEqual(['Dashboard page opened','Dashboard page opened','en',{navigation:'/dashboard'}]);
});

it.each([
 ['open stock','en'],['what can I ask here?','en'],['approve','en'],['start melting','en'],['invoice','en'],['release','en'],
 ['stock page போ','ta'],['இங்க என்ன கேக்கலாம்?','ta'],['approve pannu','ta'],
 ['energy dikhao','hi'],['yahan kya pooch sakte hain?','hi'],['approve karo','hi'],['मेल्टिंग शुरू','hi'],
])('navigation/help/blocked output explicitly uses question language: %s',async(text,expected)=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');const say=vi.fn();
 const handler=createTranscriptHandler({lang:expected==='ta'?'en':'ta',langBridge:true,say,navigate:vi.fn(),resolveHeat:vi.fn(),setHeard:vi.fn(),pageContext:{route:'/energy'}});
 await handler(text,{detected_language_code:'en-IN'});
 expect(say.mock.lastCall[2]).toBe(expected);
 if(mapIntent(text,{langBridge:true}).intent==='blocked'){
  expect(say.mock.lastCall.slice(0,2)).toEqual([blockedVoiceReplies[expected],blockedVoiceReplies[expected]]);
  expect(clarityText(say.mock.lastCall[1],expected,'colloquial')).not.toMatch(/approve|அப்ரூவ்|अप्रूव/iu);
 }
});

it('saved HOLD stays silent on initial load, refresh and navigation, including a new HOLD recheck',()=>{
 const speak=vi.fn();
 for(let refresh=0;refresh<3;refresh++){
  const announcer=createHoldAnnouncer();
  announcer.observe('H-1053',{decision:'HOLD',gateId:'saved'});
  announcer.observe('H-1053',{decision:'HOLD',gateId:'saved'});
  announcer.checkResult('H-1053',{decision:'HOLD',gateId:'next-check'},speak,'en');
 }
 expect(speak).not.toHaveBeenCalled();
});
it('one unchecked-to-HOLD check announces once; a duplicate ID never rearms',()=>{
 const announcer=createHoldAnnouncer(),speak=vi.fn();
 const result={decision:'HOLD',gateId:'G-1',checks:[]};
 announcer.observe('H-1053',null);
 announcer.checkResult('H-1053',result,speak,'en');
 announcer.observe('H-1053',{decision:'GO'});
 announcer.checkResult('H-1053',{...result},speak,'ta');
 expect(speak).toHaveBeenCalledTimes(1);
 announcer.checkResult('H-1053',{...result,gateId:'G-2'},speak,'en');
 expect(speak).toHaveBeenCalledTimes(2);
});
it.each(['ta','hi','en'].flatMap(lang=>['false','true'].flatMap(bridge=>['false','true'].map(bilingual=>[lang,bridge,bilingual]))))('HOLD languages selected=%s bridge=%s bilingual=%s',async(lang,bridge,bilingual)=>{
 vi.stubEnv('VITE_LANG_BRIDGE',bridge);vi.stubEnv('VITE_BILINGUAL_ALERT',bilingual);
 const speak=vi.fn().mockResolvedValue();
 await createHoldAnnouncer().checkResult('H-1053',{decision:'HOLD',gateId:'G-1',checks:[]},speak,lang);
 expect(speak.mock.calls.map(call=>call[1])).toEqual(bilingual==='true'?['ta','hi']:[lang]);
 expect(speak.mock.calls.every(call=>call[2]==='alert')).toBe(true);
});
