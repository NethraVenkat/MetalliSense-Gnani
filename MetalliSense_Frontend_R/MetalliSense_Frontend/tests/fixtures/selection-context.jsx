import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {MemoryRouter} from 'react-router-dom';
import {VoicePageProvider,useVoicePage,useRegisterVoicePage} from '../../src/context/VoicePageContext';
function Selection(){
 const [prId,setPrId]=useState('PR-1'),[tab,setTab]=useState('invoice');
 useRegisterVoicePage({prId,heatId:'H-1'},'selection regression',{prs:[{prId:'PR-1'},{prId:'PR-2'}],heats:[{heatId:'H-1'}],trainingData:[{_id:'5'}]});
 const context=useVoicePage();
 return <><main>
  <select aria-label="Selected PR" value={prId} onChange={event=>setPrId(event.target.value)}><option>PR-1</option><option>PR-2</option></select>
  <select aria-label="Page size"><option value="50">50</option></select>
  <table><tbody>{['PR-1','PR-2','H-1'].map(id=><tr key={id} data-voice-row-id={id} data-voice-row-key={id.startsWith('PR')?'prId':'heatId'}><td><button data-voice-row-id={id} data-voice-row-key={id.startsWith('PR')?'prId':'heatId'} onClick={()=>{if(id.startsWith('PR'))setPrId(id);}}>{id}</button></td></tr>)}</tbody></table>
  <button onClick={()=>context.controls({id:'select_row',target:'PR-1'})}>Voice select first PR</button>
  <button onClick={()=>context.controls({id:'next_row'})}>Voice next row</button>
  <button onClick={()=>context.controls({id:'open_tab',target:'சான்றிதழ்',lang:'ta'})}>Voice certificate tab</button>
  <output data-focused-field={Object.keys(context.focusedRow||{})[0]}>{context.selected.prId}</output>
 </main>{createPortal(<div role="dialog"><button role="tab" data-voice-tab="invoice" onClick={()=>setTab('invoice')}>Invoice</button><button role="tab" data-voice-tab="certificate" onClick={()=>setTab('certificate')}>Certificate</button><p data-testid="active-tab">{tab}</p></div>,document.body)}</>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/inventory-forecast']}><VoicePageProvider><Selection/></VoicePageProvider></MemoryRouter>);
