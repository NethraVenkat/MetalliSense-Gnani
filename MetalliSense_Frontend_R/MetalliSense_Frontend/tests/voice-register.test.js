import { afterEach, expect, it, vi } from 'vitest';
import { clarityGateSpeech,clarityText,nativeSpeech,clarityHandoverSummary } from '../src/services/voiceClarity';
import { decimalDigits,registerLexicon,spokenRegister,colloquialElements } from '../src/services/voiceRegister';
import { gateReasonAnswer,heatVoiceAnswer } from '../src/services/voiceGateAnswers';
import { hindiHeatAnswer } from '../src/services/hindiVoice';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
import {buildShiftSummary,spokenShiftSummary} from '../src/services/shiftSummary';
import baseline from './f11d-formal-baseline.json';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post,interceptors:{response:{use:vi.fn()}}})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[
 {id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]},
]}};
const target={ta:'ஹீட் one zero five three, ஹோல்ட். லாட் நம்பர் one zero five three, க்வாரண்டைன்ல இருக்கு. காப்பர் அதிகமா இருக்கு. ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட். லிமிட், ஜீரோ பாயிண்ட் த்ரீ ஜீரோ.',
 hi:'हीट one zero five three, होल्ड। लॉट one zero five three, क्वारंटीन में है। कॉपर ज़्यादा है। ज़ीरो पॉइंट फाइव ज़ीरो परसेंट। लिमिट, ज़ीरो पॉइंट थ्री ज़ीरो।'};
const formal={ta:'ஹீட் ஆயிரத்து ஐம்பத்து மூன்று, ஹோல்ட். லாட் பிக் ஆயிரத்து ஐம்பத்து மூன்று, தனிமையில் உள்ளது. செம்பு அளவு அதிகம். பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம். வரம்பு, பூஜ்ஜியம் புள்ளி மூன்று பூஜ்ஜியம்.',
 hi:'हीट एक हज़ार तिरपन, होल्ड। लॉट पिग एक हज़ार तिरपन, क्वारंटीन में। कॉपर ज़्यादा है। शून्य दशमलव पाँच शून्य प्रतिशत। सीमा, शून्य दशमलव तीन शून्य।'};
