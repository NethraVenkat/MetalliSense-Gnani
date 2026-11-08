import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {voicePages} from '../src/services/voicePages';
let server,browser,page,base,plan;const results=[];
beforeAll(async()=>{
 const {createServer}=await import('vite'),{chromium}=await import('@playwright/test'),{default:react}=await import('@vitejs/plugin-react');
 const flags={VITE_MOCK_MODE:'true',VITE_VOICE_ACTIONS:'true',VITE_VOICE_AUDIT:'true',VITE_VOICE_PAGE_ANSWERS:'true',VITE_VOICE_EVERYWHERE:'true',VITE_WAKE_WORD:'true',VITE_SHOW_VOICE_PANEL:'true',VITE_VOICE_TIMING:'true',VITE_VOICE_TOUR:'false',VITE_VOICE_CLARITY:'false',VITE_TTS_STREAM:'false',VITE_SPOKEN_NORMALIZE:'false',VITE_VOICE_DATA_READS:'false'};
 server=await createServer({configFile:false,envFile:false,cacheDir:'node_modules/.cache/page-sweep-vite',plugins:[react()],define:Object.fromEntries(Object.entries(flags).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)])),server:{host:'127.0.0.1',port:0}});await server.listen();base=server.resolvedUrls.local[0];
 browser=await chromium.launch({headless:true});page=await browser.newPage();
 page.on('pageerror',error=>console.error('Sweep fixture initialization:',error.stack));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.clock.install();await page.goto(base+'tests/fixtures/page-sweep.html');await page.waitForFunction(()=>Array.isArray(window.sweepPlan));plan=await page.evaluate(()=>window.sweepPlan);
},30000);
afterAll(async()=>{
 await browser?.close();if(server){server.httpServer?.closeAllConnections();await server.close();}
 if(process.env.PAGE_SWEEP_WRITE!=='true')return;
 const dir=resolve('../../MetalliSense_Agent_R/MetalliSense_Agent/DOCS'),escape=v=>String(v??'').replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
 const lines=['# Page sweep report','','Automated Chromium sweep with mocked services, synthetic loaded snapshots, simulated audio frames and virtual time. No provider calls, real passcodes, physical microphone, or plant writes. Each registered route is also rendered through the real application. These results are not human live verification.','','| Page | Item | Expected | Result | Fixed? |','|---|---|---|---|---|'];
 for(const row of results)lines.push('| '+[row.page,`${row.id} / ${row.lang||'all'} / ${row.scenario||row.kind}`,row.expected,row.pass?'auto-PASS':'auto-FAIL',row.pass?'Verified':'Outstanding'].map(escape).join(' | ')+' |');
 lines.push('',`${results.filter(r=>r.pass).length}/${results.length} cases passed.`);writeFileSync(resolve(dir,'PAGE_SWEEP_REPORT.md'),lines.join('\n')+'\n');
 const live=['# Live voice test log','','Generated from the mocked page sweep. Result is auto-PASS/auto-FAIL; replace it during a human live check. Approval replies are always masked.','','| Time | Page | Heard | Intent | Level | Decision | Spoken reply | Result |','|---|---|---|---|---|---|---|---|'];
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Calcutta',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
 for(const row of results)live.push('| '+[time,row.page,row.heard||'',row.id,row.level||'ASK',row.decision||'',row.spoken||'',row.pass?'auto-PASS':'auto-FAIL'].map(escape).join(' | ')+' |');
 const livePath=resolve(dir,'LIVE_TEST_LOG.md');const previous=readFileSync(livePath,'utf8');if(!previous.startsWith('# Live voice test log\n\nGenerated from the mocked page sweep.'))writeFileSync(resolve(dir,'LIVE_TEST_LOG_BEFORE_SWEEP.md'),previous);
 writeFileSync(livePath,live.join('\n')+'\n');
});
it.each(voicePages)('$route: every ASK intent in three languages and all registered action/refusal paths',async route=>{
 const cases=plan.map((item,index)=>({...item,index})).filter(item=>item.page===route.route);
 expect(cases.length).toBeGreaterThan(0);const failures=[];
 for(const item of cases){
  await page.evaluate(index=>window.beginSweep(index),item.index);
  for(let step=0;step<30&&!await page.evaluate(()=>window.sweepDone);step++)await page.clock.fastForward(500);
  const result=await page.evaluate(()=>window.sweepResult);const row=result||{...item,pass:false,decision:'unresolved'};results.push(row);if(!row.pass)failures.push(`${item.id}/${item.lang}/${item.scenario||'ask'}: ${row.decision} checks=${JSON.stringify(row.checks)}`);
 }
 expect(failures).toEqual([]);
},30000);
it('real application renders every routed page; public routes expose no action controls',async()=>{
 const routes=['/','/login','/signup',...voicePages.map(p=>p.route)],app=await browser.newPage();await app.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const failures=[];
 for(const route of routes){
  let failed=false;const error=()=>failed=true;app.on('pageerror',error);
  try{await app.goto(base+'#'+route);await app.waitForFunction(()=>document.querySelector('main')||document.querySelector('form'));if(['/login','/signup'].includes(route))expect(await app.locator('.voice-action-panel').count()).toBe(0);}
  catch{failed=true;}finally{app.off('pageerror',error);}
  results.push({page:route,id:'route-render',kind:'route',expected:'renders without page errors',pass:!failed});if(failed)failures.push(route);
 }
 await app.close();expect(failures).toEqual([]);
},90000);
