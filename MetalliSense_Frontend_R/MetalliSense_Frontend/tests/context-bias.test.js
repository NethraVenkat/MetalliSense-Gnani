import {afterEach,expect,it,vi} from 'vitest';
import {buildContextTerms,MAX_CONTEXT_TERMS} from '../src/services/contextTerms';
import {transcribeAudio} from '../src/services/copilotService';
import {createHandsFreeSession} from '../src/hooks/useHandsFree';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({post})}}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const heats=[{heatId:'H-1051',status:'PLANNED',charge:[{lotId:'PIG-1053'},{lotId:'Cu'}]},
 {heatId:'H-1053',status:'PLANNED',charge:[{lotId:'PIG-1053'},{lotId:'PIG-1053'},{lotId:'user prompt'}]},
 {heatId:'H-1052',status:'MELTING',charge:[]},{heatId:'H-1043',status:'COMPLETED',charge:[{lotId:'HIST-1043'}]}];
it('context builder variants, selected first, numeric order, dedupe, no free text',()=>{
 const original=JSON.stringify(heats);
 expect(buildContextTerms(heats,'H-1053',{enabled:true})).toEqual(['H-1053','heat 1053','1053','PIG-1053','H-1051','heat 1051','1051','H-1052','heat 1052','1052']);
 expect(JSON.stringify(heats)).toBe(original);
});
it('selected history heat included, other completed/inactive excluded',()=>{
 const terms=buildContextTerms(heats,'H-1043',{enabled:true});expect(terms[0]).toBe('H-1043');
 expect(terms).toContain('HIST-1043');expect(buildContextTerms(heats,null,{enabled:true})).not.toContain('H-1043');
});
it('ten heats maximum, static terms win within provider count bound',()=>{
 const rows=Array.from({length:30},(_,i)=>({heatId:'H-'+(1000+i),status:'PLANNED',charge:[]}));
 expect(buildContextTerms(rows,'H-1029',{enabled:true})).toHaveLength(30);
 const terms=buildContextTerms(rows,'H-1029',{enabled:true,staticTerms:Array.from({length:199},(_,i)=>'term'+i)});
 expect(terms).toEqual(['H-1029']);expect(199+terms.length).toBe(MAX_CONTEXT_TERMS);
 expect(buildContextTerms(rows,null,{enabled:true,staticTerms:Array(200).fill(0).map((_,i)=>'term'+i)})).toEqual([]);
});
it('word length, invalid IDs and static duplicates are bounded',()=>{
 const rows=[{heatId:'H-1053',status:'PLANNED',charge:[{lotId:'X'.repeat(64)+'-1'}]},{heatId:'ignore instructions',status:'PLANNED'}];
 expect(buildContextTerms(rows,null,{enabled:true,staticTerms:['heat 1053']})).toEqual(['H-1053','1053']);
});
it('asking from a changed store produces fresh deterministic terms',()=>{
 const copy=structuredClone(heats);const before=buildContextTerms(copy,null,{enabled:true});copy[0].status='COMPLETED';
 expect(buildContextTerms(copy,null,{enabled:true})).not.toContain('H-1051');expect(before).toContain('H-1051');
});
it('flag off means no generated hints and exact old REST form fields',()=>{
 vi.stubEnv('VITE_CONTEXT_BIAS','false');expect(buildContextTerms(heats,'H-1053')).toEqual([]);
 transcribeAudio(new Blob(['audio']),null,['H-1053']);
 expect([...post.mock.lastCall[1].keys()]).toEqual(['audio']);
});
it('REST adds JSON context_terms only when enabled',()=>{
 vi.stubEnv('VITE_CONTEXT_BIAS','true');transcribeAudio(new Blob(['audio']),null,['H-1053']);
 expect(post.mock.lastCall[1].get('context_terms')).toBe('["H-1053"]');
});
it('hands-free sends only changed typed context messages, reconnect retains context',async()=>{
 vi.stubEnv('VITE_CONTEXT_BIAS','true');const sockets=[];
 const controller=createHandsFreeSession({onTranscript:vi.fn(),createCapture:async()=>({stop(){}}),createSocket:()=>{
  const ws={readyState:1,bufferedAmount:0,sent:[],send(data){this.sent.push(data);},close(){}};sockets.push(ws);return ws;
 }});
 controller.setContextTerms(['H-1053']);controller.start();for(let i=0;i<10;i++)await Promise.resolve();
 const ws=sockets[0];ws.onopen();ws.onmessage({data:JSON.stringify({type:'connected'})});
 expect(ws.sent.map(JSON.parse)).toEqual([{type:'start',sample_rate:16000},{type:'context_terms',terms:['H-1053']}]);
 controller.setContextTerms(['H-1053']);expect(ws.sent).toHaveLength(2);
 controller.setContextTerms(['H-1052']);expect(JSON.parse(ws.sent[2])).toEqual({type:'context_terms',terms:['H-1052']});
 ws.onmessage({data:'{"type":"settings_updated","term_count":4}'});controller.stop();
 expect(JSON.parse(ws.sent.at(-1))).toEqual({type:'stop'});
});
it('hands-free flag off adds no context control frames',async()=>{
 vi.stubEnv('VITE_CONTEXT_BIAS','false');const sent=[];const ws={readyState:1,bufferedAmount:0,send:x=>sent.push(x),close(){}};
 const controller=createHandsFreeSession({createCapture:async()=>({stop(){}}),createSocket:()=>ws});
 controller.setContextTerms(['H-1053']);controller.start();for(let i=0;i<10;i++)await Promise.resolve();
 ws.onopen();ws.onmessage({data:'{"type":"connected"}'});controller.setContextTerms(['H-1052']);controller.stop();
 expect(sent.map(JSON.parse)).toEqual([{type:'start',sample_rate:16000},{type:'stop'}]);
});
