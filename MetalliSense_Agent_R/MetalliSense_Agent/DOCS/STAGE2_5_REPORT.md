# Stage 2.5 — Gnani feature comparisons

2026-11-12, branch v23-improvements. No commit/push. Generated TEST speech only; no private audio, plant action, training or approved-tour-audio generation. No environment files edited or printed.

## Contracts checked before coding

The supplied `.md` URLs were unavailable through the documentation browser; their official canonical pages were read instead:

- [Prisma v3](https://docs.gnani.ai/api/STT/models/prisma-v3): REST `/stt/v3`, multipart `audio_file`, `model=prisma-v3.0`, `language_code`, `format`; `keyterms` accepts a JSON array or comma-separated list, at most 200; `topic` at most 1600 characters. Context requires an A/B check on the actual audio. No previous_text or session history is added here.
- [Audio tags](https://docs.gnani.ai/api/TTS/tts-audio-tags): case-sensitive inline tags, no closing tags; v3 only, tags stripped on v2.5, tag-only requests rejected. `<slow>` changes pacing and `<pauses>` inserts silence.
- [TTS SSE](https://docs.gnani.ai/api/TTS/tts-sse): both models supported, raw linear PCM supported; base64 chunk events followed by complete, one active request per key.

## Part 1 — command context: keep OFF

New Agent flag **`STT_CONTEXT_ENABLED=false`**, read at request time. Backend-only feature; no VITE flag is needed. Command/answer/form/confirmation purposes may receive a pinned 111-term vocabulary plus a 122-character foundry topic on Prisma v3. Vocabulary provenance is recorded in `app/copilot/command_keyterms.json`: page metadata, registered action phrases, mock materials, grades, heat-style IDs, supplier names and element terms. `tools/build_command_context.py` regenerates it from the repository root. It is a pinned application/mock vocabulary, not a live snapshot of arbitrary production suppliers.

The flag-off command baseline already sends the existing small `GNANI_STT_KEYTERMS` list. OFF here means existing list/no topic; ON replaces it with the application list/topic. It is not a zero-keyterm baseline. Model, locale hints, codemix format, audio bytes and routing code remain identical across each pair.

Private capture previously inherited that legacy list. It now explicitly passes `purpose=private`; private/passcode/wake purposes receive neither legacy nor new keyterms/topic. The actual wake endpoint continues using its separate unchanged no-keyterm builder. The private regression asserts this explicit boundary; no passcode speech was generated or transcribed in Stage 2.5.

| Group | Correct routes OFF | Correct routes ON | Recommendation |
|---|---:|---:|---|
| Tanglish | 4/5 | 3/5 | Keep off: regression |
| English-designated command group | 9/10 | 9/10 | No gain |
| Hindi | 2/5 | 2/5 | No gain; existing misses remain |

The English-designated group includes the explicitly requested `spectrometer ku po`, spoken by English SAPI. Tanglish reuses five previously generated Timbre clips; English uses local Windows SAPI; Hindi uses five newly generated configured Timbre clips. Same WAV per OFF/ON pair. The plan, hashes, raw transcripts and expected intents were saved before classification. Actual frontend matchers classify saved output without collecting fields, executing actions or approving anything. H-1053 remains a HOLD target; classification of a melting request is not permission to execute it.

Concrete regression: `oru reading edu` became `Oru reading ediu.` OFF (request_reading) versus `Oru reading ed.` ON (spectrometer_heat_reading). No alias was added after seeing these results.

Evidence: `tools/local_wake_data/stage2_5-context-6552dfd8f863484e9df210bf0016e0d1/` — plan, configuration, 20 WAVs, results, routing, summary and HTTP journal. **45 calls: 5 TTS + 40 STT**. No tuning/retest after seeing the regression.

## Part 2 — payload-only safety audio tags: listening pending

New Agent flag **`TTS_AUDIO_TAGS=false`**. Configured model/voice: **timbre-v3.0 / Kalpana**, 22050 Hz. No model substitution. No frontend flag needed: display text stays unchanged and the shared `tts_text` provider boundary handles both REST and SSE. Exact v2.5 remains plain. Empty/tag-only text cannot become a synthesis request.

Confirmation prompts receive a pause; passcode prompts receive pause + slow; ID/quantity read-back text receives slow. A combined read-back/confirmation inserts the pause before the confirmation phrase. At most two new tags are inserted; this safety path takes precedence over the older clarity-tag expansion when it matches. Cache identity includes the final tagged payload, so plain/tagged audio cannot collide. Text matching covers English, Tamil and Hindi prompt forms, not arbitrary user transcripts. Human checks are still needed for pronunciation-normalized read-backs whose IDs/quantities have already become words before reaching this boundary.

Five prompts per language were synthesized OFF/ON, **30 calls**, with fallback disabled. Prompt numbers below correspond to yes/no; generic passcode prompt (no code); H-1051/4000 kg read-back; PR-1001/2000 kg read-back; test-action/yes-no.

| Language | Prompt | Plain seconds | Tagged seconds |
|---|---:|---:|---:|
| English | 1 | 1.360 | 2.960 |
| English | 2 | 1.120 | 1.988 |
| English | 3 | 5.120 | 5.760 |
| English | 4 | 4.000 | 4.320 |
| English | 5 | 5.200 | 6.000 |
| Tamil | 1 | 2.560 | 2.480 |
| Tamil | 2 | 1.440 | 2.041 |
| Tamil | 3 | 4.960 | 6.640 |
| Tamil | 4 | 5.520 | 5.760 |
| Tamil | 5 | 4.640 | 4.640 |
| Hindi | 1 | 1.760 | 2.160 |
| Hindi | 2 | 1.520 | 2.394 |
| Hindi | 3 | 4.480 | 6.160 |
| Hindi | 4 | 5.120 | 4.800 |
| Hindi | 5 | 3.600 | 4.800 |

All 30 WAVs have readable, nonempty complete frames. Timing is not a listening verdict; tags did not uniformly lengthen output. Keep OFF until human comparison of all languages. Playback:

The generated Tamil passcode example uses a generic பாஸ்கோட் wording. A final source check also verified the app's exact existing `approvalPrompt.ta`, `உங்கள் அனுமதி குறியீட்டை சொல்லுங்க.`; that explicit form was added to the payload matcher and regression assertion. No UI wording or audio was changed to make it match, and no additional provider calls were made for that final repair. Its actual spoken delivery remains a human check.

```powershell
# From the Agent directory
Start-Process '.\tools\local_wake_data\stage2_5-tags-e49baa11d6a646bd81b7c50e2233e3fc\index.html'
```

## Part 3 — existing SSE works, not faster in this sample

No production streaming code/flag/default changed. Existing flags remain **`GNANI_TTS_STREAM=false`** and **`VITE_TTS_STREAM=false`**. Five REST/SSE pairs used identical text/model/voice/sample rate, an isolated cache cleared between pair members and the existing SSE `speak_events` implementation. Fallback calls were disabled in this diagnostic. The process-wide provider lease remains held throughout the upstream stream; no parallel calls. All five eventually emitted PCM then complete.

The first ten-call comparison incorrectly included diagnostic spacing in readiness timers, and the initial REST call had no preceding wait. It is preserved at `tools/local_wake_data/stage2_5-stream-1b4dc6290b404d89b041fc59dd2454a4/` as **preliminary, timing-biased evidence**, not the primary comparison. The helper was repaired to wait before starting BOTH timers, then the five pairs were repeated once, with no production changes. Corrected evidence: `tools/local_wake_data/stage2_5-stream-2a487ebcdb7040b58bc0297459abfede/`; **11 attempts: 5 REST + 6 SSE**, including one failed SSE start and one bounded retry.

| Reply | REST first playable ms | SSE first PCM ms |
|---|---:|---:|
| H-1053 HOLD | 1875 | 547 |
| Latest reading | 766 | 46672 (includes failed start + 30s backoff + retry) |
| Stock quantity | 813 | 2609 |
| Gate decision | 1266 | 922 |
| Cancelled action | 969 | 750 |
| Median | 969 | 922 |

SSE is sooner in 3/5 corrected pairs and slightly sooner by median, but the long failed-start/retry and another slower reply do not support enabling it. **Keep off.** The failed start has no HTTP status; the existing generator swallowed its exact exception before the diagnostic journal retained it. A later logging-only helper repair records future transport exception classes, without another call. Do not infer credits, permissions or a particular network cause from this evidence. No partial audio was retried.

REST readiness is a complete validated WAV; SSE readiness is the first decoded PCM event. These are Python client readiness measurements, not actual browser playback or acoustic latency. Request order is REST then SSE; the small sequential screen is not a randomized latency benchmark. The corrected ordinary spacing is excluded; failure/backoff remains included in the affected reply's user-visible wait.

If separately testing streaming later, set `$env:GNANI_TTS_STREAM='true'` before starting the Agent, and `$env:VITE_TTS_STREAM='true'` before starting/rebuilding the frontend. This task does not recommend enabling it. The same shared lease and existing first-audio timeout remain unchanged.

## Optional Part 4

Auto reply language was **not implemented or evaluated**. No `STT_AUTO_LANGUAGE` production behavior/flag was introduced; current language choice is preserved. Scope/time was kept on the required three comparisons and their regression checks rather than adding another unvalidated language policy.

## Verification and remaining checks

Total live attempts recorded: **96 = 40 STT + 56 TTS attempts** (including eleven SSE attempts across preliminary/corrected comparisons). There are **95 recorded 200 responses plus one failed SSE start without a recorded HTTP status**. Diagnostic retries are capped at three with 30-second backoff; SSE never repeats partial audio. One real request at a time, no live app Agent launched, temporary DATA_DIR/cache removed on exit. No new dependency, pretrained model, uploaded user recording, authorization change or production data write.

New tests: `tests/test_stt_context.py` (purpose/flag scope, private exclusion and vocabulary limits), `tests/test_safety_audio_tags.py` (three language prompts, default off, exact model, ordinary text and tag-only text). Existing private-capture test updated to require `purpose=private`; its first run correctly failed against the old mock signature (93 passed/1 failed) before that assertion was updated. No assertions/timeouts were relaxed.

Implementation files: `app/copilot/gnani_client.py`, `voice_service.py`, `voice_foundation.py`, `app/main.py`, new `stt_context.py` and `command_keyterms.json`; tooling `tools/build_command_context.py`, `tools/stage2_5_diagnostic.py`, frontend offline-only `tests/stage2_5-routing.mjs`; the tests above and this report. No frontend production source changed.

### Required per-part gates

| Gate | Full frontend | Build | Mocked Agent pytest |
|---|---|---|---|
| Part 1 | 2638 passed, 3 failed, 32 skipped; 4 files failed; 765.96s | passed, 27.10s | 488 passed, 5 failed, 99.90s |
| Part 2 | 2671 passed, 2 failed; 3 files failed; 521.36s | passed, 19.69s | 493 passed, 136.15s |
| Part 3 / final | **2673 passed, all 48 files, 311.82s** | **passed, 15.13s** | **495 passed, 68.02s** |

Part 1 Agent failures were caused by a missing local `_env_bool` import in the newly changed transcription endpoint, not baseline artifact failures. It was fixed before Part 2; the existing language-bridge/transliteration response regressions then passed. New explicit endpoint tests cover both flag states in the final gate.

Browser failures so far: Part 1 real-page-controls startup/cleanup hooks (32 skipped), dev-module-smoke normal-dev page load, orb review timeout and voice-log-viewer page load. Part 2 real-page-controls assertions all passed but its cleanup hook timed out; orb review and voice-log-viewer again timed out. No frontend production source, timeout or assertion was changed. Full-run failures remain failures even if an isolation run passes. Logs: ignored `.overnight_backup/v23-stage2_5/part1/` and `part2/`. Initial test state had no tracked changes; only the tests' own two generated F17b review outputs will be restored after final verification.

All previously failing browser checks passed in the final full run without source, assertion or timeout changes. The specifically requested isolated `real-page-controls.test.jsx` also passed **32/32 in 50.45s**, including cleanup. No redundant additional isolation loop was needed after the clean full run. Earlier failed logs remain preserved; they are not rewritten as passes. No historical missing-artifact/Python-version baseline failure occurred in these gates. Agent runs reported 14 existing warnings; build retains its large-chunk warning, and Node reports the existing shell-spawn deprecation warning.

After the narrow exact-Tamil-prompt matcher/assertion repair, the complete mocked Agent suite was rerun once more: **495 passed, 14 warnings, 36.10s** (`.overnight_backup/v23-stage2_5/final-agent.log`). Frontend production sources remained unchanged, so its clean 2673-test/build result still applies.

Python compilation passed. All **22 source and 22 built tour WAV hashes** match the approved manifest. Both staged and unstaged diff checks pass, with Windows line-ending/ignore-access warnings. Only the tests' changed derived screenshot was restored to its clean starting bytes using read-only Git object inspection; generated evidence was retained separately. The F17b review JSON has no content diff (`git diff --quiet` exits 0), even if Windows stat/line-ending status still lists it. No Git index refresh/write was used to hide that status. Initial `.claude/` remains untouched and untracked. Generated speech, HTTP journals and caches are Git-ignored.

Human checks still needed: native pronunciation/pacing of the generated tag pairs, private-prompt clarity without changing capture deadlines, real microphone command context on unseen speech, browser acoustic first-audio timing and continuing H-1053 HOLD/PTT safety demo checks. No measured feature is approved merely because synthesis or HTTP succeeded.

### Local configuration

All new behavior remains OFF. No environment file was changed. If testing the tag pairs is satisfactory, a process-only local trial can be started from the Agent directory:

```powershell
$env:STT_CONTEXT_ENABLED='false'  # measured regression; keep off
$env:TTS_AUDIO_TAGS='true'       # optional local listening trial only
$env:GNANI_TTS_STREAM='false'    # keep off after this screen
.\.venv\Scripts\python.exe .\app\main.py
```

Restart the Agent for new process environment settings. Set `TTS_AUDIO_TAGS='false'` and restart to revert. No frontend restart/flag is required for command context or payload tags. Streaming, if separately requested later, requires both the Agent flag and a restarted/rebuilt frontend with `VITE_TTS_STREAM=true`; this report recommends leaving it off.
