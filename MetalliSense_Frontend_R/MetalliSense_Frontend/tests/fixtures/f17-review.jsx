import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import KuralWakePanel from '../../src/components/voice/KuralWakePanel';
function Review(){const [action,setAction]=useState(null);window.setF17Review=setAction;return <KuralWakePanel wake={{enabled:true,state:'Waiting',level:0}} level={.45} lang="en" panelState="idle" actionState={action} onClose={()=>setAction(null)} onActionCancel={()=>setAction({phase:'cancelled',level:'APPROVE',result:'Cancelled'})}/>;}
createRoot(document.getElementById('root')).render(<Review/>);
