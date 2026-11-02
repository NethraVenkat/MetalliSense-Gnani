# Local real-time Kural diagnostic

2026-11-02. Exploratory development only. Production tour, microphone controls, audio, labels and training datasets are unchanged. No training, threshold selection, cloud calls or S03 access.

## Launch

From `MetalliSense_Agent_R/MetalliSense_Agent` in PowerShell:

```powershell
.\tools\local_wake_data\kural-cnn-v1\environment\Scripts\python.exe .\tools\kural_live_diagnostic.py --serve
```

Open **http://127.0.0.1:8777/**. The server loads the existing checkpoint; it performs no installation. The tool is disabled without `--serve`, binds only to loopback, and opens no microphone on page load. Close other recorders and turn the application's Mic off first. Confirm consent and the actual playback/noise condition, then select **Start microphone**. Only this page owns its stream. **Stop microphone** releases tracks immediately and drains the captured PCM before finalizing the log. Closing the page, capture failure, transport/backlog failure, session limit or server shutdown also cancels capture; there is no retry loop. A session has a five-minute maximum, with a 30-second server idle timeout.

## Fixed scoring contract

- Unchanged `negative-context-3eabdac026d44b05aa60c393515a3a12/checkpoints/epoch-04.keras`; SHA-256 `eb18391180ff973721f618e0e03cfb49c11eb6869bf67c9602365958fbdb6315`.
- Frozen S01-only normalization and feature configuration are hash-checked before loading. The scorer calls the existing shared causal context/log-mel implementation: mono PCM16, 16 kHz, two-second context, 1,280-sample/80 ms scoring hops, shared left padding and final partial hop.
- Events call the existing `kural_training.events` implementation at **all four unchanged thresholds .50/.65/.80/.90**, two consecutive frames, one-second cooldown. No threshold is qualified or adjustable here. Startup scores remain visible; the diagnostic two-second eligibility gate is **not** applied.
- The browser uses stateful area-average resampling to 16 kHz. It requests the existing collector's echo cancellation/noise suppression/automatic gain controls; input rate and applied browser settings appear on screen and in downloaded session notes. This browser/device capture path may differ from saved recordings. No artificial noise is generated or injected.
- Audio timestamps count captured 16 kHz samples. UTC receipt/event times, inference processing time and delivery backlog are separate fields. Neither inference time nor the chart proves streaming wake latency.

The page shows live score, recent trace, real/padded context support and timestamped events. All tour/navigation/command actions remain disconnected. Audio is sent only to the local server; no cloud STT/TTS receives it.

## First guided session

Use the Exercise selector to advance manually. Do not change thresholds between exercises.

1. **Kural alone:** three natural takes, each with about one second of silence before and after. Mark expected start immediately before saying `குரல் / Kural`, mark expected end afterward, then **Save manual expected wake**.
2. **Kural plus a question:** three natural takes, for example `Kural, நிலை என்ன?`. Mark only the intended Kural word; record uncertainty in Notes.
3. **Similar negative words:** natural phrases containing coral, curl, cruel, neural, குழல் and குரங்கு. Do not add expected wakes unless Kural is actually spoken.
4. **Silence:** 15–20 seconds of the actual room/fan sound, without speaking. Do not add an expected wake.
5. **Ordinary conversation:** 20–30 seconds of natural speech without intentional Kural. If it is spoken accidentally, log that honestly.

Manual marks are approximate expectations, not verified listening boundaries or training annotations. Save markers **before Stop**. You can enter captured-audio times directly when button timing is awkward. Download session notes before starting another session; server evidence for every session is retained separately regardless. Record any uncertain pronunciation or missed manual mark rather than inventing an interval.

Narration echo is not established by the initial sequence. Any later playback exercise must log what was actually played and whether it literally contains Kural; wake-free narration and playback saying Kural are different conditions. Do not run the production app's microphone simultaneously.

## Evidence and checks

Each session creates a new ignored `tools/local_wake_data/kural-cnn-v1/live-diagnostics/session-<id>/` containing `session.json`, captured mono PCM16 `capture.wav`, `scores.jsonl`, `events.jsonl`, separate `expected.jsonl` when supplied, and `finished.json`. Failure evidence is retained. Nothing is automatically imported into training. Browser session notes also retain applied microphone settings.

