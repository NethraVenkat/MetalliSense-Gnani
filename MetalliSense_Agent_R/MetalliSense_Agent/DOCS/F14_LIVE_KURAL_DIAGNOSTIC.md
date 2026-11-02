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

### Empty output-root selection repair

The old rejection checked only `FileSystemDirectoryHandle.name === 'kural-paired-collections-v1'` (real mode). It did not require a marker, pre-existing manifest, dummy clips or initialization. Therefore that exact error means the picker returned another folder name; an empty directory was not the cause. Record also intentionally stays disabled until consent is checked.

The picker now shows the actual selected name on rejection. Selecting `local_wake_data` safely resolves only its existing `kural-paired-collections-v1` child, without creating another dataset. Exact-root selection remains supported. Set-directory creation is deferred until the first saved take, so choosing/checking an empty root leaves it completely empty. No marker or initialization button is necessary. The HTML uses a versioned collector-script URL to refresh stale code.

Refresh the collector tab with Ctrl+F5. Choose output root, paste this path into the Windows picker address bar, press Enter, then click **Select Folder** while inside this directory:

```text
C:\Users\Manish\Documents\MetalliSense-Gnani\MetalliSense_Agent_R\MetalliSense_Agent\tools\local_wake_data\kural-paired-collections-v1
```

Do not select a `train-paired-v1`, `devval-v1` or another dataset subfolder. Then choose speaker/actual condition and check consent. The status explicitly explains that consent enables Record.

Verification: `tests/kural_paired_root.browser.cjs` opened Chromium with fake-mic flags and a **read-only disk-backed picker adapter referencing this exact real directory**. Both modes accepted it; consent enabled Record; selecting the known parent also worked. Record was never clicked, microphone requests were zero, and the directory remained empty before/after. Native Windows picker interaction was not automated. No dummy clips were created or needed cleanup. Evidence: `tools/local_wake_data/kural-cnn-v1/paired-root-check-9fa14d30-8f66-41fd-a1de-17710be5c0ed/`.

Unit regressions pass for empty-root/no-write handling, exact/parent selection and wrong-root rejection, plus prior paired schema/storage tests. Existing legacy collector checks pass after pinning their original-prompt comparison to `039538d` instead of mutable HEAD (HEAD now already includes HN01). No production prompt was changed by that test repair. No build needed; standalone tools only. No recording, model execution, S02/S03/audio changes, staging, commit or push.

### Conversation duration repair (2026-11-03, Asia/Calcutta)

Two real manish-DC01 takes saved only59.008s and58.112s. The configured maximum was already75, not60; the other new prompts use15s. The historical30s MediaRecorder timer belongs to legacy mode and does not run in devval mode. No VAD, silence stop, startup trimming or deliberate resampler truncation was found. The confirmed design mismatch was a wall-clock stop versus a minimum measured from actual captured PCM; old sidecars do not retain start/stop reasons/timing, so the particular browser/device cause of missing wall-time audio cannot be proven retrospectively.

Conversation now stops on manual Stop or a hard **75-second saved-audio/sample-count limit**, never automatically at60 or a separate wall deadline. The UI shows both captured-audio and elapsed wall seconds, with an explicit **60 s reached** indicator. Keep the tab active and wait for that indicator before pressing Stop. Wall time may exceed captured time if browser capture stalls; this is displayed rather than hidden by padding. The75s bound limits real PCM frames to1,200,000; it adds no samples. Other prompt wall limits remain15s. Acceptance still validates duration from complete PCM frames in the saved16kHz WAV and refuses anything below60s. New sidecars retain stop reason and wall/saved durations for future diagnosis. The script URL is versioned for refresh.

The59.008s take was already rejected. The58.112s take was pending; using the existing validated decision helper it was archived as rejected, with identical audio hash and immutable original retained. The previous manifest was journaled. All pre-existing devval files except the current manifest remain byte-identical; ten accepted manish wake WAVs and sidecars match their pre-repair hashes. No deletion. The earlier30.848s rejected take is also preserved. Evidence: `tools/local_wake_data/kural-cnn-v1/conversation-fix-56c5c2ad8d50457f9f906eec5c25a9ab/`.

