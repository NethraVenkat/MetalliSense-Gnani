# F11 faster and clearer voice

2026-10-31 (Asia/Calcutta). Owner: Manish. Branch `f11-voice-speed`. No commit.

## Documentation checked before implementation

- [Timbre SSE](https://docs.gnani.ai/api/TTS/tts-sse.md): `POST https://api.vachana.ai/api/v1/tts/sse`, server-side `X-API-Key-ID`, JSON text/model/voice/language and audio_config. The endpoint offers "Raw 16-bit PCM" with container raw and encoding linear_pcm/pcm_s16le. Supported rates include 8000, 16000, 22050, 24000, 44100 and 48000 Hz. We retain the current configured rate, model, voice and language, mono, width two.
- SSE events are start, chunk, complete and error. Ordered chunk.audio values are base64 fragments; complete signals the end, with empty audio and is_final true. No documented fixed chunk size or fixed interval exists. Raw fragments can be joined in order; a sample split at a fragment boundary is held until its second byte arrives. Start/error events are not passed through because they can contain text/provider bodies.
- The SSE page says OGG is delivered as one encoded chunk, so it does not offer incremental streaming. We use raw PCM rather than guessing a WAV header boundary per chunk or relying on browser MP3 MediaSource support.
- [REST](https://docs.gnani.ai/api/TTS/tts-inference.md) describes "Synchronous text-to-speech with full audio returned in one response." It is the unchanged baseline and fallback. Both REST and SSE pages still contain older advice to pre-format raw numbers/IDs, linking to the guide below.
- **Documentation conflict:** the [current normalization guide](https://docs.gnani.ai/api/TTS/tts-input-formating.md) says "You don't need to pre-format most input" and "Passing numbers, IDs, dates, or currency as raw strings is now handled automatically." Its detailed rules cover ordinary cardinals, decimals, percentages, financial/phone IDs and abbreviations, and explain that explicit language selects localized normalization. This is more specific than the older warning on the endpoint pages.
- The guide does not document our custom H-/PIG- foundry prefix readouts or the requested English ten-fifty-three grouping. It also does not guarantee preservation of every trailing fractional zero in 0.50. We target those application-specific readings/precision guarantees. Ordinary quantities/decimals and percentage syntax remain provider-normalized; we do not duplicate the API's entire normalization pipeline.

## Flags and unchanged paths

- Agent `GNANI_TTS_STREAM=off` by default; frontend `VITE_TTS_STREAM=false` and independent `VITE_SPOKEN_NORMALIZE=false` by default.
- Both frontend flags are exposed in mock mode. Example env files document them; `.env` and `.env.local` were not edited or enabled.
- With both frontend flags off, the existing REST request payload, cache key, voice/model, playback/preparation queue, mute and echo guard are retained. All prior regression tests pass. There are no new automatic STT calls.
- Streaming STT, intent/safety rules, on-screen answer templates, F2/F7 feature flags and behavior, gate logic/seeds, Evon and README are unchanged. F2 bilingual alerts still use their existing sequential Tamil-then-Hindi announcer.

## Agent design

`POST /copilot/voice/speak-stream` takes the existing TTSRequest text/language/style. POST keeps answer text out of query strings. Disabled -> safe 404 stream_disabled; the frontend can use the existing REST endpoint. There is no browser API key or browser-selected voice/model.

The proxy requests Timbre raw PCM16 mono and forwards safe SSE audio events as fragments arrive. Each audio event includes base64 audio, encoding, sample_rate and fixed path (stream/rest/cache/fallback). No upstream text echoes, headers, error details or keys are forwarded. A completion event is required for successful streaming.

The first audio-fragment deadline is eight seconds, including connect/headers/start/heartbeat events. Upstream idle timeout is also eight seconds; a stream has a 120-second overall deadline and 24 MB PCM bound. HTTP errors, timeout, malformed/incomplete SSE or midstream failure close the upstream response and invoke the existing REST -> configured v2.5 -> gTTS chain. Cancellation closes upstream without starting fallback.

After partial streaming failure, the proxy sends reset, then full fallback audio (WAV or MP3) and completion. The browser stops pending sources before the fallback restarts. A prefix already heard can repeat; seamless recovery after a partial utterance is not claimed. No partial/failed stream is written to cache.

After complete successful SSE, PCM is wrapped into a finalized WAV and atomically saved under the **existing** Gnani cache key. That key uses final spoken text (including existing alert-tag preparation), model, voice, language, sample rate and style. It does not depend on the F11 flag or transport. Repeated REST or stream requests can therefore use the same complete WAV. Cache hits bypass Gnani and stream decoded PCM to the browser. Status counters/provider/source are updated for completed streams and cache hits.

## Browser playback and timing

The existing useSpeak queue owns playback. Streaming uses Web Audio buffer sources, PCM16 little-endian to float samples, scheduled serially at the supplied rate. It plays while later fragments are arriving, rather than buffering the whole result. Muting aborts the request/stops scheduled sources; queued canceled turns do not play. The echo guard begins when the first source is scheduled and remains active through playback and 400 ms after. HOLD style and bilingual ordering are retained.

If the Agent stream is disabled/unreachable, the stream protocol fails, or Web Audio is unavailable, the browser uses the existing REST synthesis/playback path. Full REST fallback files received over SSE are decoded with Web Audio. No MediaSource/container assumptions are made.

F11 timing logs contain STT ms, answer ms, queue wait, time_to_first_audio_ms, total_audio_ms, total_ms, fixed path and language, with no text/keys. First-audio time is estimated at the scheduled Web Audio start (includes the small scheduling buffer and queue wait); total_audio_ms is decoded audio duration, not a claimed microphone-to-speaker latency. total_ms in browser logs includes playback completion. REST instrumentation uses the audio playing event when either F11 flag is enabled. With flags off, prior timing logs remain unchanged. Missing stages are null for demo text or automatic alerts.

## Spoken text normalization boundary

`toSpokenText(text, lang)` is pure and runs inside useSpeak immediately before either TTS transport only when VITE_SPOKEN_NORMALIZE=true. Display text, transcript, intent input and fact values are not changed. An existing Heat/ஹீட்/हीट before H- is not doubled. H and PIG have explicit readings; other prefixes with a vowel are read as words, and other prefixes are spelled. This is a bounded pronunciation heuristic, not a general linguistic model. Leading-zero/long identifier digits are preserved individually.

| Voice-only input | Tamil output | Hindi output | English output |
|---|---|---|---|
| H-1053 | ஹீட் ஆயிரத்து ஐம்பத்து மூன்று | हीट एक हज़ार तिरपन | heat ten fifty-three |
| PIG-1053 | பிக் ஆயிரத்து ஐம்பத்து மூன்று | पिग एक हज़ार तिरपन | pig ten fifty-three |
| 0.50 | பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் | शून्य दशमलव पाँच शून्य | zero point five zero |
| 0.50% | பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம் | शून्य दशमलव पाँच शून्य प्रतिशत | zero point five zero percent |

**Difference from the blanket requested transformation:** ordinary 42, 0.5 and 8.5% stay written as-is because current docs already normalize them. Trailing-zero decimals are explicitly spelled to retain written precision: 0.50 and 0.5 remain distinct. When that precision override consumes a numeric percentage, it also writes the corresponding percent word, since the original numeric-% pattern no longer exists for provider TN. A standalone % or ordinary numeric percentage is otherwise left to provider normalization. Existing element names and native percent words remain untouched.

## Live comparison

Same current **timbre-v3.0 / Kalpana**, explicit ta-IN/hi-IN/en-IN, normal style, three synthetic sentences; only the final normalized text was submitted. No model, voice, speed or rate changes. Each transport had an isolated cold cache using the production key format, preventing a REST cache hit from masquerading as an SSE improvement.

Times below measure the **Agent proxy core** with real provider HTTP: first decoded PCM fragment for SSE vs full playable WAV ready for the existing REST baseline. Total response includes generation/download and cache finalization, not playback. These are not physical browser/hardware time-to-first-sound measurements, nor end-of-speech latencies. STT was not invoked.

| Language / sentence | REST first audio ms | REST total response ms | STREAM first audio ms | STREAM total response ms | Stream chunks |
|---|---:|---:|---:|---:|---:|
| Tamil HOLD reason | 2895.6 | 2895.7 | 626.3 | 2529.2 | 158 |
| Hindi HOLD reason | 3717.3 | 3717.4 | 750.9 | 2243.6 | 151 |
| English status | 2027.4 | 2027.5 | 711.3 | 1538.9 | 59 |

Decoded audio duration differs slightly between syntheses: Tamil REST 10.56 s / stream 11.12 s; Hindi 9.36 / 9.52 s; English 3.28 / 3.52 s. Generation is not deterministic. The first-chunk improvement in this single paired experiment is about 78%, 80% and 65%; it is not a repeated statistical benchmark.

Budget accounting: **8 / 12 slots conservatively reserved; 7 actual Gnani HTTP requests; 0 STT calls.** The initial English primary REST trial reserved a slot but a local Windows permission error replacing the attempt journal occurred **before sending** its HTTP request. The existing client treated that instrumentation exception as primary failure and used v2.5 (one actual request); that trial is excluded from the table. Its recorded 1163.6 ms fallback time is not a valid same-model baseline. The journal writer now uses unique temporary names and bounded local replace retries. One explicitly budgeted cold English REST repeat succeeded on v3.0/Kalpana at 2027.4 ms; no other live repetition was made. No gTTS network request was made in the benchmark.

Production SSE completion was verified from the real disk cache with HTTP and REST fallback explicitly blocked: first cached chunk **14.62 ms Tamil, 13.43 ms Hindi, 13.83 ms English**, path cache, **zero further network calls**. WAVs, normalized sentence records, the conservative attempt journal and offline cache-verification records remain ignored under `app/data/tts_cache/f11_voice_speed/`.

### Exact compared inputs

Screen/template sources and their final voice text are listed below; these are synthetic foundry facts, not operator recordings.

ta source:

```text
Heat H-1053 HOLD. PIG-1053 தனிமைப்படுத்தப்பட்டுள்ளது. காப்பர் 0.50 சதவீதம், அதிகம்.
```

Voice-only:

```text
ஹீட் ஆயிரத்து ஐம்பத்து மூன்று HOLD. பிக் ஆயிரத்து ஐம்பத்து மூன்று தனிமைப்படுத்தப்பட்டுள்ளது. காப்பர் பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம், அதிகம்.
```

hi source:

```text
हीट H-1053 होल्ड पर है। कॉपर 0.50 प्रतिशत है, सीमा 0.30 से ज़्यादा।
```

Voice-only:

```text
हीट एक हज़ार तिरपन होल्ड पर है। कॉपर शून्य दशमलव पाँच शून्य प्रतिशत है, सीमा शून्य दशमलव तीन शून्य से ज़्यादा।
```

en source:

```text
Heat H-1053: PLANNED. Gate HOLD.
```

Voice-only:

```text
heat ten fifty-three: PLANNED. Gate HOLD.
```

## Verification

- Agent: `python -m pytest tests -q` -> **197 passed**, 12 existing warnings, **19.72 s**. All 188 prior cases retained; nine new mocked cases cover forwarding before upstream completion, odd sample boundaries, first-fragment deadline, midstream reset/fallback, incomplete stream, completed cache reuse/final spoken text and alert-tag key, v2.5/gTTS fallback representation, disabled/enabled route and no secret echoes.
- Frontend: `npx vitest run --configLoader runner` -> **466 passed**, nine files, **24.96 s**. All 434 prior cases retained; 32 added cases cover ta/hi/en IDs/prefixes/trailing-zero decimals/associated percentage units, provider-normalized ordinary text, immutable display text, fragmented SSE, PCM playback and timing, disabled-Agent REST fallback, reset, abort/mute, flags-off payload identity, voice-only normalization, serial queue/echo guard and bilingual HOLD style/order.
- Build: `npm run build -- --configLoader runner` -> **passed**, **2,812 modules**, **50.07 s**.
- `git diff --check` passed. Test defaults explicitly disable F11 independently of local development settings; enabled tests opt in. No test makes a real HTTP request.

## Limits / not performed

- No physical microphone/browser speaker timing or manual pronunciation audition was performed. Live measurements establish upstream/proxy fragment availability only; browser autoplay policy, audio hardware, scheduling and intervening proxies can add delay. Reverse proxies must allow unbuffered SSE.
- On midstream fallback an already-heard prefix may repeat. Pending audio is stopped before restart; seamless word-boundary continuation is not implemented. Existing REST fallback can consume its own primary/fallback timeouts after the stream's first-fragment deadline, so eight seconds is not a total answer SLA.
- Spoken normalization deliberately follows the current guide rather than the endpoint pages' stale blanket warning. Most normal numbers/units/abbreviations are left to Timbre; only documented application-specific/precision overrides are expanded locally. No claim is made that every lot prefix has a linguistically correct automatic pronunciation.
- No speed/model/voice change, STT call, gate/seed/intent/safety change, Evon call, F2/F7 logic change, `.env`/`.env.local` edit, README edit or commit. No remaining live budget was spent after the valid English repeat; subsequent cache checks blocked HTTP explicitly.

## Files changed

Agent (`MetalliSense_Agent_R/MetalliSense_Agent`):

- `.env.example`
- `app/main.py`
- `app/copilot/gnani_tts_stream.py` (new)
- `tests/test_tts_stream.py` (new)
- `tools/f11_voice_speed.py` (new)
- `DOCS/F11_VOICE_SPEED.md` (new)

Frontend (`MetalliSense_Frontend_R/MetalliSense_Frontend`):

- `.env.example`
- `vite.config.js`
- `vitest.config.js`
- `src/hooks/useSpeak.js`
- `src/services/spokenText.js` (new)
- `src/services/ttsStream.js` (new)
- `tests/tts-speed.test.js` (new)

The existing Gnani REST client and VoiceService were reused without edits. Unrelated `.claude/` files were left untouched. Generated audio/cache/journal files remain ignored.
