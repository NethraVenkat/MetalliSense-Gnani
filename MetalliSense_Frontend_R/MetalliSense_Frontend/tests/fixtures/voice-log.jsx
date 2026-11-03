import React from 'react';
import {createRoot} from 'react-dom/client';
import VoiceLogViewer from '../../src/components/voice/VoiceLogViewer';
import {localLogDate} from '../../src/services/voiceLogView';
const date=localLogDate();window.logCalls=[];window.logBroken=false;
const api={events:async day=>{window.logCalls.push(['events',day]);return {events:day===date?[{seq:1,ts:day+'T10:00:00Z',session_id:'mock',intent:'audio-capture',event_id:'fixture-wake'},{seq:2,ts:day+'T10:00:02Z',session_id:'mock',intent:'audio-capture',event_id:'fixture-command'},{seq:3,ts:day+'T10:00:08Z',session_id:'mock',page:'/stock',intent:'test-action',summary:'No reply — action not done.',decision:'timeout',transcript:'test action'}]:[]};},audio:async day=>({audio:day===date?['wake','command','passcode'].map(purpose=>({date,event_id:'fixture-'+purpose,purpose,duration:1.5})):[]}),verify:async day=>{window.logCalls.push(['verify',day]);return window.logBroken?{ok:false,first_broken_seq:2}:{ok:true,count:day===date?3:0};}};
createRoot(document.getElementById('root')).render(<VoiceLogViewer api={api} play={async clip=>{window.playedClip=clip;return URL.createObjectURL(new Blob([],{type:'audio/wav'}));}} onClose={()=>window.closedLog=true}/>);
