import modelFixtures from './model-fixtures.json';
import { beforeAll,afterAll,beforeEach,describe,it,expect,vi } from 'vitest';
import { createRequire } from 'node:module';
import { startMock,dispatch,requirePort,reset } from '../src/mock/server.js';
import { solveCharge } from '../src/mock/handlers/optimizer.js';
import { alloy,anomaly } from '../src/mock/handlers/ai.js';
import { mapIntent } from '../src/services/voiceIntents.js';
import { createHoldAnnouncer, heatVoiceAnswer, spokenGateReasonAnswer, gateReasonAnswer } from '../src/services/voiceGateAnswers.js';
const saved=new Map();
globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.sessionStorage={removeItem:()=>{}};
globalThis.window=new EventTarget();window.fetch=globalThis.fetch;window.SpeechRecognition=null;
globalThis.document={addEventListener:()=>{}};globalThis.location={href:'http://static.local/',origin:'http://static.local'};window.location=globalThis.location;
beforeAll(async()=>{await startMock();});
const grade='SG-IRON';
const config={GRADE_SPECS:{[grade]:{C:[3,4],Si:[1.8,2.8],Mn:[.3,1],P:[0,.08],S:[0,.03]}},RESIDUAL_LIMITS:{[grade]:{Cu:.2}}};
const middle={C:3.5,Si:2.3,Mn:.65,P:.02,S:.01,Cu:.05};
const lot=(id,cost=30,kg=1000,comp=middle,status='RELEASED')=>({lotId:id,costPerKg:cost,availableKg:kg,declared:comp,status,chemistrySource:'LAB'});
const chem={lotChemistry:l=>({yield:1,composition:l.declared}),predictMeltdown:lines=>({metalKg:lines.reduce((s,l)=>s+l.kg,0),composition:Object.fromEntries(Object.keys(middle).map(e=>[e,lines.reduce((s,l)=>s+l.kg*l.lot.declared[e],0)/lines.reduce((s,l)=>s+l.kg,0)]))})};
const solve=(lots,options={})=>solveCharge({grade,targetKg:1000,...options},lots,config,chem);