Implementation: `tools/kural_live_diagnostic.py`, `kural_live_capture.js`, `kural_live_diagnostic.js`, `kural_live_diagnostic.html`; tests: `tests/test_kural_live_diagnostic.py`, `tests/kural_live_diagnostic.test.cjs`.

Verification:

- Python live diagnostic + existing context-policy/binary regressions: **24 passed in 0.79 s**. Ten new live-server tests cover default-off behavior, interpreter guard, consent/single session, ordering/stale sessions, exact shared event parity/final hop, marker bounds, packet/session limits, error/idle/shutdown cleanup and loopback routes.
- Node mock checks passed: fractional resampling/PCM, hop/flush, permission/error/stop cleanup, duplicate Start, sequential transport, manual marker ordering, session limits/backlog, stale responses/page exit and no app/cloud routes.
- Loaded the actual unchanged checkpoint locally and compared three saved-audio endpoints. Maximum score difference from saved predictions: **5.960464477539063e-08**. Real localhost status/HTML/JS responses succeeded; no microphone/session was started. Evidence: `live-diagnostic-validation-f9788490f92442bf9b6c7a154be490f1.json` under the ignored CNN root.
- Chromium with a **mock microphone and mock scores**, at desktop 1200×900 and narrow 390×844: no autostart, one Start/Stop, ordered packets, manual marker saved, no page errors or horizontal overflow. Screenshots and `result.json`: `live-ui-check-eb58c58b37e346a1b84965d7efd213d9/`. This is UI/lifecycle verification, not acoustic or audible listening verification.
- Preservation check: all 27 frozen run artifact hashes, both S01/S02 annotation hashes and all 22 approved production WAV hashes match. Generated evidence/capture paths are Git-ignored. Staged and unstaged `git diff --check` pass. Evidence: `live-preservation-12bb24703d50416d9261c027f82288f4.json` under the ignored CNN root.
- No frontend source changed; no frontend build is needed for this standalone tool. Real microphone detection, dropped/late frames under actual load, speaker echo and recognition quality remain for local use. Existing model remains unqualified.

No installation, new training, synthesized audio/noise, label changes, S03 access, deployment, staging, commit or push.

## First live session inspection and stopped-clock repair

Session `9c553da854744e2cb507c8f752364197` stopped normally (`user_stop`). Retained `capture.wav` is readable mono PCM16/16 kHz: **86,698 complete frames, 5.418625 seconds**, SHA-256 `59e845ad468947294b02901395afe43ef11cc84043d8f254c2bae12ffeee5f9a`. All 68 score endpoints match the captured sample timeline: 67 regular 1,280-sample hops plus a correctly flushed final 938-sample partial hop. There are no missing server scoring endpoints or incomplete PCM frames. Historical client notes did not export packet/sample totals, so upstream browser/device loss cannot be ruled out from these artifacts. The 5.953-second server wall duration includes session overhead and is not wake latency.

Downloaded client notes exactly match the three server threshold events: .50 at 2.000s and 3.040s; .65 at 2.480s; none at .80/.90. Raw score range .0818313–.6651592. No expected-wake markers were saved; none were inferred. Client `checkpoint.audio_time: 0` is the initial status snapshot, not the stopped recording duration. These events are not confirmed recognition or accuracy measurements.

Stopped Captured displayed zero because cleanup cleared `capture`, and `audioTime()` then returned its zero fallback. The controller now retains the final sample-count clock after releasing capture resources; only an explicit new Start resets it. State notifications use the same clock. No scoring, thresholds or checkpoint changed.

Original server files and Downloads notes are unchanged, with hashes recorded in separate ignored evidence: `tools/local_wake_data/kural-cnn-v1/live-session-review-115c99985fab4abb8fec7e977e3940c9/review.json`. The same directory contains a hash-identical copy of the downloaded notes and `index.html` for original-audio playback with event seek controls. It saves no labels. Listen to the entire clip, then identify the actual audible Kural interval(s); human alignment is required before judging events.

From Agent PowerShell:

```powershell
Start-Process ".\tools\local_wake_data\kural-cnn-v1\live-session-review-115c99985fab4abb8fec7e977e3940c9\index.html"
```

To load the code fix, stop the existing diagnostic server with Ctrl+C, rerun the launch command above and refresh its browser tab. Start/Stop should preserve **Captured** until the next Start; this old session remains recoverable from its retained audio/logs, not the new page's clock.

