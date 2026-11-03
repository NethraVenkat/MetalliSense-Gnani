# F16 voice-action foundation

Builder: Manish. Branch f16-voice-actions. Default OFF. No plant action, provider call, training, audio regeneration, commit or push was performed during implementation.

## Scope

Only `test action` is registered: RUN, with no plant service and no backend effect. It reads back the no-effect summary, takes one bounded spoken confirmation, accepts yes / Tamil aama / Hindi haan, and reports the actual synthetic `{status:200, ids:[], demo:true}` result. No APPROVE action or arbitrary action execution endpoint is exposed. APPROVE is an infrastructure state machine tested with injected synthetic actions only. ASK retains the existing read-only handler. With flags off, previous safety refusals and voice behavior remain unchanged.

A hard screen-only policy refuses delete, reset demo, HOLD/engineer overrides, clear chat history, grade/price/training edits, lot/additive receipt, DRI lab entry, manual release/reject, invoice issue, tap approval and strategy acceptance. Registering future actions does not authorize any HOLD bypass: their actual domain endpoints still need authenticated roles and current gate checks. Current AuthContext Guest and an opaque voice session are not authenticated plant users. Nothing here replaces backend plant authorization.

## Local flags

Agent `.env` (all defaults are false):

```dotenv
VOICE_ACTIONS_ENABLED=true
VOICE_AUDIT_ENABLED=true
VOICE_AUDIO_LOG_ENABLED=false
VOICE_AUDIO_RETENTION_DAYS=7
VOICE_USERS=[]
VOICE_LOG_ADMIN_KEY=
```

Actions require audit enabled; otherwise read-back returns unavailable and no demo execution occurs. To review local audio retention separately, set VOICE_AUDIO_LOG_ENABLED=true explicitly. Audio logs contain speech and should stay on the local review machine. Set VOICE_LOG_ADMIN_KEY to a locally generated secret if using admin deletion; it is never included in the browser bundle or this document. DATA_DIR defaults to Agent/app/data; an environment override is supported by the new foundation stores.

Frontend `.env.local`:

```dotenv
VITE_VOICE_ACTIONS=true
VITE_VOICE_AUDIT=true
VITE_VOICE_AUDIO_LOG=false
```

Leave all three false to restore the previous interface. Mock mode exposes only these named new public flags alongside the existing allowlist; no credential is exposed. Restart Agent (`.\.venv\Scripts\python.exe .\app\main.py`) and Vite (`npm run dev:mock -- --configLoader runner`, or normal `npm run dev -- --configLoader runner`) after editing settings. Existing wake/STT flags are not changed by this setup.

## Create two synthetic users

Run these **from the Agent directory**, choosing different private six-digit codes at the hidden prompts. Neither code is displayed or written by the tool.

```powershell
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-operator --name "Demo Operator" --role Operator
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-supervisor --name "Demo Supervisor" --role Supervisor
```

Each prints one JSON user entry containing a random 16-byte salt, PBKDF2-SHA256 hash and 300000 iterations, never the code. Paste the two JSON entries into one `VOICE_USERS=[<first JSON>,<second JSON>]` line in the ignored Agent `.env`. Do not put real names or codes in examples/tests/Git. The other supported roles are Manager and Unit Controller. No real user was created during this task. Synthetic test hashes/codes are generated at runtime.

## Protocol and local stores

