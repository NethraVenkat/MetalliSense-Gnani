import {afterEach,describe,expect,it,vi} from 'vitest';
import {mapIntent} from '../src/services/voiceIntents';
import {formatDashboardBriefing,getDashboardBriefing} from '../src/services/voicePageAnswers';
import {createTranscriptHandler} from '../src/services/voiceTranscript';

const flags={everywhere:true,dashboardBriefing:true};
const heats=[
  {heatId:'H-1043',status:'COMPLETED',createdAt:'2026-10-30T08:00:00Z'},
  {heatId:'H-1053',status:'PLANNED',gate:{decision:'HOLD',at:'2026-11-01T08:00:00Z',validUntil:'2026-11-01T10:00:00Z',blocking:[]}},
  {heatId:'H-1054',status:'PLANNED',gate:{decision:'WARN',at:'2026-11-01T08:30:00Z',validUntil:'2026-11-01T10:30:00Z',warnings:[]}},
  {heatId:'H-1055',status:'PLANNED',gate:{decision:'GO',at:'2026-11-01T07:00:00Z',validUntil:'2026-11-01T07:30:00Z'}},
  {heatId:'H-1056',status:'MELTING',createdAt:'2026-11-01T06:00:00Z'},
];
const opc={server:{isRunning:true},client:{isConnected:true},timestamp:'2026-11-01T08:45:00Z'};
afterEach(()=>vi.unstubAllEnvs());

describe('F13c briefing intent and flags',()=>{
  it.each([
    ['Give me a dashboard briefing','dashboard_briefing'],['dashboard summary','dashboard_briefing'],
    ['டாஷ்போர்டு சுருக்கம் சொல்லு','dashboard_briefing'],['dashboard briefing sollu','dashboard_briefing'],
    ['डैशबोर्ड का सारांश बताओ','dashboard_briefing'],['dashboard briefing batao','dashboard_briefing'],
  ])('%s is explicit', (text,intent)=>expect(mapIntent(text,flags).intent).toBe(intent));
  it('keeps the old mapping with either flag off',()=>{
    expect(mapIntent('Give me a dashboard briefing',{everywhere:true,dashboardBriefing:false}).intent).not.toBe('dashboard_briefing');
    expect(mapIntent('Give me a dashboard briefing',{everywhere:false,dashboardBriefing:true}).intent).not.toBe('dashboard_briefing');
  });
  it('leaves shift summary and page navigation intents distinct',()=>{
    expect(mapIntent('Shift summary',{...flags,shiftSummary:true}).intent).toBe('shift_summary');
    expect(mapIntent('open dashboard',flags).intent).toBe('open_screen');
  });
  it.each(['dashboard briefing and approve purchase request','dashboard summary then start melting','டாஷ்போர்டு சுருக்கம் சொல்லு, உருக்க ஆரம்பி'])('%s is refused before briefing retrieval',text=>{
    expect(mapIntent(text,{...flags,langBridge:true}).intent).toBe('blocked');
  });
});

