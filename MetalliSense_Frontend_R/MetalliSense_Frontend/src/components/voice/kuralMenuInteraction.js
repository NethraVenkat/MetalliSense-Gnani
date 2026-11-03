// Close controls without moving focus/scroll before handing capture to the existing owner.
export function menuTalkProps(talk,close){return {
 onPointerDown:event=>{if(event.button!==0)return;event.preventDefault();const finish=e=>{window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);talk.props.onPointerUp?.(e);};window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',finish,{once:true});close({restoreFocus:false});talk.props.onPointerDown?.(event);},
 onLostPointerCapture:event=>event.preventDefault(),
 onTouchStart:event=>{event.preventDefault();talk.props.onTouchStart?.(event);},
 onKeyDown:event=>{if([' ','Enter'].includes(event.key)&&!event.repeat){event.preventDefault();close({restoreFocus:false});}talk.props.onKeyDown?.(event);}
};}
