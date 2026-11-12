# Stage 2.6 — Hindi commands, navigation and reply language

2026-11-12. Branch v23-improvements. No commit/push, environment-file changes, training, wake-rule changes or plant writes. Real calls used generated TEST speech only, one request at a time, bounded three-attempt/30-second-backoff transport and temporary DATA_DIR/cache. Existing roles, confirmation, private capture, lock, deadlines and H-1053 HOLD safety remain intact.

## Part 1 — Hindi matching

The three saved Stage 2.5 Hindi misses were `reading लो।`, `gate check करो, H एक हज़ार इक्यावन।`, and `PR approve करो।`. Registry aliases expected Devanagari nouns or different wording, while Prisma mixed Latin nouns with Hindi verbs. Numeric words already normalize; existing punctuation cleanup was retained and native alias cleanup now also removes danda. Explicit command aliases cover Hindi/Hinglish readings, gate checks, melting, selected PR approval and receiving. Romanized `sthiti`/`haal` join the existing status cue. No fuzzy action matching, guessed target or role bypass.

Saved five-clip replay: **2/5 → 5/5**, both historical OFF and context-ON outputs. Context remains OFF. Historical context-ON status output says H-1051 for the H-1053 prompt: that is a provider ID substitution, despite the correct intent. Matching never silently rewrites it to the intended ID.

New-trial plan/expected routes were saved before calls, and aliases frozen. Eight new configured Timbre v3/Kalpana Hindi clips, then Prisma v3 with hi-IN/codemix, produced:

| Intended command | Actual transcript | Route | Result |
|---|---|---|---|
| Latest reading | latest reading दिखाओ। | spectrometer_heat_reading | Correct |
| Request reading | reading लो। | request_reading | Correct |
| Gate check H-1051 | get check करो, H एक हज़ार इक्यावन। | heat_status | Miss |
| H-1053 status | एक हजार तिरेपन स्थिति क्या है? | heat_status, 1053 | Correct |
| Start H-1053 melting | H एक हजार तिरेपन, melting शुरू करो। | start_melting; HOLD precheck refuses | Correct routing, no execution |
| Selected PR approval | चुना हुआ PR approve करो। | approve_pr | Correct |
| Receive truck | truck receive करो। | receive_lot | Correct |
| Go to spectrometer | spectrometer जा। | spectrometer_heat_reading | Miss |

**New-audio gate FAIL: 6/8, below 7/8.** Neither `get check` nor `जा` was added after seeing these results. The two failed acoustic/rendering variants remain failures. No action was executed in replay; HOLD is tested against a mocked fresh heat response and unchanged production precheck.

Evidence: `tools/local_wake_data/stage2_6-hindi-4a8f4b1da8c944ac92f6799f1a7e32b5/` (16 requests: eight TTS/eight STT). An earlier new directory stopped before any HTTP request on a source-hash relative-path error; preserved unchanged. Saved Stage 2.5 raw outputs/audio remain unchanged; before/after derived classification is preserved separately under ignored `.overnight_backup/v23-stage2_6/`. A replay initially wrote the older tool's derived routing path; its pre-edit routing was reconstructed with the preserved source snapshot, and subsequent Stage 2.6 replay requires an explicit separate output path.

## Part 2 — safe Tanglish navigation

The existing page data matcher treated the word spectrometer as a reading query before navigation. A separate strict page grammar now precedes that generic data fallback, after existing safety checks. It accepts a known page plus only approved go/open/page tokens, or a bare known page when a different current route is supplied. It consumes no numeric ID and invents no coupon alias. The existing public navigation result shape is preserved. `Spectrometer coupon.` still does not qualify for the new navigation path.

| Generated prompt | Correct target |
|---|---|
| spectrometer ku po | No — saved transcript does not satisfy strict navigation |
| pre melt gate ku po | /premelt-gate |
| stock page ku po | /raw-material-stock |
| spectrometer open pannu | /spectrometer |

**Gate PASS: 3/4**, without post-result tuning. This is generated-speech navigation evidence, not proof that the original live “coupon” case is solved. A user can use the successfully recognized alternative, but no phrase was silently remapped from coupon. ASK-only navigation uses the existing route handler. No plant action.

