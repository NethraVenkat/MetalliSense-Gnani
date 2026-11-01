import {it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import clips from '../src/assets/approvedTourTamil.json';
import {approvedTourAsset,playApprovedTourAsset} from '../src/services/approvedTourAudio';
import {voiceTourSteps,tourStepText,createVoiceTour} from '../src/services/voiceTour';
const {synthesis}=vi.hoisted(()=>({synthesis:vi.fn()}));
vi.mock('../src/services/copilotService',()=>({synthesizeSpeechWithMeta:synthesis}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();});
it('packages all 22 exact sources including revised Mechanical Properties',()=>{
 expect(clips.map(c=>c.id)).toEqual(voiceTourSteps(true).map(s=>s.id));
 for(const clip of clips){
  const bytes=fs.readFileSync(new URL('../public/audio/kural-tour-ta-v1/'+clip.file,import.meta.url));
  expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(clip.sha256);
  expect(bytes.subarray(8,12).toString()).toBe('WAVE');
 }
 const mechanical=clips.find(c=>c.id==='mechanical-properties');
 expect(mechanical.sha256).toBe('75e456ee62eca9615f9acaef440dd35e783c1de3382bcbd13eb8dd32fcd3f17a');
 expect(mechanical.durationSeconds).toBe(11.04);
 expect(mechanical.spokenText).toContain('composition data');
});
it('selects Tamil only and preserves flag-off captions',()=>{
 const step=voiceTourSteps(true)[0];
 expect(approvedTourAsset(step.id,'ta')).toBeUndefined();
 expect(tourStepText(step,'ta')).toBe(step.texts.ta);
 vi.stubEnv('VITE_VOICE_TOUR_APPROVED_TAMIL','true');
 expect(tourStepText(step,'ta')).toBe(clips[0].spokenText);
 expect(approvedTourAsset(step.id,'ta').url).toContain('audio/kural-tour-ta-v1/dashboard.wav');
 for(const lang of ['hi','en']){expect(approvedTourAsset(step.id,lang)).toBeUndefined();expect(tourStepText(step,lang)).toBe(step.texts[lang]);}
});
function fakeAudio(){const instances=[];class Audio{constructor(url){this.url=url;instances.push(this);}play=vi.fn(()=>{this.onplaying?.();return Promise.resolve();});pause=vi.fn();removeAttribute=vi.fn();load=vi.fn();}return {Audio,instances};}
it('shares queue, pauses actual audio, waits for ended, cancels and never synthesizes',async()=>{
 const {Audio,instances}=fakeAudio();vi.stubGlobal('Audio',Audio);
 const {speakText}=await import('../src/hooks/useSpeak');
 const abort=new AbortController();let handle;
 const ended=vi.fn();
 const promise=speakText('approved','ta','normal',{approvedAsset:{url:'/local.wav'},signal:abort.signal,onPlaybackReady:h=>handle=h}).then(ended);
 await vi.waitFor(()=>expect(instances).toHaveLength(1));
 expect(ended).not.toHaveBeenCalled();handle.pause();expect(instances[0].pause).toHaveBeenCalled();handle.resume();expect(instances[0].play).toHaveBeenCalledTimes(2);
 abort.abort();await promise;expect(synthesis).not.toHaveBeenCalled();
});
it('asset failure and missing mappings never invoke synthesis',async()=>{
 const {Audio,instances}=fakeAudio();vi.stubGlobal('Audio',Audio);
 const {speakText}=await import('../src/hooks/useSpeak');const failed=vi.fn();
 const p=speakText('approved','ta','normal',{approvedAsset:{url:'/bad.wav'},onUnavailable:failed});
 await vi.waitFor(()=>expect(instances).toHaveLength(1));instances[0].onerror();await p;
 await speakText('approved','ta','normal',{approvedAsset:{url:null},onUnavailable:failed});
 expect(failed).toHaveBeenCalledTimes(2);expect(synthesis).not.toHaveBeenCalled();
});
it('controller preserves pause position and exploration blocks ended advancement',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_VOICE_TOUR_APPROVED_TAMIL','true');
 const {Audio,instances}=fakeAudio();
 const tour=createVoiceTour({enabled:()=>true,steps:voiceTourSteps(true),location:{route:'/dashboard',scope:'d'},navigate:vi.fn(),speak:(_,__,___,timing)=>playApprovedTourAsset(timing.approvedAsset,timing,Audio)});
 tour.control('start','ta');expect(instances).toHaveLength(0);tour.control('target-ready');
 tour.control('pause');tour.control('resume');expect(instances).toHaveLength(1);expect(instances[0].play).toHaveBeenCalledTimes(2);
 tour.control('user-scroll');instances[0].onended();await vi.advanceTimersByTimeAsync(0);expect(tour.snapshot().index).toBe(0);
 tour.control('resume-autoplay');await vi.advanceTimersByTimeAsync(0);expect(tour.snapshot().index).toBe(1);tour.stop();
});
it('late events after cancellation cannot start or advance old audio',async()=>{
 const {Audio,instances}=fakeAudio();const abort=new AbortController();const start=vi.fn();
 const p=playApprovedTourAsset({url:'/asset.wav'},{signal:abort.signal,onAudioStart:start},Audio);
 const late=instances[0].onended;abort.abort();late();await p;expect(instances[0].onplaying).toBeNull();
});
it('rapid selection, language changes and close abort prior approved sessions',async()=>{
 vi.stubEnv('VITE_VOICE_TOUR_APPROVED_TAMIL','true');
 const calls=[];
 const tour=createVoiceTour({enabled:()=>true,steps:voiceTourSteps(true).map(s=>({...s,route:null})),location:{scope:'same'},navigate:vi.fn(),speak:(text,lang,style,timing)=>new Promise(resolve=>calls.push({text,lang,timing,resolve}))});
 tour.control('start','ta');tour.control('next');tour.control('back');tour.control('select-step',14);
 expect(calls.slice(0,-1).every(c=>c.timing.signal.aborted)).toBe(true);
 expect(calls.at(-1).timing.approvedAsset.url).toContain('mechanical-properties.wav');
 const stale=calls[0];stale.timing.onAudioStart();stale.resolve();await Promise.resolve();
 expect(tour.snapshot().index).toBe(14);
 tour.control('language','hi');expect(calls.at(-2).timing.signal.aborted).toBe(true);
 expect(calls.at(-1).timing.approvedAsset).toBeUndefined();
 tour.control('language','ta');expect(calls.at(-1).lang).toBe('ta');
 tour.stop();expect(calls.every(c=>c.timing.signal.aborted)).toBe(true);
});
