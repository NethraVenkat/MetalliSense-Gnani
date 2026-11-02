const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {randomUUID}=require('node:crypto'),{execFileSync}=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'../tools/collect_kural_topup.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
assert.match(html,/connect-src 'none'/);assert.doesNotMatch(script,/fetch\(|WebSocket|XMLHttpRequest/);
function harness(storage=new Map(),getMedia){
 const nodes=new Map(),downloads=[],blobs=new Map(),timers=new Map(),events=new Map(),writes=[];
 let now=0,serial=0,stopped=0,micRequests=0,latest;
 const q=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='task'?'TP01':id==='condition'?'quiet-headphones':'',checked:false,disabled:false,textContent:''});return nodes.get(id);};
 const stream={getTracks:()=>[{stop(){stopped++;}}],getAudioTracks:()=>[{getSettings:()=>({sampleRate:48000,channelCount:1})}]};
 class Recorder{
  static isTypeSupported(){return true;}
  constructor(){latest=this;this.state='inactive';this.mimeType='audio/webm';}
  start(){this.state='recording';}
  stop(){if(this.state!=='recording')return;this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop();}
 }
 const context=vm.createContext({Blob,Map,JSON,String,Number,Math,Date,Error,crypto:{randomUUID},performance:{now:()=>now},MediaRecorder:Recorder,
  document:{getElementById:q,createElement:()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}})},
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>{writes.push(key);storage.set(key,value);}},
  navigator:{mediaDevices:{getSupportedConstraints:()=>({}),getUserMedia:()=>{micRequests++;return getMedia?getMedia(stream):Promise.resolve(stream);}}},
  URL:{createObjectURL(blob){const id='blob:'+ ++serial;blobs.set(id,blob);return id;},revokeObjectURL(id){blobs.delete(id);}},
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},window:{addEventListener(name,fn){events.set(name,fn);}}});
 vm.runInContext(script,context);
 return {q,downloads,timers,events,storage,writes,context,get stopped(){return stopped;},get micRequests(){return micRequests;},get recorder(){return latest;},advance(seconds){now+=seconds*1000;},batch:()=>JSON.parse(vm.runInContext('JSON.stringify(batch)',context))};
}
(async()=>{
 const originalKey='kural-personal-pilot-v1:SPK01',storage=new Map([[originalKey,'original collector progress untouched']]),h=harness(storage);
 const tasks=JSON.parse(vm.runInContext('JSON.stringify(TASKS)',h.context));assert.equal(tasks.length,3);assert.equal(tasks[0].text,'\u0b95\u0bc1\u0bb0\u0bb2\u0bcd');assert.equal(tasks[1].text,'good and');assert.equal(tasks[2].minimum_capture_seconds,10);
 assert.equal(h.micRequests,0);await h.q('record').onclick();assert.equal(h.micRequests,0);
 h.q('consent').checked=true;h.q('consent').onchange();
 for(const [id,seconds] of [['TP01',3],['TN01',3],['TB01',12]]){
  h.q('task').value=id;h.q('task').onchange();const start=h.q('record').onclick();await h.q('record').onclick();await start;h.advance(seconds);h.q('stop').onclick();
 }
 assert.equal(h.micRequests,3);assert.equal(h.stopped,3);assert.match(h.q('progress').textContent,/3\/3/);
 const rows=h.batch().attempts;assert.equal(new Set(rows.map(r=>r.filename)).size,3);assert.equal(new Set(rows.map(r=>r.recording_id)).size,3);
 assert.equal(rows[0].replaces_recording_id,'aff7301e-74b4-40f4-ab27-fd41140ec8a7');assert.equal(rows[1].supplements_recording_id,'5f512dcd-2d0b-4e4e-bc9f-5aded5a1a5be');
 for(const row of rows){assert.equal(row.speaker_id,'SPK01');assert.equal(row.session_id,'S01_TRAIN');assert.equal(row.split,'train');assert.equal(row.consent.granted,true);assert.equal(row.original_recording_id,row.recording_id);assert.equal(row.heard_wake_intervals,null);assert.equal(row.intended_wake_intervals,null);assert.match(row.filename,/^kural-personal-pilot-v1_.*\.webm$/);}
 assert.equal(storage.get(originalKey),'original collector progress untouched');assert.ok(h.writes.every(key=>key!==originalKey));
 const reload=harness(storage);assert.equal(reload.batch().batch_id,h.batch().batch_id);assert.match(reload.q('progress').textContent,/3\/3/);assert.notEqual(harness().batch().batch_id,h.batch().batch_id);
 h.q('export').onclick();const exported=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(exported.complete,true);assert.equal(exported.records.length,3);assert.equal(exported.attempts.length,3);
 // Exercise actual importer inspection against exactly the exported JSON/audio pairs.
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kural-topup-test-'));
 try{
  for(const file of h.downloads)fs.writeFileSync(path.join(tmp,file.name),Buffer.from(await file.blob.arrayBuffer()));
  const journal=path.join(tmp,h.downloads.at(-1).name),python=path.join(__dirname,'../.venv/Scripts/python.exe');
  const code='import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from import_kural_pilot import inspect;d,rows,excluded=inspect(Path(sys.argv[2]),Path(sys.argv[3]));assert len(rows)==3 and not excluded;assert all(not r["issues"] for r in rows);assert d["records"][0]["replaces_recording_id"]=="aff7301e-74b4-40f4-ab27-fd41140ec8a7";print("import compatibility passed")';
  execFileSync(python,['-c',code,path.join(__dirname,'../tools'),journal,tmp],{stdio:'pipe'});
 }finally{const target=path.resolve(tmp);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('kural-topup-test-'));fs.rmSync(target,{recursive:true,force:true});}
 const short=harness();short.q('consent').checked=true;short.q('task').value='TB01';short.q('task').onchange();await short.q('record').onclick();short.advance(5);short.q('stop').onclick();assert.equal(short.batch().attempts[0].capture_requirement_met,false);assert.equal(short.q('record').disabled,false);assert.equal(short.downloads.length,2);
 await short.q('record').onclick();short.advance(30);[...short.timers.values()].find(t=>t.ms===30000).fn();assert.equal(short.stopped,2);assert.equal(short.batch().attempts[1].capture_requirement_met,true);assert.equal([...short.timers.values()].filter(t=>t.ms===30000).length,0);short.q('export').onclick();const journal=JSON.parse(await short.downloads.at(-1).blob.text());assert.equal(journal.records.length,1);assert.equal(journal.attempts.length,2);assert.equal(journal.complete,false);
 const fail=harness(new Map(),()=>Promise.reject(Error('denied')));fail.q('consent').checked=true;await fail.q('record').onclick();assert.equal(fail.batch().attempts.length,0);assert.equal(fail.timers.size,0);
 const error=harness();error.q('consent').checked=true;await error.q('record').onclick();error.recorder.onerror();assert.equal(error.stopped,1);assert.equal(error.batch().attempts.length,0);assert.equal(error.timers.size,0);
 const exit=harness();exit.q('consent').checked=true;await exit.q('record').onclick();exit.events.get('pagehide')();assert.equal(exit.stopped,1);assert.equal(exit.downloads.length,0);assert.equal(exit.batch().attempts.length,0);assert.equal(exit.timers.size,0);
 let resolve;const pending=harness(new Map(),stream=>new Promise(r=>{resolve=()=>r(stream);}));pending.q('consent').checked=true;const permission=pending.q('record').onclick();pending.events.get('pagehide')();resolve();await permission;assert.equal(pending.stopped,1);assert.equal(pending.downloads.length,0);
 console.log('PASS: exactly three tasks, consent, unique IDs, separate progress/batches, relationships, actual importer compatibility, short-background preservation, cap and stop/error/exit/late-permission cleanup, local-only operation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
