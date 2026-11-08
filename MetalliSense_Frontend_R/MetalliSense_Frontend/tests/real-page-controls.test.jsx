import {beforeAll,afterAll,it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {voicePages} from '../src/services/voicePages';
import {pageControlRegistry,matchPageControl} from '../src/services/voicePageControls';
let server,browser,page,base;
beforeAll(async()=>{
 const port=await new Promise(resolve=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
 base=`http://127.0.0.1:${port}`;
 server=spawn('npm.cmd',['run','dev:mock','--','--config','tests/real-app.vite.config.js','--port',String(port),'--strictPort'],{shell:true,windowsHide:true,stdio:'ignore'});
 const {chromium}=await import('@playwright/test');browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});page=await browser.newPage();
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 await page.goto(base);await page.waitForSelector('main');
},30000);
afterAll(async()=>{await browser?.close();if(server?.pid&&server.exitCode===null)await new Promise(resolve=>spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));});
it.each(pageControlRegistry)('all three languages register $id as ASK',row=>{
 expect(row.level).toBe('ASK');for(const lang of ['en','ta','hi'])for(const phrase of row.phrases[lang])expect(matchPageControl(phrase+(row.argument?' H-1053':''))?.id).toBe(row.id);
});
it('a manual selection supersedes the preceding voice target in the shared action context',async()=>{
 await page.goto(base+'/tests/fixtures/selection-context.html');await page.waitForSelector('output');
 expect(await page.getByLabel('Page size').locator('[data-voice-row-id]').count()).toBe(0);
 await page.getByRole('button',{name:'Voice select first PR'}).click();
 expect(await page.locator('output').textContent()).toBe('PR-1');
 await page.getByLabel('Selected PR').selectOption('PR-2');
 expect(await page.locator('output').textContent()).toBe('PR-2');
 await page.getByRole('button',{name:'Voice select first PR'}).click();
 expect(await page.getByLabel('Selected PR').inputValue()).toBe('PR-1');
 expect(await page.locator('output').textContent()).toBe('PR-1');
});
it('next row stays in the selected collection and portal tabs use their actual click handler',async()=>{
 await page.goto(base+'/tests/fixtures/selection-context.html');
 await page.getByRole('button',{name:'Voice select first PR'}).click();
 await page.getByRole('button',{name:'Voice next row'}).click();
 expect(await page.locator('output').textContent()).toBe('PR-2');
 await page.getByRole('button',{name:'Voice next row'}).click();
 expect(await page.locator('output').getAttribute('data-focused-field')).toBe('prId');
 expect(await page.getByLabel('Selected PR').inputValue()).toBe('PR-2');
 await page.getByRole('button',{name:'Voice certificate tab'}).click();
 expect(await page.getByTestId('active-tab').textContent()).toBe('certificate');
 expect(await page.getByRole('tab',{name:'Certificate',exact:true}).evaluate(node=>node.closest('main')===null)).toBe(true);
});
it.each(voicePages)('$route real app supports scrolling and loaded row click/voice selection',async route=>{
 // Each parameterized case gets a fresh document; hash-only navigation can
 // expose the preceding page's rows before React commits the new route.
 await page.goto(base+'/?route-test='+encodeURIComponent(route.route)+'#'+route.route);await page.waitForSelector('main');await page.waitForFunction(()=>!document.querySelector('main')?.textContent.includes('Loading page...'));
 if(route.route==='/training-data')await page.locator('main tr[data-voice-row-key="sampleId"]').first().waitFor({state:'visible',timeout:10000});
 if(route.route==='/premelt-gate')await page.locator('main button[data-voice-row-id="H-1051"]').waitFor({state:'visible',timeout:10000});
 if(['/premelt-gate','/raw-material-stock','/yard-inspection','/grades','/supplier-scorecard','/energy','/training-data'].includes(route.route))await page.waitForFunction(()=>[...document.querySelectorAll('main [data-voice-row-id]')].some(node=>(node.tagName==='OPTION'?node.parentElement:node).getClientRects().length),{},{timeout:10000});
 // Exercise the exported UI adapter against the real rendered page. Application
 // event handlers still own every click; no fixture DOM or service is substituted.
 const result=await page.evaluate(async()=>{
  const {createPageControls}=await new Function('return import("/src/services/voicePageControls.js")')();let selected={};const navigate=[];
  const controls=createPageControls({getContext:()=>({route:location.hash.slice(1),selected}),navigate:route=>navigate.push(route),select:value=>selected=value});
  const down=await controls({id:'scroll_down',lang:'en'}),up=await controls({id:'scroll_up',lang:'ta'});
  const row=document.querySelector('main [data-voice-row-id]');let selection=null;
  if(row){selection=await controls({id:'select_row',target:row.dataset.voiceRowId,lang:'hi'});}
  const missing=await controls({id:'select_row',target:'MISSING-ROW-XYZ',lang:'en'});
  return {down:down.ok,up:up.ok,selection:selection?.ok??null,missing:missing.reason_code};
 });
 expect(result.down&&result.up).toBe(true);if(result.selection!==null)expect(result.selection).toBe(true);expect(result.missing).toBe('no_target');
 if(route.route==='/training-data'){
  expect(await page.locator('main tr[data-voice-row-key="sampleId"]').count()).toBeGreaterThan(0);
  expect(await page.locator('main select option[value="50"][data-voice-row-id]').count()).toBe(0);
 }
},30000);
