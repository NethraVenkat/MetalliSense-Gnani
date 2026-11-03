import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {createPauseGate,createWakeSession,wakeParts,wakeWordEnabled} from '../src/services/wakeWord';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {blockedVoiceReplies} from '../src/services/languageBridge';
const rows=JSON.parse(readFileSync(new URL('../../../MetalliSense_Agent_R/MetalliSense_Agent/tests/fixtures/wake-v3-parity.json',import.meta.url),'utf8'));
const pcm=(count,value=0)=>new Int16Array(count).fill(value).buffer;
afterEach(()=>vi.unstubAllEnvs());
describe('opt-in Kural wake',()=>{
 it('matches all25 frozen transcripts and strips remainder',()=>{expect(rows).toHaveLength(25);for(const r of rows)expect(wakeParts(r.transcript).wake).toBe(r.wake);expect(wakeParts('குரல், approve heat').remainder).toBe('approve heat');});
 it('confirms .27s speech, ignores50ms click, emits fixed1.5s',()=>{const found=[];const gate=createPauseGate(p=>found.push(p));gate.push(pcm(4320));gate.push(pcm(4800,1000));gate.push(pcm(24000));expect(found).toHaveLength(1);expect(found[0].byteLength).toBe(48000);gate.reset();found.length=0;gate.push(pcm(4320));gate.push(pcm(800,1000));gate.push(pcm(32000));expect(found).toHaveLength(0);});
 it('flag off owns no mic; default off; drops busy chunks and stops resource',async()=>{vi.stubEnv('VITE_WAKE_WORD','false');const capture=vi.fn();const s=createWakeSession({capture,check:vi.fn(),transcribe:vi.fn(),onQuery:vi.fn()});await s.start();expect(wakeWordEnabled()).toBe(false);expect(capture).not.toHaveBeenCalled();});
 it('paused paths do not capture and resumed resource stops',async()=>{vi.stubEnv('VITE_WAKE_WORD','true');let paused=true;const stop=vi.fn(),capture=vi.fn(async()=>({stop}));const s=createWakeSession({paused:()=>paused,capture,check:vi.fn(),transcribe:vi.fn(),onQuery:vi.fn()});expect(s.enabled).toBe(false);await s.start();expect(capture).not.toHaveBeenCalled();paused=false;s.tick();await Promise.resolve();expect(capture).toHaveBeenCalledTimes(1);paused=true;s.tick();expect(stop).toHaveBeenCalledTimes(1);s.stop();});
 it('uses the normal safety refusal for prefixed writes',async()=>{const output=vi.fn();const handle=createTranscriptHandler({lang:'ta',setHeard:()=>{},say:output,navigate:vi.fn(),resolveHeat:vi.fn()});await handle(wakeParts('குரல், approve heat').remainder);expect(output).toHaveBeenCalled();expect(output.mock.calls[0][0]).toBe(blockedVoiceReplies.en);});
 it('mocked wake remainder reaches same normal answer handler',async()=>{vi.stubEnv('VITE_WAKE_WORD','true');let onFrame;const query=vi.fn(),check=vi.fn(async()=>({wake:true,remainder:'carbon எவ்வளவு?'}));const s=createWakeSession({capture:async options=>{onFrame=options.onFrame;return {stop:vi.fn()};},check,transcribe:vi.fn(),onQuery:query});await s.start();onFrame(pcm(4800,1000));onFrame(pcm(24000));await new Promise(r=>setTimeout(r,0));expect(check).toHaveBeenCalledTimes(1);expect(query).toHaveBeenCalledWith('carbon எவ்வளவு?',expect.objectContaining({mark:expect.any(Function)}));s.stop();});
});

it('wake-only waits six seconds silently; failed checks never think or query',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_WAKE_WORD','true');let onFrame;const changes=[],query=vi.fn(),transcribe=vi.fn(),check=vi.fn(async()=>({wake:true,remainder:''}));
 const s=createWakeSession({capture:async options=>{onFrame=options.onFrame;return {stop:vi.fn()};},check,transcribe,onQuery:query,onChange:value=>changes.push(value)});
 try{await s.start();onFrame(pcm(4800,1000));onFrame(pcm(24000));await vi.advanceTimersByTimeAsync(0);expect(changes.at(-1).state).toBe('Listening…');onFrame(pcm(16000));await vi.advanceTimersByTimeAsync(6000);expect(changes.at(-1).state).toBe('Waiting for "Kural"');expect(transcribe).not.toHaveBeenCalled();expect(query).not.toHaveBeenCalled();
 check.mockRejectedValue({response:{status:502}});
 for(let i=0;i<3;i++){onFrame(pcm(4800,1000));onFrame(pcm(24000));await vi.advanceTimersByTimeAsync(0);if(i<2){expect(changes.at(-1).state).toBe('Waiting for "Kural"');expect(changes.at(-1).note).toBe('Wake check unavailable.');}}
 expect(s.enabled).toBe(false);expect(changes.some(c=>c.state==='Thinking')).toBe(false);expect(transcribe).not.toHaveBeenCalled();expect(query).not.toHaveBeenCalled();
 }finally{s.stop();vi.useRealTimers();}
});
it('wake-only captures one speech-started command and ends after 0.8 seconds silence',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_WAKE_WORD','true');let onFrame;const transcribe=vi.fn(async()=> 'carbon?'),query=vi.fn(),changes=[];
 const s=createWakeSession({capture:async o=>{onFrame=o.onFrame;return {stop:vi.fn()};},check:async()=>({wake:true,remainder:''}),transcribe,onQuery:query,onChange:c=>changes.push(c)});
 try{await s.start();onFrame(pcm(4800,1000));onFrame(pcm(24000));await vi.advanceTimersByTimeAsync(0);expect(changes.at(-1).state).toBe('Listening…');onFrame(pcm(16000));expect(transcribe).not.toHaveBeenCalled();onFrame(pcm(8000,1000));onFrame(pcm(12799));expect(transcribe).not.toHaveBeenCalled();onFrame(pcm(1));await vi.advanceTimersByTimeAsync(0);expect(transcribe).toHaveBeenCalledTimes(1);expect(query).toHaveBeenCalledWith('carbon?',expect.objectContaining({mark:expect.any(Function)}));await vi.advanceTimersByTimeAsync(30000);expect(transcribe).toHaveBeenCalledTimes(1);
 }finally{s.stop();vi.useRealTimers();}
});
it('speech-started command keeps the thirty-second cap and Stop cancels pending capture',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_WAKE_WORD','true');let onFrame;const transcribe=vi.fn(async()=> 'question'),query=vi.fn();
 const s=createWakeSession({capture:async o=>{onFrame=o.onFrame;return {stop:vi.fn()};},check:async()=>({wake:true,remainder:''}),transcribe,onQuery:query});
 try{await s.start();onFrame(pcm(4800,1000));onFrame(pcm(24000));await vi.advanceTimersByTimeAsync(0);onFrame(pcm(8000,1000));await vi.advanceTimersByTimeAsync(29999);expect(transcribe).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(transcribe).toHaveBeenCalledTimes(1);expect(query).toHaveBeenCalledTimes(1);s.stop();await vi.advanceTimersByTimeAsync(6000);expect(transcribe).toHaveBeenCalledTimes(1);
 }finally{s.stop();vi.useRealTimers();}
});
