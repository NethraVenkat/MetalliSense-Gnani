import { afterEach,describe,expect,it,vi } from 'vitest';
import { mapIntent } from '../src/services/voiceIntents';
import { answerVoicePageQuestion,formatGradeRangesAnswer,formatHeatReadingAnswer,formatLotDetailAnswer,formatLotsAnswer,latestReadingForHeat } from '../src/services/voicePageAnswers';
import { createTranscriptHandler } from '../src/services/voiceTranscript';

const enabled={everywhere:true,pageDataReads:true};
afterEach(()=>vi.unstubAllEnvs());

describe('F13b intent gating and routing',()=>{
  it('keeps feature-disabled mapping unchanged',()=>{
    expect(mapIntent('PIG-0901 lot details',{everywhere:true,pageDataReads:false})).not.toMatchObject({intent:'stock_lot_detail'});
    expect(mapIntent('PIG-0901 lot details',{everywhere:false,pageDataReads:true})).not.toMatchObject({intent:'stock_lot_detail'});
  });
  it.each([
    ['show raw material lots','stock_lots'],['PIG-0901 lot details','stock_lot_detail'],
    ['H-1053 spectrometer reading','spectrometer_heat_reading'],['SG-IRON carbon range','grade_ranges'],
    ['latest spectrometer reading','spectrometer_heat_reading'],['carbon range','grade_ranges'],
    ['ரா மெட்டீரியல் லாட் காட்டு','stock_lots'],['PIG-0901 லாட் விவரம்','stock_lot_detail'],
    ['H-1053 ரீடிங்','spectrometer_heat_reading'],['SG-IRON கார்பன் ரேஞ்ச்','grade_ranges'],
    ['रॉ मटेरियल लॉट दिखाओ','stock_lots'],['PIG-0901 लॉट की जानकारी','stock_lot_detail'],
    ['H-1053 की रीडिंग','spectrometer_heat_reading'],['SG-IRON कार्बन रेंज','grade_ranges'],
  ])('%s routes to %s', (text,intent)=>expect(mapIntent(text,enabled).intent).toBe(intent));
  it('uses an explicit registered selection only for a matching question',()=>{
    expect(mapIntent('reading',{...enabled,selected:{heatId:'H-1053'}})).toMatchObject({intent:'spectrometer_heat_reading',params:{heatId:undefined}});
    expect(mapIntent('carbon range',{...enabled,selected:{grade:'SG-IRON'}}).intent).toBe('grade_ranges');
  });
  it.each(['H-1053 and H-1054 readings','PIG-0901 and SCR-0912 lot details','SG-IRON and GREY-IRON carbon ranges'])('%s asks for clarification rather than picking the first identifier',text=>{
    expect(mapIntent(text,enabled).params.ambiguous).toBe(true);
  });
  it.each(['approve PIG-0901 details','show SG-IRON carbon range and approve','H-1053 reading then start melting','release lot PIG-0901'])('%s remains blocked before F13b',text=>{
    expect(mapIntent(text,{...enabled,langBridge:true}).intent).toBe('blocked');
  });
});

describe('F13b deterministic response formatting',()=>{
  it('lists physical lot quantities, units, status and identifiers without aggregating',()=>{
    expect(formatLotsAnswer([{lotId:'PIG-0901',materialLabel:'Pig Iron',availableKg:1234.5,receivedKg:4000,status:'RESTRICTED'}]))
      .toBe('PIG-0901: Pig Iron, 1234.5 kg available, 4000 kg received, RESTRICTED');
  });
  it('returns explicit lot detail and does not invent missing fields',()=>{
    expect(formatLotDetailAnswer({lot:{lotId:'PIG-0901',availableKg:7.25,status:'RELEASED',declared:{C:4.10}}},'PIG-0901'))
      .toContain('PIG-0901: material, 7.25 kg available, RELEASED. chemistry C 4.1');
    expect(formatLotDetailAnswer({lot:{lotId:'SCR-2',availableKg:1}},'PIG-0901')).toBe('No information was found for that lot.');
  });
  it('chooses the newest timestamp for an explicitly identified heat, not array order',()=>{
    const rows=[
      {heatId:'H-1053',timestamp:'2026-01-01T00:00:00Z',composition:{C:3.1,Si:2.2}},
      {heatId:'H-1053',createdAt:'2026-02-01T00:00:00Z',composition:{C:3.45}},
      {heatId:'H-9999',timestamp:'2026-03-01T00:00:00Z',composition:{C:9}},
    ];
    const result=latestReadingForHeat(rows,'H-1053');
    expect(result.row.composition.C).toBe(3.45);
    expect(formatHeatReadingAnswer(result,'H-1053')).toBe('Latest available reading H-1053. C 3.45%. 2026-02-01T00:00:00Z');
  });
  it('does not call an untimed row latest and flags equal-time ambiguity',()=>{
    expect(latestReadingForHeat([{heatId:'H-1053',composition:{C:3}}],'H-1053').status).toBe('untimed');
    expect(latestReadingForHeat([{heatId:'H-1053',timestamp:'2026-01-01',composition:{C:3}},{heatId:'H-1053',createdAt:'2026-01-01',composition:{C:4}}],'H-1053').status).toBe('ambiguous');
  });
  it('speaks measured element fields only when a reading is flat-shaped',()=>{
    expect(formatHeatReadingAnswer({status:'ok',row:{C:3.4,Si:2.2,pressure:1.01,heatId:'H-1053'},timestamp:'2026-01-01'},'H-1053'))
      .toBe('Latest available reading H-1053. C 3.4%, Si 2.2%. 2026-01-01');
  });
  it('returns only exact configured grade ranges and localized missing-data replies',()=>{
    expect(formatGradeRangesAnswer([{grade:'SG-IRON',composition_ranges:{C:[3.2,3.8],Si:[2.1,2.9]}}],'SG-IRON','C'))
      .toBe('Configured grade range SG-IRON. C 3.2–3.8%');
    expect(formatGradeRangesAnswer([],'UNKNOWN-GRADE',null,'hi')).toBe('इस ग्रेड का स्पेक नहीं मिला।');
    expect(formatGradeRangesAnswer([{grade:'SG-IRON',composition_ranges:{}}],'SG-IRON','C','ta')).toBe('இந்த தகவல் இப்போ கிடைக்கல.');
  });
  it('localizes clarification and unavailable fallbacks',async()=>{
    const services={getLot:vi.fn(),getLots:vi.fn().mockResolvedValue({data:{data:[]}})};
    expect(await answerVoicePageQuestion({intent:'stock_lot_detail',params:{},lang:'ta',services})).toBe('எந்த லாட் IDன்னு சொல்லுங்க.');
    expect(await answerVoicePageQuestion({intent:'stock_lots',params:{},lang:'hi',services})).toBe('कोई उपलब्ध लॉट नहीं मिला।');
    expect(services.getLot).not.toHaveBeenCalled();
  });
  it('uses only the existing read services and handles unavailable service errors',async()=>{
    const services={getAllReadings:vi.fn().mockRejectedValue(new Error('offline'))};
    expect(await answerVoicePageQuestion({intent:'spectrometer_heat_reading',params:{heatId:'H-1053'},lang:'hi',services})).toBe('यह जानकारी अभी उपलब्ध नहीं है।');
    expect(services.getAllReadings).toHaveBeenCalledOnce();
  });
});