describe('resettable H-1053 HOLD voice demo', () => {
 beforeEach(async () => { await reset(); });
 const check = async () => {
  const response = await dispatch('POST', 'http://local/api/v2/premelt/heats/H-1053/gate-check', { by: 'Demo operator' });
  expect(response.status).toBe(200);
  return response.data.data;
 };
 const heatView = async () => (await dispatch('GET', 'http://local/api/v2/premelt/heats/H-1053')).data.data;
 it('seeds a 1000 kg planned charge and repeatedly gets exactly two real blocking checks without using stock', async () => {
  const store = requirePort('premeltGate/store'), heat = store.heats.get('H-1053');
  expect(heat).toMatchObject({ grade: 'SG-IRON', targetKg: 1000, status: 'PLANNED', gate: null });
  expect(heat.charge.reduce((sum, line) => sum + line.kg, 0)).toBe(1000);
  const before = store.availableKg('PIG-1053');
  for (let i = 0; i < 2; i++) {
   const gate = await check();
   expect(gate.decision).toBe('HOLD');
   expect(gate.blocking).toHaveLength(2);
   expect(gate.checks.filter(c => c.status === 'FAIL').map(c => c.id)).toEqual(['lot_status', 'residuals']);
   expect(gate.prediction.composition.Cu).toBeGreaterThan(.3);
  }
  expect(store.availableKg('PIG-1053')).toBe(before);
  expect(heat.status).toBe('PLANNED');
  expect(() => requirePort('premeltGate/gateEngine').startMelting('H-1053', { operator: 'Demo operator' })).toThrow(/Furnace start is locked/);
  await reset();
  expect(requirePort('premeltGate/store').heats.get('H-1053').gate).toBeNull();
  expect((await check()).blocking).toHaveLength(2);
 });
 it('answers the supplied Tamil status and HOLD reason commands from the real gate in the selected language', async () => {
  await check();
  const heat = await heatView();
  const status = mapIntent('Heat 1053 status என்ன');
  expect(status).toEqual({ intent: 'heat_status', params: { heatNumber: 1053 } });
  expect(heatVoiceAnswer(status.intent, heat, status.params, 'ta')).toBe('Heat H-1053: நிலை PLANNED. Gate HOLD');
  for (const transcript of ['ஏன் HOLD', 'why hold heat 1053']) {
   const mapped = mapIntent(transcript);
   expect(mapped.intent).toBe('gate_reason');
   const tamil = heatVoiceAnswer(mapped.intent, heat, mapped.params, 'ta');
   expect(tamil).toContain('PIG-1053 தனிமைப்படுத்தப்பட்டுள்ளது');
   expect(tamil).toContain('செம்பு (Cu) 0.5 சதவீதம்');
   expect(tamil).toContain('0.3 சதவீதத்தை மீறுகிறது');
   expect(tamil).not.toContain('Cannot be charged');
   expect(heatVoiceAnswer(mapped.intent, heat, mapped.params, 'en')).toBe(heat.gateResult.blocking.join('. '));
  }
 });
 it('uses warnings rather than blocking/headline for a real WARN heat, including Tamil', async () => {
  const store = requirePort('premeltGate/store'), lot = store.getLot('PIG-1053');
  lot.declared.Cu = .27;
  store.setStatus(lot, 'RELEASED', 'Released for warning regression', 'test');
  const gate = await check();
  expect(gate.decision).toBe('WARN');
  expect(gate.blocking).toEqual([]);
  const heat = await heatView();
  for (const transcript of ['ஏன் HOLD', 'why hold heat 1053', 'why warn heat 1053', 'ஏன் எச்சரிக்கை']) {
   const mapped = mapIntent(transcript);
   expect(mapped.intent).toBe('gate_reason');
   expect(heatVoiceAnswer(mapped.intent, heat, mapped.params, 'en')).toBe(gate.warnings.join('. '));
   const tamil = heatVoiceAnswer(mapped.intent, heat, mapped.params, 'ta');
   expect(tamil).toContain('செம்பு (Cu) 0.27 சதவீதம்');
   expect(tamil).toContain('அபாயம்');
   expect(tamil).not.toBe(gate.headline);
  }
 });
 it('announces HOLD once across reruns, rerenders and language changes, then rearms after Reset', async () => {
  const gate = await check(), announcer = createHoldAnnouncer(), speak = vi.fn();
  announcer.announce('H-1053', null, speak, 'ta');
  announcer.announce('H-1053', gate, speak, 'ta');
  announcer.announce('H-1053', gate, speak, 'ta');
  announcer.announce('H-1053', await check(), speak, 'en');
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0][0]).toContain('Heat H-1053: Gate HOLD. உருக்கத் தொடங்க முடியாது');
  expect(speak.mock.calls[0][0]).toContain('செம்பு 0.50 சதவீதம், அதிகம்');
  expect(speak.mock.calls[0][1]).toBe('ta');
  announcer.reset();
  announcer.announce('H-1053', gate, speak, 'ta');
  expect(speak).toHaveBeenCalledTimes(2);
  announcer.announce('H-1053', { decision: 'WARN' }, speak, 'ta');
  announcer.announce('H-1053', gate, speak, 'ta');
  expect(speak).toHaveBeenCalledTimes(3);
 });
 it('does not consume the HOLD announcement while muted', async () => {
  const gate = await check(), announcer = createHoldAnnouncer(), speak = vi.fn();
  announcer.announce('H-1053', gate, speak, 'ta', true);
  expect(speak).not.toHaveBeenCalled();
  announcer.announce('H-1053', gate, speak, 'ta', false);
  expect(speak).toHaveBeenCalledTimes(1);
 });
});
describe('short gate-reason speech with complete screen text', () => {
 const warning = {
  decision: 'WARN', warnings: ['Low carbon, low silicon, high manganese', 'AI risk warning'],
  checks: [
   { id: 'spec_prediction', status: 'WARN', details: [
    { element: 'C', value: 2.567, min: 3, max: 4, status: 'WARN' },
    { element: 'Si', value: 1.234, min: 1.8, max: 2.8, status: 'WARN' },
    { element: 'Mn', value: 1.257, min: .3, max: 1, status: 'WARN' },
   ] },
   { id: 'ai_assessment', status: 'WARN', summary: 'AI risk warning' },
  ],
 };
 it('caps individual element reasons at two, rounds to two decimals and excludes AI from speech/counts', () => {
  const original = structuredClone(warning);
  expect(spokenGateReasonAnswer(warning, 'ta')).toBe('கார்பன் 2.57 சதவீதம், குறைவு. சிலிக்கான் 1.23 சதவீதம், குறைவு. மேலும் 1 விவரங்கள் திரையில்');
  const screen = heatVoiceAnswer('gate_reason', { gateResult: warning }, {}, 'ta');
  expect(screen).toBe(gateReasonAnswer(warning, 'ta'));
  expect(screen).toContain('மாங்கனீசு (Mn)');
  expect(screen).toContain('செயற்கை நுண்ணறிவு');
  expect(warning).toEqual(original);
 });
 it('prioritizes blocking failures over warnings regardless of their input order', () => {
  const gate = { ...warning, decision: 'HOLD', checks: [
   ...warning.checks,
   { id: 'residuals', status: 'FAIL', details: [{ element: 'Cu', value: .678, max: .3, status: 'FAIL' }] },
   { id: 'spec_prediction', status: 'FAIL', details: [{ element: 'P', value: .1234, max: .08, status: 'FAIL' }] },
  ] };
  expect(spokenGateReasonAnswer(gate, 'ta')).toBe('பாஸ்பரஸ் 0.12 சதவீதம், அதிகம். செம்பு 0.68 சதவீதம், அதிகம். மேலும் 3 விவரங்கள் திரையில்');
 });
 it('keeps non-element reasons brief and does not add a remainder for exactly two reasons', () => {
  const gate = { decision: 'HOLD', checks: [
   { id: 'lot_status', status: 'FAIL', details: [{ lotId: 'PIG-1053', status: 'FAIL', text: 'QUARANTINED' }] },
   { id: 'residuals', status: 'FAIL', details: [{ element: 'Cu', value: .5, max: .3, status: 'FAIL' }] },
  ] };
  expect(spokenGateReasonAnswer(gate, 'ta')).toBe('PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு 0.50 சதவீதம், அதிகம்');
 });
 it('uses the same cap and rounding in English while retaining all screen warnings', () => {
  expect(spokenGateReasonAnswer(warning, 'en')).toBe('C 2.57 percent, low. Si 1.23 percent, low. 1 more on screen');
  expect(gateReasonAnswer(warning, 'en')).toBe(warning.warnings.join('. '));
 });
 it('omits AI-only speech and handles unchecked/GO gates', () => {
  expect(spokenGateReasonAnswer({ decision: 'HOLD', checks: [{ id: 'ai_assessment', status: 'FAIL', summary: 'AI risk high' }] }, 'ta')).toBe('மேலும் விவரங்கள் திரையில்');
  expect(spokenGateReasonAnswer(null, 'ta')).toBe(gateReasonAnswer(null, 'ta'));
  expect(spokenGateReasonAnswer({ decision: 'GO' }, 'en')).toBe(gateReasonAnswer({ decision: 'GO' }, 'en'));
 });
 it('caps legacy saved reasons and removes their AI-risk sentence', () => {
  expect(spokenGateReasonAnswer({ decision: 'WARN', warnings: ['Stock low', 'AI off-spec risk high', 'Lab approval needed', 'Inspect scrap'] }, 'en'))
   .toBe('Stock low. Lab approval needed. 1 more on screen');
 });
});

