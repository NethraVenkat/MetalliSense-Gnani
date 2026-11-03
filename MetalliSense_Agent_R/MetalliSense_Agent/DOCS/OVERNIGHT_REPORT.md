# Overnight report — f15-overnight

2026-11-03, Asia/Calcutta. Builders assigned by the overnight request: Manish (Task 1/checks), Nethra (F13b/F13c). No stage, commit, push, live Gnani call, audio synthesis or model training. Starting branch f15-wake-word at c8a9c3b; created the requested f15-overnight branch. Existing .claude/settings.local.json remains untouched and untracked. Existing staging was empty and remains empty.

## Task status and verification

Each row represents full Vitest, full mocked Agent pytest, then production build, run sequentially. All final checks passed. No task was reverted.

| Task | Status / builder | Vitest | pytest (GNANI_MOCK=true) | Production build |
|---|---|---:|---:|---|
| 1: experimental pause-v3 activation | DONE / Manish | 1,270; 20 files; 27.08 s | 360; 19.61 s | passed, 6.75 s |
| 2: loaded-page read-only answers | DONE / Nethra | 1,278; 21 files; 36.11 s | 360; 21.65 s | passed, 7.50 s |
| 3: short morning briefing | DONE / Nethra | 1,282; 22 files; 33.79 s | 360; 22.83 s | passed, 8.33 s |
| 4: regression/serialization checks | DONE / Manish | 1,284; 23 files | 363 | passed; final source snapshot also checked below |
| 5: README draft | DONE / draft attribution follows source documents | 1,284; 23 files | 363 | passed; final source snapshot below |

The initial Task 1 full run found a missing checkWake export in a synthetic UI test module and the existing Node 24 JSON-import compatibility failure in two backend scorer tests. Fixed the synthetic export and added the JSON import attribute; no existing assertion was removed/weakened. Rerun passed. Subsequent runs preserved passing checks. Focused development also caught and fixed temporary text-encoding and briefing-reason extraction defects before the successful Task 3 full run.

Task 4's concrete serialization audit also covered the optional Evon request paths. Sync provider calls from async API routes now run through asyncio.to_thread, avoiding event-loop blocking while waiting for the shared provider lease. These late Task 4 changes are covered by the final full sequence. No repeated model experiments were run.

## Task 1 — flow, evidence and files

The saved user-run pause-v3 journal records PASS for the small predeclared development screen: 25 completed requests; 10/10 wakes (8 குரல், 2 குறள்), 0/10 confusables, 0/5 conversation snippets; 4.48 calls/min. Trail: English Sherpa 0/6 (official English controls passed), custom CNN v1/v2 FAIL, Prisma pause-v1/v2 FAIL, no-keyterm v3 PASS. The one-speaker, quiet/headphones screen and roughly 65 s conversation do not establish reliability. Approximately 1 s latency remains an unverified end-to-end expectation. No new calls were made.

POST /copilot/voice/wake-check accepts a single mono PCM16 / 16 kHz / 1.5 s WAV, with bounded upload size. It reuses the audition's exact v3 payload (Prisma v3.0, ta-IN,en-IN, codemix, NO keyterms) and Python first-word helper. Flag off returns 404. One wake check in flight, conservative 1.1 s spacing after transport completion and maximum 15 attempts/min; concurrent/excess requests return 429 without another provider request. Completion-based accounting also remains conservative if another provider held the shared lease first.

The explicit Hands-free (Kural) toggle starts OFF. Local onset gating uses 20 ms frames, RMS .01, half-second preceding silence, at least 100 ms speech and a fixed 1.5 s snippet. Busy snippets are dropped. Wake remainder enters the same PTT safety/answer handler; a wake-only response captures one command with a 30 s cap. TTS/echo guard, PTT, tour and hidden-tab states suspend capture; stale results are invalidated, microphone resources released, and three consecutive errors disable the session. Existing PTT remains the fallback. No ambient stream is sent continuously to Gnani.

Paths below use A = MetalliSense_Agent_R/MetalliSense_Agent and F = MetalliSense_Frontend_R/MetalliSense_Frontend, relative to repository root.

