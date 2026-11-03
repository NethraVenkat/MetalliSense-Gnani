import {it,expect,vi,afterEach} from 'vitest';
import {createRememberedWake,readHandsFreePreference,saveHandsFreePreference,HANDSFREE_KEY} from '../src/services/wakePreference';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const options=extra=>({check:vi.fn(async()=>({wake:false})),transcribe:vi.fn(),onQuery:vi.fn(),capture:vi.fn(async()=>({stop:vi.fn()})),...extra});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
it('first visit stays off, explicit on survives restore, manual off survives another restore',async()=>{
 vi.stubEnv('VITE_WAKE_WORD','true');const store=memory(),a=options(),first=createRememberedWake(a,{storage:()=>store});await first.restore();expect(a.capture).not.toHaveBeenCalled();expect(first.enabled).toBe(false);await first.start();expect(store.getItem(HANDSFREE_KEY)).toBe('on');first.stop();expect(readHandsFreePreference(()=>store)).toBe(true);
 const b=options(),next=createRememberedWake(b,{storage:()=>store});await next.restore();expect(b.capture).toHaveBeenCalledTimes(1);next.disable();expect(store.getItem(HANDSFREE_KEY)).toBe('off');await next.restore();expect(next.enabled).toBe(false);expect(b.capture).toHaveBeenCalledTimes(1);
});
it('permission denial and revocation stop capture honestly without a retry loop',async()=>{
 vi.stubEnv('VITE_WAKE_WORD','true');const store=memory(),changes=[],capture=vi.fn(async()=>{throw new DOMException('denied','NotAllowedError');});const s=createRememberedWake(options({capture,onChange:v=>changes.push(v)}),{storage:()=>store});await s.start();expect(s.enabled).toBe(false);expect(changes.at(-1)).toMatchObject({permissionRequired:true,state:'Off',enabled:false});s.tick();expect(capture).toHaveBeenCalledTimes(1);expect(readHandsFreePreference(()=>store)).toBe(false);s.disable();
 const stop=vi.fn(),v=createRememberedWake(options({capture:async()=>({stop})}),{storage:()=>store});await v.start();v.permissionDenied();expect(v.enabled).toBe(false);expect(stop).toHaveBeenCalledTimes(1);v.disable();
});
it('three provider errors auto-off for session retain remembered ON until manual OFF',async()=>{
 vi.useFakeTimers();vi.stubEnv('VITE_WAKE_WORD','true');const store=memory(),changes=[];let feed;const capture=vi.fn(async o=>{feed=o.onFrame;return {stop:vi.fn()};});const check=vi.fn(async()=>{throw Error('unavailable');});const s=createRememberedWake(options({capture,check,onChange:v=>changes.push(v)}),{storage:()=>store});await s.start();
 for(let i=0;i<3;i++){feed(new Int16Array(4800).fill(1000).buffer);feed(new Int16Array(24000).buffer);await vi.advanceTimersByTimeAsync(0);}
 expect(check).toHaveBeenCalledTimes(3);expect(s.enabled).toBe(false);expect(changes.at(-1)).toMatchObject({enabled:false,autoOff:true});expect(store.getItem(HANDSFREE_KEY)).toBe('on');s.tick();expect(capture).toHaveBeenCalledTimes(1);s.disable();expect(store.getItem(HANDSFREE_KEY)).toBe('off');
});
it('automatic pauses resume without changing preference; flag off and unavailable storage are safe',async()=>{
 vi.stubEnv('VITE_WAKE_WORD','true');const store=memory();let paused=false;const stop=vi.fn(),capture=vi.fn(async()=>({stop}));const s=createRememberedWake(options({capture,paused:()=>paused}),{storage:()=>store});await s.start();paused=true;s.tick();expect(stop).toHaveBeenCalledTimes(1);paused=false;s.tick();await Promise.resolve();expect(capture).toHaveBeenCalledTimes(2);expect(readHandsFreePreference(()=>store)).toBe(true);s.stop();
 vi.stubEnv('VITE_WAKE_WORD','false');await s.restore();expect(s.enabled).toBe(false);expect(capture).toHaveBeenCalledTimes(2);expect(readHandsFreePreference(()=>{throw Error('storage denied');})).toBe(false);expect(()=>saveHandsFreePreference(true,()=>{throw Error('storage denied');})).not.toThrow();
});
