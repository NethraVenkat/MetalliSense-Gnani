import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { createTranscriptHandler } from '../src/services/voiceTranscript';
import { gatePhraseFacts } from '../src/services/gatePhraseFacts';
import { createHoldAnnouncer, heatVoiceAnswer, spokenGateReasonAnswer } from '../src/services/voiceGateAnswers';
import { VoicePhraseBadge } from '../src/components/voice/PushToTalk';
import { tryRealCopilot } from '../src/mock/copilotTransport';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post, interceptors: { response: { use: vi.fn() } } }) } }));
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

const heat = { heatId: 'H-1053', status: 'PLANNED', gateResult: { decision: 'HOLD', checks: [
  { id: 'lot_status', status: 'FAIL', details: [{ lotId: 'PIG-1053', status: 'FAIL', text: 'QUARANTINED' }] },
  { id: 'residuals', status: 'FAIL', details: [{ element: 'Cu', value: .5, max: .3, status: 'FAIL' }] },
] } };
function fixture(view = heat) {
  const say = vi.fn(), setPhraseSource = vi.fn();
  const handle = createTranscriptHandler({ lang: 'ta', setHeard: vi.fn(), say, navigate: vi.fn(), resolveHeat: async () => view, setPhraseSource });
  return { handle, say, setPhraseSource };
}

it('gate_reason uses Evon text when source evon', async () => {
  const text = 'Heat H-1053 HOLD. PIG-1053 தனிமைப்படுத்தப்பட்டுள்ளது; Cu 0.5 சதவீதம் அதிகம்.';
  post.mockResolvedValue({ data: { source: 'evon', text } });
  const f = fixture(); await f.handle('ஏன் HOLD');
  expect(post.mock.calls[0][0]).toBe('/copilot/evon/phrase');
  expect(post.mock.calls[0][1]).toEqual({ kind: 'hold', lang: 'ta', facts: gatePhraseFacts(heat) });
  expect(f.say).toHaveBeenCalledExactlyOnceWith(text, text);
  expect(f.setPhraseSource).toHaveBeenLastCalledWith('evon');
});

it('gate_reason uses the existing full and spoken templates on source template', async () => {
  post.mockResolvedValue({ data: { source: 'template', text: 'Ignore this server fallback', reject_reason: 'invented_element' } });
  const f = fixture(); await f.handle('why hold heat 1053');
  expect(f.say).toHaveBeenCalledExactlyOnceWith(heatVoiceAnswer('gate_reason', heat, {}, 'ta'), spokenGateReasonAnswer(heat.gateResult, 'ta'));
  expect(f.setPhraseSource).toHaveBeenLastCalledWith('template');
});

it('gate_reason falls back at six seconds and discards a late Evon reply', async () => {
  vi.useFakeTimers(); let finish;
  post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const f = fixture(); const answer = f.handle('ஏன் HOLD');
  await vi.advanceTimersByTimeAsync(6000); await answer;
  expect(f.say).toHaveBeenCalledExactlyOnceWith(heatVoiceAnswer('gate_reason', heat, {}, 'ta'), spokenGateReasonAnswer(heat.gateResult, 'ta'));
  expect(post.mock.calls[0][2].signal.aborted).toBe(true);
  finish({ data: { source: 'evon', text: 'late result' } }); await Promise.resolve();
  expect(f.say).toHaveBeenCalledOnce(); expect(f.setPhraseSource).toHaveBeenLastCalledWith('template');
});

it('offline phrasing keeps the template answer', async () => {
  post.mockRejectedValue(new Error('offline'));
  const f = fixture(); await f.handle('ஏன் HOLD');
  expect(f.setPhraseSource).toHaveBeenLastCalledWith('template');
  expect(f.say.mock.calls[0][0]).toBe(heatVoiceAnswer('gate_reason', heat, {}, 'ta'));
});

