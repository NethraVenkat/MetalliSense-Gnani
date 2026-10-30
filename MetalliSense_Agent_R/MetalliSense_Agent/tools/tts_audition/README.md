# Timbre Tamil HOLD audition

The app keeps `timbre-v2.5` as its default. This change adds opt-in v3.0 tags,
a model-specific v2.5 fallback, and an offline-testable audition tool. It does not
change the gate decision, demo seed, approval blocks or benchmark results.

## Read-first findings

1. The previous cache identity was SHA-256 of
   `model|voice|language|sample_rate|text`. All three model/voice/language fields
   were present; style and server-applied tags were absent.
2. The new identity hashes a versioned JSON object with `model`, `voice`,
   `language`, `sample_rate`, `style`, and the **final provider text after tags**.
   Old cache WAVs stay on disk but cannot match the new identity. Cached fallback
   audio is stored under its actual fallback model and voice.
3. `voiceGateAnswers.js` builds the plain HOLD sentence via `buildHoldAlert`.
   `PreMeltGate` calls the once-only announcer; it calls `useSpeak` with style
   `alert`, which posts through `copilotService` to `/copilot/voice/synthesize`.
   `TTSRequest` -> `VoiceService.text_to_speech` -> `GnaniClient.synthesize`
   passes that style to the server-side tag formatter. Other speech uses `normal`.
4. POST `https://api.vachana.ai/api/v1/tts/inference` uses the `X-API-Key-ID`
   header and JSON `text`, `model`, `voice`, `language`, `audio_config`.
   This integration requests Tamil `ta-IN`, PCM WAV, mono, 16-bit samples and the
   configured sample rate (22050 Hz by default). No new `speed` value is sent.

## Documentation checked before implementation

- [Voice catalog](https://docs.gnani.ai/api/TTS/available-voices.md):
  “Voices are not interchangeable between models.” The 13 v3.0 voices each support
  Tamil: Shivani, Lakshmi, Kalpana, Chetana, Vasudha, Riyaa, Tarika, Avinash,
  Shubham, Prakash, Devansh, Yashraj and Harshad. The audition defaults are Shivani,
  Kalpana, Avinash and Harshad.
- [Audio tags](https://docs.gnani.ai/api/TTS/tts-audio-tags.md):
  “There is no closing tag.” Tags are case-sensitive inline markers. `<slow>`
  changes pacing; `<pauses>` inserts silence. Slow is reapplied after the pause
  because a later tag can change scope. `<shouting>` is never added.
- [REST inference](https://docs.gnani.ai/api/TTS/tts-inference.md) documents
  both models, language routing and supported sample rates, including 22050 Hz.

Kamakshi is the existing deployment's legacy v2.5 voice. It is not listed in the
current public catalog, so the validator deliberately retains that one compatibility
entry. Its actual API result is recorded in `audition.json`; it is never sent with
v3.0. Other invalid model/voice pairs skip directly to fallback without an HTTP call.

Only model `timbre-v3.0`, `GNANI_TTS_TAGS=on` and style `alert` enable generated
tags. The provider text has this shape:

```text
<slow> Heat H-1053: <pauses> <slow> Gate HOLD. ...
```

The screen and frontend request text have no tags. v2.5 and gTTS receive the plain
text. The fallback chain is configured primary model/voice -> configured fallback
model/voice (default v2.5/Kamakshi) -> existing gTTS. `X-TTS-Provider` and status
report the actual successful provider, e.g. `gnani:timbre-v3.0:Shivani` or
`gnani:timbre-v2.5:Kamakshi`; gTTS remains `gtts`.

## Audition

From the Agent directory, using its virtual environment:

```powershell
python tools\tts_audition.py --max-calls 10
```

The default `--with-tags` is on: four v3.0 voices, each plain and tagged, plus one
v2.5 Kamakshi baseline = nine variants. `--no-with-tags` requests only plain variants.
`--voices Shivani,Kalpana,Avinash,Harshad` overrides the list. The hard ceiling is
ten attempts; failed requests consume budget, and there are no hidden retries or
fallback calls in auditions. Failed variants never get a fallback WAV under the
wrong voice's filename. Existing cached variants remain usable with zero budget.

The tool reads `.env` without editing it, opts its own process into live TTS, and
gets the fixed H-1053 sentence from the actual frontend formatter and seed.
Successful audio is saved as `<model>_<voice>_<plain|tags>.wav` here and in the
normal disk cache. Repeating a completed successful audition reuses the cache.
`audition.json` records bytes, cache/live source, errors and live calls used.
Listen to the WAVs to choose a voice; file size is not a voice-quality ranking.
The completed run and playable links are in [AUDITION.md](AUDITION.md).
Provider streaming WAV lengths are finalized locally without changing PCM samples.

## Manual app check

In your own `.env`, opt in, then restart the Agent:

```dotenv
GNANI_TTS_MODEL=timbre-v3.0
GNANI_TTS_VOICE=Shivani
GNANI_TTS_TAGS=on
GNANI_TTS_FALLBACK_MODEL=timbre-v2.5
GNANI_TTS_FALLBACK_VOICE=Kamakshi
```

Open Pre-Melt Gate -> Reset -> H-1053 -> Run pre-melt check. With Tamil selected
and voice unmuted, expect a slower HOLD alert with a pause after the heat ID.
The screen remains plain text. Inspect `X-TTS-Provider` for the actual model/voice.
Set `GNANI_TTS_VOICE=Nobody`, restart and repeat after Reset: the primary pair is
rejected locally and v2.5/Kamakshi is tried. gTTS remains the last fallback if it fails.

## Offline verification

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest tests -q
python test_gnani.py
```

The smoke test forces mock speech/Evon; pytest mocks all HTTP inference and checks
cache separation, tags, catalog validation, fallback order, request style, provider
headers, call budgets and cached reruns. No STT calls are needed for this audition.
