# Stage 4c: live-check fixes

2026-11-12. Branch `v23-improvements`, starting HEAD `130ffe8`. No Git write commands, staging, commits or pushes.

## Result and scope

The nine requested transcript scenarios pass in an isolated full-mode stack. **The original physical-microphone “action unavailable” response was not reproduced**, so this is not a claim that a new live microphone trial passed. Existing multilingual gate matching already recognizes the supplied transcripts at HEAD. A separate gate-page target-display bug was found and fixed. The receiving navigation gap and the assessment performance problem were reproduced in code/runtime and repaired.

Full mode used the actual Node backend, AI models, Agent models, frontend services and action handlers. Only speech/provider responses were mocked through the existing Stage 4b fixture. No Gnani or Groq calls were made. Browser external requests were blocked. Ports were **3100 / 8100 / 8101 / 5273**, with separate OPC ports 4434/4435. No existing service was stopped or reconfigured. Agent audit, identities and feedback used temporary test storage. Passcodes were generated in process memory, supplied through symbolic fixture replies and masked in evidence.

Evidence paths below are relative to the repository's ignored `.overnight_backup/stage4c/` directory. Earlier unsuccessful attempts remain preserved; later results do not rewrite those logs.

## 1. Gate command and page registration

`registeredVoiceAction` and `prepareVoiceAction` both recognize these unchanged forms at HEAD:

- `gate check pannu H-1051`
- `run gate check for H-1051`
- `கேட் செக் பண்ணு H-1051`
- `gate check करो H-1051` (and the existing native Hindi form in the regression)

No alias, wake rule or matching threshold was changed. Browser replay dispatched all four through `gate_check`, called the normal gate endpoint and returned H-1051 GO (`checks.json`, `check.log`). There is no evidence here establishing why the original real STT/page session returned “unavailable”; a different heard transcript, flags or an older running frontend would require that session's diagnostics to establish.

**Actual page bug:** the Pre-Melt registration's action callback reloaded its captured, previously selected `heatId` after every action. A valid gate check for another explicitly named heat could therefore leave the old heat displayed. The callback now reloads/selects the gate response's `heatId`. `gate-target-pass.json` verifies selecting H-1053, submitting `gate check pannu H-1051`, executing the check and visibly selecting H-1051 afterward. The flow remains ASK with its existing cancellation window and saved-charge checks.

## 2. Receiving from another page and delay

**Root cause:** the global transcript handler recognized the receiving action on Stock, but its cross-page branch only spoke “Open Stock and select the target first.” It neither navigated nor retained the action. A new receiving draft does not depend on a selected source-page record.

The handler now hands this specific draft action to `VoicePageProvider`, navigates to `/raw-material-stock`, waits for that page's loaded registration and invokes the existing action flow once. A navigation elsewhere drops the pending handoff. No write occurs merely from navigating or starting collection. The registered **APPROVE** level, Operator/Supervisor roles, field collection, read-back, private authorization and execution checks remain unchanged. The request's ASK/RUN wording does not describe this registry entry's actual current safety level; it was not downgraded.

From Anomaly, `truck receive करो` now opens Stock and asks for material type. A spoken fixture `cancel` cancels/audits collection without creating a lot (`checks-retry2-saved.json`).

Timing breakdown (`receiving-timing.json`, `receiving-timing.log`):

| Stage | Measurement |
|---|---|
| Initial command STT | Transcript injection; not invoked. Real-provider STT latency cannot be measured by this run. |
| Local registered matching | 0.081 ms mean over 100 warm matches in Chromium. |
| Navigation, page registration and first field prompt | 1,478 ms from demo-command click. |
| Agent form-reply STT, mock | 194 ms HTTP request. This is the subsequent cancellation reply, not the initial command. |
| Agent audit | 493 ms HTTP request in this sample. |
| TTS | Muted; not invoked. No real-provider TTS timing claimed. |
| Whole form-start/cancellation turn | 6,252 ms, including capture readiness and utterance/silence collection; another replay completed in 3,682 ms. |

