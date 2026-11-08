# Voice master fix report

Branch: `f17-voice-actions`. No commit or Git write command. Environment files, live audio/audit stores and `.claude/` were not edited. The existing package.json change was retained. H-1053 remains HOLD.

## Findings and changes by part

| Part | Cause / change | Regression coverage |
|---|---|---|
| 1. Voice-first confirmation | Reply frames could be discarded before asynchronous capture setup resolved; short speech split by unvoiced gaps could be discarded before reaching the speech gate. Capture now accepts early frames and preserves short internal gaps. The localized yes/no question is spoken and displayed; listening, level animation, countdown and small tap fallback are visible. | Mocked quiet, segmented spoken yes executes without a click; exactly one transcription; ordered timing stages; aliases in all three languages; tap yes/no; mic failure; silence. |
| 2. Timing | A resolved mic setup promise did not prove audio frames were arriving. Readback and prompt promises now finish before the 300 ms gap, then the response deadline starts on the first frame. Approval uses the same readiness helper. Absolute deadlines prevent countdown drift. Result and refusal cards wait for playback before starting collapse. | Deferred TTS/mic/frame tests, private capture readiness, delayed countdown callbacks, result/refusal playback state, cancellation and four-second speech limit. |
| 3. Heat status | Normalizing an apostrophe in “what's” created a standalone S token. Single-letter symbols now match original-text token boundaries. Explicit heat status takes precedence and reads gate/reason from the loaded snapshot. | English/Tamil/Hindi status phrases; H-1053 HOLD with reason; no backend heat fetch; unavailable target; positive S/S% and negative substring/apostrophe tests. |
| 4. Language purity | The saved UI language could select Tamil template words for an English question. Loaded-answer replies now choose the question language consistently. | All ASK templates in three languages plus English element/range answer with Tamil UI preference. |
| 5. Logging | ASK turns lacked an action-style audit record, audio captures lacked route metadata, and the viewer had no test-log export. Added masked ASK/action metadata, spoken reply, page metadata through capture/Agent storage, and markdown export. | One ASK audit per reply, flag-off behavior, private/credential redaction, table escaping and blank Result column, real browser download, Agent audio-page and private-event tests. |
| 6. OPC | The screen connection services had no voice registry/policy entries. Connect/disconnect now use the same spectrometer services, APPROVE authorization and Supervisor/Unit Controller roles, with target readback and native phrases. | Native/English phrases, page scope, exact service call, refusal/cancellation, frontend/server policy parity and Agent role cases. |
| 7. Page sweep | The sweep exposed loaded stock reads falling into the old backend lookup, and exact invoice questions hitting the legacy mutation blocker. Loaded stock questions now use the snapshot; narrowly anchored invoice reads are allowed while appended commands remain refused. | Every registered page, all ASK intents in en/ta/hi, registered actions, role/passcode/backend refusal, cancel countdown, RUN no, missing heat, disconnected OPC and H-1053 HOLD; real application route rendering. |

All new behavior uses the existing voice action/page-answer/audit/timing flags. Wake detection and plant HOLD policy were not changed. Approval roles, authorization and cancellation duration were not weakened.

## Reply gate and timing values

| Item | Before | After |
|---|---|---|
| RMS speech threshold | 0.01 | 0.01 (already matched the wake gate) |
| RUN minimum speech | Any qualifying captured frame in the original shared helper | At least 100 ms; internal quiet gaps retained until 700 ms silence |
| RUN trailing silence | 800 ms | 700 ms |
| RUN speech maximum | Shared response deadline | 4 s from captured utterance start |
| RUN no-speech window | 8 s after capture setup promise | 8 s after first audio frame, following TTS completion and 300 ms gap |
| Approval capture | Existing 12 s / 800 ms trailing silence | Same limits, with TTS/gap/frame readiness |
| Approval Cancel countdown | Five one-second waits | Same 5 s, absolute deadline and matching displayed seconds |
| Auto-collapse | 3 s could run during terminal speech | Same 3 s, starts after terminal playback |

With `VITE_VOICE_TIMING`, the no-click regression observes `mic_requested`, `mic_open`, `reply_listen_start`, `first_speech_ms`, `peak_rms`, `sent`. Silence produces `no_speech`; capture failure records only its kind/readiness. No transcript, audio content or passcode is logged by these diagnostics. This proves the repaired mocked path, not the exact hardware cause of the earlier live incident.

## Changed implementation files

Frontend paths below are relative to `MetalliSense_Frontend_R/MetalliSense_Frontend/`:

