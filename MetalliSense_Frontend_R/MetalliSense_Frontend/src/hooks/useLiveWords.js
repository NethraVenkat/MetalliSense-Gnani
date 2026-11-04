import {useEffect,useRef,useState} from 'react';
import {createLiveWords} from '../services/liveWords';
export default function useLiveWords({lang,active,transcript='',blocked=false}){
 const [value,setValue]=useState({text:'',mock:false,code:''}),engine=useRef(null),armed=useRef(false),baseline=useRef(''),language=useRef(lang);
 if(!engine.current)engine.current=createLiveWords({onChange:setValue});
 useEffect(()=>{if(!engine.current.enabled)return;if(blocked||language.current!==lang){engine.current.stop();armed.current=false;}language.current=lang;if(blocked)return;if(active){armed.current=true;baseline.current=transcript;engine.current.start(lang);}else engine.current.closeSocket();},[lang,active,blocked]);
 useEffect(()=>{if(!blocked&&armed.current&&transcript&&transcript!==baseline.current){armed.current=false;engine.current.replay(transcript);}},[transcript,blocked]);
 useEffect(()=>()=>engine.current.stop(),[]);
 return value;
}
