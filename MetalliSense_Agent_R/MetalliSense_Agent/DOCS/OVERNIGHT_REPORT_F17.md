# Overnight report — F17 voice actions

Branch: `f17-voice-actions`. Builders: Manish (Part A actions), Nethra (Part B ASK wording/data adapters). No staging, commit or push. No live Gnani/provider/device/plant calls. Existing unrelated `.claude/` remains untouched.

## Part status

| Part | Status | Outcome |
|---|---|---|
| A — actions | DONE, mocked verification | 21 page-scoped entries covering the 17 requested families (separate explain/connect/reject variants); existing confirmation/approval controller retained. |
| B — ASK answers | PARTIAL, routed-page implementation complete / wording DRAFT | 79 templates over all 19 routed non-Dashboard pages, ta/hi/en loaded-data adapters and page registrations. The non-routed Onboard Tour and external Technical Documentation utilities retain existing behavior; new metadata/remote-guide ASK routes were not invented. Team wording approval remains pending. |
| C — docs and review | DONE | Action/service/gate table, every draft sentence, mocked contact sheets and this report. |

No part was reverted. Focused defects were repaired and verified; all intermediate failed/aborted logs remain in ignored local evidence. No successful tests are represented as live hardware or real plant validation.

## What changed

Part A reuses `createActionFlow`, existing mic capture, shared TTS completion, private passcode capture, server-owned roles, one-use token, five-second Cancel countdown and audit protocol. Adapters call the same service exports as page buttons, with page snapshots and successful-response notifications. Mechanical prediction's existing API request was extracted into a shared function; the page's local formula fallback remains, while voice never calls that fallback a backend success. Approval names come from the consumed identity. Missing/ambiguous targets refuse with one clarification instead of guessing. Start melting rechecks PLANNED / unchanged fresh gate / GO or acknowledged WARN; HOLD never reaches a start or override request. PR/QA rejections collect one reason before passcode. The generic reject deny was narrowed to permit only the registered review workflows; manual lot disposition remains denied. Never-list commands emit a refusal audit callback without confirmation or plant execution.

Part B reads only registered loaded snapshots. Missing fields/selection/results return unavailable; zero/false values are preserved rather than treated as absent. Rank, EOQ and stock-out time have separate fields. Exact historical approver questions avoid the old imperative-approval filter without allowing appended mutations. Numbered heat/HOLD answers, current latest-reading summaries, navigation, tour controls and safety refusals keep priority. Object/array values retain loaded details; these are draft field-oriented answers, not approved polished narration. Cost/history, PR, supplier and sample queries with multiple possible rows require a loaded/explicit unique selection; no first-row guess is added.

## Files by builder

All frontend paths below are relative to `MetalliSense_Frontend_R/MetalliSense_Frontend/`; Agent paths are relative to `MetalliSense_Agent_R/MetalliSense_Agent/`.

### Part A — Manish

- Agent `app/copilot/voice_policy.py`, `tests/test_voice_foundation.py` (registered levels/roles, hard deny, server/frontend parity).
- Frontend `src/services/voiceActionRegistry.js` (new), `mechanicalService.js` (new), `voiceActions.js` (shared flow extensions), `src/context/VoicePageContext.jsx` (scoped loaded snapshots + successful action notifications), `src/components/voice/PushToTalk.jsx` (action adapter and refusal audit routing).
- `tests/f17-actions.test.js` (new): every service's happy/failure path plus every complete confirmation/approval flow, identity, countdown, audit and secret masking; HOLD/ambiguous target checks.
- Page action registrations/notifications in `Spectrometer.jsx`, `PreMeltGate.jsx`, `AnomalyDetection.jsx`, `Recommendation.jsx`, `FullAnalysis.jsx`, `AIAgent.jsx`, `MechanicalProperties.jsx`, `SupplierScorecard.jsx`, `InventoryForecast.jsx`, `RawMaterialStock.jsx`, `YardInspection.jsx`, `EnergyDashboard.jsx`, `SemanticSearch.jsx`.

### Part B — Nethra

- New `src/services/voiceAskContent.js` (all 79 DRAFT sentence templates + unavailable wording), `voiceAskAnswers.js` (pure matching/loaded selection), `tests/f17-ask.test.js` (three-language fixtures, missing/ambiguous/zero values, refusal precedence, exact historical reads and appended-mutation refusal).
- `src/services/voiceTranscript.js`: ASK branch and exact historical-read exception. Its separate never-list audit callback hunk belongs to Part A.
- Loaded snapshot additions in the shared Part A pages above, plus B-only `CostAnalysis.jsx`, `RLOptimizer.jsx`, `SalesInvoices.jsx`, `SyntheticData.jsx`, `TrainingData.jsx`. Energy summary passed to its selected child so savings remain available; Stock detail registers already-loaded QA/movement data only while open.

### Shared/mixed hunks

- Page `useRegisterVoicePage` calls contain both A's action prerequisites/notifications and B's read snapshots; separate argument/hunk review is required if splitting commits.
- `VoicePageContext.jsx` is required by both parts. `voiceTranscript.js` contains Part A refusal-audit routing and Part B read routing. `vitest.config.js` lists A/B/C tests.
- Mechanical API extraction is Part A; loaded prediction/finished data also serves Part B.

### Part C — documentation / mocked review

- Agent `DOCS/F17_VOICE_ACTIONS.md`, `DOCS/F17_ASK_WORDING_REVIEW.md`, `DOCS/OVERNIGHT_REPORT_F17.md`.
- Frontend `tests/f17-review.test.jsx`, `tests/fixtures/f17-review.html`, `tests/fixtures/f17-review.jsx`.
- Agent `DOCS/screenshots/f17/run.png`, `approve.png`, `refusals.png`; `frames/` contains nine labelled original 1280px light mocked captures and review metadata. No actual passcode is present; private phase displays bullets only.

