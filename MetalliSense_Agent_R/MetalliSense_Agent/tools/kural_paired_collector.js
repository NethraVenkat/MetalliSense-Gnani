/* Isolated capture/label modes on the existing collector. No model/network APIs. */
(function(root){
'use strict';
const words=['குரங்கு','குடல்','குளம்','குறை','கூரை','coral','cooler','curl','rural','control'];
const questions=['H-1053 நிலை என்ன?','ஷிஃப்ட் சம்மரி சொல்லு','எத்தனை ஹீட் ஹோல்ட்ல இருக்கு?','கார்பன் எவ்வளவு?','டாஷ்போர்டு ஓப்பன் பண்ணு','டூர் ஸ்டார்ட் பண்ணு','spectrometer reading என்ன?','stock எவ்வளவு இருக்கு?','அடுத்த பேஜ் போ','H-1053 क्या स्थिति है?'];
const speakers=['manish','nethra'];
function designation(mode){if(!['paired-v1','devval-v1'].includes(mode))throw Error('Unknown set');return mode==='paired-v1'?'train-paired-v1':'devval-v1';}
function tasks(mode,speaker){
 designation(mode);if(!speakers.includes(speaker))throw Error('Unknown speaker');
 if(mode==='paired-v1')return [...words,...questions].flatMap((text,i)=>{
  const pair_type=i<10?'A_word':'B_question',pair_id=speaker+'-'+(i<10?'A':'B')+String(i%10+1).padStart(2,'0');
  const order=i%2===0?['wake','nonwake']:['nonwake','wake'];
  return order.map((member,j)=>({task_id:pair_id+'-'+member,speaker,pair_id,pair_type,member,label:member,order_in_pair:j+1,
   prompt_text:member==='nonwake'?text:i<10?'குரல்':(i===19?'Kural, ':'குரல், ')+text,kind:'pair',minimum_seconds:0,maximum_seconds:15}));
 });
 return [...Array.from({length:10},(_,i)=>({task_id:speaker+'-DW'+String(i+1).padStart(2,'0'),speaker,pair_id:null,pair_type:null,member:'wake',label:'wake',order_in_pair:null,prompt_text:'குரல்',kind:'natural_wake',minimum_seconds:0,maximum_seconds:15})),
  {task_id:speaker+'-DC01',speaker,pair_id:null,pair_type:null,member:'nonwake',label:'nonwake',order_in_pair:null,prompt_text:'60 seconds ordinary conversation without intentional Kural',kind:'conversation',minimum_seconds:60,maximum_seconds:75},
  ...words.map((text,i)=>({task_id:speaker+'-DN'+String(i+1).padStart(2,'0'),speaker,pair_id:null,pair_type:null,member:'nonwake',label:'nonwake',order_in_pair:null,prompt_text:text,kind:'confusable',minimum_seconds:0,maximum_seconds:15}))];
}
function wav(packets){
 const length=packets.reduce((n,p)=>n+p.byteLength,0);if(!length||length%2)throw Error('No complete PCM frames');
 const data=new ArrayBuffer(44+length),v=new DataView(data),bytes=new Uint8Array(data);const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 text(0,'RIFF');v.setUint32(4,36+length,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,length,true);
 let at=44;for(const p of packets){bytes.set(new Uint8Array(p),at);at+=p.byteLength;}return data;
}
function properties(buffer){const v=new DataView(buffer),str=(at,n)=>String.fromCharCode(...new Uint8Array(buffer,at,n));
 if(buffer.byteLength<=44||str(0,4)!=='RIFF'||str(8,4)!=='WAVE'||str(12,4)!=='fmt '||str(36,4)!=='data'||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==16000||v.getUint32(28,true)!==32000||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||v.getUint32(4,true)!==buffer.byteLength-8||v.getUint32(40,true)!==buffer.byteLength-44||(buffer.byteLength-44)%2)throw Error('Invalid/incomplete PCM16 16k WAV');
 return {frames:(buffer.byteLength-44)/2,duration:(buffer.byteLength-44)/32000};}
async function hash(buffer){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');}
function validateSidecar(meta,mode,buffer){
 const task=tasks(mode,meta.speaker).find(t=>t.task_id===meta.task_id);if(!task)throw Error('Unknown task');
 for(const key of ['speaker','pair_id','pair_type','member','prompt_text','label','order_in_pair'])if(meta[key]!==task[key])throw Error('Sidecar task mismatch: '+key);
 if(meta.designation!==designation(mode)||typeof meta.test_only!=='boolean'||!meta.condition?.trim()||meta.consent?.granted!==true||!Array.isArray(meta.wake_intervals)||!/^\d{4}-/.test(meta.created_at)||!Number.isFinite(Date.parse(meta.created_at))||!/^[a-f0-9]{64}$/.test(meta.sha256)||!['pending','accepted','rejected'].includes(meta.status))throw Error('Invalid sidecar schema');
 if(!meta.recording_id||!Number.isFinite(meta.duration)||meta.duration<=0)throw Error('Invalid recording metadata');
 if(meta.status==='accepted'){
  if(meta.content_reviewed!==true||meta.duration<task.minimum_seconds)throw Error('Unreviewed/short accepted recording');
  if(meta.label==='nonwake'&&meta.wake_absence_confirmed!==true)throw Error('Human literal-wake absence confirmation required');
  if(task.kind==='natural_wake'&&(meta.boundary_reviewed!==true||meta.wake_intervals.length!==1))throw Error('Human wake interval required');
 }
 for(const w of meta.wake_intervals||[])if(!Number.isFinite(w.start_seconds)||!Number.isFinite(w.end_seconds)||w.start_seconds<0||w.end_seconds<=w.start_seconds||w.end_seconds>meta.duration||w.source!=='human'||meta.label!=='wake')throw Error('Invalid human interval');
 if(buffer){const p=properties(buffer);if(p.duration!==meta.duration)throw Error('WAV duration mismatch');if(meta.audio&&(meta.audio.sample_rate!==16000||meta.audio.channels!==1||meta.audio.encoding!=='PCM16'||meta.audio.frames!==p.frames))throw Error('Audio schema mismatch');}return task;
}
function fresh(mode,test){return {schema:'kural-paired-collection-v1',mode,designation:designation(mode),test_only:!!test,builders:['Manish','Nethra'],speakers,takes:[]};}
function validateManifest(m,mode,test){
 if(m.schema!=='kural-paired-collection-v1'||m.mode!==mode||m.designation!==designation(mode)||m.test_only!==!!test||JSON.stringify(m.builders)!==JSON.stringify(['Manish','Nethra'])||JSON.stringify(m.speakers)!==JSON.stringify(speakers)||!Array.isArray(m.takes))throw Error('Wrong set/test manifest');
 const ids=new Set(),accepted=new Set();for(const take of m.takes){validateSidecar(take.meta,mode);if(take.meta.test_only!==m.test_only)throw Error('Mixed real/test metadata');if(ids.has(take.meta.recording_id))throw Error('Duplicate recording ID');ids.add(take.meta.recording_id);
  if(take.meta.status==='accepted'){if(accepted.has(take.meta.task_id))throw Error('Duplicate accepted task');accepted.add(take.meta.task_id);}
  for(const item of [take,...(take.original_take?[take.original_take]:[])])for(const [key,extension] of [['wav','.wav'],['sidecar','.json']]){const p=item[key];if(typeof p!=='string'||p.includes('..')||p.startsWith('/')||p.includes('\\')||!p.endsWith(extension))throw Error('Invalid relative file path');}
 }return m;
}
async function fileAt(dir,path,create=false){const parts=path.split('/');for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p,{create});return dir.getFileHandle(parts.at(-1),{create});}
async function readFile(dir,path){return (await fileAt(dir,path)).getFile();}
async function writeNew(dir,path,value){
 try{await fileAt(dir,path);throw Error('Refusing to overwrite '+path);}catch(e){if(e.name!=='NotFoundError')throw e;}
 const handle=await fileAt(dir,path,true),writer=await handle.createWritable();try{await writer.write(value);await writer.close();}catch(e){await writer.abort().catch(()=>{});throw e;}
 const saved=await handle.getFile();if(typeof value==='string'?await saved.text()!==value:await hash(await saved.arrayBuffer())!==await hash(value))throw Error('Disk read-back mismatch: '+path);
}
async function openSet(rootDir,mode,test){
 const name=(test?'test-':'')+designation(mode),dir=await rootDir.getDirectoryHandle(name,{create:true});let manifest,version=null;
 try{const file=await readFile(dir,'manifest.json'),text=await file.text();manifest=validateManifest(JSON.parse(text),mode,test);version=text;}catch(e){if(e.name!=='NotFoundError')throw e;manifest=fresh(mode,test);}
 for(const take of manifest.takes){const buffer=await (await readFile(dir,take.wav)).arrayBuffer(),sidecar=JSON.parse(await (await readFile(dir,take.sidecar)).text());validateSidecar(sidecar,mode,buffer);if(JSON.stringify(sidecar)!==JSON.stringify(take.meta)||await hash(buffer)!==take.meta.sha256)throw Error('Existing file/hash mismatch: '+take.wav);
  if(take.original_take){const original=await (await readFile(dir,take.original_take.wav)).arrayBuffer(),metadata=JSON.parse(await (await readFile(dir,take.original_take.sidecar)).text());validateSidecar(metadata,mode,original);if(await hash(original)!==take.meta.sha256||metadata.sha256!==take.meta.sha256||metadata.recording_id!==take.meta.recording_id||metadata.status!=='pending')throw Error('Original take/hash mismatch');}}
 return {dir,manifest,version,name};
}
async function commitUnlocked(store,next){
 validateManifest(next,next.mode,next.test_only);let existing=null;try{existing=await (await readFile(store.dir,'manifest.json')).text();}catch(e){if(e.name!=='NotFoundError')throw e;}
 if(existing!==store.version)throw Error('Manifest changed in another tab; reopen folder before continuing.');
 if(existing!==null)await writeNew(store.dir,'manifest-history/'+root.crypto.randomUUID()+'.json',existing);
 const text=JSON.stringify(next,null,2)+'\n',handle=await fileAt(store.dir,'manifest.json',true),writer=await handle.createWritable();try{await writer.write(text);await writer.close();}catch(e){await writer.abort().catch(()=>{});throw e;}
 store.manifest=next;store.version=text;
}
async function commit(store,next){return root.navigator?.locks?root.navigator.locks.request('kural-paired-manifest-'+store.name,()=>commitUnlocked(store,next)):commitUnlocked(store,next);}
async function saveTake(store,meta,buffer){
 validateSidecar(meta,store.manifest.mode,buffer);if(await hash(buffer)!==meta.sha256)throw Error('New WAV hash mismatch');
 const base='clips/'+meta.speaker+'/'+meta.recording_id,take={meta,wav:base+'.wav',sidecar:base+'.json'};
 await writeNew(store.dir,take.wav,buffer);await writeNew(store.dir,take.sidecar,JSON.stringify(meta,null,2)+'\n');await commit(store,{...store.manifest,takes:[...store.manifest.takes,take]});return take;
}
async function decide(store,take,status,changes={}){
 if(!['accepted','rejected'].includes(status)||take.meta.status!=='pending')throw Error('Only pending takes can be decided');
 const meta={...take.meta,...changes,status},buffer=await (await readFile(store.dir,take.wav)).arrayBuffer();validateSidecar(meta,store.manifest.mode,buffer);if(await hash(buffer)!==meta.sha256)throw Error('Original take hash mismatch');
 const path=(status==='rejected'?'rejected/':'accepted/')+meta.speaker+'/'+meta.recording_id;
 const next={meta,wav:path+'.wav',sidecar:path+'.json',original_take:{wav:take.wav,sidecar:take.sidecar}};
 await writeNew(store.dir,next.wav,buffer);
 await writeNew(store.dir,next.sidecar,JSON.stringify(meta,null,2)+'\n');
 await commit(store,{...store.manifest,takes:store.manifest.takes.map(t=>t.meta.recording_id===meta.recording_id?next:t)});return next;
}
root.KuralPaired={words,questions,speakers,tasks,designation,wav,properties,hash,validateSidecar,validateManifest,fresh,openSet,saveTake,decide};
if(!root.document)return;
const mode=new URLSearchParams(location.search).get('mode');if(!['paired-v1','devval-v1'].includes(mode))return;
root.KuralPairedMode=true;const test=new URLSearchParams(location.search).get('test')==='1';
document.getElementById('legacy').hidden=true;const panel=document.getElementById('paired');panel.hidden=false;
panel.innerHTML=`<h1>${test?'TEST ONLY — ':''}${mode} · local Kural collection</h1><p>Builder: Manish + Nethra. Capture/labelling only; no detector, model, cloud, training or app action. Close other recorders and turn tour Mic off.</p>
<p>Choose the same local output root on reopening. WAVs, sidecars and the set manifest are written directly to your selected folder, not Downloads or browser-only storage. Never select an existing training/model folder. Keep this page open until Stop has saved.</p>
<button id="pcFolder">Choose output root / resume</button><p id="pcPath"></p><label>Speaker <select id="pcSpeaker"><option>manish</option><option>nethra</option></select></label>
<label>Actual condition <input id="pcCondition" value="quiet-headphones" maxlength="200"></label>
<label><input type="checkbox" id="pcConsent"> I consent to local recording and labelling; everyone audible consents. No upload. This is an explicitly designated ${designation(mode)} set, not S01/S02/S03 or a live diagnostic import.</label>
<p id="pcProgress"></p><h2 id="pcPrompt" lang="ta"></h2><p id="pcInfo"></p>
<button id="pcRecord">Record</button><button id="pcStop" disabled>Stop</button><button id="pcRetake" disabled>Re-take (keep rejected)</button><button id="pcPlay" disabled>Play</button><button id="pcAccept" disabled>Accept & Next</button>
<p id="pcStatus" role="status"></p><p id="pcTime"></p>
<canvas id="pcWave" style="display:block;width:100%;height:170px;border:1px solid #aaa" aria-label="Waveform: click to seek; timestamp inputs and audio controls support keyboard use"></canvas><audio id="pcAudio" controls></audio>
<label>Wake start seconds <input id="pcStart" type="number" step="0.001" min="0"></label><button id="pcUseStart">Use current time as start</button>
<label>Wake end seconds <input id="pcEnd" type="number" step="0.001" min="0"></label><button id="pcUseEnd">Use current time as end</button><button id="pcInterval">Play interval</button>
<label><input id="pcReviewed" type="checkbox"> I listened: content matches the prompt/label. For nonwake takes I confirm no literal Kural. If unsure or accidental Kural occurred, Re-take; original is retained.</label>
<p>Green boundaries are manual only. devval wake takes require explicit reviewed boundaries. Paired wake boundaries may be annotated later; Accept approves content, not missing timings. Background/conversation labels are never inferred from energy.</p>`;
const q=id=>document.getElementById('pc'+id);let store=null,pending=null,buffer=null,cap=null,ctx=null,abort=null,busy=false,alive=true,timer=null,clockTimer=null,url=null,endAt=null,animation=null,unlock=null;
const speaker=()=>q('Speaker').value;const currentTask=()=>pending?tasks(mode,speaker()).find(t=>t.task_id===pending.meta.task_id):tasks(mode,speaker()).find(t=>!store?.manifest.takes.some(r=>r.meta.task_id===t.task_id&&r.meta.status==='accepted'));
function status(text){q('Status').textContent=text;}
function refresh(){const t=currentTask();q('Progress').textContent=speakers.map(s=>s+': '+(store?.manifest.takes.filter(r=>r.meta.speaker===s&&r.meta.status==='accepted').length||0)+'/'+tasks(mode,s).length).join(' · ');
 q('Prompt').textContent=t?.prompt_text||'Speaker complete';q('Info').textContent=t?`${t.task_id} · ${t.member} · ${t.pair_id?'pair '+t.pair_id+', order '+t.order_in_pair:'separate dev-validation'} · ${t.kind==='conversation'?'Speak naturally for at least60 seconds; maximum75.':'One second silence, natural prompt, one second silence; maximum15 seconds.'}`:'';
 q('Record').disabled=busy||!!cap||!!pending||!store||!q('Consent').checked||!t;q('Stop').disabled=!cap&&!abort;
 for(const id of ['Retake','Play','Accept'])q(id).disabled=busy||!pending||!!cap;
 for(const id of ['Speaker','Condition','Folder'])q(id).disabled=busy||!!cap||!!abort||!!pending;
}
function clearPlayback(){q('Audio').pause();endAt=null;if(url)URL.revokeObjectURL(url);url=null;pending=null;buffer=null;q('Audio').removeAttribute('src');q('Start').value='';q('End').value='';q('Reviewed').checked=false;draw();}
function draw(){const c=q('Wave'),r=c.getBoundingClientRect(),ratio=devicePixelRatio||1,w=Math.max(1,r.width),h=170;c.width=w*ratio;c.height=h*ratio;const g=c.getContext('2d');g.scale(ratio,ratio);g.clearRect(0,0,w,h);if(!buffer)return;
 const p=properties(buffer),v=new DataView(buffer),plot=140;const start=Number(q('Start').value),end=Number(q('End').value);
 if(q('Start').value&&q('End').value&&end>start){g.fillStyle='#d9eddf';g.fillRect(start/p.duration*w,0,(end-start)/p.duration*w,plot);g.strokeStyle='#176342';for(const t of [start,end]){g.beginPath();g.moveTo(t/p.duration*w,0);g.lineTo(t/p.duration*w,plot);g.stroke();}}
 g.strokeStyle='#537766';g.beginPath();const step=Math.max(1,Math.floor(p.frames/w));for(let i=0;i<p.frames;i+=step){let lo=0,hi=0;for(let j=i;j<Math.min(i+step,p.frames);j++){const sample=v.getInt16(44+j*2,true)/32768;lo=Math.min(lo,sample);hi=Math.max(hi,sample);}const x=i/p.frames*w;g.moveTo(x,70+lo*65);g.lineTo(x,70+hi*65);}g.stroke();g.strokeStyle='#b01836';const x=q('Audio').currentTime/p.duration*w;g.beginPath();g.moveTo(x,0);g.lineTo(x,plot);g.stroke();g.fillStyle='#17352b';g.font='12px system-ui';g.textAlign='left';g.fillText('0.000s',0,165);g.textAlign='right';g.fillText(p.duration.toFixed(3)+'s',w,165);q('Time').textContent=q('Audio').currentTime.toFixed(3)+' / '+p.duration.toFixed(3)+' seconds';
}
function update(){const a=q('Audio');if(endAt!==null&&a.currentTime>=endAt){const end=endAt;endAt=null;a.pause();a.currentTime=end;}draw();}
q('Audio').onplay=()=>{cancelAnimationFrame(animation);const tick=()=>{update();if(!q('Audio').paused)animation=requestAnimationFrame(tick);};tick();};
for(const e of ['pause','ended','seeked','timeupdate','loadedmetadata'])q('Audio').addEventListener(e,()=>{if(q('Audio').paused)cancelAnimationFrame(animation);update();});const resizeObserver=new ResizeObserver(draw);resizeObserver.observe(q('Wave'));
q('Wave').onclick=e=>{if(!buffer)return;const r=q('Wave').getBoundingClientRect();endAt=null;q('Audio').currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*properties(buffer).duration;draw();};
for(const id of ['Start','End']){q('Use'+id).onclick=()=>{q(id).value=(Math.floor(q('Audio').currentTime*1000)/1000).toFixed(3);q('Reviewed').checked=false;draw();};q(id).oninput=()=>{q('Reviewed').checked=false;draw();};}
function marked(){const s=Number(q('Start').value),e=Number(q('End').value);if(!buffer||q('Start').value===''||q('End').value===''||!Number.isFinite(s)||!Number.isFinite(e)||s<0||e<=s||e>properties(buffer).duration)throw Error('Set valid manually listened start/end boundaries');return {start_seconds:s,end_seconds:e,source:'human'};}
q('Interval').onclick=()=>{try{const w=marked();endAt=null;q('Audio').pause();q('Audio').currentTime=w.start_seconds;endAt=w.end_seconds;void q('Audio').play().catch(e=>status(e.message));}catch(e){status(e.message);}};
async function guarded(fn){if(busy)return;busy=true;refresh();try{await fn();}catch(e){status(e.message+' No upload occurred. Existing files remain.');}finally{busy=false;refresh();}}
async function loadPending(){const rows=store.manifest.takes.filter(t=>t.meta.status==='pending');if(rows.length>1)throw Error('Multiple pending takes; resolve manifest manually without discarding files');if(rows[0]){pending=rows[0];q('Speaker').value=pending.meta.speaker;buffer=await (await readFile(store.dir,pending.wav)).arrayBuffer();url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));q('Audio').src=url;status('Resumed pending take: play, review and Accept or Re-take.');}draw();}
q('Folder').onclick=()=>guarded(async()=>{if(!root.showDirectoryPicker)throw Error('Use desktop Chromium/Edge with directory access support');const handle=await root.showDirectoryPicker({mode:'readwrite'});if(test&&!handle.name.startsWith('kural-collector-test-'))throw Error('TEST mode requires a kural-collector-test-* root');if(!test&&handle.name!=='kural-paired-collections-v1')throw Error('Select the prepared kural-paired-collections-v1 output root, not another dataset');store=await openSet(handle,mode,test);q('Path').textContent=handle.name+'/'+store.name+' (each set has its own manifest)';await loadPending();status(pending?'Pending take resumed.':'Folder validated; first incomplete task selected.');});
q('Consent').onchange=()=>{if(!q('Consent').checked&&(cap||abort))q('Stop').onclick();refresh();};q('Speaker').onchange=()=>{clearPlayback();refresh();};
async function micLock(){if(!navigator.locks)return ()=>{};return new Promise((resolve,reject)=>{navigator.locks.request('kural-paired-collector-mic',{ifAvailable:true},lock=>{if(!lock){reject(Error('Another collector tab owns the microphone'));return;}return new Promise(done=>resolve(done));}).catch(reject);});}
async function finish(){if(busy)return;if(!cap){abort?.abort();return;}const recording=cap;cap=null;recording.stop({flushPending:true});clearTimeout(timer);clearInterval(clockTimer);unlock?.();unlock=null;abort=null;await guarded(async()=>{
 buffer=wav(recording.packets);const t=recording.task,meta={...t,recording_id:root.crypto.randomUUID(),condition:recording.condition,sha256:await hash(buffer),duration:properties(buffer).duration,created_at:new Date().toISOString(),designation:designation(mode),test_only:test,consent:{granted:true},content_reviewed:false,boundary_reviewed:false,wake_absence_confirmed:false,wake_intervals:[],status:'pending',audio:{sample_rate:16000,channels:1,encoding:'PCM16',frames:properties(buffer).frames},capture:recording.settings};
 pending=await saveTake(store,meta,buffer);url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));q('Audio').src=url;q('Reviewed').checked=false;status('Take saved to disk as pending. Play and review before Accept. Re-take archives it under rejected/.');draw();});}