The repaired waste is the mandatory second navigation/command turn. There is no LLM request in the receiving match/handoff path. This evidence does not attribute the user's original slow “Understanding” interval to real STT or TTS without those provider timings. No timeout was changed.

## 3. Assessment timeout

**Endpoint correction:** the Node gate's AI assessment calls **Agent `/premelt/assess`**, normally port 8001. The separate AI service on 8000 supplies other model endpoints; changing its model startup would not repair this gate call.

The Agent already initializes/caches its risk model at normal startup. The assessment performs risk scoring before and after alloy correction. Each old scoring pass dispatched up to **13 tiny `predict_proba` calls**: nominal, uncertainty samples, normal baseline and ten driver/counterfactual rows. Repeated OpenMP worker dispatch for these small batches imposed substantial workstation overhead. It was not a per-request model load or repeated CSV parse.

`ChargeRiskModel.assess` now scores the same rows in one batch, and inference limits OpenMP workers to one for that small batch. Training, model files, sample count, random seed, impurity handling, driver formulas, risk thresholds and returned rounding remain unchanged. This reduces two assessment passes from up to 26 predictor dispatches to two. No prediction-result cache can conceal changed composition or uncertainty.

| Measurement | Before | After |
|---|---:|---:|
| Full-stack Agent assessment HTTP call | 29.822 s, HTTP 200 after the gate's existing 20 s deadline | 0.285 / 0.201 / 0.085 s, HTTP 200 |
| Direct risk-model load | 1.143 s | Already cached in repeated endpoint checks |
| Separate direct single-pass inference probe, first / repeat | 8.274 / 0.612 s | 1.486 / 1.073 s |

These are local observations under a running workstation's varying load, not a controlled throughput benchmark; the direct repeat probe did not improve. The end-to-end gate endpoint is the relevant timeout check. Identical probe chemistry returned risk **0.0382**, nominal **0.0359**, band **[0.0359, 0.0404]** and identical rounded driver values before/after. Evidence: `api-before.log`, `timing-before.log`, `timing-after.log`, `checks.json`.

H-1051's gate subsequently returned GO through the real backend. The backend's 20,000 ms deadline, `aiRequired` fail-safe and HOLD/start interlock were untouched. H-1053 normal start still refuses HOLD and produces the refusal audit.

## Transcript verification

| Finding | Result | Evidence |
|---|---|---|
| 1. Gate forms and explicit target | **PASS** | Four multilingual browser commands executed; separate H-1053 → H-1051 selection/display check passed. Original physical-mic refusal remains unreproduced. `checks.json`, `gate-target-pass.json`. |
| 2. Cross-page truck receiving | **PASS** | Navigated from Anomaly to Stock, asked first field, cancellation audited. `checks-retry2-saved.json`, `receiving-timing.json`. |
| 3. Assessment inside unchanged deadline | **PASS** | Actual Agent endpoint timings above; actual gate GO. `checks.json`. |
| 4. `start melting H-1053` | **PASS** | Refused with HOLD message, `reason_code=backend_refused`, audited; no normal start. `checks.json`. |
| 5. RUN record change, no/yes | **PASS** | `read meter H-1051`: “no” cancelled; “yes” executed. Exactly one simulate POST, HTTP 200; actual simulated energy record retrieved. `run-energy.json`, `energy-record.json`. Gun connection no/yes also passed in `check-retry.log`. |
| 6. PR authorization | **PASS** | Real isolated PRs approved with generated six-digit Manager code; second flow returned `ok=false, wrong_code, tries_remaining=2`, then `ok=true` and executed. Required countdown/token consumption remained. `auth-final.json`, `auth-final.log`. |
| 7. Spectrometer | **PASS** | Pointer Connect, then `oru reading edu`; request audited executed and table increased from 0 to 1 row. `checks.json`. |
| 8. Anomaly “why” chat | **PASS** | Actual analysis prepared, shared chat opened, `why` submitted; HTTP 200 mock explanation displayed in panel. `chat-pass.json`, `chat-debug.log`. Provider content is explicitly a fixture, not a factual model explanation. |
| 9. 360/768 layout | **PASS** | Pre-Melt page checked at both widths, 900 px height; orb in viewport, no overlap with visible page buttons. `check-retry.log`, `narrow-360.png`, `narrow-768.png`. Scope is these requested widths/page, not another exhaustive 20-page sweep. |

