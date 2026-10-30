import { describe, it, expect } from 'vitest';
import { mapIntent } from '../src/services/voiceIntents';
describe('read-only voice intents', () => {
  it.each([
    ['heat 42 status enna', 'heat_status', { heatNumber: '42' }],
    ['H-1051 epdi irukku', 'heat_status', { heatNumber: '1051' }],
    ['h 1051 status', 'heat_status', { heatNumber: '1051' }],
    ['42 status', 'heat_status', { heatNumber: '42' }],
    ['carbon evvalavu', 'element_value', { element: 'C' }],
    ['கார்பன் எவ்வளவு', 'element_value', { element: 'C' }],
    ['சிலிக்கான் அளவு', 'element_value', { element: 'Si' }],
    ['மாங்கனீசு அளவு', 'element_value', { element: 'Mn' }],
    ['silicon level', 'element_value', { element: 'Si' }],
    ['Mn enna', 'element_value', { element: 'Mn' }],
    ['P level heat 42', 'element_value', { element: 'P', heatNumber: '42' }],
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
  it.each(['approve heat 42', 'confirm', 'release', 'deduct stock', 'start melt', 'invoice', 'delete', 'அனுமதி', 'ஒப்புதல்'])('blocks %s', text => {
    expect(mapIntent(text)).toMatchObject({ intent: 'blocked', reply: { ta: 'திரையில் approve செய்யவும்', en: 'Please approve on screen' } });
  });
});
