# Isolated personal Kural CNN baseline

2026-11-02. Default off; no production integration or activation approval. No training has run.

## Data and annotation gates

`tools/kural_training.py --prepare` verifies the effective S01 review overlay, consent, source hashes and readable mono PCM16/16 kHz WAVs. The prepared inventory has 125 usable recordings: 40 positives, 61 speech negatives and 24 background blocks (309.54 seconds). Four background blocks are narration echo (50.46 seconds), not ordinary wake-free negatives. The excluded silent original remains preserved and excluded by recording and lineage ID.

Content approval does not supply wake boundaries. Training requires a separate human annotation export for every usable recording: complete wake start/end intervals, or explicit reviewed absence. Echo intervals use playback rather than human source. The local annotation page embeds original WAV playback and a waveform; it makes no automatic proposals, microphone requests or uploads. No samples are edited. It exports labels rather than inventing them. Keep existing content corrections intact; if replay contradicts a negative label, correct the review before training.

From the Agent directory, the next action is:

```powershell
Start-Process ".\tools\local_wake_data\kural-cnn-v1\annotation-S01_TRAIN-c28f952493ab4da4826dccf995ed68a2.html"
```

Mark full wake intervals for positives and any narration-playback wakes; explicitly review absence for other recordings. Export `S01_TRAIN.annotations.json` into `tools/local_wake_data/kural-cnn-v1/annotations/`. Browser draft progress is keyed by dataset fingerprint. All originals/crops remain in their session; the baseline accepts original recordings only and generates traceable windows itself. Positive windows must contain an entire reviewed wake. No arbitrary positive-clip windows are assigned wake labels. Wakes longer than the two-second window require review rather than truncation.

S02_VALID has not been confirmed collected. Record it in a separate sitting using the existing pilot collector: 20 positives, 30 speech negatives and at least 300 decoded background seconds, including separately flagged echo. Review contents and boundaries/absence. Never split S01 for validation. Keep S03_TEST_RESERVED untouched. With the actual exported journal selected explicitly:

```powershell
& .\.venv\Scripts\python.exe .\tools\import_kural_pilot.py --import-collection --session S02_VALID --journal "<actual S02 journal path>"
& .\.venv\Scripts\python.exe .\tools\kural_training.py --prepare --s02-report "<new S02 validation.json path>"
```

Annotate the generated S02 page and place its export beside the S01 annotation export. The gate rejects missing/unreviewed records, missing consent, hash changes, excluded lineage, duplicate IDs, cross-split identical PCM, incorrect sessions and annotation/dataset mismatch. It requires reviewed minimum counts/durations in both sessions. Preprocessing statistics are fitted on S01 only.

## Isolated dependencies and setup evidence

Pinned direct requirements: TensorFlow 2.20.0, Keras 3.11.3, NumPy 2.2.6 on Python 3.11 x64. TensorFlow declares Keras >=3.10 and NumPy >=1.26; these pins satisfy declared constraints. Actual installation/module compatibility is not verified here. No pretrained weights or public datasets are used.

