import { afterEach, expect, it, vi } from 'vitest';
import { mapIntent } from '../src/services/voiceIntents';
import { buildShiftSummary,spokenShiftSummary,currentSummaryDecision } from '../src/services/shiftSummary';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
const {get,post}=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({get,post,interceptors:{response:{use:vi.fn()}}})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const now=Date.parse('2026-10-31T12:00:00Z');
const gate=(decision,extra={})=>({decision,validUntil:'2026-10-31T13:00:00Z',...extra});
const held={heatId:'H-1053',status:'PLANNED',gateResult:gate('HOLD',{checks:[{id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]}]})};
const heats=[held,{heatId:'H-1051',status:'PLANNED',gate:gate('GO')},{heatId:'H-1052',status:'PLANNED',gate:null},{heatId:'H-1043',status:'COMPLETED',gate:gate('HOLD')}];
it.each(['shift summary','summary sollu','இந்த ஷிஃப்ட் சுருக்கம்','இந்த ஷிஃப்ட் சுருக்கம் சொல்லு','ஷிஃப்ட் நிலைமை என்ன','எத்தனை ஹோல்ட்','shift summary batao','kitne hold hai','आज की शिफ्ट का सारांश','how many heats on hold'])('alias %s is flagged and read-only',text=>{
 expect(mapIntent(text,{shiftSummary:true})).toEqual({intent:'shift_summary',params:{}});
 expect(mapIntent(text,{shiftSummary:false}).intent).not.toBe('shift_summary');
 expect(mapIntent(text,{shiftSummary:true,langBridge:true}).intent).toBe('shift_summary');
});
it('flag default off and explicit Vite flag work',()=>{
 vi.stubEnv('VITE_SHIFT_SUMMARY','false');expect(mapIntent('shift summary').intent).not.toBe('shift_summary');
 vi.stubEnv('VITE_SHIFT_SUMMARY','true');expect(mapIntent('shift summary').intent).toBe('shift_summary');
});
it.each(['இந்த shift சுருக்கம் சொல்.','swift summary बताओ।','சம்மரி शिफ़्ट बताइए।','சுருக்கம் sift சொல்லுங்க',
 'शिफ्ट samari','summery ஷிப்ட்','இந்த ஷிஃப்ட் समरी','சம்மரி tell please','give सारांश','summary बता',
 'समरी சொல்லு','சுருக்கம் சொல்','சம்மரி sollu','please kitne hold hai today','कितने होल्ड हैं।'])('mixed-script keyword regression: %s',text=>{
 for(const langBridge of [false,true]) {
  expect(mapIntent(text,{shiftSummary:true,langBridge}).intent).toBe('shift_summary');
  expect(mapIntent(text,{shiftSummary:false,langBridge}).intent).not.toBe('shift_summary');
 }
});
it.each(['1053 summary','shift summary heat 1053','summary tell heat one zero five three','சுருக்கம் ஹீட் ஆயிரத்து ஐம்பத்தி மூணு சொல்',
 'हीट एक हजार तिरपन शिफ्ट सारांश बताओ','1053 why hold shift summary','heat 1053 carbon shift summary'])('numbered questions keep existing intent: %s',text=>{
 expect(mapIntent(text,{shiftSummary:true,langBridge:true})).toEqual(mapIntent(text,{shiftSummary:false,langBridge:true}));
 expect(mapIntent(text,{shiftSummary:true,langBridge:true}).intent).not.toBe('shift_summary');
});
it.each(['swiftly summary','shift summaries','summery storyteller','summary बताओ अप्रूव','summary approve karo'])('keyword boundaries and safety: %s',text=>{
 const result=mapIntent(text,{shiftSummary:true,langBridge:true});
 expect(result.intent).not.toBe('shift_summary');
 if(/approve|अप्रूव/u.test(text))expect(result.intent).toBe('blocked');
});
it.each(['summary approve karo','shift summary melting','kitne hold hai override karo','summary அனுமதி','summary अप्रूव','summary start karo','shift summary stock kam karo'])('safety still wins: %s',text=>expect(mapIntent(text,{shiftSummary:true,langBridge:true}).intent).toBe('blocked'));
it.each(['heat 1053 status என்ன','why hold heat 1053','copper kitna hai heat 1053','FeSi stock evvalavu','show dashboard','spectrometer kaattu','kaun se heat hold par hai','madad','carbon summary','stock summary','why hold summary','heat 1053 shift summary'])('no existing-intent collision: %s',text=>{
 expect(mapIntent(text,{shiftSummary:true,langBridge:true})).toEqual(mapIntent(text,{shiftSummary:false,langBridge:true}));
});
it('current store snapshot counts and completed exclusion',()=>{
 const before=JSON.stringify(heats);const summary=buildShiftSummary(heats,now);
 expect(summary.counts).toEqual({HOLD:1,WARN:0,GO:1,melting:0,not_checked:1});expect(summary.groups.HOLD).toEqual(['H-1053']);
 expect(summary.priorityId).toBe('H-1053');expect(summary.excludedCompleted).toBe(1);
 expect(summary.display).toContain('PIG-1053 quarantined');expect(summary.display).not.toContain('Cu');
 expect(summary.display).toContain('Completed heats excluded: 1');expect(JSON.stringify(heats)).toBe(before);
});
it.each([{validUntil:'2026-10-31T11:59:59Z'},{validUntil:'2026-10-31T12:00:00Z'},{validUntil:'invalid'},{stale:true},{expired:true}])('expired/stale checks never count GO %j',flags=>{
 const heat={heatId:'H-1051',status:'PLANNED',gate:gate('GO',flags)};
 expect(currentSummaryDecision(heat,now)).toBe('not_checked');expect(buildShiftSummary([heat],now).counts.GO).toBe(0);
});
it('summary stale overrides detailed gate; inactive/cancelled not counted',()=>{
 const stale={...held,gate:{stale:true}};
 const summary=buildShiftSummary([stale,{heatId:'H-1000',status:'CANCELLED',gate:gate('GO')}],now);
 expect(summary.counts).toEqual({HOLD:0,WARN:0,GO:0,melting:0,not_checked:1});expect(summary.excludedOther).toBe(1);
});
it('priority HOLD before WARN, deterministic heat order, then WARN only',()=>{
 const snapshot=[{...held,heatId:'H-1059'},{heatId:'H-1052',status:'PLANNED',gate:gate('WARN')},{...held,heatId:'H-1053'}];
 expect(buildShiftSummary(snapshot,now).priorityId).toBe('H-1053');
 expect(buildShiftSummary(snapshot.slice(1,2),now).priorityId).toBe('H-1052');
});
it('asking again sees changed decisions, not cached summary',()=>{
 const store=structuredClone(heats);expect(buildShiftSummary(store,now).counts.HOLD).toBe(1);
 store[0].gateResult.decision='GO';expect(buildShiftSummary(store,now).counts).toEqual({HOLD:0,WARN:0,GO:2,melting:0,not_checked:1});
});
it.each(['melting','ACTIVE','IN_PROGRESS','melt-in-progress','MELTING_IN_PROGRESS','IN_PROGRESS_MELT'])('in-progress %s is melting regardless of gate and never priority',status=>{
 for(const result of [null,gate('GO'),gate('HOLD'),gate('WARN'),gate('GO',{expired:true})]) {
  const summary=buildShiftSummary([{heatId:'H-1000',status,gate:result},held],now);
  expect(summary.counts).toEqual({HOLD:1,WARN:0,GO:0,melting:1,not_checked:0});
  expect(summary.groups.melting).toEqual(['H-1000']);expect(summary.priorityId).toBe('H-1053');
  expect(summary.display).toContain('1 melting (H-1000)');
 }
 expect(buildShiftSummary([{heatId:'H-1000',status,gate:gate('HOLD')}],now).priorityId).toBeNull();
});
it.each(['ta','hi','en'])('omits zero categories and speaks melting with short sentences %s',lang=>{
 const summary=buildShiftSummary([held,{heatId:'H-1051',status:'PLANNED',gate:gate('GO')},{heatId:'H-1052',status:'MELTING'}],now);
 expect(summary.counts).toEqual({HOLD:1,WARN:0,GO:1,melting:1,not_checked:0});
 const text=spokenShiftSummary(summary,lang,{clarity:true,register:'colloquial'});
 expect(text).toContain(lang==='ta'?'ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு':lang==='hi'?'एक हीट भट्टी में है':'one melting');
 expect(text).not.toMatch(/எச்சரிக்கை|चेतावनी|WARN|not checked|चेक नहीं|செக் பண்ணல/);
 for(const sentence of text.split(/[.।]/).filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
 const warning=spokenShiftSummary(buildShiftSummary([{...held,gateResult:gate('WARN')}],now),lang,{clarity:true,register:'colloquial'});
 expect(warning).not.toContain(lang==='ta'?'எந்த ஹீட்டும்':lang==='hi'?'कोई हीट':'No heats');
 const empty=spokenShiftSummary(buildShiftSummary([],now),lang,{clarity:true,register:'colloquial'});
 expect(empty).not.toMatch(/பூஜ்ஜியம்|शून्य|zero/);
});
it.each(['ta','hi','en'])('short spoken summary, exact counts and priority %s',lang=>{
 const summary=buildShiftSummary(heats,now);const text=spokenShiftSummary(summary,lang,{clarity:true,register:'colloquial'});
 expect(text).toContain(lang==='ta'?'ஒரு ஹீட் ஹோல்ட்':lang==='hi'?'एक हीट होल्ड पर है':'one heat on HOLD');
 expect(text).toContain('one zero five three');
 expect(text).not.toContain(lang==='ta'?'காப்பர்':lang==='hi'?'कॉपर':'Cu');
 for(const sentence of text.split(/[.।]/).filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
 expect(text).toContain(lang==='ta'?'முடிந்த ஹீட்கள் கணக்கில் இல்லை':lang==='hi'?'पूरे हुए हीट गिनती में नहीं':'Completed heats excluded');
});
it.each(['ta','hi','en'])('zero-HOLD wording and empty-store cases %s',lang=>{
 const text=spokenShiftSummary(buildShiftSummary([],now),lang,{clarity:true,register:'colloquial'});
 expect(text).toContain(lang==='ta'?'எந்த ஹீட்டும் ஹோல்ட்ல இல்ல':lang==='hi'?'कोई हीट होल्ड पर नहीं है':'No heats on hold');
});
it.each(['formal','colloquial'])('one element reason keeps value and direction only %s',register=>{
 const view={...held,gateResult:gate('WARN',{checks:[{id:'residuals',status:'WARN',details:[{element:'Cu',value:.27,min:0,max:.3,status:'WARN'},{element:'C',value:2,min:3,max:4,status:'WARN'}]}]})};
 const summary=buildShiftSummary([view],now);expect(summary.firstReason).toMatchObject({element:'Cu',value:.27,direction:'risk'});
 const text=spokenShiftSummary(summary,'hi',{clarity:true,register});expect(text).toContain(register==='colloquial'?'लिमिट के पास':'सीमा के पास');expect(text).not.toContain('कार्बन');
});
it('handler uses fresh GET data and no mutation/Evon/LLM call',async()=>{
 vi.stubEnv('VITE_SHIFT_SUMMARY','true');const say=vi.fn(),resolveHeat=vi.fn();
 const fresh=()=>heats.map(heat=>structuredClone(heat));let rows=fresh();
 get.mockImplementation(async(url,options)=>{
  if(url==='/premelt/heats'){expect(options).toEqual({params:{all:1}});return{data:{data:rows}};}
  return {data:{data:rows.find(heat=>url.endsWith('/'+heat.heatId))}};
 });
 const handle=createTranscriptHandler({lang:'en',say,resolveHeat,setHeard:vi.fn(),navigate:vi.fn()});
 // Use unexpiring current test gates rather than historical timestamp fixtures.
 rows.forEach(heat=>{if(heat.gate)delete heat.gate.validUntil;if(heat.gateResult)delete heat.gateResult.validUntil;});
 await handle('shift summary');expect(say.mock.lastCall[0]).toContain('1 HOLD (H-1053)');
 rows[0].gateResult.decision='GO';await handle('shift summary');expect(say.mock.lastCall[0]).toContain('0 HOLD');
 expect(post).not.toHaveBeenCalled();expect(resolveHeat).not.toHaveBeenCalled();expect(get.mock.calls.every(([url])=>url.startsWith('/premelt/heats'))).toBe(true);
});
