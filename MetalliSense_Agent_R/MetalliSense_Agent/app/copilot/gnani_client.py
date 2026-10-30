"""
Gnani AI (Vachana) client — Prisma speech-to-text and Timbre text-to-speech.

Selected in voice_service.py with STT_PROVIDER=gnani and/or TTS_PROVIDER=gnani.

Mock mode is ON automatically when GNANI_API_KEY is empty (or GNANI_MOCK=true):
no network calls are made, so the rest of the app can be developed and tested
without spending credits.

STT needs ffmpeg on PATH to convert browser audio (webm/ogg/mp3) to 16 kHz
mono WAV. Windows: winget install ffmpeg
"""
import hashlib
import io
import os
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Dict, Optional

import requests

DEFAULT_BASE_URL = "https://api.vachana.ai"
# Relative cache paths are resolved against the MetalliSense_Agent folder,
# so the cache lands in the same place no matter where the server starts from.
_AGENT_ROOT = Path(__file__).resolve().parent.parent.parent

_SHORT_TO_LOCALE = {
    "en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN",
    "ml": "ml-IN", "mr": "mr-IN", "bn": "bn-IN", "gu": "gu-IN", "pa": "pa-IN",
}

INDIAN_LANGUAGES = {
    "en-IN": "English (India)", "hi-IN": "Hindi", "ta-IN": "Tamil",
    "te-IN": "Telugu", "kn-IN": "Kannada", "ml-IN": "Malayalam",
    "mr-IN": "Marathi", "bn-IN": "Bengali", "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
}

MOCK_TRANSCRIPT = "Heat 42 status enna?"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def to_gnani_language(code: Optional[str], default: str = "ta-IN") -> str:
    """Map short codes (ta, hi, en...) to Gnani locale codes (ta-IN...).
    Codes that already contain '-' are passed through unchanged."""
    if not code or not str(code).strip():
        return default
    code = str(code).strip()
    if "-" in code:
        return code
    return _SHORT_TO_LOCALE.get(code.lower(), default)


def _is_wav(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"


def _silent_wav(seconds: float = 0.4, sample_rate: int = 22050) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"\x00\x00" * int(seconds * sample_rate))
    return buf.getvalue()


