import React, {createContext,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {voiceEverywhereEnabled,voicePage} from '../services/voicePages';

const VoicePageContext=createContext(null);
export const useVoicePage=()=>useContext(VoicePageContext);
export function VoicePageProvider({children}) {
  const location=useLocation();
  const scope=`${location.key}:${location.pathname}${location.search}`;
  const current=useRef(scope);current.current=scope;
  const [registrations,setRegistrations]=useState([]);
  const routeSnapshot=useMemo(()=>({route:location.pathname,pageName:voicePage(location.pathname)?.pageName||{ta:'பேஜ்',hi:'पेज',en:'page'},selected:{},source:'route',asOf:new Date().toISOString()}),[scope]);
  const register=useCallback((owner,forScope,details)=>{
    if(current.current!==forScope)return ()=>{};
    setRegistrations(old=>[...old,{owner,scope:forScope,details}]);
    return ()=>setRegistrations(old=>old.filter(entry=>entry.owner!==owner));
  },[]);
  const active=registrations.filter(entry=>entry.scope===scope);
  const registration=active.filter(entry=>Object.values(entry.details.selected).some(Boolean)).at(-1)||active.at(-1);
  const value={...routeSnapshot,...registration?.details,scope,register,tourNavigationToken:location.state?.kuralTour,isCurrent:token=>token===current.current};
  return <VoicePageContext.Provider value={value}>{children}</VoicePageContext.Provider>;
}
// Register only metadata already shown by a page. No requests or factory store.
export function useRegisterVoicePage(selected,source) {
  const context=useVoicePage();
  const serialized=JSON.stringify(selected);
  const register=context?.register,scope=context?.scope;
  useLayoutEffect(()=>{
    if(!voiceEverywhereEnabled()||!register)return;
    const owner=Symbol('page selection');
    return register(owner,scope,{selected:JSON.parse(serialized),source,asOf:new Date().toISOString()});
  },[register,scope,serialized,source]);
}
