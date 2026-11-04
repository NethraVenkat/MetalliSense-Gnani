from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
import pytest
from app.copilot import live_words

def client():
    app=FastAPI();app.include_router(live_words.router);return TestClient(app)

def test_disabled_never_requests_start_or_provider(monkeypatch):
    monkeypatch.delenv('LIVE_WORDS_ENABLED',raising=False)
    with client().websocket_connect('/ws/live-words',headers={'origin':'http://localhost:5173'}) as ws:
        assert ws.receive_json()=={'type':'unavailable','code':'disabled'}

@pytest.mark.parametrize('locale',['ta-IN','hi-IN','en-IN'])
def test_known_final_only_contract_is_honest(monkeypatch,locale):
    monkeypatch.setenv('LIVE_WORDS_ENABLED','true');monkeypatch.setattr(live_words,'provider_busy',lambda:False)
    with client().websocket_connect('/ws/live-words',headers={'origin':'http://localhost:5173'}) as ws:
        ws.send_json({'type':'start','locale':locale,'sample_rate':16000})
        assert ws.receive_json()=={'type':'unavailable','code':'partial_words_not_documented'}

def test_busy_never_waits_for_lease(monkeypatch):
    monkeypatch.setenv('LIVE_WORDS_ENABLED','true');monkeypatch.setattr(live_words,'provider_busy',lambda:True)
    with client().websocket_connect('/ws/live-words',headers={'origin':'http://localhost:5173'}) as ws:
        ws.send_json({'type':'start','locale':'ta-IN','sample_rate':16000});assert ws.receive_json()['code']=='lease_busy'

@pytest.mark.parametrize('locale',['ta-IN,en-IN','auto','xx'])
def test_invalid_locale_is_not_guessed(monkeypatch,locale):
    monkeypatch.setenv('LIVE_WORDS_ENABLED','true')
    with client().websocket_connect('/ws/live-words',headers={'origin':'http://localhost:5173'}) as ws:
        ws.send_json({'type':'start','locale':locale,'sample_rate':16000});assert ws.receive_json()['code']=='invalid_start'

def test_bad_origin_rejected(monkeypatch):
    with pytest.raises(WebSocketDisconnect):
        with client().websocket_connect('/ws/live-words',headers={'origin':'https://untrusted.invalid'}):pass
