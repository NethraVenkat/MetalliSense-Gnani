"""Server-side foundation policy. Registered voice actions; plant execution stays in the existing page services."""
import re
ROLES={'Operator','Supervisor','Manager','Unit Controller'}
ACTIONS={'test-action':{'level':'RUN','roles':[]},'semantic_search':{'level':'ASK','roles':[]}}
for name in ['request_reading','gate_check','deviation_analyze','deviation_explain','correction_plan','correction_explain','full_analysis','agent_analyze','agent_explain','mechanical_predict','supplier_plan','gun_connect','gun_disconnect','energy_meter']:
    ACTIONS[name]={'level':'RUN','roles':[]}
for name,roles in {'start_melting':['Supervisor','Unit Controller'],'approve_pr':['Manager'],'reject_pr':['Manager'],'approve_dri_qa':['Supervisor','Manager'],'reject_dri_qa':['Supervisor','Manager'],'inspect_lot':['Supervisor']}.items():
    ACTIONS[name]={'level':'APPROVE','roles':roles}

NEVER=re.compile(r'\b(delete|remove|reset|override|clear\s+chat|edit\s+(grade|price|training)|receive\s+(lot|additive)|dri\s+lab|manual\s+(?:lot\s+)?(?:release|reject)|issue\s+invoice|approve\s+tap|accept\s+strategy|apply\s+(?:ahp|criteria)\s+weights)\b|HOLD.*(?:override|bypass)|(?:override|bypass).*HOLD|நீக்கு|அழி|ஓவர்ரைடு|हटाओ|मिटाओ|ओवरराइड',re.I)
def forbidden(*parts):return bool(NEVER.search(' '.join(str(p) for p in parts)))
