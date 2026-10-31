# F2 Hindi / Tamil bridge

2026-10-31. Feature owner: Nethra. Flags default off. No commit made.

## Documentation checked before implementation

- [Prisma v3.0](https://docs.gnani.ai/api/STT/models/prisma-v3.md): "You can send up to 4 languages." REST accepts comma-separated locale hints such as `ta-IN,hi-IN,en-IN`; order does not matter. `indic-auto` instead considers all ten supported languages. Hints do not force the output language.
- The same page describes detection using the "script of the final transcript". Codes are locales such as `hi-IN`, `ta-IN`, and `en-IN`. Mostly English codemix may be tagged English; native script must account for at least 30% of letters for the native-language tag. Empty text can have no code. Detection is not a reliable spoken-language classifier by itself.
- In its codemix table: "English words stay Latin but numbers stay words". This applies to Hindi too; its example uses Devanagari number words with an English word in Latin. The bridge explicitly requests codemix, retaining existing keyterms.
- [STT languages](https://docs.gnani.ai/api/STT/languages.md) lists Hindi (`hi-IN`, Devanagari), Tamil (`ta-IN`, Tamil) and English (`en-IN`, Latin). No conflict with the requested three-language REST configuration was found.
- [Timbre voices](https://docs.gnani.ai/api/TTS/available-voices.md): "every voice speaks all 10 supported languages" for Timbre v3.0. Kalpana is listed, including Hindi and Tamil. Thus the same v3.0/Kalpana voice can use `hi-IN` and `ta-IN`. v2.5 has preferred-language voices; its quality is not claimed equivalent across languages. Existing configured fallback behavior is retained.

## Behavior and configuration

Agent `LANG_BRIDGE=on` selects REST language hints from `GNANI_STT_LANGUAGE_BRIDGE` (default `ta-IN,hi-IN,en-IN`) and format codemix. Model/keyterms are unchanged. Off leaves the original outgoing request parameters intact. The transcription response schema now preserves optional `detected_language_code` instead of discarding it.

Frontend `VITE_LANG_BRIDGE=true` enables language selection on REST push-to-talk and demo transcripts. Detection beginning `hi`, Devanagari script, or Hinglish markers without Tamil script select Hindi. Tamil detection/script or Tanglish markers select Tamil; otherwise the existing language toggle applies. Hindi instructions, answers and error text are deterministic; Hindi never calls Evon. The language passed to speech is `hi`, mapped by the existing Gnani client to `hi-IN`; model, voice and language-aware cache/fallback remain unchanged.

Hindi and Hinglish action blocks precede all read-only intents. Status, why-HOLD/WARN, element values, help and hold-list questions remain read-only. Help and list use the existing `ask_copilot` intent with bounded local parameters, without a new intent or model call. Heat lists read the existing `gate.decision` summaries. All existing Tamil/English template strings remain unchanged.

HOLD announcements retain their existing once-per-HOLD-transition behavior. With the frontend bridge flag on, the existing short Tamil alert completes before the short Hindi alert starts. Speech uses the existing mute/queue/echo guard. With the flag off, the previous selected-language alert runs unchanged. No gate decisions, charges, seeds, stock or approvals are changed.

Restart Agent/Vite after selecting flags externally. This task did not edit `.env` or `.env.local`, enable the voice panel, or alter the local hidden-panel preference. Mock demo transcripts work without audio; real audio uploads still require the Agent, as before.

## Live methodology and call budget

**24 / 25 authorized Gnani calls used: 8 Timbre requests + 16 Prisma requests.** No additional calls or retries. No Evon calls. One initial command stopped during console initialization before any HTTP request; it consumed zero calls.

`tools/f2_hindi_bridge.py --max-calls 24` synthesized the eight specified Latin-script Hindi/Hinglish and Tanglish phrases with Timbre v3.0/Kalpana using `hi-IN` / `ta-IN`. Each was sent through bridge REST STT once clean and once mixed at 0 dB with the existing deterministic `synthetic_clanks.wav`. Conversion uses the existing 16 kHz mono WAV helpers. This is synthetic speech with synthetic factory-like noise, not human phone/foundry recordings.

The benchmark enforces a shared HTTP-attempt budget before sending, persists attempts before network I/O, disables TTS fallback and STT retries, and does not retry failed rows on resume. Audio, raw transcripts and the journal are local under the ignored `app/data/tts_cache/f2_hindi_bridge/` folder. `--max-calls 0` only rescores saved transcripts using the actual frontend mapper and language picker; it made no network requests.

The first score exposed Hindi number words (`एक हज़ार तिरपन`, `एक हजार तिरेपन`) and Tamil number words (`ஆயிரத்தி ஐம்பத்து மூன்று`). Bridge-only aliases now normalize these without changing default mapper behavior. The observed `என் hold` / `N hold` variants map to why-HOLD only in that context. New regression tests use the actual transcripts. Final results below are cache rescoring after these fixes, not an independent held-out accuracy estimate.

## Results

Pass requires a successful STT response, correct reply language, existing intent, and heat 1053 / Cu / hold-list parameter where applicable. Empty failed responses are failures, not successful blocking or language detection. The browser rejects empty transcripts before invoking the answer handler.

| Clip | Expected phrase | Condition | Raw transcript | Detected code | Reply | Intent / parameters | Result |
|---:|---|---|---|---|---|---|---|
| 1 | heat 1053 ka status kya hai | clean | heat एक हज़ार तिरपन का स्टेटस क्या है? | hi-IN | hi | heat_status / `{"heatNumber":1053}` | PASS |
| 1 | heat 1053 ka status kya hai | 0 dB | heat एक हज़ार तिरपन का status क्या है? | hi-IN | hi | heat_status / `{"heatNumber":1053}` | PASS |
| 2 | 1053 hold kyun hai | clean | एक हजार तिरेपन hold क्यों है? | hi-IN | hi | gate_reason / `{"heatNumber":1053}` | PASS |
| 2 | 1053 hold kyun hai | 0 dB | एक हजार तिरेपन hold क्यों है? | hi-IN | hi | gate_reason / `{"heatNumber":1053}` | PASS |
| 3 | copper kitna hai heat 1053 | clean | copper कितना है? heat एक हजार तिरेपन। | hi-IN | hi | element_value / `{"heatNumber":1053,"element":"Cu"}` | PASS |
| 3 | copper kitna hai heat 1053 | 0 dB | copper कितना है? heat एक हजार तिरेपन। | hi-IN | hi | element_value / `{"heatNumber":1053,"element":"Cu"}` | PASS |
| 4 | kaun se heat hold par hai | clean | (empty; STT failed) | none | ta | ask_copilot / `{}` | FAIL |
| 4 | kaun se heat hold par hai | 0 dB | कौन से heat hold पर है? | hi-IN | hi | ask_copilot / `{"bridgeAction":"list_holds"}` | PASS |
| 5 | melting shuru karo | clean | melting शुरू करो। | hi-IN | hi | blocked / `{}` | PASS |
| 5 | melting shuru karo | 0 dB | melting शुरू कर। | hi-IN | hi | blocked / `{}` | PASS |
| 6 | approve karo | clean | approve करो। | hi-IN | hi | blocked / `{}` | PASS |
| 6 | approve karo | 0 dB | (empty; STT failed) | none | ta | ask_copilot / `{}` | FAIL |
| 7 | heat 1053 status enna | clean | heat ஆயிரத்தி ஐம்பத்து மூன்று status என்ன? | ta-IN | ta | heat_status / `{"heatNumber":1053}` | PASS |
| 7 | heat 1053 status enna | 0 dB | heat ஆயிரத்தி ஐம்பத்து மூன்று status என்ன? | ta-IN | ta | heat_status / `{"heatNumber":1053}` | PASS |
| 8 | 1053 en hold | clean | ஆயிரத்தி ஐம்பத்து மூன்று, என் hold. | ta-IN | ta | gate_reason / `{"heatNumber":1053}` | PASS |
| 8 | 1053 en hold | 0 dB | ஆயிரத்தி ஐம்பத்து மூன்று, N hold. | ta-IN | ta | gate_reason / `{"heatNumber":1053}` | PASS |

Final: **14 / 16 pass (87.5%)**; clean **7 / 8**, 0 dB **7 / 8**. All 14 returned transcripts pick the expected language and intent/slots. All three returned action transcripts are blocked. The clean hold-list attempt and 0 dB approve attempt returned `success=false` with empty text and no detected code. They remain failures; the benchmark did not retain detailed upstream errors, so no specific HTTP/connection diagnosis is claimed. Neither was retried. Successful clips do not prove recognition of every real worker or every Hindi number form.

## Tests and build

- Agent: `python -m pytest tests -q` -> **157 passed**, 12 existing deprecation warnings. Seven new cases cover exact flag-off params, three flag-on language overrides, custom hint configuration, detected-code propagation through the REST response, and Hindi voice/model/language cache behavior.
- Frontend: `npx vitest run --configLoader runner` -> **303 passed**, six test files. All 243 existing tests retained; 60 added cases cover language selection/off behavior, Hindi/Hinglish/Devanagari aliases and real number forms, safety precedence and mishearings, exact Hindi values/names, WARN/GO/risk handling, template-only Hindi answers, actual hold-list summaries, short alerts and sequential once-only bilingual playback.
- Build: `npm run build -- --configLoader runner` -> **passed**, 2,806 modules in **9.69 seconds**.

## Limits and work not done

- Hands-free streaming is unchanged and remains single-locale Tamil. Language bridging applies to REST push-to-talk only.
- No physical browser microphone, real worker, manual voice-quality or real-foundry verification was performed. Existing mock/offline transport behavior is retained and no synthetic audio is presented as human recordings.
- Two failed STT requests were not retried. No extra calls were made to establish their cause. Hindi number aliases cover the tested forms rather than a complete Hindi numeral grammar.
- Gate logic, H-1053 seed/HOLD demo, Tamil/English answer strings, Evon, STT/TTS defaults when off, streaming, README, benchmark results, `.env`, `.env.local`, and voice-panel flag were not changed. No commit.


## Files changed in this task

Agent:

- `.env.example`
- `app/copilot/gnani_client.py`
- `app/copilot/schemas.py`
- `tests/test_language_bridge.py` (new)
- `tools/f2_hindi_bridge.py` (new)
- `DOCS/F2_HINDI_BRIDGE.md` (new)

Frontend:

- `.env.example`
- `vite.config.js` (mock flag exposure)
- `vitest.config.js` (include new test file)
- `src/components/voice/PushToTalk.jsx`
- `src/services/voiceGateAnswers.js`
- `src/services/voiceIntents.js`
- `src/services/voiceTranscript.js`
- `src/services/languageBridge.js` (new)
- `src/services/hindiVoice.js` (new)
- `tests/language-bridge.test.js` (new)

The pre-existing untracked `.claude/` directory was untouched. Local generated WAV/cache files remain ignored.

## Real-mic fixes

2026-10-31. Owner: Nethra. Branch `f2-hindi-bridge`; prior uncommitted F2 work retained. This section records a separate six-call TTS-only task, not an extension of the 24-call STT benchmark above.

### Findings and fixes

- The reported `heat ஆயிரத்து ஐம்பத்தி மூணு status என்ன?` failed because the previous phrase aliases only recognized formal `ஐம்பத்து மூன்று` and were inside the bridge flag. One pure deterministic parser, `parseSpokenNumber`, now underlies transcript number normalization in all modes. The real-mic phrase maps to H-1053 with the bridge both off and on. Existing English IDs, digit dictation and leading-zero normalization remain supported; a four-digit number inside arbitrary chatter alone still does not create a heat intent.
- Tamil coverage includes every requested formal/colloquial unit and zero spelling, all requested tens and combining forms, teens 11–19, all three thousand forms, and digit dictation. Hindi has an explicit complete 0–99 cardinal table, spelling variants including nukta normalization, thousand/hundred forms, Devanagari digits, and Latin Hinglish forms. Mixed native/English words and numeric digits share the same grammar. Tests include 1001, 1010, 1052, 1053, 1099 and 2045. No per-phrase number aliases remain in the mapper.
- Unknown commands, explicit unparsed heat queries and missing heat lookup results now show and speak the friendly retry in the selected reply language. A successfully transcribed empty clip is also a retry. Actual failed STT/network requests still use the error state; no network failure is treated as a successful lookup. Contextual why-HOLD/element questions can still use the selected heat.
- Hindi values keep two decimals. Maximum limits keep at least two decimals and minimum limits at least one, preserving additional precision (including scientific-notation small inputs). H-1053 now says `सीमा 0.30`, not `सीमा 0.3`. Tamil/English gate answer strings were not changed.
- Browser `voice_turn_timing` records STT request ms, answer ms, TTS request ms, queue wait ms, reply language and a fixed path label (`cache`, `timbre-v3.0`, `v2.5 fallback`, `gTTS`, `mock`, `unknown` or `error`). It contains no transcripts, API keys, prompt text or raw provider bodies. STT includes browser-to-Agent round trip; answer includes read-only lookup/optional existing Tamil phrasing; TTS includes its browser/Agent round trip. Missing stages, e.g. STT for demo text or answer time for an automatic alert, are null. `X-TTS-Source` is now exposed alongside the existing provider header so the browser can distinguish disk-cache hits from live synthesis.
- A confirmed local scheduling cost was that synthesis waited for earlier playback to finish. Audio preparation now begins when a reply is requested, while playback remains serialized. A regression test proves the Hindi request starts during Tamil playback and that the two audio players never overlap. Mute/generation cancellation and echo-guard behavior remain intact. Bilingual HOLD alerts retain their intentional Tamil-then-Hindi sequence. No voice, model, rate or fallback order was changed. The subsequently requested backend timeout cap is documented below.

### TTS-only latency measurements

Exactly **6 / 6 authorized Gnani TTS requests**, **0 STT requests**, no retries. `tools/f2_tts_latency.py` alternated Tamil/Hindi, three trials each, using the existing configured **timbre-v3.0 / Kalpana**. Each trial used an isolated initially empty disk-cache folder, then immediately repeated its successful request with `max_calls=0` to measure a warm cache without network. Attempts are journaled before HTTP and capped at six, including failed requests.

Both test sentences have eight whitespace-separated tokens. Equal token count does not imply equal phonetic duration:

- Tamil: `ஹீட் ஹோல்டில் உள்ளது. தயவு செய்து திரையில் விவரங்களை பார்க்கவும்.`
- Hindi: `हीट होल्ड पर है। कृपया स्क्रीन पर देखें।`

| Trial | Language | Cold TTS ms | Served path / outcome | Audio seconds | Cache repeat ms / path |
|---:|---|---:|---|---:|---|
| 1 | Tamil | 60426.6 | no audio; v3.0 read timeout (60 s) | — | — |
| 2 | Hindi | 3148.0 | timbre-v3.0 / Kalpana | 2.88 | 7.5 / cache |
| 3 | Tamil | 15830.6 | no audio; connection reset (10054) | — | — |
| 4 | Hindi | 2777.0 | timbre-v3.0 / Kalpana | 3.04 | 13.5 / cache |
| 5 | Tamil | 2584.9 | timbre-v3.0 / Kalpana | 4.24 | 17.2 / cache |
| 6 | Hindi | 8124.1 | timbre-v3.0 / Kalpana | 2.96 | 15.8 / cache |

All successful cold requests used the primary configured model/voice. No v2.5 fallback or gTTS served these measurements. Each cold trial allowed only one network attempt; fallback could not spend another call. Production fallback behavior is unchanged. Failed trials were not retried and no seventh call was made. The full attempt journal and WAV cache stay in the ignored `app/data/tts_cache/f2_real_mic_latency/` folder.

### Cause and interpretation

The measured Hindi delay is in cold upstream synthesis/network time (2.78–8.12 s), not a fallback voice or a language-cache collision; warm Hindi repeats take 7.5–15.8 ms. The one successful cold Tamil trial took 2.58 s, but two Tamil transport failures prevent a meaningful language-wide latency comparison. Hindi audio itself lasted about 3 s versus 4.24 s for the successful Tamil sample, so this probe does not reproduce a slower Hindi speaking rate.

The playback-queue scheduling cost is demonstrably in our code and was fixed without changing playback order. However, without timing logs from the original microphone turn, it cannot be established as that turn's precise cause. A first Hindi answer legitimately has a different language-aware cache entry; full Hindi reasons also contain heat/limit sentences whereas the existing short Tamil spoken reasons omit limits. No invented diagnosis of a Hindi-specific provider bug or timeout is claimed. The subsequent explicit request adds an eight-second timeout cap below; the new turn logs distinguish these causes on a subsequent manual test.

Physical microphone/browser re-verification was left to the owner. No new live STT test or seventh TTS call was performed. Flags, `.env`, `.env.local`, gate logic/seeds, safety blocks, streaming protocol, Evon, README and prior benchmark result files were not changed. Safety precedence remains covered by all prior tests. No commit.

### Verification and changed files for the real-mic fixes

- `python -m pytest tests -q`: **158 passed**, 12 existing deprecation warnings, 6.83 s. One additional mocked route test verifies actual provider/cache headers and Hindi language forwarding, without live requests.
- `npx vitest run --configLoader runner`: **404 passed**, seven files, 11.50 s. All previous 303 cases retained; 101 added cases cover independent Tamil units/tens/teens, Hindi samples/variants and table coverage, numeric IDs/mixed forms, flag-off Tamil, limit precision, retries versus network errors, safe timing metadata, and concurrent TTS preparation with serial playback. Existing Hindi limit assertions were updated for 0.30 / 3.0.
- `npm run build -- --configLoader runner`: **passed**, 2,807 modules in **18.06 s**.
- Tests explicitly start with the bridge flag off, independent of local development settings; tests for the enabled bridge still opt in. No `.env.local` edits were made.

Files changed in this follow-up (separate from the earlier F2 file list):

- Agent: `app/main.py`, `tests/test_language_bridge.py`, `tools/f2_tts_latency.py` (new), `DOCS/F2_HINDI_BRIDGE.md`.
- Frontend: `src/services/spokenNumbers.js` (new), `src/services/voiceIntents.js`, `src/services/languageBridge.js`, `src/services/hindiVoice.js`, `src/services/voiceTranscript.js`, `src/services/copilotService.js`, `src/hooks/useSpeak.js`, `src/components/voice/PushToTalk.jsx`, `tests/spoken-numbers.test.js` (new), `tests/language-bridge.test.js`, `tests/hands-free.test.js`, `vitest.config.js`.

The previous uncommitted F2 changes and unrelated `.claude/` files were retained. TTS WAVs and the six-attempt journal remain ignored. The original microphone turn's exact delay cannot be reconstructed retrospectively; the six-call limit was respected rather than extending the experiment.

### Follow-up: 8-second Timbre timeout cap

Implemented without any further live requests. The live budget remains **6 / 6 TTS, 0 STT**. The 60.43-second timeout and 15.83-second reset in the historical table above were measured before this cap; none of those numbers were replaced with mocked or estimated post-fix timings.

`GNANI_TTS_TIMEOUT_S` defaults to **8 seconds**. Positive finite overrides can shorten it; values above 8 are capped at 8, and invalid/nonpositive/nonfinite settings use 8. `.env.example` documents this setting; `.env` and `.env.local` were not edited. `status().tts_timeout_s` reports the effective value without secrets.

Both primary Timbre and configured v2.5 fallback HTTP requests use this timeout. On `requests` timeout or connection error/reset, the attempt immediately returns to the existing fallback chain, without sleeping or retrying the same model: primary -> v2.5 -> gTTS. Cached v2.5 audio is checked before making another HTTP request, including when the remaining call budget is zero. Existing voice/model/language/cache keys and fallback order are unchanged. This is a per-request connect/read timeout, not an eight-second deadline for the entire chain: if both Timbre requests stall they can each consume their limit; gTTS retains its existing behavior.

Server logs report the actual served path and language through Uvicorn's existing INFO logger, including cache, primary, v2.5 fallback and gTTS. New timeout/reset failure logs use fixed reason codes instead of exception bodies. No transcript, key, raw request or provider body is included in these new logs. The browser's existing timing/path logs and provider/source response headers remain intact.

Mocked HTTP verification adds **13 pytest cases**: default/shorter/oversized/invalid timeout settings (9), timeout and reset to v2.5 with no retry or sleep (2), timeout plus reset followed by mocked gTTS (1), and timeout followed by cached v2.5 without a second HTTP attempt (1). Served-path logs and absence of private text/keys are asserted. Tests block real network access and mock gTTS too.

Final verification:

- `python -m pytest tests -q`: **171 passed**, 12 existing deprecation warnings, **4.01 s**.
- `npx vitest run --configLoader runner`: **404 passed**, seven files, **5.66 s**.
- `npm run build -- --configLoader runner`: **passed**, **2,807 modules**, **8.99 s**.

Files changed by this timeout follow-up: `app/copilot/gnani_client.py`, `app/copilot/voice_service.py`, `tests/test_gnani_tts.py`, `.env.example`, and this report. Prior parser, friendly retry, Hindi precision and queue fixes remain as documented above. No frontend source changes were required for this follow-up. No additional Gnani calls, physical microphone verification or commit.
