import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

it('real dev:mock and normal dev transform React imports and render in Chromium',async()=>{
 const evidence=resolve('node_modules/.cache/dev-module-smoke');mkdirSync(evidence,{recursive:true});
 for(const mode of ['mock','development']){
  // The dev:mock package script is vite --mode mock; run that CLI in a child,
  // retaining the real config/plugins/HTML path rather than a production fixture.
  const args=['node_modules/vite/bin/vite.js',...(mode==='mock'?['--mode','mock']:[]),'--configLoader','runner','--host','127.0.0.1','--port',mode==='mock'?'5217':'5218','--strictPort'];
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VITE_')&&!key.startsWith('VITEST')));env.NODE_ENV='development';
  const child=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let log='',browser;
  child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const errors=[],failed=[],responses=[];
  try{
   const base=await new Promise((ok,fail)=>{const deadline=setTimeout(()=>{clearInterval(poll);fail(Error('Dev startup timeout: '+log));},30000);const poll=setInterval(()=>{const match=log.replace(/\x1b\[[0-9;]*m/g,'').match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(deadline);clearInterval(poll);ok(match[0]);}else if(child.exitCode!==null){clearTimeout(deadline);clearInterval(poll);fail(Error('Dev exited: '+log));}},50);});
   browser=await chromium.launch({headless:true});const page=await browser.newPage();
   page.on('pageerror',e=>errors.push({kind:'pageerror',message:e.message,stack:e.stack}));page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text()});});page.on('requestfailed',r=>failed.push({url:r.url(),reason:r.failure()?.errorText}));
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(r.request().resourceType()==='stylesheet')return r.fulfill({contentType:'text/css',body:''});if(r.request().resourceType()==='font')return r.fulfill({body:''});const body=u.pathname.includes('grades')?[]:u.pathname.includes('visualization')?{success:true,data:null}:{connected:false,status:'disconnected',success:true,data:[]};return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});});
   page.on('response',async r=>{if(/\/src\/(hooks\/useSpeak.js|mock\/ChargeOptimizer.jsx)/.test(r.url()))responses.push({url:r.url(),status:r.status(),body:await r.text()});});
   await page.goto(base);await page.locator('#root nav, #root aside').first().waitFor({timeout:20000});expect(await page.locator('#root').innerText()).toContain('Dashboard');
   if(mode==='mock'){await page.goto(base+'/#/charge-optimizer');await page.waitForFunction(()=>document.body.innerText.includes('Charge'));}
   // Force the two formerly broken modules through Vite import analysis too.
   for(const path of ['/src/hooks/useSpeak.js',...(mode==='mock'?['/src/mock/ChargeOptimizer.jsx']:[])]){const code=await (await page.request.get(base+path)).text();expect(code).not.toMatch(/from\s*['"]react['"]/);}
   await page.waitForTimeout(700);expect(errors,JSON.stringify(errors)).toEqual([]);expect(failed).toEqual([]);
  }finally{await browser?.close();child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});writeFileSync(resolve(evidence,mode+'.json'),JSON.stringify({mode,args,log,errors,failed,responses},null,2));}
 }
},90000);