describe('charge optimizer: 12 constraint and input cases',()=>{
 it('finds the cheapest feasible mix',()=>{const r=solve([lot('A'),lot('B',50)]);expect(r.feasible).toBe(true);expect(r.candidates[0].charge[0].lotId).toBe('A');});
 it('preserves exact target mass',()=>expect(solve([lot('A')]).candidates[0].charge.reduce((s,l)=>s+l.kg,0)).toBeCloseTo(1000));
 it('respects stock limits',()=>{const r=solve([lot('A',30,400),lot('B',50)]);expect(r.candidates[0].charge.find(l=>l.lotId==='A').kg).toBeCloseTo(400);});
 it('excludes quarantined lots',()=>expect(solve([lot('A',1,1000,middle,'QUARANTINED'),lot('B')]).candidates[0].charge.every(l=>l.lotId!=='A')).toBe(true));
 it('excludes QA hold lots',()=>expect(solve([lot('A',1,1000,middle,'HOLD')]).feasible).toBe(false));
 it('limits restricted lot share',()=>{const a=lot('A',1,1000,middle,'RESTRICTED');a.restriction={maxSharePct:20};expect(solve([a,lot('B')]).candidates[0].charge.find(l=>l.lotId==='A').kg).toBeCloseTo(200);});
 it('enforces 10 percent safety margin',()=>expect(solve([lot('A',30,1000,{...middle,C:3.01})]).feasible).toBe(false));
 it('enforces residual caps',()=>expect(solve([lot('A',30,1000,{...middle,Cu:.3})]).feasible).toBe(false));
 it('explains insufficient stock',()=>{const r=solve([lot('A',30,10)]);expect(r.feasible).toBe(false);expect(r.blockingConstraint).toMatch(/stock/);});
 it('changes selection when prices change',()=>expect(solve([lot('A',50),lot('B',10)]).candidates[0].charge[0].lotId).toBe('B'));
 it('offers an alternative without the main lot',()=>{const r=solve([lot('A'),lot('B',50)]);expect(r.candidates[2].charge.every(l=>l.lotId!=='A')).toBe(true);});
 it('rejects invalid weight and unknown grade',()=>{expect(()=>solve([lot('A')],{targetKg:-1})).toThrow();expect(()=>solve([lot('A')],{grade:'UNKNOWN'})).toThrow();});
});
describe('gate parity and interlocks',()=>{
 it('matches Node checks and verdict with the same risk assessment for three heats',async()=>{
  const nodeRequire=createRequire(new URL('../../../MetalliSense_Backend_Simple/server.js',import.meta.url));
  const nodeStore=nodeRequire('./premeltGate/store'),nodeGate=nodeRequire('./premeltGate/gateEngine'),nodeAxios=nodeRequire('axios');
  const original=nodeAxios.post;nodeAxios.post=async(u,b)=>{const r=await dispatch('POST','http://local/premelt/assess',b);return {data:r.data};};
  try{for(const charge of [[],[{lotId:'PIG-0901',kg:1000}],[{lotId:'PIG-0901',kg:400},{lotId:'RET-1043',kg:600}]]){
   const data={grade,targetKg:1000,charge,status:'PLANNED',gate:null,gateHistory:[]};const a=nodeStore.heats.add(structuredClone(data)),b=requirePort('premeltGate/store').heats.add(structuredClone(data));
   const real=await nodeGate.runGate(a.heatId),mock=await requirePort('premeltGate/gateEngine').runGate(b.heatId);
   expect(mock.decision).toBe(real.decision);expect(mock.fingerprint).toBe(real.fingerprint);expect(mock.checks).toEqual(real.checks);expect(mock.prediction).toEqual(real.prediction);
  }}finally{nodeAxios.post=original;}
 });
 it('requires a current gate and operator before start',()=>{const st=requirePort('premeltGate/store'),h=st.heats.add({grade,targetKg:1000,charge:[],status:'PLANNED',gate:null,gateHistory:[]});expect(()=>requirePort('premeltGate/gateEngine').startMelting(h.heatId,{})).toThrow(/Operator/);expect(()=>requirePort('premeltGate/gateEngine').startMelting(h.heatId,{operator:'Tester'})).toThrow(/pre-melt/);});
 it('persists mutations, has no 500 event audit cap',async()=>{const st=requirePort('premeltGate/store');for(let i=0;i<550;i++)st.log('TEST','unit','tester','event '+i);await dispatch('GET','http://static.local/api/v2/premelt/audit?limit=9999');expect(st.audit().length).toBeGreaterThan(500);expect(saved.get('metallisense.browser-demo.v1')).toContain('event 549');});
 it('never deducts a planned heat before human approval',async()=>{const st=requirePort('premeltGate/store'),before=st.availableKg('PIG-0901');const r=await dispatch('POST','http://local/api/v2/premelt/heats',{grade,targetKg:1000,charge:[{lotId:'PIG-0901',kg:1000}]});expect(r.status).toBe(200);expect(st.availableKg('PIG-0901')).toBe(before);});
});

