import io
import wave
import pytest
from app.copilot import audio_validation as batch
from app.copilot.gnani_client import _silent_wav

def test_size_and_invalid_audio_are_rejected_before_network():
    with pytest.raises(batch.AudioValidationError, match='audio_size_limit'): batch.validate_audio(b'x' * (batch.MAX_BYTES + 1))
    with pytest.raises(batch.AudioValidationError, match='invalid_audio'): batch.validate_audio(b'not audio')


def test_decoded_duration_limit_and_supported_wave():
    data, duration = batch.validate_audio(_silent_wav(1))
    assert duration == 1
    with wave.open(io.BytesIO(data)) as audio:
        assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (16000,1,2)
    with pytest.raises(batch.AudioValidationError, match='audio_duration_limit'): batch.validate_audio(_silent_wav(90.1))
    with pytest.raises(batch.AudioValidationError, match='audio_duration_limit'): batch.validate_audio(_silent_wav(.05))


