import asyncio
import importlib.util
import io
import json
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock,AsyncMock

import httpx
import pytest
import requests
from app.copilot import voice_clone as clone
from app.copilot.gnani_client import GnaniClient,_silent_wav
from app.copilot.gnani_tts_stream import speak_events
from app.copilot.schemas import TTSRequest

spec=importlib.util.spec_from_file_location('embedding_tool',Path(__file__).parents[1]/'tools/f12_make_voice_embedding.py')
tool=importlib.util.module_from_spec(spec);spec.loader.exec_module(tool)
EMBED={'embedding':'private-tensor','shape':[1,768],'dtype':'torch.bfloat16'}


@pytest.fixture
def setup(monkeypatch,tmp_path):
    monkeypatch.setattr(clone,'CLONE_DIR',tmp_path/'private');clone.CLONE_DIR.mkdir()
    (clone.CLONE_DIR/'CONSENT.txt').write_text('Consenting team member reference',encoding='utf-8')
    (clone.CLONE_DIR/'embedding.json').write_text(json.dumps(EMBED))
    for name,value in {'GNANI_API_KEY':'private-key','GNANI_MOCK':'false','GNANI_VOICE_CLONE':'on',
        'GNANI_CLONE_EMBEDDING_MODE':'per_language','GNANI_TTS_MODEL':'timbre-v3.0','GNANI_TTS_VOICE':'Kalpana',
        'GNANI_TTS_CACHE_DIR':str(tmp_path/'cache'),'GNANI_TTS_CLARITY':'off','GNANI_TTS_SPEED':''}.items():monkeypatch.setenv(name,value)
    monkeypatch.setattr(requests,'post',Mock(side_effect=AssertionError('No live HTTP')))
    return GnaniClient()


@pytest.mark.parametrize('duration',[4.9,30.1])
def test_duration_limits(setup,tmp_path,duration):
    path=tmp_path/'reference.wav';path.write_bytes(_silent_wav(duration,16000))
    with pytest.raises(ValueError,match='duration'):tool.prepare_audio(path)


@pytest.mark.parametrize('consent',[None,'','   '])
def test_consent_required_before_http(setup,tmp_path,consent):
    path=clone.CLONE_DIR/'CONSENT.txt'
    if consent is None:path.unlink()
    else:path.write_text(consent)
    with pytest.raises(ValueError,match='consent'):tool.make_embedding(tmp_path/'reference.wav','embedding',setup)
    requests.post.assert_not_called()
    assert clone.load_embedding('ta') is None


@pytest.mark.parametrize('suffix',['.wav','.m4a','.mp4'])
def test_formats_embedding_saved_nothing_printed(setup,monkeypatch,tmp_path,capsys,suffix):
    audio=_silent_wav(5,16000);path=tmp_path/('reference'+suffix);path.write_bytes(audio)
    if suffix!='.wav':
        run=Mock(return_value=SimpleNamespace(stdout=audio));monkeypatch.setattr(tool.subprocess,'run',run)
        monkeypatch.setattr(tool.shutil,'which',lambda _: 'ffmpeg')
    post=Mock(return_value=Mock(status_code=200,json=lambda:{'data':{'voice_clone_embedding':EMBED}}))
    monkeypatch.setattr(requests,'post',post)
    result=tool.make_embedding(path,'embedding_en',setup)
    assert json.loads(result.read_text())==EMBED and post.call_count==1
    assert 'audio_file' in post.call_args.kwargs['files']
    assert not capsys.readouterr().out


def test_private_errors_and_invalid_output(setup,monkeypatch,tmp_path,capsys):
    path=tmp_path/'reference.wav';path.write_bytes(_silent_wav(5,16000))
    with pytest.raises(ValueError):tool.make_embedding(path,'../leak',setup)
    monkeypatch.setattr(requests,'post',Mock(side_effect=RuntimeError('private-key private-tensor provider-body')))
    with pytest.raises(ValueError) as error:tool.make_embedding(path,'embedding',setup)
    assert str(error.value)=='embedding_request_failed' and not capsys.readouterr().out


def test_per_language_single_and_main_fallback(setup,monkeypatch):
    other={**EMBED,'embedding':'other-tensor'}
    (clone.CLONE_DIR/'embedding_hi.json').write_text(json.dumps(other))
    assert clone.load_embedding('hi-IN')[0]==other
    assert clone.load_embedding('en-IN')[0]==EMBED
    monkeypatch.setenv('GNANI_CLONE_EMBEDDING_MODE','single')
    assert clone.load_embedding('hi')[0]==EMBED


def test_clone_rest_cache_hash_and_no_secrets(setup,monkeypatch,capsys,caplog):
    post=Mock(return_value=Mock(status_code=200,content=_silent_wav()))
    monkeypatch.setattr(requests,'post',post)
    assert setup.synthesize('<slow> short text','hi',voice='supervisor')
    payload=post.call_args.kwargs['json']
    assert payload['model']=='vachana-vc-v1' and payload['speaker_embedding']==EMBED
    assert payload['text']=='short text' and not {'voice','language','speed'}&payload.keys()
    assert setup.synthesize('<slow> short text','hi',voice='supervisor') and post.call_count==1
    assert setup.last_tts_source=='cache'
    digest=clone.load_embedding('hi')[1]
    path=setup._cache_path('short text','hi-IN','supervisor:'+digest,model=clone.CLONE_MODEL)
    assert path.exists()
    (clone.CLONE_DIR/'embedding.json').write_text(json.dumps({**EMBED,'embedding':'replacement'}))
    assert setup.synthesize('<slow> short text','hi',voice='supervisor') and post.call_count==2
    logs=capsys.readouterr().out+caplog.text
    assert 'private-tensor' not in logs and 'private-key' not in logs
    assert 'private-tensor' not in json.dumps(clone.clone_status())