describe('exported model numerical parity',()=>{
 for(const sample of modelFixtures)it(sample.grade+' '+sample.case,async()=>{
  const a=await anomaly(sample.grade,sample.composition),c=await alloy(sample.grade,sample.composition);
  expect(a.raw_score).toBeCloseTo(sample.anomaly.raw_score,6);
  expect(a.anomaly_score).toBeCloseTo(sample.anomaly.anomaly_score,6);
  expect(a.severity).toBe(sample.anomaly.severity);
  expect(c.recommended_additions).toEqual(sample.alloy.recommended_additions);
  expect(c.confidence).toBeCloseTo(sample.alloy.confidence,6);
 });
});

describe('stock transaction safeguards',()=>{
 it('prevalidates all deduction lines without partial mutation',async()=>{
  const st=requirePort('premeltGate/store'),before=st.availableKg('ALY-0903');
  const r=await dispatch('POST','http://local/api/v2/premelt/additives/deduct',{lines:[{lotId:'ALY-0903',kg:10},{lotId:'missing',kg:1}]});
  expect(r.status).toBeGreaterThanOrEqual(400);expect(st.availableKg('ALY-0903')).toBe(before);
 });
 it('rejects cumulative duplicate-lot demand and nonpositive kg',async()=>{
  const st=requirePort('premeltGate/store'),before=st.availableKg('ALY-0903');
  const r=await dispatch('POST','http://local/api/v2/premelt/additives/deduct',{lines:[{lotId:'ALY-0903',kg:before*.6},{lotId:'ALY-0903',kg:before*.6}]});expect(r.status).toBe(409);expect(st.availableKg('ALY-0903')).toBe(before);
  const bad=await dispatch('POST','http://local/api/v2/premelt/additives/deduct',{lines:[{lotId:'ALY-0903',kg:-1}]});expect(bad.status).toBe(400);
 });
 it('rejects impossible accepted strategy before stock or learning changes',async()=>{
  const st=requirePort('premeltGate/store'),before=st.availableKg('PIG-0901'),h=st.heats.add({grade,targetKg:1000,status:'MELTING',charge:[],gate:{prediction:{metalKg:1000}},gateHistory:[]});
  const updates=(await dispatch('GET','http://local/rl/policy/status')).data.n_updates;
  const r=await dispatch('POST','http://local/__mock/accept-strategy',{heatId:h.heatId,composition:middle,candidate:{strategy:'balanced',aggressiveness:1,recommended_additions:{Fe:100000}}});
  expect(r.status).toBe(409);expect(st.availableKg('PIG-0901')).toBe(before);expect(h.acceptedStrategy).toBeUndefined();expect((await dispatch('GET','http://local/rl/policy/status')).data.n_updates).toBe(updates);
 });
});

