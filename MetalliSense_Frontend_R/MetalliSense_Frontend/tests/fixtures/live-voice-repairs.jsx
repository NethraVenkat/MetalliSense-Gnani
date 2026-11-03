import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {VoicePageProvider,useVoicePage} from '../../src/context/VoicePageContext';
import {OPCContext} from '../../src/context/OPCContext';
import Spectrometer from '../../src/pages/Spectrometer';
import PushToTalk from '../../src/components/voice/PushToTalk';
import KuralWakePanel from '../../src/components/voice/KuralWakePanel';
import '../../src/index.css';
function Snapshot(){const page=useVoicePage();return <pre data-testid="snapshot">{JSON.stringify(page)}</pre>;}
function Fixture(){
 const [preview,setPreview]=useState({wake:{enabled:true,state:'Waiting',speaking:true},playingAnswer:{displayText:'H-1053: HOLD. C 0.50%.',spokenText:'Heat one zero five three hold carbon zero point five percent.'},playbackProgress:0});window.setRepairPreview=setPreview;
 return location.search.includes('visual')?<main><KuralWakePanel {...preview}/></main>:<MemoryRouter initialEntries={['/spectrometer']}><VoicePageProvider><OPCContext.Provider value={{opcStatus:{connected:true}}}><main><PushToTalk shared/><Spectrometer/><Snapshot/></main></OPCContext.Provider></VoicePageProvider></MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
