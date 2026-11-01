import React,{useLayoutEffect,useState} from 'react';

// Measure viewport geometry directly. No cached document offsets or tooltip
// positioning: layout changes, nested scrolling and resizing share this path.
export default function TourSpotlight({target='main',layoutKey}) {
 const [bounds,setBounds]=useState(null);
 useLayoutEffect(()=>{
  let frame=null,disposed=false;
  const measure=()=>{
   frame=null;if(disposed)return;
   const node=document.querySelector(target),r=node?.getBoundingClientRect();
   if(!r||r.width<=0||r.height<=0){setBounds(null);return;}
   const width=document.documentElement.clientWidth,height=window.innerHeight;
   const x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(width,r.right),bottom=Math.min(height,r.bottom);
   const next=right>x&&bottom>y?{x,y,width:right-x,height:bottom-y,viewportWidth:width,viewportHeight:height}:null;
   setBounds(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
  };
  const schedule=()=>{if(frame===null)frame=requestAnimationFrame(measure);};
  measure();schedule();
  const resize=new ResizeObserver(schedule);
  const node=document.querySelector(target);if(node)resize.observe(node);
  // Layout ancestors can move the target without resizing it.
  for(let parent=node?.parentElement;parent;parent=parent.parentElement)resize.observe(parent);
  const mutations=new MutationObserver(schedule);
  mutations.observe(document.querySelector('main')||document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);};
 },[target,layoutKey]);
 if(!bounds)return null;
 const {x,y,width,height,viewportWidth:w,viewportHeight:h}=bounds;
 const hole=`M${x},${y}h${width}v${height}h-${width}Z`;
 return <svg aria-hidden="true" data-testid="tour-spotlight" viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10000,overflow:'hidden'}}>
  <path fill="rgba(15,35,28,0.22)" fillRule="evenodd" d={`M0,0H${w}V${h}H0Z ${hole}`}/>
  <rect data-tour-highlight x={x+1} y={y+1} width={Math.max(0,width-2)} height={Math.max(0,height-2)} rx="10" fill="none" stroke="rgba(6,95,70,0.45)" strokeWidth="1.5"/>
 </svg>;
}
