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
    check("Mock detected language is explicitly unknown", stt.get("detected_language_code") is None and "detected_language_code" in gnani.status())
elif os.path.exists(sample):
    with open(sample, "rb") as f:
        stt = gnani.transcribe(f.read())
    check("STT on sample.wav", stt["success"] and bool(stt["text"]),
          repr(stt.get("text") or stt.get("error")))
else:
    print("[SKIP] STT — no sample.wav next to this script")

# --- Prisma v3 request/retry regressions: mocked HTTP only, never a real API call.
if not LIVE:
    from unittest.mock import Mock, patch
    from types import SimpleNamespace
    from copilot.gnani_client import GnaniClient, DEFAULT_STT_KEYTERMS, _silent_wav, get_stt_config
    from tools import noise_bench as bench

    def response(status, text="heat 1051 status", detected="en-IN"):
        return Mock(status_code=status, text=f"HTTP {status}", json=lambda: {"transcript": text, "detected_language_code": detected})

    with patch.dict(os.environ, {"GNANI_MOCK": "false", "GNANI_API_KEY": "mock-test-key",
                                 "GNANI_STT_LANGUAGE": "ta-IN,en-IN", "GNANI_STT_FORMAT": "transcribe"}), \
            patch("copilot.gnani_client.requests.post") as post, patch("copilot.gnani_client.time.sleep") as sleep:
        os.environ.pop("GNANI_STT_MODEL", None)
        os.environ.pop("GNANI_STT_KEYTERMS", None)
        client = GnaniClient()
        post.return_value = response(200)
        result = client.transcribe(_silent_wav())
        data = post.call_args.kwargs["data"]
        check("Prisma v3 default multipart model/keyterms/list", data == {
            "model": "prisma-v3.0", "keyterms": DEFAULT_STT_KEYTERMS,
            "language_code": "ta-IN,en-IN", "format": "transcribe"})
        check("Detected language returned and exposed in status", result["detected_language_code"] == "en-IN" and client.status()["detected_language_code"] == "en-IN")
        check("STT model/keyterms exposed in status", client.status()["stt_model"] == "prisma-v3.0" and client.status()["stt_keyterms"] == DEFAULT_STT_KEYTERMS)

        for status in (429, 504):
            post.reset_mock()
            sleep.reset_mock()
            post.side_effect = [response(status), response(200, detected="ta-IN")]
            before = client.stats["stt_calls"]
            result = client.transcribe(_silent_wav())
            check(f"HTTP {status} retries once then succeeds", result["success"] and post.call_count == 2 and client.stats["stt_calls"] == before + 2)
            check(f"HTTP {status} retry delay", sleep.call_args_list == ([((1,), {})] if status == 429 else []))
            post.reset_mock()
            post.side_effect = [response(status), response(status)]
            result = client.transcribe(_silent_wav())
            check(f"HTTP {status} stops after retry", not result["success"] and post.call_count == 2 and str(status) in result["error"] and client.status()["detected_language_code"] is None)

        post.reset_mock()
        post.side_effect = [response(429)]
        result = client.transcribe(_silent_wav(), max_attempts=1)
        check("Single remaining benchmark credit disables retry", not result["success"] and post.call_count == 1)
        post.reset_mock()
        post.side_effect = [response(400)]
        check("HTTP 400 does not retry", not client.transcribe(_silent_wav())["success"] and post.call_count == 1)

        os.environ.update(GNANI_STT_MODEL="", GNANI_STT_KEYTERMS="", GNANI_STT_LANGUAGE="en-IN", GNANI_STT_FORMAT="verbatim")
        v25 = GnaniClient()
        post.side_effect = None
        post.return_value = response(200, detected=None)
        result = v25.transcribe(_silent_wav())
        check("Empty model/keyterms omitted for v2.5", post.call_args.kwargs["data"] == {"language_code": "en-IN", "format": "verbatim"})
        check("Missing detected language remains null", result["detected_language_code"] is None)
        for hint in ("ta,en", "indic-auto"):
            v25.transcribe(_silent_wav(), language=hint)
            check(f"STT language hint {hint}", post.call_args.kwargs["data"]["language_code"] == ("ta-IN,en-IN" if hint == "ta,en" else hint))
        for field, invalid in (("GNANI_STT_LANGUAGE", "ta,en,hi,te,kn"), ("GNANI_STT_KEYTERMS", ",".join(f"term{i}" for i in range(201)))):
            with patch.dict(os.environ, {field: invalid}):
                try:
                    get_stt_config()
                    rejected = False
                except ValueError:
                    rejected = True
                check(f"Reject oversized {field}", rejected)

        baseline = {"model": "", "language": "en-IN", "format": "transcribe"}
        keys = {bench.cache_key("heat.wav", "hum.wav", "10", config) for config in (
            baseline, {**baseline, "model": "prisma-v3.0"}, {**baseline, "language": "ta-IN,en-IN"}, {**baseline, "format": "codemix"})}
        check("Benchmark cache separates model/language/format", len(keys) == 4)
        bench.apply_stt_overrides(SimpleNamespace(stt_model="v2.5", stt_language="ta,en", stt_format="codemix"))
        config = get_stt_config()
        check("Benchmark overrides take precedence", (config["model"], config["language"], config["format"]) == ("", "ta-IN,en-IN", "codemix"))

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
