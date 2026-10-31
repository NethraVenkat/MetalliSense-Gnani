# F10 transliterated transcript

2026-10-31 (Asia/Calcutta). Branch `f10-transliterate`. No commit. Flags default off. This is an optional **display-only second STT request**, never a replacement transcript for intent handling.

## Sequential fix: current implementation

The parallel path below is retained as history and has been removed from production code. `/copilot/voice/transcribe` now has exactly its original signature, synchronous main STT invocation and response schema, irrespective of GNANI_TRANSLITERATE. It never starts a second request, even if an old frontend sends transliterate=true. The optional field was removed from TranscriptionResponse.

New POST `/copilot/voice/transliterate` accepts the same multipart audio in a separate request. GNANI_TRANSLITERATE off returns 404/transliterate_disabled. When enabled it makes one display-only Prisma v3.0 REST attempt, format=transliterate, no language_code, with a six-second overall deadline and no retry. Success returns `{transcript_latin: ...}`; failure/timeout/mock/offline returns `{unavailable: true}`. No primary STT call is made by this endpoint and no provider error body/key is returned.

The browser first awaits the main endpoint and the existing answer handler. The answer is displayed and speak is invoked immediately through the existing path. The optional upload is scheduled separately in the background and **does not delay that answer or keep the panel processing**. Conservatively, it waits for the existing speech promise to finish playback before uploading, so it occurs after speech has started and does not compete with an in-flight Gnani TTS/SSE request. The Latin line can therefore appear after the reply finishes; muted/failed playback resolves through the existing speech path. No speech queue, model or TTS setting was changed.

The same File object/bytes are sent to both endpoints. A generation token is invalidated on a newer recording, demo/hands-free transcript, toggle-off or unmount; queued obsolete requests are skipped and an in-flight old result is discarded. Optional failures simply leave the grey line absent. Main responses cannot inject Latin text, even if a stale server returns such a field. Only the standalone result may populate the display; the existing display-only intent/safety isolation remains.

When the frontend feature is enabled, REST STT posts are serialized in copilotService across callers. A new recording may proceed while an older Latin call finishes; its next main upload waits if that old request is still in flight (server deadline six seconds; browser transport bound seven seconds). This is necessary to prevent REST overlap, and can delay a very fast next turn's upload; it never holds an already-returned main answer for its own Latin result. The display controller separately drains its pending request before another main upload. With the flag off, primary posts take their original direct path with no queue. This serializes this browser's REST capture calls, not unrelated applications or an existing hands-free realtime session, which remains out of scope.

## Sequential live retry: 8/8 STT, zero TTS

This is a separate explicitly authorized eight-call budget, in addition to the historical run below. The updated smoke tool preserves results.json and uses results_sequential.json under the same ignored cache folder. It exercised both actual Agent HTTP handlers in order through a local TestClient without model/service startup. Each main endpoint response completed before the corresponding Latin endpoint was invoked. No retries, synthesis, new recordings or extra live requests occurred. Production main retries remain unchanged; the measurement limits each primary attempt to one request for budget accounting.

All **eight provider responses were HTTP 200**. All four main calls succeeded, and all four standalone responses returned Latin text. This verifies successful sequential API pairing; it does not prove the cause of the earlier parallel failures.

| Clip | Main transcript | Latin transcript | Main endpoint ms | Latin endpoint ms |
|---|---|---|---:|---:|
| Tamil status | heat ஆயிரத்தி ஐம்பத்தி ரெண்டு நிலை என்ன? | Heat ayirathi aimbathi rendu nilai enna? | 1516.5 | 2084.7 |
| Tanglish why-HOLD | ஆயிரத்தி ஐம்பத்து மூன்று, என் hold. | ayirathi aimbathu moonnu en hold. | 3261.8 | 1227.4 |
| Hindi status | heat एक हज़ार तिरपन का स्टेटस क्या है? | Heat ek hazar tripan ka status kya hai? | 1381.8 | 1377.6 |
| English status | What is the status of heat one zero five one? | What is the status of heat one zero five one? | 1280.4 | 1163.8 |

There is **zero post-main wait for Latin by construction**: these are separate responses, and the primary response is already available before the second request starts. Main measurements range from 1.28 to 3.26 seconds. There is no new main-only repeated baseline, so this does not establish a provider-latency speedup. The live tool did not invoke answer TTS; browser answer/playback ordering, stale-result suppression and cross-caller HTTP serialization are verified with mocked frontend tests. The team still needs a real microphone/browser pass.

The original parallel failure, raw transcripts and timings below remain unchanged as history. Its missing HTTP statuses cannot be recovered. The account-concurrency explanation remains plausible but unproven; the current design does not rely on parallel STT support.