Official package metadata: [TensorFlow 2.20.0](https://pypi.org/pypi/tensorflow/2.20.0/json), [Keras 3.11.3](https://pypi.org/pypi/keras/3.11.3/json), [NumPy 2.2.6](https://pypi.org/pypi/numpy/2.2.6/json). TensorFlow's Windows CPython 3.11 wheel is about 331.8 MB; installed/transitive footprint has not been measured. TensorFlow and Keras use Apache-2.0: retain their license/notice obligations on redistribution ([TensorFlow license](https://github.com/tensorflow/tensorflow/blob/v2.20.0/LICENSE), [Keras license](https://github.com/keras-team/keras/blob/v3.11.3/LICENSE)). NumPy uses BSD-3-Clause and includes notices for bundled components ([NumPy license](https://github.com/numpy/numpy/blob/v2.2.6/LICENSE.txt)). Successful setup records all installed distribution versions and available license/notice hashes; dependency notices must accompany any later redistribution. Personal recording consent is not permission to publish recordings.

One isolated setup attempt created `tools/local_wake_data/kural-cnn-v1/environment/` but installed no training dependencies. Pip reported `No matching distribution found for tensorflow==2.20.0`; its log is `setup-030766c5862c4e0b9ebc55504621591c.log`. The official compatible wheel exists, so that error alone does not establish a socket, proxy or package-compatibility cause. No retry was made. Python was 3.11.9 AMD64; isolated pip reported no configured overrides. Existing Agent dependencies were not changed. Future setup captures verbose diagnostics, preserves the partial environment/logs, uses verified TLS and zero pip retries, and refuses wrong-prefix or mismatched pinned installations.

One resumable local setup command, when ready:

```powershell
& .\.venv\Scripts\python.exe .\tools\kural_training.py --setup
```

## One gated baseline and saved evaluation

```powershell
& .\.venv\Scripts\python.exe .\tools\kural_training.py --check
# Only after all gates and dependency loading pass:
& .\.venv\Scripts\python.exe .\tools\kural_training.py --train
# Resume the same interrupted reservation, never a new experiment:
& .\.venv\Scripts\python.exe .\tools\kural_training.py --train --resume "<reserved run directory>"
& .\.venv\Scripts\python.exe .\tools\kural_training.py --evaluate "<completed run directory>"
```

No arguments performs no setup/training. Training reserves one baseline, fingerprints data/configuration/dependencies/source and refuses incompatible resume or a second baseline. Scratch CNN: three stride-two convolutions (16/32/32 filters), global average pooling and three-class output (nonwake/human wake/narration echo). Fixed 16 kHz, two-second windows, 40-bin log-mel features, seed 1729, no augmentation/search. Epoch ordering is reproducible. Maximum 50 epochs, patience-five early stopping and cumulative 3600-second subprocess wall budget. Unique full-model checkpoints preserve optimizer state and the prior best checkpoint. Interrupted work retains logs/checkpoints; exhausted budgets do not authorize more tuning.

Run directories save dataset audit, window lineage, training-only normalization, configuration, versions, full model checkpoints, logs and validation predictions. Saved predictions drive threshold selection over the fixed candidate grid, with two consecutive frames and a one-second cooldown; the selected rule is frozen in an immutable decision file before any later held-out test. Report clip misses and negative clip activations separately from event misses/annotated wake count and false events/hour with actual negative duration. Echo events and seconds are separate. Event matching uses reviewed intervals and the configured one-second grace. Offline causal replay uses 80 ms timeline steps; annotated-end timeline delay, feature/inference processing time and model loading are separate quantities, not measured microphone streaming latency. S02 metrics are model selection on SPK01, never a final test or a generalization claim.

## Verification and remaining work

`GNANI_MOCK=true` focused Python tooling suite: **50 passed in 8.63 s** (training gates, importer/overlay, existing Sherpa/Whisper benchmark/setup). Four Node checks passed: annotation, pilot collector, top-up collector and original collector. Python compilation passed. Tests exercise missing/unapproved data, consent, excluded lineage, split leakage, segmentation, missing dependencies/wrong environment, install failure without retries, time limits, checkpoint preservation, resume/config mismatch, saved-prediction integrity and decision freezing. TensorFlow training/inference execution remains unverified because installation failed and data gates remain closed.

All 22 approved production WAV hashes match their manifest. Generated datasets, annotation pages, environments, logs, features and models are under Git-ignored `tools/local_wake_data/`. No frontend code changed; no frontend build was needed. No cloud/provider calls, synthesized audio, production changes, staging, commits or push. Current blockers: human interval/absence annotations, separately recorded/reviewed S02_VALID, and successful isolated dependency setup. There are no model measurements or accuracy/runtime results to report.


## Readiness recheck (2026-11-02)

Revalidated effective S01 sources and hashes: all 125 usable entries have granted/timestamped consent; the excluded original remains excluded. No S01 annotation export exists under the pipeline directory, and no annotation/S02 export was found among Downloads filenames. S02_VALID dataset is absent. Gate reports 125 missing per-record reviews, the resulting reviewed-minimum failure, and missing S02 (127 messages). Content-approved totals have not been revoked: the zero reviewed minimum refers to boundary/absence readiness only. Training was not launched, S03 was not accessed, and no predictions/evaluation metrics exist.

Isolated interpreter is Python 3.11.9, AMD64/64-bit, with pip 24.0 and setuptools 65.5.0 only. Isolated pip configuration has no override files; parsed options confirm no_index=false, index=https://pypi.org/simple, retries=0, timeout=15 seconds; no PIP/proxy/certificate environment overrides were present. One authorized setup attempt failed again, preserved separately in setup-8c1c4cae040e4495a02f72e95990c6eb.log. Output reports no matching TensorFlow distribution but supplies no DNS/TLS/socket explanation. Therefore neither package unavailability nor a specific network cause is established. No further attempts, dependency/version changes or speculative setup repair were made. No training dependencies were installed; Agent environment unchanged.

Recheck tests: GNANI_MOCK=true pipeline/importer/review suite **26 passed in 5.53 seconds**. All 22 approved production WAV hashes match; environment, dataset and model paths are ignored. Both staged/unstaged diff checks pass. No new tests or code repairs; this documentation is the only task edit. No frontend build needed. The immediate next action remains opening the S01 annotation page above, exporting reviewed boundaries/absence, and then collecting the separate S02 session. No staging, commit or push.


## Synchronized annotation playback (2026-11-02)

Updated the annotation template with a playback cursor (animation while playing, event updates on pause/seek/end), full-duration seconds ruler, millisecond current/total clock, click-to-seek, saved/draft start/end markers, shaded intervals and Play selected interval. Selected playback stops at the end boundary at browser event/animation precision; it does not trim audio or export new boundaries. The waveform uses actual PCM bin start times from the generator, with the same player duration/time mapping as cursor, seeking and boundary controls. Canvas and player share the available width, including narrow layouts; resizing repaints at device resolution. Recording changes cancel pending animation/selected playback; page exit pauses playback and disconnects resize observation. A peak is never automatically treated as a wake boundary.

A separate updated S01 page is `tools/local_wake_data/kural-cnn-v1/annotation-S01_TRAIN-d1971eaed0004cd6b31bba13e64cdf1d.html`. Open with `Start-Process` from Agent PowerShell. Earlier pages, reviews/exports and original audio are preserved. Dataset fingerprint, localStorage namespace and annotation export schema remain unchanged so existing saved reviews are reused in the same browser/profile. An old page that is still open should be closed before editing in the new page to avoid two tabs saving competing drafts.

Checks: annotation Node regression passed, including time/position/seek, playing/paused/ended state, stale animation after recording switch, resize, selected playback and saved-review/export preservation. Pipeline/importer/review Python suite: **26 passed in 6.05 seconds**. Both diff checks passed. Browser/audio listening verification was not performed; browser event scheduling is not sample-accurate clipping. No training, tour/audio modification, network calls, staging, commit or push.


## Pending-only annotation resume and verified save (2026-11-02)

The same generated page `annotation-S01_TRAIN-d1971eaed0004cd6b31bba13e64cdf1d.html` was updated in place; prior bytes were preserved in uniquely named `.bak` files. Generator options `--annotation-resume-after`, `--annotation-next` and `--annotation-update-page` validate IDs/order, page location and dataset fingerprint before updating. Dataset metadata/fingerprint, storage key `kural-cnn-boundaries-v1:<dataset_fingerprint>` and annotation export schema remain unchanged. Browser saved-state access was blocked by computer-use policy before contents could be inspected; actual saved-review count is therefore not independently confirmed. No browser storage was edited by the agent. The page reads the existing journal on load in the same browser/profile.

User checkpoint is c0d914f3-91bc-42ae-af25-5073b617e3dd; next is d0edc637-4831-4ef9-b10b-9b5e3ec2f1f6. Saved valid reviews determine completion. Entries through the checkpoint lacking valid reviews are navigation-only 'Previously completed - timings unavailable', never auto-approved or supplied with invented intervals. This skip metadata lives outside annotation records and is not exported as labels. Such entries remain missing training prerequisites. Pending-only is the default; Show completed exposes labelled saved reviews and navigation-only skips. Reopening selects the first pending recording (the stated next ID if still pending), with separate saved/pending/unavailable counts.

Save & Next Pending validates content/absence and complete non-overlapping intervals, persists the new journal successfully, then advances. Missing approval, invalid intervals, unreadable storage or a failed write keep the same recording and preserve the prior saved journal; manual draft boundaries remain on screen. No pending entries produces an explicit completion state and Show completed remains available. No training or automatic boundary assignment.

Verification: new resume Node regression and existing waveform Node regression pass. Pipeline/importer/review Python suite **27 passed in 4.43 seconds**, including same-path generation, byte-preserving backup, unchanged fingerprint and rejection of invalid checkpoint/order/dataset. The first resume regression exposed a progress-count callback issue; it was fixed and both regressions rerun successfully. Tests cover stored interval preservation, pending filtering, Show completed, reopening, invalid/failed saves without advancement, export exclusion of checkpoint skips and all-pending-complete state. Both diff checks pass. Actual browser saved state and visual reopening remain unverified because browser access was blocked. No tour/audio changes, training, staging, commit or push.


## Unreviewed RMS activity suggestions (2026-11-02)

The current same-path annotation page now includes local PCM-derived speech-activity proposals for pending positives only. The generator computes 20 ms RMS frames, estimates noise from the 20th percentile, and uses max(0.004, 3*noise, noise+0.003) as the activity threshold. It bridges gaps up to 180 ms, requires at least 80 ms active frames, pads start/end by 200/250 ms and merges overlapping padded regions. This is a conservative heuristic, not word recognition; it cannot guarantee quiet consonant coverage or distinguish Kural from other speech/noise. No boundary is inferred from screenshot pixels. Negatives and echo cases receive no proposals.

One region prefills timestamp inputs with amber shading and the label Unreviewed suggestion. Multiple plausible regions appear in a chooser without automatic selection. Play selected interval, adjust and explicitly check the listening/boundary/content confirmation before Save & Next Pending. The save action validates and persists successfully before advancing. Merely displaying/selecting/playing a proposal does not create a human-reviewed or approved record. Unconfirmed proposals are never exported as annotations. Manual drafts are retained across recording/filter changes in the open page, take priority over proposals, and edits reset confirmation. Saved records are not replaced. Save/export manual work before reloading an older tab; unsaved in-memory edits from an old page cannot be recovered by editing its HTML on disk.

The generator and current generated page were updated, preserving previous page bytes in a backup. Dataset fingerprint, annotation storage key, export schema, checkpoint and pending-only navigation are unchanged. The RMS metadata is outside the dataset manifest/fingerprint and is not a training annotation. Tests: both Node annotation/resume regressions pass; Python pipeline/importer/review suite **28 passed in 5.98 seconds**. Coverage includes silence/noise, padded PCM-derived regions, ambiguity, unconfirmed-export exclusion, explicit adjusted save and saved/manual/negative/echo protection. Generated-page checks confirm unchanged fingerprint and no negative/echo proposals or synthetic review records. Both diff checks pass. No browser/listening verification, training, tour/audio changes, staging, commit or push.


## S02 collection readiness (2026-11-02)

No S02-named files or matching generic pilot journals were found in the current Windows Downloads directory. No S02 import directory, prepared dataset or annotation export exists. No reusable S02 recording was identified; browser-only unsaved collector progress was not inspected. Do not reset any browser progress: select S02_VALID in the existing collector and export/reuse any existing takes if it displays them before recording the deficit. S01 annotations remain unchanged (SHA-256 1155efb5c3e7887aaba349d9e657593cfe2608053ea394303ce95e8c5135fda5). S03 was not accessed.

Missing file-validated collection: 20 positives, 30 speech negatives, at least 300 decoded background seconds. The existing collector cycles KP01-KP03 for positives and KN01-KN12 for negatives. Follow its displayed prompts, using one second silence around each natural wake; KP03 must include the displayed full phrase and only the wake receives boundaries. Speak complete negative phrases, varying normal pace/distance. Background KB01-KB04 are room/fan sound, KB05-KB08 consenting conversation, KB09-KB10 approved narration playback without speaking. Each planned block is 30 seconds; capture time is only an estimate and any decoded deficit needs a later supplemental block. Echo stays separately flagged, with literal playback wakes annotated as playback, never ordinary human activation or wake-free background.

From Agent PowerShell run `.\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools`, then open http://127.0.0.1:8766/collect_kural_pilot.html . In a separate sitting select S02_VALID, re-confirm consent/actual conditions, record only deficits shown by its separate progress, replay and export the session manifest. Keep every audio/JSON pair and journal together in Downloads. Do not use the S01 top-up collector or copy any S01 recording into validation.

After collection, import using the explicit S02 journal with `tools/import_kural_pilot.py --import-collection --session S02_VALID --journal <actual journal>`. Decode/validate first, resolve missing pairs or duration deficits, then prepare its independent annotation page using `tools/kural_training.py --prepare --s02-report <new S02 validation.json>`. Human review of every content/class and wake interval or explicit absence is required. RMS positive suggestions remain unreviewed until played/adjusted/confirmed; no negative/echo boundaries are assigned automatically. Keep S02 labels/data in validation. No training or test access is authorized by collection completion.


## S02 import completed; human annotation pending (2026-11-02)

Imported only SPK01/S02_VALID/validation rows from Downloads journal kural-personal-pilot-v1_SPK01_journal_609a2dfb-14de-4036-8706-1cd50440d364.json. Its other 123 session rows were excluded from this import, not modified. Preserved Downloads originals and verified 123 source/copy hash records (journal plus 61 audio/metadata pairs). Validation report: local_wake_data/kural-personal-pilot-v1/SPK01/S02_VALID/validation-4ab0d7a1c2d647a7a125952ef1c4f259/validation.json.

All 61 pairs are valid mono PCM16/16 kHz with complete decoded frames and consent/session/split metadata. Counts: 20 positives, 30 speech negatives, 11 background blocks totalling 300.60 seconds; no collection deficit. Two echo blocks total 59.64 seconds, leaving 240.96 ordinary background seconds; echo is not ordinary wake-free background. No missing pairs, metadata issues, decode errors, duplicate IDs or duplicate PCM within S02 or against S01. File validity is not ground-truth content approval.

Generated separate S02 annotation page: local_wake_data/kural-cnn-v1/annotation-S02_VALID-3117a41ffa13451793c2924c71cd9126.html. It has no S01 resume checkpoint and uses its own dataset-keyed saved progress/export filename. All 61 reviews remain pending. RMS positive suggestions are unreviewed, require explicit confirmation and do not enter annotation exports automatically; negative/echo entries have no automatic proposals. Echo intervals must retain playback source. S01 annotation hash remains 1155efb5c3e7887aaba349d9e657593cfe2608053ea394303ce95e8c5135fda5. S03 untouched; no training. No code changes or new tests were required for this import; relevant importer and annotation regressions were rerun.


## Pre-training readiness audit after both annotation imports (2026-11-02)

Both annotation/data gates pass: S01 125 reviewed recordings, S02 61. Hashes, complete PCM, consent, exclusions, original lineage, unique identities and cross-split PCM isolation validate. No S03 access. Planned windows retain source session/split; no augmentation is enabled, so there are no augmented samples to inherit incorrectly. S01 windows: 40 human-wake / 451 nonwake / 52 echo; S02: 20 human-wake / 291 nonwake / 60 echo. Each positive window fully contains its reviewed wake. These are deterministic segmentation counts, not trained predictions.

Fixed features are two-second 16 kHz windows, 25 ms STFT frames/10 ms hop, 512 FFT, 40 mel bins, log floor 1e-6 (198x40x1 input). Source inspection confirms mean/std fit on S01 features only and applied unchanged to S02; no per-clip normalization/denoising or augmentation. Dependencies remain absent: tensorflow 2.20.0, keras 3.11.3, numpy 2.2.6. No install attempt was made in this audit. Therefore actual TensorFlow feature computation, finite feature tensors/statistics and model loading remain unverified. No baseline reservation exists.

Frozen training config remains seed 1729, CNN 16/32/32 filters, Adam 0.001, batch 32, max 50 epochs, early stopping patience 5, cumulative 3600-second parent subprocess limit, hash-bound resume and preserved best checkpoints. Existing tests cover time limits/checkpoint/resume integrity. First training command (only after successful local isolated setup and dependency loading) is `.\.venv\Scripts\python.exe .\tools\kural_training.py --train`; no training was launched by this audit.

Evaluation source and mocked/synthetic denominators were checked. S02 has 20 annotated human wakes, 30 speech negatives plus 9 ordinary background blocks totalling 275.28 ordinary-negative seconds, and 2 echo blocks totalling 59.64 seconds. Clip-level classification uses maximum wake score; continuous replay events use the distinct fixed consecutive-frame/cooldown rule. Misses/20, ordinary false events per 275.28 seconds (and per hour), echo events per 59.64 seconds, and unmatched events on positive clips must be reported separately. Event matching permits detections during the wake through one second after its end; timeline delay can be negative for pre-end detections. Replay advances in 80 ms audio steps and is not live streaming latency. Threshold selection on S02 is validation model selection, frozen before later testing, not a held-out test. No measured scores/results exist yet.

Echo protocol qualification: S01's four echo blocks (50.46 s) and S02's two (59.64 s) are explicitly reviewed as having no audible literal wake and have no playback wake intervals. Those labels are internally valid and must not be changed or supplemented with invented timings. They provide narration-without-wake false-activation coverage only. They do not satisfy the broader self-trigger challenge in which speaker playback actually says Kural. That specific protocol condition is unmeasured/missing and would require separately consented/reviewed playback examples before claiming echo robustness or live activation approval. This limitation does not invalidate the present annotations or require relabeling them to run an exploratory baseline.

Audit evidence: local_wake_data/kural-cnn-v1/pretraining-readiness-22b132de8bf64d7996ed2f1780bc3760/readiness.json and window-lineage-plan.json. Relevant mocked pipeline/importer/review suite: **28 passed in 4.13 seconds**. Annotation export hashes unchanged. Both diff checks pass. Only documentation and ignored audit evidence added; no new tests/code repairs or frontend build. No installation, training, model results, S03 access, staging, commit or push.


## Dependency failure diagnosed and actual preprocessing passed (2026-11-02)

Confirmed isolated interpreter Python 3.11.9 AMD64/64-bit, pip 24.0, supported tag cp311-cp311-win_amd64. Isolated index is https://pypi.org/simple, no_index=false, no proxy/PIP/certificate overrides. Official PyPI publishes tensorflow-2.20.0-cp311-cp311-win_amd64.whl (331.8 MB): https://pypi.org/project/tensorflow/2.20.0/#files ; release metadata https://pypi.org/pypi/tensorflow/2.20.0/json ; official install guide https://www.tensorflow.org/install/pip . Thus the pin is compatible; no version change justified. A direct HTTPS metadata check in the restricted agent environment failed with URLError / PermissionError, errno 13 / WinError 10013 (socket access forbidden). Earlier terse pip output did not show this cause; it was preserved unchanged. Diagnostic evidence: setup-diagnosis-e317260d29a342499e99fe58fce0beb2.json.

Smallest fix was running the same authorized setup outside the restricted sandbox. No TLS/index/pins or global/Agent packages changed. Setup succeeded; log setup-45c9fe41d6ca4f2b94d650be2c9494af.log and dependency inventory preserved. Imports verified TensorFlow 2.20.0, Keras 3.11.3, NumPy 2.2.6. No pretrained weights or datasets downloaded.

Extracted the worker's existing feature and training-statistics calculations into shared helpers without changing their math, and added default-off tools/check_kural_preprocessing.py. It refuses the Agent interpreter and never constructs/fits a model. Actual local command: `.\tools\local_wake_data\kural-cnn-v1\environment\Scripts\python.exe .\tools\check_kural_preprocessing.py --check`. All 914 planned windows were processed: S01 [543,198,40,1], S02 [371,198,40,1]; all raw features, statistics and normalized outputs finite. Statistics fitted solely on S01. Deliberately replacing validation features with extreme constants did not change training statistics. Lineage/config/versions/stats and result saved under preprocessing-smoke-13635878984b4d53a026ef21cf49feb8/. Both annotation hashes and full validated dataset fingerprint remained unchanged. No baseline reservation/training/model exists.

Relevant mocked pipeline/importer/review suite: **29 passed in 5.92 seconds**, including default-off and wrong-environment rejection for the new check. Python compilation and both diff checks pass. Generated dependencies/features/evidence remain ignored. No frontend change/build, S03 access, training, staging, commit or push.


## Authorized single baseline result (2026-11-02, Asia/Calcutta)

Executed the requested --train command once using the frozen seed 1729/configuration. S01 only supplied training windows; S02 supplied validation. No architecture/threshold search beyond the predeclared validation grid and no repeat training. Run: local_wake_data/kural-cnn-v1/runs/baseline-5f8ee6cd19174de58759932ff48938bb/. Data fingerprint fdeb55cceac69c4e6376f20beb70a5fcca63e306031a5d103b90c49ad3e4d7ff; config SHA-256 147467973301f5339a231d87d44ebf9bca6164a276818043aa179f4a5c34885b.

Early stopping at epoch 10 (patience five); best epoch 5, validation loss 0.6758422255516052. Epoch-phase elapsed 16.297 seconds; full subprocess elapsed including preparation and validation replay 109.781 seconds. Best full .keras checkpoint is 202878 bytes (includes optimizer state, not a standalone deployment-size measurement). All ten checkpoints preserved. Best checkpoint SHA-256 4e7300c692507db84d83e6a36ed2f8f0b03bd4164a192a53f6f6f91601ce2bf5. Full identity, dependencies, normalization, window lineage/features, epoch logs, predictions and attempt log preserved. completion-artifact-hashes.json records hashes of all existing run artifacts. Nonfatal TensorFlow use_unbounded_threadpool/MapDataset unknown-attribute warnings were retained; the worker exited successfully. No failure evidence was discarded.

Evaluated saved S02 predictions with the existing --evaluate command. All configured thresholds 0.5/0.65/0.8/0.9 tie at 20/20 missed annotated wakes and zero unmatched/negative/echo events; the existing higher-threshold tiebreaker freezes 0.9, consecutive=2, cooldown=1 second. Clip-level: 20/20 positive clips missed; 0/39 ordinary negative clips activated; 0/2 echo clips activated. Event-level: 20/20 wake misses (100%), 0 ordinary false events in 275.28 seconds (0 observed/hour), 0 echo events in 59.64 seconds (0 observed/hour), and no matched detections from which to calculate wake-end delay. These short recordings and complete wake failure do not establish a reliable false-activation bound. Echo recordings contain no audible literal wake; no playback-says-Kural challenge was tested.

Model loading took 0.195 seconds; validation feature/inference processing took 83.666 seconds across the saved replay. These are offline timings, not streaming activation latency. This is SPK01 validation/model selection, not held-out test performance or generalization evidence. The baseline failed the intended detection task and is not approved for activation. No automatic tuning/retraining/deployment was started.

Verified best/latest checkpoint and predictions hashes, unchanged data/config identity and both annotation hashes. No code changes/tests were required for running the already checked pipeline; both diff checks pass. Training/evaluation artifacts remain ignored. No S03 access, tour/audio changes, staging, commit, deployment or push.


## Failed baseline diagnosed before any retraining (2026-11-02)

See [full diagnosis](F14_KURAL_BASELINE_DIAGNOSIS.md). Best checkpoint predicts nonwake on all S01 and S02 windows. Wake-ranking AUC is 0.51357 on S01 and 0.16823 on S02: evidence primarily supports failure to learn the minority wake class, with additional context/generalization concerns, rather than a threshold-only problem. Label/softmax/loss/index mapping is correct; all positive windows contain reviewed intervals and all 914 WAV-derived features exactly match cache. Right-padding offline short windows versus left-padding causal replay is a confirmed context inconsistency to address before another experiment; its causal effect was not isolated. Historical 0.9 is an unqualified failed-grid tiebreak, not an accepted threshold. Baseline files/checkpoints/predictions remain byte-identical. Separate diagnostic evidence is in local_wake_data/kural-cnn-v1/baseline-diagnosis-a13d10894fc146da809c4a00d0348403/. No retraining, label changes, S03 access, deployment, commit or push.


## Controlled shared-context repair and balanced overfit passed

See [controlled repair and proposed next run](F14_KURAL_BASELINE_DIAGNOSIS.md). Offline and replay now share tools/kural_audio_features.py (past-only context, left padding), with actual exact-feature parity across914 windows and finite normalized features. The one diagnostic S01-only 8-wake/8-speech-negative experiment memorized all16 examples at epoch97, final loss .084900; no echo or S02 fitting. Its model is diagnostic-only. This supersedes the old offline padding path, not the preserved baseline evidence. Baseline/source recordings/annotations unchanged. Next full binary/balanced configuration is proposed only; no full run or deployment was launched.


## Authorized binary v1 recipe frozen before launch (2026-11-02)

Exact machine-readable recipe: tools/kural_binary_config.json; default-off orchestrator/worker: tools/kural_binary_experiment.py. Seed1729, binary Conv16/32/32 + global average pooling + Dense2 softmax, Adam .001, no augmentation or class weights. Maximum50 epochs/3600-second worker subprocess limit; early stopping patience8, min_delta0 on S02 class-balanced recording-weighted cross-entropy. Within each recording average deduplicated-window CE, then average recordings within each binary class and average the two class losses. Full model checkpoints preserved every epoch.

Training is S01 only. Every epoch includes all40 wakes, 36 ordinary nonwake recordings selected cyclically from sorted IDs (advance36 per epoch), and all4 reviewed wake-free echo recordings. Seed+epoch shuffles classes into five batches, each8 wakes/8 nonwakes. One context per selected recording, endpoint index epoch modulo deduplicated candidate count. Endpoint IDs rotate without creating augmented audio; long recordings cannot contribute extra samples in an epoch. Echo becomes binary nonwake while retaining echo flags, and this recipe refuses echo with annotated literal playback wakes. Normalization uses the first deduplicated context of every S01 recording only, never S02.

Threshold grid [.5,.65,.8,.9], two consecutive80ms replay frames, one-second cooldown, match within wake start through wake end+1s. Qualification requires exactly20 annotated validation wakes, recall>=.9 (>=18/20), zero ordinary false events, zero echo events, zero unmatched events in positive clips, >=275 ordinary negative seconds and >=59 echo seconds. Select only among qualified candidates: minimize misses, then false events, then prefer higher threshold. If none qualifies, null threshold; all-miss output cannot qualify. This is a short SPK01 validation screen, not a rate guarantee or playback-says-Kural qualification. S03 untouched.

Before launch, binary plus existing pipeline/importer/review regressions: **37 passed in 13.72 seconds**; Python compilation passed. All artifacts will be written to a new ignored binary-runs directory with a separate one-run reservation. Historical failed baseline and overfit evidence are hashed before/after; no reset or replacement of their reservations/artifacts.


## Binary balanced v1 completed - no qualified threshold (2026-11-02)

Ran the authorized binary experiment once after 37 regressions passed. Frozen configuration SHA-256 3dc7c84cd6426c2c833d04f89017f530fd2c4b719c7f21e0caaed4f588cc31ba. Run: local_wake_data/kural-cnn-v1/binary-runs/binary-38d67c7b107b4593be674c2937fb97fd/. Actual sampling audit confirms all9 epochs each used80 distinct S01 records, five8/8 batches, 40 wakes, 36 ordinary negatives and4 wake-free echo records. S01-only125-record normalization verified; no S02 fit. All proposed endpoint deduplication, rotating record/context sampling and binary echo semantics are applied.

Early stopped at epoch9, best epoch1 balanced validation loss .7360255963. Epoch phase25.25 seconds, total subprocess118.688 seconds. Best full optimizer-inclusive checkpoint202474 bytes; all9 checkpoints retained. Final epoch training balanced loss .625803 versus validation1.471345, so later training improvement did not generalize to this validation session. No recipe adjustment or further run was started.

Qualification results (event misses /20, ordinary false events over275.28s, echo events over59.64s, unmatched positive-clip events):

| Threshold | Misses | Ordinary false events | Echo events | Unmatched positive events | Qualified |
|---|---:|---:|---:|---:|---|
| .50 | 1 | 247 | 55 | 21 | No |
| .65 | 20 | 41 | 2 | 20 | No |
| .80 | 20 | 0 | 0 | 0 | No |
| .90 | 20 | 0 | 0 | 0 | No |

Selected threshold is null. Do not treat .5 as an accepted operating point or a high-recall success: its false-event counts fail the frozen limits. At .65 every positive clip has a score crossing, but its events fail interval/consecutive matching; clip maxima alone do not measure timely wake activation. No threshold was selected by weakening limits.

S02 causal replay wake-score min/median/max: positives .50109/.64945/.72158; ordinary negatives .46978/.55523/.72160; echo .48845/.51336/.72145. Per-clip maximum ranges: positives .72135-.72158, ordinary negatives .72095-.72160, echo .72141-.72145. Strong overlap precludes claiming discrimination from these scores. No live latency or held-out test was measured; this is SPK01 S02 validation. Echo remains wake-free narration only, not playback that says Kural.

Preserved frozen identity/config, dependency versions, train-only stats, deduplicated window lineage, every epoch's sampled IDs and losses, all checkpoints, saved replay probabilities, per-threshold metrics and score distributions. Artifact hashes verify; original failed baseline, overfit diagnostic, source recordings/dataset identity and both annotation hashes unchanged. New regression tests cover balanced/unique/rotating sampling, endpoint deduplication, validation/session/echo gates, all-miss null threshold, recall/false-event/duration criteria and default-off behavior. Compilation and both diff checks pass. No frontend build required; no S03 access, deployment, staging, commit or push.


## Binary startup/silence diagnosis completed (2026-11-02)

See [causal-score diagnosis and plots](F14_KURAL_BINARY_DIAGNOSIS.md). Empty and full digital silence both score .72155821, explaining unrelated startup maxima. Every S02 .65 positive event occurs at .160s before the reviewed wake and consumes cooldown; independently verified timestamp/aggregation/matching arithmetic is correct. Many .5 false events remain in full context. No validity rule or threshold was changed. Proposed smallest repair is explicit history-validity state handling with raw-score/startup diagnostics and silence probes, without dropping short positives or claiming warm-up alone fixes detection. No retraining. Protected runs and annotations remain unchanged.


## Context policy replay and S01 negative-support proposal (2026-11-02)

[Detailed implementation, all20 wake statuses and training proposal](F14_KURAL_CONTEXT_VALIDITY.md). Implemented full-real-history-v1, explicitly masked event state: ineligible contexts break streaks and cannot prime cooldown. Actual unchanged-checkpoint replay reproduces all61 raw score sequences exactly. Fourteen S02 positives are too short and one matching deadline closes before valid history; all20 remain counted. .50 gives15/20 not-detected,189 ordinary false events and52 echo events; .65 gives20/20,2 ordinary,0 echo. No threshold qualifies; limits unchanged. Startup and eligible support are reported separately.

Independent S01 audit found no very-low-energy startup negatives in best-epoch exposure, despite all85 approved-negative .08s prefixes scoring around.721. A minimal S01-only prefix/quiet negative sampling repair is documented but not trained. Runs, originals, labels and raw scores unchanged; no S03 access or production activation.


Final scope: the two-second real-history gate is DIAGNOSTIC ONLY. Primary binary evaluation is verified unchanged/ungated with all20 S02 wakes; no fitting/production path imports this gate. The documented S01-only negative-support proposal preserves all40 complete-wake positives and all reviewed labels. No retraining until separately authorized after proposal review.


## Negative-context v2 bounded experiment result

[Full sampler-only repair results](F14_KURAL_CONTEXT_VALIDITY.md): one run early-stopped at epoch12/best4 in88.656s. Exact v1 normalization parity and complete-wake preservation verified. Silence score fell .721558 -> .081831, but no threshold qualifies. Ungated all20 S02 misses at [.5,.65,.8,.9] are [12,14,19,20]; ordinary false events [109,48,11,2] over275.28s; echo [52,4,0,0] over59.64s; unmatched positive events all0. Frozen qualification unchanged; two-second gate diagnostic-only. Prior evidence, labels and data preserved.52 pre-run regressions passed. No repeat training, S03 access, deployment, commit or push.
