import axios from 'axios';
const api=axios.create({baseURL:import.meta.env.VITE_COPILOT_BASE_URL||'http://localhost:8001',timeout:15000});
let pending;
export const foundationEnabled=()=>import.meta.env.VITE_VOICE_ACTIONS==='true'||import.meta.env.VITE_VOICE_AUDIT==='true'||import.meta.env.VITE_VOICE_AUDIO_LOG==='true';
export function voiceSession(){if(!pending)pending=api.post('/copilot/voice/session',{}, {headers:{'X-Voice-Session':sessionStorage.getItem('kural.voice.session')||''}}).then(r=>{sessionStorage.setItem('kural.voice.session',r.data.session_id);return r.data;}).catch(e=>{pending=null;throw e;});return pending;}
export async function sessionHeaders(){return foundationEnabled()?{'X-Voice-Session':(await voiceSession()).session_id}:{};}
const post=async(path,body)=> (await api.post('/copilot/voice/'+path,body,{headers:await sessionHeaders()})).data;
const get=async path=>(await api.get('/copilot/voice/'+path,{headers:await sessionHeaders()})).data;
export const voiceActionApi={readback:body=>post('readback',body),authorize:body=>post('authorize',body),consume:body=>post('token/consume',body),cancel:()=>post('cancel',{}),audit:async body=>{const s=await voiceSession();return s.audit?post('audit',body):null;},events:()=>get('audit'),verify:()=>get('audit/verify'),audio:()=>get('audio')};
export async function audioPlayback(row){const r=await api.get(`/copilot/voice/audio/${row.date}/${row.event_id}`,{headers:await sessionHeaders(),responseType:'blob'});return URL.createObjectURL(r.data);}
