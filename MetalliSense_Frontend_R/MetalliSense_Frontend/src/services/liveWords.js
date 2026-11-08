// Optional presentation only. No microphone owner, audio upload, REST change or logs.
export const liveWordsEnabled=()=>import.meta.env.VITE_LIVE_WORDS==='true';
export const liveWordsMockEnabled=()=>import.meta.env.VITE_LIVE_WORDS_MOCK==='true';
export function liveWordsLocale(lang){const locale={ta:'ta-IN',hi:'hi-IN',en:'en-IN'}[String(lang).split('-')[0]];if(!locale)throw Error('Unsupported live-word locale');return locale;}
export function liveWordsUrl(base=import.meta.env.VITE_COPILOT_BASE_URL||'http://localhost:8001'){const url=new URL(base,globalThis.location?.href||'http://localhost:5173');if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid Agent URL');url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/ws/live-words';url.search='';url.hash='';return url.href;}
export function createLiveWords({enabled=liveWordsEnabled(),mock=liveWordsMockEnabled(),onChange=()=>{},socketFactory=url=>new WebSocket(url),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let socket,timer,generation=0;
 const publish=(text='',code='')=>onChange({text,mock:Boolean(mock),code});
 function closeSocket(){const old=socket;socket=null;if(old){old.onopen=old.onmessage=old.onerror=old.onclose=null;try{old.close();}catch{/* optional */}}}
 function stop(){generation++;clearTimer(timer);closeSocket();if(enabled)publish();}
 return {enabled,start(lang){if(!enabled)return;stop();let locale;try{locale=liveWordsLocale(lang);}catch{return;}if(mock)return;const ticket=generation;
  try{socket=socketFactory(liveWordsUrl());const current=socket;current.onopen=()=>{if(ticket===generation&&socket===current)current.send(JSON.stringify({type:'start',locale,sample_rate:16000}));};current.onmessage=event=>{if(ticket!==generation)return;try{const value=JSON.parse(event.data);if(value.type==='partial'&&typeof value.text==='string'&&value.text.trim())publish(value.text.slice(0,500));else if(value.type==='unavailable'){publish('',value.code);closeSocket();}}catch{closeSocket();}};current.onerror=()=>{if(ticket===generation){publish('','unavailable');closeSocket();}};
  }catch{publish('','unavailable');}},closeSocket,stop,replay(text){if(!enabled||!mock||!String(text).trim())return;stop();const ticket=generation,words=String(text).trim().split(/\s+/);let index=0;const next=()=>{if(ticket!==generation)return;publish(words.slice(0,++index).join(' '),'mock_final_replay');if(index<words.length)timer=setTimer(next,120);};next();}};
}