describe('F13c factual formatting and source scope',()=>{
  it('uses F9 active/status rules, returned-row scope and HOLD-before-WARN priority',()=>{
    const result=formatDashboardBriefing({heats:{kind:'available',rows:heats},opcStatus:{kind:'available',connected:true,timestamp:opc.timestamp},now:Date.parse('2026-11-01T09:00:00Z')},'en');
    expect(result).toContain('Returned heat rows 5; active 4, completed and other inactive rows excluded: 1.');
    expect(result).toContain('Statuses: HOLD 1, WARN 1, GO 0, melting 1, unchecked or expired 1; HOLD 1: H-1053; WARN 1: H-1054; First priority: HOLD H-1053.');
    expect(result).toContain('Latest returned gate-check event: 2026-11-01T08:30:00Z.');
    expect(result).toContain('OPC connected; source timestamp: 2026-11-01T08:45:00Z.');
    expect(result).not.toMatch(/plant[- ]wide|today|this shift|all clear|current morning/i);
    expect((result.match(/\./g)||[]).length).toBeLessThanOrEqual(5);
  });
  it('does not report zero or all-clear for empty heat data',()=>{
    const result=formatDashboardBriefing({heats:{kind:'available',rows:[]},opcStatus:{kind:'failed'}},'en');
    expect(result).toContain('Heat list returned no rows; status counts unavailable.');
    expect(result).not.toMatch(/0 HOLD|0 WARN|all clear/i);
  });
  it('treats malformed heat rows as unavailable instead of counting them',()=>{
    const result=formatDashboardBriefing({heats:{kind:'available',rows:[null]},opcStatus:{kind:'failed'}},'en');
    expect(result).toContain('Heat-list data unavailable.');
    expect(result).not.toMatch(/Returned heat rows|0 HOLD|all clear/i);
  });
  it('labels failed and partial sources as unavailable in selected languages',()=>{
    expect(formatDashboardBriefing({heats:{kind:'failed'},opcStatus:{kind:'failed'}},'ta')).toContain('ஹீட் லிஸ்ட் தகவல் கிடைக்கல');
    expect(formatDashboardBriefing({heats:{kind:'failed'},opcStatus:{kind:'failed'}},'hi')).toContain('हीट लिस्ट जानकारी उपलब्ध नहीं');
    const partial=formatDashboardBriefing({heats:{kind:'available',rows:heats},opcStatus:{kind:'failed'},now:Date.parse('2026-11-01T09:00:00Z')},'en');
    expect(partial).toContain('OPC status unavailable; source timestamp: source timestamp unavailable.');
    expect(partial).toContain('HOLD 1');
  });
  it('reports missing event/source timestamps without inventing freshness',()=>{
    const result=formatDashboardBriefing({heats:{kind:'available',rows:[{heatId:'H-1',status:'PLANNED'}]},opcStatus:{kind:'available',connected:false,timestamp:null},now:Date.parse('2026-11-01T09:00:00Z')},'en');
    expect(result).toContain('Latest returned gate-check event: timestamp unavailable.');
    expect(result).toContain('OPC disconnected; source timestamp: source timestamp unavailable.');
    expect(result).not.toContain(new Date().toISOString());
  });
  it('retrieves only heat-list and OPC read services, independently',async()=>{
    const services={getShiftSummaryHeats:vi.fn().mockResolvedValue({data:{data:heats}}),getOPCStatus:vi.fn().mockResolvedValue({data:{data:opc}}),mutate:vi.fn()};
    const result=await getDashboardBriefing({services,now:Date.parse('2026-11-01T09:00:00Z')});
    expect(result.textByLanguage.en).toContain('HOLD 1');
    expect(services.getShiftSummaryHeats).toHaveBeenCalledOnce();
    expect(services.getOPCStatus).toHaveBeenCalledOnce();
    expect(services.mutate).not.toHaveBeenCalled();
  });
  it('contains a synchronous failure from one read source and retains the other',async()=>{
    const result=await getDashboardBriefing({services:{getShiftSummaryHeats:()=>{throw new Error('offline');},getOPCStatus:()=>({data:{data:opc}})}});
    expect(result.heats.kind).toBe('failed');
    expect(result.opcStatus.connected).toBe(true);
    expect(result.textByLanguage.en).toContain('Heat-list data unavailable.');
    expect(result.textByLanguage.en).not.toMatch(/all clear/i);
  });
});

describe('F13c explicit dispatch, language and late-result guard',()=>{
  const run=async(text,{lang='en',services,lifecycle={begin:()=>1,isCurrent:()=>true}}={})=>{
    const say=vi.fn();
    await createTranscriptHandler({lang,setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),dashboardBriefingServices:services,dashboardBriefingLifecycle:lifecycle})(text);
    return say;
  };
  it('does not fetch for a non-briefing utterance',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_DASHBOARD_BRIEFING','true');
    const services={getShiftSummaryHeats:vi.fn(),getOPCStatus:vi.fn()};
    await run('dashboard',{services});
    expect(services.getShiftSummaryHeats).not.toHaveBeenCalled();
    expect(services.getOPCStatus).not.toHaveBeenCalled();
  });
  it('fetches only for an explicit request and routes Tamil/Hindi replies from question language',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_DASHBOARD_BRIEFING','true');
    const services={getShiftSummaryHeats:vi.fn().mockResolvedValue({data:{data:heats}}),getOPCStatus:vi.fn().mockResolvedValue({data:{data:opc}})};
    const tamil=await run('டாஷ்போர்டு சுருக்கம் சொல்லு',{lang:'en',services});
    expect(tamil.mock.calls[0][2]).toBe('ta');
    const hindi=await run('डैशबोर्ड का सारांश बताओ',{lang:'en',services});
    expect(hindi.mock.calls[0][2]).toBe('hi');
  });
  it('blocks a mixed action request before either read service runs',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_DASHBOARD_BRIEFING','true');
    const services={getShiftSummaryHeats:vi.fn(),getOPCStatus:vi.fn()},say=vi.fn();
    await createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),dashboardBriefingServices:services})('dashboard briefing and approve purchase request');
    expect(services.getShiftSummaryHeats).not.toHaveBeenCalled();
    expect(services.getOPCStatus).not.toHaveBeenCalled();
    expect(say.mock.calls[0][0]).toBe("This can't be done by voice. Please use the screen.");
  });
  it('drops a cancelled or superseded briefing result',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true');vi.stubEnv('VITE_VOICE_DASHBOARD_BRIEFING','true');
    let resolveHeats,token=0;
    const services={getShiftSummaryHeats:vi.fn(()=>new Promise(resolve=>{resolveHeats=resolve;})),getOPCStatus:vi.fn().mockResolvedValue({data:{data:opc}})};
    const lifecycle={begin:()=>++token,isCurrent:(requestId)=>requestId===token};
    const say=vi.fn(),handler=createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),dashboardBriefingServices:services,dashboardBriefingLifecycle:lifecycle});
    const pending=handler('dashboard briefing');
    token++; // Simulate cancel/navigation/new request before the read resolves.
    await Promise.resolve();
    resolveHeats({data:{data:heats}});
    await pending;
    expect(say).not.toHaveBeenCalled();
  });
});