q('Record').onclick=async()=>{if(busy||cap||pending||!store||!q('Consent').checked)return;if(!q('Condition').value.trim()){status('Enter actual condition');return;}busy=true;abort=new AbortController();refresh();let releaseLock;
 try{ctx=new AudioContext();await ctx.resume();releaseLock=await micLock();if(abort.signal.aborted||!alive)throw Error('Capture cancelled');const packets=[],task=currentTask(),condition=q('Condition').value;const local=await root.KuralLiveCapture.createMicCapture({context:ctx,signal:abort.signal,onFrame:p=>packets.push(p),onError:e=>{status(e.message);void finish();}});
  if(!alive||abort.signal.aborted){local.stop({flushPending:false});throw Error('Capture cancelled');}unlock=releaseLock;cap={...local,packets,task,condition,settings:{input_rate:local.inputRate,applied:{sampleRate:local.appliedSettings.sampleRate,channelCount:local.appliedSettings.channelCount,echoCancellation:local.appliedSettings.echoCancellation,noiseSuppression:local.appliedSettings.noiseSuppression,autoGainControl:local.appliedSettings.autoGainControl}}};
  status('Recording actual microphone. Stop to save PCM WAV.');clockTimer=setInterval(()=>{if(cap)q('Time').textContent='Captured '+cap.audioTime().toFixed(3)+' seconds'+(task.kind==='conversation'?' · target at least60 seconds':'');},100);timer=setTimeout(()=>void finish(),task.maximum_seconds*1000);
 }catch(e){releaseLock?.();abort?.abort();void ctx?.close().catch(()=>{});abort=null;status(e.message);}finally{busy=false;refresh();}};
