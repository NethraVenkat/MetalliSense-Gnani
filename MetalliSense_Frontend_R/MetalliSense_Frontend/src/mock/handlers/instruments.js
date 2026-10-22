export function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<String(text).length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);const headers=rows.shift()||[];return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function createInstruments(req,state,persist,notify){
 let connected=false,gunConnected=false,live=null,gunTimer,timer,argon=100,seq=0;
 const store=()=>req('premeltGate/store');
 function reading(grade,deviations=[],percent=10){
  const heat=store().heats.list().find(h=>h.status==='MELTING'),ranges=req('premeltGate/config').GRADE_SPECS[grade]||req('premeltGate/config').GRADE_SPECS['SG-IRON'];
  if(heat?.acceptedStrategy){
   heat.postCorrectionTicks=(heat.postCorrectionTicks||0)+1;
   const fraction=Math.min(1,heat.postCorrectionTicks/3);
   heat.currentComposition={...heat.correctionReading};
   for(const [e,pct] of Object.entries(heat.acceptedStrategy.recommended_additions||{}))heat.currentComposition[e]=(heat.correctionReading[e]||0)+pct*fraction;
   if(heat.postCorrectionTicks===3){const actual={...heat.currentComposition};req('axios').post('/rl/feedback',{grade:heat.grade,composition:heat.correctionReading,additions:heat.acceptedStrategy.recommended_additions,aggressiveness:heat.acceptedStrategy.aggressiveness,outcome:'accepted',actual_result:actual,heatId:heat.heatId,operator_note:'Browser simulated measured outcome after approved addition'}).catch(e=>{heat.feedbackError=e.message;});}
  }
  const composition={};for(const e of ['Fe','C','Si','Mn','P','S','Cr','Ni','Mo','Cu']){
   const [lo,hi]=ranges[e]||[0,.1],baseline=heat?.currentComposition?.[e]??heat?.gate?.prediction?.composition?.[e]??(lo+hi)/2;
   composition[e]=Math.round(Math.max(0,deviations.includes(e)?lo-(hi-lo)*percent/100:baseline+(Math.random()-.5)*(hi-lo)*.08)*10000)/10000;
  }
  const r={_id:'SP-'+(++seq)+'-'+Date.now(),metalGrade:heat?.grade||grade,metal_grade:heat?.grade||grade,heatId:heat?.heatId||null,composition,temperature:1480+Math.random()*40,pressure:.98+Math.random()*.04,timestamp:new Date(),createdAt:new Date(),deviation_elements:deviations,is_synthetic:true};
  state().readings.unshift(r);if(heat){heat.readings ||= [];heat.readings.push(r);state().activeHeat=heat.heatId;}
  return r;
 }
 const getStatus=()=>({server:{isRunning:true,endpoint:'browser://spectrometer',status:'Ready'},client:{isConnected:connected,status:connected?'Connected':'Disconnected',endpointUrl:'browser://spectrometer',cachedData:state().readings[0]||null},timestamp:new Date()});
 const spectrometer={getOPCStatus:getStatus,initializeServerOnly:async()=>true,connectClient:async()=>{connected=true;return {success:true,message:'Browser spectrometer connected',status:getStatus()};},disconnectClient:async()=>{connected=false;return {success:true,message:'Browser spectrometer disconnected',status:getStatus()};},requestSpectrometerReading:async(g,dev,pct)=>{const grade=g||store().heats.list().find(h=>h.status==='MELTING')?.grade||'SG-IRON';const r=reading(grade,dev,pct);return {success:true,data:r};},getReadings:()=>state().readings};
 const gun={initializeServerOnly:async()=>true,status:()=>({server:{isRunning:true,endpoint:'browser://handheld-gun',argonRemaining:argon},client:{isConnected:gunConnected,lastError:null},live}),connect:async()=>{gunConnected=true;return {success:true};},disconnect:async()=>{gunConnected=false;return {success:true};},replaceArgon:()=>{argon=100;return argon;},startInspection:async b=>{
  if(gunTimer)throw Object.assign(new Error('The gun is already testing a lot'),{status:409});
  const lot=store().getLot(b.lotId);if(!lot)throw Object.assign(new Error('Lot not found'),{status:404});if(!['STEEL_SCRAP','CI_SCRAP'].includes(lot.materialType))throw Object.assign(new Error('Yard gun inspection is for scrap lots. Sponge iron goes to the QA lab.'),{status:400});
  const supplierGrade=req('premeltGate/supplierScorecard').gradeForLot(lot),pieces=Math.max(Number(b.pieces)||15,supplierGrade?.inspectPieces||15),device=b.device||'XRF',sessionId=store().sessions.nextId();
  const sim=req('premeltGate/gunSimulator').simulateSession(lot,{device,pieces,surfacePrepared:b.surfacePrepared,sessionNo:lot.sessionIds.length+1});
  live={sessionId,lotId:b.lotId,device,inspector:b.inspector||'Yard inspector',status:'Testing',piecesPlanned:pieces,piecesDone:0,readings:[],result:null,error:null,startedAt:new Date(),supplierGrade};gunConnected=true;
  gunTimer=setInterval(async()=>{
   live.piecesDone++;argon=Math.max(0,argon-(device==='LIBS'?.2:0));live.argonRemaining=argon;const csv=req('premeltGate/gunSimulator').toCsv(sim.rows.slice(0,live.piecesDone));live.readings=req('premeltGate/gunIngest').parseCsv(csv).map(r=>({...r,flags:req('premeltGate/gunIngest').flagPiece(r)}));
   if(live.piecesDone>=sim.rows.length){clearInterval(gunTimer);gunTimer=null;try{const s=req('premeltGate/gunIngest').ingestCsv(csv,{sessionId,inspector:live.inspector,via:'BROWSER_SIMULATOR'});live.result={evidence:s.evidence,decision:s.decision,lot:store().view(lot)};live.status='Session Complete';if(lot.status==='QUARANTINED'&&!state().notifiedLots.includes(lot.lotId)){state().notifiedLots.push(lot.lotId);notify?.('Lot quarantined',lot.lotId,lot.statusReason);}}catch(e){live.error=e.message;live.status='Error';}}
   await persist();
  },350);return live;
 }};
 return {spectrometer,gun,start(){timer=setInterval(async()=>{const h=store().heats.list().find(h=>h.status==='MELTING');if(!h&&!connected)return;const r=reading(h?.grade||'SG-IRON');if(seq%12===0){r.composition.Mn*=2.5;r.injectedOutlier=true;}await persist();},3000);},stop(){clearInterval(timer);clearInterval(gunTimer);gunTimer=null;}};
}