Checks: added focused controller assertions for the exact final sample duration surviving Stop/repeated Stop/state notification and resetting while a new Start is pending; subsequent capture retains its own duration. Node live diagnostic regression passes; Python live diagnostic suite **10 passed in 0.35s**. No frontend build required (production frontend unchanged). No inference, training, provider call, S03 access, staging, commit or push.

## Manual alignment page

The same retained-session `index.html` now has a sample-derived waveform, full seconds ruler, synchronized playback cursor, click-to-seek, millisecond start/end inputs, use-current-time buttons, green interval shading and selected-interval playback. Orange dashed threshold markers and their seek buttons are separate observations; clicking them does not assign a boundary. Literal `குரல்` is UTF-8, replacing the earlier corrupted question marks.

Listen, set start/end, play the selection, then **Add human-marked interval**. Repeat if more than one Kural is audible. Explicitly confirm after listening, then **Export separate human-review JSON**. Invalid, out-of-range or overlapping intervals cannot export. The download records session ID, exact original audio hash/frame count/duration, original score/event evidence hashes and separate threshold observations. It is not automatically imported into training. No intervals are prefilled or inferred. The page embeds unchanged WAV bytes for offline file playback and has network connections disabled.

Generator: `tools/prepare_kural_session_review.py`; reusable template: `tools/kural_session_review.html`. Regeneration validates original session hashes first, preserves the previous page under a unique backup name and writes a separate generation manifest. Original WAV, server logs, prior review report and downloaded session notes remain unchanged.

Checks: Node pure timeline/interval/provenance tests pass. Chromium loaded the actual retained WAV with muted playback and passed seeking/current-time buttons, unchanged inputs after event seek, invalid interval handling, interval-end stop, separate JSON download provenance and narrow-screen bounds. Test-only marks were not retained as human evidence. Python generator preservation/hash-rejection regression: **1 passed in 0.22s**. No inference/training, frontend build or audible listening approval.

## Reviewed live-session matching under the frozen rule

The matching specification exists in `kural_training.metrics` (line 457), backed by the completed negative-context v2 run's hash-verified `identity.json`/`config.json`. Training-source SHA-256 `05b7a03e34445b191c4092f4b5e99438073012a2fa41559b6e66b2e4862fdd52`; config SHA-256 `ddca724753263bf97d866105fd922ddefb65862305b5c4363a7216455c77790a`. Current implementation exactly matches that recorded source hash. Earlier pipeline documentation also records the one-second grace. No tolerance was selected from this session.

Rule: iterate reviewed wakes chronologically; take the **first unused chronological event** in inclusive `[wake start, wake end + 1.0 second]`. Each event and wake is used at most once, independently per threshold. There is no pre-start tolerance. Saved score replay uses the unchanged `events` function (two consecutive frames, one-second cooldown, ungated), and reproduces the saved events exactly without model inference.

For session `9c553da854744e2cb507c8f752364197`, the validated human intervals are W1 .890–1.120, W2 2.160–2.400, W3 3.540–3.780 seconds:

| Threshold | Rule-matched wakes/events | Missed wakes | Unmatched events |
|---|---|---|---|
| .50 | W1→2.000s (+.880s); W2→3.040s (+.640s) | W3 | 0 |
| .65 | W2→2.480s (+.080s) | W1, W3 | 0 |
| .80 | none | W1, W2, W3 | 0 |
| .90 | none | W1, W2, W3 | 0 |

Offsets are event audio time minus reviewed wake end. These rule-based matches do not establish causal attribution, recognition accuracy or end-to-end latency. This three-wake exploratory session is not S02 validation, qualification, a false-activation exposure or a threshold-selection exercise. Thresholds were not combined; no qualification configuration/results were modified.

Separate ignored report, copied review export and next-exercise worksheet/instructions: `tools/local_wake_data/kural-cnn-v1/live-frozen-matching-72595e0571514b5994d802fc416ce3b9/`. Next: one session with 20 seconds silence, similar words and 30 seconds conversation. Log actual exercise boundaries in the provided separate worksheet, then explicitly confirm literal-Kural presence/absence after listening. Boundary notes are not expected-wake markers or automatic training annotations.

Reused existing evaluation regressions: **3 passed, 21 deselected in 2.28s** (saved-prediction denominators, all-miss rejection, recall/false-event/exposure limits). No evaluation source changed or new tests added. Original session hashes, checkpoint, both S01/S02 annotations and all 22 approved production WAV hashes match. No new inference, training, S03 access, threshold changes, cloud calls, staging, commit or push.

