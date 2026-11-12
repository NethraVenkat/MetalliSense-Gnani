import importlib.util
import sys
from pathlib import Path
import pytest

def test_not_before_gate_stops_before_env_or_transport(monkeypatch,capsys):
    path=Path(__file__).resolve().parents[1]/'tools/stage2_6_diagnostic.py'
    spec=importlib.util.spec_from_file_location('stage26_diagnostic_test',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    monkeypatch.setattr(sys,'argv',[str(path),'language','--native-tamil','--live','--not-before','2100-01-01T13:15:00+05:30'])
    with pytest.raises(SystemExit,match='zero calls'):module.main()

def test_frozen_trial_sizes_and_navigation_phrases():
    path=Path(__file__).resolve().parents[1]/'tools/stage2_6_diagnostic.py'
    spec=importlib.util.spec_from_file_location('stage26_plan_test',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    assert len(module.HINDI)==8 and len(module.NAV)==4
    assert [x[0] for x in module.NAV]==['spectrometer ku po','pre melt gate ku po','stock page ku po','spectrometer open pannu']

@pytest.mark.parametrize('status',[200,401,403])
def test_probe_makes_exactly_one_request_without_retry(monkeypatch,tmp_path,status,capsys):
    import json
    from unittest.mock import Mock
    from app.copilot import gnani_client,provider_calls
    import dotenv
    path=Path(__file__).resolve().parents[1]/'tools/stage2_6_probe.py'
    spec=importlib.util.spec_from_file_location('stage26_probe_test',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    source=tmp_path/'tools/local_wake_data/stage2_6-language-52bd9e1ccf2844d58849e504783853ba/Tanglish-1.wav';source.parent.mkdir(parents=True);source.write_bytes(gnani_client._silent_wav())
    fake=Mock(mock=False,base_url='https://api.vachana.ai',stt_model='prisma-v3.0',stt_keyterms='',api_key='test-only')
    fake._headers.return_value={'X-API-Key-ID':'test-only'}
    send=Mock(return_value=Mock(status_code=status,json=lambda:{'error':{'type':'FORBIDDEN'}}))
    monkeypatch.setattr(module,'ROOT',tmp_path);monkeypatch.setattr(dotenv,'load_dotenv',lambda *a,**kw:None)
    monkeypatch.setattr(gnani_client,'GnaniClient',lambda:fake);monkeypatch.setattr(provider_calls,'post',send)
    monkeypatch.setattr(sys,'argv',[str(path),'--live']);module.main()
    assert send.call_count==1
    records=list((tmp_path/'tools/local_wake_data').glob('stage2_6-probe-*/result.json'));assert len(records)==1
    record=json.loads(records[0].read_text(encoding='utf-8'));assert record['attempts']==1 and record['status']==status and record['success']==(status==200)
    assert 'test-only' not in capsys.readouterr().out
