// Offline DOM/media mocks; no actual microphone, browser server or network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const file=path.join(__dirname,'../tools/collect_kural_recordings.html');
const html=fs.readFileSync(file,'utf8');
const old=execFileSync('git',['show','039538d:MetalliSense_Agent_R/MetalliSense_Agent/tools/collect_kural_recordings.html'],{encoding:'utf8'});
const prompts=text=>vm.runInNewContext(text.match(/const prompts=(\[.*\]);/)[1]);
assert.deepEqual(JSON.parse(JSON.stringify(prompts(html).slice(0,-1))),JSON.parse(JSON.stringify(prompts(old))));
assert.deepEqual(JSON.parse(JSON.stringify(prompts(html).at(-1))),['HN01','Hey Nova']);
assert.match(html,/connect-src 'none'/);
const nodes=new Map(),downloads=[],blobs=new Map(),timers=new Map(),events=new Map();
let stopped=0,micRequests=0,serial=0;
const element=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='condition'?'quiet-headphones':'',append(option){if(!this.value)this.value=option.value;}});return nodes.get(id);};
const stream={getTracks:()=>[{stop(){stopped++;}}],getAudioTracks:()=>[{getSettings:()=>({sampleRate:48000,channelCount:1})}]};
class Recorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){if(this.state!=='recording')return;this.state='inactive';this.ondataavailable({data:new Blob(['mock-audio'])});this.onstop();}
}
const context=vm.createContext({Blob,Map,JSON,String,MediaRecorder:Recorder,
 document:{getElementById:element,createElement:tag=>tag==='a'?{click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}}:{}},
 navigator:{mediaDevices:{getSupportedConstraints:()=>({}),getUserMedia:async()=>{micRequests++;return stream;}}},
 URL:{createObjectURL(blob){const id='blob:'+ ++serial;blobs.set(id,blob);return id;},revokeObjectURL(id){blobs.delete(id);}},
 setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
 window:{addEventListener(name,fn){events.set(name,fn);}},
 fetch(){throw Error('Network forbidden');},WebSocket:function(){throw Error('Network forbidden');}});
vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
(async()=>{
 assert.equal(micRequests,0);
 element('prompt').value='HN01';element('prompt').onchange();
 assert.equal(element('words').textContent,'Hey Nova');
 for(let take=1;take<=3;take++){
  await element('record').onclick();
  if(take===3){const cap=[...timers.values()].find(t=>t.ms===30000);assert.ok(cap);cap.fn();}
  else element('stop').onclick();
  const metadata=downloads.find(d=>d.name===`HN01_take0${take}.json`);
  const data=JSON.parse(await metadata.blob.text());
  assert.equal(data.id,'HN01');assert.equal(data.prompt,'Hey Nova');assert.equal(data.take,take);
  assert.ok(downloads.find(d=>d.name===`HN01_take0${take}.webm`));
 }
 assert.equal(stopped,3);assert.equal(micRequests,3);
 assert.equal([...timers.values()].filter(t=>t.ms===30000).length,0);
 events.get('pagehide')();
 assert.equal(element('record').disabled,false);
 console.log('PASS: original prompt IDs/texts preserved; HN01 label and three local audio/metadata pairs; explicit mic access; 30-second cap/track cleanup; no network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
