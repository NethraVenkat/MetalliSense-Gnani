"""
Voice Services for AI Copilot
Handles Speech-to-Text and Text-to-Speech

STT: Groq Whisper (unchanged, already working in this project).
TTS: ElevenLabs (default when ELEVENLABS_API_KEY is set) with automatic
     per-request fallback to gTTS if ElevenLabs errors or is unreachable.

⚠️ The ElevenLabs path has NOT been tested against a live API call — no
ElevenLabs key is available in the environment this was built in, and
api.elevenlabs.io is not reachable from that sandbox at all. The request
shape matches ElevenLabs' public REST API docs exactly, but you are the
first to actually call it. If it errors, paste the exact error and it can
be fixed from the real response instead of guesswork.
"""
import os
import requests
from pathlib import Path
from typing import BinaryIO, Optional, Dict
import io

# Speech-to-Text: Groq Whisper API
from groq import Groq

# Text-to-Speech: gTTS (Google Text-to-Speech - Free, default)
from gtts import gTTS

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
# Default voice: "Rachel", a standard premade ElevenLabs voice. Override
# with ELEVENLABS_VOICE_ID for a different one (see elevenlabs.io/app/voice-library).
DEFAULT_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # "George" — same voice as eleven.py
DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2"


class VoiceService:
    """
    Voice interaction service for AI Copilot

    Features:
    - Speech-to-Text using Groq Whisper
    - Text-to-Speech using gTTS (default) or ElevenLabs (if configured)
    - Multiple language support
    - Audio file handling
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: Groq API key for Whisper (STT). TTS provider/key is
                     configured separately via TTS_PROVIDER / ELEVENLABS_API_KEY.
        """
        # STT (Groq Whisper) and TTS (ElevenLabs / gTTS) are independent:
        # a missing Groq key only disables transcription, never read-aloud.
        self.api_key = (api_key or os.getenv('GROQ_API_KEY') or '').strip()
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        self.whisper_model = "whisper-large-v3"
        if not self.client:
            print("⚠️  GROQ_API_KEY not set — speech-to-text disabled, text-to-speech still works.")

        self.tts_provider = os.getenv("TTS_PROVIDER", "elevenlabs").strip().lower()
        self.elevenlabs_api_key = (os.getenv("ELEVENLABS_API_KEY") or "").strip()
        self.elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE_ID).strip()
        self.elevenlabs_model = os.getenv("ELEVENLABS_MODEL", DEFAULT_ELEVENLABS_MODEL).strip()
        self.last_provider_used = None
        self.last_error = None

        if self.tts_provider == "elevenlabs" and not self.elevenlabs_api_key:
            print("⚠️  TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY is not set — "
                  "falling back to gTTS for text-to-speech.")
            self.tts_provider = "gtts"
        print(f"🔊 TTS provider: {self.tts_provider}"
              + (f" (voice {self.elevenlabs_voice_id}, model {self.elevenlabs_model})" if self.tts_provider == "elevenlabs" else ""))

    def transcribe_audio(
        self,
        audio_file: BinaryIO,
        language: str = "en"
    ) -> Dict[str, str]:
        """Convert speech to text using Groq Whisper."""
        if not self.client:
            return {"text": "", "error": "GROQ_API_KEY not configured", "success": False}
        try:
            transcription = self.client.audio.transcriptions.create(
                file=audio_file,
                model=self.whisper_model,
                language=language,
                response_format="json"
            )
            return {"text": transcription.text, "language": language, "success": True}
        except Exception as e:
            return {"text": "", "error": str(e), "success": False}

    def text_to_speech(
        self,
        text: str,
        language: str = "en",
        slow: bool = False
    ) -> bytes:
        """
        Convert text to speech. Uses ElevenLabs if configured and available,
        otherwise gTTS (default, already-working behavior).
        """
        if self.tts_provider == "elevenlabs":
            audio = self._elevenlabs_tts(text)
            if audio:
                self.last_provider_used = "elevenlabs"
                return audio
            print("ElevenLabs TTS failed — falling back to gTTS for this request.")

        self.last_provider_used = "gtts"
        return self._gtts_tts(text, language, slow)

    def _gtts_tts(self, text: str, language: str = "en", slow: bool = False) -> bytes:
        try:
            tts = gTTS(text=text, lang=language, slow=slow)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            return audio_buffer.read()
        except Exception as e:
            print(f"TTS Error: {e}")
            return b""

    def _elevenlabs_tts(self, text: str) -> Optional[bytes]:
        """
        Calls ElevenLabs' text-to-speech REST API directly.
        Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
        """
        if not self.elevenlabs_api_key:
            return None
        try:
            url = f"{ELEVENLABS_API_URL}/{self.elevenlabs_voice_id}?output_format=mp3_44100_128"
            headers = {
                "xi-api-key": self.elevenlabs_api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            }
            payload = {
                "text": text,
                "model_id": self.elevenlabs_model,
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            }
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.status_code == 200 and response.content:
                self.last_error = None
                return response.content
            self.last_error = f"{response.status_code}: {response.text[:300]}"
            print(f"ElevenLabs TTS error: {self.last_error}")
            return None
        except Exception as e:
            self.last_error = str(e)
            print(f"ElevenLabs TTS request failed: {e}")
            return None

    def status(self) -> Dict:
        """Non-secret summary of voice configuration for the UI / health checks."""
        return {
            "tts_provider": self.tts_provider,
            "elevenlabs_configured": bool(self.elevenlabs_api_key),
            "elevenlabs_voice_id": self.elevenlabs_voice_id,
            "elevenlabs_model": self.elevenlabs_model,
            "stt_available": self.client is not None,
            "last_provider_used": self.last_provider_used,
            "last_error": self.last_error,
        }

    def text_to_speech_file(
        self,
        text: str,
        output_path: str,
        language: str = "en",
        slow: bool = False
    ) -> bool:
        """Convert text to speech and save to file (uses whichever provider is active)."""
        try:
            audio_bytes = self.text_to_speech(text, language, slow)
            if not audio_bytes:
                return False
            with open(output_path, "wb") as f:
                f.write(audio_bytes)
            return True
        except Exception as e:
            print(f"TTS File Error: {e}")
            return False

    def get_supported_languages(self) -> Dict[str, str]:
        """Language support depends on the active TTS provider — this list
        reflects gTTS's common languages; ElevenLabs supports a similar
        but not identical set (multilingual_v2 model covers ~29 languages)."""
        return {
            "en": "English", "es": "Spanish", "fr": "French", "de": "German",
            "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
            "ko": "Korean", "zh": "Chinese", "hi": "Hindi", "ar": "Arabic"
        }

    def get_tts_provider(self) -> str:
        """Which TTS backend is actually active right now."""
        return self.tts_provider


# Singleton instance
_voice_service_instance = None

def get_voice_service() -> VoiceService:
    """Get or create voice service instance"""
    global _voice_service_instance
    if _voice_service_instance is None:
        _voice_service_instance = VoiceService()
    return _voice_service_instance