Regressions pass for a68s PCM conversation being acceptable with explicit content/absence review,59s remaining refused, an oversized packet stopping at exactly75s, and all other prompt limits unchanged. Chromium fake-device capture ran for68 wall seconds in a separate test-only devval directory: **67.968s**,1,087,488 frames, manual-stop reason,68.1989s recorded wall elapsed; Accept succeeded, and the60s indicator was observed. Ten synthetic fixture wake hashes also stayed unchanged. Test datasets were removed only from their checked test root. Result: `tools/local_wake_data/kural-collector-test-7065dd1c-f189-4ee5-aca5-52716c2353dc/result.json`. Physical microphone behavior still needs user verification. No model, inference, training, S02/S03, train-paired-v1 dataset or approved-tour-audio access/change.

Refresh the collector with Ctrl+F5, reopen the same output root, and select manish/devval-v1. The rejected takes do not block the next conversation attempt. Speak until **Captured** reaches at least60s (e.g.65–68s), then Stop and listen/confirm before Accept. No frontend build is required for these standalone collector changes. No staging, commit or push.

### Accepted paired wake boundary-review mode

2026-11-03. No training/inference. On the existing collector, open:

```powershell
Start-Process "http://127.0.0.1:8766/collect_kural_recordings.html?mode=paired-v1&review=boundaries"
```

If needed, start the same server from Agent: `.\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools`. Refresh old tabs with Ctrl+F5, then choose the same `kural-paired-collections-v1` output root.

Only the20 accepted manish A01–A10/B01–B10 wake clips are shown, in fixed pair order. There are no capture controls or microphone requests in this mode. Play/listen, enter millisecond start/end or use current playback time, play the interval, explicitly tick boundaries reviewed, then **Save & Next**. Start/end must be inside the clip and ordered; spans over2.0s produce a warning and are not saved or silently truncated. Invalid/unconfirmed saves do not advance. The waveform shades the manual interval and follows playback; no suggestion or detector supplies timings.

Each save creates a unique append-only `train-paired-v1/boundary-reviews/manish/<timestamp>-<uuid>.json`, linking task/recording ID, original WAV SHA-256, manifest SHA-256, manual interval and explicit human review. WAVs, original sidecars, manifest and manifest history are not rewritten. All previous annotation revisions are retained. Reload validates the annotations and resumes the first unreviewed wake; counter is `boundaries: n/20`. The read-only v2 preflight can merge validated overlays in memory without modifying source labels/files. No training entry point was added or run.

Checks: new boundary unit tests pass validation/confirmation, accepted-wake-only selection, append-only revisions, original manifest preservation, hash linkage and resume. Chromium with fake-mic flags and a disk-backed picker adapter used a disposable **test copy**, tested interval rejection/playback, Save & Next and reload at1/20/A02 with zero microphone requests. Test-only annotations were removed with that copy; none was saved to the real dataset. Real40 paired and21 devval WAV hashes, their sidecars and both manifests match before/after. Evidence: `tools/local_wake_data/kural-collector-test-f963b15f-b7a4-4e3b-bfdf-975e4bb625b1/result.json`. No S02/S03, tour audio, staging, commit or push.

### Revised one-speaker experiment criteria and latest gated attempt

2026-11-03, Asia/Calcutta. Builder: Manish. The following is copied unchanged from the predeclaration in `F14_KURAL_PAIRED_V2_EXPERIMENT.md`; it supersedes the earlier two-speaker devval target. No training has started.

> Same event rules: 2 consecutive frames, 1 s cooldown, thresholds 0.50/0.65/0.80/0.90 only.
>
> PASS only if ONE single threshold gives ALL of:
> a) ≥9/10 manually-bounded wakes detected in devval-v1 (detection must overlap the human-marked interval).
> b) 0 events on the devval-v1 conversation (manish-DC01) and 0 on the 10 confusable words.
> c) S02 passes its already-documented criteria at that same threshold.
>
> Known limit stated in advance: one speaker only; குறள் excluded.
>
> S03: if no S03 recordings exist, state "S03 not available, not evaluated"; do not create or substitute one.
>
> If FAIL: the wake word stays off and is documented as a rejected experiment. No second run, no threshold search, no relabelling.

