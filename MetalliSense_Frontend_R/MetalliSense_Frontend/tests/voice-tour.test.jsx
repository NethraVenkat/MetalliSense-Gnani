import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {voiceTourEnabled,voiceTourSteps,tourCommand,tourStepText,tourFinish,createVoiceTour,tourSpokenText,tourRunningReply,tourPronunciation} from '../src/services/voiceTour';
import {pageHelp,voicePages} from '../src/services/voicePages';
import {clarityText} from '../src/services/voiceClarity';
import {mapIntent} from '../src/services/voiceIntents';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import VoiceTourCard from '../src/components/voice/VoiceTourCard';
import PushToTalk from '../src/components/voice/PushToTalk';
const {factoryRead,factoryWrite}=vi.hoisted(()=>({factoryRead:vi.fn(),factoryWrite:vi.fn()}));
vi.mock('../src/services/premeltService',()=>({getHeat:factoryRead,getHeats:factoryRead,getShiftSummaryHeats:factoryRead,getAdditives:factoryRead,runGateCheck:factoryWrite,startMelting:factoryWrite,updateCharge:factoryWrite}));

afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.useRealTimers();});
const enable=()=>{vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_TOUR','true');};
it.each(['ta','hi','en'])('tour and help preserve authored sentence boundaries: %s',lang=>{
 for(const step of voiceTourSteps(true)){
  const text=tourSpokenText(step,lang);
  expect(text).not.toMatch(/\.\s+[a-z]/);
  expect(tourPronunciation(text,lang)).toBe(text);
 }
 for(const page of voicePages)expect(clarityText(pageHelp(page,lang),lang,'colloquial')).not.toMatch(/\.\s+[a-z]/);
});
const reviewed=JSON.parse(readFileSync('tests/fixtures/f14-v4-script.json','utf8'));
it.each(reviewed.flatMap((row,n)=>['ta','hi','en'].map(lang=>[n,lang,row[lang]])))('verbatim reviewed v4 step %s %s',(n,lang,text)=>{
 const step=voiceTourSteps(true)[n];
 expect(tourStepText(step,lang)).toBe(text);expect(tourSpokenText(step,lang)).toBe(text);
 expect(text).not.toMatch(/This page shows/);
 expect(text).not.toContain('இந்த பேஜ்ல');expect(text).not.toMatch(/^यहाँ .*दिख/u);
 expect(tourCommand(text,true)).toBeNull();
});
it('tour pronunciation preserves vocabulary, questions and quotes',()=>{
 const text="carbon HOLD 0.50% Ask 'what can I ask here?' any time.";
 for(const lang of ['ta','hi','en'])expect(tourPronunciation(text,lang)).toBe(text);
 expect(tourPronunciation('H-1053','en')).toBe('heat one zero five three');
 expect(tourPronunciation('H-1053','ta')).toBe('ஹீட் one zero five three');
 expect(tourPronunciation('H-1053','hi')).toBe('हीट one zero five three');
});
const aliases={start:['டூர் ஆரம்பி','tour start karo','start tour'],next:['அடுத்தது','aage','next'],back:['முன்னாடி','peeche','back'],repeat:['திரும்ப சொல்லு','dobara','repeat'],stop:['டூர் நிறுத்து','tour band karo','stop tour']};
it.each(Object.entries(aliases).flatMap(([action,texts])=>texts.map(text=>[action,text])))('voice control %s: %s',(action,text)=>{
 enable();expect(tourCommand(text)).toBe(action);expect(mapIntent(text,{langBridge:true})).toEqual({intent:'tour_control',params:{action}});
});
it.each([['false','true'],['true','false'],['false','false']])('tour flags everywhere=%s tour=%s hide intents',(everywhere,tour)=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE',everywhere);vi.stubEnv('VITE_VOICE_TOUR',tour);
 expect(voiceTourEnabled()).toBe(false);expect(tourCommand('start tour')).toBeNull();expect(mapIntent('start tour',{langBridge:true}).intent).not.toBe('tour_control');
 expect(renderToStaticMarkup(<VoiceTourCard state={{active:false}}/>)).toBe('');
});
it.each(['start melting','start tour approve','start melting tour','approve டூர் ஆரம்பி','tour start karo release','start tour heat 1053','start tour stock kam karo'])('safety beats tour: %s',text=>{
 enable();expect(mapIntent(text,{langBridge:true}).intent).toBe('blocked');
});
it('step order and optional handover',()=>{
 const plain=voiceTourSteps(false),full=voiceTourSteps(true);
 expect(plain.map(step=>step.route)).toEqual(['/dashboard','/spectrometer','/grades','/supplier-scorecard','/raw-material-stock','/yard-inspection','/premelt-gate','/anomaly','/recommendation','/rl-optimizer','/full-analysis','/agent','/energy','/mechanical-properties','/sales','/inventory-forecast','/cost-analysis','/synthetic','/training-data','/semantic-search',null]);
 expect(full[7]).toMatchObject({id:'handover',route:'/premelt-gate',target:'[aria-label="Shift handover"]'});
});
it.each(['ta','hi','en'])('complete script, truthful tips, native scripts and finish %s',lang=>{
 for(const step of voiceTourSteps(true)){
  const text=tourStepText(step,lang);expect(text).toBeTruthy();
  if(lang!=='en')expect(text).not.toMatch(/[A-Za-z]/);
 }
 expect(tourStepText(voiceTourSteps().at(-1),lang)).toBe(tourFinish[lang]);
});
it.each(['false','true'])('shift flag never rewrites v4 script: %s',flag=>{
 vi.stubEnv('VITE_SHIFT_SUMMARY',flag);
 const steps=voiceTourSteps(true);
 for(let n=0;n<reviewed.length;n++)for(const lang of ['ta','hi','en'])expect(tourStepText(steps[n],lang)).toBe(reviewed[n][lang]);
});
function fixture({muted=false,denied=false}={}){
 let location={route:'/dashboard',scope:'0'},number=0;
 const store=new Map(),storage=()=>denied?{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const navigate=vi.fn(),speak=vi.fn().mockResolvedValue(),onChange=vi.fn();
 const tour=createVoiceTour({navigate,speak,onChange,location,steps:voiceTourSteps(true),enabled:()=>true,isMuted:()=>muted,storage,setTimer:vi.fn(),clearTimer:vi.fn()});
 const arrive=()=>{const [route,options]=navigate.mock.lastCall;location={route,scope:String(++number),tourToken:options.state.kuralTour};tour.routeChanged(location);};
 return {tour,navigate,speak,onChange,store,arrive,manual(route='/energy'){location={route,scope:String(++number)};tour.routeChanged(location);}};
}
it.each(['ta','hi','en'])('button-equivalent controls, language, repeat/back/finish and storage: %s',lang=>{
 const f=fixture();expect(f.speak).not.toHaveBeenCalled();
 f.tour.control('start',lang);expect(f.tour.snapshot()).toMatchObject({active:true,index:0,lang});
 f.tour.control('next');f.arrive();expect(f.tour.snapshot().index).toBe(1);
 f.tour.control('repeat');expect(f.speak.mock.lastCall[0]).toBe(tourSpokenText(voiceTourSteps(true)[1],lang));
 f.tour.control('back');f.arrive();expect(f.tour.snapshot().index).toBe(0);
 while(f.tour.snapshot().index<f.tour.snapshot().total-1){const calls=f.navigate.mock.calls.length;f.tour.control('next');if(f.navigate.mock.calls.length>calls)f.arrive();}
 expect(f.speak.mock.lastCall[0]).toBe(tourSpokenText(voiceTourSteps(true).at(-1),lang));expect(f.tour.snapshot().done).toBe(true);expect([...f.store.values()]).toEqual(['true']);
 f.tour.control('stop');expect(f.tour.snapshot().active).toBe(false);
});
it.each(['ta','hi','en'])('voice commands use tour controller only, never data answers: %s',async(lang)=>{
 enable();const f=fixture(),say=vi.fn(),resolveHeat=vi.fn();
 const handler=createTranscriptHandler({lang:'en',langBridge:true,say,resolveHeat,navigate:vi.fn(),setHeard:vi.fn(),tourControl:f.tour.control});
 const n={ta:0,hi:1,en:2}[lang];
 await handler(aliases.start[n]);expect(f.tour.snapshot().lang).toBe(lang);
 await handler(aliases.next[n]);f.arrive();await handler(aliases.repeat[n]);await handler(aliases.back[n]);f.arrive();await handler(aliases.stop[n]);
 expect(f.tour.snapshot().active).toBe(false);expect(resolveHeat).not.toHaveBeenCalled();expect(say).not.toHaveBeenCalled();
});
it('manual route change aborts only tour speech and prevents stale playback',()=>{
 const f=fixture();f.tour.control('start','ta');const timing=f.speak.mock.lastCall[3];
 expect(timing.isCurrent()).toBe(true);f.manual();expect(timing.signal.aborted).toBe(true);expect(timing.isCurrent()).toBe(false);expect(f.tour.snapshot().active).toBe(false);
});
it('quick Next aborts older steps, ignores old internal arrivals and speaks only the latest',()=>{
 const f=fixture();f.tour.control('start','en');const original=f.speak.mock.lastCall[3];
 f.tour.control('next');const [route,options]=f.navigate.mock.lastCall;
 f.tour.control('next');expect(original.signal.aborted).toBe(true);
 f.tour.routeChanged({route,scope:'old',tourToken:options.state.kuralTour});expect(f.tour.snapshot().active).toBe(true);expect(f.speak).toHaveBeenCalledTimes(1);
 f.arrive();expect(f.speak).toHaveBeenCalledTimes(2);expect(f.speak.mock.lastCall[0]).toBe(tourSpokenText(voiceTourSteps(true)[2],'en'));
});
it('mute keeps all step text and navigation without speech; storage denial is safe',()=>{
 const f=fixture({muted:true,denied:true});f.tour.control('start','hi');expect(f.tour.snapshot().text).toBeTruthy();
 while(f.tour.snapshot().index<f.tour.snapshot().total-1){const calls=f.navigate.mock.calls.length;f.tour.control('next');if(f.navigate.mock.calls.length>calls)f.arrive();}
 expect(f.speak).not.toHaveBeenCalled();expect(f.tour.snapshot().done).toBe(true);
});
it('tour step card is nonmodal, keyboard-accessible and contains its exact script',()=>{
 const f=fixture();f.tour.control('start','ta');const html=renderToStaticMarkup(<VoiceTourCard state={f.tour.snapshot()} control={()=>{}}/>);
 expect(html).toContain('Step 1/22');expect(html).toContain('Voice onboarding tour');expect(html).not.toContain('aria-modal');
 for(const label of ['Back','Next','Repeat','Stop'])expect(html).toContain(label);
 expect(html).toContain(f.tour.snapshot().text);
});
it('entire tour triggers no factory reads, writes or gate checks',()=>{
 const f=fixture();f.tour.control('start','en');
 while(f.tour.snapshot().index<f.tour.snapshot().total-1){const calls=f.navigate.mock.calls.length;f.tour.control('next');if(f.navigate.mock.calls.length>calls)f.arrive();}
 expect(factoryRead).not.toHaveBeenCalled();expect(factoryWrite).not.toHaveBeenCalled();
 expect(f.navigate.mock.calls.every(([route])=>route.startsWith('/'))).toBe(true);
});
it('remembered completion never auto-starts speech and replay remains available',()=>{
 const speak=vi.fn();const tour=createVoiceTour({navigate:vi.fn(),speak,enabled:()=>true,storage:()=>({getItem:()=> 'true'}),setTimer:vi.fn(),clearTimer:vi.fn()});
 expect(tour.snapshot()).toMatchObject({active:false,done:true});expect(speak).not.toHaveBeenCalled();
 tour.control('start','en');expect(tour.snapshot().active).toBe(true);
});
it('effect cleanup/re-attach supports React strict lifecycle without auto-start',()=>{
 const f=fixture();f.tour.dispose();f.tour.attach();expect(f.speak).not.toHaveBeenCalled();
 expect(f.tour.control('start','ta')).toBe(true);expect(f.speak).toHaveBeenCalledTimes(1);
});

it('tour cards match sidebar display names and cover all content except Charge Optimizer',()=>{
 const sidebar=readFileSync('src/components/layout/Sidebar.jsx','utf8');
 const pairs=[...sidebar.matchAll(/label: "([^"]+)",[\s\S]*?path: "([^"]+)"/g)];
 const steps=voiceTourSteps(false).filter(step=>step.route);
 expect(steps).toHaveLength(20);expect(steps.some(step=>step.route==='/charge-optimizer')).toBe(false);
 for(const step of steps){const block=sidebar.split('  {').find(block=>block.includes('path: "'+step.route+'"'));expect(block).toContain('label: "'+step.displayName+'"');}
});
it.each([false,true])('no old tips or feature-driven rewrites; handover=%s',handover=>{
 const on=voiceTourSteps(handover);
 expect(on.some(step=>'tip' in step||'purpose' in step)).toBe(false);
 for(let n=1;n<on.length;n++)expect(on[n].texts).not.toEqual(on[n-1].texts);
 expect(voiceTourSteps(handover,{shiftSummary:true,everywhere:false,languageBridge:false,handsFree:false})).toEqual(on);
});

it.each([['pause','pause'],['pause','ruko'],['resume','resume'],['resume','chalo']])('v2 command %s %s',(action,text)=>{enable();expect(mapIntent(text,{langBridge:true}).params.action).toBe(action);});
it.each(['heat 1053 status','open stock','FeSi stock','what can I ask here?'])('tour mode suppresses normal intent: %s',async text=>{
 enable();const say=vi.fn(),navigate=vi.fn(),resolveHeat=vi.fn();
 await createTranscriptHandler({lang:'en',say,navigate,resolveHeat,setHeard:vi.fn(),tourActive:()=>true})(text);
 expect(say.mock.lastCall[0]).toBe(tourRunningReply.en);expect(navigate).not.toHaveBeenCalled();expect(resolveHeat).not.toHaveBeenCalled();
});
it('safety still wins in tour mode and stop restores normal answers',async()=>{
 enable();let active=true;const say=vi.fn(),navigate=vi.fn();
 const handle=createTranscriptHandler({lang:'en',say,navigate,resolveHeat:vi.fn(),setHeard:vi.fn(),tourActive:()=>active,tourControl:action=>{if(action==='stop')active=false;}});
 await handle('start melting');expect(say.mock.lastCall[0]).toContain("can't be done by voice");
 await handle('stop tour');await handle('open stock');expect(navigate).toHaveBeenCalledWith('/raw-material-stock');
});
it('auto advance waits for speech completion then exactly two seconds; pause/resume cancels timers',async()=>{
 vi.useFakeTimers();let finish;const navigate=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak:()=>new Promise(resolve=>{finish=resolve;})});
 tour.control('start','en');await vi.advanceTimersByTimeAsync(10000);expect(navigate).not.toHaveBeenCalled();
 finish();await vi.advanceTimersByTimeAsync(1999);expect(navigate).not.toHaveBeenCalled();
 tour.control('pause');await vi.advanceTimersByTimeAsync(5000);expect(tour.snapshot().paused).toBe(true);expect(navigate).not.toHaveBeenCalled();
 tour.control('resume');finish();await vi.advanceTimersByTimeAsync(2000);expect(navigate.mock.lastCall[0]).toBe('/spectrometer');tour.dispose();
});
it('muted auto advance uses bounded reading delay and manual navigation cancels it',async()=>{
 vi.useFakeTimers();const navigate=vi.fn(),speak=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak,isMuted:()=>true});
 tour.control('start','ta');const delay=Math.max(4000,Math.ceil(tour.snapshot().text.length/12)*1000);
 await vi.advanceTimersByTimeAsync(delay-1);expect(navigate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(navigate.mock.lastCall[0]).toBe('/spectrometer');expect(speak).not.toHaveBeenCalled();
 tour.routeChanged({route:'/energy',scope:'manual'});await vi.advanceTimersByTimeAsync(60000);expect(navigate).toHaveBeenCalledTimes(1);expect(tour.snapshot().active).toBe(false);
});
it.each([['நிறுத்தி வை','pause'],['தொடரு','resume'],['रुको','pause'],['चलो','resume']])('native pause/resume %s',(text,action)=>{enable();expect(mapIntent(text,{langBridge:true}).params.action).toBe(action);});
it('every spoken line uses the colloquial pipeline and is repeat-safe',()=>{
 for(const step of voiceTourSteps(true))for(const lang of ['ta','hi','en']){
  const spoken=tourSpokenText(step,lang);expect(spoken).toBeTruthy();
  if(lang!=='en')expect(spoken).not.toMatch(/[A-Za-z]/u);
  expect(tourCommand(spoken,true)).toBeNull();
 }
});
