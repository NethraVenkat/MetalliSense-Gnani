import { afterEach, expect, it, vi } from 'vitest';
import { pickReplyLanguage, hindiBlocked, hindiHoldAlert, hindiNotUnderstood } from '../src/services/languageBridge';
import { hindiGateAnswer, hindiElements } from '../src/services/hindiVoice';
import { mapIntent } from '../src/services/voiceIntents';
import { createHoldAnnouncer, buildHoldAlertTexts } from '../src/services/voiceGateAnswers';
import { createTranscriptHandler } from '../src/services/voiceTranscript';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post, get, interceptors: { response: { use: vi.fn() } } }) } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const heat = { heatId: 'H-1053', status: 'PLANNED', gateResult: { decision: 'HOLD', checks: [
  { id: 'lot_status', status: 'FAIL', details: [{ lotId: 'PIG-1053', status: 'FAIL', text: 'QUARANTINED' }] },
  { id: 'residuals', status: 'FAIL', details: [{ element: 'Cu', value: .5, max: .3, status: 'FAIL' }] },
] } };

it.each([
  ['heat status', 'hi-IN', 'en', 'hi'], ['हीट स्टेटस', null, 'ta', 'hi'],
  ['copper kitna hai', 'en-IN', 'ta', 'hi'], ['approve karo', 'en-IN', 'ta', 'hi'],
  ['heat status என்ன', 'en-IN', 'en', 'ta'], ['heat status enna', null, 'en', 'ta'],
  ['1053 en hold', null, 'en', 'ta'], ['show dashboard', 'en-IN', 'en', 'en'],
  ['heat kya என்ன', 'ta-IN', 'en', 'ta'],
])('picks reply language for %s', (text, code, current, expected) => {
  expect(pickReplyLanguage(text, code, current, true)).toBe(expected);
  expect(pickReplyLanguage(text, code, current, false)).toBe(current);
});
it.each([
  ['heat 1053 ka status kya hai', 'heat_status', { heatNumber: 1053 }],
  ['1053 hold kyun hai', 'gate_reason', { heatNumber: 1053 }],
  ['copper kitna hai heat 1053', 'element_value', { heatNumber: 1053, element: 'Cu' }],
  ['हीट 1053 का स्टेटस', 'heat_status', { heatNumber: 1053 }],
  ['हीट एक शून्य पाँच तीन का स्टेटस', 'heat_status', { heatNumber: 1053 }],
  ['हीट १०५३ का स्टेटस', 'heat_status', { heatNumber: 1053 }],
  ['heat एक हज़ार तिरपन का स्टेटस क्या है?', 'heat_status', { heatNumber: 1053 }],
  ['एक हजार तिरेपन hold क्यों है?', 'gate_reason', { heatNumber: 1053 }],
  ['copper कितना है? heat एक हजार तिरेपन।', 'element_value', { heatNumber: 1053, element: 'Cu' }],
  ['heat ஆயிரத்தி ஐம்பத்து மூன்று status என்ன?', 'heat_status', { heatNumber: 1053 }],
  ['ஆயிரத்தி ஐம்பத்து மூன்று, என் hold.', 'gate_reason', { heatNumber: 1053 }],
  ['ஆயிரத்தி ஐம்பத்து மூன்று, N hold.', 'gate_reason', { heatNumber: 1053 }],
  ['काॅपर', 'ask_copilot', {}],
  ['kaun se heat hold par hai', 'ask_copilot', { bridgeAction: 'list_holds' }],
  ['कौन सी हीट होल्ड पर है', 'ask_copilot', { bridgeAction: 'list_holds' }],
  ['madad', 'ask_copilot', { bridgeAction: 'help' }],
])('Hindi existing intent: %s', (text, intent, params) => expect(mapIntent(text, { langBridge: true })).toMatchObject({ intent, params }));
it.each(['approve karo', 'aprove karo', 'melting shuru karo', 'start karo', 'override karo', 'stock kam karo', 'अप्रूव', 'मेल्टिंग शुरू', 'स्टॉक कम करो', 'stock melting', 'suru karo', 'start kro', 'stock कम करो', 'स्टॉक kam karo', 'apruv karo', 'कन्फर्म करो', 'रिलीज करो'])('Hindi safety before all intents: %s', action => {
  for (const suffix of ['', ' heat 1053 status', ' copper kitna hai', ' kaun se heat hold par hai', ' FeSi stock', ' dashboard']) expect(mapIntent(action + suffix, { langBridge: true }).intent).toBe('blocked');
});
it('Hindi HOLD facts preserve formatted value and cap reasons', () => {
  const extra = structuredClone(heat);
  extra.gateResult.checks.push({ id: 'spec_prediction', status: 'WARN', details: [{ element: 'C', value: 2.57, min: 3, max: 4, status: 'WARN' }] });
  expect(hindiGateAnswer(extra)).toBe('हीट H-1053 होल्ड पर है। लॉट PIG-1053 क्वारंटीन में है। कॉपर 0.50 प्रतिशत है, सीमा 0.30 से ज़्यादा। 1 और बातें स्क्रीन पर।');
});
it('Hindi WARN low and GO templates', () => {
  const warn = { heatId: 'H-1052', gateResult: { decision: 'WARN', checks: [{ id: 'spec_prediction', status: 'WARN', details: [{ element: 'C', value: 2.57, min: 3, max: 4, status: 'WARN' }] }] } };
  expect(hindiGateAnswer(warn)).toBe('हीट H-1052 पर चेतावनी है। कार्बन 2.57 प्रतिशत है, न्यूनतम 3.0 से कम।');
  expect(hindiGateAnswer({ ...heat, gateResult: { decision: 'GO' } })).toBe('हीट H-1053 ठीक है, गो।');
});
it('Hindi near-limit WARN is risk, never false high or low', () => {
  const warn = { ...heat, gateResult: { decision: 'WARN', checks: [{ id: 'residuals', status: 'WARN', details: [{ element: 'Cu', value: .27, min: 0, max: .3, status: 'WARN' }] }] } };
  expect(hindiGateAnswer(warn)).toContain('कॉपर 0.27 प्रतिशत है, सीमा के पास है।');
});
it('Hindi HOLD alert is at most 15 words', () => expect(hindiHoldAlert('H-1053').split(/\s+/).length).toBeLessThanOrEqual(15));
it('explicit bilingual flag speaks Tamil then Hindi sequentially, once', async () => {
  vi.stubEnv('VITE_LANG_BRIDGE', 'true');vi.stubEnv('VITE_BILINGUAL_ALERT','true'); let finish;
  const speak = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(undefined);
  const announcer = createHoldAnnouncer();
  const result = announcer.checkResult(heat.heatId, heat.gateResult, speak, 'en');
  expect(speak).toHaveBeenCalledExactlyOnceWith(buildHoldAlertTexts(heat.heatId, heat.gateResult, 'ta').spokenAlert, 'ta', 'alert');
  finish(); await result;
  expect(speak).toHaveBeenLastCalledWith(hindiHoldAlert(heat.heatId), 'hi', 'alert');
  announcer.checkResult(heat.heatId, heat.gateResult, speak); expect(speak).toHaveBeenCalledTimes(2);
});
it('bridge on alone keeps the alert in the selected language', () => {
  vi.stubEnv('VITE_LANG_BRIDGE', 'true'); const speak = vi.fn();
  createHoldAnnouncer().checkResult(heat.heatId, heat.gateResult, speak, 'en');
  expect(speak).toHaveBeenCalledExactlyOnceWith(buildHoldAlertTexts(heat.heatId, heat.gateResult, 'en').spokenAlert, 'en', 'alert');
});
it('Hindi transcript uses deterministic templates and hi TTS without Evon', async () => {
  const say = vi.fn(), setPhraseSource = vi.fn(), resolveHeat = vi.fn().mockResolvedValue(heat);
  const handle = createTranscriptHandler({ lang: 'ta', langBridge: true, setHeard: vi.fn(), say, navigate: vi.fn(), resolveHeat, setPhraseSource });
  await handle('1053 hold kyun hai', { detected_language_code: 'hi-IN' });
  expect(say).toHaveBeenLastCalledWith(hindiGateAnswer(heat), hindiGateAnswer(heat), 'hi');
  expect(setPhraseSource).toHaveBeenLastCalledWith('template'); expect(post).not.toHaveBeenCalled();
  await handle('approve karo');
  expect(say).toHaveBeenLastCalledWith(hindiBlocked, hindiBlocked, 'hi'); expect(resolveHeat).toHaveBeenCalledTimes(1);
  await handle('कुछ नहीं'); expect(say).toHaveBeenLastCalledWith(hindiNotUnderstood, hindiNotUnderstood, 'hi');
});
it.each(Object.entries(hindiElements))('Hindi template names element %s', (element, name) => {
  const view = { ...heat, gateResult: { decision: 'HOLD', checks: [{ id: 'residuals', status: 'FAIL', details: [{ element, value: .5, max: .3, status: 'FAIL' }] }] } };
  expect(hindiGateAnswer(view)).toContain(`${name} 0.50 प्रतिशत है, सीमा 0.30 से ज़्यादा।`);
});
it('Hindi hold list reads actual heat summary gate field without calling Evon', async () => {
  get.mockResolvedValue({ data: { data: [{ heatId: 'H-1053', gate: { decision: 'HOLD' } }, { heatId: 'H-1052', gate: { decision: 'WARN' } }] } });
  const say = vi.fn();
  const handle = createTranscriptHandler({ lang: 'ta', langBridge: true, setHeard: vi.fn(), say, navigate: vi.fn(), resolveHeat: vi.fn() });
  await handle('kaun se heat hold par hai');
  expect(say).toHaveBeenCalledExactlyOnceWith('होल्ड पर हीट: H-1053।', 'होल्ड पर हीट: H-1053।', 'hi');
  expect(post).not.toHaveBeenCalled();
});
it('flag off ignores detected Hindi and keeps the existing English answer path', async () => {
  const say = vi.fn();
  const handle = createTranscriptHandler({ lang: 'en', setHeard: vi.fn(), say, navigate: vi.fn(), resolveHeat: async () => heat });
  await handle('heat 1053 status', { detected_language_code: 'hi-IN' });
  expect(say).toHaveBeenCalledExactlyOnceWith('Heat H-1053: PLANNED. Gate HOLD', 'Heat H-1053: PLANNED. Gate HOLD');
});
