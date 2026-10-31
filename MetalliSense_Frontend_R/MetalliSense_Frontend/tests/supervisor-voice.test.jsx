import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,expect,it,vi } from 'vitest';
import { supervisorVoiceFor,supervisorVoiceMode,useSupervisorVoice } from '../src/services/supervisorVoice';
import { speakText } from '../src/hooks/useSpeak';
import { createHoldAnnouncer } from '../src/services/voiceGateAnswers';
import { playSpeechStream } from '../src/services/ttsStream';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();post.mockReset();});

it.each([['off',undefined,undefined],['alerts',undefined,'supervisor'],['all','supervisor','supervisor']])('mode %s selects normal/alert voices', (mode,normal,alert)=>{
 vi.stubEnv('VITE_SUPERVISOR_VOICE',mode);
 expect(supervisorVoiceFor('normal')).toBe(normal);expect(supervisorVoiceFor('alert')).toBe(alert);
});
it('unset and invalid modes default off',()=>{
 vi.stubEnv('VITE_SUPERVISOR_VOICE',undefined);expect(supervisorVoiceMode()).toBe('off');
 vi.stubEnv('VITE_SUPERVISOR_VOICE','true');expect(supervisorVoiceFor('alert')).toBeUndefined();
});
function playback(){
 vi.stubGlobal('Audio',class {play(){queueMicrotask(()=>this.onended?.());return Promise.resolve();} pause(){}});
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 post.mockResolvedValue({data:new Blob(['audio']),headers:{'x-tts-provider':'gnani:vachana-vc-v1:supervisor'}});
}
it('HOLD alert uses supervisor, ordinary reply retains original payload in alerts mode',async()=>{
 vi.stubEnv('VITE_SUPERVISOR_VOICE','alerts');playback();
 const announce=createHoldAnnouncer();
 await announce.announce('H-1053',{decision:'HOLD',checks:[]},speakText,'ta');
 expect(post.mock.lastCall[1]).toMatchObject({voice:'supervisor',style:'alert',language:'ta'});
 await speakText('ordinary reply','ta');
 expect(post.mock.lastCall[1]).toEqual({text:'ordinary reply',language:'ta',slow:false,style:'normal'});
});
it('flag off keeps the exact REST payload and unchanged spoken text',async()=>{
 vi.stubEnv('VITE_SUPERVISOR_VOICE','off');playback();await speakText('H-1053 HOLD','ta','alert');
 expect(post.mock.lastCall[1]).toEqual({text:'H-1053 HOLD',language:'ta',slow:false,style:'alert'});
});
it('all mode sends supervisor for Hindi replies',async()=>{
 vi.stubEnv('VITE_SUPERVISOR_VOICE','all');playback();await speakText('हीट होल्ड पर है','hi');
 expect(post.mock.lastCall[1]).toMatchObject({voice:'supervisor',language:'hi'});
});
it('toggle label is generic, shared selection can turn cloning off',()=>{
 let current;
 function Control(){current=useSupervisorVoice();return current.mode==='off'?null:<button>Supervisor voice (cloned, with consent)</button>;}
 vi.stubEnv('VITE_SUPERVISOR_VOICE','off');expect(renderToStaticMarkup(<Control/>)).toBe('');
 vi.stubEnv('VITE_SUPERVISOR_VOICE','all');expect(renderToStaticMarkup(<Control/>)).toContain('Supervisor voice (cloned, with consent)');
 current.toggle();expect(supervisorVoiceFor('normal')).toBeUndefined();current.toggle();expect(supervisorVoiceFor('normal')).toBe('supervisor');
});
it('stream request and REST fallback forward only the supervisor selector',async()=>{
 class Context {
  constructor(){this.currentTime=0;this.destination={};}
  resume(){return Promise.resolve();}close(){return Promise.resolve();}
  decodeAudioData(){return Promise.resolve({duration:.01});}
  createBufferSource(){const node={connect(){},stop(){node.onended?.();},start(){queueMicrotask(()=>node.onended?.());}};return node;}
 }
 vi.stubGlobal('AudioContext',Context);
 const fetch=vi.fn().mockResolvedValue(new Response('',{status:404}));vi.stubGlobal('fetch',fetch);
 post.mockResolvedValue({data:new Blob(['audio']),headers:{'x-tts-provider':'gnani:vachana-vc-v1:supervisor'}});
 await playSpeechStream('alert','ta','alert',{voice:'supervisor'});
 expect(JSON.parse(fetch.mock.lastCall[1].body)).toEqual({text:'alert',language:'ta',style:'alert',voice:'supervisor'});
 expect(post.mock.lastCall[1]).toEqual({text:'alert',language:'ta',style:'alert',voice:'supervisor',slow:false});
});