- `POST /copilot/voice/session` creates an opaque random session; the browser stores it in sessionStorage and sends `X-Voice-Session`. Reload can resume a still-valid session. Sessions expire after one day; sessions/read-backs/tokens are in memory and expire safely on restart. Use one Agent worker.
- `POST /copilot/voice/readback {action_id,summary,page}` requires the same session, a server-registered action and enabled audit. Client-supplied roles cannot lower server policy. No high-risk action is registered in production.
- `POST /copilot/voice/authorize {action_id,required_roles,spoken_code_text}` requires the matching read-back within 15 seconds. All configured user hashes are derived and constant-time compared; six dictated Tamil/Hindi/English digits (including native digit characters and leading zeroes) use aliases mirrored from the existing spokenNumbers grammar. Success returns only public synthetic identity and an opaque token, never the code. Tokens are SHA-256-indexed server-side, session/action-bound, one use, 60 seconds.
- Three failed credential comparisons within ten minutes impose a global ten-minute approval lock. Only failure timestamps/lock expiry persist under DATA_DIR/voice_auth; no code or transcript is kept. A restart does not unlock a persisted lock. Malformed persisted lock state fails closed. Successful credentials are not plant execution.
- `POST /copilot/voice/token/consume` validates the same session/action once. `/cancel` invalidates its read-back and unconsumed tokens. The client waits five visible seconds with Cancel before consumption/execution. Cancellation or failure never claims a completed result.
- `POST/GET /copilot/voice/audit` and `GET /audit/verify?date=YYYY-MM-DD` are independently audit-flagged. Rows are daily append-only JSONL under voice_audit, with UTC timestamps, sequences, previous hash and SHA-256 of canonical JSON. GET is scoped to the opaque session, not a plant identity. Client-reported backend results are explicitly labelled client-reported; they are not independent evidence a plant operation occurred. Server-derived verified identity overrides any client identity claim.
- A chain detects edited/missing/interior-reordered records, not a privileged attacker rewriting the entire chain or truncating its tail without an externally retained head. The verify response includes count/head for independent anchoring; no external immutable service is introduced. Damaged chains refuse append.
- Optional audio evidence uses DATA_DIR/voice_audio/YYYY-MM-DD/<event_id>.wav plus hash/duration/session metadata; audit rows link the event ID. Existing wake and command uploads are copied locally only when opted in, not synthesized or uploaded to another service. Normal non-WAV uploads use existing local validation/conversion; absent conversion tooling produces an honest logging warning without breaking ordinary voice. Complete mono PCM16/16kHz WAVs only, no overwrites. GET list/play/export are session-scoped; DELETE by date requires X-Voice-Admin matching the backend-only admin key. Seven-day default retention runs at startup and daily. Audit records are not purged with audio.
- Passcode capture uses the existing mic implementation after releasing/suspending the prior owner. It marks no_store and never enters heard text, transcript/Latin display, TTS, route logs or audit. Server enforcement also blocks audio for the session's private approval window even if mislabelled. Passcode WAV transcription is in memory (no temporary file), returns no provider error body, and clears shared provider error details. Its plaintext is used transiently for authorization only. Passcode audit transcripts are always bullets. Other stored transcripts mask numeric tokens and spoken number words.
- The menu shows Logging on only after backend flags confirm logging, and provides today's session events, audio playback and chain verification. Viewer failures are shown unavailable. No admin secret is requested/stored in that UI.
- Wake provider timeout is 5 seconds; shared provider lease, pause-v3 rules, 1.5-second snippet and rate/spacing limits are unchanged. Browser wake HTTP budget is 8 seconds to accommodate that bounded provider check and existing spacing.

## Review and limitations

Enable actions+audit on both ends, restart, enable the existing microphone control, then say `Kural, test action` or use Hold to talk. Listen to the no-effect summary and say yes/no in the bounded confirmation window. Confirm only the synthetic result and audit row appear. High-risk flow/Cancel is exercised in automated tests with an injected test action; it is deliberately unavailable for plant use.

No physical mic/passcode accuracy, audible read-back, multi-user deployment, production identity or real plant execution is claimed. Passcodes spoken aloud are observable; these local demo credentials are not a replacement for authenticated server-side plant access. All stores are ignored by Git. Approved tour assets are untouched.

Standard-library mechanism references: https://docs.python.org/3/library/hashlib.html#hashlib.pbkdf2_hmac and https://docs.python.org/3/library/secrets.html#secrets.compare_digest.

## Separate menu/card bug fix

Independent UI files: `src/components/voice/kuralMenuInteraction.js`, `KuralMenuLayout.css`, `tests/kural-menu-interaction.test.jsx`. Small integration hunks in `KuralControlsMenu.jsx` import/use the PTT event guard; `KuralWakePanel.jsx` imports the menu stylesheet, closes the menu on interaction, collapses the card on menu opening, uses preventScroll focus, and handles document Escape after the PTT button unmounts. Those files also contain clearly separate foundation imports/rendering hunks and must not be committed wholesale if separating the fixes.

PTT closes controls before handing capture to the existing owner, preserves pointer-up/cancel after button unmount, prevents pointer/touch scrolling and suppresses unmount-only lost-capture stops. Menu/card cannot stack. At normal heights the menu fits content; only short viewports may scroll within viewport-minus-120px. The Chromium test asserts the menu is closed while holding, no page scroll change, release-to-STT, and no internal overflow at 360x800. Reopening controls collapses the card without disabling hands-free or cancelling playback unnecessarily.


## Actual final verification

- Full frontend: **1364 passed, 32 files, 135.16s**, including dev-module smoke and Chromium mocked boundaries.
- Full Agent: **402 passed, 12 existing warnings, 45.57s**, GNANI_MOCK=true, unmocked HTTP prohibited.
- Production build: **passed, exit 0, 11.81s**; chunk-size warning only.
- **919 protected files unchanged**, including prior audio, model/recording/journal evidence. All **22 source + 22 built approved tour WAVs** match approved SHA-256 values.
- Staged and unstaged diff checks pass; the environment still reports its existing inaccessible global Git ignore warning. Existing staging and the unrelated untracked .claude directory were preserved.
- No dependencies installed, live provider calls, real users/codes, physical microphone/passcode listening test, plant action, deployment, staging, commit or push. The enabled RUN flow and APPROVE Cancel are mocked development checks, not identity/security certification for plant operations. All previous failed focused-run logs remain in ignored evidence directories.

