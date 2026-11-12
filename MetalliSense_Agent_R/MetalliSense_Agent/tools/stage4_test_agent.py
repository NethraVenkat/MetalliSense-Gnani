"""Full-service localhost diagnostic, production models + isolated mock voice.

No provider calls, real credentials, production audit/audio or model writes.
Uses the existing symbolic private-reply queue; never prints captured replies.
"""
import os
import sys
from pathlib import Path
if os.getenv('ROUND2_REAL_APP_TEST') != 'true':
    raise SystemExit('Explicit isolated test mode required')
sys.path.insert(0, str(Path(__file__).resolve().parent))
import round2_test_agent as fixture
from copilot.evon_explainer import EvonCopilot
from inference.anomaly_predict import get_anomaly_predictor
from inference.alloy_predict import get_alloy_predictor
from agents.agent_manager import get_agent_manager
from rl import get_rl_engine
fixture.main.anomaly_predictor = get_anomaly_predictor()
fixture.main.alloy_predictor = get_alloy_predictor()
fixture.main.agent_manager = get_agent_manager()
fixture.main.rl_engine = get_rl_engine()
# Feedback remains functional but its persistence is confined to this test's temp store.
import rl.policy as policy
import rl.feedback_store as feedback
isolated=Path(fixture.temporary.name)
policy.append_feedback=lambda event: feedback.append_feedback(event)
model_save=fixture.main.rl_engine.reward_model.save
fixture.main.rl_engine.reward_model.save=lambda: model_save(isolated/'rl_reward_model.pkl',isolated/'rl_reward_model_state.json')
for name,value in vars(feedback).copy().items():
    if isinstance(value,Path) and ('feedback' in name.lower() or 'path' in name.lower()):
        setattr(feedback,name,isolated/value.name)
fixture.main.copilot=EvonCopilot()
fixture.main.indexer.build_index()
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(fixture.main.app,host='127.0.0.1',port=int(sys.argv[1]),lifespan='off',access_log=False,log_level='warning')
