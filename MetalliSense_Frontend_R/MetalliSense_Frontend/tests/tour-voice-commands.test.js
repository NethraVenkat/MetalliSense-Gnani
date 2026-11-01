import {it,expect,vi,afterEach} from 'vitest';
import {prefixedTourCommand} from '../src/services/tourVoiceCommands';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {createVoiceTour,voiceTourSteps} from '../src/services/voiceTour';
import {createTourMicrophone} from '../src/services/tourMicrophone';
import {createHandsFreeSession} from '../src/hooks/useHandsFree';
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
const phrases={
 'voice-next':['குரல் அடுத்து','குரல் அடுத்து போ','குரல் அடுத்த பக்கம் போ','Kural aduthu po','Kural next','Kural go next','Kural आगे जाओ','Kural अगला पेज'],
 'voice-back':['குரல் பின்னாடி போ','குரல் முந்தைய பக்கம் போ','Kural pinnadi po','Kural go back','Kural previous page','Kural पीछे जाओ'],
 'voice-pause':['குரல் நிறுத்து','குரல் கொஞ்சம் நிறுத்து','Kural niruthu','Kural pause','Kural pause pannu','Kural रुको'],
 'voice-continue':['குரல் தொடரு','குரல் continue பண்ணு','குரல் resume பண்ணு','Kural thodaru','Kural continue','Kural resume','Kural जारी रखो'],
 stop:['குரல் tour முடி','குரல் டூர் முடி','Kural tour mudichidu','Kural close tour','Kural exit tour','Kural टूर बंद करो'],
};
it.each(Object.entries(phrases).flatMap(([action,texts])=>texts.map(text=>[text,action])))('requires same-utterance prefix: %s',(text,action)=>expect(prefixedTourCommand(text)).toBe(action));
it('normalizes ordinary punctuation, case and whitespace only',()=>expect(prefixedTourCommand('  KURAL,  Go NEXT! ')).toBe('voice-next'));
it.each(['next','அடுத்து','நிறுத்து','continue','Kural','குரல்','hey Kural next','please Kural next','Kural next and pause','Kural next and approve the heat','Kural அகலவற ஜாவா','Kural next maybe','Kural hold status','Kural tour start'])('rejects incomplete, incidental or conflicting commands: %s',text=>expect(prefixedTourCommand(text)).toBeNull());
it('global safety precedes active commands and ignores noncommands without speaking',async()=>{
 vi.stubEnv('VITE_VOICE_TOUR_COMMANDS','true');
 const control=vi.fn(),say=vi.fn();
 const handler=createTranscriptHandler({lang:'ta',setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),tourActive:()=>true,tourControl:control});
 for(const text of ['Kural','next','அடுத்து','Kural next and approve the heat','Kural आगे जाओ और मंजूर करो'])await handler(text);
 expect(control).not.toHaveBeenCalled();expect(say).not.toHaveBeenCalled();
 await handler('குரல் அடுத்து போ');expect(control).toHaveBeenCalledWith('voice-next');
});
it('flag off and outside-tour transcript behavior retain their existing path',async()=>{
 const say=vi.fn(),control=vi.fn();
 const make=active=>createTranscriptHandler({lang:'en',setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),tourActive:()=>active,tourControl:control});
 await make(true)('next');expect(say).toHaveBeenCalled();expect(control).not.toHaveBeenCalled();
 vi.stubEnv('VITE_VOICE_TOUR_COMMANDS','true');say.mockClear();await make(false)('nonsense');expect(say).toHaveBeenCalled();
});
it('voice pause suspends advancement, continue restores it, boundaries do not replay or close',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_VOICE_TOUR_APPROVED_TAMIL','true');
 const calls=[];const tour=createVoiceTour({enabled:()=>true,steps:voiceTourSteps(true).map(s=>({...s,route:null})),navigate:vi.fn(),location:{scope:'same'},speak:(a,b,c,t)=>new Promise(resolve=>{calls.push({t,resolve});t.onPlaybackReady({pause:vi.fn(),resume:vi.fn(),cancel:vi.fn()});})});
 tour.control('start','ta');tour.control('voice-back');expect(calls).toHaveLength(1);
 tour.control('voice-pause');expect(tour.snapshot().paused).toBe(true);expect(tour.snapshot().autoAdvancePaused).toBe(true);
 tour.control('voice-continue');expect(tour.snapshot().paused).toBe(false);expect(tour.snapshot().autoAdvancePaused).toBe(false);expect(calls).toHaveLength(1);
 tour.control('user-scroll');calls[0].resolve();await Promise.resolve();tour.control('voice-pause');tour.control('voice-continue');await vi.advanceTimersByTimeAsync(0);expect(tour.snapshot().index).toBe(1);
 tour.control('select-step',21);const count=calls.length;tour.control('voice-next');expect(tour.snapshot().active).toBe(true);expect(calls).toHaveLength(count);tour.stop();expect(calls.at(-1).t.signal.aborted).toBe(true);
});
function micFixture(extra={}){
 const session={start:vi.fn(),stop:vi.fn()};let options;
 const changes=[];const transcript=vi.fn(),control=vi.fn();
 const mic=createTourMicrophone({onTranscript:transcript,control,onChange:s=>changes.push(s),createSession:opts=>(options=opts,session),...extra});
 mic.context({active:true,lang:'ta',scope:'a'});
 return {mic,session,changes,transcript,control,get options(){return options;}};
}
class Recorder{
 static isTypeSupported=()=>true;
 constructor(){this.state='inactive';Recorder.last=this;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
it('never opts in on start, releases on close/language change and denies late permission',async()=>{
 let permission;const stop=vi.fn();const getMedia=vi.fn(()=>new Promise(resolve=>permission=resolve));
 const f=micFixture({getMedia,Recorder});expect(f.session.start).not.toHaveBeenCalled();expect(getMedia).not.toHaveBeenCalled();
 f.mic.start();expect(f.session.start).toHaveBeenCalledOnce();
 const pending=f.mic.startPtt();f.mic.context({active:false,lang:'ta',scope:'a'});permission({getTracks:()=>[{stop}]});await pending;expect(stop).toHaveBeenCalled();f.mic.dispose();
});
it('permission denial and STT failure retain controls without extra speech',async()=>{
 const f=micFixture({getMedia:()=>Promise.reject(new Error('denied')),Recorder});await f.mic.startPtt();expect(f.changes.at(-1).state).toBe('error');expect(f.transcript).not.toHaveBeenCalled();f.mic.dispose();
 const stop=vi.fn();const g=micFixture({getMedia:async()=>({getTracks:()=>[{stop}]}),Recorder,transcribe:async()=>{throw Error('STT');}});await g.mic.startPtt();g.mic.stopPtt();await flush();expect(g.changes.at(-1).state).toBe('error');expect(stop).toHaveBeenCalled();g.mic.dispose();
});
it('PTT uses the existing 30-second cap once, releases tracks and rejects old STT',async()=>{
 vi.useFakeTimers();const stop=vi.fn(),transcribe=vi.fn(async()=>({data:{text:'Kural next'}}));
 const f=micFixture({getMedia:async()=>({getTracks:()=>[{stop}]}),Recorder,transcribe});await f.mic.startPtt();await vi.advanceTimersByTimeAsync(30000);f.mic.stopPtt();expect(transcribe).toHaveBeenCalledOnce();expect(stop).toHaveBeenCalled();expect(f.transcript).toHaveBeenCalledOnce();expect(f.control).toHaveBeenCalledWith('voice-pause');
 let resolve;const g=micFixture({getMedia:async()=>({getTracks:()=>[{stop}]}),Recorder,transcribe:()=>new Promise(r=>resolve=r)});await g.mic.startPtt();g.mic.stopPtt();g.mic.context({active:true,lang:'hi',scope:'b'});resolve({data:{text:'Kural next'}});await flush();expect(g.transcript).not.toHaveBeenCalled();f.mic.dispose();g.mic.dispose();
});
it('hands-free suppresses duplicate finals but allows a new processing utterance immediately',async()=>{
 const sockets=[],stop=vi.fn(),answer=vi.fn();let guarded=false;
 const session=createHandsFreeSession({dedupeMode:'utterance',rejectGuardedFinals:true,onTranscript:answer,isEchoGuarded:()=>guarded,
  createCapture:async()=>({stop}),createSocket:()=>{const ws={readyState:1,bufferedAmount:0,send:vi.fn(),close:vi.fn()};sockets.push(ws);return ws;}});
 session.start();await flush();const ws=sockets[0];ws.onopen();const message=data=>ws.onmessage({data:JSON.stringify(data)});message({type:'connected'});
 const final={type:'final',text:'Kural next'};message({type:'partial',code:'processing'});message(final);message(final);await flush();expect(answer).toHaveBeenCalledTimes(1);
 message({type:'partial',code:'processing'});message(final);await flush();expect(answer).toHaveBeenCalledTimes(2);
 guarded=true;message({type:'partial',code:'processing'});message({type:'final',text:'Kural pause'});await flush();expect(answer).toHaveBeenCalledTimes(2);
 session.stop();expect(stop).toHaveBeenCalled();expect(ws.onmessage).toBeNull();
});
it('PTT waits for a previous stream close and will not overlap an unresolved REST request',async()=>{
 let close;const getMedia=vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}));let resolve;
 const f=micFixture({getMedia,Recorder,transcribe:()=>new Promise(r=>resolve=r)});
 f.session.stopAndWait=()=>new Promise(r=>close=r);
 const pending=f.mic.startPtt();expect(getMedia).not.toHaveBeenCalled();close();await pending;expect(getMedia).toHaveBeenCalledOnce();f.mic.stopPtt();
 f.mic.context({active:true,lang:'hi',scope:'b'});f.mic.start();expect(f.session.start).not.toHaveBeenCalled();
 resolve({data:{text:'Kural next'}});await flush();f.mic.start();expect(f.session.start).toHaveBeenCalledOnce();f.mic.dispose();
});
it('teardown clears a pending socket-close handoff timer',async()=>{
 vi.useFakeTimers();const listener=vi.fn(),remove=vi.fn();
 const session=createHandsFreeSession({createCapture:async()=>({stop:vi.fn()}),createSocket:()=>({readyState:1,send:vi.fn(),close:vi.fn(),addEventListener:listener,removeEventListener:remove})});
 session.start();await flush();const waiting=session.stopAndWait();expect(listener).toHaveBeenCalled();
 session.stop();await waiting;expect(vi.getTimerCount()).toBe(0);expect(remove).toHaveBeenCalled();
});
