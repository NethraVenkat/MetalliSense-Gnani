"""Export trusted local model artifacts without importing services or training."""
from pathlib import Path
import joblib,json,numpy as np
R=Path(__file__).resolve().parent.parent
out=R/'MetalliSense_Frontend_R/MetalliSense_Frontend/src/mock/models'
def plain(v):
 if isinstance(v,np.ndarray):return v.tolist()
 if isinstance(v,np.generic):return v.item()
 if isinstance(v,dict):return {k:plain(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [plain(x) for x in v]
 return v
def tree(m):
 t=m.tree_
 return {'left':t.children_left.tolist(),'right':t.children_right.tolist(),'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'value':t.value.reshape(len(t.value),-1).tolist(),'samples':t.n_node_samples.tolist()}
def export(m):
 if isinstance(m,dict):return {k:export(v) for k,v in m.items()}
 if hasattr(m,'mean_'):return {'kind':'scaler','mean':plain(m.mean_),'scale':plain(m.scale_)}
 if hasattr(m,'coef_'):return {'kind':'linear','coef':plain(m.coef_),'intercept':plain(m.intercept_),'t':getattr(m,'t_',1),'eta0':getattr(m,'eta0',.01),'alpha':getattr(m,'alpha',.0001)}
 if hasattr(m,'estimators_'):
  if type(m).__name__=='MultiOutputRegressor':return {'kind':'multi','models':[export(e) for e in m.estimators_]}
  if type(m).__name__=='IsolationForest':return {'kind':'isolation','trees':[tree(t) for t in m.estimators_],'features':plain(m.estimators_features_),'maxSamples':m.max_samples_,'offset':m.offset_}
  if type(m).__name__=='GradientBoostingRegressor':return {'kind':'boost','trees':[tree(t[0]) for t in m.estimators_],'rate':m.learning_rate,'initial':float(m.init_.constant_.flat[0])}
 if hasattr(m,'tree_'):return {'kind':'tree',**tree(m)}
 if isinstance(m,(str,int,float,bool,list,tuple,np.ndarray,np.generic)) or m is None:return plain(m)
 return {'unsupported':type(m).__name__}
report={}
for name,path in [('alloy',R/'MetalliSense_AI_R/MetalliSense_AI/app/models/alloy_model.pkl'),('anomaly',R/'MetalliSense_AI_R/MetalliSense_AI/app/models/anomaly_model.pkl'),('reward',R/'MetalliSense_Agent_R/MetalliSense_Agent/app/models/rl_reward_model.pkl')]:
 data=export(joblib.load(path));p=out/(name+'.json');p.write_text(json.dumps(data,separators=(',',':')));report[name]={'bytes':p.stat().st_size,'keys':list(data) if isinstance(data,dict) else []}
state=R/'MetalliSense_Agent_R/MetalliSense_Agent/app/models/rl_reward_model_state.json'
if state.exists():
 s=json.loads(state.read_text());(out/'reward-state.json').write_text(json.dumps({k:s[k] for k in ['known_grades','n_updates','fitted'] if k in s}))
(out/'export-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
import sys
sys.path.insert(0,str(R/'MetalliSense_AI_R/MetalliSense_AI/app'))
from data.grade_specs import GradeSpecificationGenerator
from config import ANOMALY_SEVERITY_THRESHOLDS
(out/'grade-model-specs.json').write_text(json.dumps(GradeSpecificationGenerator().grades))
(out/'thresholds.json').write_text(json.dumps(ANOMALY_SEVERITY_THRESHOLDS))
# Reduce only numeric serialization precision, retaining ALL estimators.
def compact(v):
 if isinstance(v,float):return round(v,10)
 if isinstance(v,dict):return {k:compact(x) for k,x in v.items()}
 if isinstance(v,list):return [compact(x) for x in v]
 return v
for name in ['alloy','anomaly']:
 p=out/(name+'.json');p.write_text(json.dumps(compact(json.loads(p.read_text())),separators=(',',':')))
print('Total model bytes:',sum(p.stat().st_size for p in out.glob('*.json')))
