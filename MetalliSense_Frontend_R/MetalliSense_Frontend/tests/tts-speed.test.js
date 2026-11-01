import { afterEach, expect, it, vi } from 'vitest';
import { toSpokenText } from '../src/services/spokenText';
import { playSpeechStream, readAudioEvents } from '../src/services/ttsStream';
import { speakText, isSpeechEchoGuarded } from '../src/hooks/useSpeak';
import { createHoldAnnouncer } from '../src/services/voiceGateAnswers';
import {voiceTourSteps,tourSpokenText} from '../src/services/voiceTour';
import latinSpeech from './fixtures/f14-latin-speech.json';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ post }) } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it.each([
  ['ta','H-1053','ஹீட் ஆயிரத்து ஐம்பத்து மூன்று'],['hi','H-1053','हीट एक हज़ार तिरपन'],['en','H-1053','heat ten fifty-three'],
  ['ta','PIG-1053','பிக் ஆயிரத்து ஐம்பத்து மூன்று'],['hi','PIG-1053','पिग एक हज़ार तिरपन'],['en','PIG-1053','pig ten fifty-three'],
  ['ta','0.50','பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம்'],['hi','0.50','शून्य दशमलव पाँच शून्य'],['en','0.50','zero point five zero'],
  ['ta','0.50%','பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம்'],['hi','0.50%','शून्य दशमलव पाँच शून्य प्रतिशत'],['en','0.50%','zero point five zero percent'],
  ['en','XYZ-1053','X Y Z ten fifty-three'],['hi','XYZ-1053','X Y Z एक हज़ार तिरपन'],['ta','XYZ-1053','X Y Z ஆயிரத்து ஐம்பத்து மூன்று'],
  ['en','PIG-0010','pig zero zero one zero'],['en','Heat H-1053','heat ten fifty-three'],['hi','हीट H-1053','हीट एक हज़ार तिरपन'],
])('spoken pronunciation %s: %s', (lang, source, expected) => expect(toSpokenText(source,lang)).toBe(expected));
it.each(['ta','hi','en'])('leaves documented provider normalization and element names intact: %s', lang => {
  expect(toSpokenText('42 0.5 8.5% kg carbon கார்பன் कार्बन',lang)).toBe('42 0.5 8.5% kg carbon கார்பன் कार्बन');
  expect(toSpokenText('0.50',lang)).not.toBe(toSpokenText('0.5',lang));
});
it('voice-only helper never changes the on-screen answer', () => {
  const answer = {display:'Heat H-1053: Cu 0.50%'};
  expect(toSpokenText(answer.display,'en')).toContain('zero point five zero percent');
  expect(answer.display).toBe('Heat H-1053: Cu 0.50%');
});

