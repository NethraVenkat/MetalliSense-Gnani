import React,{useEffect,useRef,useState} from 'react';
import {voiceActionApi,audioPlayback} from '../../services/voiceActionApi';
import {auditDays,groupVoiceLog,localLogDate,localLogTime} from '../../services/voiceLogView';
import './VoiceLogViewer.css';
export default function VoiceLogViewer({onClose,api=voiceActionApi,play=audioPlayback}){
 const [date,setDate]=useState(()=>localLogDate()),[groups,setGroups]=useState([]),[status,setStatus]=useState('Loading…'),[chain,setChain]=useState(''),[url,setUrl]=useState(null);
 const revision=useRef(0),verifyRevision=useRef(0);
 useEffect(()=>{let live=true;setGroups([]);setStatus('Loading…');setChain('');setUrl(null);
  revision.current++;verifyRevision.current++;Promise.all(auditDays(date).map(async day=>{const [e,a]=await Promise.all([api.events(day),api.audio(day).catch(error=>{if(error.response?.status===404)return {audio:[]};throw error;})]);return {events:e.events.map(r=>({...r,date:day})),audio:a.audio};})).then(days=>{if(live){setGroups(groupVoiceLog(days.flatMap(d=>d.events),days.flatMap(d=>d.audio),date));setStatus('Client-reported outcomes. Legacy captures grouped by session/order (not verified turn IDs).');}}).catch(()=>{if(live)setStatus('Log unavailable');});return()=>{live=false;revision.current++;verifyRevision.current++;};
 },[date,api]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 async function verify(){const ticket=++verifyRevision.current;setChain('Checking…');try{const results=await Promise.all(auditDays(date).map(day=>api.verify(day)));if(ticket!==verifyRevision.current)return;const broken=results.find(r=>!r.ok);setChain(broken?`Broken at #${broken.first_broken_seq}`:`Chain OK · ${results.reduce((n,r)=>n+(r.count||0),0)} events`);}catch{if(ticket===verifyRevision.current)setChain('Verification unavailable');}}
 async function playClip(clip){const ticket=revision.current;try{const next=await play(clip);if(ticket!==revision.current){URL.revokeObjectURL(next);return;}setUrl(next);}catch{if(ticket===revision.current)setStatus('Audio unavailable');}}
 return <section className="voice-log-viewer" role="dialog" aria-label="Voice log">
  <header><strong>Voice log</strong><button onClick={onClose} aria-label="Close voice log">Close</button></header>
  <div className="voice-log-tools"><label>Date <input type="date" aria-label="Voice log date" value={date} max={localLogDate()} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label><button onClick={verify}>Verify chain</button><span role="status">{chain}</span></div>
  <small>Asia/Calcutta · newest first · verification covers both UTC daily chains intersecting this local date.</small><p className="voice-log-note">{status}</p>
  {groups.map(row=><article className="voice-log-turn" key={row.id}>
   <div className="voice-log-heading"><time dateTime={row.ts}>{localLogTime(row.ts)}</time><span>{row.page||'Page not recorded'}</span><span className={`voice-log-decision voice-log-${row.decision||'recorded'}`}>{row.decision||'Audio only'}</span></div>
   <strong>{row.intent}</strong>{row.summary&&<p>{row.summary}</p>}{row.transcript&&<p className="voice-log-transcript">{row.transcript}</p>}
   <div className="voice-log-clips">{row.clips.map(clip=><button key={clip.event_id} title={`${clip.duration}s · ${clip.event_id}`} onClick={()=>void playClip(clip)}>▶ {clip.purpose}</button>)}</div>
  </article>)}
  {!groups.length&&status!=='Loading…'&&<p>No interactions for this date.</p>}{url&&<audio controls autoPlay src={url} aria-label="Voice clip playback"/>}
 </section>;
}
