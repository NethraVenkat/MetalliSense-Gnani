import { test,expect } from '@playwright/test';
const routes=['dashboard','anomaly','recommendation','rl-optimizer','agent','grades','synthetic','spectrometer','training-data','semantic-search','cost-analysis','full-analysis','mechanical-properties','raw-material-stock','yard-inspection','premelt-gate','supplier-scorecard','energy','inventory-forecast','sales','charge-optimizer','login','signup'];
async function call(page,path,body,method=body?'POST':'GET'){
 return page.evaluate(async({path,body,method})=>{const r=await fetch(path,{method,body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw new Error(path+': '+JSON.stringify(j));return j;},{path,body,method});
}
test('every route and full browser-only workflow, persistence and reset',async({page})=>{
 const errors=[],blocked=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='http://127.0.0.1:4179'||['data:','blob:'].includes(u.protocol))return route.continue();blocked.push(u.href);return route.abort();});
 await page.goto('/#/dashboard');await page.waitForFunction(()=>!!window.__METALLISENSE_MOCK__);await expect(page.getByText('Demo mode',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Reset demo data',exact:true})).toHaveCount(0);
 for(const route of routes){await page.goto('/#/'+route);await page.waitForTimeout(850);await expect(page.locator('body')).not.toContainText(/service unavailable|Unexpected Application Error|Could not reach/i);}
 expect(errors).toEqual([]);expect(blocked).toEqual([]);expect(failed).toEqual([]);
 await page.goto('/#/raw-material-stock');
 const lot=(await call(page,'/api/v2/premelt/lots',{materialType:'STEEL_SCRAP',supplier:'Demo delivery',receivedKg:1500,costPerKg:30,truckNo:'TN DEMO 01',demoScenario:'copper',declared:{C:.1,Si:.2,Mn:.5,P:.02,S:.01,Cu:.8},by:'Demo operator'})).data;
 await call(page,'/api/v2/premelt/gun/inspect',{lotId:lot.lotId,device:'XRF',pieces:25,surfacePrepared:true,inspector:'Demo inspector'});
 await expect.poll(async()=>{const r=await call(page,'/api/v2/premelt/gun/live');return r.data?.status;},{timeout:30000}).toBe('Session Complete');
 const inspected=(await call(page,'/api/v2/premelt/lots/'+lot.lotId)).data;expect(inspected.lot.status).toBe('QUARANTINED');
 const qa=(await call(page,'/api/v2/premelt/lots/DRI-0917/dri-qa',{analyst:'Demo lab maker',feTotal:91,feMetallic:85,C:.15,P:.04,S:.01,SiO2:4,Al2O3:2,CaO:.9,MgO:.4,moisture:.2,fines:2,confirmWarnings:true})).data;
 const released=(await call(page,'/api/v2/premelt/dri-qa/'+qa.qaId+'/approve',{approver:'Demo lab checker'})).data;expect(released.lot.status).toBe('RELEASED');
 await page.goto('/#/charge-optimizer');await page.getByRole('button',{name:'Optimize charge',exact:true}).click();await expect(page.getByRole('button',{name:'Use this mix'}).first()).toBeVisible({timeout:20000});
 const before=(await call(page,'/api/v2/premelt/movements?limit=999999')).data.length;
 await page.getByRole('button',{name:'Use this mix'}).first().click();await expect(page).toHaveURL(/premelt-gate/);expect((await call(page,'/api/v2/premelt/movements?limit=999999')).data.length).toBe(before);
 const heats=(await call(page,'/api/v2/premelt/heats')).data,heat=heats.find(h=>Number(h.heatId.slice(2))>1052&&!h.history);expect(heat).toBeTruthy();
 const gate=(await call(page,'/api/v2/premelt/heats/'+heat.heatId+'/gate-check',{by:'Demo operator'})).data;expect(['GO','WARN','HOLD']).toContain(gate.decision);expect(gate.checks.length).toBeGreaterThan(5);
 await call(page,'/api/v2/premelt/heats/'+heat.heatId+'/start-melting',{operator:'Demo operator',acknowledgeWarnings:true,...(gate.decision==='HOLD'?{override:{engineer:'Demo engineer',reason:'Reviewed simulated charge and approved a demo-only run'}}:{})});
 await expect.poll(async()=>{const r=await call(page,'/api/v2/api/v1/spectrometer');return r.data.filter(r=>r.heatId===heat.heatId).length;},{timeout:15000}).toBeGreaterThan(0);
 const c={Fe:98,C:.02,Si:.02,Mn:.02,P:.06,S:.05};
 const an=(await call(page,'/api/v2/ai/anomaly/predict',{grade:'LOW-CARBON-STEEL',composition:c}));expect(an.is_anomaly||an.anomaly_score>.5).toBeTruthy();
 const correction=(await call(page,'/api/v2/ai/individual/analyze',{metalGrade:'LOW-CARBON-STEEL',composition:c})).data;expect(correction.aiAnalysis.alloyRecommendation).toBeTruthy();
 const composition={...gate.prediction.composition,C:2.9,Si:1.7,Mn:.2};
 const ranked=(await call(page,'/api/v2/rl/optimize',{grade:heat.grade,composition,batchWeightKg:gate.prediction.metalKg})).data;expect(ranked.candidates.length).toBe(3);
 const candidate=ranked.candidates.find(c=>c.strategy==='balanced'),ledgerBefore=(await call(page,'/api/v2/premelt/movements?limit=999999')).data;
 const accepted=(await call(page,'/__mock/accept-strategy',{heatId:heat.heatId,candidate,composition})).data;expect(accepted.deductedLines.length).toBeGreaterThan(0);
 const ledgerAfter=(await call(page,'/api/v2/premelt/movements?limit=999999')).data;expect(ledgerAfter.length).toBeGreaterThan(ledgerBefore.length);for(const line of accepted.deductedLines)expect(ledgerAfter.some(m=>m.heatId===heat.heatId&&m.lotId===line.lotId&&m.kg===-line.kg)).toBe(true);
 await call(page,'/__mock/accept-strategy',{heatId:heat.heatId,candidate,composition});expect((await call(page,'/api/v2/premelt/movements?limit=999999')).data.length).toBe(ledgerAfter.length);
 const mechanical=(await call(page,'/api/v2/mechanical/predict',{grade:heat.grade,composition:gate.prediction.composition})).data;expect(mechanical.predicted_uts_mpa).toBeGreaterThan(0);
 const completed=(await call(page,'/api/v2/sales/heats/'+heat.heatId+'/complete',{approvedBy:'Demo tap engineer',composition:gate.prediction.composition,mechanical,acceptedStrategy:accepted})).data;expect(completed.status).toBe('COMPLETED');
 const invoice=(await call(page,'/api/v2/sales/invoices',{heatId:heat.heatId,customerId:'C-001',createdBy:'Demo sales',poNumber:'SO-1001'})).data;expect(invoice.total).toBeGreaterThan(0);
 for(const path of ['/api/v2/inventory/forecast','/api/v2/insights/suppliers/scorecard','/api/v2/insights/energy/summary'])expect((await call(page,path)).data).toBeTruthy();
 const audit=(await call(page,'/api/v2/premelt/audit?limit=9999')).data;expect(audit.some(a=>a.ref===heat.heatId&&a.type==='TAP_APPROVED')).toBe(true);
 const answer=await call(page,'/copilot/chat',{message:'Why is '+heat.heatId+' on HOLD?'});expect(answer.response).toContain(heat.heatId);
 await page.reload();await page.waitForFunction(()=>!!window.__METALLISENSE_MOCK__);expect((await call(page,'/api/v2/sales/invoices')).data.some(i=>i.invoiceId===invoice.invoiceId)).toBe(true);
 const savedState=await call(page,'/__mock/state');expect(savedState.extra.outbox.some(a=>/quarantined|Anomaly/.test(a.subject))).toBe(true);
 await call(page,'/api/v2/premelt/demo/reset',{});await page.reload();await page.waitForFunction(()=>!!window.__METALLISENSE_MOCK__);await expect.poll(async()=>((await call(page,'/api/v2/sales/invoices')).data.length)).toBe(0);
 expect((await call(page,'/api/v2/premelt/lots')).data.some(l=>l.lotId===lot.lotId)).toBe(false);
 expect(errors).toEqual([]);expect(blocked).toEqual([]);expect(failed).toEqual([]);
});
for(const route of ['rl-optimizer','full-analysis'])test('accepted candidate stock deduction through '+route+' UI',async({page})=>{
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin==='http://127.0.0.1:4179')return r.continue();external.push(r.request().url());return r.abort();});
 await page.goto('/#/dashboard');await page.waitForFunction(()=>!!window.__METALLISENSE_MOCK__);
 const gate=(await call(page,'/api/v2/premelt/heats/H-1051/gate-check',{by:'UI tester'})).data;
 await call(page,'/api/v2/premelt/heats/H-1051/start-melting',{operator:'UI tester',acknowledgeWarnings:true,...(gate.decision==='HOLD'?{override:{engineer:'Demo engineer',reason:'Reviewed this simulated test heat for browser validation'}}:{})});
 const composition={...gate.prediction.composition,C:2.9,Si:1.7,Mn:.2},reading={metalGrade:'SG-IRON',composition,heatId:'H-1051'},ranked=(await call(page,'/api/v2/rl/optimize',{grade:'SG-IRON',composition,batchWeightKg:gate.prediction.metalKg})).data;
 const flow={heatId:'H-1051',grade:'SG-IRON',metalKg:gate.prediction.metalKg,chargeKg:1020,gateId:gate.gateId,gateDecision:gate.decision,predictedComposition:composition,compositionSigma:gate.prediction.sigma,gateSpec:gate.spec,stockStatus:'pending',anomalyResult:{_reading:reading,severity:'LOW'},alloyResult:{_reading:reading},rlResult:{...ranked,_reading:reading},suggestedAdditions:gate.suggestedAdditions};
 await page.evaluate(flow=>sessionStorage.setItem('metallisense.meltFlow.v1',JSON.stringify(flow)),flow);
 await page.goto('/#/'+route);await page.reload();await page.waitForFunction(()=>!!window.__METALLISENSE_MOCK__);
 if(route==='full-analysis'){
  await page.getByRole('button',{name:'Run Full Analysis',exact:true}).click();await expect(page.getByText('BALANCED',{exact:true})).toBeVisible({timeout:20000});
  const card=page.locator('div.relative.border-2').filter({has:page.getByText('BALANCED',{exact:true})});await card.locator('button').first().click();
 }else await page.locator('#rl-strategy-balanced').getByRole('button',{name:'Accept & Deduct Stock'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('metallisense.meltFlow.v1')).stockStatus)).toBe('deducted');
 const state=await call(page,'/__mock/state'),heat=state.store.heats.find(([id])=>id==='H-1051')[1];expect(heat.acceptedStrategy.strategy).toBe('balanced');
 const movements=state.store.movements.filter(m=>m.heatId==='H-1051'&&m.type==='ADDITION');expect(movements.length).toBeGreaterThan(0);
 for(const line of heat.acceptedStrategy.deductedLines)expect(movements.some(m=>m.lotId===line.lotId&&m.kg===-line.kg)).toBe(true);
 await page.goto('/#/mechanical-properties');await expect(page.getByText('Mechanical property prediction complete',{exact:true})).toBeVisible({timeout:15000});
 await expect.poll(async()=>{const x=await call(page,'/api/v2/premelt/heats/H-1051');return x.data.readings?.length||0;},{timeout:15000}).toBeGreaterThan(0);
 expect(errors).toEqual([]);expect(external).toEqual([]);
});
