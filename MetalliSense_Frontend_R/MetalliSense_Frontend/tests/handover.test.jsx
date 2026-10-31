import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { classifyHandoverClaim, extractHeatClaims, crossCheckHandover, submitHandover } from '../src/services/handover';
import ShiftHandover, { HandoverPanel } from '../src/components/voice/ShiftHandover';
import sample from '../src/fixtures/handover-sample.json';
vi.mock('../src/hooks/useSpeak', () => ({ default: () => ({ speak: vi.fn() }), useVoiceLanguage: () => ['en', vi.fn()] }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const heats = [{heatId:'H-1053',gate:{decision:'HOLD'}},{heatId:'H-1052',gate:{decision:'GO'}}];
it.each([
  ['Heat H-1053 is fine',1053],['heat one zero five three ready',1053],['heat ஆயிரத்து ஐம்பத்தி மூணு சரி',1053],
  ['हीट एक हजार बावन ठीक',1052],['heat ek hazaar tirpan fine',1053],['1053 is ready',1053],
])('extracts heat ID from %s', (text, number) => expect(extractHeatClaims(text)[0].heatId).toBe(`H-${number}`));
it.each([['OK','says OK'],['ready','says OK'],['fine','says OK'],['சரி','says OK'],['ரெடி','says OK'],['ठीक','says OK'],
 ['hold','says problem'],['problem','says problem'],['பிரச்சனை','says problem'],['गड़बड़','says problem'],['mentioned','mentioned'],
 ['not ready','says problem'],['சரியில்லை','says problem'],['ठीक नहीं','says problem'],['no problem','says OK']])('claim %s', (text, expected) => expect(classifyHandoverClaim(text)).toBe(expected));
it('claims bind to their own heat in one turn', () => {
  expect(extractHeatClaims('Heat 1053 is fine. Heat 1052 has a problem.')).toEqual([
    {heatId:'H-1053',claim:'says OK'},{heatId:'H-1052',claim:'says problem'}]);
});
it('does not add separate numeric heat IDs together', () => {
  expect(extractHeatClaims('Heats 1053 and 1052 are fine').map(row => row.heatId)).toEqual(['H-1053','H-1052']);
});
it('cross-check matrix and omissions are read-only', () => {
  const before = JSON.stringify(heats);
  const checks = crossCheckHandover(sample.segments, heats);
  expect(checks.map(c => [c.heatId,c.label,c.severity])).toEqual([
    ['H-1053','Mismatch','red'],['H-1052','Check','amber'],['H-1053','Consistent','green']]);
  expect(crossCheckHandover([{text:'Heat 1052 is ready'}],heats).at(-1)).toMatchObject({heatId:'H-1053',label:'HOLD heat not mentioned in handover',severity:'amber'});
  expect(JSON.stringify(heats)).toBe(before);
});
it('WARN also mismatches OK; unchecked and stale gates are never green', () => {
  for (const gate of [{decision:'WARN'},null,{decision:'GO',stale:true}]) {
    expect(crossCheckHandover([{text:'Heat 1052 is fine'}],[{heatId:'H-1052',gate}])[0].severity).not.toBe('green');
  }
});
it('flag off mounts nothing', () => {
  vi.stubEnv('VITE_HANDOVER','false'); expect(renderToStaticMarkup(<ShiftHandover heats={heats}/>)).toBe('');
});
it('enabled card and fixture are explicitly sample-not-live', () => {
  vi.stubEnv('VITE_HANDOVER','true');
  const html = renderToStaticMarkup(<ShiftHandover heats={heats}/>);
  expect(html).toContain('Shift handover'); expect(html).toContain('Load sample result (test only)');
  expect(sample.sample).toBe(true); expect(sample.job_id).toContain('not-live');
});
it('unavailable Agent never fabricates a successful transcript', async () => {
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')));
  await expect(submitHandover(new File(['a'],'a.wav'))).rejects.toThrow('offline');
});
it('handover request uses only the Agent, multipart and a long batch deadline', async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>sample});vi.stubGlobal('fetch',fetch);
  await submitHandover(new File(['a'],'a.wav'));
  expect(fetch.mock.calls[0][0]).toMatch(/\/copilot\/handover$/);
  expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  expect(fetch.mock.calls[0][1].timeout).toBe(155000);
  expect(fetch.mock.calls[0][1].headers).toBeUndefined();
});
