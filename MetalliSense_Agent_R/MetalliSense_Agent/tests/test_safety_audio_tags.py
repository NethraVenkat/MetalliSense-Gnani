import pytest
from app.copilot.gnani_client import tts_text

@pytest.mark.parametrize('text', ['Say yes or no.','ஆமா அல்லது இல்லை சொல்லுங்க.','हाँ या नहीं कहिए।'])
def test_confirmation_payload_only(monkeypatch,text):
    monkeypatch.setenv('TTS_AUDIO_TAGS','true');monkeypatch.setenv('GNANI_TTS_CLARITY','false')
    assert tts_text(text,'timbre-v3.0','normal',False)=='<pauses> '+text
    assert '<' not in text

def test_defaults_model_empty_and_readback(monkeypatch):
    monkeypatch.setenv('GNANI_TTS_CLARITY','false');monkeypatch.delenv('TTS_AUDIO_TAGS',raising=False)
    assert tts_text('Say your passcode.','timbre-v3.0','normal',False)=='Say your passcode.'
    monkeypatch.setenv('TTS_AUDIO_TAGS','true')
    assert tts_text('Say your passcode.','timbre-v3.0','normal',False)=='<pauses> <slow> Say your passcode.'
    # Exact existing approvalPrompt.ta, not a newly invented UI prompt.
    assert tts_text('உங்கள் அனுமதி குறியீட்டை சொல்லுங்க.','timbre-v3.0','normal',False)=='<pauses> <slow> உங்கள் அனுமதி குறியீட்டை சொல்லுங்க.'
    assert tts_text('H-1051: receive 4000 kg.','timbre-v3.0','normal',False).startswith('<slow>')
    assert tts_text('Say your passcode.','timbre-v2.5','normal',False)=='Say your passcode.'
    assert tts_text('<slow>','timbre-v3.0','normal',False)==''
    assert tts_text('ordinary answer','timbre-v3.0','normal',False)=='ordinary answer'