RUN energy setup used normal H-1051 GO/start on the isolated backend. No HOLD override was used. PR setup created disposable requests in the isolated backend; approval itself used the normal voice role/token flow.

Visual inspection of the narrow screenshots also shows an existing 360 px layout limitation: the main layout retains its left offset and clips much of the page content. The requested orb/button-overlap check passed for visible controls, but this is not a claim that the whole page is usable at 360 px. No unrelated responsive-layout repair was made.

Initial harness failures included stale Vite dependency cache/sandbox access, a silent synthetic mic that correctly never transcribed confirmation, invalid PR setup items, a PR text selector that included its timestamp, submitting chat before analysis settled, and counting the orb's own button as an obstacle. Correcting these fixtures did not change existing application test assertions, product timeouts or approval rules. Failed artifacts/logs remain alongside final evidence. One fixture encoding mistake is also retained in the failed retry log; final Hindi commands used Unicode escapes.

## Regression tests and full checks

New frontend regressions exercise five existing multilingual gate commands against an explicitly loaded H-1051 while another heat is selected, assert the actual gate service target/notification, and verify cross-page receiving queues without speech/provider fallback. They are registered in the existing Vitest include list. New Agent regressions verify one combined prediction batch, nominal/uncertainty output behavior and the OpenMP inference limit. No existing test assertion was edited.

Full sequential checks (`final-gate/`, all exit 0):

- Frontend `npm.cmd test`: **2,668 passed, 51 files**, 453.69 s (wrapper 461.89 s).
- `npm.cmd run build`: **PASS**, 27.38 s (wrapper 29.09 s). Existing large-chunk warning remains.
- Agent `.venv\Scripts\python.exe -m pytest`, mock speech and isolated DATA_DIR: **496 passed**, 14 existing deprecation warnings, 108.68 s (wrapper 111.11 s).
- Focused new Agent tests also passed independently: 2/2.
- Final `git diff --check` passed. Existing Git ignore-access/line-ending warnings are not failures.

The test-generated tracked historical passcode screenshot was copied into ignored evidence and restored byte-for-byte using read-only `git show HEAD:<path>` output. No Git restore/reset/checkout was used.

## Files and cleanup

Changed application files: `app/premelt/risk_model.py`; frontend `VoicePageContext.jsx`, `PushToTalk.jsx`, `voiceTranscript.js`, `PreMeltGate.jsx`. Added `tests/test_stage4c_risk.py` and frontend `tests/stage4c-regressions.test.js`; registered the latter in `vitest.config.js`. This report is also new.

All 15 managed root jobs completed/closed; Windows kill-on-close Job Objects stopped only their owned descendants. Service roots stopped:

- Initial sandbox generation: **558424, 562704, 562476, 540260**.
- Dependency-rebuild attempt: **553356, 554544, 550964, 530580**.
- Successful full-mode generation: **554632, 555864, 557644, 559996**.
- Completed full frontend/build/Agent check roots: **535012, 533496, 529984**.

Ledger: `processes.jsonl`. User processes on 3000/8000/8001/5173 and nordic-company-lens were not stopped. Standalone browser/probe commands completed normally. The user's already-running Python/frontend processes must be restarted by the user to pick up the changes; this task did not restart them.

No edits to `.env`, `.env.local`, existing `voice_audit`, `voice_audio`, `local_wake_data` or `.claude`. Existing untracked `.claude/` remains. No changes to wake rules, thresholds, aliases, safety levels, test assertions or product timeouts. No physical microphone or real provider accuracy/latency result is claimed. Nothing staged, committed or pushed.
