# Stage 1 — core voice fixes

2026-11-12. Branch `v23-improvements`. No Git write commands, staging, commit or push. No changes to environment files, production audit/audio stores, roles, lock rules, HOLD decisions, flag defaults or approved narration. Real requests below used only generated TEST speech and a temporary process-local DATA_DIR. No real passcode, generated TEST code, private audio or private transcript is retained in the diagnostic evidence.

## Outcome

| Part | Before / after | Gate outcome |
|---|---|---|
| Spoken passcode | Same ten real production-private-path transcripts: old normalizer 10/10; repaired normalizer 10/10. Separate synthetic regressions demonstrate previously rejected `oh` and grouped number-word forms | **Generated-speech gate PASS: 10/10**, exceeding 8/10. The original human live failure was not reproduced, so this is not proof that B8 is resolved |
| Wake | Unchanged rule: 8/12 matrix wakes; 1/10 confusable false wake; 0/5 conversation false wakes. No after-rule result because no rule was changed | **FAIL**. Existing rule retained; no aliases or qualification claim added |
| Tanglish | Same five real provider transcripts replayed through pre-edit and final source: 2/5 → 4/5 correct routes. Every requested typed phrase passes its regression | Five real round-trips completed; **one live transcription/navigation miss remains** |

Read first: ROUND2_FIX_REPORT.md and F17_VOICE_ACTIONS.md. `DOCS/DEMO_VIDEO_REPORT.md` is absent in this checkout (searched by exact filename); B8 evidence is the user's supplied two code_not_digits refusals and an incomplete third attempt. Protected audit/audio stores were not opened to reconstruct it. No invented private transcript or human before-rate is reported.

## Part 1 — private speech

### Confirmed code defects and repair

- `src/services/runReplyCapture.js:9`: non-RUN captures previously ended after 12,800 quiet samples (0.8s). That can finish a digit reply before the next slowly spoken digit. **Passcode only** now waits 24,000 quiet samples (1.5s); RUN remains 11,200 and other reply captures remain 12,800. The total private deadline stays **12s**, measured from ready audio. No role, wrong-code counter or timeout was weakened. A mock-frame regression verifies six spoken groups separated by one-second gaps stay in one private STT request and release the microphone.
- `app/copilot/voice_auth.py:14–36`: `oh` had no zero alias; multiword tens/groups could be summed instead of preserving a six-digit sequence. Normalize complete tens+unit pairs, then preserve explicit sequential groups. Existing English/Tamil/Hindi digit words, native digits and double/triple remain supported. Unknown words and non-six-digit results still reject; nothing is padded or guessed. Existing malformed/no-strike, wrong-role, three-actual-wrong-code lock and backend safety tests pass.
- `app/copilot/gnani_client.py:237–247`: an explicit output_format other than codemix was ignored in favor of the global default. Explicit values now validate against the existing supported set and are honored. Production private capture still asks for codemix; no production locale or format was changed because the real comparison did not justify it. Normal calls without an override retain their previous format.

These are demonstrated failure conditions, not a recovered causal explanation of the missing B8 private audio. The provider did recognize all generated private trials. Physical browser capture, room noise and a user's cadence still need a human check.

### Real trials and privacy

Generated TEST code exists in process memory only. Timbre requests used the existing configured model/voice and documented WAV fields, without cache/fallback. Windows SAPI writes to MemoryStream, not a file; its audio is converted in memory to mono PCM16/16kHz. Real private calls use **the actual private_transcription function**, its strict WAV validation and its existing client, not approval authorization. No PR was approved and no actual identity was used. This exercises the private service path; it is not a physical browser-capture measurement.

Three preliminary trials succeeded but are excluded from the gate. The final gate contains three Timbre and seven Windows SAPI private trials (codemix). Four additional format controls use the same STT transport with transcribe/verbatim. Each response is compared in memory to the TEST code, then discarded. Only locale, format, codemix presence, duration, token count/type and correctness survive. Numeric tokens and word tokens both occurred; no token content survives.

