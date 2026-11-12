# Stage 2 — forms, noise and card labels

2026-11-12. Builders: Manish (capture/diagnostics), Nethra (matching). No commit or push. Generated TEST speech only; no production writes, training or model changes.

## Receiving form

Three complete generated-speech runs passed through the actual mock frontend and isolated real-Gnani Agent: `receive truck`, `receive lot`, `receive the truck`. Each collected material and quantity, spoke the read-back, checked a temporary TEST Supervisor credential and completed the existing five-second cancellation path through the normal receiving service. Stock row counts increased 15→16→17→18. Each received PIG_IRON, 4000 kg. Maximum microphone owners: one.

These are **3/3 push-to-talk form runs**, not three proven hands-free runs. Two earlier hands-free attempts did not reach the form; the wake response bodies were not retained, so their precise cause remains unresolved. Browser automation activated controls programmatically because the animated/off-screen menu interfered with pointer targeting. This does not prove physical clickability. Audio was generated, not a physical microphone recording; the fixture supplied WAV at the recorder boundary rather than exercising Chrome's real WebM encoding.

Confirmed repairs:

- Prisma returned `Received truck.`: recognize that exact command variant, plus `receive the truck` and `truck vandhuduchu`, without matching informational questions as actions.
- Material replies included `Pick iron.` and terminal punctuation: scope this observed correction to material type; keep retrying unrecognized values rather than guessing arbitrary materials.
- `Four tons` previously failed quantity parsing: convert metric tonnes to kilograms only for mass fields; retain kilograms, decimals and Indian grouping; reject unsupported `US tons`.
- Form capture previously used 0.8-second silence: allow 1.5 seconds for field replies, retaining the existing overall limit and microphone cleanup. Passcodes and other capture policies remain unchanged.
- Explicit field-capture locale follows the selected language. Existing localized field prompts remain in use.
- Preserve supplier capitalization/punctuation through both the outer action router and leaf form parser. A final regression covers `Kovai Pig Iron Co.`; this specific supplier was not independently verified by real STT.

One failed early test-harness retry incorrectly queued the temporary TEST approval audio as a material answer. Its transcript entered a diagnostic file/output. The queue was stopped, diagnostic files were redacted, private audio was removed with the temporary Agent directory, and fixture routing now permits approval audio only at the private-capture boundary. No real user credential was involved. Tests cover public transcript filtering and private fixture selection; no digits are reproduced here.

## Synthetic noise

See [NOISE_TEST.md](NOISE_TEST.md) for frozen method and evidence paths. Existing generated Tamil wake speech and five locally generated command clips were mixed with 50/100 Hz hum, broadband fan and intermittent metallic clanks. Existing recordings were not modified.

| Condition | Wake recognized | Command routing after exact alias repair | Nonwake command false wakes |
|---|---:|---:|---:|
| Clean | 1/1 | 5/5 | 0/5 |
| 20 dB | 1/1 | 5/5 | 0/5 |
| 10 dB | 0/1 | 5/5 | 0/5 |
| 5 dB | 0/1 | 5/5 | 0/5 |

Noise alone produced no wake in three three-second cases. One was rejected locally; two returned empty transcripts. These nine seconds cannot establish a false-activation rate. At 10/5 dB the local onset moved to noise at clip start, changing the fixed snippet; this is evidence of noise sensitivity, not proof of its sole cause. The pause gate and wake rule were not loosened or changed.

`gate check H-1051` was transcribed correctly but routed to heat status without `run`. An exact command alias fixes that collision; replay of the same saved transcripts changes command routing from 4/5 to 5/5 at each condition, without another provider call. Question forms retain their previous intent.

## Card labels

Action-card body labels, confirmation controls, countdown and results now use English/Tamil/Hindi display dictionaries. Reply-language metadata selects the displayed language. IDs, facts, spoken text, passcode authorization, audit decisions and callbacks are unchanged.

The approved English-only orb status block is deliberately retained, including `LISTENING / Go ahead…`, `UNDERSTANDING / One moment…` and `SPEAKING / Here's the answer`. This follows the explicit F15 design decision rather than changing it in this task.

Fourteen clearly **MOCKED** screenshots cover confirmation, completed/cancelled/countdown in three languages and Tamil/Hindi narrow views: [review index](screenshots/stage2-labels/index.html). They are not physical microphone or audible listening verification.