Task 1 files:
- A/app/copilot/wake_check.py (new; Task 4 also adds shared serialization and conservative timing).
- A/app/main.py (new endpoint; Task 4 also moves blocking provider work to threads).
- A/tools/kural_gnani_wake_test.py (shared wake_parts helper; old experiment behavior preserved).
- A/tests/test_wake_check.py (new; 4 tests after Task 4 timing regression).
- A/tests/fixtures/wake-v3-parity.json (new, 25 transcripts only; no audio/secrets).
- A/DOCS/F14_LIVE_KURAL_DIAGNOSTIC.md (measured-result trail and integration note).
- A/.env.example (WAKE_WORD_ENABLED=false).
- F/src/services/wakeWord.js (new local gate and session lifetime).
- F/src/hooks/useWakeWord.js (new, default-off hook).
- F/src/components/voice/PushToTalk.jsx (toggle, common query path, mic exclusion).
- F/src/services/copilotService.js (wake endpoint request).
- F/tests/wake-word.test.js (new, 6 tests).
- F/tests/voice-everywhere.test.jsx (synthetic checkWake export only; assertions unchanged).
- F/src/services/approvedTourAudio.js (JSON import attribute for Node 24 scorer compatibility; no asset/caption/script change).
- F/.env.example, F/vite.config.js, F/vitest.config.js (shared flag/test configuration; also Tasks 2–4).

Tests cover frozen 25-transcript parity in both runtimes, first-word/remainder matching, short click rejection and fixed snippet length, default-off/no mic, suspended resources, safety refusal and mocked query routing, malformed audio, concurrent 429, spacing and minute cap. Live permission/echo/network behavior remains manual.

## Task 2 — loaded answers

Only already-loaded page snapshots are used, including mock-mode page data. Stock answers show named matches or top items with quantity/unit; Spectrometer shows latest available heat ID/time/C/Si/Mn; Grades show the named/selected specification ranges. Existing number formatting keeps 0.30. Question language selects ta/hi/en. Missing or malformed values are unavailable, never fabricated zeroes. Safety checks precede loaded answers; tour controls retain priority while a tour is active. No new request is triggered by this answer path.

Task 2 files:
- F/src/services/loadedVoiceAnswers.js (new).
- F/src/context/VoicePageContext.jsx (snapshot registration).
- F/src/pages/RawMaterialStock.jsx, F/src/pages/Spectrometer.jsx, F/src/pages/GradeSpecs.jsx (register already-loaded state).
- F/src/services/voiceTranscript.js (shared file, loaded-answer branch after refusal).
- F/tests/loaded-page-answers.test.js (new, 8 tests: 3-language fixtures, dispatch, missing/invalid data, formatting, refusal, flag-off behavior).
- F/.env.example, F/vite.config.js, F/vitest.config.js (shared configuration).

New flag VITE_VOICE_PAGE_ANSWERS=false; requires VITE_VOICE_EVERYWHERE=true for shared page registration. Existing service-backed VITE_VOICE_DATA_READS behavior remains separate and unchanged when the new flag is off.

## Task 3 — explicit morning briefing

On Dashboard only, the three requested phrases (இன்னைக்கு briefing / morning briefing / आज की ब्रीफिंग) request the existing shift-summary heat list. The short answer includes all five status counts, the first current HOLD ID/reason if present, and the inactive/completed exclusion scope. Existing expiry/not-checked semantics are reused. Empty/error data says counts are unavailable. It is not spoken or requested on page load. Existing request lifecycle guards suppress stale answers.

Task 3 files:
- F/src/services/morningBriefing.js (new).
- F/src/services/voiceTranscript.js (shared safety-first dispatch).
- F/tests/morning-briefing.test.js (new, 4 tests covering all 3 languages/empty data, blocked writes, default-off behavior).
- F/.env.example, F/vite.config.js, F/vitest.config.js (shared configuration).

New flag VITE_MORNING_BRIEFING=false; review with VITE_VOICE_EVERYWHERE=true. Existing longer VITE_VOICE_DASHBOARD_BRIEFING remains unchanged when the new flag is off.

## Task 4 — regression findings and files

