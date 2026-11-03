import React,{useEffect,useState} from 'react';
export function useKuralReducedMotion(){
 const [reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 return reduced;
}
export function leadingWake(text){
 const source=String(text||''),match=source.match(/^\s*(?:kural|குரல்|कुरल)(?=$|[\s\p{P}])/iu);
 return match?{wake:true,text:source.slice(match[0].length).replace(/^[\s,.:;!?…—-]+/u,'')}:{wake:false,text:source};
}
export function displayParts(text){
 const pattern=/\b[A-Z]{1,8}-\d+\b|\bHOLD\b|\bWARN\b|\bGO\b|\d+(?:[.,]\d+)?%/giu;
 const parts=[];let last=0;
 for(const match of text.matchAll(pattern)){
  if(match.index>last)parts.push({text:text.slice(last,match.index),kind:'plain'});
  const word=match[0],upper=word.toUpperCase();parts.push({text:word,kind:upper==='HOLD'?'hold':upper==='WARN'?'warn':upper==='GO'?'go':word.endsWith('%')?'percent':'id'});last=match.index+word.length;
 }
 if(last<text.length)parts.push({text:text.slice(last),kind:'plain'});
 return parts;
}
export function spokenWordPhase(index,count,progress,complete=false){
 if(complete)return 'done';const ratio=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 if(ratio===1)return 'done';const current=Math.min(count-1,Math.floor(ratio*count));return index<current?'done':index===current?'current':'future';
}
export const tidyTaggedPunctuation=text=>text.replace(/(\b[A-Z]{1,8}-\d+\b|\b(?:HOLD|WARN|GO)\b|\d+(?:[.,]\d+)?%)\s+([:?.!,])/giu,'$1$2');
function Tagged({text}){const parts=displayParts(text);return parts.map((part,i)=>part.kind==='plain'?part.text:<span key={i} className={`kural-text-tag kural-tag-${part.kind}${/^[:?.!,]/.test(parts[i+1]?.text||'')?' kural-tag-before-punctuation':''}`}>{part.text}</span>);}
export default function KuralWords({text='',mode='listening',progress=null,muted=false,reduced=false}){
 if(!text.trim())return null;
 const display=tidyTaggedPunctuation(text),transcript=mode!=='speaking'?leadingWake(display):{wake:false,text:display},pieces=transcript.text.match(/\s+|\S+/gu)||[],count=pieces.filter(p=>p.trim()).length;
 let index=0;
 // Karaoke is a display-only approximation: playback proportion across words,
 // not forced alignment, phoneme timing or a change to the spoken text.
 return <div className={`kural-words kural-words--${mode}`} aria-label={mode!=='speaking'?'Transcript':'Answer'}>
  {transcript.wake&&<><span className="kural-wake-tag">Kural</span>{transcript.text&&' '}</>}
  {pieces.map((word,i)=>{if(!word.trim())return word;const at=index++,phase=mode==='speaking'?spokenWordPhase(at,count,progress,muted||reduced):'done';
   const newest=mode==='listening'&&!reduced&&at===count-1;
   return <span key={`${i}-${word}`} className={`kural-word kural-word--${phase}${newest?' kural-word--newest':''}`}><Tagged text={word}/></span>;
  })}
  {mode==='listening'&&!reduced&&<span className="kural-caret" aria-hidden="true">▏</span>}
 </div>;
}
