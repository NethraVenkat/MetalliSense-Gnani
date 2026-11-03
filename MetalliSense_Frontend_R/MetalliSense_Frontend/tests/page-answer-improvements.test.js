import {it,expect,vi,afterEach} from 'vitest';
import {loadedPageAnswer,isLoadedPageQuestion} from '../src/services/loadedVoiceAnswers';
import {morningBriefing,fetchMorningRows} from '../src/services/morningBriefing';
afterEach(()=>vi.unstubAllEnvs());
for(const lang of ['ta','hi','en']){
 it(`loaded page aliases, no invented heat ID and stock cleanup ${lang}`,()=>{
  const stock=loadedPageAnswer('stock',{route:'/raw-material-stock',loaded:{lots:[{lotId:'PIG-0901',availableKg:4000,status:'RELEASED'},{lotId:'RET-1043',availableKg:2500.5,status:'QUARANTINE'}]}},lang);
  expect(stock).toContain({ta:'4000 கிலோ, ரிலீஸ் ஆனது',hi:'4000 किलो, रिलीज़ किया गया',en:'4000 kg, released'}[lang]);expect(stock).toContain('2500.5');expect(stock).not.toContain('.00');
  const reading={route:'/spectrometer',loaded:{loading:true,latestReading:{heatId:null,timestamp:'2026-11-03T00:00:00Z',composition:{C:.3,Si:1.2,Mn:.5}}}};
  for(const q of ['Latest readings.','LAST','லேட்டஸ்ட்','கடைசி ரீடிங்','नवीनतम रीडिंग']){expect(isLoadedPageQuestion(q,'/spectrometer')).toBe(true);expect(loadedPageAnswer(q,reading,lang)).toContain('C 0.30%');}
  const grade={route:'/grades',loaded:{grades:[{grade:'SG-IRON',composition_ranges:{C:[3.1,3.6]}}]}};
  for(const q of ['SG Iron Specs.','sg-iron limit','SGI range','ஸ்பெக்','रेंज']){expect(isLoadedPageQuestion(q,'/grades')).toBe(true);expect(loadedPageAnswer(q,grade,lang)).toContain('SG-IRON');}
 });
 it(`briefing matches saved HOLD without mutating expiry ${lang}`,()=>{
  const rows=[{heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',validUntil:'2000-01-01',expired:true,checks:[{status:'FAIL',details:[{status:'FAIL',element:'Cu',value:.5,max:.3}]}]}},...[1,2,3].map(i=>({heatId:'H-'+i,status:'PLANNED'}))];
  const before=JSON.stringify(rows),answer=morningBriefing(rows,lang);expect(answer).toContain('HOLD 1, WARN 0, GO 0');expect(answer).toContain('H-1053');expect(answer).toContain({ta:'காப்பர் லிமிட்டுக்கு மேல',hi:'कॉपर सीमा से ऊपर',en:'Copper above limit'}[lang]);expect(answer).toContain({ta:'செக் பண்ணாத ஹீட் 3',hi:'अनचेक हीट 3',en:'Unchecked heats 3'}[lang]);expect(JSON.stringify(rows)).toBe(before);
 });
}
it('morning detail reader uses the same heat detail source, no mutations',async()=>{const detail=vi.fn(async()=>({data:{data:{heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD'}}}}));const rows=await fetchMorningRows(async()=>({data:{data:[{heatId:'H-1053',status:'PLANNED',gate:{decision:'HOLD'}}]}}),detail);expect(detail).toHaveBeenCalledWith('H-1053');expect(rows[0].gateResult.decision).toBe('HOLD');});
