from unittest.mock import Mock
import pytest
from app.copilot import gnani_client as g

@pytest.mark.parametrize('purpose,enabled,expected',[('command',True,'indic-auto'),('command',False,'hi-IN'),('private',True,'hi-IN'),('passcode',True,'hi-IN'),('wake',True,'hi-IN'),('form',True,'hi-IN'),('confirmation',True,'hi-IN')])
def test_auto_is_command_only(monkeypatch,tmp_path,purpose,enabled,expected):
 for key,value in {'GNANI_API_KEY':'test-only','GNANI_MOCK':'false','LANG_BRIDGE':'false','STT_CONTEXT_ENABLED':'false','STT_AUTO_LANGUAGE':str(enabled),'GNANI_TTS_CACHE_DIR':str(tmp_path),'GNANI_STT_MODEL':'prisma-v3.0'}.items():monkeypatch.setenv(key,value)
 post=Mock(return_value=Mock(status_code=200,json=lambda:{'transcript':'क्या स्थिति है','detected_language_code':'hi-IN'}));monkeypatch.setattr(g,'provider_post',post)
 result=g.GnaniClient().transcribe(g._silent_wav(),'hi-IN',purpose=purpose,max_attempts=1)
 assert post.call_args.kwargs['data']['language_code']==expected
 assert result['detected_language_code']=='hi-IN'
 if purpose=='command' and enabled:assert post.call_args.kwargs['data']['format']=='codemix'
 if purpose in {'private','passcode','wake'}:assert 'keyterms' not in post.call_args.kwargs['data']
