const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const template=fs.readFileSync(path.join(__dirname,'../tools/kural_session_review.html'),'utf8');
const context=vm.createContext({Date,Number,Math});vm.runInContext(template.split('<script>')[1].split('</script>')[0],context);
const api=context.KuralSessionReview;
assert.equal(api.position(2,4,800),400);assert.equal(api.seek(450,50,800,4),2);assert.equal(api.seek(-100,50,800,4),0);assert.equal(api.seek(1000,50,800,4),4);
for(const [a,b] of [['',1],[1,''],[-1,1],[2,1],[1,1],[0,6],[NaN,1]])assert.throws(()=>api.interval(a,b,5.418625));
assert.equal(api.interval('1.234','2.345',5.418625).start_seconds,1.234);
const data={session:'original-session',audio:{sha256:'a'.repeat(64),duration_seconds:5.418625,frames:86698,sample_rate:16000},original_hashes:{'scores.jsonl':'b'.repeat(64)},events:[{threshold:.5,audio_time:2}]};
assert.throws(()=>api.exportReview(data,[],true));assert.throws(()=>api.exportReview(data,[api.interval(1,2,6)],false));assert.throws(()=>api.exportReview(data,[api.interval(1,2,6),api.interval(1.5,3,6)],true));
const exported=api.exportReview(data,[api.interval(1.234,2.345,6)],true);assert.equal(exported.session,data.session);assert.equal(exported.audio.sha256,data.audio.sha256);assert.equal(exported.original_evidence_hashes['scores.jsonl'],data.original_hashes['scores.jsonl']);assert.equal(exported.threshold_events_are_ground_truth,false);assert.equal(exported.training_imported,false);assert.equal(exported.wake_intervals.length,1);assert.equal(data.events.length,1);
assert.ok(template.includes('குரல்'));assert.ok(!template.includes('?????'));assert.ok(template.includes("connect-src 'none'"));
console.log('PASS: timeline mapping/clamped seeking, millisecond intervals, invalid/overlapping interval rejection, explicit human confirmation, export session/audio/evidence provenance and UTF-8.');
if(process.argv[2]) (async()=>{
 const {chromium}=require(path.resolve('../../MetalliSense_Frontend_R/MetalliSense_Frontend/node_modules/playwright'));const {pathToFileURL}=require('node:url');const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage({acceptDownloads:true,viewport:{width:1100,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(process.argv[2])).href);
 await page.waitForFunction(()=>document.getElementById('audio').readyState>=1);
 const canvas=page.locator('#wave'),box=await canvas.boundingBox();await canvas.click({position:{x:box.width/2,y:80}});
 await page.waitForFunction(()=>Math.abs(document.getElementById('audio').currentTime-2.7093125)<.01);
 const sought=await page.locator('#audio').evaluate(a=>a.currentTime);await page.locator('#useStart').click();const marked=await page.locator('#start').inputValue();assert.ok(Math.abs(Number(marked)-sought)<.0011);
 await page.locator('#events button').first().click();assert.equal(await page.locator('#start').inputValue(),marked);assert.equal(await page.locator('#end').inputValue(),'');
 await page.locator('#end').fill('1');await page.locator('#playInterval').click();assert.match(await page.locator('#status').textContent(),/valid interval/);
 await page.locator('#start').fill('1.234');await page.locator('#end').fill('1.434');await page.evaluate(()=>document.getElementById('audio').muted=true);await page.locator('#playInterval').click();
 await page.waitForFunction(()=>{const a=document.getElementById('audio');return a.paused&&Math.abs(a.currentTime-1.434)<.01});
 await page.locator('#add').click();await page.locator('#confirm').check();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const parsed=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(parsed.session,'9c553da854744e2cb507c8f752364197');assert.equal(parsed.audio.sha256,'59e845ad468947294b02901395afe43ef11cc84043d8f254c2bae12ffeee5f9a');assert.equal(parsed.wake_intervals[0].start_seconds,1.234);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: Chromium actual retained WAV loading, waveform seek, current-time buttons, marker separation, interval stop/playhead, human JSON download and narrow resize. Synthetic test marks were not saved as user evidence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