- The roughly 30 ms WebSocket timeout test now uses controlled deadlines when the intended receive starts, rather than scheduler-dependent sleeps. Original timeout/error/closed-upstream assertions remain.
- A single process-wide provider lease covers regular STT/TTS, transliteration, batch handover, wake check, SSE TTS, legacy STT WebSocket and optional Evon HTTP paths. A mocked test runs the real STT/TTS/transliteration/handover/wake/Evon clients concurrently and observes maximum concurrency 1; cancellation cannot leak/release another owner's lease.
- The existing ptt-recording.test.js is now included in the full frontend suite: 30 s cap, one submission, track cleanup and cancellation tests remain unchanged.
- Current F13 document strictly decodes as UTF-8 and has no literal ??? placeholder or replacement glyph. No guessed wording or unnecessary document rewrite was made.
- Existing saved-HOLD/refresh/navigation silence and new-check transition announcement tests pass, including H-1053 and language combinations. No HOLD engine/announcer changes were needed.

Task 4 files:
- A/app/copilot/provider_calls.py (new).
- A/app/copilot/gnani_client.py, A/app/copilot/gnani_batch.py, A/app/copilot/gnani_tts_stream.py, A/app/copilot/gnani_stream.py (shared lease).
- A/app/copilot/evon_explainer.py, A/app/copilot/evon_phrase.py (optional Evon paths use the same lease).
- A/app/main.py (thread dispatch for blocking provider calls).
- A/app/copilot/wake_check.py (shared post transport and conservative spacing/accounting).
- A/tests/test_provider_calls.py (new, 2 tests; synthetic transports only).
- A/tests/test_gnani_stream.py (deterministic timeout regression).
- A/tests/test_wake_check.py (additional completion-spacing regression).
- F/vitest.config.js (includes existing PTT recording tests).

Deployment limitation: the lease is process-wide, not distributed. Run one Agent worker. A legacy STT WebSocket reserves it for the connection lifetime; another provider request can wait or time out. Live legacy-stream/PTT/TTS interoperability needs owner checking; do not launch offline audition tools concurrently with application live review. No live serialization/latency claim was made.

## Task 5 — draft and missing evidence

New A/DOCS/README_DRAFT.md only; original README.md unchanged. Contains flags, measured/rejected-model trail, source-based team attribution, setup, safety and limitations. Current repository/DOCS search did not locate supporting F8 bias or F12 clone artifacts. The requested F8 5/6 versus 6/6 comparison and F12 outcome are explicitly unverified, not invented as successful or failed measurements.

## Flags and exact restart instructions

All four newly introduced defaults remain false. No local .env/.env.local was edited. For owner review only, add to the existing backend .env:

```dotenv
WAKE_WORD_ENABLED=true
```

Keep the existing backend-only GNANI_API_KEY and valid speech provider setup. GNANI_MOCK=true exercises no live provider; live review requires the owner's existing real configuration. Never put credentials into VITE_*.

In the frontend ignored .env.local:

```dotenv
VITE_SHOW_VOICE_PANEL=true
VITE_COPILOT_BASE_URL=http://localhost:8001
VITE_VOICE_EVERYWHERE=true
VITE_WAKE_WORD=true
VITE_VOICE_PAGE_ANSWERS=true
VITE_MORNING_BRIEFING=true
```

Leave older VITE_VOICE_DATA_READS / VITE_VOICE_DASHBOARD_BRIEFING false to isolate these new variants. Restart both services after environment edits. Starting at repository root, use separate PowerShell terminals:

```powershell
Set-Location .\MetalliSense_Agent_R\MetalliSense_Agent
.\.venv\Scripts\python.exe .\app\main.py
```

```powershell
Set-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd run dev:mock -- --configLoader runner
```

Open Vite's URL, select language, unmute, then explicitly enable Hands-free (Kural). It does not activate on refresh. To revert behavior, set the four new flags false and restart; no asset restoration is needed.

Manual checks still required: permission/real mic; pause then Kural plus a safe question; wake-only followed by one command; TTS/PTT/tour/hidden-tab mic handover; 3-error fallback; live provider rate/latency/echo/headphones; question-language replies on Stock/Spectrometer/Grades and Dashboard. Confirm refused write-like queries remain neutral. No Chromium/microphone/audible listening verification was performed overnight, and no live calls or new recordings were made.