Latest explicit `kural_paired_v2_preflight.py --check` report: `tools/local_wake_data/kural-cnn-v2-paired/preflight-3aec8754ee8848c89201adf215d0f93c/preflight.json`. Result **PREFLIGHT FAIL / BLOCKED**. Paired40/40 accepted, devval21/21 accepted, ten devval wake boundaries and75s accepted conversation pass; path/hash leakage gate passes. Training boundary gate fails:0/20 reviewed paired wake boundaries. The real `train-paired-v1/boundary-reviews/` directory does not exist; all20 accepted wake sidecars have empty intervals and unreviewed boundaries. Downloads has no matching paired-boundary export. The previously verified annotations were test-copy fixtures and were never imported into real data.

No training reservation, checkpoint or inference was launched. Training time0; fitting sources used0 (intended125 original+40 paired=165). v1/v2 devval and S02 results at all four thresholds are **not run**, not zero events or a model FAIL/PASS. The single authorized training run remains unspent. All454 protected files in the preflight snapshot, including v1 artifacts, S02 annotations,22 tour WAVs and paired/devval files, verified unchanged. S03 not available, not evaluated.

Next required manual action: open boundary-review mode above, choose the real prepared root, confirm and **Save & Next** for all20 wakes until `boundaries: 20/20`. The files must appear under the real `train-paired-v1/boundary-reviews/manish/`. No rerecording is needed. Do not infer boundaries or use devval timings to fill training labels.

### Single authorized paired-v2 experiment completed — FAIL

### Prisma pause-gated STT test — predeclared before any provider call

### Pause-v2 predeclaration — fresh devval-v2 only

2026-11-03. Builder: Manish. Written before any pause-v2 call. Pause-v1 is rejected; it is not rerun or reclassified under v2.

> Clip start counts as preceding silence. Keep fixed20ms RMS≥0.01 speech frames and≥0.5s intervening silence. Confirm an onset only after≥100ms contiguous speech; ignore shorter bursts and retain the candidate burst start as onset. Send exactly1.5s from that onset, padding the missing tail with digital silence at EOF. Original recordings are never padded or rewritten.
>
> Wake only when the FIRST word of NFC/casefold normalized transcript, with punctuation stripped, is குரல், குறள் or kural. Every other transcript is not wake. No substring or phonetic alias matching.
>
> API fields unchanged: Prisma v3.0, ta-IN,en-IN, codemix, keyterms=["குரல்"]. No other prompt or parameter changes.
>
> PASS only if≥9/10 DW wakes,0/10 confusable wakes and0 sent conversation snippets are wake, at these same settings. Evaluate once on a FRESH devval-v2 only; report conversation total onsets/min and selected calls/min. No-onset DW is a miss; unsent negatives are disclosed. Incomplete calls cannot PASS. If FAIL, record a rejected experiment. No rule changes after results. Only first onset per DW/confusable; conversation all onsets up to first10 as before.

Offline devval-v1 use is limited to snippet timing verification, not transcript re-evaluation or new calls. Expected check: each DW first onset within±0.2s of its human start and each snippet exactly1.5s. A failed timing check must be reported, not tuned to pass. Fresh devval-v2 requires new recorded WAVs and human reviews; no old files, transcripts or labels are copied into that set.

### Pause-v1 observed result — FAIL, rejected (no new calls)

Read the immutable v1 journal:15 attempts reserved,14 successful HTTP200 responses, stopped with `manish-DC01-06` still `attempt_reserved`. That row has no ended_at, HTTP status, transcript or exception. The reason for stopping and whether the pending request reached/completed at the provider are **not logged**; do not infer a quota/network cause or re-send it.

DW01,03,05 returned `குரல்`; DW02,04,09 returned `குரல்.`. All six were wake under the original contains rule. DW06–08 returned empty transcripts; their old first qualifying snippets were only **0.248s,0.2573125s,0.0373125s**, respectively. The v1 harness selected late onsets after requiring actual leading silence and truncated at EOF instead of ensuring the intended1.5s input. DW10 was not sent. These are input/harness failures, not proof the STT cannot hear the original words. Confusables were not sent and their performance is unknown.