- `src/services/runReplyCapture.js`, `voiceActionCapture.js`, `voiceActions.js`, `voiceActionLanguages.js`, `voiceActionRegistry.js`
- `src/services/voiceIntents.js`, `loadedHeatStatus.js`, `voiceTranscript.js`, `voiceAskAnswers.js`
- `src/services/voiceAuditText.js`, `voiceTestLog.js`, `voiceLogView.js`, `copilotService.js`
- `src/components/voice/VoiceActionPanel.jsx`, `KuralWakePanel.jsx`, `KuralWakePanel.css`, `PushToTalk.jsx`, `VoiceLogViewer.jsx`
- `src/hooks/useWakeWord.js` (capture page metadata only)
- `vitest.config.js`

Agent paths below are relative to `MetalliSense_Agent_R/MetalliSense_Agent/`:

- `app/main.py`
- `app/copilot/voice_foundation.py`, `voice_audio_log.py`, `voice_audit.py`, `voice_policy.py`

## Tests and artifacts

Added frontend tests: `tests/run-confirmation.test.jsx`, `tests/master-voice.test.js`, `tests/page-sweep.test.jsx`, `tests/page-sweep.config.js`, and `tests/fixtures/page-sweep.html`, `page-sweep.jsx`, `sweep-action-fixtures.js`.

Updated frontend tests: `tests/f17-actions.test.js`, `kural-wake-panel.test.jsx`, `voice-action-capture.test.js`, `voice-actions.test.jsx`, `voice-log-viewer.test.jsx`. Updated Agent tests: `tests/test_voice_foundation.py`.

`PAGE_SWEEP_REPORT.md` contains case-level results; `LIVE_TEST_LOG.md` contains auto-PASS/auto-FAIL rows ready for human testing. The previous human log is preserved as `LIVE_TEST_LOG_BEFORE_SWEEP.md`. The sweep uses Chromium, synthetic loaded snapshots, mocked services and microphone frames. It renders each real route separately; it does not exercise a physical mic, real provider, real passcodes or plant writes.

## Validation checkpoints

| Checkpoint | Frontend tests | Build | Agent pytest |
|---|---|---|---|
| Part 1 | 2,406 passed | Passed | 453 passed, 6 baseline failures, 1 skipped |
| Part 2 | 2,409 passed | Passed | 453 passed, 6 baseline failures, 1 skipped |
| Part 3 initial | 2,507 passed, 1 failure; fixed in Part 4 | Passed | 453 passed, 6 baseline failures, 1 skipped |
| Part 4 | 2,508 passed | Passed | 453 passed, 6 baseline failures, 1 skipped |
| Part 5 initial | 2,504 passed, 6 failures; fixed before Part 6 | Passed | 454 passed, 7 failures; redaction regression subsequently fixed |
| Part 6 | 2,529 passed | Passed | 462 passed, 7 failures; registry parity count subsequently updated for the two new OPC actions |
| Final / Part 7 | 2,566 passed across 45 files; 597/597 browser sweep cases | Passed (11.98 s) | 463 passed, 6 baseline failures, 1 skipped; 7 subtests passed |

Parts 1 and 2 passed 2,406 and 2,409 frontend tests respectively, with successful builds. Part 3's initial validation caught a language regression, repaired and revalidated with Part 4: 2,508 passed and build successful. Part 5's initial validation caught wrapper argument and event-ID redaction regressions; these were repaired before Part 6: 2,529 frontend tests passed and build successful. Agent checks were run at each checkpoint; final validation supersedes intermediate failures. Logs are retained as `master-part*-tests.log`, `master-part*-build.log`, and `master-part*-pytest.log` in their respective projects.

Final frontend run: 2,566 tests passed in 200.73 s. Production build succeeded in 11.98 s; only the bundle-size warning remains. Final Agent run: 463 passed, 6 failed, 1 skipped, 7 subtests passed in 42.97 s. The six failures are detailed below.

Final results are recorded in `master-final-tests.log`, `master-final-build.log` (frontend) and `master-final-pytest.log` (Agent).

## Remaining external verification / baseline failures

The Agent suite has six existing failures unrelated to these edits:

- `test_f14_mechanical_revision`: missing `f14_tamil_hi_audition/run-01/manifest.json`.
- `test_f14_tamil_audition`: missing stock audition recovery manifest.
- Three `test_kural_paired_v2_experiment` tests: missing saved negative-context experiment configuration.
- `test_kural_training` setup-prefix assertion: the installed Python is 3.12; the pinned setup expects Python 3.11 x64 and rejects it before the expected prefix check.

These artifacts were not fabricated, and tests/timeouts were not relaxed. A human live check of browser microphone permissions, actual spoken confirmations and provider playback remains necessary. No production connection or action was performed.
