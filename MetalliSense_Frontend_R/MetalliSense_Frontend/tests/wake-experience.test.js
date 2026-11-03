import {it,expect,vi,afterEach} from 'vitest';
import {createWakeSession} from '../src/services/wakeWord';
import {createWakeTiming,playListeningCue} from '../src/services/wakeTiming';
const pcm=(count,value=0)=>new Int16Array(count).fill(value).buffer;
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();vi.restoreAllMocks();});
it('long command retains onset audio, takes only one STT path, strips wake and emits timing in order',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_WAKE_WORD','true');vi.spyOn(console,'info').mockImplementation(()=>{});let onFrame,resolve;const trace=[],transcribe=vi.fn(async()=> 'Kural, carbon question'),query=vi.fn(async(text,turn)=>{trace.push(...turn.events.map(e=>e.stage));turn.mark('answer_received');turn.mark('first_audio_played');});
 const s=createWakeSession({capture:async o=>{onFrame=o.onFrame;return {stop:vi.fn()};},check:()=>new Promise(r=>{resolve=r;}),transcribe,onQuery:query});
 try{await s.start();onFrame(pcm(24000,1000));onFrame(pcm(16000,2000));resolve({wake:true,remainder:'carbon',transcript:'Kural carbon'});await vi.advanceTimersByTimeAsync(0);expect(query).not.toHaveBeenCalled();onFrame(pcm(16000,2000));onFrame(pcm(12800));await vi.advanceTimersByTimeAsync(0);expect(transcribe).toHaveBeenCalledTimes(1);expect(query.mock.calls[0][0]).toBe('carbon question');const bytes=await transcribe.mock.calls[0][0].arrayBuffer();expect(bytes.byteLength).toBeGreaterThan(48044);expect(new Int16Array(bytes.slice(44))[0]).toBe(1000);expect(trace).toEqual(['speech_onset','wake_request_sent','wake_response','command_end']);expect(query.mock.calls[0][1].events.map(e=>e.stage)).toEqual([...trace,'answer_received','first_audio_played']);
 }finally{s.stop();}
});
it('short utterance uses remainder only, and muted local cue creates no audio context',async()=>{
 vi.stubEnv('VITE_WAKE_WORD','true');let onFrame;const query=vi.fn(),transcribe=vi.fn();const s=createWakeSession({capture:async o=>{onFrame=o.onFrame;return {stop:vi.fn()};},check:async()=>({wake:true,remainder:'carbon?'}),transcribe,onQuery:query});try{await s.start();onFrame(pcm(4800,1000));onFrame(pcm(24000));await new Promise(r=>setTimeout(r,0));expect(query).toHaveBeenCalledTimes(1);expect(transcribe).not.toHaveBeenCalled();}finally{s.stop();}
 const Context=vi.fn();vi.stubGlobal('AudioContext',Context);playListeningCue(true);expect(Context).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it('timing stages are emitted once without transcript logging',()=>{const info=vi.spyOn(console,'info').mockImplementation(()=>{});let n=0;const turn=createWakeTiming(()=>++n);for(const stage of ['speech_onset','wake_request_sent','wake_response','command_end','answer_received','first_audio_played'])turn.mark(stage);turn.mark('first_audio_played');expect(info).toHaveBeenCalledTimes(6);expect(turn.events.map(e=>e.ms)).toEqual([1,3,5,7,9,11]);});
