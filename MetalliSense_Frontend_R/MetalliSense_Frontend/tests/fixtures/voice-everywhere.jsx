import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,Link,useLocation} from 'react-router-dom';
import MainLayout from '../../src/components/layout/MainLayout';
import PushToTalk from '../../src/components/voice/PushToTalk';
import {useRegisterVoicePage,useVoicePage} from '../../src/context/VoicePageContext';
import {voicePages} from '../../src/services/voicePages';
import {holdAnnouncer} from '../../src/services/voiceGateAnswers';
import {speakText} from '../../src/hooks/useSpeak';
function Snapshot(){const context=useVoicePage();return <pre data-testid="context">{JSON.stringify(context||null)}</pre>;}
function Content(){
  const {pathname}=useLocation();
  useRegisterVoicePage(pathname==='/premelt-gate'?{heatId:'H-1053',grade:'SG-IRON'}:{},'fixture screen');
  useEffect(()=>{if(pathname==='/premelt-gate')holdAnnouncer.observe('H-1053',{decision:'HOLD'});},[pathname]);
  return <><h1 data-testid="route">{pathname}</h1><Snapshot/>
    {pathname==='/premelt-gate'&&import.meta.env.VITE_HANDOVER==='true'&&<section aria-label="Shift handover">Sample handover card</section>}
    {pathname==='/premelt-gate'&&<><button onClick={()=>holdAnnouncer.checkResult('H-1053',{gateId:'fixture-go',decision:'GO'},speakText,'en')}>Fixture GO check</button><button onClick={()=>holdAnnouncer.checkResult('H-1053',{gateId:'fixture-hold',decision:'HOLD',checks:[]},speakText,'en')}>Fixture HOLD check</button></>}
    {['/dashboard','/spectrometer','/premelt-gate'].includes(pathname)&&<PushToTalk heatId={pathname==='/premelt-gate'?'H-1053':undefined}/>}
    <div data-testid="chat-panel"><PushToTalk/></div>
  </>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter><nav>{voicePages.map(page=><Link key={page.route} to={page.route}>{page.route}</Link>)}<Link to="/login">/login</Link></nav><Routes><Route element={<MainLayout/>}>{voicePages.map(page=><Route key={page.route} path={page.route} element={<Content/>}/>)}</Route><Route path="/login" element={<p>Login</p>}/></Routes></MemoryRouter>);
