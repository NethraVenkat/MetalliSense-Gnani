import asyncio
import json
from unittest.mock import Mock,AsyncMock

import pytest
from app.copilot import context_bias as bias
from app.copilot.gnani_client import GnaniClient,_silent_wav

def test_validation_sanitizing_and_bounds():
    assert bias.validate_terms(['H-1053','h-1053',' heat  1053 ','Cu','<|bad|>','கார்பன்','x'*65,1])==['H-1053','heat 1053','Cu']
    assert len(bias.validate_terms(['H-'+str(n) for n in range(300)]))==200
    assert bias.validate_terms({'type':'update_settings'})==[]

def test_static_first_dedupe_and_count_limit():
    static=['static'+str(n) for n in range(199)]
    assert bias.merge_terms(static,['STATIC0','H-1053','H-1052'])==static+['H-1053']
    assert bias.merge_terms('heat,Cu',['HEAT','H-1053'])==['heat','Cu','H-1053']

@pytest.mark.parametrize('setting',['off','on'])
def test_rest_flag_off_identical_and_on_merges(monkeypatch,tmp_path,setting):
    for key,value in {'GNANI_CONTEXT_BIAS':setting,'GNANI_API_KEY':'private-key','GNANI_MOCK':'false','LANG_BRIDGE':'off',
                      'GNANI_STT_KEYTERMS':'heat,carbon','GNANI_STT_MODEL':'prisma-v3.0','GNANI_STT_LANGUAGE':'ta-IN,en-IN','GNANI_STT_FORMAT':'codemix'}.items():monkeypatch.setenv(key,value)
    client=GnaniClient();post=Mock(return_value=Mock(status_code=200,json=lambda:{'transcript':'heat 1053'}))
    monkeypatch.setattr('requests.post',post)
    assert client.transcribe(_silent_wav(),'ta-IN,en-IN',context_terms=['H-1053','carbon','PIG-1053'],max_attempts=1)['success']
    data=post.call_args.kwargs['data']
    assert data=={'language_code':'ta-IN,en-IN','format':'codemix','model':'prisma-v3.0',
                  'keyterms':'heat,carbon' if setting=='off' else json.dumps(['heat','carbon','H-1053','PIG-1053'])}

def test_parse_context_off_ignores_and_on_validates(monkeypatch):
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','off');assert bias.parse_context('["H-1053"]') is None
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','on');assert bias.parse_context('["H-1053","<bad>"]')==['H-1053']
    assert bias.parse_context('bad')==[] and bias.parse_context('x'*20000)==[]

@pytest.mark.parametrize('score',[0,.5,1,1.5,2])
def test_documented_scores(monkeypatch,score):
    monkeypatch.setenv('GNANI_CONTEXT_BIAS_SCORE',str(score));assert bias.bias_score()==score

def test_stream_update_shape_debounce_ack_and_no_terms_in_logs(monkeypatch,caplog):
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','on');monkeypatch.setenv('GNANI_CONTEXT_BIAS_SCORE','1.5')
    monkeypatch.setattr(bias,'DEBOUNCE_SECONDS',.01);monkeypatch.setattr(bias,'ACK_SECONDS',1)
    caplog.set_level('INFO')
    async def run():
        upstream=Mock(send=AsyncMock());client=Mock(send_json=AsyncMock());updates=bias.BiasUpdates(upstream,client,'heat,carbon')
        updates.update(['H-1051']);updates.update(['H-1052']);updates.update(['H-1053','PIG-1053'])
        assert upstream.send.call_count==0
        await updates.task
        assert upstream.send.call_count==1
        assert json.loads(upstream.send.call_args.args[0])=={'type':'update_settings','bias':{'list':['heat','carbon','H-1053','PIG-1053'],'score':1.5}}
        await updates.acknowledged();client.send_json.assert_called_once_with({'type':'settings_updated','term_count':4})
        updates.update(['H-1053','PIG-1053']);await asyncio.sleep(.02);assert upstream.send.call_count==1
        await updates.close()
    asyncio.run(run())
    assert 'settings_updated' in caplog.text and 'H-1053' not in caplog.text and 'carbon' not in caplog.text

def test_ignored_unconfirmed_and_disabled_updates(monkeypatch,caplog):
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','on');monkeypatch.setattr(bias,'DEBOUNCE_SECONDS',.001);monkeypatch.setattr(bias,'ACK_SECONDS',.001)
    caplog.set_level('INFO')
    async def run():
        upstream=Mock(send=AsyncMock());client=Mock(send_json=AsyncMock());updates=bias.BiasUpdates(upstream,client,'heat')
        updates.update(['H-1053','<bad>']);await updates.task;await updates.ack_task
        assert 'ignored' in caplog.text
        assert json.loads(upstream.send.call_args.args[0])['bias']['list']==['heat','H-1053']
        assert client.send_json.call_args.args[0]['code']=='ignored'
        monkeypatch.setenv('GNANI_CONTEXT_BIAS','off');updates.update(['H-1052']);await asyncio.sleep(.01)
        assert upstream.send.call_count==1
        await updates.close()
    asyncio.run(run());assert 'H-1053' not in caplog.text and '<bad>' not in caplog.text

def test_route_form_validation_and_status(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    from copilot import context_bias as route_bias
    service=Mock();service.transcribe_audio.return_value={'text':'heat 1053','language':'ta','success':True};service.status.return_value={}
    monkeypatch.setattr(main,'voice_service',service);api=TestClient(main.app)
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','on')
    result=api.post('/copilot/voice/transcribe',files={'audio':('audio.wav',_silent_wav(),'audio/wav')},data={'context_terms':'["H-1053","<bad>"]'})
    assert result.status_code==200;assert service.transcribe_audio.call_args.kwargs=={'context_terms':['H-1053']}
    route_bias.merge_terms('heat',['H-1053'])
    status=api.get('/copilot/voice/status').json()
    assert status['context_bias'] is True and status['context_bias_last_term_count']==2
    assert 'H-1053' not in json.dumps(status)
    monkeypatch.setenv('GNANI_CONTEXT_BIAS','off')
    api.post('/copilot/voice/transcribe',files={'audio':('audio.wav',_silent_wav(),'audio/wav')},data={'context_terms':'["H-1053"]'})
    assert service.transcribe_audio.call_args.kwargs=={}
