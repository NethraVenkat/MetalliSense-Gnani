import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import PushToTalk from '../src/components/voice/PushToTalk';
import useHandsFree from '../src/hooks/useHandsFree';
import useSpeak from '../src/hooks/useSpeak';
import { useMeltFlow } from '../src/context/MeltFlowContext';
import { useNavigate } from 'react-router-dom';

vi.mock('../src/hooks/useHandsFree', () => ({ default: vi.fn(() => ({ enabled: false, state: 'off', note: '', start: vi.fn(), stop: vi.fn() })) }));
vi.mock('../src/hooks/useSpeak', () => ({ default: vi.fn(() => ({ speak: vi.fn(), muted: false, toggleMute: vi.fn() })), useVoiceLanguage: () => ['en', vi.fn()] }));
vi.mock('../src/context/MeltFlowContext', () => ({ useMeltFlow: vi.fn(() => ({ flow: {} })) }));
vi.mock('react-router-dom', () => ({ useNavigate: vi.fn(() => vi.fn()) }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('voice panel hidden when VITE_SHOW_VOICE_PANEL=false (nothing mounted)', () => {
  vi.stubEnv('VITE_SHOW_VOICE_PANEL', 'false');
  expect(renderToStaticMarkup(React.createElement(PushToTalk))).toBe('');
  for (const hook of [useHandsFree, useSpeak, useMeltFlow, useNavigate]) expect(hook).not.toHaveBeenCalled();
});

it('voice panel shown by default', () => {
  vi.stubEnv('VITE_SHOW_VOICE_PANEL', undefined);
  const markup = renderToStaticMarkup(React.createElement(PushToTalk));
  expect(markup).toContain('Shop floor voice');
  expect(markup).toContain('Hold to talk');
  expect(markup).toContain('Hands-free');
  expect(useHandsFree).toHaveBeenCalledOnce();
});

it('Shift summary demo chip appears only with its flag',()=>{
  vi.stubEnv('VITE_SHOW_VOICE_PANEL','true');vi.stubEnv('VITE_MOCK_MODE','true');
  vi.stubEnv('VITE_SHIFT_SUMMARY','false');expect(renderToStaticMarkup(React.createElement(PushToTalk))).not.toContain('Shift summary');
  vi.stubEnv('VITE_SHIFT_SUMMARY','true');expect(renderToStaticMarkup(React.createElement(PushToTalk))).toContain('Shift summary');
});
