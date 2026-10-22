"""Read-only Python-to-browser prediction fixtures, no training/feedback/provider calls."""
from pathlib import Path
import sys,json,joblib,contextlib,io
R=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(R/'MetalliSense_AI_R/MetalliSense_AI/app'))
from data.grade_specs import GradeSpecificationGenerator
from agents.alloy_agent import AlloyCorrectionAgent
from agents.anomaly_agent import AnomalyDetectionAgent
with contextlib.redirect_stdout(io.StringIO()):
 gen=GradeSpecificationGenerator();alloy=AlloyCorrectionAgent(gen);alloy.load(str(R/'MetalliSense_AI_R/MetalliSense_AI/app/models/alloy_model.pkl'));anomaly=AnomalyDetectionAgent(gen);anomaly.load(str(R/'MetalliSense_AI_R/MetalliSense_AI/app/models/anomaly_model.pkl'))
 fixtures=[]
 for grade,spec in gen.grades.items():
  for case in ['midpoint','low','high']:
   c=gen.get_composition_midpoint(grade)
   if case=='low':
    for e in ['C','Si','Mn']:c[e]=spec['composition_ranges'][e][0]*.5
   if case=='high':
    for e in ['C','P','S']:c[e]=spec['composition_ranges'][e][1]*1.4
   fixtures.append({'grade':grade,'case':case,'composition':c,'anomaly':anomaly.predict(c,grade),'alloy':alloy.predict(grade,c)})
out=R/'MetalliSense_Frontend_R/MetalliSense_Frontend/tests/model-fixtures.json';out.write_text(json.dumps(fixtures,indent=2));print('Wrote',len(fixtures),'read-only parity fixtures')
