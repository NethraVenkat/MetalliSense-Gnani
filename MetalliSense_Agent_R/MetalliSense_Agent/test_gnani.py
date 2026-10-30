"""
Smoke test for the Gnani AI integration (Prisma STT, Timbre TTS, Evon copilot).

    python test_gnani.py        # mock mode: forces GNANI_MOCK/EVON_MOCK, 0 credits
    python test_gnani.py live   # real calls: 1 TTS (called twice -> cache hit),
                                # STT on sample.wav if present. Evon is live only
                                # when EVON_BASE_URL is set.
"""
import os
import sys

LIVE = len(sys.argv) > 1 and sys.argv[1].lower() == "live"

# Emojis / Tamil text in service logs must not crash a cp1252 Windows console.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Set before `import config`: load_dotenv() does not override existing vars.
os.environ["STT_PROVIDER"] = "gnani"
os.environ["TTS_PROVIDER"] = "gnani"
if not LIVE:
    os.environ["GNANI_MOCK"] = "true"
    os.environ["EVON_MOCK"] = "true"

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "app"))
import config  # noqa: E402,F401  (loads .env)

from copilot.gnani_client import get_gnani_client  # noqa: E402
from copilot.voice_service import VoiceService  # noqa: E402
from copilot.evon_explainer import EvonCopilot  # noqa: E402

failures = []


def check(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(name)


def is_riff_wav(data):
    return bool(data) and data[:4] == b"RIFF" and data[8:12] == b"WAVE"


print(f"\n=== Gnani smoke test ({'LIVE' if LIVE else 'MOCK'}) ===\n")

gnani = get_gnani_client()
check("Gnani mode", gnani.mock != LIVE, f"mock={gnani.mock}")
if LIVE and gnani.mock:
    print("GNANI_API_KEY is not set — live test cannot run.")
    sys.exit(1)

# --- TTS (same text twice: second call must come from the disk cache)
tts_text = "Heat 42 HOLD நிலையில் உள்ளது."
audio1 = gnani.synthesize(tts_text)
check("TTS returns RIFF WAV", is_riff_wav(audio1),
      f"{len(audio1 or b'')} bytes, last_error={gnani.last_error}")
if LIVE:
    hits_before = gnani.stats["tts_cache_hits"]
    audio2 = gnani.synthesize(tts_text)
    check("TTS second call is a cache hit",
          gnani.stats["tts_cache_hits"] == hits_before + 1 and audio2 == audio1,
          f"stats={gnani.stats}")

# --- STT
sample = os.path.join(HERE, "sample.wav")
if not LIVE:
    stt = gnani.transcribe(b"not-real-audio")
    check("STT (mock) returns text", stt["success"] and bool(stt["text"]), repr(stt["text"]))
elif os.path.exists(sample):
    with open(sample, "rb") as f:
        stt = gnani.transcribe(f.read())
    check("STT on sample.wav", stt["success"] and bool(stt["text"]),
          repr(stt.get("text") or stt.get("error")))
else:
    print("[SKIP] STT — no sample.wav next to this script")

# --- VoiceService wiring
voice = VoiceService()
check("VoiceService uses gnani", voice.stt_provider == "gnani" and voice.tts_provider == "gnani",
      f"stt={voice.stt_provider}, tts={voice.tts_provider}")
vs_audio = voice.text_to_speech(tts_text, language="ta")
check("VoiceService TTS -> audio/wav", is_riff_wav(vs_audio) and voice.last_media_type == "audio/wav",
      f"provider={voice.last_provider_used}, media={voice.last_media_type}")
check("VoiceService status includes gnani", voice.status().get("gnani") is not None)
check("Indian language list", "ta-IN" in voice.get_supported_languages())

# --- Evon copilot
copilot = EvonCopilot()
print(f"Evon mode: {'mock' if copilot.mock else copilot.base_url}")
try:
    result = copilot.explain_analysis(
        composition={"Fe": 93.1, "C": 3.45, "Si": 2.95, "Mn": 0.32, "P": 0.03, "S": 0.012},
        grade="FG260",
        anomaly_result={"anomaly_score": 0.71, "severity": "HIGH", "confidence": 0.88},
        alloy_result={"recommended_additions": {}, "confidence": 0.8},
    )
    check("EvonCopilot.explain_analysis returns text", bool(result.get("explanation")),
          result.get("explanation", "")[:120])
except Exception as e:
    check("EvonCopilot.explain_analysis returns text", False, str(e))
try:
    reply = copilot.chat("Yen HOLD aachu?")
    check("EvonCopilot.chat returns text", bool(reply.get("response")), reply.get("response", "")[:120])
except Exception as e:
    check("EvonCopilot.chat returns text", False, str(e))

print(f"\nGnani status: {gnani.status()}")
print(f"\n{'ALL CHECKS PASSED' if not failures else f'{len(failures)} FAILED: {failures}'}")
sys.exit(1 if failures else 0)
