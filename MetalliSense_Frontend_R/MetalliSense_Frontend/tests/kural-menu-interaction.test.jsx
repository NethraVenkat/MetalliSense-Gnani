import React from 'react';
import {it,expect,vi} from 'vitest';
import {menuTalkProps} from '../src/components/voice/kuralMenuInteraction';
it('PTT closes menu first, prevents pointer/touch scroll and does not stop on unmount capture loss',()=>{
 const order=[],stop=vi.fn(),handlers={};vi.stubGlobal('window',{addEventListener:(k,fn)=>{handlers[k]=fn;},removeEventListener:vi.fn()});const start=vi.fn(()=>order.push('start'));const close=vi.fn(()=>order.push('close'));const props=menuTalkProps(<button onPointerDown={start} onPointerUp={stop}/>,close);const e={button:0,preventDefault:vi.fn()};props.onPointerDown(e);expect(order).toEqual(['close','start']);expect(close).toHaveBeenCalledWith({restoreFocus:false});expect(e.preventDefault).toHaveBeenCalled();props.onLostPointerCapture(e);expect(stop).not.toHaveBeenCalled();handlers.pointerup(e);expect(stop).toHaveBeenCalledTimes(1);props.onTouchStart(e);expect(e.preventDefault).toHaveBeenCalledTimes(3);vi.unstubAllGlobals();
});
