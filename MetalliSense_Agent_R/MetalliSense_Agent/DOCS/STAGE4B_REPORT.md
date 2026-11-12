# Stage 4b: full-mode browser verification

2026-11-12. Branch `v23-improvements`, starting HEAD `29d054e`. No Git write commands. No new Gnani or Groq calls.

## Scope and result

The 15 previously blocked coverage rows now pass. The original generated-wake recognition failure remains a FAIL. Replaying its recorded `wake=false` response passes the preservation check; it is not a new recognition trial or evidence that the failed wake now works.

Updated Stage 4 matrix: **414 PASS / 1 FAIL / 25 N/A, 440 total**. These are recorded scenario counts, not independent accuracy trials. The 40 additional responsive checks are reported separately and are not added to that denominator. The original matrix and failed attempts remain preserved; the updated matrix is `.overnight_backup/stage4b/matrix.json`.

## Setup and evidence

Used the actual backend on 3000, AI service on 8000, isolated test Agent on 8001 and normal full-mode Vite frontend on 5173. The Agent used temporary DATA_DIR and process-only mock provider configuration; browser requests outside these local services were blocked. Actual backend data, prediction services and button handlers were exercised. Provider explanations/chat are explicitly mocked, not new live model results. No `.env` or `.env.local` was edited. The test Agent is not the ordinary startup command.

Evidence below is relative to `.overnight_backup/stage4b/`. Browser actions used Playwright pointer clicks, including actual coordinate clicks for the moving orb. Form filling used ordinary browser input. Saved transcripts entered through the existing development transcript control. Wake replay substituted only the saved wake response. No authentication or approval was bypassed; no approval/auth failure occurred in this run.

## Updated rows for all 16 previous FAILs

| Previous row | Final | Evidence and scope |
|---|---|---|
| Generated wake + latest reading activation | FAIL retained | Original `stage4-final-smoke/results.json` recognition miss unchanged. `replay.json` verifies saved `What is the?`, `wake=false`, returns to Waiting, no new audit, zero provider calls. No tuning or new recognition. |
| Saved transcripts through full-mode UI | PASS | `replay.json`: Tamil H-1053 question routes to `heat_status`, answers from loaded backend data; start command routes to `start_melting`, audited `refused/backend_refused`. |
| RL Optimizer accept/explain | PASS | `browser-flow2.json`: Accept & Deduct Stock returns 200. `browser-flow-finish.json`: View details clicked. This page has comparison/details, not a separate provider Explain button. |
| Anomaly analyze/explain | PASS | `browser-flow-finish.json`: standalone prediction and explicit explanation. `browser-chat-final.json`: result survives revisit and shared chat works. |
| Recommendation generate/explain | PASS | `browser-flow-finish.json`: generation; `browser-recommendation-reason.json`: independent reasoning button clicked after its visibility repair. |
| Agent analysis/explain/chat | PASS | `browser-agent-final.json`: analysis and AI explanation. `browser-chat-final.json`: shared AI Copilot chat submission. There is no separate chat button on the Agent analysis page. |
| Synthetic generation/deviation | PASS | `browser-agent-final.json`: SG-IRON, C deviation, generated result. |
| Yard per-piece capture/ingest | PASS | `browser-yard.json`: gun simulator inspection, per-piece CSV download and pointer ingest. Original test export preserved in `yard-csv-export/GUN-00044.csv`. |
| DRI QA/reject and alloy receiving | PASS | `browser-stock.json`: QA maker/checker entry, reject with reason, alloy receiving dialog. |
| Inventory PR create/approve/reject | PASS | `browser-pr-closed-drawer.json`: separate PRs created and approved/rejected using buttons. |
| Training-data create/edit/delete | PASS | `browser-training-fixed.json`: disposable training row created, edited, deleted. |
| Supplier AHP, criteria, ranking/filters | PASS | `browser-supplier-energy.json`: apply AHP weights, Criteria view, all six material filters and five ranking controls. Its failed energy attempt is retained separately. |
| Energy meter action | PASS | `browser-energy-clean.json`: fresh backend, H-1051 passes gate, starts melting, Read meter (sim) clicked, 200 result. |
| Sales invoice dialog | PASS | `browser-invoice-final.json`: actual Create invoice dialog and submit. |
| Voice row navigation and portal tabs | PASS | `replay-portal.json`: selected SCR-0913, next PIG-1053, previous SCR-0913; Invoice and Certificate tabs visibly selected and audited. These are the registered tabs in the invoice portal. |
| Narrow layout/orb collision | PASS for requested layout scope | `browser-narrow-final.json`: 40/40 page-width checks, 20 pages at 360 and 768 px, orb inside viewport with no visible primary-button overlap. Mic CPU/rerender profiling from the older broader row was not requested here and was not performed. |

Tamil replay answer reports H-1053 HOLD, PIG-1053 quarantined, Cu 0.50% versus limit 0.30%. The start refusal preserves the Unit Controller override restriction. Saved transcripts and the original recognition result remain untouched.

