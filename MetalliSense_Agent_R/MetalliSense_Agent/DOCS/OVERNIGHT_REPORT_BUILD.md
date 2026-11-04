# Overnight build report

2026-11-04. Branch f17-voice-actions. No staging, commit, push, cloud/model inference, training or provider calls. Environment files, production voice_audit/voice_audio and unrelated .claude work were not edited. Root README unchanged. Stage snapshots and failed/successful logs are preserved under ignored `.overnight_backup/`.

## Stage results

| Stage | Status | Result / decisions | Verification |
|---|---|---|---|
| 1 ASK v2.1 | PASS | Element-limit grammar (including multiple elements), whole/paise rupees and page-precision plain numbers; fixed chemistry decimals preserved. Only affected golden answers updated | 2,365 frontend tests; build 8.77s; 447 Agent tests / 12 existing warnings |
| 2 Live words | PARTIAL | Default-off websocket/hook/card plumbing and explicitly labelled final-transcript mock replay. Actual provider interim words are not documented, so no guessed forwarding or new microphone was added | 2,373 frontend tests; build 7.28s; 456 Agent tests / 12 warnings; 8 focused frontend + 9 Agent cases |
| 3 Wake folder tooling | PASS | Dry-run-by-default pause-v3 evaluator using unchanged app checker; synthetic WAV tests, explicit ceiling, sequential calls, first-error stop, CSV/totals and phone/handover guide. Never run live | 4 focused tests; 2,373 frontend tests; build 48.35s; 460 Agent tests / 12 warnings |
| 4 TTS pronunciation | PASS — flaky browser tests under load | Input-only token-aware non-cascading pass, default off; reviewed pronunciationOnly payloads and approved assets bypass it. Display untouched. Revised gate explicitly authorized by user; no rollback | 88 focused TTS/pronunciation/approved-audio checks. All three flaky files passed in isolation; full suite with two workers 2,385/2,385 in 91.63s; build 10.69s; Agent 460 passed / 12 warnings in 71.81s |
| 5 Morning documentation | PASS | Actual-registry mock checklist, updated README draft, this report. Names left TODO. Security/retention and wake history cite repository evidence | 2385 frontend tests / 42 files; build 34.78s; 460 Agent tests / 12 warnings |

## Files by stage

F = MetalliSense_Frontend_R/MetalliSense_Frontend; A = MetalliSense_Agent_R/MetalliSense_Agent. Some integration/config files necessarily span stages; each has its own prior-stage backup.

1. `.gitignore` (ignore snapshots); F/package.json; F/src/services/voiceAskFormatters.js, voiceAskContent.js; F/tests/f17-ask.test.js, tests/fixtures/f17-ask-v2-expected.json; A/pytest.ini; A/DOCS/F17_ASK_WORDING_REVIEW.md. voiceAskAnswers.js needed no edit.
2. A/app/copilot/live_words.py (new), provider_calls.py (read-only busy check), app/main.py (route registration), tests/test_live_words.py (new), DOCS/LIVE_WORDS.md (new). F/src/services/liveWords.js, hooks/useLiveWords.js, components/voice/LiveWordsSlot.jsx (all new); components/voice/PushToTalk.jsx, KuralWakePanel.jsx/.css; vite.config.js, vitest.config.js; tests/live-words.test.jsx and tests/fixtures/live-words.html/.jsx (new).
3. A/tools/wake_eval_folder.py, tests/test_wake_eval_folder.py, DOCS/WAKE_RECORDING_GUIDE.md (all new).
4. F/src/services/voicePronounce.js and tests/voice-pronounce.test.js (new), hooks/useSpeak.js, vite.config.js, vitest.config.js; A/DOCS/PRONUNCIATION_TABLE.md (new). Complete local candidate source-line inventory is `.overnight_backup/pronunciation-source-inventory.json` (674 references, including non-spoken lines; dynamic data cannot be exhaustively listed as static text).
5. A/DOCS/LIVE_TEST_CHECKLIST.md (new), README_DRAFT.md (updated), OVERNIGHT_REPORT_BUILD.md (new).

Tests added: Stage 1 grammar/money/rounding/fixed-chemistry/zero/negative cases in the existing ASK suite; Stage 2 eight frontend cases plus nine websocket cases; Stage 3 four synthetic-folder cases; Stage 4 twelve pronunciation cases with all-language rule assertions, display preservation and reviewed-narration bypass. No tests/timeouts/assertions were weakened.

## Required command and collection changes

F/package.json gained exactly:

```json
"test": "vitest run --configLoader runner --maxWorkers=1"
```

This permits the requested `npm.cmd test`; the existing mock test command remains available. The user-authorized Stage 4 full retry used `npx.cmd vitest run --configLoader runner --maxWorkers=2` to avoid conflicting repeated maxWorkers options in the npm script. No timeout/config assertion was changed.

