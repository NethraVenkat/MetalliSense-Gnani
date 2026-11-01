import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {voiceTourEnabled,voiceTourSteps,tourCommand,tourStepText,tourFinish,createVoiceTour,tourSpokenText,tourRunningReply,tourPronunciation,tourSpokenOverrides} from '../src/services/voiceTour';
import {pageHelp,voicePages} from '../src/services/voicePages';
import {clarityText} from '../src/services/voiceClarity';
import {mapIntent} from '../src/services/voiceIntents';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import VoiceTourCard from '../src/components/voice/VoiceTourCard';
import latinSpeech from './fixtures/f14-latin-speech.json';
import PushToTalk from '../src/components/voice/PushToTalk';
const {factoryRead,factoryWrite}=vi.hoisted(()=>({factoryRead:vi.fn(),factoryWrite:vi.fn()}));
vi.mock('../src/services/premeltService',()=>({getHeat:factoryRead,getHeats:factoryRead,getShiftSummaryHeats:factoryRead,getAdditives:factoryRead,runGateCheck:factoryWrite,startMelting:factoryWrite,updateCharge:factoryWrite}));

afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.useRealTimers();});
const enable=()=>{vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_TOUR','true');};
it.each(['ta','hi','en'])('tour and help preserve authored sentence boundaries: %s',lang=>{
 for(const step of voiceTourSteps(true)){
  const text=tourSpokenText(step,lang);
  expect(text.match(/[.!?।,]/gu)).toEqual(tourStepText(step,lang).match(/[.!?।,]/gu));
  expect(tourPronunciation(text,lang)).toBe(text);
 }
 for(const page of voicePages)expect(clarityText(pageHelp(page,lang),lang,'colloquial')).not.toMatch(/\.\s+[a-z]/);
});
const reviewed=JSON.parse(readFileSync('tests/fixtures/f14-v4-script.json','utf8'));
const approvedTamilB=[ ['\u0b9f\u0bbe\u0bb7\u0bcd\u0baa\u0bcb\u0bb0\u0bcd\u0b9f\u0bc1',"dashboard"],
 ['\u0bb8\u0bcd\u0baa\u0bc6\u0b95\u0bcd\u0b9f\u0bcd\u0bb0\u0bcb\u0020\u0bae\u0bc0\u0b9f\u0bcd\u0b9f\u0bb0\u0bcd',"spectrometer"],
 ['\u0b95\u0bbf\u0bb0\u0bc7\u0b9f\u0bc1\u0020\u0bb8\u0bcd\u0baa\u0bc6\u0b95\u0bcd\u0bb8\u0bcd',"grade specs"],
 ['\u0b9a\u0baa\u0bcd\u0bb3\u0bc8\u0baf\u0bb0\u0bcd\u0020\u0bb8\u0bcd\u0b95\u0bcb\u0bb0\u0bcd\u0020\u0b95\u0bbe\u0bb0\u0bcd\u0b9f\u0bc1',"supplier scorecard"],
 ['\u0bb0\u0bbe\u0020\u0bae\u0bc6\u0b9f\u0bcd\u0b9f\u0bc0\u0bb0\u0bbf\u0baf\u0bb2\u0bcd\u0020\u0bb8\u0bcd\u0b9f\u0bbe\u0b95\u0bcd',"raw material stock"],
 ['\u0baf\u0bbe\u0bb0\u0bcd\u0b9f\u0bc1\u0020\u0b87\u0ba9\u0bcd\u0bb8\u0bcd\u0baa\u0bc6\u0b95\u0bcd\u0bb7\u0ba9\u0bcd',"yard inspection"],
 ['\u0baa\u0bcd\u0bb0\u0bc0\u0020\u0bae\u0bc6\u0bb2\u0bcd\u0b9f\u0bcd\u0020\u0b95\u0bc7\u0b9f\u0bcd',"pre-melt gate"],
 ['\u0bb7\u0bbf\u0b83\u0baa\u0bcd\u0b9f\u0bcd\u0020\u0bb9\u0bc7\u0ba3\u0bcd\u0b9f\u0bcb\u0bb5\u0bb0\u0bcd',"shift handover"],
 ['\u0b95\u0bbe\u0bae\u0bcd\u0baa\u0bcb\u0b9a\u0bbf\u0bb7\u0ba9\u0bcd\u0020\u0b9f\u0bbf\u0bb5\u0bbf\u0baf\u0bc7\u0bb7\u0ba9\u0bcd',"composition deviation"],
 ['\u0bae\u0bc6\u0bb2\u0bcd\u0b9f\u0bcd\u0020\u0b95\u0bb0\u0bc6\u0b95\u0bcd\u0bb7\u0ba9\u0bcd\u0020\u0baa\u0bbf\u0bb3\u0bbe\u0ba9\u0bb0\u0bcd',"melt correction planner"],
 ['\u0b85\u0b9f\u0bbe\u0baa\u0bcd\u0b9f\u0bbf\u0bb5\u0bcd\u0020\u0bb8\u0bcd\u0b9f\u0bcd\u0bb0\u0bbe\u0b9f\u0b9c\u0bbf\u0020\u0b86\u0baa\u0bcd\u0b9f\u0bbf\u0bae\u0bc8\u0b9a\u0bb0\u0bcd',"adaptive strategy optimizer"],
 ['\u0b83\u0baa\u0bc1\u0bb2\u0bcd\u0020\u0b85\u0ba9\u0bbe\u0bb2\u0bbf\u0b9a\u0bbf\u0bb8\u0bcd',"full analysis"],
 ['\u0bae\u0bc6\u0b95\u0bcd\u0b95\u0bbe\u0ba9\u0bbf\u0b95\u0bcd\u0b95\u0bb2\u0bcd\u0020\u0baa\u0bcd\u0bb0\u0bbe\u0baa\u0bcd\u0baa\u0bb0\u0bcd\u0b9f\u0bcd\u0b9f\u0bc0\u0bb8\u0bcd',"mechanical properties"],
 ['\u0b9a\u0bc7\u0bb2\u0bcd\u0bb8\u0bcd\u0020\u0b85\u0ba3\u0bcd\u0b9f\u0bcd\u0020\u0b9f\u0bbf\u0bb8\u0bcd\u0baa\u0bc7\u0b9f\u0bcd\u0b9a\u0bcd',"sales and dispatch"],
 ['\u0b87\u0ba9\u0bcd\u0bb5\u0bc6\u0ba9\u0bcd\u0b9f\u0bb0\u0bbf\u0020\u0b83\u0baa\u0bcb\u0bb0\u0bcd\u0b95\u0bbe\u0bb8\u0bcd\u0b9f\u0bcd',"inventory forecast"],
 ['\u0b95\u0bbe\u0bb8\u0bcd\u0b9f\u0bcd\u0020\u0b85\u0ba9\u0bbe\u0bb2\u0bbf\u0b9a\u0bbf\u0bb8\u0bcd',"cost analysis"],
 ['\u0b9a\u0bbf\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bbf\u0b95\u0bcd\u0020\u0b9f\u0bc7\u0b9f\u0bcd\u0b9f\u0bbe',"synthetic data"],
 ['\u0b9f\u0bcd\u0bb0\u0bc6\u0baf\u0bbf\u0ba9\u0bbf\u0b99\u0bcd\u0020\u0b9f\u0bc7\u0b9f\u0bcd\u0b9f\u0bbe',"training data"],
 ['\u0b9a\u0bc6\u0bae\u0bbe\u0ba9\u0bcd\u0b9f\u0bbf\u0b95\u0bcd\u0020\u0b9a\u0bb0\u0bcd\u0b9a\u0bcd',"semantic search"],
 ['\u0b8e\u0bb2\u0bbf\u0bae\u0bc6\u0ba9\u0bcd\u0b9f\u0bcd',"element"]];
it('applies user overrides',()=>{
 expect(approvedTamilB).toHaveLength(20);
 for(const [source,term] of approvedTamilB){
  const expected=`\u0b87\u0ba4\u0bc1 ${term}. \u0b87\u0b99\u0bcd\u0b95\u0bc7 \u0baa\u0bbe\u0b95\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd.`;
  const step={texts:{ta:`\u0b87\u0ba4\u0bc1 ${source}. \u0b87\u0b99\u0bcd\u0b95\u0bc7 \u0baa\u0bbe\u0b95\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd.`}};
  expect(tourSpokenText(step,'ta')).toBe(expected);
  expect(tourStepText(step,'ta')).toBe(step.texts.ta);
 }
});
it('override map preserves all twenty approved B spellings',()=>{
 expect(Object.keys(tourSpokenOverrides.ta).length).toBeGreaterThanOrEqual(20);
 for(const [source,term] of approvedTamilB)expect(tourSpokenOverrides.ta[source]).toBe(term);
});
it('approved speech overrides never change authored display text',()=>{
 const steps=voiceTourSteps(true),before=structuredClone(steps);
 for(const step of steps)tourSpokenText(step,'ta');
 expect(steps).toEqual(before);
 expect(steps.map(step=>tourStepText(step,'ta'))).toEqual(before.map(step=>step.texts.ta));
});
it('per-language spoken overrides leave authored captions unchanged',()=>{
 expect(tourSpokenOverrides.ta).toBeDefined();expect(Object.keys(tourSpokenOverrides.ta).length).toBeGreaterThanOrEqual(20);
 const step=voiceTourSteps(true)[0],before=structuredClone(step);
 const overrides={ta:{'டாஷ்போர்டு':'டேஷ் போர்டு'},hi:{'डैशबोर्ड':'dashboard'},en:{dashboard:'dashboard replacement'}};
 expect(tourSpokenText(step,'ta',overrides)).toBe(step.texts.ta.replace('டாஷ்போர்டு','டேஷ் போர்டு'));
 expect(tourSpokenText(step,'hi',overrides)).toBe(step.texts.hi.replace('डैशबोर्ड','dashboard'));
 expect(tourSpokenText(step,'en',overrides)).toBe(step.texts.en.replace('dashboard','dashboard replacement'));
 expect(tourStepText(step,'ta')).toBe(before.texts.ta);expect(step).toEqual(before);
 expect(tourSpokenText(step,'ta')).toBe(Object.entries(tourSpokenOverrides.ta).reduce((value,[term,replacement])=>value.replaceAll(term,replacement),before.texts.ta));
});
it('Tamil overrides match literal whole phrases once without changing punctuation or digit IDs',()=>{
 const step={texts:{ta:"காஸ்ட் அனாலிசிஸ். காஸ்ட் அனாலிசிஸ்ல. 'H-1053'?"}};
 const overrides={ta:{'காஸ்ட்':'cost','காஸ்ட் அனாலிசிஸ்':'cost analysis','cost analysis':'do not chain'}};
 expect(tourSpokenText(step,'ta',overrides)).toBe("cost analysis. cost அனாலிசிஸ்ல. 'ஹீட் one zero five three'?");
 expect(step.texts.ta).toContain('காஸ்ட் அனாலிசிஸ்.');
});
it.each(latinSpeech)('corrected speech snapshot $clipId leaves visible v4 text intact',row=>{
 const step=voiceTourSteps(true).find(step=>step.id===row.id),before=structuredClone(step);
 expect(tourSpokenText(step,row.lang)).toBe(row.after);expect(step).toEqual(before);
 expect(tourStepText(step,row.lang)).toBe(reviewed.find(item=>item.number===voiceTourSteps(true).findIndex(item=>item.id===row.id)+1)[row.lang]);
});
it('explicit Tamil inflections retain grammar without rewriting unrelated stems or எவ்வளவு',()=>{
 const text='எலிமென்ட்டும் ஹீட்டுக்கும் டெஸ்ட்க்கு டெஸ்ட்க்காக காஸ்டிங்கோட ஸ்க்ராப் லாட்டோட எவ்வளவு';
 expect(tourSpokenText({texts:{ta:text}},'ta')).toBe('elementஉம் heatக்கும் testக்கு testக்காக castingஓட scrap lotஓட எவ்வளவு');
 const unrelated='ஹோல்டிங் எனர்ஜியில் கரண்ட்ல எலிமென்ட்டோட கோவில்';
 expect(tourSpokenText({texts:{ta:unrelated}},'ta')).toBe(unrelated);
});
it('Hindi/English replacements use whole phrases once and preserve native grammar and unrelated words',()=>{
 expect(tourSpokenText({texts:{hi:'स्क्रैप लॉट की जाँच का रिज़ल्ट। एलिमेंटल होल्डिंग'}},'hi')).toBe('scrap lot की जाँच का result। एलिमेंटल होल्डिंग');
 expect(tourSpokenText({texts:{en:'go, warn, hold; holding goal warning'}},'en')).toBe('GO, WARN, HOLD; holding goal warning');
 const overrides={hi:{'स्क्रैप लॉट':'scrap lot','scrap lot':'do not chain'}};
 expect(tourSpokenText({texts:{hi:'स्क्रैप लॉट'}},'hi',overrides)).toBe('scrap lot');
});
it.each(reviewed.flatMap((row,n)=>['ta','hi','en'].map(lang=>[n,lang,row[lang]])))('verbatim reviewed v4 step %s %s',(n,lang,text)=>{
 const step=voiceTourSteps(true)[n];
 expect(tourStepText(step,lang)).toBe(text);
  const entries=Object.entries(tourSpokenOverrides[lang]||{});
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=entries.map(([term])=>term).sort((a,b)=>b.length-a.length).map(escape).join('|');
  const expected=pattern?text.replace(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{M}\\p{N}_])`,'gu'),word=>tourSpokenOverrides[lang][word]):text;
  expect(tourSpokenText(step,lang)).toBe(tourPronunciation(expected,lang));
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
 const rawControl=tour.control.bind(tour);
 tour.control=(action,lang)=>{const result=rawControl(action,lang);if(action==='start'&&tour.snapshot().step?.route===location.route)rawControl('target-ready');return result;};
 const arrive=()=>{const [route,options]=navigate.mock.lastCall;location={route,scope:String(++number),tourToken:options.state.kuralTour};tour.routeChanged(location);tour.control('target-ready');};
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
it('tour step card is compact, accessible, progress-aware and contains its exact script',async()=>{
 const f=fixture();f.tour.control('start','ta');const html=renderToStaticMarkup(<VoiceTourCard state={f.tour.snapshot()} control={()=>{}}/>);
 expect(html).toContain('Step 1 of 22');expect(html).toContain('Voice onboarding tour');expect(html).not.toContain('aria-modal');
 for(const label of ['Pause tour narration','Previous tour step','Next tour step','Close tour','Tour progress','aria-valuenow="1"','Tour language','ஆடியோ தயாராகிறது'])expect(html).toContain(label);
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
it('auto advance waits for speech completion without a fixed delay; pause/resume cancels callbacks',async()=>{
 vi.useFakeTimers();let finish;const navigate=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak:()=>new Promise(resolve=>{finish=resolve;})});
 tour.control('start','en');tour.control('target-ready');await vi.advanceTimersByTimeAsync(10000);expect(navigate).not.toHaveBeenCalled();
 tour.control('pause');finish();await Promise.resolve();await vi.advanceTimersByTimeAsync(5000);expect(tour.snapshot().paused).toBe(true);expect(navigate).not.toHaveBeenCalled();
 tour.control('resume');finish();await vi.advanceTimersByTimeAsync(0);expect(navigate.mock.lastCall[0]).toBe('/spectrometer');tour.dispose();
});
it('manual page scrolling suspends autoplay without stopping narration until explicit resume',async()=>{
 vi.useFakeTimers();let finish;const navigate=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))});
 tour.control('start','en');tour.control('target-ready');tour.control('user-scroll');
 expect(tour.snapshot()).toMatchObject({autoAdvancePaused:true,audioStatus:'loading'});
 finish();await Promise.resolve();await Promise.resolve();expect(tour.snapshot().audioStatus).toBe('finished');
 await vi.advanceTimersByTimeAsync(10000);expect(navigate).not.toHaveBeenCalled();
 tour.control('resume-autoplay');await vi.advanceTimersByTimeAsync(0);expect(navigate.mock.lastCall[0]).toBe('/spectrometer');tour.dispose();vi.useRealTimers();
});
it('programmatic readiness does not suspend autoplay and manual Next clears a scroll suspension',()=>{
 const f=fixture();f.tour.control('start','en');expect(f.tour.snapshot().autoAdvancePaused).toBe(false);
 f.tour.control('user-scroll');expect(f.tour.snapshot().autoAdvancePaused).toBe(true);
 f.tour.control('next');expect(f.tour.snapshot()).toMatchObject({index:1,autoAdvancePaused:false});f.tour.dispose();
});
it('muted auto advance uses bounded reading delay and manual navigation cancels it',async()=>{
 vi.useFakeTimers();const navigate=vi.fn(),speak=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak,isMuted:()=>true});
 tour.control('start','ta');tour.control('target-ready');const delay=Math.max(4000,Math.ceil(tour.snapshot().text.length/12)*1000);
 await vi.advanceTimersByTimeAsync(delay-1);expect(navigate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(navigate.mock.lastCall[0]).toBe('/spectrometer');expect(speak).not.toHaveBeenCalled();
 tour.routeChanged({route:'/energy',scope:'manual'});await vi.advanceTimersByTimeAsync(60000);expect(navigate).toHaveBeenCalledTimes(1);expect(tour.snapshot().active).toBe(false);
});
it('language changes abort the old narration and replay the same visual step',()=>{
 const f=fixture();f.tour.control('start','en');const oldSignal=f.speak.mock.lastCall[3].signal;
 f.tour.control('language','ta');
 expect(oldSignal.aborted).toBe(true);expect(f.tour.snapshot()).toMatchObject({index:0,lang:'ta'});
 expect(f.speak.mock.lastCall[0]).toBe(tourSpokenText(voiceTourSteps(true)[0],'ta'));
});
it('a narration failure stays on the step and offers controls instead of auto-skipping',async()=>{
 vi.useFakeTimers();const navigate=vi.fn(),speak=vi.fn((_text,_lang,_style,timing)=>{timing.onUnavailable();return Promise.resolve();});
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate,speak});
 tour.control('start','en');tour.control('target-ready');await Promise.resolve();
 expect(tour.snapshot().notice).toContain('Audio is unavailable');
 await vi.advanceTimersByTimeAsync(20000);expect(navigate).not.toHaveBeenCalled();tour.dispose();
});
it('playback status follows loading, audio start, pause and completion',async()=>{
 let resolveSpeech,timing;const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'one'},navigate:vi.fn(),speak:vi.fn((_text,_lang,_style,options)=>{timing=options;return new Promise(resolve=>{resolveSpeech=resolve;});})});
 tour.control('start','en');tour.control('target-ready');expect(tour.snapshot().audioStatus).toBe('loading');
 timing.onAudioStart();expect(tour.snapshot().audioStatus).toBe('playing');
 tour.control('pause');expect(tour.snapshot().audioStatus).toBe('paused');resolveSpeech();await Promise.resolve();expect(tour.snapshot().audioStatus).toBe('paused');
 tour.control('resume');expect(tour.snapshot().audioStatus).toBe('loading');tour.dispose();
});
it('tour card separates audio pause from autoplay suspension and exposes presentation controls',()=>{
 const f=fixture();f.tour.control('start','en');f.tour.control('user-scroll');
 const current=f.tour.snapshot();const state={...current,step:{...current.step,displayName:'Supplier Scorecard'}};
 const html=renderToStaticMarkup(<VoiceTourCard state={state} control={()=>{}} />);
 expect(html).toContain('Auto-advance paused while you explore.');expect(html).toContain('Resume autoplay');
 expect(html).toContain('Pause tour narration');expect(html).not.toContain('Focus view');
 expect(html).toContain('break-words');expect(html).toContain('Supplier Scorecard');f.tour.dispose();
});
it.each([['ta','பின்','நிறுத்து','அடுத்து','மொழி'],['hi','पीछे','रोकें','आगे','भाषा']])('guide controls retain readable native-script labels: %s',(lang,...words)=>{
 const f=fixture();f.tour.control('start',lang);
 const html=renderToStaticMarkup(<VoiceTourCard state={f.tour.snapshot()} control={()=>{}} />);
 for(const word of words)expect(html).toContain(word);
 expect(html).not.toContain('???');f.tour.dispose();
});
it('route and target failures keep the tour usable without speaking an absent step',async()=>{
 vi.useFakeTimers();const navigate=vi.fn(),speak=vi.fn();
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/energy',scope:'one'},navigate,speak,navigationTimeoutMs:80});
 tour.control('start','en');expect(navigate).toHaveBeenCalledWith('/dashboard',expect.anything());
 await vi.advanceTimersByTimeAsync(80);
 expect(tour.snapshot()).toMatchObject({active:true,ready:true,targetMissing:true,notice:'This page did not open. Use Next or Close.'});
 expect(speak).not.toHaveBeenCalled();tour.control('next');expect(navigate.mock.lastCall[0]).toBe('/spectrometer');
 const navOptions=navigate.mock.lastCall[1];tour.routeChanged({route:'/spectrometer',scope:'two',tourToken:navOptions.state.kuralTour});tour.control('target-missing');
 expect(tour.snapshot()).toMatchObject({active:true,ready:true,targetMissing:true,notice:'This spot was not found. Use Next or Close.'});
 expect(speak).not.toHaveBeenCalled();tour.control('stop');tour.dispose();
});
it('duplicate sidebar/voice starts do not create a second session',()=>{
 const f=fixture();f.tour.control('start','en');const count=f.speak.mock.calls.length;
 f.tour.control('start','ta');expect(f.speak).toHaveBeenCalledTimes(count);expect(f.tour.snapshot().lang).toBe('en');
});
it.each([['நிறுத்தி வை','pause'],['தொடரு','resume'],['रुको','pause'],['चलो','resume']])('native pause/resume %s',(text,action)=>{enable();expect(mapIntent(text,{langBridge:true}).params.action).toBe(action);});
it('every spoken line uses the colloquial pipeline and is repeat-safe',()=>{
 for(const step of voiceTourSteps(true))for(const lang of ['ta','hi','en']){
  const spoken=tourSpokenText(step,lang);expect(spoken).toBeTruthy();
  if(lang==='hi'&&['spectrometer','energy','finish'].includes(step.id))expect(spoken).toMatch(/[A-Za-z]/u);
  expect(tourCommand(spoken,true)).toBeNull();
 }
});

it('readiness cannot commit before the current navigation arrives, and stale narration cannot advance it',async()=>{
 vi.useFakeTimers();let finish;const navigate=vi.fn(),speak=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/dashboard',scope:'initial'},navigate,speak});
 tour.control('start','en');tour.control('target-ready');const oldFinish=finish;const oldSignal=speak.mock.lastCall[3].signal;
 tour.control('next');const second=navigate.mock.lastCall;
 tour.control('back');const latest=navigate.mock.lastCall;
 expect(oldSignal.aborted).toBe(true);tour.control('target-ready');expect(tour.snapshot().ready).toBe(false);
 tour.routeChanged({route:second[0],scope:'stale',tourToken:second[1].state.kuralTour});tour.control('target-ready');expect(speak).toHaveBeenCalledTimes(1);
 tour.routeChanged({route:latest[0],scope:'latest',tourToken:latest[1].state.kuralTour});tour.control('target-ready');expect(speak).toHaveBeenCalledTimes(2);
 oldFinish();await vi.advanceTimersByTimeAsync(0);expect(tour.snapshot()).toMatchObject({index:0,ready:true});expect(navigate).toHaveBeenCalledTimes(2);
 tour.control('stop');expect(tour.snapshot()).toMatchObject({active:false});expect(speak.mock.lastCall[3].signal.aborted).toBe(true);tour.dispose();
});

it('a late matching route recovers from navigation timeout only after real target readiness',async()=>{
 vi.useFakeTimers();const navigate=vi.fn(),speak=vi.fn(()=>new Promise(()=>{}));
 const tour=createVoiceTour({enabled:()=>true,location:{route:'/energy',scope:'initial'},navigate,speak,navigationTimeoutMs:80});
 tour.control('start','en');const [route,options]=navigate.mock.lastCall;
 await vi.advanceTimersByTimeAsync(80);expect(tour.snapshot()).toMatchObject({targetMissing:true,ready:true});expect(speak).not.toHaveBeenCalled();
 tour.routeChanged({route,scope:'late',tourToken:options.state.kuralTour});
 expect(tour.snapshot()).toMatchObject({targetMissing:false,ready:false});expect(speak).not.toHaveBeenCalled();
 tour.control('target-ready');expect(speak).toHaveBeenCalledTimes(1);tour.dispose();
});
it('a target timeout keeps its honest fallback until retry and stable readiness complete',()=>{
 const f=fixture();f.tour.control('start','en');f.tour.control('next');f.tour.control('next');
 const [route,options]=f.navigate.mock.lastCall;f.tour.routeChanged({route,scope:'grades',tourToken:options.state.kuralTour});f.tour.control('target-missing');
 expect(f.tour.snapshot()).toMatchObject({targetMissing:true,ready:true});expect(f.tour.snapshot().step.target).toBe('[data-tour-page="grades"]');
 const calls=f.speak.mock.calls.length;f.tour.control('retry-target');expect(f.tour.snapshot()).toMatchObject({targetMissing:false,ready:false});expect(f.speak).toHaveBeenCalledTimes(calls);
 f.tour.control('target-ready');expect(f.speak).toHaveBeenCalledTimes(calls+1);f.tour.dispose();
});


it.each(['loading','playing','paused','finished','muted','unavailable'])('emblem truthfully reflects playback status %s',status=>{
 const f=fixture();f.tour.control('start','en');const state={...f.tour.snapshot(),audioStatus:status,paused:status==='paused'};
 const html=renderToStaticMarkup(<VoiceTourCard state={state} control={()=>{}}/>);
 expect(html).toContain(`data-playback-state="${status}"`);expect(html.includes('data-speaking-bars')).toBe(status==='playing');
 expect(html).not.toMatch(/Focus view|Exit focus|floating/);expect(html).toContain('prefers-reduced-motion');f.tour.dispose();
});
it('direct step selection validates indices, cancels stale speech and records only ready visits',async()=>{
 const f=fixture();f.tour.control('start','en');const old=f.speak.mock.lastCall[3];
 expect(f.tour.snapshot().visited).toEqual(['dashboard']);
 for(const index of [-1,22,1.5,'2'])expect(f.tour.control('select-step',index)).toBe(false);
 f.tour.control('select-step',3);expect(old.signal.aborted).toBe(true);expect(old.isCurrent()).toBe(false);expect(f.tour.snapshot().visited).toEqual(['dashboard']);
 f.arrive();expect(f.tour.snapshot()).toMatchObject({index:3,ready:true});expect(f.tour.snapshot().visited).toEqual(['dashboard','supplier-scorecard']);
 expect(f.tour.snapshot().steps).toHaveLength(22);expect(f.tour.snapshot().steps.map(step=>step.id)).not.toContain('charge-optimizer');f.tour.dispose();
});
