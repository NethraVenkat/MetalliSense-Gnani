const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../tools/kural_boundary_annotation.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const prior='c0d914f3-91bc-42ae-af25-5073b617e3dd',next='d0edc637-4831-4ef9-b10b-9b5e3ec2f1f6';
const data={dataset_fingerprint:'unchanged',session_id:'S01_TRAIN',navigation_resume:{after_recording_id:prior,next_recording_id:next},entries:['earlier',prior,next,'last'].map(recording_id=>({recording_id,kind:'positives',session_id:'S01_TRAIN',split:'train',duration_seconds:3,audio:'data:',waveform:[[0,0]],echo_case:false}))};
const review={human_reviewed:true,content_approved:true,wake_intervals:[{start_seconds:.25,end_seconds:.75,source:'human'}],wake_absence_confirmed:false,human_source:'original user annotation'};
function load(initial={}){const key='kural-cnn-boundaries-v1:unchanged',storage=new Map([[key,JSON.stringify(initial)]]),nodes=new Map(),downloads=[];let fail=false;
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',currentTime:0,duration:NaN,paused:true,options:[],append(o){this.options.push(o);},pause(){this.paused=true;this.onpause?.();},getBoundingClientRect(){return {width:400,left:0};},getContext(){return {setTransform(){},clearRect(){},fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}});return nodes.get(id);}
 const blobs=new Map();let serial=0;const context=vm.createContext({JSON,Number,Math,Blob,document:{getElementById:node,createElement:()=>({click(){downloads.push(blobs.get(this.href));}})},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{if(fail)throw Error('storage full');storage.set(k,v);}},URL:{createObjectURL:b=>{const k='blob:'+ ++serial;blobs.set(k,b);return k;},revokeObjectURL(){}},setTimeout(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},window:{addEventListener(){},devicePixelRatio:1}});
 const reload=()=>load(JSON.parse(storage.get(key)));
 vm.runInContext(script.replace('/*ANNOTATION_DATA*/null',JSON.stringify(data)),context);
 return {node,storage,key,downloads,reload,fail:()=>fail=true};}
(async()=>{
 let h=load({earlier:review});const original=h.storage.get(h.key);
 assert.equal(h.node('record').value,next);assert.equal(h.storage.get(h.key),original);assert.match(h.node('progress').textContent,/1 saved reviews.*2 pending.*1 previously completed/);
 h.node('export').onclick();let output=JSON.parse(await h.downloads[0].text());assert.deepEqual(output.records,{earlier:review});assert.equal(output.navigation_resume,undefined);assert.equal(output.records[prior],undefined);
 h.node('showCompleted').checked=true;h.node('showCompleted').onchange();assert.ok(h.node('record').options.some(o=>o.textContent.includes('timings unavailable')));assert.ok(h.node('record').options.some(o=>o.textContent.includes('Completed - saved review')));
 h.node('showCompleted').checked=false;h.node('showCompleted').onchange();assert.equal(h.node('record').value,next);
 h.node('saveNext').onclick();assert.equal(h.node('record').value,next);assert.equal(h.storage.get(h.key),original);
 h.node('start').value='.5';h.node('end').value='1.2';h.node('add').onclick();h.node('approve').checked=true;h.fail();h.node('saveNext').onclick();assert.equal(h.node('record').value,next);assert.equal(h.storage.get(h.key),original);assert.match(h.node('status').textContent,/not saved/);
 h=load({earlier:review});h.node('start').value='.5';h.node('end').value='1.2';h.node('add').onclick();h.node('start').value='1';h.node('end').value='1.4';h.node('add').onclick();h.node('approve').checked=true;h.node('saveNext').onclick();assert.equal(h.node('record').value,next);assert.equal(JSON.parse(h.storage.get(h.key))[next],undefined);assert.match(h.node('status').textContent,/overlapping/);
 h=load({earlier:review});h.node('start').value='.5';h.node('end').value='1.2';h.node('add').onclick();h.node('approve').checked=true;h.node('saveNext').onclick();assert.equal(h.node('record').value,'last');const saved=JSON.parse(h.storage.get(h.key));assert.deepEqual(saved.earlier,review);assert.deepEqual(saved[next].wake_intervals,[{start_seconds:.5,end_seconds:1.2,source:'human'}]);assert.equal(saved[prior],undefined);assert.equal(h.reload().node('record').value,'last');
 h.node('export').onclick();output=JSON.parse(await h.downloads[0].text());assert.deepEqual(output.records,saved);assert.equal(output.records[prior],undefined);
 h=load({earlier:review,[next]:review,last:review});assert.equal(h.node('record').value,'');assert.match(h.node('identity').textContent,/No pending/);h.node('saveNext').onclick();assert.equal(h.storage.size,1);
 // Suggestions never enter the saved journal before explicit review.
 data.entries[2].speech_suggestions=[{start_seconds:.2,end_seconds:.9},{start_seconds:1.5,end_seconds:2.4}];
 data.entries[3].speech_suggestions=[{start_seconds:.4,end_seconds:1.1}];
 h=load({earlier:review});assert.equal(h.node('start').value,'');assert.match(h.node('suggestionStatus').textContent,/Multiple/);
 h.node('suggestion').value='1';h.node('suggestion').onchange();assert.equal(h.node('start').value,'1.500');assert.equal(h.node('approve').checked,false);
 h.node('export').onclick();output=JSON.parse(await h.downloads[0].text());assert.equal(output.records[next],undefined);
 h.node('saveNext').onclick();assert.equal(h.node('record').value,next);
 h.node('start').value='1.4';h.node('start').oninput();h.node('suggestion').value='0';h.node('suggestion').onchange();assert.equal(h.node('start').value,'1.4');
 h.node('record').value='last';h.node('record').onchange();assert.equal(h.node('start').value,'0.400');h.node('record').value=next;h.node('record').onchange();assert.equal(h.node('start').value,'1.4');
 h.node('approve').checked=true;h.node('saveNext').onclick();assert.equal(h.node('record').value,'last');assert.equal(JSON.parse(h.storage.get(h.key))[next].wake_intervals[0].start_seconds,1.4);
 h=load({earlier:review,[next]:review});h.node('showCompleted').checked=true;h.node('showCompleted').onchange();h.node('record').value=next;h.node('record').onchange();assert.equal(h.node('start').value,'');assert.match(h.node('intervals').textContent,/0.25/);
 data.entries[2].kind='negatives';h=load();assert.equal(h.node('start').value,'');assert.equal(h.node('suggestionLabel').hidden,true);
 data.entries[2].kind='positives';data.entries[2].echo_case=true;h=load();assert.equal(h.node('start').value,'');assert.equal(h.node('suggestionLabel').hidden,true);
 console.log('PASS: unreviewed suggestions excluded from exports; multiple-region selection; explicit adjusted save; manual-draft restoration; saved/negative/echo protection.');
 console.log('PASS: unchanged storage/schema and saved intervals; checkpoint skips never exported; pending filter/toggle/progress/resume; validation and successful persistence required before advance; storage failure/overlap do not advance; all-pending-complete state.');
})().catch(e=>{console.error(e);process.exitCode=1;});