function sse(events) {
  return new Response(new ReadableStream({start(controller) {
    const encoded = new TextEncoder().encode(events);
    for (let i=0;i<encoded.length;i+=17) controller.enqueue(encoded.slice(i,i+17));
    controller.close();
  }}),{headers:{'Content-Type':'text/event-stream'}});
}
const AUDIO = 'event: audio\ndata: {"audio":"AQACAA==","encoding":"pcm_s16le","sample_rate":22050,"path":"stream"}\n\n';
const COMPLETE = 'event: complete\ndata: {"path":"stream"}\n\n';
function webAudio(autoEnd=true) {
  const nodes=[], contexts=[];
  class Context {
    constructor() { this.currentTime=0;this.destination={};contexts.push(this); }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createBuffer(_,length,rate) { const samples=new Float32Array(length);return {duration:length/rate,getChannelData:()=>samples}; }
    decodeAudioData() { return Promise.resolve({duration:.01}); }
    createBufferSource() {
      const node={connect:vi.fn(),stop:vi.fn(()=>node.onended?.()),start:vi.fn(()=>{ if (autoEnd) queueMicrotask(()=>node.onended?.()); })};
      nodes.push(node);return node;
    }
  }
  vi.stubGlobal('AudioContext',Context);return {nodes,contexts};
}
const flush = async () => { for(let i=0;i<30;i++) await Promise.resolve(); };
it.each(['ta','hi','en'])('reviewed tour payload bypasses lexicon and normalization flags: %s',async lang=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');vi.stubEnv('VITE_VOICE_REGISTER','formal');vi.stubEnv('VITE_SPOKEN_NORMALIZE','true');vi.stubEnv('VITE_TTS_STREAM','false');
 post.mockResolvedValue({data:new Blob(['wav']),headers:{}});
 vi.stubGlobal('Audio',class{play(){this.onended();return Promise.resolve();}pause(){}});
 const text=tourSpokenText(voiceTourSteps(true,{shiftSummary:true})[6],lang);
 await speakText(text,lang,'normal',{pronunciationOnly:true});expect(post.mock.lastCall[1].text).toBe(text);
 const quoted="HOLD carbon 0.50% Ask 'what can I ask here?' any time.";
 await speakText(quoted,lang,'normal',{pronunciationOnly:true});expect(post.mock.lastCall[1].text).toBe(quoted);
});
it.each(latinSpeech)('final REST TTS input retains Latin corrections and native grammar: $clipId',async row=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');vi.stubEnv('VITE_VOICE_REGISTER','formal');vi.stubEnv('VITE_SPOKEN_NORMALIZE','true');vi.stubEnv('VITE_TTS_STREAM','false');
 post.mockResolvedValue({data:new Blob(['wav']),headers:{}});
 vi.stubGlobal('Audio',class{play(){this.onended();return Promise.resolve();}pause(){}});
 const step=voiceTourSteps(true).find(step=>step.id===row.id),display=step.texts[row.lang];
 await speakText(tourSpokenText(step,row.lang),row.lang,'normal',{pronunciationOnly:true});
 expect(post.mock.lastCall[0]).toBe('/copilot/voice/synthesize');
 expect(post.mock.lastCall[1]).toMatchObject({text:row.after,language:row.lang,style:'normal',slow:false});
 expect(step.texts[row.lang]).toBe(display);
});
it.each(latinSpeech)('final streaming TTS input retains Latin corrections: $clipId',async row=>{
 vi.stubEnv('VITE_VOICE_CLARITY','true');vi.stubEnv('VITE_SPOKEN_NORMALIZE','true');vi.stubEnv('VITE_TTS_STREAM','true');
 webAudio();const request=vi.fn().mockResolvedValue(sse(AUDIO+COMPLETE));vi.stubGlobal('fetch',request);
 const step=voiceTourSteps(true).find(step=>step.id===row.id);
 await speakText(tourSpokenText(step,row.lang),row.lang,'normal',{pronunciationOnly:true});
 expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({text:row.after,language:row.lang,style:'normal'});
});
it('SSE parser handles fragmented event frames', async () => {
  const events=[];for await (const event of readAudioEvents(sse(AUDIO+COMPLETE))) events.push(event);
  expect(events.map(event=>event.type)).toEqual(['audio','complete']);
});
it('plays PCM chunks incrementally and reports first-audio/duration/path', async () => {
  webAudio();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(sse(AUDIO+COMPLETE)));const start=vi.fn();
  const metrics=await playSpeechStream('private text','ta','normal',{onAudioStart:start});
  expect(start).toHaveBeenCalledOnce();expect(metrics.path).toBe('stream');expect(metrics.total_audio_ms).toBeGreaterThan(0);
  expect(metrics.time_to_first_audio_ms).toBeGreaterThanOrEqual(0);
});
it('Agent stream disabled falls back to existing REST speech', async () => {
  webAudio();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404})));
  post.mockResolvedValue({data:new Blob(['wav']),headers:{'x-tts-provider':'gnani:timbre-v3.0:Kalpana'}});
  expect((await playSpeechStream('private text','hi','normal')).path).toBe('rest');
  expect(post.mock.lastCall[0]).toBe('/copilot/voice/synthesize');
});
it('stream reset stops partial sources before fallback restarts', async () => {
  const {nodes}=webAudio(false);
  const reset='event: reset\ndata: {"reason":"stream_fallback"}\n\n';
  const fallback='event: audio\ndata: {"audio":"AAAA","encoding":"mp3","path":"fallback"}\n\n';
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(sse(AUDIO+reset+fallback+'event: complete\ndata: {"path":"fallback"}\n\n')));
  const playback=playSpeechStream('x','en','normal');await flush();
  expect(nodes).toHaveLength(2);nodes[1].onended();
  expect((await playback).path).toBe('fallback');
  expect(nodes[0].stop).toHaveBeenCalled();
});
it('aborting streamed playback stops scheduled audio', async () => {
  const {nodes}=webAudio(false);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(sse(AUDIO+COMPLETE)));
  const controller=new AbortController();const playback=playSpeechStream('x','ta','normal',{signal:controller.signal});
  await flush();controller.abort();await playback;
  expect(nodes[0].stop).toHaveBeenCalled();
});
it('muted streaming makes no speech request', async () => {
  vi.stubGlobal('localStorage',{getItem:key=>key==='metallisense.voice.muted'?'true':null});
  vi.stubEnv('VITE_TTS_STREAM','true');webAudio();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  vi.resetModules();const {speakText:mutedSpeak}=await import('../src/hooks/useSpeak');
  const before=post.mock.calls.length;await mutedSpeak('private text','hi');
  expect(fetch).not.toHaveBeenCalled();expect(post.mock.calls.length).toBe(before);
  vi.resetModules();
});
it('flags off keep the original REST text/payload', async () => {
  vi.stubEnv('VITE_TTS_STREAM','false');vi.stubEnv('VITE_SPOKEN_NORMALIZE','false');
  post.mockResolvedValue({data:new Blob(['wav']),headers:{}});
  vi.stubGlobal('Audio',class {play(){this.onended();return Promise.resolve();}pause(){}});
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await speakText('H-1053 0.50%','en');
  expect(fetch).not.toHaveBeenCalled();expect(post.mock.lastCall[1]).toEqual({text:'H-1053 0.50%',language:'en',slow:false,style:'normal'});
});
it('normalization changes only speech payload', async () => {
  vi.stubEnv('VITE_TTS_STREAM','false');vi.stubEnv('VITE_SPOKEN_NORMALIZE','true');
  post.mockResolvedValue({data:new Blob(['wav']),headers:{}});
  vi.stubGlobal('Audio',class {play(){this.onended();return Promise.resolve();}pause(){}});
  const display='H-1053 0.50%';await speakText(display,'hi');
  expect(post.mock.lastCall[1].text).toBe(toSpokenText(display,'hi'));expect(display).toBe('H-1053 0.50%');
});
it('streaming keeps queue serial and echo guard through 400ms after playback', async () => {
  vi.stubEnv('VITE_TTS_STREAM','true');const {nodes}=webAudio(false);
  const fetch=vi.fn().mockImplementation(async()=>sse(AUDIO+COMPLETE));vi.stubGlobal('fetch',fetch);
  const first=speakText('first','ta');await flush();
  expect(isSpeechEchoGuarded()).toBe(true);
  const second=speakText('second','hi');await flush();expect(fetch).toHaveBeenCalledTimes(1);
  nodes[0].onended();await first;await flush();expect(fetch).toHaveBeenCalledTimes(2);
  nodes[1].onended();await second;expect(isSpeechEchoGuarded()).toBe(true);
  expect(isSpeechEchoGuarded(Date.now()+401)).toBe(false);
});
it('streaming HOLD keeps alert style and Tamil then Hindi order', async () => {
  vi.stubEnv('VITE_TTS_STREAM','true');vi.stubEnv('VITE_LANG_BRIDGE','true');vi.stubEnv('VITE_BILINGUAL_ALERT','true');webAudio();
  const fetch=vi.fn().mockImplementation(async()=>sse(AUDIO+COMPLETE));vi.stubGlobal('fetch',fetch);
  await createHoldAnnouncer().checkResult('H-1053',{decision:'HOLD',checks:[]},speakText,'ta');
  expect(fetch.mock.calls.map(([,init])=>JSON.parse(init.body).language)).toEqual(['ta','hi']);
  expect(fetch.mock.calls.every(([,init])=>JSON.parse(init.body).style==='alert')).toBe(true);
});
it('late first stream audio after navigation is dropped without REST fallback',async()=>{
 const {nodes}=webAudio(false);let finish,current=true;
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
 const before=post.mock.calls.length;
 const playback=playSpeechStream('old page reply','en','normal',{isCurrent:()=>current});
 await flush();current=false;finish(sse(AUDIO+COMPLETE));
 await expect(playback).rejects.toThrow('Aborted');expect(nodes).toHaveLength(0);expect(post.mock.calls.length).toBe(before);
});
it('late REST audio after navigation is never played',async()=>{
 vi.stubEnv('VITE_TTS_STREAM','false');let finish,current=true;
 post.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const audio=vi.fn();vi.stubGlobal('Audio',audio);
 const playback=speakText('old page reply','en','normal',{isCurrent:()=>current});
 await flush();current=false;finish({data:new Blob(['wav']),headers:{}});await playback;
 expect(audio).not.toHaveBeenCalled();
});
it('tour cancellation stops streaming audio before the next queued step plays',async()=>{
 vi.stubEnv('VITE_TTS_STREAM','true');const {nodes}=webAudio(false);
 const fetch=vi.fn().mockImplementation(async()=>sse(AUDIO+COMPLETE));vi.stubGlobal('fetch',fetch);
 const abort=new AbortController();
 const first=speakText('tour first','ta','normal',{signal:abort.signal,isCurrent:()=>!abort.signal.aborted});await flush();
 const second=speakText('tour second','ta','normal');await flush();expect(fetch).toHaveBeenCalledTimes(1);
 abort.abort();await first;await flush();expect(nodes[0].stop).toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
 nodes[1].onended();await second;
});
it('cancelled pending tour REST audio releases the queue without waiting for old HTTP',async()=>{
 vi.stubEnv('VITE_TTS_STREAM','false');let finish;
 post.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({data:new Blob(['wav']),headers:{}});
 const played=vi.fn();vi.stubGlobal('Audio',class{play(){played();this.onended();return Promise.resolve();}pause(){}});
 const abort=new AbortController(),first=speakText('old tour','en','normal',{signal:abort.signal});await flush();
 abort.abort();const next=speakText('new tour','en','normal');await Promise.all([first,next]);
 expect(played).toHaveBeenCalledTimes(1);finish({data:new Blob(['old']),headers:{}});await flush();expect(played).toHaveBeenCalledTimes(1);
});
