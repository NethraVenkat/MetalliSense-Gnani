import {it,expect,vi,afterEach} from 'vitest';
import {loadedPageAnswer,loadedUnavailable} from '../src/services/loadedVoiceAnswers';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {blockedVoiceReplies} from '../src/services/languageBridge';
afterEach(()=>vi.unstubAllEnvs());
const stock={route:'/raw-material-stock',loaded:{lots:[{lotId:'PIG-0001',materialLabel:'Pig iron',availableKg:12.5,status:'HOLD'}],additives:[{alloyName:'FeSi',availableKg:7}]}};
const reading={route:'/spectrometer',loaded:{latestReading:{heatId:'H-1053',timestamp:'2026-11-03T00:00:00Z',composition:{C:.30,Si:1.2,Mn:.6}}}};
const grade={route:'/grades',selected:{grade:'SG-IRON'},loaded:{grades:[{grade:'SG-IRON',composition_ranges:{C:[3.1,3.6],Si:[1.4,2.4],Mn:[.1,.3]}}]}};
for(const lang of ['ta','hi','en']){
 it(`loaded stock/reading/grade ${lang}`,()=>{expect(loadedPageAnswer('stock எவ்வளவு இருக்கு?',stock,lang)).toContain({ta:'12.5 கிலோ',hi:'12.5 किलो',en:'12.5 kg'}[lang]);const specific=loadedPageAnswer('FeSi stock',stock,lang);expect(specific).toContain({ta:'FeSi, 7 கிலோ',hi:'FeSi, 7 किलो',en:'FeSi, 7 kg'}[lang]);expect(specific).not.toContain('PIG-0001');const r=loadedPageAnswer('latest reading',reading,lang);expect(r).toContain('H-1053');expect(r).toContain('C 0.30%');expect(loadedPageAnswer('SG-IRON spec range',grade,lang)).toContain('3.10–3.60%');expect(loadedPageAnswer('latest',{},lang)).toBe(loadedUnavailable[lang]);});
 it(`dispatch question language ${lang} and reject writes`,async()=>{vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn(),handle=createTranscriptHandler({lang,setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:reading});const question={ta:'கடைசி ரீடிங் என்ன?',hi:'आखिरी रीडिंग क्या है?',en:'latest reading'}[lang];await handle(question);expect(say.mock.calls[0][2]).toBe(lang);expect(say.mock.calls[0][0]).toContain('0.30');say.mockClear();await handle('approve latest reading');expect(Object.values(blockedVoiceReplies)).toContain(say.mock.calls[0][0]);});
}
it('flag off preserves prior unknown behavior and makes no loaded answer',async()=>{vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','false');const say=vi.fn();await createTranscriptHandler({lang:'en',setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:reading})('latest reading');expect(say.mock.calls[0][0]).not.toContain('H-1053');});
it('null/malformed fields never become fabricated zero values',()=>{expect(loadedPageAnswer('latest reading',{...reading,loaded:{latestReading:{heatId:'H-1053',timestamp:'bad',C:null}}})).toBe(loadedUnavailable.en);expect(loadedPageAnswer('stock',{route:'/raw-material-stock',loaded:{lots:[{lotId:'x',availableKg:null}]}})).toBe(loadedUnavailable.en);});