## Four-session development summary and one proposed repair

Preserved evidence: `tools/local_wake_data/kural-cnn-v1/live-development-summary-6e57baac65d84bdd80af693b839eaf67/`. It contains hash-identical Downloads-note copies, `summary.json`, a separate user-review overlay and offline `index.html` with unchanged audio embedded for playback. Original session files, Downloads notes, earlier human reviews and context-matched diagnostic remain unchanged.

| Session | Decoded seconds | Score endpoints | .50 events | .65 | .80 | .90 | Human status |
|---|---:|---:|---:|---:|---:|---:|---|
| Positives `9c553d…` | 5.418625 | 68 | 2 | 1 | 0 | 0 | Three reviewed wakes; frozen matches above retained |
| Silence `6b0274…` | 22.1013125 | 277 | 0 | 0 | 0 | 0 | Literal-wake absence pending confirmation |
| Similar negatives `e04925…` | 12.3733125 | 155 | 1 | 0 | 0 | 0 | User explicitly confirms no Kural; one .50 false activation at 2.160s |
| Conversation `6e0563…` | 33.834625 | 423 | 31 | 20 | 2 | 0 | Literal-wake absence pending confirmation |

Client/server session identifiers, model metadata and complete per-threshold event lists agree. Every WAV validates mono PCM16/16 kHz with complete frames; every regular 80ms endpoint and final partial endpoint is present through the sample-count duration. No retained scoring gap or incomplete PCM frame was found. Historical exports cannot establish whether upstream browser/device samples were lost. Source hashes are recorded and preserved; checkpoint, S01/S02 annotation and all 22 approved production WAV hashes match prior evidence. No other matching human-review export was found in Downloads for the three new sessions.

Counts are threshold events, including possible repeated emissions after cooldown; they are not counts of independently spoken words. Conversation events cannot yet be called confirmed false activations. Zero silence events is not proof of general silence robustness. No short-session count is extrapolated into a reliable per-hour rate. All four sessions and the repeatedly inspected S02 data are development evidence, not an untouched test set.

### Proposed repair — paired word-specific training data, one bounded data-only experiment

Evidence: after equal real-history/padding in the prespecified diagnostic, wake-only and nonwake speech still overlap: the 1.5-second speech-negative maximum .7355 exceeds both wake-only groups' maxima (below .488), while KP03 median is .7167. At two seconds, ordinary background reaches .8078 versus wake-only-correct maximum .5419. Live conversation reaches .81555 versus reviewed positive-session maximum .66516, with sustained event emission; similar negatives already have a confirmed false event. These observations support a word-specific discrimination deficit, not proof of a particular internal mechanism. Raising thresholds trades away wakes and is not the proposed repair.

Propose **one paired-data repair**, not another padding/noise/threshold adjustment. Before authorizing any fit, collect **40 matched pairs** in two explicitly designated new TRAIN_DISCRIM sessions: 20 natural Kural-alone/confusable-word pairs and 20 Kural-plus-question/the-same-question-without-Kural pairs. Use existing real recording workflow and actual surrounding history; retain original waveforms. Balance distance/condition/order across pair members. Human-review complete wake intervals and whole-record nonwake absence; retain session/pair lineage and never split a pair's originals/crops across fitting and evaluation. These are new, explicitly authorized training data only if the user later approves; inspected live clips and S02 are not silently admitted. Preserve S01-only frozen normalization, current quiet/startup-negative support, architecture/features, balanced recording-level batches and frozen event rule. Incorporate pair examples into regular speech support and log the exact roster/rotation before fitting. No synthesized noise or fabricated prehistory.

Before that single experiment, also collect/review a **separate development-validation session**: 20 wakes (10 alone, 10 with questions), the confusable phrases, at least 300 seconds ordinary wake-free speech and at least 60 seconds wake-free narration echo. This is not S03. Train only on S01 plus explicitly admitted TRAIN_DISCRIM; new development validation and existing S02 remain evaluation-only. Echo without literal Kural cannot establish resistance to playback saying Kural.

