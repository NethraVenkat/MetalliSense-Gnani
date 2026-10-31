import { afterEach, expect, it, vi } from 'vitest';
import { clarityGateSpeech,clarityText,nativeSpeech,clarityHandoverSummary } from '../src/services/voiceClarity';
import { decimalDigits,registerLexicon,spokenRegister,colloquialElements } from '../src/services/voiceRegister';
import { gateReasonAnswer,heatVoiceAnswer } from '../src/services/voiceGateAnswers';
import { hindiHeatAnswer } from '../src/services/hindiVoice';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post,interceptors:{response:{use:vi.fn()}}})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const heat={heatId:'H-1053',status:'PLANNED',gateResult:{decision:'HOLD',checks:[
 {id:'lot_status',status:'FAIL',details:[{lotId:'PIG-1053',text:'QUARANTINED',status:'FAIL'}]},
 {id:'residuals',status:'FAIL',details:[{element:'Cu',value:.5,max:.3,status:'FAIL'}]},
]}};
const target={ta:'ஹீட் ஆயிரத்து ஐம்பத்தி மூணு, ஹோல்ட். லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு, க்வாரண்டைன்ல இருக்கு. காப்பர் அதிகமா இருக்கு. ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட். லிமிட், ஜீரோ பாயிண்ட் த்ரீ ஜீரோ.',
 hi:'हीट एक हज़ार तिरपन, होल्ड। लॉट नंबर एक हज़ार तिरपन, क्वारंटीन में है। कॉपर ज़्यादा है। ज़ीरो पॉइंट फाइव ज़ीरो परसेंट। लिमिट, ज़ीरो पॉइंट थ्री ज़ीरो।'};
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
  const text=clarityGateSpeech(copy,lang,'reasons','colloquial');expect(text).not.toContain(prefix);expect(text).toContain(lang==='ta'?'லாட் நம்பர்':'लॉट नंबर');
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
it.each([['23','இருபத்தி மூணு'],['34','முப்பத்தி நாலு'],['45','நாப்பத்தி அஞ்சு'],['52','ஐம்பத்தி ரெண்டு'],['61','அறுபத்தி ஒண்ணு'],['73','எழுபத்தி மூணு'],['84','எண்பத்தி நாலு'],['95','தொண்ணூத்தி அஞ்சு']])('Tamil combining form %s', (tail,spoken)=>expect(nativeSpeech(`H-10${tail}`,'ta','colloquial')).toContain(spoken));
it.each(['ta','hi','en'])('all builders short, repeat-safe, max two reasons and read-only %s',lang=>{
 const before=JSON.stringify(heat);const extra=structuredClone(heat);extra.gateResult.checks.push({id:'stock',status:'FAIL',details:[{status:'FAIL'}]});
 const texts=[clarityGateSpeech(extra,lang,'reasons','colloquial'),clarityGateSpeech(heat,lang,'status','colloquial'),clarityGateSpeech(heat,lang,'alert','colloquial'),
 clarityGateSpeech({...heat,gateResult:{decision:'GO',checks:[]}},lang,'reasons','colloquial'),clarityHandoverSummary([{heatId:'H-1053',decision:'HOLD',severity:'red'}],lang,'colloquial')];
 for(const text of texts){for(const sentence of text.split(/[.।]/).filter(Boolean))expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(8);expect(clarityText(text,lang,'colloquial')).toBe(text);}
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
