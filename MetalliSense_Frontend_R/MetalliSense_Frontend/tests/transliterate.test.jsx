import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {TransliterationToggle,TransliterationLine} from '../src/components/voice/PushToTalk';
import {latinTranscript,handleDisplayTranscription,readTransliteratePreference,saveTransliteratePreference,createLatinDisplay} from '../src/services/transcriptDisplay';
import {transcribeAudio,transliterateAudio} from '../src/services/copilotService';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post,interceptors:{response:{use:vi.fn()}}})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it.each(['false','true'])('toggle follows VITE_TRANSLITERATE=%s',flag=>{
 vi.stubEnv('VITE_TRANSLITERATE',flag);
 const html=renderToStaticMarkup(<TransliterationToggle enabled={false} onChange={()=>{}}/>);
 expect(html.includes('Show in English letters')).toBe(flag==='true');
});
it('Latin line is small grey and shown only with flag, preference and returned text',()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');
 expect(renderToStaticMarkup(<TransliterationLine show text="aayirathi"/>)).toContain('Heard (English letters): aayirathi');
 expect(renderToStaticMarkup(<TransliterationLine show text="aayirathi"/>)).toContain('text-slate-500');
 expect(renderToStaticMarkup(<TransliterationLine show text=""/>)).toBe('');
 expect(renderToStaticMarkup(<TransliterationLine show={false} text="aayirathi"/>)).toBe('');
 vi.stubEnv('VITE_TRANSLITERATE','false');expect(renderToStaticMarkup(<TransliterationLine show text="aayirathi"/>)).toBe('');
});
it('main form never asks for transliteration; separate request is flagged',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','false');transcribeAudio(new Blob(['audio']),null,{transliterate:true});
 expect([...post.mock.lastCall[1].keys()]).toEqual(['audio']);
 vi.stubEnv('VITE_TRANSLITERATE','true');transcribeAudio(new Blob(['audio']));
 expect([...post.mock.lastCall[1].keys()]).toEqual(['audio']);
 await transcribeAudio(new Blob(['audio']),null,{transliterate:true});expect([...post.mock.lastCall[1].keys()]).toEqual(['audio']);
 await transliterateAudio(new Blob(['audio']));expect(post.mock.lastCall[0]).toBe('/copilot/voice/transliterate');
});
it('preference persists and denied localStorage is harmless',()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const store=new Map();
 vi.stubGlobal('localStorage',{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)});
 expect(readTransliteratePreference()).toBe(false);saveTransliteratePreference(true);expect(readTransliteratePreference()).toBe(true);
 vi.stubEnv('VITE_TRANSLITERATE','false');expect(readTransliteratePreference()).toBe(false);
 vi.stubEnv('VITE_TRANSLITERATE','true');vi.stubGlobal('localStorage',{getItem(){throw Error();},setItem(){throw Error();}});
 expect(readTransliteratePreference()).toBe(false);expect(()=>saveTransliteratePreference(true)).not.toThrow();
});
it.each([true,false])('missing Latin text never produces a fake second line, requested %s',requested=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');expect(latinTranscript({text:'தமிழ்'},requested)).toBe('');
});
it('main blocked phrase wins even when Latin text is a safe heat question',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const say=vi.fn(),resolveHeat=vi.fn(),onLatin=vi.fn();
 const handler=createTranscriptHandler({lang:'ta',say,setHeard:vi.fn(),navigate:vi.fn(),resolveHeat});
 await handleDisplayTranscription({text:'start melting',transcript_latin:'heat 1053 status enna'},handler,onLatin,true);
 expect(say.mock.lastCall[0]).toBe("This can't be done by voice. Please use the screen.");expect(resolveHeat).not.toHaveBeenCalled();expect(onLatin).toHaveBeenCalledWith('');
});
it('only main transcript and metadata reach the shared answer handler',()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const handler=vi.fn(),onLatin=vi.fn();
 handleDisplayTranscription({text:'heat 1053 status என்ன',detected_language_code:'ta-IN',transcript_latin:'start melting'},handler,onLatin,true);
 expect(handler).toHaveBeenCalledWith('heat 1053 status என்ன',{text:'heat 1053 status என்ன',detected_language_code:'ta-IN'});
 expect(handler.mock.lastCall[1]).not.toHaveProperty('transcript_latin');expect(onLatin).toHaveBeenCalledWith('');
});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
it('optional call begins only after answer handler resolves and does not block answer completion',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const main=deferred(),latin=deferred(),onText=vi.fn(),request=vi.fn(()=>latin.promise);
 const controller=createLatinDisplay({request,onText}),ticket=controller.invalidate(),file=new Blob(['same audio']);
 const result=controller.afterMain({text:'main'},()=>main.promise,file,true,ticket);
 await flush();expect(request).not.toHaveBeenCalled();main.resolve('answer shown and speak called');
 expect(await result).toBe('answer shown and speak called');await flush();expect(request).toHaveBeenCalledWith(file);
 latin.resolve({data:{transcript_latin:'main in Latin'}});await controller.beforeMain();expect(onText).toHaveBeenLastCalledWith('main in Latin');
});
it('new recording drops late text and waits for old optional request before next upload',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const latin=deferred(),onText=vi.fn();
 const controller=createLatinDisplay({request:()=>latin.promise,onText});const ticket=controller.invalidate();
 await controller.afterMain({text:'old'},async()=>{},new Blob(['audio']),true,ticket);
 await flush();
 controller.invalidate();let ready=false;void controller.beforeMain().then(()=>{ready=true;});await flush();expect(ready).toBe(false);
 latin.resolve({data:{transcript_latin:'stale'}});await controller.beforeMain();expect(ready).toBe(true);expect(onText).not.toHaveBeenCalledWith('stale');
});
it('toggle off and unavailable/error outcomes never trigger or affect the answer',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const onText=vi.fn(),request=vi.fn().mockResolvedValue({data:{unavailable:true}});
 const controller=createLatinDisplay({request,onText});let ticket=controller.invalidate();
 await controller.afterMain({text:'main'},async()=>{},new Blob(['audio']),false,ticket);expect(request).not.toHaveBeenCalled();
 await controller.afterMain({text:'main'},async()=>{},new Blob(['audio']),true,ticket);await controller.beforeMain();expect(onText).toHaveBeenLastCalledWith('');
 request.mockRejectedValue(Error('offline'));ticket=controller.invalidate();
 await controller.afterMain({text:'main'},async()=>{},new Blob(['audio']),true,ticket);await controller.beforeMain();expect(onText).toHaveBeenLastCalledWith('');
});
it('opted-in HTTP STT requests never overlap, including across callers',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const first=deferred();post.mockReturnValueOnce(first.promise).mockResolvedValue({data:{}});
 const latin=transliterateAudio(new Blob(['first']));await flush();const main=transcribeAudio(new Blob(['next']));await flush();
 expect(post).toHaveBeenCalledTimes(1);expect(post.mock.lastCall[0]).toBe('/copilot/voice/transliterate');
 first.resolve({data:{unavailable:true}});await latin;await main;expect(post.mock.lastCall[0]).toBe('/copilot/voice/transcribe');
});
it('speech completes before optional upload without holding the answer handler',async()=>{
 vi.stubEnv('VITE_TRANSLITERATE','true');const speech=deferred(),request=vi.fn().mockResolvedValue({data:{transcript_latin:'Latin'}});
 const controller=createLatinDisplay({request,onText:vi.fn(),afterSpeech:()=>speech.promise});
 await controller.afterMain({text:'main'},async()=> 'answer shown',new Blob(['audio']),true,controller.invalidate());
 await flush();expect(request).not.toHaveBeenCalled();
 speech.resolve();await flush();expect(request).toHaveBeenCalledOnce();await controller.beforeMain();
});