## Flags and restart

Defaults remain unchanged/off. For local review use the existing ignored configuration:

```dotenv
# Agent
VOICE_ACTIONS_ENABLED=true
VOICE_AUDIT_ENABLED=true
# Existing VOICE_USERS entries supply the required synthetic roles.
# Audio logging remains separately opt-in; no setting was changed here.
```

```dotenv
# Frontend
VITE_VOICE_ACTIONS=true
VITE_VOICE_AUDIT=true
VITE_VOICE_EVERYWHERE=true
VITE_VOICE_PAGE_ANSWERS=true
# VITE_WAKE_WORD remains the existing optional hands-free setting.
```

Restart Agent from its root: `.\.venv\Scripts\python.exe .\app\main.py`. Restart frontend from its root: `npm run dev:mock -- --configLoader runner` for mocked review, or the existing normal-dev command for the real backend. No .env file was edited and no users/credentials were created.

## Manual checks still required

- Team approval of every DRAFT sentence; actual Tamil/Hindi STT wording/voice pronunciation remains unverified.
- Real microphone: RUN read-back → ready Listening → yes/no/timeout; approve → private passcode → countdown Cancel/result; one spoken rejection reason; wrong-role/lock behavior.
- With explicitly authorized local services, verify OPC connection refusal/request, GO/WARN/expired/dirty/HOLD and changed-stock backend refusal, PR/QA maker-checker, inspection request vs eventual completion, simulated meter label, order-plan split and search titles. No live plant write was attempted here.
- Passcodes are observable, opaque voice sessions are not authenticated plant users, and the plant backend's Guest/no-role-auth gaps remain. These flags do not make this production authorization. Client-reported audit is not independent plant execution evidence.
- Non-routed utility ASK additions and remote technical-guide content are not implemented. Missing/ambiguous detail data stays unavailable instead of guessing.

## Verification

Per-part and final command results, full log paths, source/build WAV hashes and final diff checks are appended below after commands finish. No dependencies installed; no audio synthesized, re-encoded or replaced. No training, model changes, deployment, staging, commit or push.

## Recorded verification results

| Milestone | Full Vitest | Full Agent pytest (`GNANI_MOCK=true`) | Production build |
|---|---|---|---|
| Part A milestone | 1,423 passed / 35 files / 159.22s | 409 passed / 12 existing warnings / 72.01s | passed / 15.57s (also compiled the initial loaded-ASK scaffolding) |
| Part B milestone | 1,656 passed / 36 files / 146.40s | 409 passed / 12 existing warnings / 59.45s | passed / 6.29s |
| Final A+B+C snapshot | **1,692 passed / 37 files / 149.16s** | **410 passed / 12 existing warnings / 48.61s** | **passed / 15.13s** |

Final frontend output:

```text
Test Files  37 passed (37)
Tests       1692 passed (1692)
Duration    149.16s
```

Final Agent output:

```text
410 passed, 12 warnings in 48.61s
```

Final build output:

```text
built in 15.13s
```

The existing large-chunk warning remains (App bundle 563.42 kB, gzip 176.96 kB); it was not hidden or configured away. No dependency or package-lock change. Full output logs are retained together in:

`tools/local_wake_data/f17-verification-d5b1e842fa864209a7155f18183c69f1/`

- `f17-final-verified-full.log`
- `f17-final-verified-pytest.log`
- `f17-final-verified-build.log`
- `final-source-hashes.json` and `final-verification.json`

Added regression coverage: 65 F17 action tests (each service's success/failure and full shared flow), 247 ASK tests (79 templates × 3 languages plus coverage/missing-data/safety/history checks), one mocked contact-sheet capture; seven Agent registry/role/parity tests. Existing tour/F13/PTT/HOLD/dev-module regressions ran in the complete suite.

Earlier failed logs remain, including a test fixture syntax error, existing reduced Copilot export mocks needing namespace injection, restricted local dependency resolution, ASK/HOLD precedence, ambiguous balanced-strategy keyword matching, and an intermediate full run started before its final refusal-audit edit. The final snapshot was rerun cleanly without increasing timeouts or weakening assertions. Registered PR/QA rejection was also checked through the entire flow after identifying the original generic reject deny collision; manual lot rejection remains forbidden. The late field audit separated rank/EOQ/stock-out fields and verified exact historical read questions with appended-mutation refusal.

Protection: **22/22 source WAVs and 22/22 built WAVs** match the approved manifest SHA-256 values, copied without generation or re-encoding. **265 source/test files** were fingerprinted before final verification; zero changed during the final checks. Staged and unstaged `git diff --check` pass (only the existing inaccessible global Git ignore warning). No .env, credential, model, recording, training, cache-audio or prior evidence files were modified. Existing unrelated `.claude/` remains untracked/untouched.

Mocked review sheets:

- `DOCS/screenshots/f17/run.png`
- `DOCS/screenshots/f17/approve.png`
- `DOCS/screenshots/f17/refusals.png`

The approval contact sheet was opened for visual inspection: target/quantity summaries, masked passcode, countdown Cancel and terminal result are readable; all states use the production anchored card/orb. These are synthetic UI states, not proof of live detection, credentials or backend plant execution.

Final state: implementation and local mocked verification saved on `f17-voice-actions`; **nothing staged, committed or pushed**. Part B's non-routed utility additions and team wording/live checks remain explicitly listed above rather than claimed complete.