it('RL candidates explicitly exclude unsupported impurity additions before approval',async()=>{
 const r=await dispatch('POST','http://local/rl/optimize',{grade:'SG-IRON',composition:{Fe:93,C:2.9,Si:1.7,Mn:.2,P:.035,S:.013}});
 for(const c of r.data.candidates){expect(c.recommended_additions.P||0).toBe(0);expect(c.recommended_additions.S||0).toBe(0);if(c.excluded_additions.S)expect(c.constraint_violations.S).toMatch(/Excluded/);}
});
it('feedback changes persisted reward weights and candidate scores',async()=>{
 const b={grade:'SG-IRON',composition:{Fe:93,C:2.9,Si:1.7,Mn:.2,P:.035,S:.013}},before=(await dispatch('POST','http://local/rl/optimize',b)).data;
 const candidate=before.candidates.find(c=>c.strategy==='balanced'),updates=before.policy_status.n_updates;
 const response=await dispatch('POST','http://local/rl/feedback',{...b,additions:candidate.recommended_additions,aggressiveness:1,outcome:'rejected'});
 expect(response.data.policy_status.n_updates).toBe(updates+1);
 const after=(await dispatch('POST','http://local/rl/optimize',b)).data;
 expect(after.candidates.map(c=>c.predicted_reward)).not.toEqual(before.candidates.map(c=>c.predicted_reward));
 expect(JSON.parse(saved.get('metallisense.browser-demo.v1')).extra.reward.n_updates).toBe(updates+1);
});