describe('F13b transcript boundary',()=>{
  const run=async(text,{lang='en',selected={},services={}}={})=>{
    const say=vi.fn();
    const handler=createTranscriptHandler({lang,setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageContext:{selected},pageAnswerServices:services});
    await handler(text);
    return say;
  };
  it('answers through existing transcript language selection with mocked read boundaries',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true'); vi.stubEnv('VITE_VOICE_DATA_READS','true');
    const getLots=vi.fn().mockResolvedValue({data:{data:[{lotId:'PIG-0901',materialType:'PIG_IRON',availableKg:88,receivedKg:100,status:'RELEASED'}]}});
    const say=await run('ரா மெட்டீரியல் லாட் காட்டு',{lang:'en',services:{getLots}});
    expect(say).toHaveBeenCalledWith(expect.stringContaining('PIG-0901'),expect.stringContaining('PIG-0901'),'ta');
    expect(getLots).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
  it('uses selected explicit grade and does not invoke mutating APIs',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true'); vi.stubEnv('VITE_VOICE_DATA_READS','true');
    const reads={getAllGradeSpecs:vi.fn().mockResolvedValue({data:{data:{data:[{grade:'SG-IRON',composition_ranges:{C:[3,4]}}]}}}),createGradeSpec:vi.fn()};
    const say=await run('carbon range',{selected:{grade:'SG-IRON'},services:reads});
    expect(say).toHaveBeenCalledWith('Configured grade range SG-IRON. C 3–4%','Configured grade range SG-IRON. C 3–4%','en');
    expect(reads.createGradeSpec).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it('does not call page read services for a mixed mutation request',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true'); vi.stubEnv('VITE_VOICE_DATA_READS','true');
    const getLot=vi.fn(),say=vi.fn(),services={getLot};
    await createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageAnswerServices:services})('show PIG-0901 details and approve');
    expect(getLot).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith("This can't be done by voice. Please use the screen.","This can't be done by voice. Please use the screen.",'en');
    vi.unstubAllEnvs();
  });
  it('suppresses an F13b answer after a newer request or language change',async()=>{
    vi.stubEnv('VITE_VOICE_EVERYWHERE','true'); vi.stubEnv('VITE_VOICE_DATA_READS','true');
    let resolveLots,token=0,currentLanguage='en';
    const services={getLots:vi.fn(()=>new Promise(resolve=>{resolveLots=resolve;}))};
    const say=vi.fn();
    const lifecycle={begin:()=>++token,isCurrent:(requestId,answerLanguage,_scope,panelLanguage)=>requestId===token&&answerLanguage===currentLanguage&&panelLanguage===currentLanguage};
    const handler=createTranscriptHandler({lang:'en',setHeard:vi.fn(),say,navigate:vi.fn(),resolveHeat:vi.fn(),pageAnswerServices:services,dashboardBriefingLifecycle:lifecycle});
    const pending=handler('show raw material lots');
    token++;
    currentLanguage='ta';
    resolveLots({data:{data:[{lotId:'PIG-0901',availableKg:10,status:'RELEASED'}]}});
    await pending;
    expect(say).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
