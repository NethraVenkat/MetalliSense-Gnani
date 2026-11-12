import {it,expect,vi,afterEach} from 'vitest';
import {prepareVoiceAction} from '../src/services/voiceActionRegistry';
import {mapIntent} from '../src/services/voiceIntents';
import {pageVoiceIntent} from '../src/services/voicePages';
import {autoReplyLanguage} from '../src/services/autoReplyLanguage';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
afterEach(()=>vi.unstubAllEnvs());
const context=route=>({route,selected:{heatId:'H-1051',prId:'PR-1001'},loaded:{opcConnected:true,heats:[{heatId:'H-1051',status:'PLANNED'},{heatId:'H-1053',status:'PLANNED'}],prs:[{prId:'PR-1001',status:'PENDING_APPROVAL'}]}});
it.each([
 ['reading लो।','request_reading','/spectrometer'],['reading lo','request_reading','/spectrometer'],
 ['gate check करो, H एक हज़ार इक्यावन।','gate_check','/premelt-gate'],['gate check karo H-1051','gate_check','/premelt-gate'],
 ['PR approve करो।','approve_pr','/inventory-forecast'],['selected PR approve karo','approve_pr','/inventory-forecast'],
 ['ट्रक रिसीव करो','receive_lot','/raw-material-stock'],['truck receive karo','receive_lot','/raw-material-stock'],
 ['H-1053 melting शुरू करो','start_melting','/premelt-gate'],['H-1053 melting shuru karo','start_melting','/premelt-gate'],
])('explicit Hindi command %s',(text,id,route)=>expect(prepareVoiceAction(text,context(route))?.id).toBe(id));
it('Hindi heat numbers are preserved and HOLD still blocks the same service',async()=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');expect(mapIntent('H एक हजार तिरेपन स्थिति क्या है?').params.heatNumber).toBe(1053);
 const start=vi.fn();const action=prepareVoiceAction('H-1053 melting शुरू करो',context('/premelt-gate'),{getHeat:async()=>({data:{data:{heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD'}}}}),startMelting:start});
 await expect(action.precheck({lang:'hi'})).rejects.toThrow();expect(start).not.toHaveBeenCalled();expect(action.requiredRoles).toEqual(['Supervisor','Unit Controller']);
});
it('auto language guards short/outside/ambiguous replies and preserves flag-off',()=>{
 expect(autoReplyLanguage('gate check करो','en-IN','en',true)).toBe('hi');
 expect(autoReplyLanguage('spectrometer ku po','en-IN','hi',true)).toBe('ta');
 expect(autoReplyLanguage('please open dashboard','en-IN','ta',true)).toBe('en');
 expect(autoReplyLanguage('reading लो','hi-IN','ta',true)).toBe('ta');
 expect(autoReplyLanguage('मला dashboard पाहिजे','hi-IN','en',true)).toBe('en');
 expect(autoReplyLanguage('क्या स्थिति है','mr-IN','en',true)).toBe('en');
 expect(autoReplyLanguage('abc def ghi','hi-IN','en',true)).toBe('en');
 expect(autoReplyLanguage('please open dashboard','en-IN','ta',false)).toBe('ta');
});
it('shared transcript handler uses guarded auto language for actions and ASK replies',async()=>{
 for(const k of ['VITE_STT_AUTO_LANGUAGE','VITE_VOICE_EVERYWHERE','VITE_VOICE_ACTIONS','VITE_VOICE_PAGE_ANSWERS'])vi.stubEnv(k,'true');
 const actionControl=vi.fn().mockResolvedValue(true),say=vi.fn();
 const handler=createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:context('/premelt-gate'),actionControl});
 await handler('gate check करो H-1051',{detected_language_code:'hi-IN'});
 expect(actionControl).toHaveBeenCalledWith('gate check करो H-1051',expect.anything(),{language:'hi'});
 const navSay=vi.fn();const nav=createTranscriptHandler({lang:'en',setHeard:vi.fn(),say:navSay,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:{route:'/dashboard'},actionControl:vi.fn().mockResolvedValue(false)});
 await nav('spectrometer ku po',{detected_language_code:'en-IN'});
 expect(navSay.mock.calls.at(-1)[2]).toBe('ta');
});
it('latest-reading Hindi remains a read, not request-reading',()=>{
 for(const k of ['VITE_VOICE_EVERYWHERE','VITE_VOICE_DATA_READS'])vi.stubEnv(k,'true');
 for(const text of ['लेटेस्ट reading दिखाओ','latest reading dikhao','आखिरी रीडिंग दिखाओ']){expect(prepareVoiceAction(text,context('/spectrometer'))).toBeNull();expect(mapIntent(text).intent).toBe('spectrometer_heat_reading');}
 expect(pageVoiceIntent('spectrometer जाओ')?.params.route).toBe('/spectrometer');
});
it('strict navigation beats reading fallback but never invents coupon or a mutation alias',()=>{
 for(const k of ['VITE_VOICE_EVERYWHERE','VITE_VOICE_DATA_READS'])vi.stubEnv(k,'true');
 for(const [text,route] of [['spectrometer ku po','/spectrometer'],['pre melt gate ku po','/premelt-gate'],['stock page ku po','/raw-material-stock'],['spectrometer open pannu','/spectrometer'],['spectrometer जाओ','/spectrometer']])expect(mapIntent(text,{currentRoute:'/dashboard'})).toMatchObject({intent:'open_screen',params:{route}});
 expect(pageVoiceIntent('spectrometer',{currentRoute:'/dashboard'})?.intent).toBe('open_screen');expect(pageVoiceIntent('spectrometer',{currentRoute:'/spectrometer'})).toBeNull();
 expect(pageVoiceIntent('இருப்பு',{currentRoute:'/inventory-forecast'})).toBeNull();
 for(const text of ['Spectrometer coupon.','spectrometer H-1053','spectrometer delete','spectrometer melting start'])expect(pageVoiceIntent(text,{currentRoute:'/dashboard'})).toBeNull();
 expect(mapIntent('start melting H-1053',{currentRoute:'/dashboard'}).intent).toBe('blocked');
 expect(mapIntent('latest spectrometer reading',{currentRoute:'/dashboard'}).intent).toBe('spectrometer_heat_reading');
});
