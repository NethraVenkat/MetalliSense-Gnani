const KEY='metallisense.browser-demo.v1';
const revive=(_k,v)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:/.test(v)?new Date(v):v;
export async function loadState(){const raw=localStorage.getItem(KEY);if(!raw)return null;try{return JSON.parse(raw,revive);}catch{throw new Error('Demo storage could not be read. Use Reset demo data to recover.');}}
export async function saveState(state){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){throw new Error('Demo storage is full or unavailable. Export audit data and reset the demo. '+e.message);}}
export async function clearState(){localStorage.removeItem(KEY);}
