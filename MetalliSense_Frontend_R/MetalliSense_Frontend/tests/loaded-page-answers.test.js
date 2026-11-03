import {it,expect,vi,afterEach} from 'vitest';
import {loadedPageAnswer,loadedPageReply,latestReadingReply,loadedUnavailable} from '../src/services/loadedVoiceAnswers';
import {toSpokenText} from '../src/services/spokenText';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {blockedVoiceReplies} from '../src/services/languageBridge';
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
const stock={route:'/raw-material-stock',loaded:{lots:[{lotId:'PIG-0001',materialLabel:'Pig iron',availableKg:12.5,status:'HOLD'}],additives:[{alloyName:'FeSi',availableKg:7}]}};
const reading={route:'/spectrometer',loaded:{latestReading:{heatId:'H-1053',timestamp:'2026-11-03T00:00:00Z',composition:{C:.30,Si:1.2,Mn:.6}}}};
const grade={route:'/grades',selected:{grade:'SG-IRON'},loaded:{grades:[{grade:'SG-IRON',composition_ranges:{C:[3.1,3.6],Si:[1.4,2.4],Mn:[.1,.3]}}]}};
for(const lang of ['ta','hi','en']){
 it(`loaded stock/reading/grade ${lang}`,()=>{expect(loadedPageAnswer('stock எவ்வளவு இருக்கு?',stock,lang)).toContain({ta:'12.5 கிலோ',hi:'12.5 किलो',en:'12.5 kg'}[lang]);const specific=loadedPageAnswer('FeSi stock',stock,lang);expect(specific).toContain({ta:'FeSi, 7 கிலோ',hi:'FeSi, 7 किलो',en:'FeSi, 7 kg'}[lang]);expect(specific).not.toContain('PIG-0001');const r=loadedPageAnswer('latest reading',reading,lang);expect(r).toContain('H-1053');expect(r).toContain('C 0.30%');expect(loadedPageAnswer('SG-IRON spec range',grade,lang)).toContain('3.10–3.60%');expect(loadedPageAnswer('latest',{},lang)).toBe(loadedUnavailable[lang]);});
 it(`dispatch question language ${lang} and reject writes`,async()=>{vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn(),handle=createTranscriptHandler({lang,setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:reading});const question={ta:'கடைசி ரீடிங் என்ன?',hi:'आखिरी रीडिंग क्या है?',en:'latest reading'}[lang];await handle(question);expect(say.mock.calls[0][2]).toBe(lang);expect(say.mock.calls[0][0]).toContain('0.30');say.mockClear();await handle('approve latest reading');expect(Object.values(blockedVoiceReplies)).toContain(say.mock.calls[0][0]);});
}
it('flag off preserves prior unknown behavior and makes no loaded answer',async()=>{vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','false');const say=vi.fn();await createTranscriptHandler({lang:'en',setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:reading})('latest reading');expect(say.mock.calls[0][0]).not.toContain('H-1053');});
it('null/malformed fields never become fabricated zero values',()=>{expect(loadedPageAnswer('latest reading',{...reading,loaded:{latestReading:{heatId:'H-1053',timestamp:'bad',C:null}}})).toBe(loadedUnavailable.en);expect(loadedPageAnswer('stock',{route:'/raw-material-stock',loaded:{lots:[{lotId:'x',availableKg:null}]}})).toBe(loadedUnavailable.en);});
const now=new Date('2026-11-03T15:00:00Z');
const latest={timestamp:'2026-11-03T14:57:00Z',composition:{C:3.51,Si:2.29,Mn:.63}};
const approved={
 ta:'லேட்டஸ்ட் ரீடிங்: கார்பன் 3.51 பர்சென்ட், சிலிகான் 2.29, மாங்கனீஸ் 0.63. நேரம் 8:27.',
 hi:'ताज़ा रीडिंग: कार्बन 3.51 प्रतिशत, सिलिकॉन 2.29, मैंगनीज़ 0.63. समय 8:27.',
 en:'Latest reading: carbon 3.51 percent, silicon 2.29, manganese 0.63. Taken at 8:27.',
};
for(const lang of ['ta','hi','en']){
 it(`approved latest-reading display/speech without an absent heat announcement: ${lang}`,()=>{
  const reply=latestReadingReply(latest,lang,now);
  expect(reply).toEqual({displayText:'C 3.51% · Si 2.29% · Mn 0.63% — 8:27 PM',spokenText:toSpokenText(approved[lang],lang)});
  expect(reply.displayText).not.toMatch(/unavailable|ID|Heat|ஹீட்|हीट/);expect(reply.spokenText).not.toMatch(/unavailable|ID/);
 });
 it(`optional heat is the final sentence after values and time: ${lang}`,()=>{
  const heat={en:'Heat',ta:'ஹீட்',hi:'हीट'}[lang],reply=latestReadingReply({...latest,heatId:'H-1053'},lang,now);
  expect(reply.displayText).toBe(`C 3.51% · Si 2.29% · Mn 0.63% — 8:27 PM. ${heat} H-1053.`);
  expect(reply.spokenText).toBe(toSpokenText(`${approved[lang]} ${heat} H-1053.`,lang));
 });
 it(`prior-day readings prepend the date to displayed time: ${lang}`,()=>{
  expect(latestReadingReply({...latest,timestamp:'2026-11-02T14:57:00Z'},lang,now)).toEqual({displayText:'C 3.51% · Si 2.29% · Mn 0.63% — Nov 2, 8:27 PM',spokenText:toSpokenText(approved[lang],lang)});
 });
 it(`two decimal precision reaches the existing speech normalizer: ${lang}`,async()=>{
  vi.useFakeTimers();vi.setSystemTime(now);vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');
  const row={createdAt:latest.timestamp,C:0,Si:2.3,Mn:.6},page={route:'/spectrometer',loaded:{latestReading:row,loading:true}};
  const raw=approved[lang].replace('3.51','0.00').replace('2.29','2.30').replace('0.63','0.60'),say=vi.fn();
  const question={en:'latest reading',ta:'கடைசி ரீடிங் என்ன?',hi:'आखिरी रीडिंग क्या है?'}[lang];
  await createTranscriptHandler({lang,setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:page})(question);
  expect(say).toHaveBeenCalledWith('C 0.00% · Si 2.30% · Mn 0.60% — 8:27 PM',toSpokenText(raw,lang),lang,{pronunciationOnly:true});
  expect(loadedPageReply(question,page,lang)).toEqual({displayText:say.mock.calls[0][0],spokenText:toSpokenText(raw,lang)});
 });
}
it('today is determined in the client timezone across midnight, without changing data or inventing missing values',()=>{
 const beforeMidnight={timestamp:'2026-11-02T18:25:00Z',composition:{C:3.5,Si:null,Mn:undefined}},saved=JSON.stringify(beforeMidnight);
 const reply=latestReadingReply(beforeMidnight,'en',new Date('2026-11-02T18:35:00Z'));
 expect(reply.displayText).toBe('C 3.50% — Nov 2, 11:55 PM');expect(reply.spokenText).not.toMatch(/silicon|manganese/);expect(JSON.stringify(beforeMidnight)).toBe(saved);
 expect(latestReadingReply({timestamp:'2026-11-02T18:31:00Z',C:3.5},'en',new Date('2026-11-02T18:35:00Z')).displayText).toBe('C 3.50% — 12:01 AM');
});
