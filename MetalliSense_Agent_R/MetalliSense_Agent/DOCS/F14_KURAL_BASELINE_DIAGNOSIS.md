# Failed baseline diagnosis - 2026-11-02

Run: `baseline-5f8ee6cd19174de58759932ff48938bb`. No retraining, label change or threshold acceptance. Diagnostic outputs are separate under `tools/local_wake_data/kural-cnn-v1/baseline-diagnosis-a13d10894fc146da809c4a00d0348403/`. Every baseline file hash is checked before/after; its historical decision file is preserved unchanged.

The main finding is failure to learn the minority wake class, with additional session/context shift. This is not solely a generalization failure: the best checkpoint classifies every training window as nonwake too. Class imbalance is a plausible contributor, not experimentally isolated causation. No label-index, softmax/loss or score-extraction defect was found.

## Loss and class balance

Training window counts: nonwake 451 (83.06%), human wake 40 (7.37%), echo 52 (9.58%). Validation: 291 (78.44%), 20 (5.39%), 60 (16.17%). Training accuracy stays 83.06% from epoch 2 onward; validation stays 78.44% throughout, exactly the majority-class baselines. The saved best checkpoint's confusion matrices put every row in the nonwake column. Wake and echo class argmax recall are zero on both splits.

Training loss decreases 0.72973 -> 0.54873 over 10 epochs. Validation loss starts 0.76610, is best at epoch 5 (0.67584), and ends 0.69628. Epoch 5's re-evaluated training loss is 0.56451; its epoch training log loss (0.58417) was accumulated while weights changed. These losses need not match. Early stopping selected overall unweighted validation loss, not wake recall. No class weights or balanced sampler are configured. Most windows arise from overlapping negative/background chunks; they are not independent recordings.

## Best-checkpoint wake probability distributions

Values below are class-1 softmax probabilities on the actual saved two-second offline windows. Median in parentheses.

| Split | Human wake | Ordinary nonwake | Narration echo |
|---|---|---|---|
| S01 | 0.06213-0.16549 (0.09717) | 0.00887-0.17441 (0.09180) | 0.00900-0.16048 (0.11163) |
| S02 | 0.02065-0.06555 (0.03970) | 0.00865-0.16129 (0.11078) | 0.02710-0.15285 (0.12972) |

Diagnostic positive-versus-all-other window ROC AUC is 0.51357 on S01 and 0.16823 on S02. These are descriptive scores on correlated windows, not an independent test or a selected decision rule. S01 has little useful ranking; on S02 many negative/echo windows outrank positives. Lowering a threshold cannot be assumed to fix this ordering/overlap.

Saved S02 causal replay frame ranges: positives 0.00864-0.06681, ordinary negatives 0.00864-0.16267, echo 0.00868-0.15362. Clip maxima ranges are 0.02061-0.06681 for 20 positives, 0.01506-0.16267 for 39 ordinary negative clips and 0.14579-0.15362 for two echo clips. Frame distributions weight longer recordings more heavily; they are distinct from window and clip distributions.

Representative offline windows, probability order [nonwake, human wake, echo]:

- S01 positive 8b696c49-abb2-46b7-992d-21a89a875931, start 0: [0.64779, 0.16549, 0.18672], predicted nonwake. Reviewed wake 0.083-0.416 s.
- S01 nonwake ca57b118-2ba7-45e1-88e2-c72a620ed3c7, start 8 s: [0.64032, 0.17441, 0.18527], predicted nonwake, but higher wake probability than every S01 wake window.
- S02 positive e920ff2a-576f-48fc-97b1-52782f1785b6, start 0: [0.85486, 0.06555, 0.07958], predicted nonwake. Reviewed wake 0.971-1.432 s.
- S02 positive 25b459dd-2c31-4de4-bd44-5290a84d8f55, start 0: [0.95417, 0.02065, 0.02518], predicted nonwake. Reviewed wake 0.314-0.696 s.
- S02 nonwake 17153687-cd42-460b-b5f6-16c4ec2ee7ea, start 7 s: [0.66537, 0.16129, 0.17334], predicted nonwake.
- S02 echo fd0fcf73-c89e-4953-abc9-62db7fae71d3, start 20 s: [0.67793, 0.15285, 0.16923], predicted nonwake.

