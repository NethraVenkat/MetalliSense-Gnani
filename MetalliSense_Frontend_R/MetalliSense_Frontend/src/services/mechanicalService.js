import api from './api';
// Shared by the existing prediction button and voice; same configured backend
// origin/base path as the rest of the app, including isolated full-mode ports.
export async function predictMechanical(grade,composition){
 const response=await api.post('/mechanical/predict',{grade,composition:{C:composition.C||0,Si:composition.Si||0,Mn:composition.Mn||0,P:composition.P||0,S:composition.S||0},mode:'formula'});
 const body=response.data;if(body.status!=='success'||!body.data)throw Error(body.message||'Prediction unavailable');return response;
}
