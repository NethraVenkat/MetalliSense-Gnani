# Stage 4: full-mode fixes and verification

2026-11-12. Branch v23-improvements. No Git write commands, staging, commit or push. **PARTIAL overall: repairs and regression gates passed; generated wake smoke failed, and exhaustive remaining full-mode screen verification is incomplete.** Builders follow existing ownership; no attribution added to product UI.

## Environment and evidence boundaries

Normal `npm run dev -- --configLoader runner`, not dev:mock. Backend 3000 with actual local OPC simulators, AI 8000 with loaded predictors, Agent 8001 with production local predictors/RL and an isolated symbolic mock-voice adapter, frontend 5173. The mock adapter only supplies transcripts/TTS and temporary TEST identities; factory requests use real backend/AI services. All test inventory/heat mutations were in these disposable in-memory server processes. `DATA_DIR`, audio evidence and RL feedback/checkpoint persistence were isolated. No protected environment files, production voice audit/audio stores or unrelated project were edited. Existing local flags were not changed.

Browser initial commands used the development transcript control; confirmation/form replies used a synthetic microphone and actual Agent transcription endpoint. This proves neither physical mic recognition nor qualified hands-free activation. Mock explanations and the local vector fallback are identified separately. External browser traffic was blocked; the page sweep supplied an empty Google-font stylesheet to use system fallback without a deliberate blocked-font console error.

Evidence directory: `.overnight_backup/stage4/` (ignored). Per-page PNGs and network shapes, original failures, successful reruns, job ledger and hashes remain there. Real-provider journal: `tools/local_wake_data/stage4-final-smoke/results.json` (ignored). Historical reports were not rewritten.

## Confirmed causes and repairs

1. **Spectrometer:** `spectrometerService.requestOPCReading()` sends no grade; `/opc-reading` demanded one and returned **400 Metal grade is required** despite a successful Connect. The backend now uses the instrument's current grade, or its first configured real grade on a fresh simulator. Explicit grades still work and a genuinely absent grade still fails. Successful OPC readings were never inserted into the CRUD history; they now are, newest first. `Spectrometer.jsx` discarded the real `data.data` array because it only accepted the mock's `data` array. It now handles both, awaits refresh after a successful request, and restricts composition tiles to numbers rather than metadata. The shared page snapshot follows those loaded rows.
2. **H-1053 full/mock mismatch:** only the browser seed contained the quarantined high-Cu lot and H-1053 heat. The Node seed now mirrors that source data. No HOLD result is forced: quarantine and copper independently fail the unchanged gate. Default reset is still unchecked until a manual check; actual full-mode checks produced HOLD. Ordinary start returned **423**, the planned-tap resume bypass returned **409**, and H-1053 remained PLANNED/HOLD. A separate disposable heat exercised the Unit Controller override.
3. **Grade lookup CPU and custom grades:** derived specs repeatedly regrouped 200,000 in-memory rows. Cache derived specs by datastore revision, invalidate on create/update/delete/reload, and retain independent overlays. New custom grades previously vanished from listing because only CSV grade names were iterated; overlays now participate in the merged list. Actual screen create/edit/delete passed.
4. **Impossible strategy proposal:** the real RL candidate included `P: 0.0105`. Acceptance correctly refused it with **409 No approved source for P or S additions**. Proposal bounds now prohibit unsupported P/S while acceptance remains independently strict. No model training/checkpoint update, stock bypass or post-approval trimming. Regression asserts both clipping and explicit rejection metadata. The repaired full workflow passed through actual strategy deduction, prediction, tap and invoice.
5. **Mechanical backend origin:** its shared button/voice service bypassed the configured API client and hardcoded localhost:3000 via a different variable. This broke isolated/configured-origin execution and was blocked by the strict test allowlist. It now uses `/mechanical/predict` on the existing shared client, preserving formula payload and failure handling. This was not evidence of a broken prediction model.
6. **Console defects:** supplier comparison rows reused FERROALLOY as a React key; use material type plus label. `Input` forwarded `helpText` to the native DOM; consume/render it locally. No dashboard redesign.
7. **Isolation:** optional `SPECTROMETER_OPCUA_PORT` selects the matching simulator/client port; default 4334 unchanged. Gun's existing configurable port and all default HTTP ports remain unchanged. The test Agent initializes local predictors/RL/search and keeps mutable feedback in its temp store.

## Shift handover removal

Removed UI/service/sample fixture, Batch provider endpoint/client, feature tests and example/config flag references. Removed the optional tour step and spotlight branch: **21 active tour steps**; all **22 approved WAVs and their provenance manifest are unchanged**, including the now-unused historical handover clip. Shared audio validation was moved intact to `audio_validation.py` because ordinary opt-in audio evidence still needs it. Shared provider-lease tests retain STT/TTS/transliteration/wake coverage. Historical pronunciation/approved-audio evidence is preserved.