@pytest.mark.parametrize('failure',[requests.Timeout(),requests.ConnectionError(),None])
def test_clone_failure_falls_back_to_existing_voice(setup,monkeypatch,failure):
    post=Mock(side_effect=[failure or Mock(status_code=500,content=b'private-tensor'),Mock(status_code=200,content=_silent_wav())])
    monkeypatch.setattr(requests,'post',post)
    assert setup.synthesize('text','ta',voice='supervisor')
    assert post.call_args_list[1].kwargs['json']['voice']=='Kalpana'
    assert setup.last_provider_used=='gnani:timbre-v3.0:Kalpana'


def test_disabled_and_missing_consent_use_normal_path(setup,monkeypatch):
    monkeypatch.setenv('GNANI_VOICE_CLONE','off')
    post=Mock(return_value=Mock(status_code=200,content=_silent_wav()));monkeypatch.setattr(requests,'post',post)
    assert setup.synthesize('text','ta',voice='supervisor')
    assert post.call_args.kwargs['json']['voice']=='Kalpana'
    assert clone.clone_status()['state']=='configured'
    (clone.CLONE_DIR/'CONSENT.txt').unlink()
    assert clone.clone_status()['state']=='not configured'


def test_clone_stream_payload_cache_and_fallback(setup,monkeypatch):
    audio='AQACAAMA'
    async def send(self,request,**kwargs):
        payload=json.loads(request.content)
        assert payload['speaker_embedding']==EMBED and payload['audio_config']['container']=='raw'
        assert not {'voice','language','speed'}&payload.keys()
        return httpx.Response(200,content=f'event: chunk\ndata: {{"audio":"{audio}"}}\n\nevent: complete\ndata: {{}}\n\n'.encode(),request=request)
    monkeypatch.setattr(httpx.AsyncClient,'send',send)
    service=SimpleNamespace(gnani=setup,tts_provider='gnani',text_to_speech=Mock(return_value=_silent_wav()),last_media_type='audio/wav',last_provider_used='normal')
    async def collect():return [item async for item in speak_events(service,'short text','ta',voice='supervisor')]
    rows=asyncio.run(collect());assert 'private-tensor' not in ''.join(rows) and 'private-key' not in ''.join(rows)
    assert 'complete' in rows[-1]
    assert 'cache' in asyncio.run(collect())[0]
    monkeypatch.setattr(httpx.AsyncClient,'send',AsyncMock(side_effect=RuntimeError('private-tensor')))
    async def failed():return [item async for item in speak_events(service,'other text','ta',voice='supervisor')]
    assert 'private-tensor' not in ''.join(asyncio.run(failed()))
    service.text_to_speech.assert_called_once_with('other text','ta',False,'normal')


def test_status_and_request_no_embeddings(setup):
    assert clone.clone_status()=={'enabled':True,'state':'configured','languages':['ta','en','hi']}
    assert TTSRequest(text='text',voice='supervisor').voice=='supervisor'
    assert 'embedding' not in TTSRequest(text='text',voice='supervisor').model_dump()


def test_routes_forward_only_supervisor_and_report_private_status(setup,monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    from copilot import voice_clone as route_clone
    monkeypatch.setattr(route_clone,'CLONE_DIR',clone.CLONE_DIR)
    service=Mock(last_media_type='audio/wav',last_provider_used='gnani:vachana-vc-v1:supervisor')
    service.text_to_speech.return_value=_silent_wav()
    service.status.return_value={'last_provider_used':'gnani:vachana-vc-v1:supervisor'}
    monkeypatch.setattr(main,'voice_service',service)
    api=TestClient(main.app)
    response=api.post('/copilot/voice/synthesize',json={'text':'HOLD','language':'ta','style':'alert','voice':'supervisor'})
    assert response.status_code==200 and response.content.startswith(b'RIFF')
    service.text_to_speech.assert_called_once_with(text='HOLD',language='ta',slow=False,style='alert',voice='supervisor')
    status=api.get('/copilot/voice/status').json()
    assert status['clone']['state']=='configured'
    for secret in ('private-key','private-tensor','CONSENT.txt','speaker_embedding'):
        assert secret not in response.text and secret not in json.dumps(status)
    assert api.post('/copilot/voice/synthesize',json={'text':'x','voice':'unknown'}).status_code==422


def test_clone_failure_continues_v25_then_gtts(setup,monkeypatch):
    from app.copilot.voice_service import VoiceService
    monkeypatch.setenv('STT_PROVIDER','gnani');monkeypatch.setenv('TTS_PROVIDER','gnani')
    monkeypatch.setattr('app.copilot.voice_service.get_gnani_client',lambda:setup)
    service=VoiceService()
    post=Mock(side_effect=[requests.Timeout(),Mock(status_code=503,content=b'',text='unavailable'),
                           Mock(status_code=503,content=b'',text='unavailable')])
    monkeypatch.setattr(requests,'post',post)
    monkeypatch.setattr(service,'_gtts_tts',Mock(return_value=b'mp3'))
    assert service.text_to_speech('text','hi',voice='supervisor')==b'mp3'
    assert [call.kwargs['json']['model'] for call in post.call_args_list]==['vachana-vc-v1','timbre-v3.0','timbre-v2.5']
    assert service.last_provider_used=='gtts'


def test_invalid_embedding_falls_back_and_cli_rejects_unknown_format(setup,tmp_path):
    (clone.CLONE_DIR/'embedding.json').write_text('{broken')
    assert clone.load_embedding('ta') is None and clone.clone_status()['state']=='not configured'
    with pytest.raises(ValueError,match='format'):tool.prepare_audio(tmp_path/'reference.exe')
