"""Verify the script-launch import path in a clean, isolated interpreter."""
import os
from pathlib import Path
import subprocess
import sys


def test_script_runtime_path_posts_mocked_wake_wav_without_tools():
    root=Path(__file__).resolve().parents[1]
    # -I removes pytest's PYTHONPATH/cwd injection. app/ is exactly the path
    # Python supplies for `python app/main.py`; site-packages remain available.
    code=r'''
import io, json, os, sys, wave
from pathlib import Path
from types import SimpleNamespace
root=Path.cwd()
sys.path.insert(0,str(root/'app'))
assert str(root) not in sys.path and '' not in sys.path
import importlib.abc
class NoTooling(importlib.abc.MetaPathFinder):
    def find_spec(self,fullname,path=None,target=None):
        if fullname=='tools' or fullname.startswith('tools.'):
            raise AssertionError('Runtime must not import offline tools')
sys.meta_path.insert(0,NoTooling())
import requests
calls=[]
def post(url,**kwargs):
    calls.append((url,kwargs))
    assert kwargs['data']=={'model':'prisma-v3.0','language_code':'ta-IN,en-IN','format':'codemix'}
    return SimpleNamespace(status_code=200,json=lambda:{'success':True,'transcript':'Kural, carbon?'})
from copilot.provider_calls import _state
_state.session.post=post
# Any accidental unmocked transport fails closed, with no provider call.
requests.sessions.Session.request=lambda *a,**k: (_ for _ in ()).throw(AssertionError('No live HTTP'))
import main
os.environ.update(WAKE_WORD_ENABLED='true',GNANI_MOCK='false',GNANI_API_KEY='synthetic-test-key',GNANI_BASE_URL='https://api.vachana.ai')
from fastapi.testclient import TestClient
buffer=io.BytesIO()
with wave.open(buffer,'wb') as w:
    w.setparams((1,2,16000,0,'NONE','not compressed'))
    w.writeframes(bytes(48000))
response=TestClient(main.app).post('/copilot/voice/wake-check',files={'audio':('wake.wav',buffer.getvalue(),'audio/wav')})
assert response.status_code==200,response.text
assert response.json()=={'wake':True,'transcript':'Kural, carbon?','remainder':'carbon'}
assert len(calls)==1 and calls[0][0]=='https://api.vachana.ai/stt/v3'
assert not any(n=='tools' or n.startswith('tools.') for n in sys.modules)
print('script-runtime wake-check: 200; one mocked provider request; no tools imports')
'''
    env={**os.environ,'GNANI_MOCK':'true','PYTHONIOENCODING':'utf-8'}
    result=subprocess.run([sys.executable,'-I','-X','utf8','-c',code],cwd=root,env=env,capture_output=True,text=True,encoding='utf8',timeout=45)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
    assert 'script-runtime wake-check: 200' in result.stdout


def test_app_package_has_no_tooling_imports():
    import ast
    root=Path(__file__).resolve().parents[1]
    for path in (root/'app').rglob('*.py'):
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8-sig'))):
            if isinstance(node,ast.ImportFrom):
                assert not (node.module or '').startswith('tools'),str(path)
            if isinstance(node,ast.Import):
                assert all(not alias.name.startswith('tools') for alias in node.names),str(path)


def test_audition_reexports_shared_rules_and_cli_help_is_standalone():
    from app.copilot import wake_rules
    from tools import kural_gnani_wake_test as audition
    for name in ('FIELDS','RULE','RULE_V2','payload_fields','wake','first_word_wake','wake_parts'):
        assert getattr(audition,name) is getattr(wake_rules,name)
    root=Path(__file__).resolve().parents[1]
    result=subprocess.run([sys.executable,'-I','-X','utf8',str(root/'tools/kural_gnani_wake_test.py'),'--help'],cwd=root,capture_output=True,text=True,encoding='utf8',timeout=15)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
    assert '--variant' in result.stdout
