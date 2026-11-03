import React,{Children} from 'react';
import {Mic,X} from 'lucide-react';
export const HANDSFREE_PRIVACY="Say 'Kural' after a pause. Audio goes to Gnani only when you start speaking.";
function Switch({label,checked,onClick,disabled=false,description,title}){
 return <button type="button" role="switch" className="kural-switch" aria-label={label} aria-checked={checked} aria-describedby={description} title={title||label} disabled={disabled} onClick={onClick}><span/></button>;
}
export function existingMenuActions(children){
 const nodes=Children.toArray(children?.props?.children||children),row=nodes.find(node=>node?.type==='div'&&node.props?.className?.includes('flex-wrap'));
 return {talk:Children.toArray(row?.props?.children).find(node=>node?.props?.onPointerDown),demo:nodes.find(node=>node?.type==='details')};
}
export default function KuralControlsMenu({wake,onToggle,onClose,controls={},children,menuRef}){
 const {talk,demo}=existingMenuActions(children),{lang='en',onLanguageChange,languageOptions=['ta','en'],muted=false,onToggleMute,showLatin=false,onLatinChange,latinAvailable=false,latinDisabled=false}=controls;
 const languages=[['ta','தமிழ்'],['hi','हिन्दी'],['en','EN']];
 const moveLanguage=(event,index)=>{const enabled=languages.filter(([value])=>languageOptions.includes(value));let next;
  if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){const at=enabled.findIndex(([value])=>value===languages[index][0]);next=enabled[(at+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+enabled.length)%enabled.length];}
  else if(event.key==='Home')next=enabled[0];else if(event.key==='End')next=enabled.at(-1);else return;
  event.preventDefault();if(next){onLanguageChange?.(next[0]);event.currentTarget.parentElement.querySelector(`[data-language="${next[0]}"]`)?.focus();}
 };
 return <div ref={menuRef} className="kural-controls-popup" role="dialog" aria-label="Kural controls">
  <div className="kural-popup-heading"><strong>Kural</strong><button type="button" onClick={onClose} aria-label="Close Kural controls" title="Close Kural controls"><X size={18}/></button></div>
  <div className="kural-menu-row" title={HANDSFREE_PRIVACY}><div><span>Hands-free</span><small>Say “Kural” to start</small><span id="kural-hf-description" className="kural-sr-only">{HANDSFREE_PRIVACY}</span></div><Switch label="Hands-free" checked={wake.enabled} onClick={onToggle} description="kural-hf-description" title={HANDSFREE_PRIVACY}/></div>
  <div className="kural-menu-row"><span>Language</span><div className="kural-language-segments" role="radiogroup" aria-label="Voice language">{languages.map(([value,label],i)=><button key={value} type="button" role="radio" aria-label={label} aria-checked={lang===value} tabIndex={lang===value?0:-1} data-language={value} disabled={!languageOptions.includes(value)} title={!languageOptions.includes(value)?'Language unavailable':label} onClick={()=>onLanguageChange?.(value)} onKeyDown={event=>moveLanguage(event,i)}>{label}</button>)}</div></div>
  <div className="kural-menu-row"><span>Voice replies</span><Switch label="Voice replies" checked={!muted} onClick={onToggleMute} title={muted?'Unmute spoken replies':'Mute spoken replies'}/></div>
  <div className="kural-menu-row"><span>English letters</span><Switch label="English letters" checked={showLatin} disabled={!latinAvailable||latinDisabled} onClick={()=>onLatinChange?.(!showLatin)} title={!latinAvailable?'English letters unavailable':'Show in English letters'}/></div>
  {talk&&React.cloneElement(talk,{className:'kural-talk-button',title:'Hold to talk','aria-label':'Hold to talk',children:<><Mic size={18} aria-hidden="true"/>Hold to talk</>})}
  {import.meta.env.DEV&&demo}
 </div>;
}
