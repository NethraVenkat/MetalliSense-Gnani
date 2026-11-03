import React from 'react';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import VoiceLogViewer from '../src/components/voice/VoiceLogViewer';
import {groupVoiceLog,localLogDate,localLogTime,auditDays,transcriptSnippet} from '../src/services/voiceLogView';
const day='2026-11-03',sid='fixture-session';
function row(seq,seconds,intent='audio-capture',event_id){return {seq,ts:`${day}T12:00:${String(seconds).padStart(2,'0')}Z`,session_id:sid,intent,event_id,decision:'executed'};}
const clip=(event_id,purpose)=>({event_id,purpose,date:day,duration:1.5});
it('groups action/capture rows with exact inline audio links; newest first and no passcode',()=>{
 const rows=[row(1,0,'audio-capture','wake1'),row(2,2,'audio-capture','cmd1'),row(3,8,'audio-capture','reply'),{...row(4,9,'test-action'),page:'/stock',summary:'Test action',transcript:'test action 123456',decision:'timeout'},row(5,20,'audio-capture','wake2'),row(6,22,'audio-capture','secret')];
 const groups=groupVoiceLog(rows,[clip('wake1','wake'),clip('cmd1','command'),clip('reply','command'),clip('wake2','wake'),clip('secret','passcode')],day);
 expect(groups).toHaveLength(2);expect(groups[0].clips.map(c=>c.event_id)).toEqual(['wake2']);expect(groups[1]).toMatchObject({intent:'test-action',decision:'timeout',page:'/stock',transcript:'test action ••••••'});expect(groups[1].clips.map(c=>c.event_id)).toEqual(['wake1','cmd1','reply']);expect(groups.every(g=>g.intent!=='audio-capture')).toBe(true);
});
it('does not join other sessions, completed turns or remote-in-time captures; mask challenge text',()=>{
 const events=[row(1,0,'audio-capture','a'),{...row(2,1,'test-action'),confirmation:'passcode',transcript:'secret'},row(3,2,'audio-capture','b'),{...row(4,3,'test-action'),session_id:'other'}];
 const groups=groupVoiceLog(events,[clip('a','command'),clip('b','command')],day);expect(groups).toHaveLength(3);expect(groups.find(g=>g.clips.some(c=>c.event_id==='a')).transcript).toBe('••••••');expect(transcriptSnippet({transcript:'H-1053 12%'})).not.toMatch(/1053|12/);
});
it('uses India local date/time and loads both intersecting UTC days',()=>{
 expect(localLogDate('2026-11-02T20:00:00Z')).toBe(day);expect(localLogTime('2026-11-02T20:00:00Z')).toBe('01:30:00');expect(auditDays(day)).toEqual(['2026-11-02',day]);
 expect(groupVoiceLog([{...row(1,0,'test-action'),ts:'2026-11-02T20:00:00Z'}],[],day)).toHaveLength(1);expect(groupVoiceLog([row(1,0,'test-action')],[],'2026-11-02')).toHaveLength(0);
});
it('viewer has a local-today date picker, inline chain result, and accessible close',()=>{
 const html=renderToStaticMarkup(<VoiceLogViewer onClose={()=>{}}/>);expect(html).toContain('value="'+localLogDate()+'"');expect(html).toContain('Voice log date');expect(html).toContain('Verify chain');expect(html).toContain('role="status"');expect(html).toContain('Close voice log');
});
it('Chromium groups audio inline, verifies chains, changes date and fits narrow width',async()=>{
 const {createServer}=await import('vite'),{chromium}=await import('@playwright/test');let server,browser;
 try{
  server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0},mode:'mock'});await server.listen();const base=server.resolvedUrls.local[0];browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:360,height:800}});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base+'tests/fixtures/voice-log.html');await page.locator('.voice-log-turn').waitFor();expect(await page.locator('.voice-log-turn').count()).toBe(1);expect(await page.locator('.voice-log-turn').innerText()).toContain('15:30:08');expect(await page.getByText('audio-capture',{exact:true}).count()).toBe(0);expect(await page.getByRole('button',{name:'▶ passcode'}).count()).toBe(0);
  await page.getByRole('button',{name:'▶ wake',exact:true}).click();expect(await page.evaluate(()=>window.playedClip.purpose)).toBe('wake');await page.getByRole('button',{name:'Verify chain'}).click();await page.getByText('Chain OK · 3 events',{exact:true}).waitFor();await page.evaluate(()=>window.logBroken=true);await page.getByRole('button',{name:'Verify chain'}).click();await page.getByText('Broken at #2',{exact:true}).waitFor();const bounds=await page.getByRole('dialog').boundingBox();expect(bounds.x+bounds.width).toBeLessThanOrEqual(360);
  await page.getByLabel('Voice log date').fill('2026-10-30');await page.getByText('No interactions for this date.',{exact:true}).waitFor();expect(await page.evaluate(()=>window.logCalls.some(c=>c[0]==='events'&&c[1]==='2026-10-29'))).toBe(true);expect(await page.getByRole('status').textContent()).toBe('');await page.getByRole('button',{name:'Close voice log'}).click();expect(await page.evaluate(()=>window.closedLog)).toBe(true);
 }finally{await browser?.close();if(server){server.httpServer?.closeAllConnections();await server.close();}}
},90000);
