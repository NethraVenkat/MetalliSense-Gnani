const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../tools/collect_kural_pilot.html'),'utf8');
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'../tools/kural_pilot_plan.json'),'utf8'));
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
assert.match(html,/connect-src 'none'/);assert.doesNotMatch(script,/fetch\(|WebSocket|XMLHttpRequest/);
assert.deepEqual(JSON.parse(script.match(/const PLAN=(.*);/)[1]),plan);
assert.deepEqual(plan.sessions[0].targets,{positives:40,negatives:60,background_seconds:300});
assert.deepEqual(plan.sessions[1].targets,{positives:20,negatives:30,background_seconds:300});
assert.equal(plan.sessions[2].reserved,true);assert.equal(plan.sessions[2].targets,null);
function harness(storage=new Map(),getMedia){
 const nodes=new Map(),downloads=[],blobs=new Map(),timers=new Map(),events=new Map();
 let now=0,serial=0,stopped=0,micRequests=0,latest;
 const defaults={session:'S01_TRAIN',kind:'positives',condition:'quiet-headphones'};
 const q=id=>{if(!nodes.has(id))nodes.set(id,{value:defaults[id]||'',checked:false,disabled:false,textContent:''});return nodes.get(id);};
 const stream={getTracks:()=>[{stop(){stopped++;}}],getAudioTracks:()=>[{getSettings:()=>({sampleRate:48000,channelCount:1})}]};
 class Recorder{
  static isTypeSupported(){return true;}
  constructor(){latest=this;this.state='inactive';this.mimeType='audio/webm';}
  start(){this.state='recording';}
  stop(){if(this.state!=='recording')return;this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop();}
 }
 const context=vm.createContext({Blob,Map,JSON,String,Number,Math,Date,Error,crypto:{randomUUID},performance:{now:()=>now},MediaRecorder:Recorder,
  document:{getElementById:q,createElement:()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}})},
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  navigator:{mediaDevices:{getSupportedConstraints:()=>({}),getUserMedia:()=>{micRequests++;return getMedia?getMedia(stream):Promise.resolve(stream);}}},
  URL:{createObjectURL(blob){const id='blob:'+ ++serial;blobs.set(id,blob);return id;},revokeObjectURL(id){blobs.delete(id);}},
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
  window:{addEventListener(name,fn){events.set(name,fn);}}});
 vm.runInContext(script,context);
 return {q,downloads,timers,events,storage,get stopped(){return stopped;},get micRequests(){return micRequests;},get recorder(){return latest;},advance(seconds){now+=seconds*1000;},records:()=>JSON.parse(storage.get(plan.pilot_id+':SPK01')||'[]')};
}
(async()=>{
 const h=harness();assert.equal(h.micRequests,0);assert.equal(h.q('record').disabled,true);
 await h.q('record').onclick();assert.equal(h.micRequests,0);
 h.q('consent').checked=true;h.q('consent').onchange();assert.equal(h.q('record').disabled,false);
 const start=h.q('record').onclick();await h.q('record').onclick();await start;assert.equal(h.micRequests,1);
 h.advance(3);h.q('stop').onclick();assert.equal(h.stopped,1);assert.equal(h.records().length,1);
 let r=h.records()[0];assert.equal(r.speaker_id,'SPK01');assert.equal(r.session_id,'S01_TRAIN');assert.equal(r.split,'train');assert.equal(r.consent.granted,true);assert.equal(r.prompt_id,'KP01');assert.equal(r.intended_wake_intervals,null);assert.equal(r.capture_wall_seconds,3);
 assert.match(r.filename,/S01_TRAIN_train_KP01_.*\.webm$/);assert.equal(h.downloads.length,2);
 const originalJSON=await h.downloads[1].blob.text();
 h.q('wakeStart').value='1';h.q('wakeEnd').value='2';h.q('annotate').onclick();
 assert.equal(h.records()[0].heard_wake_intervals[0].start_seconds,1);assert.equal(await h.downloads[1].blob.text(),originalJSON);
 assert.match(h.downloads[2].name,/\.annotation.json$/);
 const reload=harness(h.storage);assert.match(reload.q('progress').textContent,/positives 1\/40/);
 h.q('session').value='S02_VALID';h.q('session').onchange();assert.equal(h.q('consent').checked,false);
 h.q('kind').value='negatives';h.q('kind').onchange();h.q('consent').checked=true;h.q('consent').onchange();
 await h.q('record').onclick();h.advance(3);h.q('stop').onclick();
 r=h.records()[1];assert.equal(r.session_id,'S02_VALID');assert.equal(r.split,'validation');assert.equal(r.prompt_id,'KN01');assert.notEqual(r.recording_id,h.records()[0].recording_id);
 h.q('session').value='S03_TEST_RESERVED';h.q('session').onchange();h.q('consent').checked=true;
 await h.q('record').onclick();assert.equal(h.micRequests,2);assert.equal(h.q('record').disabled,true);
 const key=plan.pilot_id+':SPK01',seed=new Map([[key,JSON.stringify(Array.from({length:8},()=>({session_id:'S01_TRAIN',kind:'background_seconds',capture_wall_seconds:30})))]]);
 const bg=harness(seed);bg.q('kind').value='background_seconds';bg.q('kind').onchange();bg.q('consent').checked=true;bg.q('consent').onchange();
 assert.match(bg.q('prompt').textContent,/KB09/);
 await bg.q('record').onclick();bg.advance(30);[...bg.timers.values()].find(t=>t.ms===30000).fn();
 r=bg.records().at(-1);assert.equal(r.echo_playback,true);assert.equal(r.capture_wall_seconds,30);assert.equal(bg.stopped,1);assert.equal([...bg.timers.values()].filter(t=>t.ms===30000).length,0);
 await bg.q('record').onclick();bg.advance(30);[...bg.timers.values()].find(t=>t.ms===30000).fn();assert.equal(bg.q('record').disabled,true);assert.match(bg.q('progress').textContent,/300.0\/300/);
 const fail=harness(new Map(),()=>Promise.reject(Error('denied')));fail.q('consent').checked=true;await fail.q('record').onclick();assert.equal(fail.records().length,0);assert.equal(fail.timers.size,0);
 const error=harness();error.q('consent').checked=true;await error.q('record').onclick();error.recorder.onerror();assert.equal(error.records().length,0);assert.equal(error.stopped,1);assert.equal(error.timers.size,0);
 let resolve;const pending=harness(new Map(),stream=>new Promise(r=>{resolve=()=>r(stream);}));pending.q('consent').checked=true;const permission=pending.q('record').onclick();pending.events.get('pagehide')();resolve();await permission;assert.equal(pending.stopped,1);assert.equal(pending.records().length,0);assert.equal(pending.downloads.length,0);
 console.log('PASS: plan/embedded manifest parity, consent, session/split filenames, progress/reload, annotation sidecars, reserved test lock, duplicate-start prevention, background/echo blocks, cap, denied/error/late-permission cleanup, no network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
