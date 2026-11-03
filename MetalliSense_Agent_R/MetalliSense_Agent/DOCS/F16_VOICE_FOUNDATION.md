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