| Trial | Voice | Locale hint | Format | Duration s | Token count | Token types | Before / after correct |
|---|---|---|---|---:|---:|---|---|
| 1 | Timbre | en-IN | codemix | 2.480 | 1 | word | True / True |
| 2 | Timbre | ta-IN,en-IN | codemix | 2.480 | 6 | word | True / True |
| 3 | Timbre | hi-IN | codemix | 2.480 | 6 | word | True / True |
| 4 | Windows SAPI | en-IN | codemix | 6.454 | 1 | numeric | True / True |
| 5 | Windows SAPI | ta-IN,en-IN | codemix | 6.454 | 6 | word | True / True |
| 6 | Windows SAPI | hi-IN | codemix | 6.454 | 6 | word | True / True |
| 7 | Windows SAPI | en-IN | codemix | 6.589 | 6 | word | True / True |
| 8 | Windows SAPI | ta-IN,en-IN | codemix | 6.589 | 6 | word | True / True |
| 9 | Windows SAPI | hi-IN | codemix | 6.589 | 6 | word | True / True |
| 10 | Windows SAPI | ta-IN,en-IN | codemix | 6.589 | 6 | word | True / True |

All ten have codemix=true. Four format controls (two voices × transcribe/verbatim, en-IN) also recognized correctly; transcribe returned a single number-like token in the SAPI control, while verbatim returned word sequences. Timbre gate speech was about 2.48s; slower paused SAPI speech about 6.45–6.59s. Native Tamil/Hindi digit-word and double/triple behavior is covered by the existing mocked foundation tests and the new normalization case, not falsely counted as separate real native-speaker trials. Literal-numeral TTS input was not separately compared; this run compared spoken digit-word audio and numeral/word transcript output.

The first sandbox Timbre attempt raised **ConnectionError**, endpoint `https://api.vachana.ai/api/v1/tts/inference`; no Prisma call occurred. Authorized unsandboxed calls worked. An initial SAPI control hit local strict WAV validation (native sample rate), not a provider/network failure; it was resampled in memory and validation was not relaxed. An intermediate nonprivate wake-review console print hit Windows code-page encoding after its UTF-8 JSON had already been saved; output was fixed without rerunning those calls.

After the user's retry instruction, diagnostic transport uses at most three attempts, 30s between failed attempts, no parallel requests and no production timeout changes. A zero-network injected-failure check verified exactly three calls/two backoffs and a sanitized exception class+endpoint. No post-unblock provider failure required an actual backoff. Production private STT still has max_attempts=1; the optional diagnostic wrapper implements the explicitly authorized retry budget outside application policy.

## Part 2 — unchanged wake rule, failed new screen

Evidence: `tools/local_wake_data/v23-wake-7e88f9918edf4131abdca6a9dff9577d/` (ignored). `generation.json` was written before inference; evaluator plan, individual snippet WAVs, hashes, CSV and totals are separate. It uses `tools/wake_eval_folder.py` and the actual WakeChecker, not a replacement detector. Sequential pacing adds 4.2s between checks, retaining one in flight, 1.1s completion spacing and 15/minute checks.

Matrix: configured Timbre voice saying Tamil “குரல்” at requested public speed .85/1/1.15; Windows SAPI saying “Kural” at rate -2/0/+2; each duplicated with/without exactly 0.5s leading silence. These are requested speed settings, not acoustically matched speaking rates, and voice/script pronunciation are confounded. Ten SAPI confusables: coral, curl, cooler, rural, control, cruel, neural, canal, cuddle, coal. Five SAPI wake-free conversational sentences. No human recording or old validation set was imported.

| Group | Wake-positive results |
|---|---|
| Timbre slow/default/fast, no lead / lead | 6/6 |
| SAPI default, no lead / lead | 2/2 |
| SAPI slow and fast, no lead / lead | 0/4 |
| All matrix wakes | **8/12** |
| Fixed first ten sorted wake files, declared before calls | **6/10** |
| Confusables | **1/10 false wake** (coral) |
| Conversations | **0/5 false wakes** |

All 27 files had exactly one qualifying onset. Every snippet is 1.5s, with tail padding where needed. The timing audit shows no source energy above the existing gate after the snippet endpoint, and the four missed source clips fit within the available window. This does not infer human word boundaries, but it supplies no evidence that truncation or the leading-silence gate caused these misses.

Five separate unchanged-checker sentinel calls inspected the four misses and coral, without revising the screen decision:

| Generated source | Saved Prisma transcript | Existing first-word decision |
|---|---|---|
| Slow SAPI, both lead conditions | கரு. | not wake |
| Fast SAPI, both lead conditions | True. | not wake |
| coral confusable | குரல். | wake |

The rule correctly implements its exact first-word predicate; the acoustic transcription is not reliably word-specific on this set. Adding kooral/kurral/Kurall aliases cannot fix a confusable already transcribed as the existing accepted Tamil word. **No variants, thresholds, pause constants, snippets, models or wake semantics changed.** Before and after rates are identical. The ≥9/10 + zero-negative gate fails. CSV latency includes diagnostic pacing; it is not end-to-end activation latency or recognition accuracy. Short generated conversations do not establish a long-term false-activation rate.