Predeclare one run: seed 1729, existing architecture/optimizer, maximum 50 epochs, existing early stopping and 60-minute limit; no search/repeat loop. Keep thresholds .50/.65/.80/.90, two consecutive frames, one-second cooldown and existing one-to-one one-second-grace matching unchanged. Require a single common threshold to meet unchanged limits on both original all-20-wake S02 and the separately reviewed development validation: at least 18/20 matched wakes; zero ordinary, echo and unmatched-positive events; existing exposure minima. Report every threshold, short-wake/question strata, and matched-pair scores even on failure. No qualified threshold means failure; do not change limits or deploy. Original S02 repeated use is disclosed as development selection, not generalization evidence. S03 remains reserved.

This is a proposal for review only: no new collection, inference, fitting, threshold selection or training-data import occurred. First remaining evidence action is human confirmation of silence/conversation literal-wake absence via the retained playback page. No analysis tooling changed; tests/build were not rerun unnecessarily. Both diff checks pass.

## Paired-v1 and devval-v1 collection — Builder: Manish + Nethra

The user's subsequent collection specification below supersedes the earlier proposed new-data collection/exposure counts. Capture and human labelling only; no training/evaluation or activation integration is implemented. Existing S01/S02/live recordings are not imported, and S03 remains reserved.

Sherpa summary (existing evidence only, no model execution):

1. English Sherpa-ONNX 2.0.1/GigaSpeech 3.3M detected KURAL in **0/6** recorded positives; both official English positive-control files passed.
2. False activations remain **unmeasured**: the positive-only Kural trials had no negative-audio exposure. Saved runtime diagnostics show unchanged `keywords_threshold=0.25`, `keywords_score=1`; these are not the CNN threshold candidates.
3. Commit `039538d` introduced the isolated benchmark; `sherpa-2.0.1/artifacts.json` is setup provenance (its `inference: not run` describes setup), with subsequent outcomes in the existing diagnosis/prototype evidence. None of this qualifies Sherpa or changes the paired collection plan. No rerun was performed.

### Existing page, two modes, direct disk storage

Extended `tools/collect_kural_recordings.html` using `tools/kural_paired_collector.js` and the existing PCM capture adapter. The historical mode still downloads WebM/MP4 plus JSON to Downloads; it does not write directly to a dataset directory. New modes use Chromium/Edge's File System Access directory picker and write PCM16 mono 16kHz WAVs plus UTF-8 JSON directly to the selected folder. They do not rely on browser-only progress or upload files to the static server. Choose the **same output root** on reopening; manifests and all listed original/canonical WAV hashes are validated before resume. No dependency installation or conversion is required.

From Agent PowerShell, start the existing static server:

```powershell
.\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
```

In a second terminal:

```powershell
Start-Process "http://127.0.0.1:8766/collect_kural_recordings.html?mode=paired-v1"
Start-Process "http://127.0.0.1:8766/collect_kural_recordings.html?mode=devval-v1"
```

Record in **one tab at a time**. Turn the app Mic off and close other recorders. Use Choose output root and select the prepared `tools/local_wake_data/kural-paired-collections-v1/` folder. The browser cannot display/choose this absolute path automatically. Do not choose an old training/model/session directory. New mode directories are:

- `tools/local_wake_data/kural-paired-collections-v1/train-paired-v1/`
- `tools/local_wake_data/kural-paired-collections-v1/devval-v1/`

Each set has one canonical `manifest.json`, with per-speaker accepted/pending/rejected takes and their WAV hashes. `manifest-history/` retains earlier manifest versions. `clips/<speaker>/` retains immutable initial captures/sidecars; acceptance writes a canonical WAV/JSON pair under `accepted/<speaker>/`. Re-take archives a verified WAV/JSON pair under `rejected/<speaker>/` before the same prompt becomes recordable again; the initial capture is also retained. Nothing is deleted. UUID filenames avoid conflicts; unknown/changed artifacts abort resume rather than being overwritten. Conflicting concurrent manifest updates are rejected.

### What to record

Select `manish` or `nethra`, actual condition and consent before Record. Only speaker IDs and safe audio settings are recorded; no device identifiers. Local microphone ownership is guarded within/across new collector tabs, with cleanup on Stop, cancelled permission, failures, consent withdrawal and page exit. Capture starts only on Record. Press Stop and **wait for the pending-save message** before leaving the page. Abrupt page exit releases capture but is not a substitute for Stop/save.