Full per-window probabilities, quantiles and representative IDs are in diagnosis.json/window-predictions.json.

## Labels, alignment and preprocessing

Verified class mapping 0=nonwake, 1=human_wake, 2=narration_echo, final Dense(3, softmax), integer sparse_categorical_crossentropy targets, and saved wake_scores=probabilities[:,1]. Probabilities are finite and sum to one. Cached label ordering agrees with window-lineage ordering and session identity. Normalization statistics exactly match recomputation from S01 raw feature arrays; S02 does not fit statistics. All 60 positive windows numerically contain their complete reviewed wake intervals. This verifies interval containment, not independent perceptual correctness of labels.

Confirmed consistency concern: offline short clips/tail windows are right-zero-padded; causal replay constructs past-only windows with left padding. Temporal placement/context therefore differ. Six of 40 S01 positives are shorter than two seconds, versus 14/20 S02 positives. Median original positive durations are 2.61 s and 1.74 s respectively. Median annotated wake lengths are similar (0.4565/0.4655 s). This is evidence of session/context differences and a preprocessing parity issue to resolve before another experiment. It does not establish its causal effect, and cannot explain the failure on S01's own offline training inputs. No padding/labels/configuration were changed during this diagnosis.

## Decision and metric audit

Every configured threshold (0.5, 0.65, 0.8, 0.9) exceeds every saved S02 replay wake score. Thus no threshold crossing exists before event aggregation; consecutive-frame logic cannot be the reason for these particular misses. The two-frame rule and one-second cooldown reset per recording. Sustained above-threshold scores can emit repeatedly after cooldown, so event counts are refractory activations rather than one onset per speech episode.

Miss matching is one-to-one, within annotated wake start through wake end plus one second. A detection during the wake can have negative delay from wake end. All 20 expected human intervals are counted; with no emitted events, misses are correctly 20/20. Clip-max classification is a separate metric from two-frame event detection. Ordinary false activations are divided by 275.28 ordinary-negative seconds; echo is separately divided by 59.64 seconds. Unmatched positive-clip events are separately counted. There are no matched wake-end delays, and no streaming latency measurement.

The selector minimizes the raw sum of validation misses and unmatched events and breaks ties toward a higher threshold. It has no minimum-wake-recall qualification gate. Consequently 0.9 is only an automatic tie result for an entirely failed grid, not an accepted operating threshold. Its immutable historical output is retained as failure evidence. Observed zero false events is not evidence for deploying a detector that never wakes. Echo blocks contain no literal wake and do not evaluate playback of Kural itself.

## Next step before any retraining

Review one proposed correction plan: make offline/replay window context consistent and add minority-class/per-class learning diagnostics and a predeclared recall qualification criterion, with explicit review of class balancing. Do not tune a threshold to disguise failure or run repeated architecture searches. The present diagnosis does not choose new weights, thresholds, labels or hyperparameters. The first-order issue is minority-class learning; session/context generalization and actual wake-bearing narration remain additional concerns. No production activation is justified.


Verification: recomputed all 543 training and 371 validation windows directly from original WAVs with the shared extractor; cached features match exactly (maximum absolute difference zero). Every original baseline file hash remains identical, including checkpoints, saved predictions, config and the historical threshold decision. Annotation/source hashes remain validated. No code/model/label changes or new tests were needed; existing pipeline regressions passed. Both staged and unstaged diff checks passed. Only diagnosis documentation and separate ignored diagnostic evidence were added. No training, S03 access, deployment, staging, commit or push.


## Controlled repair and S01-only learning check (2026-11-02)

