import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createActionFlow,registry,yesNo} from '../src/services/voiceActions';
import {captureActionReply} from '../src/services/voiceActionCapture';
import {VoiceActionPanel} from '../src/components/voice/VoiceActionPanel';
import {runConfirmationPrompt} from '../src/services/voiceActionLanguages';
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
function setup({lang='en',fail=false,say=async()=>{}}={}){
 vi.useFakeTimers();let options,open,state;
 const stop=vi.fn(),transcribe=vi.fn(async()=>({data:{text:'yes'}}));
 const capture=vi.fn(o=>{options=o;return fail?Promise.reject(Error('denied')):new Promise(r=>open=()=>r({stop}));});
 const api={readback:vi.fn(),audit:vi.fn(),cancel:vi.fn(async()=>{})},execute=vi.fn(async()=>({status:200}));
 const flow=createActionFlow({api,say,capture:o=>captureActionReply(o,()=>{},{capture,transcribe}),onChange:s=>state=s});
 const work=flow.run({...registry[0],execute},{lang});
 return {flow,work,api,execute,capture,transcribe,stop,get state(){return state;},open:()=>open(),frame:(rms=0,n=1600)=>options.onFrame(new Int16Array(n).fill(Math.round(rms*32768)).buffer)};
}
it.each(['en','ta','hi'])('speaks and displays the question in %s; waits for both TTS completions, mic and frames',async lang=>{
 const endings=[];const say=vi.fn(()=>new Promise(r=>endings.push(r)));const x=setup({lang,say});
 await vi.advanceTimersByTimeAsync(9000);expect(x.capture).not.toHaveBeenCalled();endings.shift()();await vi.advanceTimersByTimeAsync(0);
 expect(say).toHaveBeenLastCalledWith(runConfirmationPrompt[lang]);expect(renderToStaticMarkup(<VoiceActionPanel state={x.state}/>)).toContain(runConfirmationPrompt[lang]);
 await vi.advanceTimersByTimeAsync(9000);expect(x.capture).not.toHaveBeenCalled();endings.shift()();await vi.advanceTimersByTimeAsync(299);expect(x.capture).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);await vi.advanceTimersByTimeAsync(5000);expect(x.state.remaining).toBeUndefined();x.open();await vi.advanceTimersByTimeAsync(0);expect(x.state.phase).toBe('confirm-starting');
 await vi.advanceTimersByTimeAsync(1000);x.frame();expect(x.state.phase).toBe('confirm');expect(x.state.remaining).toBe(8);await vi.advanceTimersByTimeAsync(1000);expect(x.state.remaining).toBe(7);
 await vi.advanceTimersByTimeAsync(6999);expect(x.execute).not.toHaveBeenCalled();expect(x.state.phase).toBe('confirm');await vi.advanceTimersByTimeAsync(1);
 expect(await x.work).toBe(false);expect(x.state.result).toBe('No reply — action not done.');expect(x.api.audit).toHaveBeenCalledWith(expect.objectContaining({decision:'timeout'}));expect(x.transcribe).not.toHaveBeenCalled();
});
it.each(['yes','no'])('card %s button uses the voice decision path and stops capture',async answer=>{
 const x=setup();await vi.advanceTimersByTimeAsync(300);x.open();await vi.advanceTimersByTimeAsync(0);x.frame();
 const panel=VoiceActionPanel({state:x.state});const choices=panel.props.children.find(child=>child?.props?.className==='voice-action-choices');
 choices.props.children[answer==='yes'?0:1].props.onClick();expect(await x.work).toBe(answer==='yes');expect(x.execute).toHaveBeenCalledTimes(answer==='yes'?1:0);expect(x.stop).toHaveBeenCalled();expect(x.api.audit).toHaveBeenCalledWith(expect.objectContaining({decision:answer==='yes'?'executed':'cancelled'}));expect(vi.getTimerCount()).toBe(0);
});
it('mic failure leaves tap fallback available without a reply timeout',async()=>{
 const x=setup({fail:true});await vi.advanceTimersByTimeAsync(300);expect(x.state.prompt).toBe('Mic not available — tap Yes or No');await vi.advanceTimersByTimeAsync(30000);expect(x.state.phase).toBe('confirm-unavailable');expect(x.api.audit).not.toHaveBeenCalled();x.state.onReply('yes');expect(await x.work).toBe(true);
});
it('captures RMS .015 for 100 ms followed by 700 ms silence and sends once',async()=>{
 const x=setup();await vi.advanceTimersByTimeAsync(300);x.open();await vi.advanceTimersByTimeAsync(0);x.frame(.015);x.frame(0,11199);expect(x.transcribe).not.toHaveBeenCalled();x.frame(0,1);expect(await x.work).toBe(true);expect(x.transcribe).toHaveBeenCalledTimes(1);expect(x.transcribe.mock.calls[0][2]).toMatchObject({purpose:'confirmation',no_store:false});expect(vi.getTimerCount()).toBe(0);
});
it('continuous speech is sent at the four second utterance limit',async()=>{
 const x=setup();await vi.advanceTimersByTimeAsync(300);x.open();await vi.advanceTimersByTimeAsync(0);x.frame(.015);await vi.advanceTimersByTimeAsync(3899);expect(x.transcribe).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(await x.work).toBe(true);expect(x.transcribe).toHaveBeenCalledTimes(1);
});
it('cancelling while mic permission is pending stops a late stream',async()=>{
 const x=setup();await vi.advanceTimersByTimeAsync(300);x.flow.cancel();expect(await x.work).toBe(false);x.open();await vi.advanceTimersByTimeAsync(0);expect(x.stop).toHaveBeenCalled();expect(x.execute).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('voice-first: segmented quiet yes is captured before setup resolves and executes without a click',async()=>{
 const log=vi.spyOn(console,'info').mockImplementation(()=>{});vi.stubEnv('VITE_VOICE_TIMING','true');
 try{
  const x=setup();await vi.advanceTimersByTimeAsync(300);
  x.frame(.015,1024);x.frame(0,512);x.frame(.015,1024);x.frame(0,11200);
  expect(await x.work).toBe(true);expect(x.execute).toHaveBeenCalledTimes(1);expect(x.transcribe).toHaveBeenCalledTimes(1);
  const stages=log.mock.calls.map(c=>c[1]?.stage);expect(stages).toEqual(['mic_requested','mic_open','reply_listen_start','first_speech_ms','peak_rms','sent']);
  x.open();await vi.advanceTimersByTimeAsync(0);expect(x.stop).toHaveBeenCalled();
 }finally{log.mockRestore();}
});
it.each(['yes','yeah','ok','ஆமா','ஆம்','सही','हाँ','हां'])('accepts explicit affirmative %s',text=>expect(yesNo(text)).toBe('yes'));
it.each(['no','இல்லை','नहीं'])('accepts explicit negative %s',text=>expect(yesNo(text)).toBe('no'));
it('APPROVE waits for the spoken prompt and first mic frame before the private window',async()=>{
 vi.useFakeTimers();let finish,options,open;const states=[],capture=vi.fn(o=>{options=o;return new Promise(r=>open=r);});
 const api={readback:vi.fn(),audit:vi.fn(),cancel:vi.fn(async()=>{}),authorize:vi.fn(async()=>({ok:false}))};
 const say=vi.fn().mockResolvedValueOnce().mockImplementationOnce(()=>new Promise(r=>finish=r));
 const flow=createActionFlow({api,say,capture:o=>captureActionReply(o,()=>{},{capture}),onChange:s=>states.push(s)});
 const work=flow.run({...registry[0],level:'APPROVE'});await vi.advanceTimersByTimeAsync(20000);expect(capture).not.toHaveBeenCalled();expect(say).toHaveBeenLastCalledWith('Say your passcode.');
 finish();await vi.advanceTimersByTimeAsync(300);open({stop:vi.fn()});await vi.advanceTimersByTimeAsync(5000);expect(states.at(-1).capturing).toBe(false);
 options.onFrame(new Int16Array(512).buffer);expect(states.at(-1).capturing).toBe(true);await vi.advanceTimersByTimeAsync(11999);expect(api.authorize).not.toHaveBeenCalled();
 flow.cancel();expect(await work).toBe(false);expect(api.authorize).not.toHaveBeenCalled();
});
it('approval countdown uses an absolute five-second deadline even when timer callbacks are delayed',async()=>{
 vi.useFakeTimers();let clock=0;const states=[],execute=vi.fn(async()=>({status:200})),api={readback:vi.fn(),audit:vi.fn(),authorize:async()=>({ok:true,token:'opaque'}),consume:vi.fn(async()=>({ok:true}))};
 const flow=createActionFlow({api,say:async()=>{},capture:async()=>({text:''}),now:()=>clock,onChange:s=>states.push(s)});
 const work=flow.run({...registry[0],level:'APPROVE',execute});await vi.advanceTimersByTimeAsync(0);expect(states.at(-1).seconds).toBe(5);
 clock=3500;await vi.advanceTimersByTimeAsync(1000);expect(states.at(-1).seconds).toBe(2);expect(execute).not.toHaveBeenCalled();clock=5000;await vi.advanceTimersByTimeAsync(1000);expect(await work).toBe(true);expect(api.consume).toHaveBeenCalledTimes(1);
});
it('result stays marked speaking until the actual result playback finishes',async()=>{
 let finish;const states=[],say=vi.fn().mockResolvedValueOnce().mockResolvedValueOnce().mockImplementationOnce(()=>new Promise(r=>finish=r));
 const flow=createActionFlow({api:{readback:vi.fn(),audit:vi.fn()},say,capture:async()=>({text:'yes'}),onChange:s=>states.push(s)});
 const work=flow.run({...registry[0],execute:async()=>({status:200,message:'Completed'})});for(let i=0;i<20;i++)await Promise.resolve();expect(states.at(-1)).toMatchObject({phase:'result',speaking:true});finish();expect(await work).toBe(true);expect(states.at(-1).speaking).toBe(false);
});
it('refusal stays open through playback and audits the refusal actually spoken',async()=>{
 let finish;const states=[],audit=vi.fn(),say=vi.fn(()=>new Promise(r=>finish=r));
 const flow=createActionFlow({api:{audit,cancel:async()=>{}},say,capture:vi.fn(),onChange:s=>states.push(s)});
 const work=flow.run({...registry[0],precheck:async()=>({ok:false})});for(let i=0;i<20;i++)await Promise.resolve();
 expect(states.at(-1)).toMatchObject({phase:'error',speaking:true});expect(audit).toHaveBeenCalledWith(expect.objectContaining({decision:'refused',spoken_reply:'Precheck refused'}));
 finish();expect(await work).toBe(false);expect(states.at(-1).speaking).toBe(false);
});