## Preservation and final checks

All 890 starting protected file hashes match, including exactly 22 production tour WAVs, devval-v1 (162 protected files), devval-v2 (144), train-paired-v1 (260) and CNN v1/v2 evidence/checkpoints (overlapping group counts 244/58). No original dataset, review, model or tour audio was modified. Generated logs and hash reports are under ignored tools/local_wake_data; no data/keys are in new fixtures. S03 was not used.

Evidence/log root: tools/local_wake_data/overnight-09f603d464f3404e92380b1d4b2867ac/. Historical failed and successful logs retained; final-protected-verification.json records zero changed/missing files. Both staged and unstaged diff checks passed. Git emitted its existing inaccessible global-ignore warning and LF/CRLF notices, not diff-check errors.

Final full-sequence output: see completion-vitest.log, completion-pytest.log, completion-build.log in that evidence directory. Exact counts/timings are appended below after completion. No frontend source changes follow that run. This report is the final documentation artifact; no commit or push.

Final actual output (all exit codes 0):

```text
Vitest: 23 files passed; 1,284 tests passed; 31.89 s.
pytest: 363 passed, 12 existing deprecation warnings; 21.55 s.
Production build: passed; 7.46 s.
```

Both diff checks pass. All 890 protected hashes are unchanged. All 22 production-built tour WAVs match the approved manifest hashes; built-tour-hashes.json records step/file/hash. The existing base-relative audio delivery is retained. No live calls, training, S03 use, staging, commit or push.

## Wake-check runtime import repair — 2026-11-03

The live `python app/main.py` launch exposed a missing-tools import hidden by pytest's Agent-root import path. The endpoint imported the offline audition harness for its pure payload/matching helpers. Moved the unchanged FIELDS/RULE/RULE_V2, payload_fields, legacy wake predicate, first_word_wake and wake_parts to app/copilot/wake_rules.py. The endpoint uses a package-relative import; it has no tooling dependency or added sys.path workaround. The offline CLI re-exports the same helpers from app.copilot.wake_rules and bootstraps its own Agent-root import path for direct script invocation only. Its experiment logic, payloads, outputs and journals are unchanged.

This repair changes app/copilot/wake_check.py, tools/kural_gnani_wake_test.py, adds app/copilot/wake_rules.py and tests/test_wake_runtime_import.py, and appends this report. All earlier overnight and unrelated edits remain intact. New regressions: isolated subprocess with only app/ plus installed-library paths, forbidden tools imports, fixture WAV POST through the actual endpoint and mocked provider transport returns 200; AST audit of all application imports; shared-helper identity and standalone offline CLI help. Existing 25-transcript parity remains covered. No flag, rule, threshold or provider setting changed. Restart the Agent with the same existing `python app/main.py` command to load the fix.

Protected verification: 919 files unchanged, including the prior 890 protected artifacts plus all 29 pause-v3 files. This includes 22 tour WAVs, devval-v1/v2, train-paired-v1 and CNN evidence/checkpoints. Evidence: tools/local_wake_data/wake-import-repair-9be800e4fcf54df8bf9b19e8cbabf33a/. No live provider calls, inference, training, staging, commit or push.

Repair verification note: the first full backend run exposed an existing test's dependence on the owner's local WAKE_WORD_ENABLED setting. tests/test_wake_check.py now explicitly sets false for its flag-off scenario, preserving its original assertions and restoring deterministic isolation; no local settings changed. The focused runtime/rule/audition selection then passed 19 tests in 17.95 s. The runtime subprocess uses isolated Python (-I), UTF-8 output, app/ as its application path, a blocker for tools imports and a mocked provider; its fixture POST returns HTTP 200 with the unchanged payload/remainder. The CLI --help check makes no experiment call or journal write. Both the failed full-run log and final rerun logs are retained separately.

