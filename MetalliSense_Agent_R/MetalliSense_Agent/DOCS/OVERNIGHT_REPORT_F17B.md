# F17B local implementation report

2026-11-04. Builder: Manish. Branch f17-voice-actions. No staging, commit, push, provider/device calls, dependency installation, audio generation or environment changes. Existing unrelated .claude/settings.local.json is preserved and excluded from this work.

## Results by part

| Part | Full Vitest | Full Agent pytest (GNANI_MOCK=true) | Production build |
|---|---|---|---|
| 1: native phrases/read-backs | 1798 passed / 38 files / 163.77s | 410 passed / 12 warnings / 46.73s | Passed / 12.09s |
| D: stock/tap repairs + actions | 1801 passed / 39 files / 149.45s | 410 passed / 12 warnings / 58.77s | Passed / 18.83s |
| E: forms + protected confirmations | 1909 passed / 40 files / 195.22s | 440 passed / 12 warnings / 71.65s | Passed / 14.27s |

Final quantity/read-back regressions and final snapshot verification are recorded below. The full frontend selection includes ptt-recording, voice/tour/safety, dev-module smoke and Chromium mocked rendering. No part was reverted: encountered encoding, syntax and slot-case defects were repaired and their failed logs preserved. Build warnings concern existing large chunks. Pytest warnings concern existing FastAPI on_event deprecation.

### Part 1

Shared Tamil, Tanglish and Hindi aliases feed the existing registered action adapters. The selected language controls spoken read-back; English display summaries retain IDs/numbers. Existing yes/no behavior is retained. The native phrase tests initially added 106 assertions/cases; final quantity/read-back cases supplement them. No alternate microphone/controller or STT API was introduced. These are text/mocked checks, not a pronunciation guarantee.

### Part D

Root cause: the RL button used the gate suggestion's additive lines instead of the selected candidate and could mark accepted/deducted despite a caught deduction failure; the legacy mock acceptance path was separate. A shared atomic transaction now prevalidates all accepted-candidate stock quantities, aggregates same-lot demand, rejects insufficient stock and rolls back failed operations. Both regular and mock routes use it. The UI requires verified deduction lines; old unverified persisted deduction claims become pending. Policy feedback follows the stock transaction; failure reports its own warning. An identical manual retry cannot rededuct stock, although it can repeat feedback.

Tap root cause: the regular sales route accepted resume:true to promote PLANNED and deduct charge during completion. That branch is removed. Completion requires MELTING; the page and voice adapter no longer send resume:true. Supervisor/Manager voice acceptance and tap completion reuse the button service and verified identity.

Added three mocked transaction/action tests cover candidate-specific quantities, regular/mock parity, atomic failure, idempotency, no PLANNED resume completion, exact service reuse and identity.

### Part E

Added 23 unique form/destructive action IDs across 24 page registrations. Required fields are collected one at a time; optional loaded draft fields are retained. Skip cannot fabricate mandatory values; cancel stops the workflow. Read-back shows all submitted fields. No write occurs during collection. Shared field validation covers quantities, loaded targets, composition ranges, charge lines, DRI warnings, manual reasons and AHP CR. Direct weights explicitly have no AHP CR. The same service exports as page buttons perform writes and page refreshes occur only on successful results.

HOLD override is separate from normal start: Unit Controller only; reason at least the configured minimum or 20; fresh unchanged PLANNED HOLD gate; explicit warning, passcode, OVERRIDE, five-second Cancel. Deletes require DELETE; reset RESET; clear chat CLEAR. Agent tokens cannot be consumed for these actions until the exact word is confirmed for that session/action/token. Wrong words invalidate the token. Passcode and protected-word captures use no_store; audit stores only masked transcript and word-verification metadata.

The first form suite added 108 tests, plus the final decimal test. Agent added 30 role/confirmation-word tests. Fixtures cover form cancellation/no writes, every native alias, server roles, DRI warning changes, Unit Controller guard, protected-word order, no execution on missing/wrong word and masked state/audit. Existing UI now displays real private capture readiness and keeps long read-back summaries keyboard-scrollable in the anchored card.

## Screenshots

- screenshots/f17b/form.png: one missing-field conversation state.
- screenshots/f17b/hold-override.png: read-back, OVERRIDE capture and Cancel countdown.
- screenshots/f17b/delete.png: DELETE capture and Cancel countdown.

These are labelled MOCKED, cropped from 1280px Chromium frames of the production card. They show synthetic controller states with no physical mic, passcode, provider or plant execution. Original frames/review.json are retained. Result frames outside these sheets are generic mocked examples, not evidence that a HOLD override/delete actually ran.

## Limits and next manual checks

