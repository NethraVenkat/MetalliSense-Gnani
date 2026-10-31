# F12 supervisor voice

2026-10-31. Branch `f12-supervisor-voice`. No commit. Default flags remain off. No personal identifiers, reference recordings, consent contents or embedding tensors are included in this report.

## Official documentation checked before implementation

- [Voice Clone Embeddings](https://docs.gnani.ai/api/VC/voice-clone-embeddings.md): “Upload 5–30 seconds of clean reference audio”. POST `https://api.vachana.ai/api/v1/tts/voice-clone/embeddings`, multipart `audio_file`, `X-API-Key-ID` header. Result is `data.voice_clone_embedding`: `embedding` (base64 string), `shape` (e.g. `[1,768]`), `dtype` (e.g. `torch.bfloat16`). Generate once and reuse. The page does not prescribe reference sample rate/codec beyond the audio upload and duration guidance; our tool chooses PCM16 mono 16 kHz for consistent preparation.
- [Voice Cloned TTS REST](https://docs.gnani.ai/api/VC/vc-inference.md): “Voice cloning model. Use `vachana-vc-v1`.” POST `/api/v1/tts/inference`, JSON text, model, speaker_embedding object and audio_config; authenticated by `X-API-Key-ID`. The model is selected automatically when an embedding is present. The clone schema lists no language, named voice, speed or audio-tag parameter. AudioConfig range is 8,000–44,100 Hz; this implementation uses the configured rate capped at 44,100, PCM16 mono WAV.
- [Voice Cloned TTS SSE](https://docs.gnani.ai/api/VC/vc-sse.md): “Each event contains a chunk of audio data encoded in base64.” POST `/api/v1/tts/sse` accepts the same clone request. Events are start, chunk (`audio`, `chunk_index`, `is_final`) and complete. We request raw PCM16 for the existing browser stream player, forward only safe audio metadata, and cache a complete WAV after completion.

Differences/uncertainties: this is the separate `vachana-vc-v1` model, not a Timbre voice parameter. Named `supervisor` is only our local selector. The schema has no language field or documented per-language embedding restriction, supported-language catalog, speed control or tag support. We select reference embeddings locally by request language, send native-script spoken text, and omit unsupported parameters. Existing frontend clarity/register/normalization still runs before synthesis; Timbre-specific tags are removed on the clone path. Cross-language quality must be assessed by listening, not assumed. The three pages provide no explicit consent/usage policy; consent enforcement here is our mandatory local privacy rule, not a quoted provider guarantee.

## Private storage and consent

The entire `app/data/voice_clone/` directory is gitignored: references (including mp4 originals), CONSENT.txt and all embeddings. No endpoint returns the tensor or consent contents. Nothing is copied into frontend assets. Cache identity uses a 16-hex SHA-256 prefix of the canonical embedding object; browser metadata contains only the generic provider/voice identifier, not even the embedding hash.

The builder refuses before HTTP without nonempty `app/data/voice_clone/CONSENT.txt`. Each run validates a 5–30 second reference, accepts wav/m4a/mp4, uses ffmpeg or imageio-ffmpeg when conversion is needed, and makes one embedding request without retries. Provider bodies/exceptions are replaced with a generic error. Writes are atomic within the private directory. CLI examples (from the Agent directory):

```powershell
python tools/f12_make_voice_embedding.py --audio app/data/voice_clone/supervisor_reference.wav --out embedding
python tools/f12_make_voice_embedding.py --audio app/data/voice_clone/supervisor_reference_en.wav --out embedding_en
python tools/f12_make_voice_embedding.py --audio app/data/voice_clone/supervisor_reference_hi.wav --out embedding_hi
```

These commands are documented for future consenting-reference replacement; do not repeat them as part of the completed audition. Rebuilding an embedding changes its hash and invalidates that voice's audio-cache identity. Missing/empty consent also prevents use of an existing cloned-audio cache.

## Flags, selection and fallback

- `GNANI_VOICE_CLONE=off` by default. Only a `voice: "supervisor"` request can choose cloning when this flag is on and valid consent/embedding exists. Ordinary requests preserve the previous model/voice path.
- `GNANI_CLONE_EMBEDDING_MODE=per_language` by default: try `embedding_<short-language>.json` for ta/hi/en, then `embedding.json`. `single` always uses main. A malformed language-specific embedding also falls back to main.
- `VITE_SUPERVISOR_VOICE=off|alerts|all`, default off, exposed in mock mode. alerts selects only style=alert (the automatic HOLD path); all selects every queued reply including Hindi. When configured, the panel shows the toggle **Supervisor voice (cloned, with consent)**. Turning it off restores the existing voice. A hidden panel still mounts no controls or capture.
- The shared useSpeak boundary selects the voice without changing queue, mute, echo guard or bilingual ordering. REST and streamed requests carry only the selector; text preparation/display separation is unchanged.
- Missing consent/embedding/flag or clone failure falls back to the configured normal voice (currently Kalpana), then the existing v2.5 and gTTS chain. SSE failures reset any partial playback before using the normal REST chain, without retrying clone. The first-chunk deadline remains eight seconds.
- `/copilot/voice/status` adds `clone: {enabled,state,languages}`. State is configured/not configured. Languages indicate which ta/en/hi requests can resolve a valid private embedding, including the main fallback; they are not a claim of provider language or accent quality.

Local `.env` and `.env.local` were not edited. An isolated audition process enabled clone selection for its authorized requests only. Gate logic, seeds, intents, safety, F2/F7/F9, streaming STT, Evon and README were not changed.

## Live verification

**3 / 3 embedding requests, 5 / 6 cloned TTS requests, 0 STT**, no retries/fallback. A local Windows console encoding failure occurred before the first HTTP request; it used zero calls. The corrected runner has a durable attempt journal and checks endpoint-specific budgets before each request. No sixth TTS request was needed. All results below are live cloned-model responses, not stock-voice substitutes.

| Embedding | Build ms | Result |
|---|---:|---|
| Main (Tamil/English reference) | 1789.4 | saved privately |
| English reference | 1376.5 | saved privately |
| Hindi reference | 1584.1 | saved privately |

The audition uses the current frontend's colloquial clarity HOLD-alert builder, not manually reconstructed speech:

Tamil: `ஹீட் ஆயிரத்து ஐம்பத்தி மூணு, ஹோல்ட். ஸ்கிரீன்ல பாருங்க.`

Hindi: `हीट एक हज़ार तिरपन, होल्ड। स्क्रीन देखें।`

English: `heat ten fifty-three, HOLD. Check the screen.`

| Language / embedding | Generation ms | Audio seconds | WAV |
|---|---:|---:|---|
| Tamil / main | 4036.9 | 2.84 | [ta_main_alert.wav](../app/data/tts_cache/f12_audition/ta_main_alert.wav) |
| Hindi / Hindi | 2592.5 | 2.47 | [hi_hi_alert.wav](../app/data/tts_cache/f12_audition/hi_hi_alert.wav) |
| Hindi / main | 2518.4 | 2.23 | [hi_main_alert.wav](../app/data/tts_cache/f12_audition/hi_main_alert.wav) |
| English / English | 2727.1 | 2.65 | [en_en_alert.wav](../app/data/tts_cache/f12_audition/en_en_alert.wav) |
| English / main | 3147.7 | 2.58 | [en_main_alert.wav](../app/data/tts_cache/f12_audition/en_main_alert.wav) |

All WAVs are mono PCM16, 22,050 Hz, under ignored `app/data/tts_cache/f12_audition/`. Generation timing is full REST completion, not first-stream-chunk timing. The live audition used REST to produce standalone WAV comparisons. SSE forwarding/cache/failure behavior is verified with mocked provider streams, not claimed as live streaming verification. No voice-similarity ranking or manual mic/browser test was performed.

## Ignore verification

Run from the Agent directory:

```text
git check-ignore -v app/data/voice_clone/supervisor_reference.wav app/data/voice_clone/embedding.json app/data/voice_clone/CONSENT.txt
.gitignore:27:MetalliSense_Agent_R/MetalliSense_Agent/app/data/voice_clone/ app/data/voice_clone/supervisor_reference.wav
.gitignore:27:MetalliSense_Agent_R/MetalliSense_Agent/app/data/voice_clone/ app/data/voice_clone/embedding.json
.gitignore:27:MetalliSense_Agent_R/MetalliSense_Agent/app/data/voice_clone/ app/data/voice_clone/CONSENT.txt
```

The mp4 originals, Hindi embedding and audition WAVs were independently confirmed ignored. `git ls-files` contains no voice_clone files. No audio, consent or embedding file appears in git status.

## Validation and remaining manual work

Final test/build counts are recorded after the complete suite below. Mock tests cover consent, reference duration/conversion, silent tensor handling, language selection/main fallback, disabled mode, REST clone/cache hashing/replacement, failure through Kalpana/v2.5/gTTS, SSE forwarding/cache/fallback and safe route status. Frontend tests cover off/alerts/all, exact off-mode REST payloads, HOLD selection, Hindi replies, the generic toggle and streamed-request REST fallback.

The team must listen to the five WAVs, choose main vs per-language quality, and enable the desired flags externally for a browser test. Reference replacement requires fresh consent and regenerated embeddings. Cloning itself does not establish factual correctness or approval authority; all answers remain the existing verified read-only answers.

## Files changed

Root: `.gitignore`.

Agent: `.env.example`; `app/copilot/voice_clone.py` (new), `gnani_client.py`, `gnani_tts_stream.py`, `voice_service.py`, `schemas.py`; `app/main.py`; `tools/f12_make_voice_embedding.py` (new); `tools/f12_voice_audition.py` (new); `tests/test_voice_clone.py` (new); `tests/test_gnani_stream.py` (status assertion extended); this report (new).

Frontend: `.env.example`; `vite.config.js`; `vitest.config.js`; `src/services/supervisorVoice.js` (new); `copilotService.js`; `ttsStream.js`; `src/hooks/useSpeak.js`; `src/components/voice/PushToTalk.jsx`; `tests/supervisor-voice.test.jsx` (new).