DC01-01..04 were not wake. DC01-05 returned exactly UTF-8 **`என்னடா, என் கண் இவ்வளோ குரல்?`**, causing one false wake under v1 substring matching on reviewed wake-free conversation. Record this as the requested **keyterm-biased false wake**: it occurred with the Kural keyterm enabled; no unkeyed control isolates the keyterm's causal contribution. It is not independently verified transcription of audible Kural.

**pause-v1 = FAIL under its predeclared rule (harness truncation + one keyterm-biased false wake); rejected experiment.** Six of the ten DW clips produced wake, and the zero-conversation-wake criterion was already violated; incompleteness cannot turn that into PASS. The run remains incomplete with an uncertain final attempt; no remaining snippets will be called or evaluated. Preserve `journal.json` and all v1 artifacts unchanged. Separate offline record: `tools/local_wake_data/pause-v2-preparation-8a2a7f30519a4547a3647f5935dbb18e/pause-v1-result.json`.

### Pause-v2 preparation and timing-only outcome

The existing collector supports **devval-v2** as its own designation/directory, using the same10 reviewed wakes,≥60s conversation and10 confusables per speaker as devval-v1. For this single-speaker test, record manish's21 new takes in a fresh sitting; do not copy old recordings. Choose the existing prepared output root. Actual files are saved in `kural-paired-collections-v1/devval-v2/`; all devval-v1 manifests/audio stay unchanged.

```powershell
.\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
Start-Process "http://127.0.0.1:8766/collect_kural_recordings.html?mode=devval-v2"
```

Refresh old tabs with Ctrl+F5. For each fresh wake, listen/mark its real interval and explicitly review before Accept. Confirm literal-wake absence for new nonwakes; reject/retain accidental or uncertain content. The pronunciation alias `குறள்` is a transcript-matching allowance only, not a new spoken collection prompt. This fresh set is evaluation-only, never training.

Updated `kural_gnani_wake_test.py` defaults to pause-v2 and `--set devval-v2`. V1 functions remain for provenance/tests but CLI live calls on devval-v1 are forbidden. A v2 single-evaluation reservation prevents running a changed plan; it has a distinct output/journal directory. Matching is first-word only; keyterm and all API settings unchanged. Original WAVs stay untouched; only generated snippets are tail-padded to24000 samples. Fresh evaluation rejects any accepted source reused by WAV or PCM hash from devval-v1. Live execution is still user-only and not run here.

Executed **only**:

```powershell
.\.venv\Scripts\python.exe .\tools\kural_gnani_wake_test.py --dry-run --set devval-v1 --timing-check
```

Timing artifacts: `tools/local_wake_data/kural-prisma-pause-v2/timing-only/aacf24b2e5af330e9d87/`. No transcript reads/matching or provider calls occur in timing mode, and its plan cannot be used by the sender. Every DW has a1.500s snippet. Signed onset offsets from reviewed starts for DW01..10: **−.020,−.002,−.035,−.020,−.005,−.008,−.010,−.450,−.007,+.020s**. Thus **9/10** satisfy±.2s; **DW08 fails**, with an energy-triggered≥100ms candidate450ms before its human wake. RMS is not word recognition; no rule adjustment was made to hide that discrepancy. This timing check is not a v2 recognition evaluation, and v2 is not claimed validated/ready for live activation.

After new collection/review, offline planning command is `python .\tools\kural_gnani_wake_test.py --dry-run --set devval-v2` using the backend interpreter. The future user-only evaluation command (not executed) is `python .\tools\kural_gnani_wake_test.py --live --set devval-v2 --max-calls 30`. No old v1 transcript is retrospectively scored with v2. Fresh devval-v2/live results remain pending; the timing discrepancy is disclosed for review before spending calls.

Verification:7 Python harness tests passed in0.18s, including .27s word onset with clip-start credit, ignored50ms click, exact1.5s padding, first-word positives/negatives, timing-plan send refusal, single-plan reservation, old journal/resume/cap behavior and dry-run no sender. Paired collector tests pass separate devval-v2 designation/directory and wrong-manifest rejection; legacy tests and JS syntax pass. All original v1 artifacts and paired/devval-v1 source hashes match the pre-task snapshot; v1/v2 checkpoints and22 tour WAVs match. Fresh devval-v2 directory was not populated, live reservation is absent, no v2 calls. Both diff checks pass. No frontend build needed; no dependency installation, inference/training, app integration, staging, commit or push.

