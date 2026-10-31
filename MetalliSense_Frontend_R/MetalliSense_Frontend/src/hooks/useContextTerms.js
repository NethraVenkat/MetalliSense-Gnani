import {useEffect,useState} from 'react';
import {getHeat,getHeats} from '../services/premeltService';
import {buildContextTerms,contextBiasEnabled} from '../services/contextTerms';
const unwrap=response=>response.data?.data??response.data;
export default function useContextTerms(selectedHeatId){
 const [terms,setTerms]=useState([]);
 const enabled=contextBiasEnabled();
 useEffect(()=>{
  if(!enabled)return;
  let alive=true,busy=false;
  const refresh=async()=>{
   if(busy)return;busy=true;
   try{
    const rows=unwrap(await getHeats());
    if(selectedHeatId&&!rows.some(heat=>heat.heatId===selectedHeatId))rows.push(unwrap(await getHeat(selectedHeatId)));
    const next=buildContextTerms(rows,selectedHeatId);
    if(alive)setTerms(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
   }catch{if(alive)setTerms([]);}finally{busy=false;}
  };
  void refresh();const timer=setInterval(refresh,1000);
  return()=>{alive=false;clearInterval(timer);};
 },[selectedHeatId,enabled]);
 return enabled?terms:[];
}