## Small application repairs

1. **Anomaly timestamp:** gate-derived readings lacked `timestamp`, rendering Invalid Date. Use the gate's existing `passedAt`; unavailable timestamps show Not available, never a fabricated measurement time.
2. **Anomaly revisit:** local result initialized empty while the effect intentionally skipped an already analyzed flow. Restore the flow's existing result/reading without rerunning inference.
3. **Recommendation reasoning:** the reasoning button/result lived inside the optional applied-deviations map. Real responses without that metadata hid it. Move the existing presentation outside that map; payloads and handlers stay unchanged.
4. **Orb/menu collision:** Ready reserved the expanded card's height, producing incorrect lifts. Measure only the visible footprint. A lifted orb could put its controls above the viewport; clamp the popup within viewport bounds and retain the viewport height limit.

Fixture-only corrections, retained in ignored evidence: wait for existing OPC connection state before clicking Connect; close the PR detail drawer before clicking the table action; use the invoice's actual dialog role; wait for a mutation response rather than its GET/OPTIONS; use a fresh unmetered backend for the meter action. No test assertion or timeout was changed. Earlier unsuccessful attempts remain in their JSON/log files and are not represented as passes.

## Verification

Final sequential gate (`.overnight_backup/stage4b/final-gate/`):

- `npm.cmd test`: **2,662 passed, 50 files**, 218.88s (wrapper 220.95s), exit 0. The previously timed-out orb file passed in this full run too.
- `npm.cmd run build`: **PASS**, 8.24s (wrapper 9.20s), exit 0. Existing large-chunk warning remains.
- Agent `.venv\Scripts\python.exe -m pytest`, `GNANI_MOCK=true`, isolated DATA_DIR: **494 passed, 14 deprecation warnings**, 40.65s, exit 0. No historical baseline failure reproduced.
- Approved audio: **22/22 source** and **22/22 built** WAV SHA-256 values match the approved manifest. Saved smoke results SHA-256 remains `8d258c51abdaf4bb70b18793de73bb9bcaf571a030a7a0f3f16e6b51074fac76`.
- No existing test assertion, timeout or npm script changed. The new regression file is included in the existing Vitest configuration.
- Staged and unstaged `git diff --check` pass. Existing Git ignore-access and line-ending warnings do not indicate diff-check failures.

Five new focused regressions cover gate timestamp provenance, anomaly restoration, viewport menu positioning, reasoning without deviation metadata, and retained reasoning loading/regeneration behavior. Initial affected run: **22 passed, 1 timed out** in `kural-wake-panel.test.jsx`, waiting for Listening. That unchanged file then passed alone: **9/9**, 42.39s. The npm test script already sets one worker; an extra duplicate maxWorkers argument was rejected by the CLI before tests started, then corrected without editing the script.

## Files changed

- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/pages/AnomalyDetection.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/gateReading.js` (new)
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/pages/Recommendation.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/common/RecommendationReasoning.jsx` (new)
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralWakePanel.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/KuralWakePanel.css`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/stage4b-regressions.test.jsx` (new)
- `MetalliSense_Frontend_R/MetalliSense_Frontend/vitest.config.js` (register the new file)
- `PITCH.md` (Verified numbers only)
- This report.

## Protection, cleanup and limits

All **39 managed root jobs are closed, zero open**; Windows kill-on-close Job Objects terminate only their owned descendants. Both four-service generations stopped. Service roots were 559872/558728/550088/552836 and 559280/537376/538872/541028 (backend/AI/Agent/frontend). The standalone orb test completed normally. No unrelated process, including nordic-company-lens, was stopped.

Owned root PIDs stopped/completed (ledger `processes.jsonl`, summary `cleanup.json`): `356048, 449696, 516072, 530628, 535452, 537376, 538872, 539396, 540372, 540756, 540864, 541028, 542408, 547856, 550088, 550304, 550400, 552140, 552820, 552836, 553212, 554012, 554804, 555264, 555840, 556024, 556084, 556572, 558012, 558032, 558728, 558792, 559280, 559872, 561824, 562732, 562904, 563844, 564036`.

Final source/build hashes are in `protected-hashes.json`. Test-generated changes to one tracked historical screenshot were copied into ignored evidence, then that screenshot was restored byte-for-byte from read-only HEAD output. Existing staging remained unchanged. All temporary scripts, logs, screenshots and updated matrix are ignored under `.overnight_backup/stage4b/`. The yard export created by this test was moved from the backend into that ignored evidence directory with its hash preserved, not deleted. Existing `.claude/` remains untouched.

No physical microphone, audible listening, new provider recognition, statistical wake reliability, mic CPU profiling or exhaustive combinations beyond the listed paths are claimed. No changes to wake rules, thresholds, aliases, safety levels, timeouts, test assertions, feature defaults or approved tour audio. Nothing staged, committed or pushed.
