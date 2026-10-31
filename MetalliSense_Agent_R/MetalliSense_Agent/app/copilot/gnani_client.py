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
import json
import logging
import math
import os
import re
import shutil
import subprocess
import time
import wave
from pathlib import Path
from typing import Dict, Optional

import requests

DEFAULT_BASE_URL = "https://api.vachana.ai"
DEFAULT_STT_KEYTERMS = "heat,carbon,silicon,manganese,phosphorus,sulphur,FeSi,FeMn,spectrometer,dashboard,premelt,status,stock,hold"
# https://docs.gnani.ai/api/TTS/available-voices.md (checked 2026-10-30).
V3_VOICES = frozenset("Shivani Lakshmi Kalpana Chetana Vasudha Riyaa Tarika Avinash Shubham Prakash Devansh Yashraj Harshad".split())
V25_VOICES = frozenset((
    "Ambuja Asmita Bhavna Brinda Chitra Deepak Devika Dhruva Falak Girish Hemraj Ishaan Jalaj Jwala "
    "Kaveri Kavin Kirra Lavanya Lehara Mehuli Nalini Noopur Omkar Poorvi Pranav Reshma Riyaan Roopesh "
    "Saanvi Shlok Suhana Trisha Trupti Urmila Varuni Vedika Veera Vikrant Yashvi Yukti Zahira Zayan "
    "Kamakshi"  # Existing deployment's legacy v2.5 voice; absent from today's public catalog.
).split())


def valid_tts_pair(model: str, voice: str) -> bool:
    return voice in {"timbre-v2.5": V25_VOICES, "timbre-v3.0": V3_VOICES}.get(model, ())


def tts_text(text: str, model: str, style: str, tags_enabled: bool) -> str:
    """Tags belong only to the provider payload, never to the frontend's text."""
    plain = re.sub(r"<[^>]+>", "", text).strip()
    if model.startswith('timbre-v3') and _env_bool('GNANI_TTS_CLARITY'):
        # Documented tags have no closing syntax. Slow persists to the next tag;
        # reapply it after each pause rather than inventing a normal/reset tag.
        parts = re.split(r'(?<=[.!?।])\s+', plain)
        return ' <pauses> '.join('<slow> ' + part for part in parts if part)
    if model.startswith("timbre-v3") and tags_enabled and style == "alert":
        # Tags have no closing form. Reapply slow after the pause changes scope.
        paused = re.sub(r"^(Heat\s+[^:]+:)\s*", r"\1 <pauses> <slow> ", plain, count=1)
        return f"<slow> {paused}"
    return plain
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


def stt_language(code: Optional[str]) -> str:
    """Normalize one locale, up to four locale hints, or indic-auto for Prisma."""
    parts = (code or "ta-IN").strip().split(",")
    if not 1 <= len(parts) <= 4 or any(not part.strip() for part in parts):
        raise ValueError("GNANI_STT_LANGUAGE needs one to four nonempty language codes")
    languages = [to_gnani_language(part.strip()) for part in parts]
    if "indic-auto" in languages and len(languages) != 1:
        raise ValueError("Use indic-auto alone, not in a language list")
    return ",".join(languages)


def get_stt_config() -> Dict[str, str]:
    """Shared request/cache configuration; reading it never initializes a client."""
    terms = ",".join(term.strip() for term in os.getenv("GNANI_STT_KEYTERMS", DEFAULT_STT_KEYTERMS).split(",") if term.strip())
    if terms and len(terms.split(",")) > 200:
        raise ValueError("GNANI_STT_KEYTERMS supports at most 200 comma-separated terms")
    output_format = os.getenv("GNANI_STT_FORMAT", "transcribe").strip() or "transcribe"
    if output_format not in {"verbatim", "transcribe", "codemix", "transliterate"}:
        raise ValueError("GNANI_STT_FORMAT must be verbatim, transcribe, codemix or transliterate")
    return {
        "model": os.getenv("GNANI_STT_MODEL", "prisma-v3.0").strip(),
        "language": stt_language(os.getenv("GNANI_STT_LANGUAGE", "ta-IN").strip() or "ta-IN"),
        "format": output_format,
        "keyterms": terms,
    }


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


