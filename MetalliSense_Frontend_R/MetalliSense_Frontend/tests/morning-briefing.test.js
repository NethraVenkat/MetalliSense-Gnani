import {it,expect,vi,afterEach} from 'vitest';
import {morningBriefing,morningUnavailable} from '../src/services/morningBriefing';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
afterEach(()=>vi.unstubAllEnvs());
const rows=[{heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[{id:'stock',status:'FAIL',summary:'Insufficient stock'}]}},{heatId:'H-1054',status:'MELTING'},{heatId:'H-1055',status:'PLANNED'}];
for(const lang of ['ta','hi','en'])it(`short briefing ${lang}`,async()=>{
 const result=morningBriefing(rows,lang);expect(result).toContain('HOLD 1, WARN 0, GO 0');expect(result).toContain('H-1053');expect(result).toContain({ta:'கையிருப்பு போதவில்லை',hi:'स्टॉक कम है',en:'Insufficient stock'}[lang]);expect(morningBriefing([],lang)).toBe(morningUnavailable[lang]);
 vi.stubEnv('VITE_MORNING_BRIEFING','true');const say=vi.fn(),getShiftSummaryHeats=vi.fn(async()=>({data:rows}));
 const handle=createTranscriptHandler({lang,setHeard:()=>{},say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:{route:'/dashboard'},dashboardBriefingServices:{getShiftSummaryHeats}});
 await handle({ta:'இன்னைக்கு briefing',hi:'आज की ब्रीफिंग',en:'morning briefing'}[lang]);expect(say.mock.calls[0][2]).toBe(lang);expect(getShiftSummaryHeats).toHaveBeenCalledTimes(1);
 await handle('approve morning briefing');expect(getShiftSummaryHeats).toHaveBeenCalledTimes(1);
});
it('default off does not request the new briefing',async()=>{vi.stubEnv('VITE_MORNING_BRIEFING','false');const getShiftSummaryHeats=vi.fn();await createTranscriptHandler({lang:'en',setHeard:()=>{},say:vi.fn(),navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:{route:'/dashboard'},dashboardBriefingServices:{getShiftSummaryHeats}})('morning briefing');expect(getShiftSummaryHeats).not.toHaveBeenCalled();});