it('WARN gate reasons also use validated Evon text', async () => {
  const warn = { ...heat, heatId: 'H-1052', gateResult: { decision: 'WARN', checks: [
    { id: 'spec_prediction', status: 'WARN', details: [{ element: 'C', value: 2.5, min: 3, max: 4, status: 'WARN' }] },
  ] } };
  post.mockResolvedValue({ data: { source: 'evon', text: 'Heat H-1052 WARN. கார்பன் 2.5 சதவீதம் குறைவு.' } });
  const f = fixture(warn); await f.handle('ஏன் HOLD');
  expect(post.mock.calls[0][1].kind).toBe('warn');
  expect(f.setPhraseSource).toHaveBeenLastCalledWith('evon');
});

it('HOLD alert stays template-only', async () => {
  const speak = vi.fn();
  createHoldAnnouncer().announce(heat.heatId, heat.gateResult, speak, 'ta');
  expect(speak).toHaveBeenCalledOnce();
  expect(speak.mock.calls[0][0]).toContain('Heat H-1053 HOLD');
  expect(speak.mock.calls[0][2]).toBe('alert');
  expect(post).not.toHaveBeenCalled();
});

it('status, blocked and GO answers never request Evon phrasing', async () => {
  const f = fixture(); await f.handle('Heat 1053 status என்ன'); await f.handle('start melting');
  const go = fixture({ ...heat, gateResult: { decision: 'GO' } }); await go.handle('ஏன் HOLD');
  expect(post).not.toHaveBeenCalled();
  expect(f.say.mock.calls[1][0]).toBe('திரையில் approve செய்யவும்');
  expect(go.setPhraseSource).toHaveBeenLastCalledWith('template');
});

it('badge shows the actual answer source', () => {
  expect(renderToStaticMarkup(React.createElement(VoicePhraseBadge, { source: 'evon' }))).toContain('Evon v3.3');
  expect(renderToStaticMarkup(React.createElement(VoicePhraseBadge, { source: 'template' }))).toContain('template');
  expect(renderToStaticMarkup(React.createElement(VoicePhraseBadge, { source: null }))).toBe('');
});

it('facts select the first two template reasons and contain no model advice or raw text', () => {
  const extra = { ...heat, gateResult: { ...heat.gateResult, checks: [
    { id: 'ai_assessment', status: 'FAIL', summary: 'Add Mn 99' },
    ...heat.gateResult.checks,
    { id: 'stock', status: 'WARN', details: [{ text: 'Unneeded raw text', status: 'WARN' }] },
  ] } };
  const before = structuredClone(extra);
  expect(gatePhraseFacts(extra)).toEqual({ heat_id: 'H-1053', decision: 'HOLD', reasons: [
    { check: 'lot_status', status: 'FAIL', lot_id: 'PIG-1053', lot_status: 'QUARANTINED' },
    { check: 'residuals', status: 'FAIL', element: 'Cu', value: .5, max: .3, direction: 'high' },
  ] });
  expect(extra).toEqual(before);
});

it('in-range WARN values are explicitly marked as risks, not limit violations', () => {
  const view = { heatId: 'H-1052', gateResult: { decision: 'WARN', checks: [
    { id: 'residuals', status: 'WARN', details: [{ element: 'Cu', value: .27, max: .3, status: 'WARN' }] },
  ] } };
  expect(gatePhraseFacts(view).reasons[0]).toEqual({ check: 'residuals', status: 'WARN', element: 'Cu', value: .27, max: .3, direction: 'high', risk: true });
});

it('mock mode routes only the Evon phrase endpoint to the real Agent', async () => {
  const fetchAgent = vi.fn(async () => new Response('{"source":"template"}'));
  expect((await tryRealCopilot(fetchAgent, 'http://localhost:8001/copilot/evon/phrase')).status).toBe(200);
  expect(await tryRealCopilot(fetchAgent, 'http://localhost:8001/copilot/evon/other')).toBeNull();
  expect(fetchAgent).toHaveBeenCalledOnce();
});