2026-11-03. Builder: Manish. User-run only; agent performs dry-run/mocks. Previous CNN FAIL stands.

> Pause rule: an utterance onset is speech after at least0.5s silence; send the first1.5s from onset (truncate at recorded EOF, never pad). Fixed local energy VAD: nonoverlapping20ms frames, normalized PCM RMS ≥0.01 is speech, otherwise silence; require25 consecutive silent frames before an onset, including actual leading silence only. No automatic initial-silence credit, smoothing, adaptive tuning or thresholds selected from transcripts. DW/confusables use their first qualifying onset; DC01 uses all qualifying onsets up to the first10, reporting total onsets. No onset means no call and, for a DW, a miss.
>
> Wake = Unicode NFC/casefold normalized transcript contains குரல், குறள் or kural; nothing else. Literal substring containment, no phonetic aliases or transliteration.
>
> PASS only if ALL: at least9/10 DW wakes are wake;0/10 confusables are wake;0 sent DC01 snippets are wake. Report DC01 total onsets/minute and selected-call rate separately. Single evaluation; no prompt/keyterm/rule changes after results. If FAIL, rejected experiment. Incomplete/error results are not PASS. No-onset negative clips are reported as unsent, not successful STT negatives.

Official verified contract: https://docs.gnani.ai/api/STT/speech-to-text documents `POST https://api.vachana.ai/stt/v3`, multipart `audio_file`, `model=prisma-v3.0`, `language_code`, `format=codemix` and `keyterms` (JSON array string or comma-separated). Fixed test fields: `language_code=ta-IN,en-IN`, `format=codemix`, `keyterms=["குரல்"]`. Keyterms bias recognition; they do not enforce wake accuracy. Also checked https://docs.gnani.ai/api/STT/models/prisma-v3 . No topic, previous_text, substitutions or extra prompts. No global app config changes.

Dry-run completed with0 network calls. Plan/snippets: `tools/local_wake_data/kural-prisma-pause-v1/8f27b622a8a386e2e2bf/`. **25 planned calls**: DW01–DW09 one each; DW10 zero; DN01/02/04/05/07/09/10 one each, DN03/06/08 zero; DC01 all9 onsets from75s, **7.2 onsets/calls per minute**. No onset is assigned to a word automatically. The first qualifying onset may be nonword activity; this is deliberately part of the frozen energy-gate evaluation. Unsent DW10 remains a miss; unsent negatives are explicitly disclosed, not evidence of STT rejection. Full onset times, snippet boundaries/hashes and source hashes are in plan.json.

From Agent PowerShell, the owner may run the single evaluation:

```powershell
.\.venv\Scripts\python.exe .\tools\kural_gnani_wake_test.py --live --max-calls 30
```

Default invocation or `--dry-run` only prepares/validates. Live credentials come only from backend `.env`; the app's retrying client is not invoked. Requests are sequential with at least1.1s spacing and zero transport retries/fallbacks. Attempts are journal-reserved before send; completed results are reused. Any failed/uncertain reserved attempt stops future sends rather than being retried. A cumulative30-attempt ceiling and exclusive live lock apply; no probe. Stop and inspect failures, do not remove journals to repeat. Only the25 planned audio snippets may be sent. TLS verification stays enabled. JSON results and a result table append to this document after the owner's run; before live, outcome is **NOT RUN**, not PASS/FAIL. This is cloud-assisted checking after local energy gating, not an always-local wake detector; ordinary speech can cause billable uploads. No tour connection.

Tests:4 passed in0.14s for actual-silence onset requirement, Unicode wake matching, cumulative cap/resume/spacing, stop-on-error and default dry-run never constructing a network sender. Source verification passed all474 protected files plus devval source hashes; v1/v2 checkpoints and22 tour WAVs unchanged. Both diff checks pass. No dependencies installed, no inference/training, no live provider call, no frontend build needed, no staging/commit/push.

