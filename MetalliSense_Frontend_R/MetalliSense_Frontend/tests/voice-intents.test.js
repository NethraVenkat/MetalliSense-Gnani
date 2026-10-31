import { describe, it, expect, vi } from 'vitest';
import { mapIntent, normalizeTranscript } from '../src/services/voiceIntents';
describe('read-only voice intents', () => {
  it.each(['stock melting', 'start melting', 'melting start pannu', 'உருக்க ஆரம்பி'])('%s -> blocked', text => {
    expect(mapIntent(text)).toEqual({ intent: 'blocked', params: {}, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen." } });
  });
  it.each([
    ['FeSi stock evvalavu', { alloy: 'FeSi' }], ['stock evvalavu', {}], ['stock enna', {}],
  ])('%s -> stock_check', (text, params) => {
    expect(mapIntent(text)).toEqual({ intent: 'stock_check', params });
  });
  it.each(['melt', 'melting', 'start melt', 'stop melting', 'உருக்கு', 'உருக்க', 'approval', 'start pannu', 'start panna'])('blocks the action phrase %s', text => {
    expect(mapIntent(text)).toMatchObject({ intent: 'blocked', params: {}, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.' } });
  });
  it('blocked check runs before every other intent', () => {
    for (const readOnly of ['FeSi stock evvalavu', 'Heat 1053 status என்ன', 'Heat 1053 carbon evvalavu', 'ஏன் HOLD', 'show dashboard', 'spectrometer kaattu', 'pre-melt open pannu', 'explain the furnace']) {
      for (const text of [`melting ${readOnly}`, `${readOnly} approval`]) {
        expect(mapIntent(text)).toEqual({ intent: 'blocked', params: {}, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen." } });
      }
    }
  });
  it.each([
    ['heat one zero five one status என்ன?', 'heat_status', { heatNumber: 1051 }],
    ['heat forty two எப்படி இருக்கு?', 'heat_status', { heatNumber: 42 }],
    ['heat four two நிலை?', 'heat_status', { heatNumber: 42 }],
    ['heat ten fifty one நிலை.', 'heat_status', { heatNumber: 1051 }],
    ['FESI stock எவ்வளவு?', 'stock_check', { alloy: 'FeSi' }],
    ['Spectrometer காட்டு.', 'open_screen', { route: '/spectrometer' }],
    ['So dashboard.', 'open_screen', { route: '/dashboard' }],
    ['show dashboard', 'open_screen', { route: '/dashboard' }],
    ['ஏன் hold heat one zero five one?', 'gate_reason', { heatNumber: 1051 }],
    ['sheet 1051 status in a', 'heat_status', { heatNumber: 1051 }],
    ['hit 1051 status', 'heat_status', { heatNumber: 1051 }],
    ['1051 status enna', 'heat_status', { heatNumber: 1051 }],
    ['heath 42 status', 'heat_status', { heatNumber: 42 }],
    ['heat forty two status in a', 'heat_status', { heatNumber: 42 }],
    ['heat 42 status in a', 'heat_status', { heatNumber: 42 }],
    ['silicon evolve', 'element_value', { element: 'Si' }],
    ['spectrometer cut too', 'open_screen', { route: '/spectrometer' }],
    ['heat one thousand fifty one status', 'heat_status', { heatNumber: 1051 }],
    ['heat ten fifty one status', 'heat_status', { heatNumber: 1051 }],
    ['heat one hundred and five status', 'heat_status', { heatNumber: 105 }],
    ['heat ninety-nine status', 'heat_status', { heatNumber: 99 }],
    ['heat zero status', 'heat_status', { heatNumber: 0 }],
    ['stock show', 'open_screen', { route: '/raw-material-stock' }],
    ['stock kattu', 'open_screen', { route: '/raw-material-stock' }],
    ['stock how much', 'stock_check', {}],
    ['en hold', 'gate_reason', {}],
    ['heat 42 status enna', 'heat_status', { heatNumber: 42 }],
    ['H-1051 epdi irukku', 'heat_status', { heatNumber: 1051 }],
    ['h 1051 status', 'heat_status', { heatNumber: 1051 }],
    ['42 status', 'heat_status', { heatNumber: 42 }],
    ['carbon evvalavu', 'element_value', { element: 'C' }],
    ['கார்பன் எவ்வளவு', 'element_value', { element: 'C' }],
    ['சிலிக்கான் அளவு', 'element_value', { element: 'Si' }],
    ['மாங்கனீசு அளவு', 'element_value', { element: 'Mn' }],
    ['silicon level', 'element_value', { element: 'Si' }],
    ['Mn enna', 'element_value', { element: 'Mn' }],
    ['P level heat 42', 'element_value', { element: 'P', heatNumber: 42 }],
    ['sulfur level', 'element_value', { element: 'S' }],
    ['sulphur level', 'element_value', { element: 'S' }],
    ['yen HOLD', 'gate_reason', {}], ['why hold', 'gate_reason', {}], ['ஏன் HOLD', 'gate_reason', {}],
    ['stock evvalavu', 'stock_check', {}], ['FeSi stock', 'stock_check', { alloy: 'FeSi' }],
    ['spectrometer kaattu', 'open_screen', { route: '/spectrometer' }],
    ['pre-melt open pannu', 'open_screen', { route: '/premelt-gate' }],
    ['dashboard', 'open_screen', { route: '/dashboard' }],
    ['stock open', 'open_screen', { route: '/raw-material-stock' }],
    ['explain the furnace', 'ask_copilot', {}], ['', 'ask_copilot', {}],
  ])('%s', (text, intent, params) => expect(mapIntent(text)).toEqual({ intent, params }));
  it('Y hold heat one zero five one.', () => {
    const transcript = 'Y hold heat one zero five one.';
    expect(mapIntent(transcript)).toEqual({ intent: 'gate_reason', params: { heatNumber: 1051 } });
    // Intent aliases must not erase the STT substitution from benchmark WER.
    expect(normalizeTranscript(transcript)).toBe('y hold heat 1051');
  });
  it('only treats a standalone Y directly before HOLD as why', () => {
    for (const transcript of ['Y heat 1051', 'Yhold heat 1051', 'any hold heat 1051']) {
      expect(mapIntent(transcript)).toEqual({ intent: 'heat_status', params: { heatNumber: 1051 } });
    }
    expect(mapIntent('approve Y hold heat 1051')).toMatchObject({ intent: 'blocked' });
    expect(mapIntent('please check 1051')).toEqual({ intent: 'ask_copilot', params: {} });
  });
  it.each([
    ['Heat one zero five, and manganese in a.', { heatNumber: 105, element: 'Mn' }],
    ['Heat one zero five, and manganese in an.', { heatNumber: 105, element: 'Mn' }],
    ['Heat one zero five on manganese FeMn.', { heatNumber: 105, element: 'Mn' }],
    ['What is the silicon level in Fe 1051?', { element: 'Si' }],
  ])('does not guess missing heat information: %s', (transcript, params) => {
    expect(mapIntent(transcript)).toEqual({ intent: 'element_value', params });
  });
  it.each(['heat', 'heath', 'sheet', 'hit', 'hate', 'eat', 'heet', "he't", 'he’t', 'h', 'h-'])('recognizes heat alias %s before a number', alias => {
    expect(mapIntent(`${alias} 1051 status`)).toEqual({ intent: 'heat_status', params: { heatNumber: 1051 } });
  });
  it.each(['status', 'epdi', 'enna', 'in a', 'nilai', 'நிலை'])('finds a heat number anywhere with status word %s', word => {
    expect(mapIntent(`please check 1051 ${word}`)).toEqual({ intent: 'heat_status', params: { heatNumber: 1051 } });
    expect(mapIntent(`please check 123 ${word}`)).toEqual({ intent: 'heat_status', params: { heatNumber: 123 } });
  });
  it.each(['please check 42 status', 'please check 12345 status', 'please check 1051', 'spreadsheet 42 status'])('does not infer heat from %s', text => {
    expect(mapIntent(text)).toEqual({ intent: 'ask_copilot', params: {} });
  });
  it('still blocks unsafe commands with misheard heat names', () => {
    expect(mapIntent('release sheet 1051 status')).toMatchObject({ intent: 'blocked' });
  });
  it.each(['magnus', 'magnes', 'magnis'])('recognizes cached Prisma Mn alias %s', alias => {
    expect(mapIntent(`1051 ${alias} in a`)).toEqual({ intent: 'element_value', params: { heatNumber: 1051, element: 'Mn' } });
  });
  it('preserves a misheard heat number instead of guessing the intended heat', () => {
    expect(mapIntent('81051 magnes in')).toEqual({ intent: 'element_value', params: { heatNumber: 81051, element: 'Mn' } });
  });
  it('recognizes the cached Prisma FeSi stock alias', () => {
    expect(mapIntent('fpsi stock evolve')).toEqual({ intent: 'stock_check', params: { alloy: 'FeSi' } });
  });
  it('matches Mn aliases as complete tokens', () => {
    expect(mapIntent('tell me about magnusson')).toEqual({ intent: 'ask_copilot', params: {} });
  });
  it.each(['deduct fpsi stock', 'approve 1051 magnus in a'])('keeps unsafe alias request blocked: %s', text => {
    expect(mapIntent(text)).toMatchObject({ intent: 'blocked' });
  });
  it.each(['inna', 'ena', 'yenna', 'anna', 'in a'])('understands phrase-ending %s', word => {
    expect(mapIntent(`heat forty two status ${word}.`)).toEqual({ intent: 'heat_status', params: { heatNumber: 42 } });
  });
  it.each(['evalavu', 'evalu', 'how much'])('understands quantity %s', word => {
    expect(mapIntent(`silicon ${word}`)).toEqual({ intent: 'element_value', params: { element: 'Si' } });
  });
  it.each(['approve', 'approve heat 42', 'approve heat 1053', 'start melting', 'start melting heat 1053', 'override HOLD', 'confirm', 'release', 'deduct stock', 'start melt', 'invoice', 'delete', 'அனுமதி', 'ஒப்புதல்'])('blocks %s', text => {
    expect(mapIntent(text)).toMatchObject({ intent: 'blocked', reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen." } });
  });
});

describe('shared transcript normalization', () => {
  it.each([
    ['heat one zero five one status என்ன?', 'heat 1051 status enna'],
    ['heat forty two எப்படி இருக்கு?', 'heat 42 epdi irukku'],
    ['heat four two நிலை?', 'heat 42 status'],
    ['heat ten fifty one நிலை.', 'heat 1051 status'],
    ['FESI stock எவ்வளவு?', 'fesi stock evvalavu'],
    ['Spectrometer காட்டு.', 'spectrometer kaattu'],
    ['So dashboard.', 'so dashboard'],
    ['show dashboard', 'show dashboard'],
    ['ஏன் hold?', 'yen hold'],
    ['HEAT, one-zero-five-one. என்ன?', 'heat 1051 enna'],
    ['heat zero zero four two status', 'heat 0042 status'],
    ['எப்படி\t இருக்கு?', 'epdi irukku'],
    ['என்னுடைய dashboard', 'என்னுடைய dashboard'],
  ])('normalizes %s', (text, normalized) => {
    expect(normalizeTranscript(text)).toBe(normalized);
    expect(normalizeTranscript(normalized)).toBe(normalized);
  });
});

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post }) } }));
import { transcribeAudio, synthesizeSpeechWithMeta } from '../src/services/copilotService';
import { speakText } from '../src/hooks/useSpeak';
import { createHoldAnnouncer } from '../src/services/voiceGateAnswers';

describe('TTS delivery style', () => {
  const audio = () => {
    post.mockResolvedValue({ data: new Blob(['audio']), headers: { 'x-tts-provider': 'gnani:timbre-v3.0:Shivani' } });
    vi.stubGlobal('Audio', class { play() { this.onended?.(); return Promise.resolve(); } pause() {} });
  };
  it('HOLD alert speech requests style alert', async () => {
    audio();
    try {
      await createHoldAnnouncer().checkResult('H-1053', { decision: 'HOLD', checks: [] }, speakText, 'ta');
      expect(post.mock.lastCall[1]).toMatchObject({ language: 'ta', style: 'alert', slow: false });
      expect(post.mock.lastCall[1].text).not.toMatch(/<[^>]+>/);
      expect(post.mock.lastCall[1].text).toMatch(/^Heat H-1053 HOLD\./);
      expect(post.mock.lastCall[1].text.trim().split(/\s+/).length).toBeLessThanOrEqual(15);
    } finally { vi.unstubAllGlobals(); }
  });
  it('normal answers use style normal', async () => {
    audio();
    try {
      await speakText('Heat H-1053: நிலை PLANNED. Gate HOLD', 'ta');
      expect(post.mock.lastCall[1]).toEqual({ text: 'Heat H-1053: நிலை PLANNED. Gate HOLD', language: 'ta', slow: false, style: 'normal' });
    } finally { vi.unstubAllGlobals(); }
  });
  it('metadata synthesis supports alert style and model/voice provider headers', async () => {
    audio();
    try {
      const response = await synthesizeSpeechWithMeta('HOLD', 'ta', 'alert');
      expect(post.mock.lastCall[1].style).toBe('alert');
      expect(response.provider).toBe('gnani:timbre-v3.0:Shivani');
    } finally { vi.unstubAllGlobals(); }
  });
});
describe('STT language delegation', () => {
  it.each([null, '', undefined, '   '])('omits language for %s', language => {
    transcribeAudio(new Blob(['audio']), language);
    const form = post.mock.lastCall[1];
    expect(form.has('audio')).toBe(true);
    expect(form.has('language')).toBe(false);
  });
  it('allows an explicit language override', () => {
    transcribeAudio(new Blob(['audio']), 'en-IN');
    expect(post.mock.lastCall[1].get('language')).toBe('en-IN');
  });
});