Final runtime-repair verification: **1,284 Vitest tests passed (23 files), 52.91 s; 366 mocked Agent pytest tests passed, 12 existing warnings, 58.81 s; production build passed in 28.71 s**. Executed sequentially. All 919 protected hashes still match after completion, including all 29 pause-v3 files and 22 tour WAVs. Both diff checks passed. No live call or flag-default change; restart the existing Agent process to load the repair.

## Wake-check transport diagnostics and wake-only command capture — 2026-11-03

Confirmed endpoint-versus-successful-harness mismatches: missing descriptive User-Agent, multipart filename wake.wav versus snippet.wav, and timeout 8 versus 60 seconds. Endpoint now sends User-Agent MetalliSense-Kural-Pause-Audition/1.0 and snippet.wav. Per the user's follow-up, provider timeout is deliberately 15 seconds, NOT the harness's 60 seconds. Browser request timeout is 18 seconds so a provider timeout response normally arrives first; no retry or new request is added. requests.post and the harness's explicit zero-retry Session both use zero retries. HTTPS endpoint /stt/v3, X-API-Key-ID / GNANI_API_KEY, audio_file multipart field, audio/wav, model prisma-v3.0, language_code ta-IN,en-IN, codemix and NO keyterms agree. Both parse transcript only with success=true and the expected model. Harness directly reads the backend .env; application uses the environment loaded by app/config.py from the same absolute .env (existing shell variables retain precedence). A sanitized local check found both keys present and equal. The transport differences are confirmed; which caused the reported live 502 is unknown until the owner retries. No live request was made.

The exact local manish-DW01-01.wav is accepted by validation: 48,044 bytes, mono PCM16, 16 kHz, 24,000 frames / 1.5 seconds. Only offline validation with an injected fake sender was used. Provider failure logs now emit one bounded sanitized line through uvicorn.error: wake_check_failure, exception type, HTTP status, provider code/message, elapsed_ms, path and lease/spacing/rate-limit rejection status. Messages redact the configured key, credentials and long encoded tokens; no headers or audio are logged. Gateway textual errors are inspected only on failed text responses. Public response remains wake_unavailable. Concurrent/rate-limit rejection is logged without another provider call.

Wake-check failures remain Waiting for Kural, show Wake check unavailable, count toward three-error auto-off, and never enter the query handler or Thinking. Wake-only success shows Listening (visual cue, no TTS); capture ignores preceding quiet, waits at most six seconds for speech onset, then records one utterance ending after one second quiet or the thirty-second cap. No-onset timeout returns silently to Waiting and does not call STT. Thinking is reserved for a recognized remainder or a nonempty captured command. Cleanup/stale callbacks remain scoped to the existing session.

Changed in this follow-up: app/copilot/wake_check.py; tests/test_wake_check.py (transport parity with the actual harness sender, sanitized HTTP/timeout diagnostics, exact local WAV validation); tests/test_provider_calls.py (updated snippet filename classification); frontend src/services/wakeWord.js, src/services/copilotService.js, tests/wake-word.test.js (six-second no-onset, one speech-started STT, 502/error auto-off and thirty-second cap); this report. No flag defaults, payload/rule semantics, harness journals, tour/audio or local environment changes. Evidence/log root: tools/local_wake_data/wake-transport-fix-81e84c150a634291908b11801e2e9f8a/.

Final transport/capture verification (sequential): **Vitest 1,287 passed, 23 files, 85.71 s; mocked pytest 370 passed, 12 existing warnings, 156.83 s; production build passed, 35.26 s**. Both git diff checks passed. All 919 protected hashes are unchanged; final-preservation.json records the exact source WAV properties and preservation result. No live request was attempted. Restart the Agent with the existing `.\.venv\Scripts\python.exe .\app\main.py` command and reload the frontend before retrying. Look for `wake_check_failure type=... http_status=... message=... elapsed_ms=... path=provider lease=not_rejected spacing=not_rejected rate_limit=not_rejected`. Elapsed time includes provider-lease wait and request/response parsing; it is not an isolated network latency measurement. HTTP errors and transport timeouts are distinguished; example placeholders above are not an actual observed provider error. The confirmed transport mismatches are repaired, but the actual live failure cause remains unconfirmed until the owner retries. No staging, commit or push.
