import {it,expect,vi,afterEach} from 'vitest';
import {captureActionReply} from '../src/services/voiceActionCapture';
afterEach(()=>vi.useRealTimers());
it('slow microphone setup does not consume the 8-second confirmation window; ready silence times out without STT',async()=>{
 vi.useFakeTimers();let ready,options;const stop=vi.fn(),stt=vi.fn(),states=[];const work=captureActionReply({signal:new AbortController().signal,timeout:8000,no_store:false,purpose:'confirmation',onState:s=>states.push(s)},()=>{},{capture:o=>{options=o;return new Promise(r=>ready=r);},transcribe:stt});
 await vi.advanceTimersByTimeAsync(7000);expect(states).toEqual(['starting']);ready({stop});await vi.advanceTimersByTimeAsync(0);expect(states.at(-1)).toBe('starting');options.onFrame(new Int16Array(512).buffer);expect(states.at(-1)).toBe('listening');await vi.advanceTimersByTimeAsync(7999);expect(stop).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(await work).toEqual({text:'',reason:'no_speech_timeout'});expect(stt).not.toHaveBeenCalled();
});
it('one speech utterance after ready produces one STT call and releases the microphone',async()=>{
 vi.useFakeTimers();let options;const stop=vi.fn(),stt=vi.fn(async()=>({data:{success:true,text:'yes'}}));const work=captureActionReply({signal:new AbortController().signal,timeout:8000,no_store:false,purpose:'confirmation'},()=>{},{capture:async o=>{options=o;return {stop};},transcribe:stt});await vi.advanceTimersByTimeAsync(300);options.onFrame(new Int16Array(1600).fill(1200).buffer);options.onFrame(new Int16Array(12800).buffer);expect(await work).toEqual({text:'yes',reason:'utterance'});expect(stt).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('private capture retains paused digit speech within the unchanged 12-second deadline',async()=>{
 vi.useFakeTimers();let options;const stt=vi.fn(async()=>({data:{success:true,text:'[private fixture]'}}));const work=captureActionReply({signal:new AbortController().signal,timeout:12000,no_store:true,purpose:'passcode'},()=>{},{capture:async o=>{options=o;return {stop:vi.fn()};},transcribe:stt});await vi.advanceTimersByTimeAsync(300);
 for(let i=0;i<6;i++){options.onFrame(new Int16Array(3200).fill(1500).buffer);options.onFrame(new Int16Array(16000).buffer);expect(stt).not.toHaveBeenCalled();}
 options.onFrame(new Int16Array(8000).buffer);await work;expect(stt).toHaveBeenCalledTimes(1);expect(stt.mock.calls[0][2]).toMatchObject({no_store:true,purpose:'passcode'});expect(vi.getTimerCount()).toBe(0);
});