describe('real Agent transport in factory mock mode', () => {
 it('sends voice status and chat to the Agent', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  const fetchAgent=vi.fn(async()=>new Response('{"ok":true}'));
  for(const path of ['/copilot/voice/status','/copilot/chat','/copilot/chat/history']) {
   const response=await tryRealCopilot(fetchAgent,'http://localhost:8001'+path);
   expect(response.status).toBe(200);
  }
  expect(fetchAgent).toHaveBeenCalledTimes(3);
 });
 it('keeps factory APIs and other external origins mocked', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  const fetchAgent=vi.fn();
  for(const url of ['http://localhost:8001/api/v2/premelt/heats','http://localhost:8001/copilot/explain','https://elsewhere.test/copilot/chat']) expect(await tryRealCopilot(fetchAgent,url)).toBeNull();
  expect(fetchAgent).not.toHaveBeenCalled();
 });
 it('preserves multipart audio and lets fetch set the boundary', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  const body=new FormData();body.append('audio',new Blob(['audio']));
  const fetchAgent=vi.fn(async()=>new Response('{"text":"heat 42"}'));
  await tryRealCopilot(fetchAgent,'http://localhost:8001/copilot/voice/transcribe',{method:'POST',body,headers:{'Content-Type':'multipart/form-data'}});
  expect(fetchAgent.mock.lastCall[1].body).toBe(body);
  expect(fetchAgent.mock.lastCall[1].headers.has('Content-Type')).toBe(false);
 });
 it('preserves binary synthesis responses and provider headers', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  const response=await tryRealCopilot(async()=>new Response(new Uint8Array([82,73,70,70]),{headers:{'Content-Type':'audio/wav','X-TTS-Provider':'gnani'}}),'http://localhost:8001/copilot/voice/synthesize');
  expect(response.headers.get('X-TTS-Provider')).toBe('gnani');
  expect((await response.blob()).size).toBe(4);
 });
 it('falls back on connection failure but preserves reachable Agent errors', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  expect(await tryRealCopilot(async()=>{throw new TypeError('Failed to fetch');},'http://localhost:8001/copilot/chat')).toBeNull();
  const response=await tryRealCopilot(async()=>new Response('Provider error',{status:504}),'http://localhost:8001/copilot/chat');
  expect(response.status).toBe(504);
 });
 it('does not fall back when the caller cancels', async () => {
  const {tryRealCopilot}=await import('../src/mock/copilotTransport.js');
  const controller=new AbortController();controller.abort();
  await expect(tryRealCopilot(vi.fn(),'http://localhost:8001/copilot/chat',{signal:controller.signal})).rejects.toHaveProperty('name','AbortError');
 });
});
