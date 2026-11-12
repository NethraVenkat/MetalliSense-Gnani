import {wakeWordEnabled} from '../services/wakeWord';
import React, {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {createPageControls,markVoiceRows} from '../services/voicePageControls';
import {voiceEverywhereEnabled,voicePage} from '../services/voicePages';

const VoicePageContext=createContext(null);
export const useVoicePage=()=>useContext(VoicePageContext);
export function VoicePageProvider({children}) {
  const location=useLocation();
  const navigate=useNavigate();const [rowSelection,setRowSelection]=useState({scope:null,selected:{}});const latest=useRef(null);
  const scope=`${location.key}:${location.pathname}${location.search}`;
  const current=useRef(scope);current.current=scope;
  const [registrations,setRegistrations]=useState([]);
  const [pendingAction,setPendingAction]=useState(null);
  const queueAction=useCallback(action=>{
    setPendingAction({...action,origin:current.current});
    navigate(action.page);
  },[navigate]);
  const consumeAction=useCallback(()=>setPendingAction(null),[]);
  const routeSnapshot=useMemo(()=>({route:location.pathname,pageName:voicePage(location.pathname)?.pageName||{ta:'பேஜ்',hi:'पेज',en:'page'},selected:{},source:'route',asOf:new Date().toISOString()}),[scope]);
  const register=useCallback((owner,forScope,details)=>{
    if(current.current!==forScope)return ()=>{};
    setRegistrations(old=>[...old,{owner,scope:forScope,details}]);
    return ()=>setRegistrations(old=>old.filter(entry=>entry.owner!==owner));
  },[]);
  const active=registrations.filter(entry=>entry.scope===scope);
  const registration=active.filter(entry=>Object.values(entry.details.selected).some(Boolean)).at(-1)||active.at(-1);
  const registeredSelection=JSON.stringify(registration?.details?.selected||{});
  const registeredSelectionRef=useRef(registeredSelection);registeredSelectionRef.current=registeredSelection;
  const select=useCallback(selected=>setRowSelection({scope:current.current,selected,base:registeredSelectionRef.current}),[]);
  const controls=useMemo(()=>createPageControls({getContext:()=>latest.current,navigate,select}),[navigate,select]);
  const selected={...registration?.details?.selected,...(rowSelection.scope===scope&&rowSelection.base===registeredSelection?rowSelection.selected:{})};
  const focusedRow=rowSelection.scope===scope&&Object.entries(rowSelection.selected).every(([field,id])=>selected[field]===id)?rowSelection.selected:null;
  const value={...routeSnapshot,...registration?.details,selected,focusedRow,scope,register,controls,queueAction,consumeAction,pendingAction,tourNavigationToken:location.state?.kuralTour,isCurrent:token=>token===current.current};latest.current=value;
  useEffect(()=>{if(pendingAction&&scope!==pendingAction.origin&&location.pathname!==pendingAction.page)setPendingAction(null);},[scope,location.pathname,pendingAction]);
  useEffect(()=>{
    if(!voiceEverywhereEnabled())return;
    const main=document.querySelector('main');if(!main)return;
    const mark=()=>markVoiceRows(latest.current);mark();
    const observer=new MutationObserver(mark);observer.observe(main,{childList:true,subtree:true});
    const clicked=event=>{const row=event.target.tagName==='SELECT'?event.target.selectedOptions[0]:event.target.closest('[data-voice-row-id]');if(row?.dataset.voiceRowId)select({[row.dataset.voiceRowKey||'rowId']:row.dataset.voiceRowId});};
    main.addEventListener('click',clicked);main.addEventListener('change',clicked);return()=>{observer.disconnect();main.removeEventListener('click',clicked);main.removeEventListener('change',clicked);};
  },[scope,registration?.details,select]);
  return <VoicePageContext.Provider value={value}>{children}</VoicePageContext.Provider>;
}
// Register only metadata already shown by a page. No requests or factory store.
export function useRegisterVoicePage(selected,source,loaded=null,actions=null,enabled=true) {
  const context=useVoicePage();
  const actionsRef=useRef(actions);actionsRef.current=actions;
  const serialized=JSON.stringify(selected);
  const loadedSerialized=JSON.stringify(loaded);
  const register=context?.register,scope=context?.scope;
  useLayoutEffect(()=>{
    if(!enabled||(!voiceEverywhereEnabled()&&!wakeWordEnabled()&&import.meta.env.VITE_VOICE_ACTIONS!=='true')||!register)return;
    const owner=Symbol('page selection');
    return register(owner,scope,{selected:JSON.parse(serialized),source,asOf:new Date().toISOString(),loaded:JSON.parse(loadedSerialized),notifyAction:value=>actionsRef.current?.(value)});
  },[register,scope,serialized,source,loadedSerialized,enabled]);
}