def _finalize_wav(data: bytes) -> bytes:
    """Finalize streaming RIFF/data lengths without changing any PCM samples."""
    with wave.open(io.BytesIO(data), "rb") as source:
        channels, width, rate = source.getnchannels(), source.getsampwidth(), source.getframerate()
        frames = source.readframes(source.getnframes())
    if not frames or len(frames) % (channels * width):
        raise ValueError("TTS returned empty or incomplete PCM frames")
    output = io.BytesIO()
    with wave.open(output, "wb") as target:
        target.setnchannels(channels)
        target.setsampwidth(width)
        target.setframerate(rate)
        target.writeframes(frames)
    return output.getvalue()


class GnaniClient:
    """Thin REST client for Gnani Prisma (STT) and Timbre (TTS)."""

    def __init__(self):
        self.api_key = (os.getenv("GNANI_API_KEY") or "").strip()
        self.base_url = (os.getenv("GNANI_BASE_URL") or DEFAULT_BASE_URL).strip().rstrip("/")
        self.mock = _env_bool("GNANI_MOCK") or not self.api_key

        stt = get_stt_config()
        self.stt_language = stt["language"]
        self.stt_format = stt["format"]
        self.stt_model = stt["model"]
        self.stt_keyterms = stt["keyterms"]
        self.detected_language_code: Optional[str] = None

        self.tts_model = os.getenv("GNANI_TTS_MODEL", "timbre-v2.5").strip() or "timbre-v2.5"
        self.tts_voice = (os.getenv("GNANI_TTS_VOICE") or ("Shivani" if self.tts_model.startswith("timbre-v3") else "Kamakshi")).strip()
        self.tts_tags = _env_bool("GNANI_TTS_TAGS")
        self.tts_fallback_model = os.getenv("GNANI_TTS_FALLBACK_MODEL", "timbre-v2.5").strip()
        self.tts_fallback_voice = os.getenv("GNANI_TTS_FALLBACK_VOICE", "Kamakshi").strip()
        self.tts_language = os.getenv("GNANI_TTS_LANGUAGE", "ta-IN").strip() or "ta-IN"
        self.tts_speed = None
        if _env_bool('GNANI_TTS_CLARITY'):
            raw_speed = os.getenv('GNANI_TTS_SPEED','').strip()
            if raw_speed:
                try:
                    speed = float(raw_speed)
                    if not math.isfinite(speed) or not .85 <= speed <= 1.15: raise ValueError()
                    self.tts_speed = speed
                except ValueError:
                    raise ValueError('GNANI_TTS_SPEED must be between 0.85 and 1.15') from None
        try:
            timeout = float(os.getenv('GNANI_TTS_TIMEOUT_S', '8'))
            self.tts_timeout_s = min(timeout, 8.0) if math.isfinite(timeout) and timeout > 0 else 8.0
        except ValueError:
            self.tts_timeout_s = 8.0
        try:
            self.tts_sample_rate = int(os.getenv("GNANI_TTS_SAMPLE_RATE", "22050"))
        except ValueError:
            self.tts_sample_rate = 22050

        cache_dir = Path(os.getenv("GNANI_TTS_CACHE_DIR", "app/data/tts_cache"))
        self.tts_cache_dir = cache_dir if cache_dir.is_absolute() else _AGENT_ROOT / cache_dir

        self.stats = {"stt_calls": 0, "tts_calls": 0, "tts_cache_hits": 0}
        self.last_error: Optional[str] = None
        self.last_provider_used: Optional[str] = None
        self.last_tts_source: Optional[str] = None
        self.last_tts_fallback_reason: Optional[str] = None

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

    def transcribe(self, audio_bytes: bytes, language: Optional[str] = None, *, max_attempts: int = 2) -> Dict:
        """Retry 429/504 once; callers with a strict credit budget may allow one attempt."""
        if max_attempts not in (1, 2):
            raise ValueError("max_attempts must be 1 or 2")
        bridge = _env_bool('LANG_BRIDGE')
        lang = stt_language(os.getenv('GNANI_STT_LANGUAGE_BRIDGE', 'ta-IN,hi-IN,en-IN') if bridge
                            else language.strip() if language and language.strip() else self.stt_language)
        self.detected_language_code = None
        if self.mock:
            self.last_error = None
            return {"text": MOCK_TRANSCRIPT, "language": lang, "detected_language_code": None, "success": True}
        try:
            wav = self._to_wav_16k(audio_bytes)
            data = {"language_code": lang, "format": 'codemix' if bridge else self.stt_format}
            if self.stt_model:
                data["model"] = self.stt_model
            if self.stt_keyterms:
                data["keyterms"] = self.stt_keyterms
            for attempt in range(max_attempts):
                self.stats["stt_calls"] += 1
                response = requests.post(
                    f"{self.base_url}/stt/v3",
                    headers=self._headers(),
                    files={"audio_file": ("audio.wav", wav, "audio/wav")},
                    data=data,
                    timeout=60,
                )
                if response.status_code not in (429, 504) or attempt + 1 == max_attempts:
                    break
                if response.status_code == 429:
                    time.sleep(1)
            if response.status_code != 200:
                self.last_error = f"STT {response.status_code}: {response.text[:300]}"
                return {"text": "", "language": lang, "detected_language_code": None, "success": False, "error": self.last_error}
            payload = response.json()
            text = (payload.get("transcript") or "").strip()
            self.detected_language_code = payload.get("detected_language_code")
            self.last_error = None
            return {"text": text, "language": lang, "detected_language_code": self.detected_language_code, "success": True}
        except Exception as e:
            self.last_error = f"STT: {e}"
            return {"text": "", "language": lang, "detected_language_code": None, "success": False, "error": str(e)}

    # ------------------------------------------------------------------ TTS

    def _cache_path(self, text: str, lang: str, voice: str, style: str = "normal", *, model: Optional[str] = None) -> Path:
        key = json.dumps({"version": 2, "model": model or self.tts_model, "voice": voice,
                          "language": lang, "sample_rate": self.tts_sample_rate,
                          "style": style, "text": text,
                          **({'speed':self.tts_speed} if self.tts_speed is not None else {})}, sort_keys=True, ensure_ascii=False)
        return self.tts_cache_dir / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}.wav"

    def synthesize(self, text: str, language: Optional[str] = None,
                   voice: Optional[str] = None, style: str = "normal", *,
                   allow_fallback: bool = True, max_calls: Optional[int] = None) -> Optional[bytes]:
        """Primary -> configured fallback; VoiceService handles gTTS after both fail.

        Auditions disable fallback so files cannot be mislabeled, and pass a shared
        remaining call budget. Each HTTP attempt consumes exactly one budget unit.
        """
        if style not in ("normal", "alert"):
            raise ValueError("style must be normal or alert")
        if max_calls is not None and max_calls < 0:
            raise ValueError("max_calls must be nonnegative")
        self.last_provider_used = self.last_tts_source = self.last_tts_fallback_reason = None
        if not text or not text.strip():
            return None
        lang = to_gnani_language(language, self.tts_language)
        pairs = [(self.tts_model, (voice or self.tts_voice).strip())]
        if allow_fallback:
            pairs.append((self.tts_fallback_model, self.tts_fallback_voice))
        before = self.stats["tts_calls"]
        errors = []
        for model, selected_voice in dict.fromkeys(pairs):
            if not valid_tts_pair(model, selected_voice):
                errors.append(f"Invalid TTS model/voice pair: {model}/{selected_voice}")
                continue
            final_text = tts_text(text, model, style, self.tts_tags)
            if not final_text:
                errors.append("TTS text is empty after removing tags")
                break
            audio = self._synthesize_variant(final_text, lang, selected_voice, model, style,
                max_calls is None or self.stats["tts_calls"] - before < max_calls)
            if audio:
                self.last_provider_used = f"gnani:{model}:{selected_voice}"
                self.last_tts_fallback_reason = "; ".join(errors) or None
                self.last_error = None
                path = ('cache' if self.last_tts_source == 'cache' else 'mock' if self.mock
                        else 'v2.5 fallback' if errors and model == 'timbre-v2.5' else model)
                logging.getLogger('uvicorn.error').info('tts_served path=%s language=%s', path, lang)
                return audio
            errors.append(self.last_error or "TTS produced no audio")
        self.last_error = "; ".join(errors)
        return None

    def _synthesize_variant(self, text, lang, voice, model, style, can_call):
        if self.mock:
            self.last_tts_source = "mock"
            return _silent_wav(0.4, self.tts_sample_rate)
        cache_file = self._cache_path(text, lang, voice, style, model=model)
        try:
            if cache_file.exists():
                audio = cache_file.read_bytes()
                if _is_wav(audio):
                    audio = _finalize_wav(audio)
                    self.stats["tts_cache_hits"] += 1
                    self.last_tts_source = "cache"
                    return audio
        except (OSError, EOFError, ValueError, wave.Error):
            pass  # A cache read failure must not disable synthesis/fallback.
        if not can_call:
            self.last_error = "TTS call budget exhausted"
            return None
        payload = {
            "text": text,
            "model": model,
            "voice": voice,
            "language": lang,
            "audio_config": {
                "sample_rate": self.tts_sample_rate,
                "encoding": "linear_pcm",
                "num_channels": 1,
                "sample_width": 2,
                "container": "wav",
            },
        }
        if self.tts_speed is not None: payload['speed'] = self.tts_speed
        try:
            self.stats["tts_calls"] += 1
            response = requests.post(
                f"{self.base_url}/api/v1/tts/inference",
                headers=self._headers(json_body=True),
                json=payload,
                timeout=self.tts_timeout_s,
            )
            if response.status_code != 200 or not response.content:
                self.last_error = f"TTS {response.status_code}: {response.text[:300]}"
                print(f"Gnani TTS error: {self.last_error}")
                return None
            if not _is_wav(response.content):
                self.last_error = "TTS returned non-WAV audio for a WAV request"
                return None
            audio = _finalize_wav(response.content)
            try:
                self.tts_cache_dir.mkdir(parents=True, exist_ok=True)
                cache_file.write_bytes(audio)
            except OSError as e:
                print(f"Gnani TTS cache write failed (continuing): {e}")
            self.last_error = None
            self.last_tts_source = "live"
            return audio
        except requests.exceptions.Timeout:
            self.last_error = 'TTS timeout'
            logging.getLogger(__name__).warning('tts_attempt_failed reason=timeout')
            return None
        except requests.exceptions.ConnectionError:
            self.last_error = 'TTS connection_error'
            logging.getLogger(__name__).warning('tts_attempt_failed reason=connection_error')
            return None
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
            "stt_model": self.stt_model,
            "stt_keyterms": self.stt_keyterms,
            "detected_language_code": self.detected_language_code,
            "tts_model": self.tts_model,
            "tts_voice": self.tts_voice or "(API default)",
            "tts_language": self.tts_language,
            "tts_sample_rate": self.tts_sample_rate,
            "tts_timeout_s": self.tts_timeout_s,
            "tts_speed": self.tts_speed,
            "tts_clarity": _env_bool('GNANI_TTS_CLARITY'),
            "tts_tags": self.tts_tags,
            "tts_fallback_model": self.tts_fallback_model,
            "tts_fallback_voice": self.tts_fallback_voice,
            "last_provider_used": self.last_provider_used,
            "last_tts_source": self.last_tts_source,
            "last_tts_fallback_reason": self.last_tts_fallback_reason,
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