README and TORUN no longer advertise/enable handover. PITCH already contained no handover mention, so it was verified without an edit. Actual `.env`/`.env.local` files stayed untouched; an obsolete local setting cannot restore removed code. No remaining import targets a removed module; historical prose/file inventories remain history, with no Markdown links to removed implementation.

Deleted files:
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_batch.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_gnani_batch.py`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/ShiftHandover.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/fixtures/handover-sample.json`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/handover.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/handover.test.jsx`

## Performance measurements

Fresh Node processes, same 200,000-row dataset, identical serialized derived specs. CSV read count was **1 before and 1 after**: this was repeated CPU work, not repeated disk reads. 100 warmed grade lookups: **24294.015 ms before, 0.3509 ms after**; median **269.5404 ms → 0.0027 ms**. Initial derivation still costs work; module-load times were 1085.70/1295.57 ms and are not an improvement claim. Revision/overlay tests verify correctness after mutations.

The recorded page sweep spans 3061–5133 ms and includes an intentional 1800ms settle plus server/browser load; these are **not clean paint-latency measurements or a controlled before/after speed claim**. Readonly OPC status polling remains 3000ms. Synthetic confirmation fixtures must wait for actual Connected status after navigation; otherwise they correctly refuse a reading. Development StrictMode may double initial effects; it was not disabled. Agent cold startup, precise rerender counts, microphone-loop CPU and full profiling remain unmeasured; no invented figures or timeout/polling changes.

## Verification gates and failure history

- Part 1 final: **2652 frontend tests, 48 files passed**; build **17.95s**; Agent **492 passed, 68.15s**, 14 warnings.
- Combined data/performance gate: **2620 passed, 32 skipped**, sole failing file `real-page-controls.test.jsx` had its original 30s beforeAll timeout under concurrent browser load. Build passed **32.97s**; Agent **492 passed, 112.58s**. No assertion/timeout was changed.
- Isolated `real-page-controls` + new full-mode data file, one worker: **36 passed, 79.41s**, including all 32 real-page controls.
- Final sequential gate: **2657 frontend tests, all 49 files passed, 361.89s**; production build **20.50s**; Agent **494 passed, 81.67s**, 14 warnings. No known baseline failure reproduced.
- New full-mode regression file covers real OPC connect/read/history/disconnect, exact configured mechanical service, grade-cache invalidation/custom overlay and H-1053 seed/start safety. Two new Agent RL constraint tests and two retained generic audio-validation tests pass. Handover-only tests were removed, explaining the lower Agent count than Stage 2.6's 507; coverage was not disabled to hide unrelated failures.
- Initial sandbox runs failed installed-package resolution with Access denied; authorized filesystem-access reruns succeeded. Initial tour failures were fixed by updating retired-step indices/mapping while retaining all 22 audio hashes. A synthetic RUN fixture initially timed out because its ready-event hook requires the existing timing flag; it was corrected only in test-process configuration. One loaded mechanical-page silence scenario missed an audit under load; the isolated repeat passed. Original logs/JSON remain intact.
- Additional fixture failures (invalid default grade ranges, Modal/Field selectors, untranslated Cancel selector, status polling readiness, already-open PR duplication and exhausted disposable stock) remain retained and are not silently described as production defects.

The six historical baseline failures listed in ROUND2_FIX_REPORT were **not observed in this Python 3.11/artifact-present run**. They remain historical, not six new failures:
- `test_f14_mechanical_revision.py::RevisionTests::test_only_mechanical_text_and_fingerprint_change`: missing saved audition manifest.
- `test_f14_tamil_audition.py::BatchTests::test_actual_stock_provenance`: missing saved recovery manifest.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_dev_matching_has_no_grace_and_thresholds_fixed`: missing saved experiment configuration.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_evaluation_sessions_excluded_from_fitting_groups`: same missing configuration.
- `test_kural_paired_v2_experiment.py::PairedExperimentTests::test_original_sampler_parity_and_added_record_rotation`: same missing configuration.
- `test_kural_training.py::PipelineTests::test_isolated_setup_wrong_prefix_never_installs_and_failed_pip_no_retry`: Python 3.12 reaches the pinned Python 3.11 check before the expected prefix check.

## Real provider smoke: bounded, generated speech only

**5 Gnani requests, 1 Groq request.** Four `/stt/v3` responses and one `/api/v1/tts/inference` response were HTTP 200. No retries, overlapping calls, 401/403/429, threshold/rule changes or extra aliases. These used the production Agent endpoints via ASGI TestClient with isolated data, plus real provider adapters; they are not a physical browser/mic end-to-end test on a real-provider running Agent.

- Wake snippet: `What is the?` → wake=false. **FAIL**, no retest/tuning. Full generated command: `Girl, what is the latest reading?`.
- Saved generated Tamil question: **ஆயிரத்தி ஐம்பத்து மூன்று நிலை என்ன?**. Its source hash matches the retained Stage 2.6 generated clip.
- HOLD command: **Start melting H-1053.** Recognition succeeded; independent full-mode mocked-transcript checks verify refusal. The exact real transcript's browser replay did not run.
- Timbre returned **183500 bytes**; no audible check or duration claim. Approved tour audio was not synthesized.
- One Groq reply returned. This verifies connectivity, not the scientific correctness of the generated explanation or a browser chat submission.

Automatic approval review subsequently could not refresh its access token because the account/session had changed. The requested saved-transcript Chromium replay **was not executed**. This was an approval-service authentication failure, not a determination that the action was unsafe. No bypass was attempted. Reauthenticate before remaining browser work; no additional provider calls are needed to replay saved transcripts.

## One full-mode results matrix

Totals: **399 PASS / 16 FAIL / 25 N/A**. Counts describe recorded scenarios, not independent statistical trials or reliability. FAIL includes explicit coverage gaps; it does not imply all such rows are proven app defects. Mechanical silence uses its successful isolated repeat; its original failed record remains in `full-voice.json`. Optional mocked-only Charge Optimizer and absent loaded-row targets are N/A.

| Page | Feature / button / voice command | Mode | Expected | Result | Evidence |
|---|---|---|---|---|---|
| /dashboard | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3061ms including fixed 1800ms settle; orb count 1 |
| /spectrometer | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 1 rendered table rows; 3972ms including fixed 1800ms settle; orb count 1 |
| /grades | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 5 rendered table rows; 4670ms including fixed 1800ms settle; orb count 1 |
| /raw-material-stock | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 11 rendered table rows; 3898ms including fixed 1800ms settle; orb count 1 |
| /yard-inspection | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 4242ms including fixed 1800ms settle; orb count 1 |
| /premelt-gate | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 1 rendered table rows; 5133ms including fixed 1800ms settle; orb count 1 |
| /supplier-scorecard | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 4992ms including fixed 1800ms settle; orb count 1 |
| /anomaly | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 5041ms including fixed 1800ms settle; orb count 1 |
| /recommendation | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3282ms including fixed 1800ms settle; orb count 1 |
| /rl-optimizer | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3993ms including fixed 1800ms settle; orb count 1 |
| /full-analysis | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3861ms including fixed 1800ms settle; orb count 1 |
| /agent | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 4193ms including fixed 1800ms settle; orb count 1 |
| /energy | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 40 rendered table rows; 4796ms including fixed 1800ms settle; orb count 1 |
| /mechanical-properties | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3855ms including fixed 1800ms settle; orb count 1 |
| /sales | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3366ms including fixed 1800ms settle; orb count 1 |
| /inventory-forecast | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 5 rendered table rows; 3456ms including fixed 1800ms settle; orb count 1 |
| /cost-analysis | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3981ms including fixed 1800ms settle; orb count 1 |
| /synthetic | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3368ms including fixed 1800ms settle; orb count 1 |
| /training-data | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 50 rendered table rows; 3171ms including fixed 1800ms settle; orb count 1 |
| /semantic-search | initial render + local data requests | full | page mounts; no page/API errors | PASS | pages.json; 0 rendered table rows; 3135ms including fixed 1800ms settle; orb count 1 |
| /dashboard | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /dashboard | page control | full | executed | PASS | full-voice.json; executed |
| /dashboard | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /dashboard | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /dashboard | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /dashboard | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /premelt-gate | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /premelt-gate | page control | full | executed | PASS | full-voice.json; executed |
| /premelt-gate | select loaded row | full | selected | PASS | full-voice.json; executed |
| /premelt-gate | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /premelt-gate | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /premelt-gate | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /raw-material-stock | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /raw-material-stock | page control | full | executed | PASS | full-voice.json; executed |
| /raw-material-stock | select loaded row | full | selected | PASS | full-voice.json; executed |
| /raw-material-stock | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /raw-material-stock | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /raw-material-stock | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /yard-inspection | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /yard-inspection | page control | full | executed | PASS | full-voice.json; executed |
| /yard-inspection | select loaded row | full | selected | PASS | full-voice.json; executed |
| /yard-inspection | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /yard-inspection | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /yard-inspection | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /spectrometer | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /spectrometer | page control | full | executed | PASS | full-voice.json; executed |
| /spectrometer | select loaded row | full | selected | PASS | full-voice.json; executed |
| /spectrometer | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /spectrometer | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /spectrometer | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /grades | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /grades | page control | full | executed | PASS | full-voice.json; executed |
| /grades | select loaded row | full | selected | PASS | full-voice.json; executed |
| /grades | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /grades | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /grades | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /supplier-scorecard | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /supplier-scorecard | page control | full | executed | PASS | full-voice.json; executed |
| /supplier-scorecard | select loaded row | full | selected | PASS | full-voice.json; executed |
| /supplier-scorecard | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /supplier-scorecard | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /supplier-scorecard | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /energy | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /energy | page control | full | executed | PASS | full-voice.json; executed |
| /energy | select loaded row | full | selected | PASS | full-voice.json; executed |
| /energy | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /energy | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /energy | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /inventory-forecast | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /inventory-forecast | page control | full | executed | PASS | full-voice.json; executed |
| /inventory-forecast | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /inventory-forecast | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /inventory-forecast | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /inventory-forecast | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /sales | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /sales | page control | full | executed | PASS | full-voice.json; executed |
| /sales | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /sales | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /sales | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /sales | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /cost-analysis | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /cost-analysis | page control | full | executed | PASS | full-voice.json; executed |
| /cost-analysis | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /cost-analysis | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /cost-analysis | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /cost-analysis | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /anomaly | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /anomaly | page control | full | executed | PASS | full-voice.json; executed |
| /anomaly | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /anomaly | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /anomaly | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /anomaly | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /recommendation | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /recommendation | page control | full | executed | PASS | full-voice.json; executed |
| /recommendation | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /recommendation | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /recommendation | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /recommendation | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /rl-optimizer | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /rl-optimizer | page control | full | executed | PASS | full-voice.json; executed |
| /rl-optimizer | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /rl-optimizer | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /rl-optimizer | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /rl-optimizer | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /full-analysis | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /full-analysis | page control | full | executed | PASS | full-voice.json; executed |
| /full-analysis | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /full-analysis | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /full-analysis | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /full-analysis | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /mechanical-properties | ASK | full | answered and audited | PASS | voice-mechanical-isolated.json; executed |
| /mechanical-properties | page control | full | executed | PASS | voice-mechanical-isolated.json; executed |
| /mechanical-properties | select loaded row | full | no loaded rows | N/A | voice-mechanical-isolated.json; no_target |
| /mechanical-properties | RUN voice yes | full | executed; one STT per spoken reply | PASS | voice-mechanical-isolated.json; executed |
| /mechanical-properties | RUN voice no | full | cancelled; one STT per spoken reply | PASS | voice-mechanical-isolated.json; cancelled |
| /mechanical-properties | RUN voice silence | full | timeout; one STT per spoken reply | PASS | voice-mechanical-isolated.json; timeout |
| /agent | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /agent | page control | full | executed | PASS | full-voice.json; executed |
| /agent | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /agent | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /agent | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /agent | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /synthetic | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /synthetic | page control | full | executed | PASS | full-voice.json; executed |
| /synthetic | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /synthetic | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /synthetic | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /synthetic | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /training-data | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /training-data | page control | full | executed | PASS | full-voice.json; executed |
| /training-data | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /training-data | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /training-data | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /training-data | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /semantic-search | ASK | full | answered and audited | PASS | full-voice.json; executed |
| /semantic-search | page control | full | executed | PASS | full-voice.json; executed |
| /semantic-search | select loaded row | full | no loaded rows | N/A | full-voice.json; no_target |
| /semantic-search | RUN voice yes | full | executed; one STT per spoken reply | PASS | full-voice.json; executed |
| /semantic-search | RUN voice no | full | cancelled; one STT per spoken reply | PASS | full-voice.json; cancelled |
| /semantic-search | RUN voice silence | full | timeout; one STT per spoken reply | PASS | full-voice.json; timeout |
| /spectrometer | APPROVE right credential | full | executed | PASS | full-voice.json; executed |
| /spectrometer | APPROVE non-digit retry | full | refused | PASS | full-voice.json; code_not_digits |
| /spectrometer | APPROVE wrong credential then retry | full | executed | PASS | full-voice.json; executed |
| /spectrometer | APPROVE three wrong credentials | full | locked | PASS | full-voice.json; locked |
| /spectrometer | reset approval lock | full | unlocked; zero failures | PASS | full-voice.json; executed |
| /spectrometer | safe request reading | full | executed without yes/no | PASS | full-voice.json; executed |
| /dashboard | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /dashboard | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /dashboard | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /dashboard | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /dashboard | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /dashboard | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /dashboard | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /dashboard | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /dashboard | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /dashboard | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | row control select H-1053 | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | row control தேர்ந்தெடு H-1053 | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | row control चुनो H-1053 | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /premelt-gate | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /premelt-gate | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /premelt-gate | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | row control select PIG-1053 | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | row control தேர்ந்தெடு PIG-1053 | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | row control चुनो PIG-1053 | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /raw-material-stock | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /raw-material-stock | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /raw-material-stock | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | row control select SCR-0912 | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | row control தேர்ந்தெடு SCR-0912 | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | row control चुनो SCR-0912 | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /yard-inspection | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /yard-inspection | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /yard-inspection | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | row control select 4 | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | row control தேர்ந்தெடு 4 | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | row control चुनो 4 | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /spectrometer | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /spectrometer | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /spectrometer | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /grades | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /grades | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /grades | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /grades | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /grades | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /grades | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /grades | row control select SG-IRON | full | executed | PASS | voice-controls.json; executed |
| /grades | row control தேர்ந்தெடு SG-IRON | full | executed | PASS | voice-controls.json; executed |
| /grades | row control चुनो SG-IRON | full | executed | PASS | voice-controls.json; executed |
| /grades | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /grades | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /grades | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /grades | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | row control select Erode Steel Recyclers | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | row control தேர்ந்தெடு Erode Steel Recyclers | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | row control चुनो Erode Steel Recyclers | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /supplier-scorecard | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /supplier-scorecard | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /supplier-scorecard | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /energy | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /energy | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /energy | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /energy | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /energy | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /energy | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /energy | row control select H-1053 | full | executed | PASS | voice-controls.json; executed |
| /energy | row control தேர்ந்தெடு H-1053 | full | executed | PASS | voice-controls.json; executed |
| /energy | row control चुनो H-1053 | full | executed | PASS | voice-controls.json; executed |
| /energy | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /energy | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /energy | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /energy | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | row control select PR-0003 | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | row control தேர்ந்தெடு PR-0003 | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | row control चुनो PR-0003 | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /inventory-forecast | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /inventory-forecast | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /inventory-forecast | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /sales | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /sales | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /sales | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /sales | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /sales | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /sales | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /sales | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /sales | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /sales | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /sales | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /cost-analysis | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /cost-analysis | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /cost-analysis | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /cost-analysis | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /anomaly | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /anomaly | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /anomaly | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /anomaly | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /anomaly | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /anomaly | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /anomaly | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /anomaly | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /anomaly | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /anomaly | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /recommendation | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /recommendation | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /recommendation | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /recommendation | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /recommendation | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /recommendation | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /recommendation | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /recommendation | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /recommendation | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /recommendation | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /rl-optimizer | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /rl-optimizer | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /rl-optimizer | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /rl-optimizer | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /full-analysis | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /full-analysis | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /full-analysis | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /full-analysis | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /mechanical-properties | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /mechanical-properties | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /mechanical-properties | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /mechanical-properties | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /agent | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /agent | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /agent | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /agent | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /agent | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /agent | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /agent | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /agent | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /agent | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /agent | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /synthetic | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /synthetic | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /synthetic | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /synthetic | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /synthetic | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /synthetic | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /synthetic | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /synthetic | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /synthetic | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /synthetic | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /training-data | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /training-data | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /training-data | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /training-data | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /training-data | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /training-data | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /training-data | row control select 76165 | full | executed | PASS | voice-controls.json; executed |
| /training-data | row control தேர்ந்தெடு 76165 | full | executed | PASS | voice-controls.json; executed |
| /training-data | row control चुनो 76165 | full | executed | PASS | voice-controls.json; executed |
| /training-data | row control read this row | full | executed | PASS | voice-controls.json; executed |
| /training-data | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /training-data | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /training-data | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control what can i ask here | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control இங்க என்ன கேக்கலாம் | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control यहाँ क्या पूछ सकते हैं | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control scroll down | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control மேலே நகர்த்து | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | ASK/control नीचे स्क्रॉल करो | full | executed | PASS | voice-controls.json; executed |
| /semantic-search | row controls | full | no loaded rows | N/A | voice-controls.json; no_target |
| /semantic-search | navigate | full | destination opened | PASS | voice-controls.json; nav_matched |
| /semantic-search | go back | full | original page restored | PASS | voice-controls.json; nav_matched |
| /semantic-search | refresh | full | executed and audited | PASS | voice-controls.json; executed |
| /premelt-gate | workflow select H-1054 | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /premelt-gate | workflow run gate check H-1054 | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /premelt-gate | workflow start melting H-1054 | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /full-analysis | workflow run full analysis | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /full-analysis | workflow accept balanced | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /mechanical-properties | workflow predict | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /mechanical-properties | workflow approve tap H-1054 | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /sales | workflow issue invoice H-1054 customer C-001 10 kg at 50 | full | executed with exact reply count | PASS | voice-workflow.json; executed |
| /spectrometer | phrase what is the latest reading | full | executed | PASS | voice-phrases.json; executed |
| /spectrometer | phrase oru reading edu | full | executed | PASS | voice-phrases.json; executed |
| /spectrometer | phrase reading लो | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | phrase H-1053 status enna? | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | phrase start melting H-1053 | full | refused | PASS | voice-phrases.json; backend_refused |
| /dashboard | phrase stock page ku po | full | executed | PASS | voice-phrases.json; nav_matched |
| /dashboard | phrase spectrometer open pannu | full | executed | PASS | voice-phrases.json; nav_matched |
| /dashboard | phrase morning briefing | full | executed | PASS | voice-phrases.json; executed |
| /raw-material-stock | phrase receive truck | full | executed | PASS | voice-phrases.json; executed |
| /raw-material-stock | phrase truck receive करो | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | select disposable HOLD heat | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | disposable HOLD gate check | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | Unit Controller disposable override | full | executed | PASS | voice-phrases.json; executed |
| /premelt-gate | normal H-1053 remains PLANNED HOLD | full | unchanged | PASS | voice-phrases.json; PLANNED |
| /spectrometer | two-second safe action cancel | full | cancelled | PASS | voice-phrases.json; cancelled |
| /voice-log | viewer, chain verification and export | full | valid grouped audit and export | PASS | voice-phrases.json; Chain OK · 71 events |
| /grades | screen create/edit/delete disposable grade | full | actual screen button completes | PASS | buttons.json; Real buttons and backend; created spec visible, edit retained, deleted |
| /raw-material-stock | screen Receive truck form | full | actual screen button completes | PASS | buttons.json; POST /premelt/lots 200 |
| /energy | screen Refresh | full | actual screen button completes | PASS | buttons.json; Button completed without navigation failure |
| /inventory-forecast | screen Refresh | full | actual screen button completes | PASS | buttons.json; Button completed without navigation failure |
| /sales | screen Refresh | full | actual screen button completes | PASS | buttons.json; Button completed without navigation failure |
| /raw-material-stock | screen Refresh | full | actual screen button completes | PASS | buttons.json; Button completed without navigation failure |
| /cost-analysis | screen Save Prices | full | actual screen button completes | PASS | buttons.json; PATCH /api/v2/cost/prices 200 |
| /yard-inspection | screen gun connect/replace/disconnect | full | actual screen button completes | PASS | buttons.json; Actual gun OPC simulator controls |
| /premelt-gate | screen H-1053 check/refusal | full | actual screen button completes | PASS | buttons.json; Gate HOLD; quarantine/Cu checked by real backend |
| backend | service health | full | real backend response and preserved guards | PASS | api-checks-repeated.json; GET /api/v1/health: 200, 16.0 ms; {'status': 'success', 'message': 'Server is running!', 'timestamp': '2026-11-12T10:46:44.822Z'} |
| ai | service health | full | real backend response and preserved guards | PASS | api-checks-repeated.json; GET /health: 200, 94.0 ms; {'status': 'healthy', 'message': 'All models loaded', 'models_loaded': {'anomaly_model': True, 'alloy_model': True}} |
| agent | service health | full | real backend response and preserved guards | PASS | api-checks-repeated.json; GET /health: 200, 16.0 ms; {'status': 'healthy', 'message': 'All models loaded', 'models_loaded': {'anomaly_model': True, 'alloy_model': True, 'agent_manager': True, 'copilot': True, 'voi |
| /premelt-gate | H-1053 real HOLD gate | full | real backend response and preserved guards | PASS | api-checks-repeated.json; 200; decision=HOLD; 375.0 ms |
| /premelt-gate | H-1053 start refused | full | real backend response and preserved guards | PASS | api-checks-repeated.json; POST /api/v2/premelt/heats/H-1053/start-melting: 423, 0.0 ms; {'status': 'fail', 'message': 'Furnace start is locked by the pre-melt gate', 'blocking': ['Cannot be charged: PIG-1053 (see details)', 'Residual elements over  |
| /premelt-gate | planned tap bypass refused | full | real backend response and preserved guards | PASS | api-checks-repeated.json; POST /api/v2/sales/heats/H-1052/complete: 409, 0.0 ms; {'status': 'fail', 'message': 'Heat H-1052 is planned — start melting it on the Pre-Melt Gate first'} |
| /raw-material-stock | real DRI QA entry/approval API | full | real backend response and preserved guards | PASS | api-checks-repeated.json; Lot DRI-0923, QA QA-00025; approve 200: {'status': 'success', 'data': {'qa': {'qaId': 'QA-00025', 'lotId': 'DRI-0923', 'version': 1, 'sampleId': 'S-DRI-0923-1', 'sampledA |
| /spectrometer | manual reading create API | full | real backend response and preserved guards | PASS | api-checks-repeated.json; POST /api/v1/spectrometer: 201, 15.0 ms; {'status': 'success', 'data': {'data': {'_id': '5', 'composition': {'Fe': 92, 'C': 3.5, 'Si': 2.3, 'Mn': 0.6, 'P': 0.03, 'S': 0.01}, 'metalGrade': 'SG-IRON', 'c |
| /rl-optimizer | real initialized policy status | full | real backend response and preserved guards | PASS | api-checks-repeated.json; GET /api/v2/rl/policy/status: 200, 0.0 ms; {'status': 'success', 'data': {'fitted': True, 'n_updates': 60056, 'known_grades': ['SG-IRON', 'GREY-IRON', 'LOW-CARBON-STEEL', 'MEDIUM-CARBON-STEEL', 'HIGH-CAR |
| /semantic-search | optional vector status | full | real backend response and preserved guards | PASS | api-checks-repeated.json; GET /api/v2/vector/status: 200, 32.0 ms; {'backend': 'Local in-memory fallback (Actian VectorAI DB not connected)', 'using_real_vectorai': False, 'grade_specs_indexed': 0, 'memories_stored': 0} |
| /premelt-gate | removed handover endpoint | full | real backend response and preserved guards | PASS | api-checks-repeated.json; POST /copilot/handover: 404, 15.0 ms; {'detail': 'Not Found'} |
| /inventory-forecast | real PR create/approve/reject API | full | create and independently approve/reject | PASS | Successful isolated API check: [200,200,200,200]; original exec output retained. Repeated run correctly refused duplicate open item. |
| /charge-optimizer | normal-mode availability | full | respect existing mock-only route condition | N/A | App.jsx only registers this 21st metadata route in mock mode. 20 routes are available in normal dev. |
| /spectrometer | real generated wake + latest reading activation | full | wake=true | FAIL | Real /stt/v3 HTTP 200; snippet transcript 'What is the?'; unchanged rule returned wake=false |
| /spectrometer | real Prisma transcription: latest | full | production Agent transcription endpoint returns transcript | PASS | ASGI TestClient endpoint + actual provider, not physical mic: Girl, what is the latest reading? |
| /premelt-gate | real Prisma transcription: Tamil question | full | production Agent transcription endpoint returns transcript | PASS | ASGI TestClient endpoint + actual provider, not physical mic: ஆயிரத்தி ஐம்பத்து மூன்று நிலை என்ன? |
| /premelt-gate | real Prisma transcription: HOLD refusal | full | production Agent transcription endpoint returns transcript | PASS | ASGI TestClient endpoint + actual provider, not physical mic: Start melting H-1053. |
| /voice | real Timbre generated reply | full | provider returns bytes | PASS | HTTP 200; 183500 bytes; no audible validation or retained duration |
| /agent | real Groq explanation provider | full | one chat reply returns | PASS | One SDK request, retries disabled. Provider-level smoke only; not browser chat submission or correctness approval. |
| /voice | saved real transcripts through full-mode UI | full | replay exact three provider transcripts | FAIL | Not executed: automatic approval review could not refresh its access token after account/session change. No bypass or retry. |
| /rl-optimizer | independent RL-page screen acceptance/explain buttons | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /anomaly | standalone screen analyze/explain buttons | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /recommendation | standalone screen generate/explain buttons | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /agent | screen agent-analysis/explain/chat submission | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /synthetic | screen synthetic generation/deviation controls | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /yard-inspection | complete per-piece yard inspection capture/ingest | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /raw-material-stock | screen DRI QA/reject and alloy receiving dialogs | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /inventory-forecast | screen PR create/approve/reject dialogs | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /training-data | screen create/edit/delete training sample dialogs | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /supplier-scorecard | screen AHP/criteria weights and every ranking/filter control | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /energy | screen simulated meter action | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /sales | separate pointer-driven invoice dialog | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /voice | full-mode next/previous rows and every portal tab | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |
| /voice | systematic narrow-layout/orb collision and mic CPU/rerender profiling | full | explicit full-mode exercise | FAIL | Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure. |

## All remaining FAILs

- **/spectrometer · real generated wake + latest reading activation:** Real /stt/v3 HTTP 200; snippet transcript 'What is the?'; unchanged rule returned wake=false
- **/voice · saved real transcripts through full-mode UI:** Not executed: automatic approval review could not refresh its access token after account/session change. No bypass or retry.
- **/rl-optimizer · independent RL-page screen acceptance/explain buttons:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/anomaly · standalone screen analyze/explain buttons:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/recommendation · standalone screen generate/explain buttons:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/agent · screen agent-analysis/explain/chat submission:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/synthetic · screen synthetic generation/deviation controls:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/yard-inspection · complete per-piece yard inspection capture/ingest:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/raw-material-stock · screen DRI QA/reject and alloy receiving dialogs:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/inventory-forecast · screen PR create/approve/reject dialogs:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/training-data · screen create/edit/delete training sample dialogs:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/supplier-scorecard · screen AHP/criteria weights and every ranking/filter control:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/energy · screen simulated meter action:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/sales · separate pointer-driven invoice dialog:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/voice · full-mode next/previous rows and every portal tab:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.
- **/voice · systematic narrow-layout/orb collision and mic CPU/rerender profiling:** Coverage gap, not a demonstrated application defect. Existing mocked regressions/shared workflow do not prove this screen path. Remaining browser work blocked by approval-service authentication failure.

## Files and restart

Restart backend, Agent and frontend to load code changes; the AI process can use its existing installation. Follow the unchanged four-terminal order in `docs/TORUN.md`: `npm start` in Backend; `venv\Scripts\python.exe app\main.py` in AI; `.venv\Scripts\python.exe app\main.py` in Agent; `npm run dev -- --configLoader runner` in Frontend. Existing feature flags/defaults, privacy and roles stay unchanged; no handover flag is needed. Do not use the symbolic test Agent for ordinary use.

Reproducible isolated tools: `tools/stage4_test_agent.py` requires the explicit test-process guard and always supplies temporary credentials/data; frontend `tests/full-app-check.mjs` and `tests/full-phrases-check.mjs` accept configured localhost URLs. `tests/full-provider-replay.mjs` is prepared but **unrun** because approval authentication failed. `tools/stage4_real_smoke.py` is default-off, refuses an existing evidence directory and must not be rerun to tune this failed wake.

Files changed/added (deletions above, existing `.claude/` excluded):
- `MetalliSense_Agent_R/MetalliSense_Agent/.env.example`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_batch.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/voice_foundation.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/main.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/rl/constraints.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_gnani_batch.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_provider_calls.py`
- `MetalliSense_Backend_Simple/csvDataStore.js`
- `MetalliSense_Backend_Simple/gradeSpecStore.js`
- `MetalliSense_Backend_Simple/opcua-server/opcuaServer.js`
- `MetalliSense_Backend_Simple/opcuaClient.js`
- `MetalliSense_Backend_Simple/premeltGate/store.js`
- `MetalliSense_Backend_Simple/server.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/.env.example`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/common/Input.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/layout/MainLayout.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/voice/ShiftHandover.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/fixtures/handover-sample.json`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/mock/copilotTransport.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/pages/PreMeltGate.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/pages/Spectrometer.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/pages/SupplierScorecard.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/handover.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/mechanicalService.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceClarity.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceTour.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/approved-tour-audio.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/f11d-formal-baseline.json`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/fixtures/voice-everywhere.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/handover.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/mock-unit.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/tour-voice-commands.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/voice-clarity.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/voice-everywhere.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/voice-register.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/voice-tour.test.jsx`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/vite.config.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/vitest.config.js`
- `README.md`
- `docs/TORUN.md`
- `MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/audio_validation.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_audio_validation.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tests/test_rl_inventory_constraints.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tools/stage4_real_smoke.py`
- `MetalliSense_Agent_R/MetalliSense_Agent/tools/stage4_test_agent.py`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/full-app-check.mjs`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/full-mode-data.test.js`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/full-phrases-check.mjs`
- `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/full-provider-replay.mjs`

## Protection and cleanup

All **22 source WAVs** match the pre-change hashes; all **22 built WAVs** match approved sources. Derived grade snapshots match exactly. Existing staging and user files were preserved. Test-generated tracked screenshot changes were copied into ignored evidence and restored byte-for-byte from read-only HEAD output; historical reports were not regenerated.

Windows kill-on-close Job Objects tracked every launched service/test/browser tree. Ledger: **60 owned root jobs, all closed, zero open**. All four service roots were also checked absent after shutdown; temporary Agent DATA_DIRs were cleaned. No stale owned Vite server, browser or provider request remains. No process from nordic-company-lens or outside this repository was stopped. Both diff checks and final Python compilation are recorded in `final-static-checks.txt`.

Not done: exhaustive per-button/form combinations, systematic full-mode responsive overlap/CPU profiling, physical microphone/audible playback, and saved real-transcript browser replay. The table explicitly marks these gaps. The generated wake missed; no hands-free reliability or end-to-end real wake success is claimed. Nothing was staged, committed or pushed.