## Part 3 — Tanglish

- `voiceActionLanguages.js`: add explicit reading kudu / oru reading edu and observed oru reading ediu aliases; add observed mixed-script gate check பண்ணு; punctuation cleanup treats commas as separators while preserving digit grouping.
- `voiceIntents.js`: normalize nilai to status and a spoken four-plus-digit status ID cue to the existing heat-status parse. This is ASK only, not authority to start an arbitrary heat.
- `languageBridge.js`: recognize nilai/kudu/edu as Tamil/Tanglish cues inside existing language-choice behavior; flag-off/current-language rules remain intact.
- Existing gate check pannu / target-before melting start pannu / spectrometer ku po paths are retained and regression-tested, not replaced with an alternate executor.

The tests cover every requested typed phrase, request-reading versus latest-reading ASK, Tamil reply choice, specified heat preservation, mixed-script observations, and explicit H-1053 HOLD refusal. No action is executed while replaying real STT transcripts.

Five generated Timbre→Prisma round-trips (language hint ta-IN,en-IN, codemix) used new isolated data. Saved output: `tools/local_wake_data/v23-tanglish-536114d2c35141f09b5b3f24f42e2c84/transcripts.json`. Same saved outputs replayed through original-source snapshots and final actual matchers:

| Intended prompt | Real Prisma transcript | Before route | Final route | Final reply language |
|---|---|---|---|---|
| H-1053 status enna? | ஆயிரத்தி ஐம்பத்து மூன்று status என்ன? | heat_status | heat_status | ta |
| latest reading enna | latest reading என்ன? | spectrometer_heat_reading | spectrometer_heat_reading | ta |
| oru reading edu | Oru reading ediu. | spectrometer_heat_reading | request_reading | ta |
| gate check pannu H-1051 | gate check பண்ணு, ஆயிரத்தி ஐம்பத்தொன்று. | ask_copilot | gate_check | ta |
| spectrometer ku po | Spectrometer coupon. | spectrometer_heat_reading | spectrometer_heat_reading | ta |

Correct intended routes: **2/5 → 4/5**. One remaining miss is `Spectrometer coupon.`; it has no navigation verb and stays a read-only reading intent rather than navigating. No “coupon” alias is invented. All five choose Tamil. Action matches use the current loaded page/selected target; no missing H prefix is used as permission to mutate a guessed heat. Human checks must confirm STT retains the intended ID as well as matching the verb.

## Full verification after each part

All runs use `npm.cmd test`, then `npm.cmd run build`, then `.venv/Scripts/python.exe -m pytest`, sequentially. Test Agent DATA_DIR is a new temporary directory, with GNANI_MOCK/EVON_MOCK true. Real diagnostics run separately and never overlap one another on the key.

| Part | Full frontend | Production build | Full Agent |
|---|---|---|---|
| part1 | 2631 passed / 47 files, 285.89s | PASS, 23.40s | 478 passed, 14 warnings, 78.83s |
| part2 | 2631 passed / 47 files, 216.77s | PASS, 14.70s | 478 passed, 14 warnings, 68.58s |
| part3 | 2644 passed / 47 files, 246.30s | PASS, 16.83s | 478 passed, 14 warnings, 56.03s |

`tests/real-page-controls.test.jsx` passed **32/32 in isolation**, 32.88s, with original timeouts; it also passed each full run here. No timeout/assertion was changed. Existing Node deprecation and bundle-size advisories remain. No test failure was suppressed.

New coverage: one paused-private-capture frontend case; one backend normalization case with English/Tamil/Hindi forms; thirteen Tanglish and observed-transcript frontend cases in the existing Round 2 suite. A separate local saved-output replay is ignored diagnostic evidence, not a new test depending on unavailable recordings. An intermediate focused failure caught the new latest-reading test missing its required existing feature flags; the new test setup was corrected, not the production flags. Earlier focused normalization failure exposed missing oh, which was fixed. Final full runs pass.

### Six documented baseline failures — not reproduced here

Listed separately as requested, from ROUND2_FIX_REPORT.md:

