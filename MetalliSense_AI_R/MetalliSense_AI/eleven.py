"""Quick ElevenLabs smoke test. Reads ELEVENLABS_API_KEY from .env (never hardcode keys)."""
import os
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

load_dotenv(Path(__file__).parent / ".env")

client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

audio = client.text_to_speech.convert(
    text="The first move is what sets everything in motion.",
    voice_id=os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
    model_id=os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
    output_format="mp3_44100_128",
)

play(audio)
