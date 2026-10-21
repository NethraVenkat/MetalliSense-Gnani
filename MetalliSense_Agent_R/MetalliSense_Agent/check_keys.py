"""
Checks every API key in .env against the real service.
Run from this folder (with the venv active):   python check_keys.py
Writes elevenlabs_test.mp3 if ElevenLabs works.
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


def show(name, ok, info=""):
    print(f"{'✅' if ok else '❌'} {name:<12} {info}")


def check_groq():
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return show("Groq", False, "GROQ_API_KEY not set")
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": model, "messages": [{"role": "user", "content": "Reply with OK"}], "max_tokens": 20},
        timeout=30,
    )
    show("Groq", r.ok, f"{r.status_code} model={model}" + ("" if r.ok else f" → {r.text[:200]}"))


def check_elevenlabs():
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        return show("ElevenLabs", False, "ELEVENLABS_API_KEY not set")
    voice = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    model = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        json={"text": "MetalliSense voice check. Heat cleared by the pre-melt gate.", "model_id": model},
        timeout=30,
    )
    if r.ok and r.content:
        Path("elevenlabs_test.mp3").write_bytes(r.content)
    show("ElevenLabs", r.ok, f"{r.status_code} voice={voice}" + (" → saved elevenlabs_test.mp3" if r.ok else f" → {r.text[:200]}"))


def check_gemini():
    key = os.getenv("GOOGLE_GEMINI_API_KEY", "").strip()
    if not key:
        return print("➖ Gemini       not configured (optional)")
    r = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}", timeout=30)
    show("Gemini", r.ok, str(r.status_code))


def check_anthropic():
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return print("➖ Anthropic    not configured (optional)")
    r = requests.get("https://api.anthropic.com/v1/models",
                     headers={"x-api-key": key, "anthropic-version": "2023-06-01"}, timeout=30)
    show("Anthropic", r.ok, str(r.status_code))


if __name__ == "__main__":
    print(f"COPILOT_PROVIDER={os.getenv('COPILOT_PROVIDER', 'groq')}  TTS_PROVIDER={os.getenv('TTS_PROVIDER', 'elevenlabs')}\n")
    for fn in (check_groq, check_elevenlabs, check_gemini, check_anthropic):
        try:
            fn()
        except Exception as e:
            show(fn.__name__.replace("check_", ""), False, f"network error: {e}")
