"""Server-side foundation policy. Registered voice actions; plant execution stays in the existing page services."""
import re
ROLES={'Operator','Supervisor','Manager','Unit Controller'}
ACTIONS={'test-action':{'level':'RUN','roles':[]},'semantic_search':{'level':'ASK','roles':[]}}
ACTIONS.update({name:{'level':'APPROVE','roles':['Supervisor','Unit Controller']} for name in ['opc_connect','opc_disconnect']})
for name in ['request_reading','gate_check','deviation_analyze','deviation_explain','correction_plan','correction_explain','full_analysis','agent_analyze','agent_explain','mechanical_predict','supplier_plan','gun_connect','gun_disconnect','energy_meter']:
    ACTIONS[name]={'level':'RUN','roles':[]}
for name,roles in {'start_melting':['Supervisor','Unit Controller'],'approve_pr':['Manager'],'reject_pr':['Manager'],'approve_dri_qa':['Supervisor','Manager'],'reject_dri_qa':['Supervisor','Manager'],'inspect_lot':['Supervisor']}.items():
    ACTIONS[name]={'level':'APPROVE','roles':roles}
for name in ['request_reading','gate_check','deviation_analyze','deviation_explain','correction_plan','correction_explain','full_analysis','agent_analyze','agent_explain','mechanical_predict','supplier_plan','semantic_search']:
    ACTIONS[name]={'level':'ASK','roles':[]}

NEVER=re.compile(r'\b(delete|remove|reset|override|clear\s+chat|edit\s+(grade|price|training)|receive\s+(lot|additive)|dri\s+lab|manual\s+(?:lot\s+)?(?:release|reject)|issue\s+invoice|approve\s+tap|accept\s+strategy|apply\s+(?:ahp|criteria)\s+weights)\b|HOLD.*(?:override|bypass)|(?:override|bypass).*HOLD|நீக்கு|அழி|ஓவர்ரைடு|हटाओ|मिटाओ|ओवरराइड',re.I)
def forbidden(*parts):return bool(NEVER.search(' '.join(str(p) for p in parts)))

ACTIONS.update({name:{'level':'APPROVE','roles':['Supervisor','Manager']} for name in ['accept_strategy','approve_tap']})

SCOPE_ROLES={'receive_lot': ['Operator', 'Supervisor'], 'receive_alloy': ['Operator', 'Supervisor'], 'dri_entry': ['Operator', 'Supervisor'], 'plan_heat': ['Operator', 'Supervisor'], 'edit_charge': ['Operator', 'Supervisor'], 'create_pr': ['Operator', 'Supervisor'], 'issue_invoice': ['Manager'], 'create_grade': ['Manager'], 'edit_grade': ['Manager'], 'edit_prices': ['Manager'], 'create_training': ['Supervisor', 'Manager'], 'edit_training': ['Supervisor', 'Manager'], 'apply_ahp': ['Manager'], 'apply_weights': ['Manager'], 'release_lot': ['Manager'], 'reject_lot': ['Manager'], 'replace_argon': ['Operator', 'Supervisor'], 'override_start': ['Unit Controller'], 'delete_reading': ['Supervisor', 'Manager'], 'delete_grade': ['Supervisor', 'Manager'], 'delete_training': ['Supervisor', 'Manager'], 'reset_demo': ['Manager'], 'clear_chat': ['Supervisor', 'Manager']}
ACTIONS.update({name:{"level":"APPROVE","roles":roles} for name,roles in SCOPE_ROLES.items()})
SCOPE_ACTIONS=set(SCOPE_ROLES)|{"accept_strategy","approve_tap"}

CONFIRM_WORDS={'override_start':'OVERRIDE','delete_reading':'DELETE','delete_grade':'DELETE','delete_training':'DELETE','reset_demo':'RESET','clear_chat':'CLEAR'}
for name,word in CONFIRM_WORDS.items():ACTIONS[name]['confirm_word']=word