## Calls and preservation

Recorded successful provider HTTP responses: **95 total = 22 Timbre + 73 Prisma**. This includes preliminary failed/partial form diagnostics, not only the final successful trials. Form diagnostics account for 49 responses; noise diagnostics 46. Calls were sequential with shared lease, isolated temporary DATA_DIR and bounded backoff. Local SAPI generation made no cloud calls. Test Agent processes were stopped and their temporary data removed.

No production environment/audit/audio files were edited or printed. No role, lock, HOLD safety, flag default, timeout ceiling, tour narration or approved audio change. H-1053 remains HOLD. No dependencies installed. All 22 source and 22 built approved tour WAV hashes matched their approved manifest. Existing staging and unrelated `.claude/` were preserved.

## Verification

| Gate | Frontend | Build | Mocked Agent pytest |
|---|---|---|---|
| Part 1 | 2660 passed, 47 files, 281.57s | passed, 14.05s | 478 passed, 73.81s |
| Part 2 | 2662 passed, 47 files, 253.07s | passed, 13.47s | 480 passed, 76.29s |
| Part 3 | 2672 passed, 48 files, 261.84s | passed, 13.45s | 480 passed, 71.01s |

The six historical Agent baseline failures did not reproduce in these runs. Agent runs reported 14 warnings. `real-page-controls.test.jsx` passed in each full run; no isolation retry was required. No timeout/assertion was weakened. Build retains its existing large-chunk warning. Both staged and unstaged diff checks passed (line-ending/access warnings only).

Final gate after supplier-router preservation: **2640 passed, 1 timed out, 32 skipped**, 48 files, 556.52s. `real-page-controls.test.jsx` timed out in its 30-second startup hook (and 10-second cleanup in the full run); `voice-everywhere.test.jsx` timed out in its 90-second Chromium scenario. The new supplier regression passed. Build passed in **14.30s**. Agent pytest: **480 passed, 14 warnings, 140.22s**.

Isolation preserved all original assertions/timeouts and npm test's existing single-worker setting. `voice-everywhere`: **225 passed in 54.79s**. `real-page-controls` initially repeated its startup timeout. A separate startup diagnostic then confirmed the actual mock app rendered successfully after Vite dependency re-optimization; the only failed request was the deliberately blocked external Google Fonts stylesheet, with no captured JavaScript error. The unchanged test rerun passed **32/32 in 41.74s**. This supports a startup/load sensitivity; it does not turn the failed full run into a clean pass. No broad automatic rerun loop or timeout increase was applied. The first isolation command accidentally duplicated `--maxWorkers`; Vitest rejected its CLI before running tests. The command was corrected; test files were not changed.

All 22 source plus 22 production-built approved WAV hashes match. Both diff checks pass. Prior generated contact-sheet files altered by regression runs were restored only from their exact pre-task backups; production edits and existing staging were preserved. Logs and diagnostic evidence remain in ignored `.overnight_backup/v23-stage2/` and `tools/local_wake_data/stage2-noise-364a9d9a8888460d9ec2feaadeee8182/`.

## Files and tests

Frontend implementation: `voiceFormActions.js`, `voiceActionLanguages.js`, `voiceActionRegistry.js`, `runReplyCapture.js`, `voiceActions.js`, `voiceFormContent.js`; components `VoiceActionPanel.jsx`, `KuralWakePanel.jsx`, `PushToTalk.jsx`.

Regression changes: `tests/f17b-forms.test.js`, `tests/round2-voice.test.js`, `tests/voice-action-capture.test.js`; new `tests/stage2-labels.test.jsx`, `tests/stage2-fixtures.mjs`, `tests/stage2-form-live.mjs`, `tests/fixtures/stage2-labels.html/.jsx`; `vitest.config.js` registers the new test.

Agent tools: `tools/stage2_test_agent.py`, `tools/stage2_noise_diagnostic.py`; new mocked/dry-run `tests/test_stage2_noise.py`. Documentation: this report, `NOISE_TEST.md`, labelled screenshot review files. No model/runtime dependencies added.

Remaining human checks: real microphone hands-free form initiation, natural supplier/material speech, physical menu/PTT targeting, native-language prompt readability/audibility and representative real foundry noise. Synthetic generated speech and mock receiving success do not establish production robustness.
