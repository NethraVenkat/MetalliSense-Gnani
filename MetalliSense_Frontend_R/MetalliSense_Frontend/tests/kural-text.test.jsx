import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import KuralWords,{leadingWake,displayParts,spokenWordPhase,tidyTaggedPunctuation} from '../src/components/voice/KuralWords';
import KuralControlsMenu from '../src/components/voice/KuralControlsMenu';
import {observeSpeechPresentation,readElementProgress,speechPresentationSnapshot} from '../src/services/speechPresentation';
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
it('Listening renders only supplied text, canonical leading wake tag, newest word and caret',()=>{
 expect(renderToStaticMarkup(<KuralWords text=""/>)).toBe('');
 for(const text of ['Kural, carbon எவ்வளவு?','குரல், carbon எவ்வளவு?','कुरल, carbon कितना?']){
  expect(leadingWake(text).wake).toBe(true);const html=renderToStaticMarkup(<KuralWords text={text}/>);expect(html).toContain('kural-wake-tag');expect(html).toContain('>Kural</span>');expect(html).toContain('kural-word--newest');expect(html).toContain('kural-caret');
 }
 expect(leadingWake('குரங்கு carbon').wake).toBe(false);expect(leadingWake('Kurality carbon').wake).toBe(false);
 const first=renderToStaticMarkup(<KuralWords text="Kural carbon"/>),next=renderToStaticMarkup(<KuralWords text="Kural carbon amount"/>);expect(first).not.toContain('amount');expect(next).toContain('amount');
});
it('Speaking phases follow measured progress; muted/reduced text is complete immediately',()=>{
 expect([0,1,2,3].map(i=>spokenWordPhase(i,4,.5))).toEqual(['done','done','current','future']);
 expect(spokenWordPhase(3,4,1)).toBe('done');expect(spokenWordPhase(3,4,0,true)).toBe('done');
 const half=renderToStaticMarkup(<KuralWords text="one two three four" mode="speaking" progress={.5}/>);expect(half.match(/kural-word--done/g)).toHaveLength(2);expect(half).toContain('kural-word--current');expect(half).toContain('kural-word--future');
 for(const props of [{muted:true},{reduced:true}]){const html=renderToStaticMarkup(<KuralWords text="one two three four" mode="speaking" progress={0} {...props}/>);expect(html.match(/kural-word--done/g)).toHaveLength(4);expect(html).not.toContain('kural-word--future');}
 const reduced=renderToStaticMarkup(<KuralWords text="real words" reduced/>);expect(reduced).not.toContain('kural-caret');expect(reduced).not.toContain('kural-word--newest');
});
it('display-only ID, gate and percent tags preserve input and unrelated words',()=>{
 const text='Heat H-1053, lot PIG-1053: HOLD WARN GO C 3.46% GOING';const original=text;
 const html=renderToStaticMarkup(<KuralWords text={text} mode="speaking" muted/>);for(const kind of ['id','hold','warn','go','percent'])expect(html).toContain('kural-tag-'+kind);expect(displayParts('GOING')).toEqual([{text:'GOING',kind:'plain'}]);expect(displayParts('H-1053,')[0]).toEqual({text:'H-1053',kind:'id'});expect(text).toBe(original);
});
it('read-only playback observer reads actual position, survives unavailable duration and cleans up',()=>{
 vi.useFakeTimers();const audio={duration:10,currentTime:0,play:vi.fn(),pause:vi.fn()};const stop=observeSpeechPresentation(()=>readElementProgress(audio));expect(speechPresentationSnapshot()).toEqual({active:true,progress:0});audio.currentTime=5;vi.advanceTimersByTime(80);expect(speechPresentationSnapshot().progress).toBe(.5);audio.currentTime=8;vi.advanceTimersByTime(80);expect(speechPresentationSnapshot().progress).toBe(.8);audio.duration=NaN;vi.advanceTimersByTime(80);expect(speechPresentationSnapshot().progress).toBeNull();stop();stop();expect(vi.getTimerCount()).toBe(0);expect(speechPresentationSnapshot().active).toBe(false);expect(audio.play).not.toHaveBeenCalled();expect(audio.pause).not.toHaveBeenCalled();
 const bad=observeSpeechPresentation(()=>{throw Error('read unavailable');});expect(speechPresentationSnapshot().progress).toBeNull();bad();
});
it('menu has four rows, inverse mute switch, privacy description, PTT and no production demos',()=>{
 const source=readFileSync('src/components/voice/KuralControlsMenu.jsx','utf8');expect(source).toContain('import.meta.env.DEV&&demo');
 const controls={lang:'ta',languageOptions:['ta','hi','en'],muted:true,latinAvailable:true};const children=<><div className="flex flex-wrap"><button onPointerDown={()=>{}}>Legacy talk</button></div><details><summary>Demo transcripts</summary></details></>;
 const html=renderToStaticMarkup(<KuralControlsMenu wake={{enabled:false}} controls={controls}>{children}</KuralControlsMenu>);expect(html.match(/class="kural-menu-row"/g)).toHaveLength(4);expect(html).toContain('Hold to talk');expect(html).toContain('Hands-free');expect(html).toContain('Say “Kural” to start');expect(html).toContain('aria-label="Voice replies" aria-checked="false"');expect(html).toContain('aria-label="EN"');expect(html).toContain('kural-hf-description');expect(import.meta.env.DEV).toBe(true);expect(html).toContain('Demo transcripts');
});
it('only six scoped font imports, selected weights and bundled license notices',()=>{
 const source=readFileSync('src/components/voice/KuralWakePanel.jsx','utf8'),fonts=source.match(/import '@fontsource[^']+'/g);expect(fonts).toHaveLength(6);for(const item of fonts)expect(item).toMatch(/-(500|600)\.css/);
 const css=readFileSync('src/components/voice/KuralWakePanel.css','utf8');expect(css).toContain('"Plus Jakarta Sans","Noto Sans Tamil","Noto Sans Devanagari",system-ui,sans-serif');
 for(const family of ['plus-jakarta-sans','noto-sans-tamil','noto-sans-devanagari'])expect(readFileSync('public/licenses/kural-fonts/'+family+'-OFL.txt','utf8')).toContain('SIL OPEN FONT LICENSE');
});

it('tag punctuation stays attached in Listening and Speaking without changing speech input',()=>{
 const text='H-1053 : HOLD . PIG-1053 , WARN ! GO ?';
 expect(tidyTaggedPunctuation(text)).toBe('H-1053: HOLD. PIG-1053, WARN! GO?');
 for(const mode of ['listening','speaking']){const html=renderToStaticMarkup(<KuralWords text={text} mode={mode} reduced/>);expect(html).toContain('kural-tag-before-punctuation');expect(html.replace(/<[^>]+>/g,'')).toBe('H-1053: HOLD. PIG-1053, WARN! GO?');}
 expect(text).toBe('H-1053 : HOLD . PIG-1053 , WARN ! GO ?');
});
it('polished muted status and menu typography retain selected chip contrast',()=>{
 const source=readFileSync('src/components/voice/KuralWakePanel.jsx','utf8');expect(source).toContain("['MUTED','Answer on screen']");
 const css=readFileSync('src/components/voice/KuralWakePanel.css','utf8');expect(css).toContain('font-size:12px;color:#5b7e6a');expect(css).toContain('color:#739080;font-size:13px');expect(css).toContain('background:#fff;color:#0e8a55;box-shadow:');
});