it.each(['ta','hi'])('exact requested HOLD speech %s',lang=>expect(clarityGateSpeech(heat,lang,'reasons','colloquial')).toBe(target[lang]));
it.each(['ta','hi'])('formal reproduces F11b byte-for-byte %s',lang=>expect(clarityGateSpeech(heat,lang,'reasons','formal')).toBe(formal[lang]));
it('register defaults only when clarity is enabled',()=>{
 vi.stubEnv('VITE_VOICE_REGISTER','');vi.stubEnv('VITE_VOICE_CLARITY','true');expect(spokenRegister()).toBe('colloquial');
 expect(clarityGateSpeech(heat,'ta')).toBe(target.ta);
 vi.stubEnv('VITE_VOICE_REGISTER','formal');expect(clarityGateSpeech(heat,'ta')).toBe(formal.ta);
 vi.stubEnv('VITE_VOICE_REGISTER','');vi.stubEnv('VITE_VOICE_CLARITY','false');expect(spokenRegister()).toBe('formal');
});
it.each(Object.entries(registerLexicon).flatMap(([lang,entries])=>Object.entries(entries).map(([word,spoken])=>[lang,word,spoken])))('lexicon %s: %s', (lang,word,expected)=>{
 // Run standalone lexicon terms through the same native speech boundary.
 expect(nativeSpeech(word,lang,'colloquial')).toBe(expected);
});
it.each(['ta','hi'])('every decimal digit and written zero survives %s',lang=>{
 const point=lang==='ta'?'பாயிண்ட்':'पॉइंट';
 for(let digit=0;digit<10;digit++) expect(nativeSpeech(`0.${digit}0`,lang,'colloquial')).toBe(`${decimalDigits[lang][0]} ${point} ${decimalDigits[lang][digit]} ${decimalDigits[lang][0]}`);
 expect(nativeSpeech('0.50',lang,'colloquial')).not.toBe(nativeSpeech('0.5',lang,'colloquial'));
 expect(nativeSpeech('0.50%',lang,'colloquial')).toBe(`${decimalDigits[lang][0]} ${point} ${decimalDigits[lang][5]} ${decimalDigits[lang][0]} ${lang==='ta'?'பர்சென்ட்':'परसेंट'}`);
 expect(clarityText('0.50.',lang,'colloquial')).toContain(decimalDigits[lang][5]);
});
it.each(['PIG','DRI','SCRAP','XYZ'])('any lot prefix %s is dropped only in speech',prefix=>{
 const copy=structuredClone(heat);copy.gateResult.checks[0].details[0].lotId=`${prefix}-1053`;
 for(const lang of ['ta','hi']){
  const text=clarityGateSpeech(copy,lang,'reasons','colloquial');expect(text).not.toContain(prefix);expect(text).toContain(lang==='ta'?'லாட் நம்பர்':'लॉट');
 }
 expect(gateReasonAnswer(copy.gateResult,'ta')).toContain(prefix+'-1053');
});
it.each(['ta','hi'])('lot states remain factual %s',lang=>{
 for(const [state,expected] of [['QUARANTINED',lang==='ta'?'க்வாரண்டைன்ல இருக்கு':'क्वारंटीन में है'],['HOLD',lang==='ta'?'ஹோல்ட்ல இருக்கு':'होल्ड पर है'],['RESTRICTED',lang==='ta'?'ரிலீஸ் ஆகல':'रिलीज़ नहीं हुआ'],['UNRELEASED',lang==='ta'?'ரிலீஸ் ஆகல':'रिलीज़ नहीं हुआ']]){
  const view=structuredClone(heat);view.gateResult.checks[0].details[0].text=state;
  expect(clarityGateSpeech(view,lang,'reasons','colloquial')).toContain(expected);
 }
});
it.each([['Cu','காப்பர்'],['C','கார்பன்'],['Si','சிலிக்கான்'],['Mn','மாங்கனீஸ்'],['P','பாஸ்பரஸ்'],['S','சல்பர்'],['Cr','க்ரோமியம்'],['Ni','நிக்கல்'],['Mo','மாலிப்டினம்']])('Tamil element %s', (symbol,name)=>expect(nativeSpeech(symbol,'ta','colloquial')).toBe(name));
it.each(Object.entries(colloquialElements))('full element name %s stays bounded',(name,words)=>{
 for(const [index,lang] of ['ta','hi'].entries()){
  expect(nativeSpeech(name.toUpperCase(),lang,'colloquial')).toBe(words[index]);
  expect(nativeSpeech('prefix'+name,lang,'colloquial')).toBe('prefix'+name);
 }
});
it.each([['23','two three'],['34','three four'],['45','four five'],['52','five two'],['61','six one'],['73','seven three'],['84','eight four'],['95','nine five']])('Tamil digit ID 10%s', (tail,spoken)=>expect(nativeSpeech(`H-10${tail}`,'ta','colloquial')).toBe(`ஹீட் one zero ${spoken}`));
it.each(['ta','hi','en'])('all builders short, repeat-safe, max two reasons and read-only %s',lang=>{
 const before=JSON.stringify(heat);const extra=structuredClone(heat);extra.gateResult.checks.push({id:'stock',status:'FAIL',details:[{status:'FAIL'}]});
 const texts=[clarityGateSpeech(extra,lang,'reasons','colloquial'),clarityGateSpeech(heat,lang,'status','colloquial'),clarityGateSpeech(heat,lang,'alert','colloquial'),
 clarityGateSpeech({...heat,gateResult:{decision:'GO',checks:[]}},lang,'reasons','colloquial'),clarityHandoverSummary([{heatId:'H-1053',decision:'HOLD',severity:'red'}],lang,'colloquial')];
 for(const text of texts){for(const sentence of text.split(/[.।]/).filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);expect(clarityText(text,lang,'colloquial')).toBe(text);expect(text).toContain('one zero five three');}
 expect(texts[0]).toContain(lang==='ta'?'மீதி ஸ்கிரீன்ல பாருங்க':lang==='hi'?'बाकी स्क्रीन पर':'More details on screen');
 expect(JSON.stringify(heat)).toBe(before);
});
it.each(['ta','hi'])('WARN risk is never promoted to an exceedance %s',lang=>{
 const warn={...heat,gateResult:{decision:'WARN',checks:[{id:'residuals',status:'WARN',details:[{element:'Cu',value:.27,min:0,max:.3,status:'WARN'}]}]}};
 const speech=clarityGateSpeech(warn,lang,'reasons','colloquial');expect(speech).toContain(lang==='ta'?'லிமிட்டுக்கு பக்கத்துல இருக்கு':'लिमिट के पास है');
 expect(speech).not.toContain(lang==='ta'?'அதிகமா':'ज़्यादा');
});
it.each(['ta','hi'])('blocked stays refusal; retry is colloquial %s',lang=>{
 const blocked=clarityText(lang==='ta'?'திரையில் approve செய்யவும்':'वॉइस से अप्रूव या मेल्टिंग नहीं होगी। यह स्क्रीन पर करें।',lang,'colloquial');
 expect(blocked).toContain(lang==='ta'?'முடியாது':'नहीं');expect(blocked).not.toMatch(/செய்யவும்|करें/);
 expect(clarityText(lang==='ta'?'மீண்டும் சொல்லுங்கள்':'समझ नहीं आया, कृपया फिर से बोलिए।',lang,'colloquial')).toContain(lang==='ta'?'சரியா கேக்கல, திரும்ப சொல்லுங்க':'फिर से बोलिए');
});
it('screen and gate facts unchanged with register switch',async()=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');vi.stubEnv('VITE_VOICE_REGISTER','colloquial');post.mockResolvedValue({data:{source:'template'}});
 const before=JSON.stringify(heat);const display=heatVoiceAnswer('gate_reason',heat,{},'ta');const hindi=hindiHeatAnswer('gate_reason',heat,{});
 const say=vi.fn();const handler=createTranscriptHandler({lang:'ta',say,setHeard:vi.fn(),navigate:vi.fn(),resolveHeat:async()=>heat});await handler('why hold heat 1053');
 expect(say.mock.lastCall[0]).toBe(display);expect(say.mock.lastCall[1]).toBe(target.ta);expect(JSON.stringify(heat)).toBe(before);expect(hindiHeatAnswer('gate_reason',heat,{})).toBe(hindi);
});
it.each(['ta','hi','en'])('30 pre-change formal outputs stay byte-for-byte unchanged: %s',lang=>{
 const {heat,warn,rows}=baseline;
 expect({
  reasons:clarityGateSpeech(heat,lang,'reasons','formal'),status:clarityGateSpeech(heat,lang,'status','formal'),alert:clarityGateSpeech(heat,lang,'alert','formal'),
  warn:clarityGateSpeech(warn,lang,'reasons','formal'),go:clarityGateSpeech({...heat,gateResult:{decision:'GO',checks:[]}},lang,'reasons','formal'),
  handover:clarityHandoverSummary([{heatId:'H-1053',decision:'HOLD',severity:'red'}],lang,'formal'),
  summary:spokenShiftSummary(buildShiftSummary(rows),lang,{clarity:true,register:'formal'}),
  native:nativeSpeech('Heat H-1053 Lot PIG-1053 0.50%',lang,'formal'),
  blocked:clarityText('Please approve on screen',lang,'formal'),retry:clarityText('Could not hear you. Tap a suggestion below.',lang,'formal'),
 }).toEqual(baseline.outputs[lang]);
});
it.each(['ta','hi','en'])('ID digits and leading zeros equal facts across heat and lot speech: %s',lang=>{
 const digits='zero one two three four five six seven eight nine'.split(' ');
 for(const id of ['H-1053','H-1001','PIG-1053','DRI-0010','SCRAP-2045','XYZ-1099','H-01234567','H-89']){
  const spoken=nativeSpeech(id,lang,'colloquial');
  const values=spoken.split(/\s+/).filter(word=>digits.includes(word)).map(word=>digits.indexOf(word)).join('');
  expect(values).toBe(id.split('-')[1]);expect(spoken).not.toContain('PIG');
 }
 expect(nativeSpeech('Heat H-1053 Lot PIG-1053',lang,'colloquial')).toBe(lang==='ta'?'ஹீட் one zero five three லாட் நம்பர் one zero five three':lang==='hi'?'हीट one zero five three लॉट one zero five three':'heat one zero five three lot one zero five three');
});
it('chosen Tamil counts stay quantities, with furnace/pending/opener and unchanged screen',()=>{
 const rows=[...structuredClone(baseline.rows),{...structuredClone(heat),heatId:'H-1054'},{heatId:'H-1055',status:'PLANNED'}];
 const before=JSON.stringify(rows),summary=buildShiftSummary(rows);
 expect(summary.counts).toEqual({HOLD:2,WARN:0,GO:1,melting:1,not_checked:1});
 const spoken=spokenShiftSummary(summary,'ta',{clarity:true,register:'colloquial'});
 for(const text of ['ஷிஃப்ட் சம்மரி.','ரெண்டு ஹீட் ஹோல்ட்.','ஒரு ஹீட் கோ.','ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு.','ஒரு ஹீட் செக் பெண்டிங்.','one zero five three'])expect(spoken).toContain(text);
 expect(summary.display).toContain('2 HOLD (H-1053, H-1054)');expect(JSON.stringify(rows)).toBe(before);
 for(const sentence of spoken.split('.').filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
 expect(spokenShiftSummary(summary,'hi',{clarity:true,register:'colloquial'})).toContain('एक हीट भट्टी में है');
});
it('chosen blocked speech is exact but original safety text remains on screen',()=>{
 expect(clarityText('திரையில் approve செய்யவும்','ta','colloquial')).toBe('இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல அப்ரூவ் பண்ணுங்க.');
 expect(clarityText('திரையில் approve செய்யவும்','ta','formal')).toBe('திரையில் அப்ரூவ் செய்யவும்.');
});
