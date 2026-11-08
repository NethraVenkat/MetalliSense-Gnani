import {it,expect,vi,afterEach} from 'vitest';
import {voiceDiagnostics,approvalReason} from '../src/services/voiceDiagnostics';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
import {voiceTestLog} from '../src/services/voiceTestLog';
import {createActionFlow,registry} from '../src/services/voiceActions';
import {prepareVoiceAction} from '../src/services/voiceActionRegistry';
import {holdStartMessage,spokenOnly} from '../src/services/voiceWording';
import {createPageControls} from '../src/services/voicePageControls';
afterEach(()=>vi.unstubAllEnvs());
it('invoice speech resolves the customer ID from the loaded screen list',async()=>{
 const createInvoice=vi.fn().mockResolvedValue({status:201,data:{data:{invoiceId:'INV-TEST'}}});
 const context={route:'/sales',loaded:{customers:[{id:'C-001',name:'Test customer'}]}};
 const action=prepareVoiceAction('issue invoice H-1051 customer C-001 10 kg at 50',context,{createInvoice});
 const ask=vi.fn();await action.collect(ask,{});await action.precheck();
 await action.execute({user:{name:'Test manager',role:'Manager'}});
 expect(ask).not.toHaveBeenCalled();
 expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({customerId:'C-001',heatId:'H-1051',qtyKg:10,ratePerKg:50}));
 const missing=prepareVoiceAction('issue invoice H-1051 customer UNKNOWN 10 kg at 50',context,{createInvoice});
 await expect(missing.collect(ask,{})).rejects.toThrow('missing or ambiguous');
 expect(createInvoice).toHaveBeenCalledTimes(1);
});
it.each([['connect spectrometer',false],['disconnect spectrometer',true],['request reading',true]])('reading-list refresh does not block %s; busy operations still do',async(phrase,connected)=>{
 const context={route:'/spectrometer',loaded:{loading:true,opcConnected:connected}};
 await expect(prepareVoiceAction(phrase,context).precheck()).resolves.toEqual({ok:true});
 await expect(prepareVoiceAction(phrase,{...context,loaded:{...context.loaded,busy:true}}).precheck()).rejects.toThrow('finish loading');
});
it('browser refresh waits for the spoken acknowledgment and audit before reloading',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_AUDIT','true');
 let finishSpeech;const navigate=vi.fn(),audit=vi.fn();
 const controls=createPageControls({getContext:()=>({route:'/dashboard'}),navigate,select:()=>{},document:{querySelector:()=>({querySelectorAll:()=>[]})}});
 const handle=createTranscriptHandler({lang:'en',setHeard:()=>{},audit,say:()=>new Promise(resolve=>{finishSpeech=resolve;}),pageContext:{route:'/dashboard',controls}});
 const work=handle('refresh');await Promise.resolve();await Promise.resolve();
 expect(navigate).not.toHaveBeenCalled();expect(audit).toHaveBeenCalledTimes(1);
 finishSpeech();await work;expect(navigate).toHaveBeenCalledWith(0);
});
it('successful page controls audit executed; missing controls audit refused',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_AUDIT','true');
 const audit=vi.fn(),controls=vi.fn().mockResolvedValueOnce({ok:true,text:'Scrolled.',reason_code:'executed'}).mockResolvedValueOnce({ok:false,text:'Missing row.',reason_code:'no_target'});
 const handle=createTranscriptHandler({lang:'en',say:vi.fn(),audit,setHeard:()=>{},pageContext:{route:'/dashboard',controls}});
 await handle('scroll down');await handle('select missing');
 expect(audit.mock.calls.map(([event])=>[event.decision,event.reason_code])).toEqual([['executed','executed'],['refused','no_target']]);
});
it('diagnostics explain the winner with three deterministic candidates and the selected target',()=>{
 const row=voiceDiagnostics('approve PR seven',{winner:'approve_pr',level:'APPROVE',context:{selected:{prId:'PR-7'}},reason:'wrong_role'});
 expect(row.normalized_text).toBe('approve pr 7');expect(row.candidates).toHaveLength(3);expect(row.candidates[0]).toEqual({intent:'approve_pr',score:1});expect(row.target).toBe('pr 7');expect(row.reason_code).toBe('wrong_role');
});
it('private diagnostics never keep the captured input',()=>{
 const row=voiceDiagnostics('private input',{privateTurn:true,winner:'approve_pr'});
 expect(row.heard).toBe('[passcode masked]');expect(row.normalized_text).toBe('[passcode masked]');expect(JSON.stringify(row)).not.toContain('private input');
});
it('legacy refusal has an explicit reason and exactly one turn audit',async()=>{
 vi.stubEnv('VITE_VOICE_AUDIT','true');const audit=vi.fn(),say=vi.fn();
 await createTranscriptHandler({lang:'en',say,audit,setHeard:()=>{},pageContext:{route:'/inventory-forecast'}})('release everything');
 expect(audit).toHaveBeenCalledTimes(1);expect(audit).toHaveBeenCalledWith(expect.objectContaining({reason_code:'legacy_readonly_guard',winner:'blocked',page:'/inventory-forecast'}));
});
it.each(['approve pr 7','approve pr7','approve p r 7','approve PR seven','approve பி ஆர் 7','approve PR सात','approve the selected PR','approve this PR','approve selected one'])('registered PR action resolves spoken/selected target: %s',async text=>{
 const approve=vi.fn(),context={route:'/inventory-forecast',selected:{prId:'PR-7'},loaded:{prs:[{prId:'PR-7',status:'PENDING_APPROVAL',qtyKg:10,supplier:'Fixture'}]}};
 const action=prepareVoiceAction(text,context,{approvePurchaseRequest:approve});expect(action?.id).toBe('approve_pr');await action.precheck();expect(action.buildSummary().displayText).toContain('PR-7');expect(approve).not.toHaveBeenCalled();
});
it('connect the spectrometer dispatches the registered action before navigation',async()=>{
 vi.stubEnv('VITE_VOICE_ACTIONS','true');vi.stubEnv('VITE_VOICE_EVERYWHERE','true');const navigate=vi.fn(),handled=[];
 const context={route:'/spectrometer',loaded:{opcConnected:false}};
 await createTranscriptHandler({lang:'en',say:vi.fn(),setHeard:()=>{},navigate,pageContext:context,actionControl:async(text,ctx)=>{const action=prepareVoiceAction(text,ctx);handled.push(action?.id);return Boolean(action);}})('connect the spectrometer');
 expect(handled).toEqual(['opc_connect']);expect(navigate).not.toHaveBeenCalled();
});
it('navigation to the current page never fires and off-page action phrases do not navigate',async()=>{
 vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_ACTIONS','true');vi.stubEnv('VITE_VOICE_AUDIT','true');
 const navigate=vi.fn(),audit=vi.fn();const handler=createTranscriptHandler({lang:'en',say:vi.fn(),setHeard:()=>{},navigate,audit,pageContext:{route:'/spectrometer'},actionControl:async()=>false});
 await handler('go to spectrometer');expect(navigate).not.toHaveBeenCalled();
 const other=createTranscriptHandler({lang:'en',say:vi.fn(),setHeard:()=>{},navigate,audit,pageContext:{route:'/dashboard'},actionControl:async()=>false});await other('connect the spectrometer');expect(navigate).not.toHaveBeenCalled();expect(audit.mock.calls.at(-1)[0].reason_code).toBe('no_target');
});
it('human approval reasons include retry counts and rounded lock minutes',()=>{
 expect(approvalReason({reason_code:'wrong_code',tries_remaining:2})).toBe('Wrong code, 2 tries left.');
 expect(approvalReason({locked:true,retry_after:479})).toContain('8 minutes');
 expect(approvalReason({reason_code:'code_not_digits'})).toContain('Say only the 6 digits');
});
it('export includes Heard, Matched, Reason and normalized matching diagnostics',()=>{
 const text=voiceTestLog([{ts:new Date().toISOString(),heard:'approve PR7',winner:'approve_pr',reason_code:'wrong_role',normalized_text:'approve pr7',target:'PR7'}]);
 expect(text).toContain('| Matched | Reason | Normalized | Target |');expect(text).toContain('approve PR7');expect(text).toContain('wrong_role');
});
it('approval retries malformed speech once and wrong codes while attempts remain',async()=>{
 vi.useFakeTimers();try{
  const spoken=[],capture=vi.fn(async()=>({text:'[passcode masked]'})),execute=vi.fn(async()=>({status:200}));
  const api={readback:vi.fn(),audit:vi.fn(),cancel:vi.fn(async()=>{}),consume:vi.fn(async()=>({ok:true})),authorize:vi.fn().mockResolvedValueOnce({ok:false,reason_code:'code_not_digits',tries_remaining:3}).mockResolvedValueOnce({ok:false,reason_code:'wrong_code',tries_remaining:2}).mockResolvedValueOnce({ok:true,token:'opaque'})};
  const flow=createActionFlow({api,say:async text=>spoken.push(text),capture});const work=flow.run({...registry[0],level:'APPROVE',execute});await vi.advanceTimersByTimeAsync(5000);
  expect(await work).toBe(true);expect(capture).toHaveBeenCalledTimes(3);expect(spoken.some(s=>s.includes('Say only the 6 digits'))).toBe(true);expect(spoken.some(s=>s.includes('2 tries left'))).toBe(true);expect(execute).toHaveBeenCalledTimes(1);
  expect(capture.mock.calls.every(([o])=>o.no_store&&o.language==='ta-IN,en-IN')).toBe(true);
 }finally{vi.useRealTimers();}
});
it('a second malformed reply stops; lock reports remaining minutes and never executes',async()=>{
 for(const locked of [false,true]){
  const spoken=[],execute=vi.fn(),api={readback:vi.fn(),audit:vi.fn(),cancel:async()=>{},authorize:vi.fn(async()=>locked?{ok:false,locked:true,reason_code:'locked',retry_after:479}:{ok:false,reason_code:'code_not_digits',tries_remaining:3})};
  const flow=createActionFlow({api,say:async text=>spoken.push(text),capture:async()=>({text:'[passcode masked]'})});
  expect(await flow.run({...registry[0],level:'APPROVE',execute})).toBe(false);expect(api.authorize).toHaveBeenCalledTimes(locked?1:2);expect(execute).not.toHaveBeenCalled();if(locked)expect(spoken.at(-1)).toContain('8 minutes');
 }
});
it.each(['cancel','ரத்து','रद्द',''])('safe action listens for cancel without yes/no: %s',async reply=>{
 vi.useFakeTimers();try{
  let finishSpeech,finishCapture,options;const execute=vi.fn(async()=>({status:200})),states=[];
  const flow=createActionFlow({api:{audit:vi.fn(),cancel:async()=>{}},say:vi.fn().mockResolvedValueOnce().mockImplementationOnce(()=>new Promise(r=>finishSpeech=r)),capture:o=>{options=o;return new Promise(r=>finishCapture=r);},onChange:s=>states.push(s)});
  const work=flow.run({...registry[0],level:'ASK',cancelWindow:true,execute});await vi.advanceTimersByTimeAsync(10000);expect(options).toBeUndefined();finishSpeech();await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(5000);expect(execute).not.toHaveBeenCalled();options.onState('listening');options.onCountdown(2);finishCapture({text:reply});await vi.advanceTimersByTimeAsync(1999);expect(execute).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);
  expect(await work).toBe(!reply);expect(execute).toHaveBeenCalledTimes(reply?0:1);expect(states.some(s=>s?.onReply)).toBe(false);expect(options.timeout).toBe(2000);
 }finally{vi.useRealTimers();}
});
it.each(['en','ta','hi'])('HOLD normal start refuses with Unit Controller guidance in %s',async lang=>{
 const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD'}},start=vi.fn();
 const action=prepareVoiceAction('start melting H-1053',{route:'/premelt-gate',selected:{heatId:heat.heatId},loaded:{heats:[heat]}},{getHeat:async()=>({data:heat}),startMelting:start});
 await expect(action.precheck({lang})).rejects.toThrow(holdStartMessage(heat.heatId,lang));expect(start).not.toHaveBeenCalled();expect(heat.gateResult.decision).toBe('HOLD');
});
it('screen-only directions are removed only from speech',async()=>{
 expect(spokenOnly('Completed (see details).')).toBe('Completed.');
 expect(spokenOnly('Explanation returned; see the page.')).toBe('Explanation returned');
 const states=[],say=vi.fn();const flow=createActionFlow({api:{audit:vi.fn()},say,capture:vi.fn(),onChange:s=>states.push(s)});
 await flow.run({...registry[0],level:'ASK',execute:async()=>({status:200,message:'Completed (see details).'})});expect(states.at(-1).result).toBe('Completed (see details).');expect(say).toHaveBeenLastCalledWith('Completed.');
});
