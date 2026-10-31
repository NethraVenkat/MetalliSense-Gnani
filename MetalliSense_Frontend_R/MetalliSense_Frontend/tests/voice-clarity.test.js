import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clarityGateSpeech, clarityText, nativeSpeech, clarityHandoverSummary } from '../src/services/voiceClarity';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
import { gateReasonAnswer, heatVoiceAnswer, spokenGateReasonAnswer } from '../src/services/voiceGateAnswers';
import { hindiHeatAnswer } from '../src/services/hindiVoice';
import { speakText } from '../src/hooks/useSpeak';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post,interceptors:{response:{use:vi.fn()}}})}}));
beforeEach(()=>vi.stubEnv('VITE_VOICE_REGISTER','formal'));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[
 {id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]},
]}};
it.each([
 ['HOLD','ஹோல்ட்','होल्ड'],['WARN warning','எச்சரிக்கை எச்சரிக்கை','चेतावनी चेतावनी'],['GO','கோ','गो'],['Gate','கேட்','गेट'],
 ['Heat','ஹீட்','हीट'],['Lot','லாட்','लॉट'],['PIG','பிக்','पिग'],['status','நிலை','स्थिति'],['PLANNED','திட்டமிடப்பட்டது','योजना में'],
 ['screen','திரை','स्क्रीन'],['approve','அப்ரூவ்','अप्रूव'],['Cu (Cu)','செம்பு ','कॉपर '],
])('native word %s', (word,ta,hi)=>{expect(nativeSpeech(word,'ta')).toBe(ta);expect(nativeSpeech(word,'hi')).toBe(hi);});
it.each(['ta','hi','en'])('short, grounded reason builder %s', lang=>{
 const spoken=clarityGateSpeech(heat,lang);
 for(const line of spoken.split(/[.।]/).filter(Boolean)) expect(line.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
 expect(spoken).not.toMatch(/[;()[\]<>]/);
 const display=gateReasonAnswer(heat.gateResult,'ta');expect(display).toContain('0.50');expect(display).toContain('0.30');
 expect(spoken).toContain(lang==='ta'?'பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம்':lang==='hi'?'शून्य दशमलव पाँच शून्य':'zero point five zero');
 expect(spoken).toContain(lang==='ta'?'பூஜ்ஜியம் புள்ளி மூன்று பூஜ்ஜியம்':lang==='hi'?'शून्य दशमलव तीन शून्य':'zero point three zero');
 expect(heat.gateResult.checks[1].details[0]).toMatchObject({value:.5,max:.3});
});
it('word boundaries and IDs survive native replacement',()=>{
 expect(nativeSpeech('threshold GOAL screenplay approval H-1053 PIG-1053','ta')).toContain('threshold GOAL screenplay approval');
 expect(nativeSpeech('H-1053 PIG-1053','hi')).toBe('हीट एक हज़ार तिरपन पिग एक हज़ार तिरपन');
});
it.each(['ta','hi','en'])('caps two reasons with screen remainder %s',lang=>{
 const extra=structuredClone(heat);extra.gateResult.checks.push({id:'stock',status:'FAIL',details:[{status:'FAIL',text:'extra reason'}]});
 const spoken=clarityGateSpeech(extra,lang);expect(spoken).toContain(lang==='ta'?'மேலும் விவரம் திரையில்':lang==='hi'?'बाकी स्क्रीन पर':'More details on screen');
 expect(spoken).not.toContain('extra reason');
});
it.each(['ta','hi','en'])('status warn go blocked retry and handover are short %s',lang=>{
 const texts=[clarityGateSpeech(heat,lang,'status'),clarityGateSpeech(heat,lang,'alert'),
 clarityGateSpeech({...heat,gateResult:{decision:'GO',checks:[]}},lang),
 clarityGateSpeech({...heat,gateResult:{decision:'WARN',checks:[{id:'residuals',status:'WARN',details:[{element:'Cu',value:.27,min:0,max:.3,status:'WARN'}]}]}},lang),
 clarityText(lang==='ta'?'திரையில் approve செய்யவும்':lang==='hi'?'वॉइस से अप्रूव या मेल्टिंग नहीं होगी। यह स्क्रीन पर करें।':'Please approve on screen',lang),
 clarityText(lang==='ta'?'மீண்டும் சொல்லுங்கள்':lang==='hi'?'समझ नहीं आया, कृपया फिर से बोलिए।':'Could not hear you. Tap a suggestion below.',lang),
 clarityText('H-1053: Mismatch. Gate HOLD. Check the screen.',lang)];
 for(const text of texts) for(const line of text.split(/[.।]/).filter(Boolean)) expect(line.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
});
it('WARN keeps in-range risk, not a false comparison',()=>{
 const spoken=clarityGateSpeech({...heat,gateResult:{decision:'WARN',checks:[{id:'residuals',status:'WARN',details:[{element:'Cu',value:.27,min:0,max:.3,status:'WARN'}]}]}},'hi');
 expect(spoken).toContain('सीमा के पास');expect(spoken).not.toContain('ज़्यादा');
});
it.each(['ta','hi','en'])('handover spoken summary retains exact heat/gate fact %s',lang=>{
 const checks=[{heatId:'H-1053',decision:'HOLD',severity:'red'},{heatId:'H-1052',decision:'GO',severity:'green'}];
 const before=JSON.stringify(checks);const spoken=clarityHandoverSummary(checks,lang);
 expect(spoken).not.toContain(lang==='ta'?'ஐம்பத்து இரண்டு':lang==='hi'?'बावन':'fifty-two');
 expect(spoken).toContain(lang==='ta'?'ஹோல்ட்':lang==='hi'?'होल्ड':'HOLD');
 expect(JSON.stringify(checks)).toBe(before);
 for(const sentence of spoken.split(/[.।]/).filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
});
it('Hindi display is unchanged by clarity speech creation',()=>{
 const display=hindiHeatAnswer('gate_reason',heat,{});clarityGateSpeech(heat,'hi');
 expect(hindiHeatAnswer('gate_reason',heat,{})).toBe(display);expect(display).toContain('0.50');expect(display).toContain('0.30');
});
it('Tamil detailed screen precision matches Hindi rules',()=>{
 const view={decision:'WARN',checks:[{id:'spec_prediction',status:'WARN',details:[{element:'C',value:2.57,min:3,max:4,status:'WARN'}]}]};
 expect(gateReasonAnswer(view,'ta')).toContain('2.57');expect(gateReasonAnswer(view,'ta')).toContain('3.0');
});
it('enabled handler keeps display identical and uses facts for speech',async()=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');const say=vi.fn();post.mockResolvedValue({data:{source:'template'}});
 const handle=createTranscriptHandler({lang:'ta',say,setHeard:vi.fn(),navigate:vi.fn(),resolveHeat:async()=>heat});
 await handle('why hold heat 1053');expect(say.mock.lastCall[0]).toBe(heatVoiceAnswer('gate_reason',heat,{},'ta'));
 expect(say.mock.lastCall[1]).toBe(clarityGateSpeech(heat,'ta'));
});
it('flag off keeps F11 answer payload byte for byte',async()=>{
 vi.stubEnv('VITE_VOICE_CLARITY','false');const say=vi.fn();post.mockResolvedValue({data:{source:'template'}});
 const handle=createTranscriptHandler({lang:'ta',say,setHeard:vi.fn(),navigate:vi.fn(),resolveHeat:async()=>heat});
 await handle('why hold heat 1053');expect(say).toHaveBeenCalledExactlyOnceWith(heatVoiceAnswer('gate_reason',heat,{},'ta'),spokenGateReasonAnswer(heat.gateResult,'ta'));
});
it('speech tags never reach display or frontend TTS input',async()=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');vi.stubEnv('VITE_TTS_STREAM','false');
 post.mockResolvedValue({data:new Blob(['audio']),headers:{}});vi.stubGlobal('Audio',class{play(){this.onended();return Promise.resolve();}pause(){}});
 const display='Heat H-1053: Gate HOLD.';await speakText('<slow> '+display,'ta');
 expect(display).toBe('Heat H-1053: Gate HOLD.');expect(post.mock.lastCall[1].text).not.toContain('<');expect(post.mock.lastCall[1].text).toContain('ஹோல்ட்');
});
