"""All Agent tests are offline; transport changes must not escape their mocks."""
import pytest
import requests

@pytest.fixture(autouse=True)
def prohibit_live_requests(monkeypatch):
    def denied(*args,**kwargs):
        raise AssertionError('Unmocked HTTP is prohibited in Agent tests')
    monkeypatch.setattr(requests.Session,'request',denied)
