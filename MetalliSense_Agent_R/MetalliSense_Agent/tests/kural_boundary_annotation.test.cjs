const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../tools/kural_boundary_annotation.html'),'utf8');
assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/getUserMedia|fetch\(|WebSocket|XMLHttpRequest/);
const data={dataset_fingerprint:'fixture',session_id:'S01_TRAIN',entries:[
 {recording_id:'positive',session_id:'S01_TRAIN',split:'train',kind:'positives',echo_case:false,duration_seconds:3,audio:'data:audio/wav;base64,AA==',waveform:[[0,.1]]},
 {recording_id:'negative',session_id:'S01_TRAIN',split:'train',kind:'negatives',echo_case:false,duration_seconds:3,audio:'data:audio/wav;base64,AA==',waveform:[[0,.1]]},
 {recording_id:'echo',session_id:'S01_TRAIN',split:'train',kind:'background_seconds',echo_case:true,duration_seconds:3,audio:'data:audio/wav;base64,AA==',waveform:[[0,.1]]}]};
const nodes=new Map(),storage=new Map(),downloads=[],blobs=new Map();let serial=0,width=900,nextFrame=0;const frames=new Map(),listeners=new Map();let resize;const strokes=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',currentTime:0,duration:NaN,paused:true,ended:false,pause(){this.paused=true;this.onpause?.();},play(){this.paused=false;this.onplay?.();return Promise.resolve();},getBoundingClientRect(){return {left:10,width};},append(o){if(!this.value)this.value=o.value;},getContext(){return {setTransform(){},clearRect(){},fillRect(){},fillText(){},beginPath(){},moveTo(x,y){strokes.push([x,y]);},lineTo(){},stroke(){}};}});return nodes.get(id);};
const context=vm.createContext({JSON,Blob,Number,Math,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
 document:{getElementById:node,createElement:()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}})},
 URL:{createObjectURL(blob){const key='blob:'+ ++serial;blobs.set(key,blob);return key;},revokeObjectURL(){}},setTimeout(){},requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame(id){frames.delete(id);},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}},window:{devicePixelRatio:2,addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);}}});
vm.runInContext(html.replace('/*ANNOTATION_DATA*/null',JSON.stringify(data)).match(/<script>([\s\S]*)<\/script>/)[1],context);
(async()=>{
 // Shared seconds mapping, full-duration ruler and pointer seeking.
 node('wave').onclick({clientX:460});assert.equal(node('audio').currentTime,1.5);assert.equal(node('clock').textContent,'1.500 / 3.000 seconds');
 node('wave').onclick({clientX:-50});assert.equal(node('audio').currentTime,0);
 node('wave').onclick({clientX:2000});assert.equal(node('audio').currentTime,3);
 width=320;resize();assert.equal(node('wave').width,640);node('wave').onclick({clientX:170});assert.equal(node('audio').currentTime,1.5);
 node('start').value='.5';node('end').value='1.25';node('start').oninput();node('playSelected').onclick();assert.equal(node('audio').currentTime,.5);assert.equal(frames.size,1);
 const staleFrame=frames.values().next().value;node('audio').currentTime=.75;frames.clear();staleFrame();assert.equal(node('clock').textContent,'0.750 / 3.000 seconds');assert.equal(frames.size,1);assert.ok(strokes.some(([x])=>x===80));node('audio').currentTime=1.3;node('audio').ontimeupdate();assert.equal(node('audio').currentTime,1.25);assert.equal(node('audio').paused,true);assert.equal(frames.size,0);
 node('audio').play();assert.equal(frames.size,1);node('audio').pause();assert.equal(frames.size,0);node('audio').ended=true;node('audio').onended();assert.equal(frames.size,0);
 node('audio').ended=false;node('record').value='negative';node('record').onchange();staleFrame();assert.equal(frames.size,0);assert.equal(node('audio').currentTime,0);assert.equal(node('start').value,'');
 node('record').value='positive';node('record').onchange();
 node('save').onclick();assert.equal(storage.size,0);assert.match(node('status').textContent,/Missing/);
 node('start').value='.5';node('end').value='1';node('add').onclick();node('approve').checked=true;node('save').onclick();
 let records=JSON.parse(storage.values().next().value);assert.deepEqual(records.positive.wake_intervals,[{start_seconds:.5,end_seconds:1,source:'human'}]);
 assert.equal(node('record').value,'negative');const saved=storage.values().next().value;node('showCompleted').checked=true;node('showCompleted').onchange();node('record').value='positive';node('record').onchange();assert.equal(storage.values().next().value,saved);assert.match(node('intervals').textContent,/0.5/);node('record').value='negative';node('record').onchange();node('approve').checked=true;node('save').onclick();assert.match(node('status').textContent,/Missing/);
 node('absent').checked=true;node('save').onclick();records=JSON.parse(storage.values().next().value);assert.deepEqual(records.negative.wake_intervals,[]);assert.equal(records.negative.wake_absence_confirmed,true);
 node('record').value='echo';node('record').onchange();node('start').value='.2';node('end').value='.8';node('add').onclick();node('approve').checked=true;node('save').onclick();
 records=JSON.parse(storage.values().next().value);assert.equal(records.echo.wake_intervals[0].source,'playback');
 node('export').onclick();let exported=JSON.parse(await downloads[0].blob.text());assert.equal(exported.dataset_fingerprint,'fixture');assert.equal(downloads[0].name,'S01_TRAIN.annotations.json');
 node('record').value='echo';node('record').onchange();node('clear').onclick();records=JSON.parse(storage.values().next().value);assert.equal(records.echo,undefined);
 node('audio').play();for(const fn of listeners.get('pagehide'))fn();assert.equal(frames.size,0);assert.equal(node('audio').paused,true);
 console.log('PASS: timeline/seek, narrow resize, selected playback, pause/end/switch cleanup, saved review preservation; no automatic boundaries/approval; manual complete wake labels; reviewed absence; echo source; fingerprint/session export; persisted clear; no microphone/network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
