import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import useLiveWords from '../../src/hooks/useLiveWords';
import LiveWordsSlot from '../../src/components/voice/LiveWordsSlot';
function Probe(){const [props,setProps]=useState({lang:'ta',active:false,transcript:'',blocked:false});window.updateLiveWords=patch=>setProps(old=>({...old,...patch}));const value=useLiveWords(props);return <LiveWordsSlot value={value} reduced/>;}
createRoot(document.getElementById('root')).render(<Probe/>);