Audit verification now reports the exact sequence for malformed JSON too. Transcript masking preserves audio event links and backend IDs in metadata while redacting numeric/spoken-number transcript tokens. Private validation errors never echo their request body. Flag-off routing is checked before request validation, so incomplete uploads still return 404.

## Changed-file inventory

- `.gitignore`
- `MetalliSense_Agent_R/MetalliSense_Agent/.env.example`
- `MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F16_VOICE_FOUNDATION.md`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_audio_log.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_audit.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_auth.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_foundation.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_numbers.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_policy.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/wake_check.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/main.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_voice_foundation.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_wake_check.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tools/voice_passcode_hash.py`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/.env.example`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralControlsMenu.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralMenuLayout.css`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralWakePanel.css`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralWakePanel.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/PushToTalk.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/VoiceActionPanel.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/kuralMenuInteraction.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/copilotService.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceActionApi.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceActionCapture.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceActions.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceTranscript.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/kural-menu-interaction.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/kural-wake-panel.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/voice-actions.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/vite.config.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/vitest.config.js`

## v21 live confirmation and anchored action-card repair (2026-11-03)

The preserved live audit records `test-action`, `cancelled`, `Not confirmed` at 16:02:52.066211 UTC (21:32:52 IST). No confirmation-audio event precedes it. The old RUN branch treated empty text, timeout, unrecognized text and explicit no as the same cancellation; the log cannot establish which occurred or the microphone-ready time. A confirmed capture defect started the eight-second timer before awaiting microphone setup, allowing startup to consume the confirmation window. It also did not publish actual confirmation-listening readiness to the card. These defects are consistent with the report, but the old evidence cannot prove the exact one-second live sequence.

Confirmation now waits for read-back playback completion, publishes microphone-starting separately, and starts the full eight-second window only after the existing capture implementation is ready. Listening displays `Listening... say yes or no` with the existing RMS waveform. One utterance is transcribed; yes/ok and the existing Tamil/Hindi aliases complete the no-effect test action. Explicit no and no-speech timeout have distinct cancellation reasons; unrecognized text or capture/transcription failures produce an honest failure without execution. Startup has a separate ten-second failure guard. Console metadata `voice_action_capture` reports `mic_start`, `listening_ready` (window_ms 8000), and `capture_end` with reason/sample count, never transcript/audio/credentials.

The card and orb use one fixed collision footprint across action phases instead of moving according to rendered card height/answer changes. Read-back, confirmation, passcode, countdown and terminal result share the same right edge and twelve-pixel gap; external bottom-right page actions are avoided. Removed the one-pixel orb-stage offset. One outer status block renders action state; the action details no longer duplicate its level/prompt/result. The red Cancel button exists only during the approval countdown. Close/Escape retain existing cancellation and cleanup.

Focused checks: 35 passed in 57.03s, including actual capture-ready timing, deferred read-back completion before listening, yes-to-Completed, timeout without STT, unknown reply failure, stable action-phase geometry, Receive truck/Read decision avoidance and terminal controls. Browser checks are mocked, not a new real-microphone or provider test.

Source protection: 919 previously snapshotted files unchanged, including all 22 approved production WAVs. Fifteen current live audit/audio evidence files were separately hashed without modification. Evidence: `tools/local_wake_data/f16-v21-confirmation-e02f9e9f7f2147fb919098856f866821/verification.json`. Full verification results follow after completion. No backend behavior, wake rules, thresholds, flags or tour audio changed. No live calls, staging, commit or push.

Final verification: **1,368 frontend tests passed, 33 files, 310.74s**, including the Chromium mock/normal dev-module smoke. Initial full attempt had 1,367 passes and one `page.goto` 30-second load timeout; its evidence is retained. The isolated smoke then passed in 22.97s and the final entire suite passed without code/test relaxation. **402 mocked Agent tests passed, 12 existing warnings, 84.57s**. Production build **passed in 24.47s**, with the existing large-chunk warning. All 22 built WAVs match their approved hashes; final verification again found zero changes among 919 protected source files or 15 live evidence files. Both git diff checks passed (existing line-ending/ignore-access warnings only).

Restart the frontend using the existing command and unchanged enabled local flags (`npm run dev:mock -- --configLoader runner` for mock mode, or the normal dev command for the real Agent). The backend needs no code restart for this frontend-only repair. Retry test action: wait for read-back to finish, then the Listening prompt/waveform; say yes once. Expected no-effect result: Completed. A silent eight-second ready window cancels with `confirmation_timeout`; no cancels with `confirmation_no`. Check the new console stages to distinguish microphone startup from the actual listening window. Physical-microphone/provider confirmation was not performed here. Nothing was staged, committed or pushed; the pre-existing untracked `.claude/` folder was preserved.

## No-reply timeout and readable voice log (2026-11-03)

User live confirmation: T1 yes → Completed and T2 no → Cancelled passed. These outcomes remain unchanged. A ready confirmation window with no speech, empty STT, punctuation-only output or explicit non-speech markers now displays **No reply — action not done.**, publishes a terminal timeout phase, and appends audit decision `timeout` / reason `confirmation_timeout`. The Agent audit endpoint accepts this additional nonexecution decision. Unfamiliar real words remain `failed` / `confirmation_unrecognized`; explicit no remains `cancelled`. No outcome above invokes action execution.

The log viewer is separated into `VoiceLogViewer.jsx/.css` and a pure `voiceLogView.js` presentation model. It shows newest interactions first, India-local HH:MM:SS times, page when recorded, intent/summary, decision, masked transcript snippet and exact event-linked inline wake/command playback buttons. Passcodes never get playback controls. Raw `audio-capture / executed` records are no longer shown as separate executed actions; capture-only turns explicitly say Audio only. Historical files do not contain verified turn IDs, and some capture rows lack page/transcript. The viewer labels legacy grouping as session/order based (within 45 seconds, a new wake starts a new group, completed actions close a group); it does not fabricate those missing fields or rewrite audit evidence. Audio without a timestamped audit link is not assigned an invented interaction/time.

The date picker defaults to today in Asia/Calcutta. It loads both UTC daily files intersecting that local date and filters displayed events to the local day. Verify chain shows **Chain OK · N events** or **Broken at #seq** inline; it verifies the complete intersecting UTC chains (the displayed count is the full chains' event count, not grouped-row count). Changing dates invalidates stale loads, verification and pending playback; object URLs are released on replacement/unmount. Audio logging may be disabled independently without hiding audit outcomes.

Initial focused run: 35 tests passed in 81.49s, including Chromium narrow-layout/date/chain/inline-playback checks. The final full suite also covers the subsequently added explicit noise/silence-marker cases. No microphone, provider, inference, training or tour integration changes. No live calls. Full verification results follow after completion.

Files in this follow-up: `src/services/voiceActions.js`, `voiceActionApi.js`, new `voiceLogView.js`; `src/components/voice/VoiceActionPanel.jsx`, `KuralWakePanel.jsx`, new `VoiceLogViewer.jsx/.css`; `tests/voice-actions.test.jsx`, new `voice-log-viewer.test.jsx` and `tests/fixtures/voice-log.html/.jsx`; `vitest.config.js`; Agent `app/copilot/voice_foundation.py`, `tests/test_voice_foundation.py`, and this document. Earlier uncommitted capture/card repairs remain preserved.

Verification evidence: `tools/local_wake_data/f16-timeout-log-review-276feaaaa7664cbd8ed0d2193ff29ad9/`. Backend: **403 passed, 12 existing warnings, 206.89s** under `GNANI_MOCK=true`. Initial full frontend run: 1,378 passed and one aggregate 120-second timeout in the existing built orb Chromium review. The unchanged browser test and final bounded-width log viewer then passed together: **14 passed in 63.48s**. No timeout/assertion was weakened. Original timeout evidence remains in frontend `node_modules/.cache/f16-timeout-full.log`; final full-run/build results follow.

Restart both the Agent (`python app/main.py` in the existing backend environment) and the frontend using the existing command/flags before the live retry: the Agent audit enum must accept `timeout`. Test silence, empty/noise STT, yes and no; inspect the Voice log date, timeout badge and inline chain result. No physical-microphone/provider retry was performed here.

Final verification for this follow-up: initial full frontend run **1,378 passed / 1 aggregate browser timeout (252.30s)**; final full attempt **1,376 passed / 3 timeouts (390.24s)** in voice-everywhere (90s), dev-module normal-dev page load (30s), and mock gate parity (30s). Those three files then passed unchanged together: **285/285 in 61.61s**. The earlier orb/log browser retry passed **14/14 in 63.48s**. All new timeout/log-viewer checks passed in the full runs, including noise-marker cases. There was no completely green single full-suite attempt in this follow-up; limits/assertions were not increased or bypassed. All failure logs and rerun results are retained in frontend `node_modules/.cache/f16-timeout-*.log`.

Production build **passed in 9.13s** with the existing large-chunk warning. Final protection verification: **919 files unchanged**, including all 22 source tour WAVs; all **22 built WAVs** match approved SHA-256 values. Both staged and unstaged diff checks pass (existing line-ending/ignore-access warnings only). Backend remains **403 passed, 12 existing warnings**. No physical-microphone or live provider check was made. Existing uncommitted work and `.claude/` were preserved; nothing staged, committed or pushed.