Evidence: `tools/local_wake_data/stage2_6-navigation-d765036c44914cfea8c8ccdacba5c2a5/` (eight requests: four TTS/four STT). Raw transcript, target, file hash and route decision are saved per clip.

## Part 3 — default-off auto reply language

New Agent **`STT_AUTO_LANGUAGE=false`**, frontend **`VITE_STT_AUTO_LANGUAGE=false`**. Both remain off and no environment file was edited. The backend only overrides `purpose=command` on Prisma v3 to `language_code=indic-auto`, retaining codemix. Form replies, confirmation, private/passcode and the separate wake checker are excluded. Existing context feature remains disabled.

The frontend uses detected code plus script/word cues through the shared PTT/hands-free transcript handler and action reply metadata. Under three transcript tokens, an unsupported code, or Marathi/ambiguous Hindi cues retains the current language. Tamil/Tanglish cues can select Tamil even when a Latin transcript is tagged English. Devanagari alone cannot distinguish Hindi/Marathi. Short transcripts are deliberately not forced into a new language. Flag-off action dispatch retains its previous selected-language behavior.

Official contract checked: [Prisma v3 language detection](https://docs.gnani.ai/api/STT/models/prisma-v3). `indic-auto` and up to four hints are documented, and detected_language_code is derived from transcript script. This experiment uses indic-auto versus the existing per-group hint, rather than a third hint-list arm; no mode was selected after seeing results.

Twelve preselected, previously generated clips were reused: first four saved Tanglish clips (Tamil/Tanglish-designated group), first four Hindi clips, and first four English-designated clips excluding spectrometer ku po. This is not four new monolingual Tamil recordings. Current-language states were predeclared as English for the Tamil/Tanglish group and Tamil for Hindi/English, to expose switching rather than assume the correct language. Same WAV per OFF/ON pair; OFF uses existing question-reply rules, ON uses guarded detection. No inference or label tuning after results.

| Group | Reply language OFF | Reply language ON | Correct routes OFF | Correct routes ON |
|---|---:|---:|---:|---:|
| Tamil/Tanglish | 3/4 | 2/4 | 4/4 | 3/4 |
| Hindi | 4/4 | 3/4 | 4/4 | 3/4 |
| English | 1/4 | 2/4 | 4/4 | 4/4 |
| Total | **8/12** | **7/12** | **12/12** | **10/12** |

**Keep OFF: fails the non-regression rule for both overall language and route accuracy.** Guard fallbacks are counted honestly as misses when they retain a different current language. No claim of speaker-language accuracy follows from a transcript-script label. Evidence: `tools/local_wake_data/stage2_6-language-9ce5fd43519040b38b5a0b29a7cb36cb/` (24 STT requests; no new synthesis).

The table above is explicitly **exploratory** because its Tamil-designated group used Tanglish rather than four Tamil-script prompts. Four Tamil counterparts were predeclared to correct that corpus mismatch, retaining the already completed Hindi/English pairs and frozen rules. Partial evidence: `tools/local_wake_data/stage2_6-language-52bd9e1ccf2844d58849e504783853ba/`. One complete pair and the second generated WAV were retained; the next `/stt/v3` request returned HTTP 403, and the run stopped. No body/request ID was retained for that failure, so its underlying cause is unestablished. It is not described as a quota or credential diagnosis.

The user reserved the shared key until **1:15 PM IST** for a live presentation. All real calls were paused on that instruction. The offline-prepared resume helper refuses execution before an explicit timezone-qualified `--not-before`, reuses completed pairs/WAVs with provenance, and writes a separate results directory. No calls occurred during the pause. The user then explicitly lifted the pause early and authorized **one probe**, with a mandatory stop on 401/403. The probe reused the saved 1.44-second generated Tamil clip and made exactly **one POST `/stt/v3`**, returning **HTTP 403**. All real calls stopped immediately; the Tamil resume was not launched. Evidence: `tools/local_wake_data/stage2_6-probe-32d531fb601a41aaaa877fd80b96103e/result.json`. No provider message/request ID was available in that saved response record. No quota, credential or Cloudflare cause is inferred from status alone. An initial probe filename typo failed before transport and consumed zero calls.

### Final requested Tamil/Hindi/English corpus — INCOMPLETE

| Group | Completed pairs / planned | Reply language OFF / ON | Correct routes OFF / ON |
|---|---:|---:|---:|
| Tamil-script | **1/4** | 1/1 / 1/1 | 1/1 / 1/1 |
| Hindi | 4/4 | 4/4 / 3/4 | 4/4 / 3/4 |
| English | 4/4 | 1/4 / 2/4 | 4/4 / 4/4 |
| Completed subset only | **9/12** | **6/9 / 6/9** | **9/9 / 8/9** |

These are completed-subset denominators, **not a completed 12-clip gate**. Three Tamil pairs are unevaluated; missing outcomes are not filled with the exploratory Tanglish results. The first Tamil pair is H-1053 status; the second WAV exists but its OFF request failed with 403, and its ON request was not sent. Remaining Tamil synthesis/transcription was not attempted. **Keep auto-language OFF:** the requested corpus is incomplete, and the completed subset already shows a route regression. The earlier 12-clip Tanglish table remains exploratory evidence only.

To test locally only after separately deciding to do so, set `$env:STT_AUTO_LANGUAGE='true'` before restarting the Agent and `$env:VITE_STT_AUTO_LANGUAGE='true'` before restarting/rebuilding the frontend. Recommendation from this run is **false for both**. Existing `STT_CONTEXT_ENABLED`, `TTS_AUDIO_TAGS`, streaming and wake flag defaults are unchanged.

## Calls, files and verification

**Final total: 54 HTTP attempts = 14 TTS + 40 STT; 52 HTTP 200 responses and two HTTP 403 responses.** Initial Hindi/navigation/exploratory-language calls: 48 = 12 TTS + 36 STT, all 200. The partial Tamil correction added five = two TTS + three STT, including its 403. The single user-authorized probe added one STT 403, then all real calls stopped. No retry was made on either 403. The source-path and probe-filename failures consumed zero calls. No generated passcode, credential transcript, production audit/audio access, user recording upload or live plant service execution. Temporary data/cache removed at process exit; generated diagnostic WAVs/plans/results remain ignored.

Frontend implementation: `voiceActionLanguages.js`, `voiceIntents.js`, `voicePages.js`, new `autoReplyLanguage.js`, `voiceTranscript.js`, `components/voice/PushToTalk.jsx`. Agent implementation: `app/copilot/gnani_client.py`, `app/main.py`. Tooling: new `tools/stage2_6_diagnostic.py`, `tools/stage2_6_probe.py`, frontend offline `tests/stage2_6-replay.mjs`. Tests: new frontend `tests/stage2_6.test.js`, Agent `tests/test_stt_auto_language.py`, `tests/test_stage2_6_diagnostic.py`, frontend test registration in `vitest.config.js`. No new dependencies.

Focused checks: 180 frontend tests passed before the final shared-handler case; the final focused Stage 2.6 file passed 15 tests. Agent command-only/format/private-exclusion checks passed 7/7. Existing navigation tests exposed an internal strict marker leaking into returned params; that was repaired by an internal helper, without changing the frozen navigation grammar or any measured alias. No test assertion/timeout was weakened.

The full sweep also caught a genuine ambiguous-bare-name regression: Tamil `இருப்பு` means usable quantity on Inventory Forecast but was an alias for Stock. Bare navigation is now limited to the displayed page names; generic aliases still require a navigation word. The original Inventory Forecast sweep case passes in isolation. This is a regression repair, not a post-trial alias for either failed new audio example. The frozen four spoken navigation phrases are unaffected. Flag-off action language dispatch was also explicitly preserved: the new language option is only passed when its new VITE flag is on.

| Required gate | Frontend | Production build | Mocked Agent |
|---|---|---|---|
| Part 1 | 2637 passed, 18 failed, 32 skipped; 6/49 files failed; 1015.72s | passed, 2m25s | 502 passed, 277.89s |
| Part 2 | 2684 passed, 4 failed; 4/49 files failed; 667.95s | passed, 44.25s | 504 passed, 121.42s |
| Part 3 / final frozen source | 2684 passed, 4 failed; 4/49 files failed; 728.94s | passed, 13.27s | 504 passed, 76.11s |

Part 1 contains the repaired strict-marker/unit failure and source-edit/HMR disruption. Part 2 contains the repaired Inventory Forecast assertion plus voice-everywhere, live-words and real-page browser timeouts. Final Part 3 has **only four existing browser timeouts**: voice-everywhere (90s), live-words (30s), orb review (120s), dev-module page load (30s). Real-page-controls passed all 32 cases in that final full run. No timeout, assertion, role or safety gate was weakened. Browser isolation results follow below. Earlier failures remain recorded as failures, not retroactively changed to passes.

All three Agent runs report 14 existing warnings; no historical missing-artifact/Python-version baseline failures occurred. Build retains its large-chunk warning; Node reports its existing shell-spawn deprecation warning. Python compilation passed. All **22 source + 22 production-built approved tour WAV hashes** match. Staged/unstaged diff checks pass with Windows line-ending/ignore-access warnings. The tests' own changed generated F17b screenshot was restored to its clean starting bytes using read-only Git object inspection; no implementation/user work was reverted. Recordings, environments, diagnostic audio and evidence remain ignored. Existing untracked `.claude/` was not opened or modified.

Full per-part gates, final hash checks and remaining human checks are recorded below when complete. The first frontend run overlapped source edits and its page-sweep fixture hot-reloaded, destroying execution contexts; its failures are retained, not accepted as a clean result. Subsequent gates run against frozen source. Human checks remain: real Hindi accents/IDs, practical Tanglish alternatives to coupon, selected-language fallback expectations for short commands, physical microphone and audible native replies, normal H-1053 HOLD refusal and existing passcode/lock/PTT behavior. No tour or approved narration was regenerated.

Additional offline tests cover the explicit not-before prohibition before environment/transport setup and the frozen Hindi/navigation plan sizes. Combined diagnostic/command-only tests: **9 passed**. No live call occurred during the presentation pause.

### Independent browser checks requested after the pause

Original assertions/timeouts and npm test's existing single-worker setting were retained:

| File | Isolation result |
|---|---|
| voice-everywhere | 224 passed, one 90s timeout; **not passed** |
| live-words | 8 passed, 3.97s |
| orb / kural-wake-panel | 9 passed, 113.85s |
| dev-module-smoke | 1 passed, 49.85s |
| real-page-controls | 32 assertions passed, but 10s cleanup-hook timeout; suite **not passed** |

Logs: ignored `.overnight_backup/v23-stage2_6/isolation/`. A single final full frontend/build/Agent sequence was then launched as explicitly requested; its result is recorded below. No automatic repeated full-suite loop is planned and no browser timeout was increased.

### Final verification after the user's probe/stop instruction

The requested single final sequence completed successfully against unchanged production source:

- **Frontend: 2688 passed, all 49 files, 251.38s.** This includes all four previously timed-out browser files, the page sweep and real-page-controls. Earlier independent/full failures remain recorded above; they are not rewritten as passes or asserted to have a proven single cause.
- **Production build: passed, 8.29s.** Existing large-chunk warning only.
- **Agent pytest: 507 passed, 14 existing warnings, 42.08s.** The additional three mocked probe-status cases (200/401/403) assert exactly one outgoing request, no retry, correct outcome and no key in console output. The focused diagnostic file passed 5/5 before the full run.
- **Protected audio: all 22 source + 22 built approved tour WAV hashes match.** Both staged/unstaged diff checks pass (line-ending/ignore-access warnings only). Python compilation passed. Generated diagnostic evidence is ignored. Initial `.claude/` remains untouched. Final status contains only the listed implementation/tests/tools/report plus that existing untracked directory; no staged changes were introduced.

No further real call occurred after the probe's 403. The key is not held by a diagnostic process. No Tamil resume was started, no pending timer is scheduled to restart it at 1:15, and no additional calls are implied by the retained resume helper. The original and failed manifests/audio remain preserved. **Hindi new-audio gate failed (6/8); navigation passed (3/4); auto-language stays OFF with Tamil incomplete (1/4 completed pairs).**

Remaining work is human live checking of the matching fixes and, only after separate authorization/access resolution, completing the three missing Tamil pairs. The alternative three-language hint-list arm was not tested; no further mode selection/tuning is justified from the incomplete run. No physical microphone, live approval execution or production-reliability claim is made. Nothing was staged, committed or pushed.
