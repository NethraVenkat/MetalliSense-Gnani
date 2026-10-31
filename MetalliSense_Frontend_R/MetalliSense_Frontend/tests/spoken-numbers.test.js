import { expect, it, vi, afterEach } from 'vitest';
import { parseSpokenNumber, hindiCardinals } from '../src/services/spokenNumbers';
import { mapIntent } from '../src/services/voiceIntents';
import { formatGateLimit } from '../src/services/hindiVoice';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
import { retryVoiceAnswer } from '../src/services/languageBridge';

afterEach(() => vi.restoreAllMocks());
it.each([
  [0,'பூஜ்ஜியம்|ஜீரோ'],[1,'ஒன்று|ஒண்ணு|ஒன்னு'],[2,'இரண்டு|ரெண்டு'],[3,'மூன்று|மூணு'],
  [4,'நான்கு|நாலு'],[5,'ஐந்து|அஞ்சு'],[6,'ஆறு'],[7,'ஏழு'],[8,'எட்டு'],[9,'ஒன்பது'],
])('Tamil units and colloquial forms %i', (number, variants) => {
  for (const word of variants.split('|')) {
    expect(parseSpokenNumber(`ஆயிரத்து ${word}`)).toBe(1000 + number);
    expect(parseSpokenNumber(`ஒன்று பூஜ்ஜியம் ஐந்து ${word}`)).toBe(1050 + number);
  }
});
it.each([
  [10,'பத்து'],[20,'இருபது|இருபத்து|இருபத்தி'],[30,'முப்பது|முப்பத்து|முப்பத்தி'],
  [40,'நாற்பது|நாற்பத்து|நாப்பத்தி'],[50,'ஐம்பது|ஐம்பத்து|ஐம்பத்தி'],[60,'அறுபது|அறுபத்து|அறுபத்தி'],
  [70,'எழுபது|எழுபத்து|எழுபத்தி'],[80,'எண்பது|எண்பத்து|எண்பத்தி'],[90,'தொண்ணூறு|தொண்ணூற்று|தொண்ணூத்தி'],
])('Tamil tens/combining forms %i', (number, variants) => {
  for (const word of variants.split('|')) {
    expect(parseSpokenNumber(`ஆயிரம் ${word}`)).toBe(1000 + number);
    expect(parseSpokenNumber(`இரண்டு ஆயிரத்தி ${word} அஞ்சு`)).toBe(2005 + number);
  }
});
it.each([
  [11,'பதினொன்று|பதினொண்ணு|பதினொன்னு'],[12,'பன்னிரண்டு|பன்னிரெண்டு'],[13,'பதின்மூன்று|பதிமூணு'],
  [14,'பதினான்கு|பதினாலு'],[15,'பதினைந்து|பதினஞ்சு'],[16,'பதினாறு'],[17,'பதினேழு'],[18,'பதினெட்டு'],[19,'பத்தொன்பது'],
])('Tamil teens %i', (number, variants) => {
  for (const word of variants.split('|')) expect(parseSpokenNumber(`ஆயிரத்து ${word}`)).toBe(1000 + number);
});
it.each([
  ['ஆயிரத்து ஒன்று',1001],['ஆயிரம் பத்து',1010],['ஆயிரத்து ஐம்பத்தி ரெண்டு',1052],
  ['ஆயிரத்து ஐம்பத்தி மூணு',1053],['ஆயிரத்தி தொண்ணூத்தி ஒன்பது',1099],['ரெண்டு ஆயிரத்து நாப்பத்தி அஞ்சு',2045],
  ['one zero five three',1053],['thousand fifty three',1053],['ten fifty one',1051],['forty two',42],
  ['one 0 five 3',1053],['1 ஆயிரத்து fifty three',1053],['1000 ஐம்பத்தி 3',1053],['10 fifty three',1053],
  ['एक शून्य पांच तीन',1053],['एक हजार बावन',1052],['एक हज़ार तिरेपन',1053],['ek hazaar tirpan',1053],
  ['दो हजार पैंतालीस',2045],['एक हजार निन्यानवे',1099],['हीट शब्द',null],['',null],
])('shared parser %s -> %s', (text, expected) => expect(parseSpokenNumber(text)).toBe(expected));
it.each([
  ['शून्य',0],['ग्यारह',11],['उन्नीस',19],['बीस',20],['इक्कीस',21],['उनतीस',29],['तीस',30],['अड़तीस',38],
  ['चालीस',40],['पैंतालीस',45],['उनचास',49],['पचास',50],['इक्यावन',51],['बावन',52],['तिरपन',53],['तिरेपन',53],
  ['चौवन',54],['पचपन',55],['छप्पन',56],['उनसठ',59],['साठ',60],['सड़सठ',67],['उनहत्तर',69],['सत्तर',70],
  ['पचहत्तर',75],['उनासी',79],['अस्सी',80],['अट्ठासी',88],['नवासी',89],['नब्बे',90],['निन्यानवे',99],
  ['pachpan',55],['bawan',52],['chauwan',54],['नौ',9],
])('Hindi cardinal/variant %s', (word, number) => expect(parseSpokenNumber(word)).toBe(number));
it('Hindi table covers all 100 cardinals', () => {
  expect(hindiCardinals).toHaveLength(100);
  expect(new Set(hindiCardinals.flatMap(variants => variants.split('|'))).size).toBeGreaterThanOrEqual(100);
});
it.each([false, true])('real-mic colloquial Tamil maps H-1053 with bridge=%s', langBridge => {
  expect(mapIntent('heat ஆயிரத்து ஐம்பத்தி மூணு status என்ன?', { langBridge })).toMatchObject({ intent: 'heat_status', params: { heatNumber: 1053 } });
});
it('does not turn a context-free four-digit number inside chatter into heat intent', () => {
  expect(mapIntent('random value 1053')).toMatchObject({ intent: 'ask_copilot', params: {} });
});
it.each([[.3,false,'0.30'],[3,true,'3.0'],[1.8,true,'1.8'],[.005,false,'0.005'],[3.125,true,'3.125'],[1e-7,false,'0.0000001']])('Hindi limit precision %s', (value, low, expected) => expect(formatGateLimit(value, low)).toBe(expected));
it.each(['ta','hi','en'])('unknown intent and missing heat return friendly %s retry', async lang => {
  const say = vi.fn();
  const handler = createTranscriptHandler({ lang, langBridge: lang === 'hi', say, setHeard: vi.fn(), navigate: vi.fn(), resolveHeat: async () => null });
  for (const text of ['nonsense', 'heat nonsense status', 'heat 9999 status']) {
    await handler(text, lang === 'hi' ? { detected_language_code: 'hi-IN' } : {});
    expect(say.mock.calls.at(-1)[0]).toBe(retryVoiceAnswer(lang));
  }
});
it('real network errors propagate for the UI error state', async () => {
  const error = new Error('offline');
  const handler = createTranscriptHandler({ lang: 'en', say: vi.fn(), setHeard: vi.fn(), navigate: vi.fn(), resolveHeat: async () => { throw error; } });
  await expect(handler('heat 1053 status')).rejects.toBe(error);
});
it('turn timing contains numbers and language without transcript or keys', async () => {
  const say = vi.fn();
  const handler = createTranscriptHandler({ lang: 'en', say, setHeard: vi.fn(), navigate: vi.fn(), resolveHeat: async () => ({ heatId:'H-1053', status:'PLANNED' }) });
  await handler('heat 1053 status', { voiceTiming: true, stt_ms: 123 });
  expect(say.mock.calls[0][3]).toEqual({ stt_ms: 123, answer_ms: expect.any(Number) });
});
