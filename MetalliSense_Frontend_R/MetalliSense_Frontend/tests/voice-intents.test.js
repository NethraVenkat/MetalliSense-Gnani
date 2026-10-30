import { describe, it, expect, vi } from 'vitest';
import { mapIntent } from '../src/services/voiceIntents';
describe('read-only voice intents', () => {
  it.each([
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
  it.each(['inna', 'ena', 'yenna', 'anna', 'in a'])('understands phrase-ending %s', word => {
    expect(mapIntent(`heat forty two status ${word}.`)).toEqual({ intent: 'heat_status', params: { heatNumber: 42 } });
  });
  it.each(['evalavu', 'evalu', 'how much'])('understands quantity %s', word => {
    expect(mapIntent(`silicon ${word}`)).toEqual({ intent: 'element_value', params: { element: 'Si' } });
  });
  it.each(['approve heat 42', 'confirm', 'release', 'deduct stock', 'start melt', 'invoice', 'delete', 'அனுமதி', 'ஒப்புதல்'])('blocks %s', text => {
    expect(mapIntent(text)).toMatchObject({ intent: 'blocked', reply: { ta: 'திரையில் approve செய்யவும்', en: 'Please approve on screen' } });
  });
});

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post }) } }));
import { transcribeAudio } from '../src/services/copilotService';
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