A/pytest.ini now specifies `testpaths = tests tools/noise_bench` and `python_files = test_*.py`. This includes maintained offline regression suites (including seven existing noise-bench tests) and excludes root standalone diagnostics: test_agent_system.py, test_copilot.py, test_diagnostic.py and test_gnani.py. Those scripts require an explicitly running HTTP/live environment, non-fixture CLI arguments, or run code/exit during import. The initial exact pytest invocation failed collection because test_gnani.py called sys.exit on import; its log is preserved. No root diagnostic was edited or silently marked passed; they were not executed as live integrations. Agent gates set GNANI_MOCK=true / EVON_MOCK=true; maintained tests prohibit unmocked HTTP.

## Flaky browser tests under load

| Full run / preserved log | Failure | Unchanged isolated result |
|---|---|---|
| Stage 3 initial frontend.log | f17-review.test.jsx, mocked contact-sheet fixture: page.goto 30s timeout; 2,372 passed / 1 failed | 1/1 passed; revised Stage 4 isolation 9.05s |
| Stage 4 initial frontend.log | kural-wake-panel.test.jsx, Chromium Ready/card/cancellation/reference check: original 120s timeout; 2,384 passed / 1 failed | 9/9 passed; revised isolation 46.72s |
| Stage 4 retry-frontend.log | voice-everywhere.test.jsx, persistent panel/selection/stale response/HOLD check: original 90s timeout; 2,384 passed / 1 failed | 225/225 passed; revised isolation 32.95s |

Stage 3 retry passed all tests. Stage 4 revised gate ran each of those files independently with --maxWorkers=1 and original timeouts, then the full suite once with --maxWorkers=2: all 42 files / 2,385 tests passed. This satisfies the user's revised Stage 4 gate; the candidates were never rolled back. Failed logs remain historical evidence, not hidden successes. Mock browser fixture results do not prove physical microphone or provider behavior.

## New flags and operational defaults

- `VITE_LIVE_WORDS=false`.
- `LIVE_WORDS_ENABLED=false`.
- `VITE_LIVE_WORDS_MOCK=false` (explicit labelled final-result replay only).
- `VITE_PRONOUNCE_PASS=false`.
- Folder evaluator `--live` defaults false; without it there are zero calls. No automatic folder evaluation runs in the app.

No environment file or existing default changed. Restart frontend Vite after setting a frontend flag in the owning shell; restart Agent after setting backend flags. `LIVE_WORDS_ENABLED=true` still does not claim or start provider interim transcription. See LIVE_WORDS.md for the deliberately unavailable endpoint and explicit mock demo.

## Missing contract / human work

Known existing stream contract: `wss://api.vachana.ai/stt/v3/stream`, server-side auth, mono PCM16 frames, one locale and final utterance transcripts. Existing gnani_stream.py explicitly documents final transcripts and processing acknowledgements, not token partials. Missing: verified nonempty interim-text behavior/message contract, final/revision ordering and a provider/lease-compatible way to avoid delaying the existing REST path. Defensive parser branches alone are not evidence that the provider emits words. No speculative audio forwarding was implemented. Single-locale ta-IN/hi-IN/en-IN selection and unavailable/busy cleanup are tested.

Remaining manual work: verify that provider contract before actual live words; listen to pronunciation spellings with the optional pass before accepting them; execute the disposable mock checklist with provisioned roles; separately authorize any real microphone/provider/phone-folder run. No wake reliability or hardware success is asserted. No real folder clips were evaluated, no S03 was accessed, no model or audio was regenerated.

Stage 4 focused tests initially caught a °C/C collision and cascading SG initials; one-pass longest-token-aware replacement fixes both. A test import/mock transform ordering error was also corrected. These intermediate failures were fixed within Stage 4; original speech text and approved WAVs stayed protected.

## Final verification

Final sequential Stage 5 gate completed: **2385 frontend tests passed across 42 files in 343.31s**, production build **passed in 34.78s**, Agent **460 passed / 12 existing warnings in 130.68s**. The normal one-worker npm script passed all files in this final run; no fallback was needed. Stage 4 remains PASS under the separately authorized two-worker/isolated gate, with all failed runs retained above.

All **22 source and 22 built tour WAVs** match the approved manifest SHA-256 values. Evidence: `.overnight_backup/stage5/approved-audio.json`. No audio was re-encoded or regenerated. Staged and unstaged `git diff --check` both exit 0; only existing Git ignore-access/line-ending warnings remain. Existing staging was preserved. Unrelated `.claude/` remains untracked and untouched.

Final logs: `.overnight_backup/stage5/{frontend,build,agent}.log` and gate.json. Stage 4 revised evidence: `.overnight_backup/stage4/revised-gate.json`, isolated-*.log and two-workers-frontend.log. Earlier gate errors and source snapshots remain intact. Root README, environment files, provider rules/thresholds, models, datasets/S03 and approved audio were not changed. No files staged, committed or pushed.

Overall: Stages 1, 3, 4 and 5 PASS; Stage 2 PARTIAL because verified provider interim words remain unavailable. Actual live streaming and pronunciation listening are not completed or claimed. No dependencies were installed, models downloaded, training performed or live provider request made.
