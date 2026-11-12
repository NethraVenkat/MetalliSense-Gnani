import {it,expect,vi} from 'vitest';
const {post}=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('../src/services/api',()=>({default:{post}}));
import {predictMechanical} from '../src/services/mechanicalService';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
const backend=fileURLToPath(new URL('../../../MetalliSense_Backend_Simple/',import.meta.url));
const require=createRequire(backend+'/package.json');
const freePort=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
it('mechanical button and voice use the configured shared backend rather than a hardcoded origin',async()=>{
 const response={status:200,data:{status:'success',data:{tensile_strength_mpa:400}}};post.mockResolvedValueOnce(response);
 expect(await predictMechanical('SG-IRON',{C:3.5,Si:2.3})).toBe(response);
 expect(post).toHaveBeenLastCalledWith('/mechanical/predict',{grade:'SG-IRON',composition:{C:3.5,Si:2.3,Mn:0,P:0,S:0},mode:'formula'});
 post.mockResolvedValueOnce({status:200,data:{status:'error',message:'Unavailable'}});
 await expect(predictMechanical('SG-IRON',{})).rejects.toThrow('Unavailable');
});
it('derived grade cache preserves values and invalidates on every training-data mutation',()=>{
 const grades=require('./gradeSpecStore'),store=require('./csvDataStore');
 const before=structuredClone(grades.getAllSpecs());
 expect(grades.getAllSpecs()).toEqual(before);
 expect(grades.getAllSpecs()[0]).toBe(grades.getAllSpecs()[0]);
 const row=store.create({grade:'STAGE4-DISPOSABLE',Fe:90,C:2,Si:3,Mn:1,P:.01,S:.01});
 try{
  expect(grades.getByName(row.grade).composition_ranges.C).toEqual([2,2]);
  store.updateById(row._id,{C:4});
  expect(grades.getByName(row.grade).composition_ranges.C).toEqual([4,4]);
 }finally{store.deleteById(row._id);}
 expect(grades.getAllSpecs()).toEqual(before);
});
it('new grade specs remain visible and editable until deleted',()=>{
 const grades=require('./gradeSpecStore');
 const row=grades.create({grade:'STAGE4-CUSTOM',composition_ranges:{C:[2,3]}});
 try{
  expect(grades.getById(row._id)).toEqual(row);
  grades.update(row._id,{description:'reviewed'});
  expect(grades.getByName(row.grade).description).toBe('reviewed');
 }finally{grades.remove(row._id);}
 expect(grades.getByName(row.grade)).toBeNull();
});
it('full-mode H-1053 uses the same unsafe seed as mock and cannot start without a gate',()=>{
 const store=require('./premeltGate/store'),gate=require('./premeltGate/gateEngine');
 const heat=store.heats.get('H-1053'),lot=store.getLot('PIG-1053');
 expect(heat).toMatchObject({status:'PLANNED',grade:'SG-IRON',charge:[{lotId:'PIG-1053',kg:1000}]});
 expect(lot.status).toBe('QUARANTINED');expect(lot.declared.Cu).toBe(.5);
 const kg=store.availableKg(lot.lotId);
 expect(()=>gate.startMelting(heat.heatId,{by:'TEST'})).toThrow();
 expect(store.availableKg(lot.lotId)).toBe(kg);expect(heat.status).toBe('PLANNED');
});
it('full backend connects real OPC, accepts the plain reading button and exposes it in history',async()=>{
 const port=await freePort(),opc=await freePort(),gun=await freePort();
 const child=spawn(process.execPath,['server.js'],{cwd:backend,windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(port),SPECTROMETER_OPCUA_PORT:String(opc),GUN_OPCUA_PORT:String(gun)}});
 const base=`http://127.0.0.1:${port}/api/v1/spectrometer`;
 const request=async(path,method='GET',data)=>{
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  return {status:r.status,data:r.status===204?null:await r.json()};
 };
 try{
  for(let i=0;i<100;i++){
   try{if((await request('/opc-status')).data.data.server.isRunning)break;}catch{}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  expect((await request('/opc-connect','POST')).status).toBe(200);
  const result=await request('/opc-reading','POST');
  expect(result.status).toBe(200);expect(result.data.data.reading.composition.C).toBeTypeOf('number');
  const history=await request('/');
  expect(history.data.data.data[0]).toEqual(result.data.data.reading);
  expect(history.data.results).toBe(1);
  const second=await request('/opc-reading','POST',{metalGrade:result.data.data.reading.metalGrade});
  expect(second.status).toBe(200);
  expect((await request('/')).data.data.data.map(r=>r._id)).toEqual([second.data.data.reading._id,result.data.data.reading._id]);
  expect((await request('/opc-disconnect','POST')).status).toBe(200);
  expect((await request('/opc-reading','POST')).status).toBe(500);
 }finally{
  if(child.exitCode===null)await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
 }
},60000);
