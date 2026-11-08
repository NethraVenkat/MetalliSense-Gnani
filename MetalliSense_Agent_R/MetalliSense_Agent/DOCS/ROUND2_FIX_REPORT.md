# Live fix round 2 — implementation record

Branch: f17-voice-actions. No commit or Git write commands. Environment files and live audio/audit stores are not edited. Approval roles and H-1053 HOLD policy remain unchanged.

## Part 1 — diagnostics

Added deterministic phrase-match diagnostics (not probability estimates): Heard, normalized text, up to three candidates, winner, target, level and reason code. Added viewer fields and markdown export columns. Private transcript fields are stored as `[passcode masked]`. Added audit-gated development endpoints `/copilot/voice/debug/state` and `/copilot/voice/debug/reset-lock`; they require a loopback peer, reject nonlocal Origin, ignore forwarded-IP claims and expose no credentials. Reset additionally requires a voice session. The development viewer exposes the reset control only after the endpoint succeeds.

Validation: frontend 2,571 passed; build passed in 7.50 s; Agent 465 passed, six baseline failures, one skipped (seven subtests passed). Logs: `round2-part1-tests.log`, `round2-part1-build.log`, `round2-part1-pytest.log` in the respective projects.

## Part 2 — private capture and retry

Root causes: the global lock is deliberately persisted under `voice_auth/lock.json`; malformed/partial speech previously consumed wrong-code attempts; a valid credential for a different role was indistinguishable from a wrong credential; the original readback expired after 15 seconds including prompt/capture/provider latency. Also, the browser sent language as multipart form data but the Agent treated it as a query parameter.

Malformed/partial speech and wrong-role credentials now consume no wrong-code attempts. Three actual wrong codes retain the existing ten-minute persisted lock. The frontend re-prompts once for malformed input and retries real wrong-code responses only while attempts remain. Private replies use mixed locale hints and per-request codemix format. Normalization supports English/Tamil/Hindi digit words, native digits, spaces, double and triple. The same reviewed action is renewed after capture before authorization; the server's 15-second expiry and 12-second capture window are unchanged. The lock survives restart intentionally; the local debug reset is the explicit test recovery path.

Validation: frontend 2,573 passed; build passed in 7.06 s. Targeted frontend: 62 passed. Full Agent: 470 passed, six baseline failures, one skipped (seven subtests passed).

## Known baseline Agent failures

