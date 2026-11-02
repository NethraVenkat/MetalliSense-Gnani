const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const captureSource=fs.readFileSync(path.join(__dirname,'../tools/kural_live_capture.js'),'utf8');
const uiSource=fs.readFileSync(path.join(__dirname,'../tools/kural_live_diagnostic.js'),'utf8');
const context=vm.createContext({Float32Array,Uint8Array,ArrayBuffer,DataView,Number,Math,AbortController,Promise,setTimeout,clearTimeout});
vm.runInContext(captureSource,context);vm.runInContext(uiSource,context);
const {createDownsampler,floatToPcm16,createMicCapture}=context.KuralLiveCapture;
const {createController}=context.KuralLiveUI;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fakeAudio(){
 let stopped=0,closed=0;const nodes=[];
 const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
 const track={stop(){stopped++;},getSettings(){return {sampleRate:48000,channelCount:1};}};
 const audio={sampleRate:48000,destination:{},resume:async()=>{},close:async()=>{closed++;},createMediaStreamSource:node,createScriptProcessor(){const n=node();audio.processor=n;return n;},createGain(){const n=node();n.gain={value:1};return n;}};
 return {audio,track,stream:{getTracks:()=>[track],getAudioTracks:()=>[track]},counts:()=>({stopped,closed}),nodes};
}
function controllerHarness(overrides={}){
 const calls=[],states=[],data=[],errors=[],timers=new Map();let opts,captureStopped=0,flushes=0;
 const api={start:async m=>{calls.push(['start',m]);return {session:'s'+calls.filter(c=>c[0]==='start').length,limit_seconds:300};},audio:async(s,n,b)=>{calls.push(['audio',s,n,b.byteLength]);return {session:s,points:[{audio_time:(n+1)*.08,score:.2}],events:[]};},stop:async s=>{calls.push(['stop',s]);return {session:s,stopped:true,points:[],events:[]};},expected:async m=>{calls.push(['expected',m]);return {saved:true};},...overrides.api};
 const capture={stop(){captureStopped++;},flush(){flushes++;},audioTime:()=>.08,inputRate:48000,appliedSettings:{}};
 const controller=createController({api,createContext:()=>({sampleRate:48000,resume:async()=>{},close:async()=>{}}),captureFactory:async o=>{opts=o;return capture;},onState:s=>states.push(s),onData:d=>data.push(d),onError:e=>errors.push(e),setTimer:(fn,ms)=>{timers.set(1,{fn,ms});return 1;},clearTimer:id=>timers.delete(id),...overrides,api});
 return {controller,api,calls,states,data,errors,timers,get opts(){return opts;},capture,counts:()=>({captureStopped,flushes})};
}
(async()=>{
 // Fractional resampling has the same phase regardless of callback chunk boundaries.
 for(const rate of [48000,44100]){
  const input=Float32Array.from({length:rate/10},(_,i)=>Math.sin(i*.03));
  const whole=createDownsampler(rate).process(input),split=createDownsampler(rate),parts=[];
  for(let i=0;i<input.length;i+=137)parts.push(...split.process(input.slice(i,i+137)));
  assert.equal(whole.length,1600);assert.equal(parts.length,whole.length);assert.ok(parts.every((x,i)=>Math.abs(x-whole[i])<1e-6));
 }
 assert.throws(()=>createDownsampler(NaN));assert.throws(()=>createDownsampler(8000));
 const pcm=new DataView(floatToPcm16([NaN,-2,-1,0,1,2]));assert.deepEqual(Array.from({length:6},(_,i)=>pcm.getInt16(i*2,true)),[0,-32768,-32768,0,32767,32767]);
 const a=fakeAudio(),frames=[];
 const cap=await createMicCapture({context:a.audio,mediaDevices:{getUserMedia:async()=>a.stream},onFrame:b=>frames.push(b)});
 a.audio.processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
 assert.equal(frames[0].byteLength,2560);assert.ok(cap.audioTime()>.08);cap.flush();assert.equal(frames[1].byteLength,170);
 cap.stop();cap.stop();assert.deepEqual(a.counts(),{stopped:1,closed:1});assert.ok(a.nodes.every(n=>n.disconnected));assert.equal(a.audio.processor.onaudioprocess,null);
 const late=fakeAudio(),permission=deferred(),abort=new AbortController();
 const pending=createMicCapture({context:late.audio,signal:abort.signal,mediaDevices:{getUserMedia:()=>permission.promise},onFrame:()=>assert.fail('late capture')});
 abort.abort();permission.resolve(late.stream);await assert.rejects(pending,/cancelled/);assert.equal(late.counts().stopped,1);
 const denied=fakeAudio();await assert.rejects(createMicCapture({context:denied.audio,mediaDevices:{getUserMedia:async()=>{throw Error('denied');}},onFrame(){}}),/denied/);assert.equal(denied.counts().closed,1);
 // Stop releases the capture object, but its final sample-count clock survives.
 const durationHarness=controllerHarness();let capturedSeconds=5.418625;
 durationHarness.capture.audioTime=()=>capturedSeconds;
 assert.equal(durationHarness.controller.audioTime(),0);
 await durationHarness.controller.start({consent:true});
 assert.equal(durationHarness.controller.audioTime(),5.418625);
 await durationHarness.controller.stop();
 assert.equal(durationHarness.controller.audioTime(),5.418625);
 assert.equal(durationHarness.states.at(-1).audio_time,5.418625);
 await durationHarness.controller.stop();assert.equal(durationHarness.controller.audioTime(),5.418625);
 const nextStart=deferred();durationHarness.api.start=()=>nextStart.promise;capturedSeconds=0;
 const starting=durationHarness.controller.start({consent:true});
 assert.equal(durationHarness.controller.audioTime(),0);assert.equal(durationHarness.states.at(-1).audio_time,0);
 nextStart.resolve({session:'next-duration',limit_seconds:300});await starting;
 capturedSeconds=1.2345;await durationHarness.controller.stop();assert.equal(durationHarness.controller.audioTime(),1.2345);
 let h=controllerHarness();await h.controller.start({consent:true});await h.controller.start({consent:true});assert.equal(h.calls.filter(c=>c[0]==='start').length,1);assert.equal(h.timers.get(1).ms,300000);
 h.opts.onFrame(new ArrayBuffer(2560));h.opts.onFrame(new ArrayBuffer(2560));await tick();await tick();assert.deepEqual(h.calls.filter(c=>c[0]==='audio').map(c=>c[2]),[0,1]);
 await h.controller.expected({start_seconds:0,end_seconds:.05,label:'manual'});assert.equal(h.counts().flushes,1);assert.equal(h.calls.at(-1)[0],'expected');await h.controller.stop();assert.equal(h.controller.getState().state,'idle');assert.equal(h.timers.size,0);
 await h.controller.start({consent:true});h.opts.onFrame(new ArrayBuffer(2560));await tick();assert.equal(h.calls.filter(c=>c[0]==='audio').at(-1)[2],0);await h.controller.stop();
 const startReply=deferred();h=controllerHarness({api:{start:()=>startReply.promise}});const start=h.controller.start({consent:true});await h.controller.stop();startReply.resolve({session:'late',limit_seconds:300});await start;assert.equal(h.controller.getState().state,'idle');assert.deepEqual(h.calls,[['stop','late']]);
 h=controllerHarness({api:{audio:async()=>{throw Error('transport failed');}}});await h.controller.start({consent:true});h.opts.onFrame(new ArrayBuffer(2560));await tick();await tick();assert.equal(h.controller.getState().state,'idle');assert.ok(h.counts().captureStopped>=1);assert.equal(h.calls.filter(c=>c[0]==='stop').length,1);
 const response=deferred();h=controllerHarness({api:{audio:()=>response.promise}});await h.controller.start({consent:true});h.opts.onFrame(new ArrayBuffer(2560));await tick();const stopped=h.controller.stop();assert.ok(h.counts().captureStopped>=1);response.resolve({points:[{score:.9}],events:[]});await stopped;const count=h.data.length;await tick();assert.equal(h.data.length,count);assert.equal(h.controller.getState().state,'idle');
 h=controllerHarness();await h.controller.start({consent:true});for(let i=0;i<26;i++)h.opts.onFrame(new ArrayBuffer(2560));await tick();await tick();assert.equal(h.controller.getState().state,'idle');assert.match(h.errors[0].message,/backlog/);
 h=controllerHarness();await h.controller.start({consent:true});const beacons=[];h.controller.shutdown(s=>beacons.push(s));assert.deepEqual(beacons,['s1']);assert.equal(h.timers.size,0);assert.equal(h.controller.getState().state,'idle');
 h=controllerHarness();await h.controller.start({consent:true});h.timers.get(1).fn();await tick();await tick();assert.equal(h.controller.getState().state,'idle');
 const html=fs.readFileSync(path.join(__dirname,'../tools/kural_live_diagnostic.html'),'utf8');assert.match(html,/connect-src 'self'/);assert.doesNotMatch(captureSource+uiSource,/gnani\.ai|analy[sz]eAgent|runGateCheck|startMelting|WebSocket|copilot\/voice/);
 console.log('PASS: fractional resampling/PCM, 80ms chunks/flush, permission/error/stop cleanup, duplicate Start, ordered sessions, manual marker ordering, cap/backlog, stale responses and page exit; local-only UI, no app actions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