Implemented one shared causal-context/feature module, tools/kural_audio_features.py, used by offline worker, replay, preprocessing check and overfit diagnostic. Every window ends at a specified available audio sample and contains the past two seconds, left-zero-padded when history is short; no future audio is consumed and the feature extractor now rejects incomplete contexts. This replaces offline right-padding. Offline window requests near the clip tail may resolve to the same endpoint; the next full recipe should deduplicate endpoints before sampling. Original baseline/caches/diagnosis remain immutable; repaired features are new evidence and should not be substituted into the old run. New run identity includes shared feature-source hash.

Actual repaired preprocessing checked all 543 S01 and 371 S02 windows: offline and replay contexts at the same endpoints produced exactly equal features. Synthetic empty, short, exact-length and long examples also passed. All raw/normalized features finite with shape [198,40,1]. Statistics remain S01-only. S02 feature checks performed no model fitting. Evidence: preprocessing-smoke-d92582584be24570acfa3f74caa1d01f/.

Ran one separately reserved, default-off diagnostic using the first eight sorted reviewed S01 wake IDs and first eight sorted reviewed ordinary speech-negative IDs. No S02 fit/evaluation, no echo samples, no augmentation. Echo was excluded because no literal playback wake is annotated and a third wake-identity class is not justified for this binary sanity test. Normalization fitted on these selected 16 S01 examples only. CNN Conv16/32/32 + global average pooling + Dense2 softmax, Adam .001, batch16, seed1729. Cap100 epochs/300-second epoch-loop budget; stop criterion fixed before execution: five consecutive epochs with 16/16 correct and cross-entropy <.1. No architecture search or rerun.

Passed at epoch97. Loss 0.684398 at epoch1 -> 0.084900 final. Both classes 8/8 correct; diagnostic phase including model save took 4.172 seconds, excluding setup/feature preparation. Wake probabilities: reviewed wakes 0.802461-0.996197, ordinary negatives 0.002719-0.278328. Every per-record probability is in result.json. Diagnostic model is explicitly not deployable; memorization is not generalization and cannot isolate effects of padding, binary output and balancing. It establishes a viable basic learning path, not a qualified wake detector.

Evidence: local_wake_data/kural-cnn-v1/overfit-diagnostic-08e2f5a619eb43b7918b66b52dca11ea/. Config, exact example IDs/WAV hashes/intervals, selected-subset statistics, every epoch, final predictions, diagnostic-only.keras, dependencies and artifact hashes are preserved. Original 23 baseline files and both annotation hashes remain unchanged. No S03 access.

### Proposed next full run - NOT executed or applied

- Keep S01 training/S02 validation, seed1729, same 16/32/32 CNN, two outputs (wake/nonwake), Adam .001, no augmentation, shared causal context. Echo with reviewed absence joins nonwake but retains an independent echo evaluation flag. Never relabel a literal playback wake without a separately reviewed design.
- Balanced batch16: 8 wakes/8 nonwakes. One proposed epoch uses all40 S01 wake records, 36 ordinary-negative records and 4 echo records; deterministic selection/rotation of distinct context endpoints, one context per selected recording, prevents long background clips from dominating. Do not simultaneously add class weights to this balanced sampler.
- Maximum50 epochs/60 minutes, early stopping patience8 on class-balanced, recording-weighted S02 cross-entropy (not raw majority-weighted accuracy); preserve per-class recall/loss each epoch and best checkpoint. Freeze this recipe and decision criteria before launching once; it is a proposal, not a claim it will pass.
- Evaluate saved causal replay with separately reported clip and event metrics. Predeclare the existing threshold grid and require at least18/20 S02 human wakes detected before a threshold may be considered. If none qualifies, record no qualified threshold rather than accepting a tie. Ordinary/echo false-event counts and their short denominators must remain explicit; passing a validation screen would still not authorize deployment or establish reliability.

Checks: 31 pipeline/importer/review tests passed in 16.13 seconds; Python compilation passed. New checks cover shared left padding, equivalent offline/replay context, invalid endpoints and diagnostic default-off behavior. Actual TensorFlow parity and the bounded overfit experiment passed. Both diff checks pass. No full retraining, reviewed-label change, S03 access, deployment, staging, commit or push.
