import {drawOrb} from '../../src/components/voice/kuralOrbCanvas';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import KuralWakePanel from '../../src/components/voice/KuralWakePanel';
import PushToTalk,{TransliterationToggle} from '../../src/components/voice/PushToTalk';
import {Mic,Volume2} from 'lucide-react';
import TopBar from '../../src/components/layout/TopBar';
import Sidebar from '../../src/components/layout/Sidebar';
import '../../src/index.css';
function Review(){const [visual,setVisual]=useState({wake:{enabled:false,state:'Off'},lang:'en'}),[collapsed,setCollapsed]=useState(false);window.setOrbPreview=setVisual;window.renderOrbFrameForReview=({s,width,dark,card})=>{const c=document.createElement('canvas');c.width=width;c.height=width;drawOrb({c,x:c.getContext('2d'),s,dark},0,0,{card,reduced:true});return c.toDataURL();};window.fixtureTalk=0;
 const controls=<><div className="flex flex-wrap"><button onPointerDown={()=>{}} aria-label="Hold to talk"><Mic size={18}/>Hold to talk</button><select aria-label="Voice language"><option>English</option></select><TransliterationToggle enabled={false} onChange={()=>{}}/><button title="Mute spoken replies" aria-label="Mute voice"><Volume2 size={18}/></button></div><details><summary>Demo transcripts</summary>Mock examples</details></>;
 return <MemoryRouter><div className="flex h-screen"><Sidebar setRunTour={()=>{}}/><div className={`flex-1 min-w-0 md:ml-72`}><TopBar title="Dashboard"/><main style={{padding:20}}>Synthetic states only. No microphone, detector or provider.{location.search.includes('visual')?<KuralWakePanel {...visual} menuControls={{lang:visual.lang,onLanguageChange:lang=>setVisual(v=>({...v,lang})),languageOptions:['ta','hi','en'],muted:visual.muted,onToggleMute:()=>setVisual(v=>({...v,muted:!v.muted})),showLatin:visual.showLatin,latinAvailable:true,onLatinChange:showLatin=>setVisual(v=>({...v,showLatin}))}} onToggle={()=>{}} onClose={()=>setVisual({wake:{enabled:false,state:'Off'},lang:visual.lang})} onTalkToggle={()=>{window.fixtureTalk++;}}>{controls}</KuralWakePanel>:<PushToTalk shared heatId="H-1053" tour={{visible:true,isActive:()=>false,control:()=>false}}/>}</main></div></div></MemoryRouter>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><Review/></React.StrictMode>);
