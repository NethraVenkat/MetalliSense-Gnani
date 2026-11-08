import {it,expect,vi,afterEach} from 'vitest';
import {mapIntent} from '../src/services/voiceIntents';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {voiceAskReply} from '../src/services/voiceAskAnswers';
import fixtures from './fixtures/f17-ask-v2.json';
import golden from './fixtures/f17-ask-v2-expected.json';
import {voiceTestLog} from '../src/services/voiceTestLog';
import {redactVoiceText} from '../src/services/voiceAuditText';
import {prepareVoiceAction} from '../src/services/voiceActionRegistry';
import {nativeActions} from '../src/services/voiceActionLanguages';
import {createActionFlow} from '../src/services/voiceActions';
afterEach(()=>vi.unstubAllEnvs());
it.each(golden.filter(row=>row.page==='/inventory-forecast'||row.page==='/sales'||row.intent==='movements'))('loaded ASK routing avoids legacy stock/action fallthrough: $page/$intent',async row=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn();
 const context={route:row.page,loaded:structuredClone(fixtures.overrides?.[row.page+'/'+row.intent]??fixtures.pages[row.page]),selected:{}};
 await createTranscriptHandler({lang:'en',say,setHeard:()=>{},pageContext:context})(row.question);
 expect(say.mock.calls[0][0]).toBe(voiceAskReply(row.question,context,'en').displayText);
});
it.each(['What is the invoice? approve it','What weight is ready for invoice? start melting','issue invoice'])('invoice read exception never permits appended commands: %s',async text=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn();
 await createTranscriptHandler({lang:'en',say,setHeard:()=>{},pageContext:{route:'/sales',loaded:fixtures.pages['/sales']}})(text);
 expect(say.mock.calls[0][0]).toMatch(/screen/i);
});
it.each(['opc_connect','opc_disconnect'])('%s native and English aliases require approval and reuse the exact screen service',async id=>{
 const phrases=[nativeActions[id].canonical,...nativeActions[id].en,...nativeActions[id].ta,...nativeActions[id].hi];
 for(const phrase of phrases){const service=vi.fn(async()=>({status:200,data:{success:true}})),context={route:'/spectrometer',loaded:{opcConnected:id==='opc_disconnect'}},name=id==='opc_connect'?'connectSpectrometerOPC':'disconnectSpectrometerOPC';
  const action=prepareVoiceAction(phrase,context,{[name]:service});expect(action.level).toBe('APPROVE');expect(action.requiredRoles).toEqual(['Supervisor','Unit Controller']);await action.precheck();expect(service).not.toHaveBeenCalled();expect(action.buildSummary({lang:'en'}).spokenText).toContain('Spectrometer OPC');await action.execute({user:{name:'Mock supervisor'}});expect(service).toHaveBeenCalledExactlyOnceWith();
 }
 expect(prepareVoiceAction(nativeActions[id].canonical,{route:'/yard-inspection'})).toBeNull();
});
it('OPC refusal or Cancel never reaches the screen connection service',async()=>{
 vi.useFakeTimers();try{
  for(const mode of ['role-refused','cancel']){const service=vi.fn(),action=prepareVoiceAction('connect OPC',{route:'/spectrometer',loaded:{opcConnected:false}},{connectSpectrometerOPC:service}),spoken=[];
   const api={readback:vi.fn(),audit:vi.fn(),authorize:async()=>({ok:mode==='cancel',token:'opaque',user:{name:'Mock supervisor'}}),consume:vi.fn(),cancel:async()=>{}};
   const flow=createActionFlow({api,say:async text=>spoken.push(text),capture:async()=>({text:'••••••'})});const work=flow.run(action);await vi.advanceTimersByTimeAsync(1);if(mode==='cancel')flow.cancel();await vi.advanceTimersByTimeAsync(6000);expect(await work).toBe(false);expect(service).not.toHaveBeenCalled();expect(api.consume).not.toHaveBeenCalled();expect(spoken[0]).toContain('Spectrometer OPC');expect(spoken[1]).toBe('Say your passcode.');
  }
 }finally{vi.useRealTimers();}
});
it('ASK records the page, specific intent, masked transcript and spoken reply exactly once',async()=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');vi.stubEnv('VITE_VOICE_AUDIT','true');const audit=vi.fn(),say=vi.fn();
 const handler=createTranscriptHandler({lang:'en',say,audit,setHeard:()=>{},pageContext:{route:'/spectrometer',loaded:{latestReading:{C:3.5}}}});
 await handler('What is carbon?');expect(audit).toHaveBeenCalledTimes(1);expect(audit).toHaveBeenCalledWith(expect.objectContaining({page:'/spectrometer',intent:'carbon',level:'ASK',decision:'executed',spoken_reply:say.mock.calls[0][1]}));
 vi.stubEnv('VITE_VOICE_AUDIT','false');await handler('What is carbon?');expect(audit).toHaveBeenCalledTimes(1);
});
it('markdown export leaves Result blank, escapes table text, and redacts private/credential material',()=>{
 const secret=crypto.randomUUID().replaceAll('-',''),rows=[{ts:'2026-11-05T06:00:00Z',page:'/premelt-gate',transcript:'H-1053 status',intent:'heat_status',level:'ASK',decision:'executed',spoken_reply:'HOLD | needs review\nSee page'}, {ts:'2026-11-05T06:00:00Z',confirmation:'passcode',transcript:secret,spoken_reply:secret,level:'APPROVE'}];
 const text=voiceTestLog(rows,'2026-11-05');expect(text.includes(secret)).toBe(false);expect(text).toContain('| Time | Page | Heard | Intent | Level | Decision | Spoken reply | Result |');expect(text).toContain('11:30:00');expect(text).toContain('HOLD \\| needs review See page |  |');expect(text).not.toContain('H-1053');expect(redactVoiceText('token='+secret).includes(secret)).toBe(false);
});
it.each(["what's the status of H-1053",'H-1053 gate status','is it on hold H-1053','H-1053 நிலை','H-1053 ஸ்டேட்டஸ்','H-1053 स्थिति','H-1053 स्टेटस'])('heat status wins over symbols: %s',text=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');expect(mapIntent(text)).toMatchObject({intent:'heat_status',params:{heatNumber:1053}});
});
it.each(golden)('all ASK template parts use the requested language: $page/$intent',row=>{
 const context={route:row.page,loaded:structuredClone(fixtures.overrides?.[row.page+'/'+row.intent]??fixtures.pages[row.page]),selected:{}};
 for(const lang of ['en','ta','hi']){const answer=voiceAskReply(row.question,context,lang,{now:fixtures.now});expect(answer).not.toBeNull();const foreign=lang==='en'?/[\u0b80-\u0bff\u0900-\u097f]/u:lang==='ta'?/[\u0900-\u097f]/u:/[\u0b80-\u0bff]/u;expect(answer.displayText).not.toMatch(foreign);expect(answer.spokenText).not.toMatch(foreign);}
});
it('an English element question uses English range words even when the saved UI language is Tamil',async()=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn();const heat={heatId:'H-1053',gateResult:{checks:[{id:'spec_prediction',details:[{element:'S',value:.015,min:0,max:.03,status:'PASS'}]}]}};
 await createTranscriptHandler({lang:'ta',say,setHeard:()=>{},resolveHeat:async()=>heat})('What is S% for H-1053?');
 expect(say.mock.calls[0][0]).toContain('Range 0 to 0.03');expect(say.mock.calls[0][0]).not.toMatch(/[\u0b80-\u0bff]/u);expect(say.mock.calls[0][2]).toBe('en');
});
it.each(["what's this?","what’s this?",'status','cost','scope'])('words and apostrophes never become single-letter elements: %s',text=>expect(mapIntent(text).intent).not.toBe('element_value'));
it.each(['S','S%','S %'])('explicit symbol remains supported: %s',text=>expect(mapIntent(text)).toMatchObject({intent:'element_value',params:{element:'S'}}));
it.each([['en',"what's the status of H-1053"],['ta','H-1053 நிலை'],['hi','H-1053 स्थिति']])('loaded HOLD status and reason in %s use no heat fetch',async(lang,text)=>{
 vi.stubEnv('VITE_VOICE_PAGE_ANSWERS','true');const say=vi.fn(),resolveHeat=vi.fn();
 const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',blocking:['Copper above limit'],checks:[{id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]}]}};
 const context={route:'/premelt-gate',loaded:{heat}};const run=createTranscriptHandler({lang,say,setHeard:()=>{},resolveHeat,pageContext:context});await run(text);
 expect(say.mock.calls[0][0]).toContain('HOLD');expect(say.mock.calls[0][0]).toMatch(/Copper|செம்பு|कॉपर/);expect(resolveHeat).not.toHaveBeenCalled();expect(heat.gateResult.decision).toBe('HOLD');
 await run(text.replace('1053','9999'));expect(say.mock.calls.at(-1)[0]).not.toContain('HOLD');
});