No live microphone, pronunciation, hardware, backend stock, role/passcode or destructive-action validation was performed. Use a disposable local mock dataset for field correction, cancel, unusual DRI, role denial, stale gate and DELETE/RESET/CLEAR checks. Verify native read-back listening before plant use. The existing backend lacks full authenticated plant roles; voice passcodes and client-reported audit do not replace backend authorization. No new authentication claims are made.

Default flags remain off: VITE_VOICE_ACTIONS, VOICE_ACTIONS_ENABLED and the existing frontend/backend audit flags. Existing local enabled settings were not edited. Restart the Agent and frontend after reviewing local configuration. CSV remains screen-only. Unregistered/off-page/compound mutations refuse. No wake rules, hands-free routing, model, tour order, safety refusals or approved audio changed.

## Files by part

F = MetalliSense_Frontend_R/MetalliSense_Frontend; A = MetalliSense_Agent_R/MetalliSense_Agent; B = MetalliSense_Backend_Simple.

**Part 1:** F/src/services/voiceActionLanguages.js; F/src/components/voice/PushToTalk.jsx; F/tests/f17-native.test.js. Shared registry and flow changes also support D/E.

**Part D:** B/premeltGate/{strategyAcceptance.js,routes.js,sales.js,store.js}; F/src/mock/handlers/premeltGate/{strategyAcceptance.js,routes.js}; F/src/mock/server.js; F/src/services/{premeltService.js,voiceDecisionActions.js}; F/src/context/MeltFlowContext.jsx; F/src/pages/{RLOptimizer.jsx,FullAnalysis.jsx,MechanicalProperties.jsx}; F/tests/f17b-decisions.test.js.

**Part E:** F/src/services/{voiceFormActions.js,voiceFormContent.js,supplierWeights.js,voiceActionApi.js,copilotService.js}; F/src/components/common/AIChatInterface.jsx; F/src/components/voice/{VoiceActionPanel.jsx,KuralWakePanel.jsx,KuralWakePanel.css}; F/src/pages/{RawMaterialStock.jsx,PreMeltGate.jsx,SalesInvoices.jsx,GradeSpecs.jsx,CostAnalysis.jsx,TrainingData.jsx,SupplierScorecard.jsx}; A/app/copilot/{voice_auth.py,voice_policy.py,voice_foundation.py,voice_audit.py}; A/tests/test_voice_foundation.py; F/tests/f17b-forms.test.js.

**Shared/mixed:** F/src/services/{voiceActions.js,voiceActionRegistry.js,voiceTranscript.js,voiceActionLanguages.js}; F/vitest.config.js; F/tests/f17-review.test.jsx; A/DOCS/F17_VOICE_ACTIONS.md; this report; A/DOCS/screenshots/f17b/*.png and frames/*.png/review.json. These shared files contain native aliases, scope dispatch, approval lifecycle, roles and rendering dependencies; they are not independently staged. All work remains unstaged/untracked as applicable.

## Verification evidence

Ignored local logs: F/node_modules/.cache/f17b-part1-*, f17b-d-*, f17b-e-*, f17b-final-*; A/tools/local_wake_data/f17b-*-pytest.log. Failed diagnostics remain alongside successful logs. A/tools/local_wake_data/f17b-verification.json records all 22 source and 22 built WAV hashes against src/assets/approvedTourTamil.json.


## Final snapshot verification

Final read-back audit found and fixed two concrete defects: sentence cleanup discarded decimal points in command quantities, and native read-back dropped target IDs placed before a colon. Regression cases now preserve 100.5 kg end-to-end and actual strategy/tap/search heading facts. No quantity, identity, target or spoken payload is inferred from punctuation.

Final sequential verification after those fixes: **Vitest 1913 passed, 40 files, 160.46s; GNANI_MOCK=true pytest 440 passed, 12 existing warnings, 52.87s; production build passed in 12.24s**. Final focused new tests: 221 passed in 2.86s. There are 221 new frontend cases and 30 new Agent cases relative to the initial snapshot. The earlier 1911-test run and intermediate failed logs remain preserved; no failed check was bypassed.

All **22 source WAVs and 22 built WAVs** match approved SHA-256 values after the final build. Both staged and unstaged diff checks pass; Git only reports the existing ignore-access/line-ending warnings. Index remains empty; nothing staged or committed. No models, recordings, environments, caches, secrets or local settings are added to the proposed file inventory. Existing .claude/settings.local.json remains unrelated/untracked.

Manual work remaining: native read-back listening, real microphone/passcode flow, and backend/plant behavior on disposable local data. Mocked UI states and mocked HTTP success do not establish plant authorization or hardware success. No live calls were made. Nothing pushed.