- `test_f14_mechanical_revision.py::RevisionTests::test_only_mechanical_text_and_fingerprint_change`: missing saved audition manifest.
- `test_f14_tamil_audition.py::BatchTests::test_actual_stock_provenance`: missing saved recovery manifest.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_dev_matching_has_no_grace_and_thresholds_fixed`: missing saved experiment configuration.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_evaluation_sessions_excluded_from_fitting_groups`: same missing configuration.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_original_sampler_parity_and_added_record_rotation`: same missing configuration.
- `test_kural_training.py::PipelineTests::test_isolated_setup_wrong_prefix_never_installs_and_failed_pip_no_retry`: Python 3.12 reaches the pinned Python 3.11 check before the expected prefix check.

No baseline artifacts are fabricated and no tests/timeouts are relaxed.

## Part 3 ? action priority and target normalization

Registered action matching now precedes navigation and the legacy guard. Filler `the`, joined/spelled PR prefixes, Tamil/Hindi ID forms and selected-PR variants normalize through a shared matcher. Same-page navigation is a no-op with a localized acknowledgment; off-page action requests identify the required page/target instead of accidentally navigating.

Validation: 2,584 frontend tests passed; build passed in 12.87 s. Agent: 470 passed, six baseline failures, one skipped. The initial run caught the old same-page navigation expectation and a real reply-language bug; both were corrected without removing cross-page navigation coverage.

## Part 4 ? safe action levels

The 12 explicitly safe action IDs are ASK with a two-second voice/tap cancellation window after TTS and mic readiness. Record-changing device connections and simulated meter writes retain RUN yes/no. APPROVE roles and countdown remain unchanged. `ACTION_LEVELS.md` enumerates 51 action/page registrations. Targeted action/cancel tests passed; the updated browser sweep passed all 22 page-level tests; Agent voice-foundation tests passed 85/85. Clean full verification: 2,588 frontend tests passed; build passed in 7.34 s; Agent 470 passed, six baseline failures, one skipped. An earlier run was invalidated by Vite reloading edited sweep fixtures and is not treated as a valid result.

## Part 5 ? wording and countdown

Normal HOLD start now gives the Unit Controller guidance in en/ta/hi, with H-1053 still blocked. The reply countdown has a dedicated high-contrast seconds-remaining display driven by the existing real deadline. Speech removes parenthetical/detail-screen directions while the card retains full text. Added localized HOLD refusal and display-versus-speech tests. Validation: 2,592 frontend tests passed; build passed in 7.75 s; Agent 470 passed, six baseline failures, one skipped.

## Part 6 - routed page controls

Added shared ASK controls for navigation/back, row selection/open/next/previous/read, tabs, scroll and refresh in English/Tamil/Hindi. Row clicks and voice selection update the shared target context used by actions. A later registered UI selection invalidates the older voice override. Existing row view buttons remain the source of open behavior; unrelated mutation buttons are never clicked. All controls remain behind the existing voice-everywhere flag.

Added a real `dev:mock` browser suite: 21 routes plus nine multilingual registry checks. Full validation: 2,622 frontend tests passed (47 files), build passed in 19.09 s. Agent: 470 passed, the six baseline failures, one skipped, seven subtests passed. Initial sandbox runs could not start Vite or use pytest temporary directories; the reported runs used the required access.

## Part 7 - real-app checks in progress

Added an isolated localhost Agent launcher with GNANI_MOCK, process-only generated TEST VOICE_USERS, no environment-file loading, no audio logging and temporary audit paths outside the live stores. The browser uses synthetic mic frames and real transcription requests; private credentials never enter the runner, reports or trace artifacts. Initial commands use the development transcript control. TTS is muted here; completion ordering has separate unit coverage.

The initial real-app run caught a successful page control being logged as refused because every explicit reason except nav_matched was treated as a refusal. Fixed executed handling and added a regression test for both success and missing targets. Targeted tests: 57 passed. Full final validation and the complete real-app coverage report are pending.

## Additional real-app findings

The initial all-route run found duplicate representations of the same loaded entity (table row, ID button, dropdown, and summary table) being treated as ambiguous targets. Row controls now group by field and ID, prefer the table row for reading, invoke its explicit view/ID handler, and synchronize an available matching dropdown. Stock, Supplier Scorecard and Energy all passed the subsequent real-app recheck. Training/reading rows use their loaded record metadata to select the correct target field. The browser suite now requires loaded rows on seeded pages instead of silently skipping selection while a page is still loading.

A select option itself is not visually laid out while its dropdown is closed. The readiness test therefore checks its visible select parent, matching the production adapter. This does not relax capture or action deadlines.

## Changed-file map by part

Paths below are relative to the frontend or Agent project as indicated; pre-existing MASTER changes are retained.

| Part | Frontend files | Agent files / documents |
|---|---|---|
| 1 | services/voiceDiagnostics.js, voiceActions.js, voiceTranscript.js, voiceActionApi.js, voiceLogView.js, voiceTestLog.js; components/voice/PushToTalk.jsx, VoiceLogViewer.jsx; tests/round2-voice.test.js | app/copilot/voice_auth.py, voice_foundation.py, voice_audit.py; tests/test_voice_foundation.py |
| 2 | services/voiceActions.js, voiceActionCapture.js, runReplyCapture.js; tests/round2-voice.test.js | app/main.py; app/copilot/voice_auth.py, gnani_client.py; tests/test_voice_foundation.py |
| 3 | services/voiceCommandText.js, voiceActionRegistry.js, voiceTranscript.js; tests/round2-voice.test.js, voice-everywhere.test.jsx | This report |
| 4 | services/voiceActionRegistry.js, voiceActions.js; components/voice/VoiceActionPanel.jsx, PushToTalk.jsx; tests/round2-voice.test.js, fixtures/page-sweep.jsx | app/copilot/voice_policy.py; DOCS/ACTION_LEVELS.md |
| 5 | services/voiceWording.js, voiceActionRegistry.js, voiceActions.js, voiceTranscript.js; components/voice/VoiceActionPanel.jsx, KuralWakePanel.css; tests/round2-voice.test.js, f17-actions.test.js | This report |
| 6 | services/voicePageControls.js, voiceTranscript.js; context/VoicePageContext.jsx; components/common/Table.jsx; pages/InventoryForecast.jsx, SalesInvoices.jsx, SupplierScorecard.jsx; tests/real-page-controls.test.jsx, real-app.vite.config.js, fixtures/selection-context.html, fixtures/selection-context.jsx; vitest.config.js | DOCS/ACTION_LEVELS.md |
| 7 | tests/real-app-check.mjs; components/voice/PushToTalk.jsx development transcript input; tests/round2-voice.test.js audit regression | tools/round2_test_agent.py; DOCS/REAL_APP_CHECK_REPORT.md |

Frontend source paths in the table start under `src/` unless they begin `tests/` or name a root config. No commit was created. Protected environment files, live audit/audio stores and MANUAL_TEST_LOG.md are not edited by this round.

## OPC refresh race and final control corrections

Repeated real-app approvals reproduced the intermittent refusal: the card said "Wait for this page to finish loading." Spectrometer reading-list polling sets `loading` even though the separate OPC connection snapshot is available. Connect, disconnect and request-reading now validate that snapshot without being blocked by unrelated list refreshes; `busy` still blocks them. Three regression cases check both permitted refresh and blocked busy behavior. Eight consecutive real-app approvals plus malformed retry, wrong-code retry, lock/reset and safe reading passed after the fix, with exact transcription counts and reason-code assertions.

Page tabs now include visible portal-rendered tabs and localized invoice/certificate names. Next/previous/read follow the focused row collection rather than accidentally switching from a selected PR to a heat. Browser refresh waits for its spoken acknowledgment and audit before reload. Added tests for all three fixes. Targeted final result: 68 passed in three files. Full validation is running in `round2-validation-tests.log`, `round2-validation-build.log`, and the Agent `round2-validation-pytest.log`.

The preceding full run had one voice-log browser timeout (2,623 passed); its five tests passed unchanged in isolation. No timeout was increased or assertion removed. Earlier clean full result was 2,624 passed, build passed in 20.44 s. These are historical results, not claimed as final validation of subsequent edits.

Reply gate comparison against branch HEAD: RMS 0.01 -> 0.01; speech onset one qualifying frame -> at least 100 ms for yes/no; ending silence 800 ms -> 700 ms for yes/no; maximum spoken reply 4 s. The reply window begins with actual audio frames after TTS completion and the 300 ms gap. No audio content or private credential text is included in timing logs.

## Latest full validation

- `npm.cmd test`: **2,629 passed**, 47 files, 205.88 s (`round2-validation-tests.log`).
- `npm.cmd run build`: passed in **10.11 s** (`round2-validation-build.log`); existing chunk-size advisory remains.
- Agent pytest: **470 passed, six known baseline failures, one skipped, seven subtests passed**, 50.35 s (`round2-validation-pytest.log`). The baseline failure list is above.
- Generated tracked F17B screenshot artifacts were restored byte-for-byte from HEAD using read-only `git show`; no git write command was used.

The real-app matrix continues beyond this validation run; see REAL_APP_CHECK_REPORT.md for coverage and any pending cases. Passing unit/regression totals do not imply every requested real-app scenario is complete.

## Continuation: exact row IDs and native approval coverage

The real-app Training Data check exposed two related row-selection faults: substring matching classified pagination value `50` as record `5`, and the custom sample table did not expose its sample IDs. Automatic matching now uses exact option values or table-cell IDs. TrainingData.jsx explicitly marks real sample rows under the existing action flag. Regression coverage asserts that sample rows exist and the page-size option is never a row target.

The affected native approval reruns passed on Inventory Forecast, Anomaly, Recommendation and Training Data: correct credential, malformed input with one retry, wrong credential followed by a correct retry, three wrong credentials producing lockout, and reset. Inventory's second successful request uses a different material to respect the existing duplicate-open-PR restriction. The isolated Agent now supplies in-memory chat history through the production clear-history method; no production service is bypassed.

Targeted row tests before the explicit Training Data marker: 63 passed. Agent continuation validation: 470 passed, six unchanged baseline failures, one skipped, seven subtests passed in 43.65 s. Latest frontend validation after the explicit marker is pending.

## Completed real-app workflow checks

Explicit heat-card IDs in `src/pages/PreMeltGate.jsx` fix voice selection when rendered card text joins the ID to adjacent content. The real-page regression now requires the H-1051 card. `src/services/voiceFormActions.js` resolves spoken invoice customer IDs against the loaded customer list: normalization had lowercased C-001, which the backend correctly rejected. A new regression checks the exact service payload and refuses an unknown customer before execution.

The real mock workflow now passes H-1051 selection, gate check, spoken start approval, Full Analysis strategy acceptance, mechanical prediction/tap approval and invoice creation. RL acceptance passes through the normal anomaly/recommendation prerequisites. Malformed input, wrong role, three-wrong lockout, reset and wrong-then-correct spoken retry also pass on these workflow pages. H-1053 remains HOLD and is not used as a bypass.

Real-app checks total 435 PASS across 21 routes, with explicit N/A rows for absent registered actions/rows. They use synthetic microphone replies, an isolated Agent, process-only test credentials and muted TTS. These are not human live-audio results. MANUAL_TEST_LOG.md is untouched.

Harness fixes: fresh documents isolate parameterized route tests; refresh observation records accepted audit requests before reload discards the response body and waits for navigation before moving on; modal closing is scoped to page controls. Synthetic-reading setup now selects both a grade and the required deviation element through the existing UI. No assertion or action deadline was relaxed. Failed/intermediate logs remain available; the final results supersede them.

## Final verification after workflow fixes

- Frontend: **2,630 tests passed in 47 files**, 190.51 s (`round2-final-verified-tests.log`).
- Build: **passed**, 7.26 s (`round2-final-verified-build.log`). Existing bundle-size advisory remains.
- Agent: **470 passed, six known baseline failures, one skipped, seven subtests passed**, 38.46 s (`round2-complete-pytest.log`). No new Agent failure.
- Real-app report: **435 PASS, 46 N/A, zero FAIL**, 21 routes. N/A covers missing registered action categories and pages without loaded rows.
- Additional changed files in this continuation: `src/pages/TrainingData.jsx`, `src/pages/PreMeltGate.jsx`, `src/services/voicePageControls.js`, `src/services/voiceFormActions.js`, `tests/real-page-controls.test.jsx`, `tests/round2-voice.test.js`, `tests/real-app-check.mjs`, `tools/round2_test_agent.py`, and the two Round 2 reports.
- Added/strengthened regressions cover numeric sample IDs versus pagination values, actual sample rows, explicit heat cards, exact invoice customer resolution and unknown-customer refusal. Real browser scenarios add multilingual page controls, native private retries, safe actions, and the complete mock heat-to-invoice and RL workflows.

Remaining limitations: the six baseline Agent failures above are unresolved. Human live microphone/real-provider and audible TTS checks are not performed. The representative real-app matrix does not claim every possible action/data/role combination; the earlier mocked registry sweep remains separate evidence. No commit was created, no Git write command was run, and protected files and MANUAL_TEST_LOG.md were not changed. Test-generated tracked screenshot artifacts were restored from HEAD using read-only Git output.