class GnaniClient:
    """Thin REST client for Gnani Prisma (STT) and Timbre (TTS)."""

    def __init__(self):
        self.api_key = (os.getenv("GNANI_API_KEY") or "").strip()
        self.base_url = (os.getenv("GNANI_BASE_URL") or DEFAULT_BASE_URL).strip().rstrip("/")
        self.mock = _env_bool("GNANI_MOCK") or not self.api_key

        self.stt_language = os.getenv("GNANI_STT_LANGUAGE", "ta-IN").strip() or "ta-IN"
        self.stt_format = os.getenv("GNANI_STT_FORMAT", "transcribe").strip() or "transcribe"

        self.tts_model = os.getenv("GNANI_TTS_MODEL", "timbre-v2.5").strip() or "timbre-v2.5"
        self.tts_voice = (os.getenv("GNANI_TTS_VOICE") or "").strip()
        self.tts_language = os.getenv("GNANI_TTS_LANGUAGE", "ta-IN").strip() or "ta-IN"
        try:
            self.tts_sample_rate = int(os.getenv("GNANI_TTS_SAMPLE_RATE", "22050"))
        except ValueError:
            self.tts_sample_rate = 22050

        cache_dir = Path(os.getenv("GNANI_TTS_CACHE_DIR", "app/data/tts_cache"))
        self.tts_cache_dir = cache_dir if cache_dir.is_absolute() else _AGENT_ROOT / cache_dir

        self.stats = {"stt_calls": 0, "tts_calls": 0, "tts_cache_hits": 0}
        self.last_error: Optional[str] = None

        print(f"🗣️  Gnani client: {'MOCK (no network calls)' if self.mock else self.base_url}"
              f" | STT {self.stt_language} | TTS {self.tts_model} {self.tts_language}")

    def _headers(self, json_body: bool = False) -> Dict[str, str]:
        headers = {"X-API-Key-ID": self.api_key}
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    # ------------------------------------------------------------------ STT

    def _to_wav_16k(self, audio_bytes: bytes) -> bytes:
        """Convert any ffmpeg-readable audio to 16 kHz mono 16-bit WAV."""
        if _is_wav(audio_bytes):
            return audio_bytes
        if not shutil.which("ffmpeg"):
            raise RuntimeError(
                "ffmpeg not found on PATH — it is needed to convert audio for Gnani STT. "
                "Install it (Windows: winget install ffmpeg, macOS: brew install ffmpeg, "
                "Linux: apt install ffmpeg) and restart the server."
            )
        proc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
             "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", "-f", "wav", "pipe:1"],
            input=audio_bytes, capture_output=True, timeout=60,
        )
        if proc.returncode != 0 or not proc.stdout:
            raise RuntimeError(f"ffmpeg conversion failed: {proc.stderr.decode(errors='ignore')[:300]}")
        return proc.stdout

    def transcribe(self, audio_bytes: bytes, language: Optional[str] = None) -> Dict:
        lang = to_gnani_language(language, self.stt_language)
        if self.mock:
            return {"text": MOCK_TRANSCRIPT, "language": lang, "success": True}
        try:
            wav = self._to_wav_16k(audio_bytes)
            self.stats["stt_calls"] += 1
            response = requests.post(
                f"{self.base_url}/stt/v3",
                headers=self._headers(),
                files={"audio_file": ("audio.wav", wav, "audio/wav")},
                data={"language_code": lang, "format": self.stt_format},
                timeout=60,
            )
            if response.status_code != 200:
                self.last_error = f"STT {response.status_code}: {response.text[:300]}"
                return {"text": "", "language": lang, "success": False, "error": self.last_error}
            text = (response.json().get("transcript") or "").strip()
            self.last_error = None
            return {"text": text, "language": lang, "success": True}
        except Exception as e:
            self.last_error = f"STT: {e}"
            return {"text": "", "language": lang, "success": False, "error": str(e)}

    # ------------------------------------------------------------------ TTS

    def _cache_path(self, text: str, lang: str, voice: str) -> Path:
        key = f"{self.tts_model}|{voice}|{lang}|{self.tts_sample_rate}|{text}"
        return self.tts_cache_dir / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}.wav"

    def synthesize(self, text: str, language: Optional[str] = None,
                   voice: Optional[str] = None) -> Optional[bytes]:
        """Returns WAV bytes, or None on failure."""
        if not text or not text.strip():
            return None
        if self.mock:
            return _silent_wav(0.4, self.tts_sample_rate)

        lang = to_gnani_language(language, self.tts_language)
        voice = (voice or self.tts_voice or "").strip()
        cache_file = self._cache_path(text, lang, voice)
        if cache_file.exists():
            self.stats["tts_cache_hits"] += 1
            return cache_file.read_bytes()

        payload = {
            "text": text,
            "model": self.tts_model,
            "audio_config": {
                "sample_rate": self.tts_sample_rate,
                "encoding": "linear_pcm",
                "num_channels": 1,
                "sample_width": 2,
                "container": "wav",
            },
        }
        if voice:
            payload["voice"] = voice
        if self.tts_model == "timbre-v2.5":
            payload["language"] = lang

        try:
            self.stats["tts_calls"] += 1
            response = requests.post(
                f"{self.base_url}/api/v1/tts/inference",
                headers=self._headers(json_body=True),
                json=payload,
                timeout=60,
            )
            if response.status_code != 200 or not response.content:
                self.last_error = f"TTS {response.status_code}: {response.text[:300]}"
                print(f"Gnani TTS error: {self.last_error}")
                return None
            audio = response.content
            try:
                self.tts_cache_dir.mkdir(parents=True, exist_ok=True)
                cache_file.write_bytes(audio)
            except OSError as e:
                print(f"Gnani TTS cache write failed (continuing): {e}")
            self.last_error = None
            return audio
        except Exception as e:
            self.last_error = f"TTS: {e}"
            print(f"Gnani TTS request failed: {e}")
            return None

    def status(self) -> Dict:
        """Non-secret summary for health checks / the UI."""
        return {
            "mock": self.mock,
            "configured": bool(self.api_key),
            "base_url": self.base_url,
            "stt_language": self.stt_language,
            "stt_format": self.stt_format,
            "tts_model": self.tts_model,
            "tts_voice": self.tts_voice or "(API default)",
            "tts_language": self.tts_language,
            "tts_sample_rate": self.tts_sample_rate,
            "ffmpeg_available": shutil.which("ffmpeg") is not None,
            "stats": dict(self.stats),
            "last_error": self.last_error,
        }


_gnani_client_instance: Optional[GnaniClient] = None


def get_gnani_client() -> GnaniClient:
    """Get or create the Gnani client singleton."""
    global _gnani_client_instance
    if _gnani_client_instance is None:
        _gnani_client_instance = GnaniClient()
    return _gnani_client_instance