2026-11-03, Asia/Calcutta. Builder: Manish. The preceding blocked status is historical: preflight `preflight-5bf9195f2a1e4787af7c1326ac6cbe60` passed all gates after20 real boundary reviews were saved. Exactly one training reservation and one bounded run were executed. No repeated run, new tolerance, relabelling or threshold optimization.

Run: `tools/local_wake_data/kural-cnn-v2-paired/kural-cnn-v2-paired-4377c648253f4cdf97ee0603a3c8269e/`. `results.json` contains the full comparison; raw predictions and all28 epoch checkpoints/logs remain preserved. Best checkpoint `checkpoints/epoch-20.keras`, SHA-256 `7d2298558fd3bb16c30eae964521bcd12708b869205da8903a13338f9941fa26`,202474 bytes. Early stopping at epoch28. Training epoch phase155.750s; complete subprocess412.609s including feature preparation, model loading and final evaluation. No timings are streaming detection latency.

Fitting used all165 intended unique sources: exactly125 original S01 sources plus40 accepted paired clips;60 wake and105 nonwake sources (including the original four wake-free echo sources). Actual selected updates2240:28×40 wake and28×40 nonwake. Five8/4/4 batches per epoch retain the original prefix/regular support. The original125 alone fit normalization; normalization, configuration and feature JSON are **byte-identical** to v1. Architecture equivalence was verified offline from both checkpoint configurations. Complete reviewed wake containment and actual fitting-session lineage were checked after the run. Devval/S02/S03/live/rejected sources never fitted.

Rules are exactly the one-speaker predeclaration above: devval events must fall inside the human interval, without grace; S02 retains its frozen end+1s rule. Each threshold is independent. Conversation counts include cooldown repeats and are not word counts.

| Model | Threshold | Dev wakes /10 | Conversation events | Confusable events | S02 matched /20 | S02 result | Overall |
|---|---:|---:|---:|---:|---:|---|---|
| v1 | .50 | 0 | 69 | 0 | 8 | FAIL | FAIL |
| v1 | .65 | 0 | 55 | 0 | 6 | FAIL | FAIL |
| v1 | .80 | 0 | 29 | 0 | 1 | FAIL | FAIL |
| v1 | .90 | 0 | 1 | 0 | 0 | FAIL | FAIL |
| v2 | .50 | 0 | 71 | 3 | 14 | FAIL | FAIL |
| v2 | .65 | 0 | 62 | 0 | 9 | FAIL | FAIL |
| v2 | .80 | 0 | 0 | 0 | 1 | FAIL | FAIL |
| v2 | .90 | 0 | 0 | 0 | 0 | FAIL | FAIL |

S02 ordinary/echo/unmatched-positive events, respectively: v1 `.50=109/52/0`, `.65=48/4/0`, `.80=11/0/0`, `.90=2/0/0`; v2 `.50=223/56/1`, `.65=160/20/0`, `.80=3/0/0`, `.90=0/0/0`. S02 exposure remains275.28s ordinary and59.64s echo, with all20 wakes. Zero events at high thresholds does not pass the wake-recall requirement. The strict devval denominator remains all10 reviewed wakes; zero overlap matches are not silently replaced by clip maxima or delayed events.

**FAIL: no common threshold meets the declared criteria. Wake activation stays off; kural-cnn-v2-paired is a rejected experiment. No second run is authorized or launched.** S03 not available, not evaluated. One speaker only; the excluded spelling was not added. These inspected development/validation results are not generalization evidence or a reliable long-term false-activation rate.

Checks:38 focused preflight/paired/binary/negative-context/pipeline regressions passed in13.33s before launch. Final preservation audit passed all474 protected hashes, including v1 artifacts, S02 annotations,22 approved tour WAVs and every paired/devval WAV/sidecar/review; all226 training+S02 source WAV hashes also match. v1 checkpoint SHA-256 remains `eb18391180ff973721f618e0e03cfb49c11eb6869bf67c9602365958fbdb6315`. All run-artifact hashes verify. Audit: `tools/local_wake_data/kural-cnn-v2-paired/verification-cd9381bf0eeb445e83909d2a9d9ff4e6/verification.json`. Both git diff checks pass. No frontend source changed, so no frontend build. No downloads/installations, Gnani/cloud requests, tour integration/audio change, S03 recording access, staging, commit or push.
