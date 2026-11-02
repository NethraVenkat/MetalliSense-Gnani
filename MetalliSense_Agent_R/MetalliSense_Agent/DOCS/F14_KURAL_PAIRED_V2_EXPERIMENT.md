# kural-cnn-v2-paired — single data-only experiment

2026-11-03, Asia/Calcutta. Builder: Manish. This predeclaration is written before any training. One authorized run maximum; no automatic retry, architecture search or threshold/tolerance adjustment.

## Frozen pass criteria (user's revised one-speaker specification)

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

An event is a point on the audio timeline: devval matching therefore requires its timestamp inside inclusive `[human start, human end]`, with no end grace. Each event/wake is used at most once, independently per threshold. S02 retains its original inclusive start through end+1s one-to-one rule, ≥18/20 matches, zero ordinary/echo/unmatched-positive events, ordinary exposure ≥275s and echo ≥59s. These distinct protocols are fixed before fitting, not selected from scores. Offsets are not end-to-end latency.

## Authoritative v1 recipe and intended data identity

The current binary v1 is `negative-context-runs/negative-context-3eabdac026d44b05aa60c393515a3a12`, best epoch04 SHA-256 `eb18391180ff973721f618e0e03cfb49c11eb6869bf67c9602365958fbdb6315`. Its frozen config, features, S01-only normalization and negative-context sampler are authoritative. The older `kural_training_worker.py`/`kural_training_config.json` describe an earlier three-class baseline and must not silently replace the current two-class recipe.

Intended fitting list: exactly125 existing S01 sources plus40 accepted manish train-paired-v1 sources (20 wake,20 nonwake), total165. No rejected source, devval, S02, S03 or live diagnostic source may enter fitting by path or audio/PCM hash. Original quiet/startup support remains present. Frozen S01 normalization bytes are unchanged; no statistics from appended data or evaluation sets. Architecture [16,32,32], two-class softmax, Adam .001, seed1729, balanced16-example batches, maximum50 epochs, patience8 and3600s limit remain unchanged. Any necessary source-list cardinality handling must retain original update/stratum budgets and be frozen/tested before launch; no such worker has launched.

## Preflight gate — no training started

The collector intentionally allowed content-only acceptance for paired wake recordings, with later interval review. All20 accepted train wake sidecars currently have `wake_intervals: []` and `boundary_reviewed: false`;19 exceed the model's2s input window (maximum4.6933125s). The existing recipe constructs positive windows only from complete reviewed wake intervals. Treating an arbitrary first/last/maximum-energy2s window as positive would change that recipe and could omit Kural. No interval, label or reviewed sidecar is fabricated here.

Required next action: manually mark and confirm the actual spoken Kural start/end for the20 accepted `manish-A01-wake` through `manish-A10-wake` and `manish-B01-wake` through `manish-B10-wake`, linked to their exact WAV hashes. Preserve the existing files; store a separate boundary-review overlay/export. No rerecording is requested. The10 devval wake intervals already exist and are separate evaluation ground truth.

Status is **BLOCKED / NOT RUN**, not a trained-model FAIL or a PASS. No training reservation/checkpoint is consumed, no inference or v1 baseline evaluation is run, and no result is invented. Both v1/v2 threshold result tables remain pending until the data gate is satisfied. S03 not available, not evaluated. Wake activation stays off.

## Authorized launch freeze after completed reviews

2026-11-03. The earlier blocked status is historical. Latest preflight `preflight-5bf9195f2a1e4787af7c1326ac6cbe60/preflight.json` passes with20/20 training reviews,40 accepted paired sources,21 accepted devval sources and no leakage. All474 protected artifacts match. Builder: Manish.

Only the fitting source list expands to165. The existing80 updates/epoch, five balanced16-example batches,40 wake/36 ordinary/4 echo records and20 prefix/20 regular negative support are retained. Because the wake pool grows40→60, use deterministic cyclic40-record selection with offset `(epoch*40)%60`, then the unchanged v1 seeded sampler. With the original40-source pool this is exactly the old sampler; all60 wake sources participate over the first three epochs. The unchanged ordinary36-record cycle spans the enlarged101-record ordinary pool. These cardinality rules are frozen before training, not chosen from results. Original125 S01 sources alone recompute normalization, with exact float parity to frozen v1 required before any fit. No new-data normalization or augmentation. Actual source-session lineage is retained.

S02 remains the unchanged early-stopping monitor; devval never participates in fitting, normalization or checkpoint selection. One reservation prevents repeats. Maximum50 epochs, patience8, seed1729 and3600-second subprocess limit cover training and final evaluation. Every epoch checkpoint/log is preserved. v2 S02 predictions are computed once by the shared worker; v2 devval and v1 devval/S02 are each computed once afterward. Final scoring is restricted to the four predeclared thresholds; v2 passes only under the combined rule, never an S02-only qualification. No S03 access or production integration.

## Completed result

The single run `kural-cnn-v2-paired-4377c648253f4cdf97ee0603a3c8269e` is **FAIL / rejected experiment**. See the full v1/v2 table and hash verification in [the live diagnostic record](F14_LIVE_KURAL_DIAGNOSTIC.md#single-authorized-paired-v2-experiment-completed--fail). Both models have0/10 strict-overlap devval matches at every fixed threshold. V2 conversation/confusable counts are71/3,62/0,0/0,0/0 for .50/.65/.80/.90; S02 fails at all four. No qualified threshold, no activation and no repeat run. Epoch phase155.750s,28 epochs, best epoch20; whole subprocess412.609s. All165 intended sources participated, normalization remained byte-identical, protected evidence unchanged. S03 not available, not evaluated.