**paired-v1: 40 clips per speaker, 80 total.** Ten A pairs: natural `குரல்` versus each of குரங்கு, குடல், குளம், குறை, கூரை, coral, cooler, curl, rural, control. Ten B pairs use the exact requested question list; Tamil wake prefix `குரல், `, final Hindi question prefix `Kural, `. Odd pairs prompt wake first; even pairs prompt nonwake first, deterministically. Pair/speaker IDs and actual order are recorded. Each take: roughly one second silence, natural prompt, one second silence; 15-second safety cap. The excluded spelling is not offered in new prompt lists; the historical N03 ID remains a metadata definition but is no longer offered by the legacy dropdown either.

**devval-v1: 21 clips per speaker, 42 total.** Ten natural Kural takes, one ordinary-conversation take of at least60 seconds (75-second safety cap), and ten confusable-word takes. This is separate-session development validation, not S02/S03 and not training. Use a separate sitting. The live Captured clock shows actual resampled time. Start/end boundaries for each devval wake must be manually selected using waveform/player/current-time controls and explicitly confirmed before Accept. No energy-derived boundary or detection is used.

Play each pending take, check the listened-content confirmation, then Accept & Next. For nonwake content this explicitly confirms literal wake absence; accidental Kural/uncertainty requires a preserved Re-take. Paired wake timing may remain unannotated for later work: content approval does not invent intervals or make the set training-ready. Progress is shown per speaker (40 or21); rejected/pending takes do not increment accepted counts. Reopen the same set folder to resume the first pending/incomplete task.

Required sidecar fields include speaker, pair_id, pair_type, member, prompt_text, label, order_in_pair, condition, sha256, duration, created_at and designation. Additional consent, content/boundary review, absence confirmation, actual audio format and immutable-record IDs are retained. `pair_id/pair_type/order_in_pair` are null for nonpaired devval tasks. `label` starts as prompt intent; pending/rejected takes are never accepted ground truth merely because the prompt was displayed.

### Fixed future pass criteria — not evaluated here

At **one** threshold from .50/.65/.80/.90, with unchanged two-consecutive-frame/one-second-cooldown event logic and frozen one-to-one matching:

- At least18/20 devval-v1 wakes matched.
- Zero false events on devval-v1 conversation and confusable words.
- S02 also passes its original all20-wake and false/echo/unmatched-event/exposure limits.

Only then may S03 be tested once under a separately explicit action. A failure keeps wake activation off and is documented as a rejected experiment. Short development exposure is not a reliable long-term false-activation bound; this devval design includes no playback-says-Kural test. No pass gate is run or relaxed by this collector.

### Actual checks

New `tests/kural_paired_collector.test.cjs` passes schema/hash/duration validation, all80/42 tasks, deterministic pair order, UTF-8 Tamil/Hindi, strict consent/review, separate directories, rejected/original preservation, versioned manifests, validated resume, missing manual dev boundaries and corrupt-file rejection. Existing legacy-collector and live-capture/controller checks pass unchanged. JS syntax check passes. No frontend build is needed: production frontend is unchanged.

Chromium opened the actual extended page at localhost with its fake microphone device and a **disk-backed test directory-picker adapter**. It captured dummy PCM, played it muted, re-took it, verified retained rejected WAV/JSON plus initial hash, accepted a second take, resumed progress, checked devval separation/manual-boundary gating, narrow bounds and track release on Stop/page exit. Real mode rejects a wrongly named output root before creating set files. No physical microphone or native folder-picker interaction was tested. Dummy dataset directories were deleted only within newly created, checked `kural-collector-test-*` roots; real set directories were not touched. Reports/screenshots remain ignored, latest `tools/local_wake_data/kural-collector-test-d2730e7c-477e-4846-a30c-91e8ea122ebf/result.json`.

Preservation: all37 snapshotted files remain byte-identical, including the checkpoint, S01/S02 annotation exports, all22 approved tour WAVs, Sherpa setup manifest and all11 manifest-listed Sherpa artifacts (also verified against their recorded hashes). No collected S03 directory or annotation export exists to hash; none was opened or created. Verification evidence: `tools/local_wake_data/kural-cnn-v1/paired-collector-verification-cf164b2d6d8e49b595654515feaa3117/`. Both staged and unstaged diff checks pass.

No models were loaded or executed. No live-diagnostic audio, S02 or S03 was imported. No cloud calls, training, approved-audio change, staging, commit or push.