### Sequential validation

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **31.41 s**. All 205 pre-F10 cases retained; nine F10 backend cases now test unchanged primary requests with either flag, a separate sequential endpoint, no implicit second call, Latin HTTP failure/timeout, state isolation, disabled/mock behavior and safe unavailable responses. Obsolete parallel-orchestration tests were replaced.
- `npx vitest run --configLoader runner`: **690 passed**, 13 files, **9.40 s**. Fourteen F10 cases retain display-only safety isolation and add handler-before-upload ordering, no answer wait, speech completion ordering, stale-result invalidation, unavailable/error behavior and serialization across REST callers.
- `npm run build -- --configLoader runner`: **passed**, 2,816 modules, **26.81 s**.
- `git diff --check`: passed. No commit; local env files, README, gate/intents/safety/F7 and TTS implementation unchanged.

## Docs checked before implementation

- [Prisma v3.0](https://docs.gnani.ai/api/STT/models/prisma-v3.md): transliterate produces “the whole transcript in Latin letters”. The romanised-output section says “Numbers come out as words.” REST and Realtime support it; Batch does not. English words stay in the Latin-letter output. `language_code` is optional (omitting it means indic-auto); a supplied language is validated but a list is ignored. No detected_language_code is returned for this format. Romanisation is model-generated and its accuracy has not been measured by the provider; it should not be treated as an independently verified translation or ID parser.
- [Changelog](https://docs.gnani.ai/api/introduction/changelog.md): transliterate is “available on REST and Realtime”; missing language_code is permitted only for this format. This agrees with the feature request. The feature here intentionally uses only REST, not the supported Realtime variant.

The second call sends POST `/stt/v3`, `model=prisma-v3.0`, `format=transliterate`, no language_code, and the existing Latin-only static keyterms. Credentials remain server-side. The main request keeps its existing format, language/F2 handling, keyterms, retry policy and model settings unchanged.

## Historical parallel design and cost control (removed)

Agent `GNANI_TRANSLITERATE=off` and frontend `VITE_TRANSLITERATE=false` are default. The toggle **Show in English letters** appears only with the frontend flag. Its preference is persisted with guarded localStorage access. Neither .env nor .env.local was edited.

With both flags and the toggle on, multipart `/copilot/voice/transcribe` adds `transliterate=true`. The route starts the existing synchronous main STT path in a worker and an independent async Latin path, joined through asyncio.gather. Both receive the same uploaded audio. Each uses the existing audio conversion; valid WAV input is sent unchanged. The Latin client never overwrites detected_language_code, last_error or other primary answer state.

The Latin task has a six-second overall deadline (including preparation) and one HTTP attempt. Once the main call finishes successfully, it is allowed at most one further second; otherwise it is canceled and omitted. Completed Latin text may wait for the main result, never the other way around beyond that grace. A failed main result now cancels optional work immediately. Request cancellation also cleans up the Latin task. No provider body or API key is returned by the optional path.

The response adds transcript_latin only for a successful main response with available Latin text. When disabled or unavailable, that field is omitted; the previous response fields, including their existing null values, are retained. Mock/offline mode makes no second call and returns no invented romanisation. A non-Gnani primary service also omits it.

The small grey **Heard (English letters): ...** line sits directly below Heard. Turning the toggle off removes it. Starting a new recording, demo transcript or hands-free final clears the previous Latin line. The PTT display adapter removes transcript_latin from metadata before invoking the exact shared normal-transcript handler. The Latin string is never passed to mapIntent, safety checks, reply-language detection, answer generation or TTS. A malicious/conflicting Latin string cannot change the normal command; tests exercise both directions. No changes to voiceTranscript.js, intents, safety, number parsing, F7 ShiftHandover, gate logic or seeds were needed.

With either flag off, the frontend adds no request field and the Agent invokes its previous main STT function only, with the same arguments. Hands-free streaming is intentionally out of scope; its transcripts continue to drive the existing path without a second display request.

## Historical parallel live verification: eight calls used, zero TTS

The standalone `tools/f10_transliterate_smoke.py --max-calls 8` reused four cached clips: native Tamil status from the earlier F8 cache, Tanglish why-HOLD from F2 clip 08, Hindi status from F2 clip 01, and the existing English noise-bench status clip. No synthesis, microphone recording, retries or additional live calls were made. Each primary attempt was limited to one request **for this eight-call experiment only**; the production primary retry policy remains unchanged. The tool's durable journal/audio references are under ignored `app/data/tts_cache/f10_transliterate/`.

The existing local configuration had LANG_BRIDGE=on, so main calls retained the F2 default bridge language list ta-IN,hi-IN,en-IN and codemix. The separate display calls omitted language_code as documented. Neither setting was edited for the run.

**Outcome: no live response contained both transcripts.** In two pairs, the main request failed and Latin succeeded; in the other two, the main succeeded and Latin was unavailable. Successful paired behavior is verified with mocks, not established by this live run. HTTP statuses/provider error bodies were not retained by the measurement tool, so the cause of the asymmetric failures is unconfirmed. A provider/account concurrency restriction is a possibility, not a proven diagnosis. Do not claim that parallel calls are safe for this account or that main reliability/latency is unaffected. Both flags stay off.

### Raw side-by-side results

| Clip | Main transcript | Raw Latin result | Latin included in response? |
|---|---|---|---|
| Tamil status | Failed; no text | Heat ayirathi aimbathi rendu nilai enna? | No; main failed |
| Tanglish why-HOLD | Failed; no text | ayirathi aimbathu moonnu en hold. | No; main failed |
| Hindi status | heat एक हज़ार तिरपन का स्टेटस क्या है? | Unavailable | No |
| English status | What is the status of heat one zero five one? | Unavailable | No |

No previous cache transcript was substituted for a failed live main result. Raw romanisation is shown exactly as returned, without spelling/ID correction.

### Measured timings

| Clip | Main attempt ms | Latin attempt ms | Combined response ms | Wait after main completed ms |
|---|---:|---:|---:|---:|
| Tamil status | 1085.8 | 1558.9 | 1568.2 | 478.4 |
| Tanglish why-HOLD | 1075.9 | 1599.5 | 1606.7 | 528.3 |
| Hindi status | 1454.9 | 1010.1 | 1465.5 | 3.4 |
| English status | 1367.0 | 1065.4 | 1372.3 | 2.2 |

Attempt timing covers client preparation/HTTP completion, not only model inference. Unavailable Latin attempts do not imply a six-second timeout; they finished sooner. Combined response time includes async scheduling. Post-main wait uses the actual main completion timestamp, which differs slightly from main attempt duration because of worker scheduling.

The two successful main calls had about 2–3 ms of local post-main overhead, with no wait for Latin. The failed main calls initially waited about 0.48/0.53 seconds for optional work; after observing this, the final helper was changed to cancel optional work immediately on primary failure. That final failure-path change is **mock-verified only**, not remeasured live because the eight-call budget is exhausted. The timing table records the original live measurements, not a fabricated rerun.

No separate main-only baseline or frontend answer/TTS measurement was authorized within these eight requests. Therefore this run cannot establish the causal change in main answer latency or rule out remote contention. It demonstrates the omission behavior and a bounded local wait, not reliable live double-transcript delivery.

## Historical parallel validation

- `python -m pytest tests -q`: **218 passed**, 12 existing warnings, **23.72 s**. All 205 prior cases retained; 13 new cases cover opt-in/call count, unchanged main request/response, actual parallel starts, successful pairing, independent Latin payload/state, HTTP failures, overall/grace deadlines, immediate failed-main return and mock omission.
- `npx vitest run --configLoader runner`: **685 passed**, 13 files, **5.65 s**. All 676 prior tests retained; nine new cases cover toggle visibility, display conditions, exact off-mode form fields, persisted/denied storage, no fake text, and isolation of conflicting Latin text from the shared answer handler.
- `npm run build -- --configLoader runner`: **passed**, 2,816 modules, **16.43 s**.
- `git diff --check`: passed. No commit.

Manual browser/microphone verification remains. Account concurrency investigation and a successful live paired response remain unverified; this task made no requests beyond its budget. F7 handover and hands-free romanisation are unchanged/out of scope. There is no translation of the answer itself and no claim of exact Latin spelling or unchanged romanised number formatting.

## Files changed (current)

Agent: `.env.example`; `app/copilot/gnani_client.py`, `transliteration.py` (new); `app/main.py`; `tests/test_transliterate.py` (new); `tools/f10_transliterate_smoke.py` (new); this report (new). schemas.py was restored to its pre-F10 form.

Frontend: `.env.example`; `vite.config.js`; `vitest.config.js`; `src/services/copilotService.js`, `transcriptDisplay.js` (new); `src/components/voice/PushToTalk.jsx`; `tests/transliterate.test.jsx` (new).

Existing voice_service.py, voiceTranscript.js, ShiftHandover.jsx, STT/TTS defaults, local env files, README and existing benchmark results were not modified. Unrelated .claude files were left untouched.
