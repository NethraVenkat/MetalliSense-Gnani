// Shared by the existing prediction button and voice; no fallback success.
export async function predictMechanical(grade,composition){
 const base=import.meta.env.VITE_API_URL||'http://localhost:3000';
 const response=await fetch(`${base}/api/v2/mechanical/predict`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade,composition:{C:composition.C||0,Si:composition.Si||0,Mn:composition.Mn||0,P:composition.P||0,S:composition.S||0},mode:'formula'})});
 const body=await response.json();if(!response.ok||body.status!=='success'||!body.data)throw Error(body.message||'Prediction unavailable');return {status:response.status,data:body};
}