1. test_f14_mechanical_revision.py::RevisionTests::test_only_mechanical_text_and_fingerprint_change — historically missing audition manifest.
2. test_f14_tamil_audition.py::BatchTests::test_actual_stock_provenance — historically missing recovery manifest.
3. test_kural_paired_v2_experiment.py::PairedExperimentTests::test_dev_matching_has_no_grace_and_thresholds_fixed — historically missing experiment configuration.
4. test_kural_paired_v2_experiment.py::PairedExperimentTests::test_evaluation_sessions_excluded_from_fitting_groups — same historical artifact issue.
5. test_kural_paired_v2_experiment.py::PairedExperimentTests::test_original_sampler_parity_and_added_record_rotation — same historical artifact issue.
6. test_kural_training.py::PipelineTests::test_isolated_setup_wrong_prefix_never_installs_and_failed_pip_no_retry — historical Python 3.12 versus pinned 3.11 ordering.

**Current full result is 478 passed, zero failed**, not “478 plus six failures.” The intended interpreter here is Python 3.11, and the formerly missing-artifact cases passed without creating/fabricating their fixtures or changing those tests.

## Files and evidence

Application changes:
- Agent app/copilot/voice_auth.py, gnani_client.py.
- Frontend src/services/runReplyCapture.js, voiceActionLanguages.js, voiceIntents.js, languageBridge.js.

Tests:
- Agent tests/test_stage1_private.py (new).
- Frontend tests/voice-action-capture.test.js, tests/round2-voice.test.js.

Backend-only optional diagnosis tools (new): tools/stage1_private_diagnostic.py, stage1_wake_diagnostic.py, stage1_wake_review.py, stage1_tanglish_diagnostic.py. Windows SAPI/audio conversion helpers use the existing Python 3.11 audioop module; no dependency was installed. They are developer tools, not app-integrated behaviors. Never use actual credentials as speech inputs. Running a tool may consume credits; this report does not authorize an automatic rerun.

DOCS/STAGE1_REPORT.md is new. No new application flag or default was introduced; private reply and action changes remain within existing opt-in voice/action paths. Approved tour text/audio, wake-rule source and thresholds were not edited.

Ignored evidence: `.overnight_backup/v23-stage1/part{1,2,3}/{frontend,build,agent}.log`, gate.json, sanitized private metadata JSONs, before/after routing JSONs, and source backups. Public generated wake/Tanglish WAVs and results remain in ignored local_wake_data; none are training imports. Private generated audio/transcripts were never written there. Git-ignore verification passes for new generated evidence.

Request accounting: **10 successful Timbre synthesis requests + 54 successful Prisma STT requests** (17 private diagnosis/control including three preliminary; 27 fixed wake screen; five wake sentinels; five Tanglish). One earlier sandbox TTS connection attempt did not reach a successful response. The initial invalid-rate SAPI attempt stopped locally before Prisma. There were no parallel provider calls, no fallback model or unbounded retries. The private ten-trial gate is the explicitly identified subset above, not all 17 controls presented as independent people.

All **22 source + 22 built approved tour WAVs match the approved SHA-256 manifest** after the final build. Evidence: `.overnight_backup/v23-stage1/audio-verification.json`. No approved clip was regenerated. Models/training sources and global language routing were not changed. Both staged and unstaged diff checks pass (existing line-ending/ignore-access warnings only). No Git write command was used.

Initial working tree already had changes to DOCS/screenshots/f17b/frames/approve-passcode.png and review.json, plus untracked .claude/. Browser tests regenerate those derived screenshot artifacts; these paths remain separately dirty and are not described as application edits or restored from HEAD. Unrelated .claude files were not opened or edited. Existing staging was not changed.

## Remaining human checks and limitations

1. In a disposable local pending-PR demo, test actual Manager private capture with natural cadence and with approximately one-second digit gaps (within the unchanged 12s window). Verify one request, no premature refusal, no private audio/log retention, then verify wrong-role and three actual wrong-code behavior. The generated service-path PASS does not establish human microphone reliability or prove the original B8 cause.
2. Wake remains experimental with measured false activation on coral. No safe alias fix passed; keep the old rule and PTT fallback. Do not describe the new wake screen as PASS or qualified hands-free detection.
3. Say spectrometer ku po on the real microphone and inspect whether STT preserves po. The generated “coupon” miss remains; no further tuning/automatic repeat run was launched.
4. Literal-numeral TTS input and true human Tamil/Hindi private speech were not separately auditioned; current real trials cover generated English digit-word speech across three locale hints plus numeric/word transcript outputs. No real plant action, human listening approval or untouched-test reliability claim is made.

No commit or push.
