import {speakText} from '../src/hooks/useSpeak';
import {afterEach,it,expect,vi} from 'vitest';
import {speakableText,pronunciationTerms,pronunciationPassEnabled} from '../src/services/voicePronounce';
const {synthesize}=vi.hoisted(()=>({synthesize:vi.fn(async()=>({blob:new Blob(['wav'])}))}));
vi.mock('../src/services/copilotService',()=>({synthesizeSpeechWithMeta:synthesize}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();synthesize.mockClear();});
it('is off by default',()=>expect(pronunciationPassEnabled()).toBe(false));
it.each(['en','ta','hi'])('all documented term rules: %s',lang=>{
 const i={en:0,ta:1,hi:2}[lang];
 for(const [term,values]of Object.entries(pronunciationTerms))expect(speakableText(term,lang)).toBe(values[i]);
 expect(speakableText('42 MPa, 3.50%, 1200°C, 6 ppm',lang)).not.toMatch(/MPa|%|°C|ppm/);
 expect(speakableText('₹2,400.50',lang)).toBe('2,400.50 '+pronunciationTerms.rupees[i]);
 expect(speakableText('2026-11-07',lang)).not.toBe('2026-11-07');
 expect(speakableText('2026-02-31',lang)).toBe('2026-02-31');
});
it.each([['en','H ten fifty-three'],['ta','எச் ஆயிரத்து ஐம்பத்து மூன்று'],['hi','एच एक हज़ार तिरपन']])('heat ID %s', (lang,value)=>expect(speakableText('H-1053',lang)).toBe(value));
it('does not collide with CO2, units, IDs or unrelated words',()=>{
 expect(speakableText('C CO2 Cu Sn Mn SCu PIG-C C-2 copper MPaValue','en')).toBe('carbon carbon dioxide copper tin manganese SCu PIG-C C-2 copper MPaValue');
});
it.each(['en','ta','hi'])('only the TTS boundary changes, not display: %s',async lang=>{
 vi.stubEnv('VITE_PRONOUNCE_PASS','true');vi.stubEnv('VITE_TTS_STREAM','false');
 vi.stubGlobal('Audio',class{play(){this.onended();return Promise.resolve();}pause(){}});
 const response={displayText:'H-1053: Cu 0.50%, 450 MPa'};
 await speakText(response.displayText,lang);
 expect(synthesize.mock.calls[0][0]).toBe(speakableText(response.displayText,lang));
 expect(response.displayText).toBe('H-1053: Cu 0.50%, 450 MPa');
});
it('preserves reviewed narration under the new flag',async()=>{
 vi.stubEnv('VITE_PRONOUNCE_PASS','true');vi.stubEnv('VITE_TTS_STREAM','false');
 vi.stubGlobal('Audio',class{play(){this.onended();return Promise.resolve();}pause(){}});
 const text='H-1053: C 3.50%';await speakText(text,'en','normal',{pronunciationOnly:true});
 expect(synthesize.mock.calls[0][0]).toBe(text);
});