q('Stop').onclick=()=>{if(cap)void finish();else{abort?.abort();status('Pending permission cancelled; late streams will be released.');}};
q('Retake').onclick=()=>guarded(async()=>{await decide(store,pending,'rejected');clearPlayback();status('Rejected WAV/JSON retained in rejected/; immutable original capture also retained. Record the same prompt again.');});
q('Play').onclick=()=>{endAt=null;void q('Audio').play().catch(e=>status(e.message));};
q('Accept').onclick=()=>guarded(async()=>{if(!q('Reviewed').checked)throw Error('Listen and explicitly confirm content first');const t=currentTask();let intervals=[];if(t.label==='wake'&&(t.kind==='natural_wake'||q('Start').value!==''||q('End').value!==''))intervals=[marked()];await decide(store,pending,'accepted',{content_reviewed:true,boundary_reviewed:intervals.length>0,wake_absence_confirmed:t.label==='nonwake',wake_intervals:intervals,reviewed_at:new Date().toISOString()});clearPlayback();status('Accepted and saved. Next incomplete prompt ready.');});
window.addEventListener('pagehide',()=>{alive=false;clearTimeout(timer);clearInterval(clockTimer);abort?.abort();cap?.stop({flushPending:false});unlock?.();void ctx?.close().catch(()=>{});q('Audio').pause();cancelAnimationFrame(animation);resizeObserver.disconnect();if(url)URL.revokeObjectURL(url);});
status('No microphone starts automatically. Select output folder, speaker and consent.');refresh();
})(globalThis);
