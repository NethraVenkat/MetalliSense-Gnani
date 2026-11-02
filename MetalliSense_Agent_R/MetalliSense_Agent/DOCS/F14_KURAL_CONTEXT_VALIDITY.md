# Explicit context validity and S01 repair proposal

2026-11-02. No new training. All run, recording and annotation hashes preserved. Production voice/tour code unchanged.

## Scope clarification: diagnostic only

The two-second gate is a secondary diagnostic, not a production policy, training filter or primary threshold-selection rule. Primary binary evaluation remains ungated with all20 S02 wakes and the original qualification limits. All40 reviewed S01 positives remain available for fitting with complete reviewed wake intervals, including short clips represented with the shared left-padded context. Do not reject them for lacking two seconds of prior audio. No collection/annotation redo is imposed by this diagnostic.

## Implemented policy

`full-real-history-v1`: a window is eligible only when its endpoint has at least32000 real samples (2 seconds at16kHz) since the recording/session begins. Scores are always computed and retained. An ineligible frame resets the consecutive-frame streak and cannot emit an event or modify the last eligible event's cooldown timestamp. Previous legitimate cooldown is not cleared by an ineligible gap. No acoustic energy gate is added: full-context silence remains eligible, so this policy cannot hide a bad silence response.

Shared event/metric APIs accept an explicit eligibility mask/key. Historical callers without a mask retain their previous behavior. `tools/replay_kural_context_policy.py --replay` is default-off and uses the isolated interpreter for actual checkpoint inference. It does not train or alter any old run/configuration. Existing qualification limits (>=18/20 wakes, zero ordinary/echo/unmatched-positive events, unchanged duration minima) remain intact. The policy is an explicit offline experiment tool, not a production activation integration.

## Actual checkpoint replay

Separate evidence: `tools/local_wake_data/kural-cnn-v1/context-policy-replay-ffae2a7a725d457783217e9410a6be2e/`. `raw-predictions.json` is a byte-identical copy of the saved binary predictions. Recomputed all61 S02 recordings using the unchanged best checkpoint; maximum raw-score difference **0**. Per-frame real history/padding/eligibility is recorded in context-support.json. index.html and all-20-wake-coverage.csv identify every wake and its opportunity status.

| Threshold | Not detected / all20 wakes | Ordinary false events | Echo events | Qualified |
|---|---:|---:|---:|---|
| .50 | 15 | 189 | 52 | No |
| .65 | 20 | 2 | 0 | No |
| .80 | 20 | 0 | 0 | No |
| .90 | 20 | 0 | 0 | No |

No qualified threshold. At .50 the15 not-detected wakes are unsupported by the policy; all5 with an eligible opportunity are detected, but this is not qualification or a successful20-wake test. At the higher thresholds the same15 are unsupported and all5 supported wakes are also missed. Every wake remains in the denominator; no clip/label was dropped. The14 short clips cannot produce a full-history window. One additional clip, 5c9895b9-72b2-48cc-86c1-34f6e705594a (2.10s), has reviewed wake .295-.754s; its1.754s matching deadline precedes the earliest2.08s eligible two-frame event. The dataset cannot satisfy18/20 under this policy even if every supported wake is detected. This is a context-availability limitation, not permission to lower recall or alter labels.

All14 short clips:

| Recording ID | Duration(s) |
|---|---:|
| 26e4300d-eace-455c-b4d3-fe1431395230 | 1.98 |
| a5cb1385-ee88-40b7-b494-ac4cfc8fcabb | 1.56 |
| 271cc660-77fe-4f4f-a82a-e3309adf39bf | 1.98 |
| 4cded387-a235-407b-ba0c-16bc34284b3f | 1.26 |
| 1902e937-d660-4379-9a56-eae8644fe3b0 | 1.50 |
| 46a61540-5203-47f0-b161-7c8fa531899a | 1.80 |
| 0d7b3786-70c4-404f-a02c-af04f8bd3c59 | 1.44 |
| 2f1b48b0-df3d-4df3-812d-3de7bec2fe5b | 1.92 |
| cba2c607-4808-4326-995a-2edb91084782 | 1.44 |
| a2b54c55-1d38-4276-840b-8b231f1e6139 | 1.68 |
| b61119d0-e536-4374-ba34-e17e5589c6f4 | 1.26 |
| 25b459dd-2c31-4de4-bd44-5290a84d8f55 | 1.02 |
| e23f247a-5b52-4563-97be-68b126db846a | 1.32 |
| 9dddbc91-1437-4baa-b24c-2fb966031b9e | 1.20 |

## Startup remains visible

Ordinary audio:275.28s total =52.10s ineligible startup +223.18s eligible-history support. Echo:59.64s total =4.00s startup +55.64s eligible. Original per-hour metric fields and qualification exposure keep total durations; these must not be described as entirely scorable. Additional eligible-support rates are in eligible-support-rates.json, clearly separated from the preserved original metrics. No rate is a production reliability bound.

At .50 the ungated replay had58 ordinary startup events and4 echo startup events. At .65 it had39/2 respectively; gated startup events are zero by definition. Raw startup scores are not suppressed or relabelled. The .50 gated echo count52 differs from the old full-context-only51 because removing the startup trigger changes cooldown phase; this is a state-machine replay, not filtering a historical event list. The remaining189 ordinary and52 echo events show the unchanged model is still inadequate. Full-context silence's high raw score remains observable.

## S01 training-exposure audit

Read-only independent audit evidence: `tools/local_wake_data/kural-cnn-v1/s01-exposure-audit-d3fd1196b7234238997f731e532ab8c3/` (audit.json, actual-sampled-exposure.json, available-contexts.json, reviewed-negative-prefixes.json). RMS is measured on normalized PCM contexts. The .001/.01 bins below are descriptive (-60/-40dBFS), not added activation thresholds.

| Actual exposure | Wake | Speech negative | Ordinary background | Echo |
|---|---:|---:|---:|---:|
| Best epoch1 |40|29|7|4|
| All9 epochs (updates)|360|244|80|36|

Every epoch1 context has RMS>=.01; its nonwake minimum is .01387. Of360 nonwake updates over9 epochs, only7 have RMS<.01 and none<.001. The458 available distinct contexts comprise40 wake,123 speech-negative,247 ordinary-background and48 echo; only18 nonwake contexts have RMS in[.001,.01), none below.001. Candidate generation starts at min(2s,record duration): it never provided the .08/.16s quiet startup support that dominates replay maxima. Short padded training examples are not necessarily quiet: epoch1 includes6 wake and5 speech-negative padded contexts, all containing energetic speech.

All85 whole-record absence-approved S01 sources (61 speech negatives,20 ordinary backgrounds,4 echo) provide safe negative prefix counterexamples without inventing labels. Prefix probes:

| Real history | Wake-score min / median / max |
|---|---|
| .08s | .720604 / .721147 / .721597 |
| .16s | .714377 / .717243 / .719331 |
| .50s | .676553 / .684746 / .690869 |
| 1.00s | .612718 / .623432 / .638519 |

At .08s all85 contexts have RMS<.001;63 are<.0001. Every .08/.16/.50 prefix scores>=.65 despite its whole source having explicit reviewed wake absence. None is exactly zero. Digital silence is a separate mathematical canary, not an invented recorded example. This supports a missing negative-support explanation, but does not prove it is the sole cause of weak transfer or all full-context false events.

## Minimal training repair proposal - documented only, NOT run

Keep architecture, binary labels, balanced8/8 batches, S01-only fitting/normalization, seed, stopping limits and qualification criteria. Change only the negative context support/sampler before a small controlled S01-only learning check:

1. Add a predeclared prefix family with endpoints .08/.16/.50/1.00s from the85 explicitly absence-approved S01 sources. Preserve original recording/session lineage and echo flags; no WAV rewriting, S02 examples or new recording labels. Do not infer negatives from quiet positive-clip regions.
2. Retain40 wake and40 nonwake updates per epoch,36 ordinary+4 echo records. Stratify nonwake support:20 prefix/quiet contexts and20 ordinary full-record contexts per epoch; rotate18 ordinary+2 echo prefixes versus18 ordinary+2 echo regular contexts, keeping one context per selected recording and deterministic record/context rotation. Include existing quiet/background regular contexts rather than letting speech-negative or long-record windows dominate. RMS bins remain audit-only, not a model gate or label source. Full context endpoints remain deduplicated.
3. Preserve the fixed S01-only normalization method for an interpretable sampler-only check. Log per-class and support-stratum losses, silence probability, eligible-context false events and raw prefix probabilities. Use digital silence as a mandatory canary and reviewed-negative prefix probes as counterexamples, without labeling a fabricated recording. Do not add a third echo class or change reviewed wake intervals.
4. Require that small check to learn the negative-support counterexamples while retaining wake predictions before considering a new full run. Record/freeze exact success criteria first. No training is authorized by this document, and no previous run should be resumed or overwritten.

The two-second policy also requires real preceding history for a meaningful continuous test. Existing short S02 positives stay reported as unsupported; never synthesize prehistory, drop them from denominators, mix S02 into fitting or claim a full qualification from5 supported wakes. Additional real-context evaluation collection would need its own reviewed scope; S03 remains untouched.

## Verification and files

44 focused policy/binary/pipeline/importer/review regressions passed in23.68s. Tests cover non-priming cooldown, broken streaks, legitimate cooldown preservation, full-history boundary, full-context silence, malformed masks/timelines, unsupported/deadline cases, unchanged raw inputs, all20 wakes retained, unchanged qualification limits and default-off execution. Actual checkpoint inference matched saved raw scores exactly. An independent review found no gate correctness issue and confirmed duration-reporting caveats above. Python compilation and both diff checks passed.

Changed: tools/kural_training.py (optional eligibility), new tools/kural_context_policy.py, new tools/replay_kural_context_policy.py, new tests/test_kural_context_policy.py and status documentation. All generated reports/audits are ignored. The failed baseline, overfit diagnostic, binary run and annotations remain unchanged. No model training, S02 fitting, tour/audio change, S03 access, deployment, staging, commit or push.


## Final verified repair proposal and evaluation scope

Primary evaluator parity was checked against the frozen original binary threshold-selection.json: its output is unchanged and ungated. Every40 S01 positive and20 S02 positive still has complete reviewed-interval containment under the shared causal context extraction. No training or production module imports the diagnostic policy; only the separate replay explicitly supplies eligibility masks.

The only proposed training change is negative sampling support: existing S01 whole-record absence-approved quiet/startup prefixes and representative regular/quiet-background windows, maintaining40 positive and40 nonwake updates, original/session/echo lineage, no S02 fitting and unchanged reviewed labels. All40 positive examples continue to use full reviewed wakes; do not crop them by amplitude, use pre-wake positive prefixes as invented negatives, or apply the diagnostic history gate to their fitting labels. Any low-energy strata are descriptive sampling support, not an acoustic activation gate. No global VAD or energy cutoff was installed.

A future experiment, if separately authorized after reviewing this proposal, must report primary ungated S02 results for all20 wakes under the frozen recall/false-event limits. The two-second gated replay remains secondary and explicitly shows unsupported clips. Primary evaluation must not be replaced with5 supported examples, a reduced denominator, or a new qualification standard. The present model remains unqualified. No training ran during this task.


Final regression verification after explicit diagnostic-scope clarification: **45 passed in21.83s** (context policy, binary, pipeline, importer and review). Added a regression proving the primary binary evaluator ignores the diagnostic mask while the separate replay applies it. Final report hashes and primary-evaluation/positive-containment checks are recorded in final-verification.json and final-report-artifact-hashes.json. The latter records the completed report after scope clarification; earlier hash snapshots remain historical evidence. Both git diff checks passed. No new training was run.


## Authorized negative-context v2 - frozen before launch (2026-11-02)

User authorized one bounded sampler-only experiment. Exact config tools/kural_negative_context_config.json; source tools/kural_negative_context_experiment.py, with an optional shared binary-worker repair hook. Seed1729, same binary architecture/Adam.001, maximum50 epochs/3600-second worker subprocess budget and patience8 stopping; no repeat runs. Separate negative-context-v2 reservation and new negative-context-runs directory preserve every previous run and report.

All40 complete-wake S01 positives unchanged. Keep prior36 ordinary-negative cyclic recording selection and all4 echo records. Seed+epoch shuffles membership into18 ordinary+2 echo prefix records and18 ordinary+2 echo regular records. Five batches each8 positives/4 prefix negatives/4 regular negatives, one context per selected source. Prefix endpoints .08/.16/.50/1.00s are capped/deduplicated by actual audio length; (epoch+shuffled-prefix-index) modulo4 gives5 examples per requested duration per epoch. Among regular20, nine ordinary+one echo use that recording's minimum-RMS REGULAR context; the remaining nine+one rotate original endpoints. RMS is a selection descriptor within already reviewed-absence sources, never a label or activation gate.

Normalization still uses the first REGULAR context from all125 S01 recordings, excluding added prefixes and all S02 statistics; exact equality to v1 mean/std is asserted before model fitting. S01 train and S02 validation loss monitoring uses original regular contexts only for comparability. Additional prefix features exist only in S01 fitting candidates. No positive prefix is labeled negative; all positive contexts preserve complete reviewed wake intervals.

Primary S02 evaluation is ungated with all20 reviewed wakes. Thresholds [.5,.65,.8,.9], consecutive2, cooldown1s and match grace1s unchanged. Qualification remains recall>=.9 with zero ordinary/echo/unmatched-positive events and the original exposure minima. No all-miss or otherwise unqualified candidate can be selected. Two-second gate remains diagnostic-only. Best-checkpoint digital silence and actual reviewed-negative prefix scores will be reported as diagnostics, never used to silently alter qualification.

Before launch: **52 focused regressions passed in7.04s** (sampler/policy/binary/pipeline/importer/review), Python compilation passed; independent read-only review found no blocker. Tests cover 40/40 balance,36/4 source split,20/20 support split,8/4/4 batches, unique source IDs, deterministic rotation,5 prefixes/duration, positive containment, first-regular normalization and mismatch rejection, no S02 prefix fitting and unchanged all20 ungated qualification/all-miss rejection.


## Single negative-context v2 experiment completed (2026-11-02)

Executed the one authorized run after52 regressions passed. Frozen config SHA-256 ddca724753263bf97d866105fd922ddefb65862305b5c4363a7216455c77790a. Run: local_wake_data/kural-cnn-v1/negative-context-runs/negative-context-3eabdac026d44b05aa60c393515a3a12/. No repeat run or tuning. Early stopped at epoch12, best epoch4 balanced validation loss .6371918551, epoch phase31.828s, total subprocess88.656s. All12 full checkpoints preserved; best202474 bytes, SHA-256 eb18391180ff973721f618e0e03cfb49c11eb6869bf67c9602365958fbdb6315.

Actual after-run sampling audit verified every epoch:40 complete-wake positives,18 ordinary+2 echo prefix negatives,18 ordinary+2 echo regular negatives;80 unique S01 source IDs; every batch8/4/4;5 prefix requests per duration; all selected positive contexts contain their complete reviewed intervals, and every negative source retains explicit whole-record absence approval. Exact normalization JSON and SHA-256 match v1 byte-for-byte. No S02 fitting or normalization, no gate in primary evaluation and no reviewed labels changed.

Best-checkpoint digital silence/empty-input wake score is **.0818313062** for all mathematical silence controls0/.08/.16/.5/1/2/3s, versus .72155821 in v1. Controls were not fitted or used to alter qualification. Actual85 S01 reviewed-negative prefix score min/median/max: .08s .081829/.082815/.083735; .16s .085312/.086743/.089360; .5s .116667/.126720/.172842;1s .195025/.266061/.422381. All these prefix probes are below the lowest configured threshold. This supports the targeted negative-support repair, not a reliable wake detector.

Primary UNGATED S02 evaluation retains all20 wakes, ordinary275.28s and echo59.64s. Two-second policy stays diagnostic-only.

| Threshold | Wake misses /20 | Ordinary false events | Echo events | Unmatched positive events | Qualified |
|---|---:|---:|---:|---:|---|
| .50 | 12 |109|52|0|No|
| .65 | 14 |48|4|0|No|
| .80 | 19 |11|0|0|No|
| .90 | 20 |2|0|0|No|

No qualified threshold. Silence bias improved, but wake recall and real-audio false activations still fail the unchanged limits; no model is approved. S02 frame-score min/median/max: positives .081831/.261927/.807896; ordinary negatives .081852/.395452/.929118; echo .082193/.558320/.718876. These SPK01 validation distributions overlap and are not held-out performance or live latency. Reviewed echo contains no literal Kural, so playback-says-Kural resistance is still unmeasured.

Frozen identity/dependencies/config, S01-only normalization, regular+prefix lineage, selected IDs/endpoints/RMS and losses per epoch, checkpoints, silence controls, raw probabilities, every threshold's metrics and score distributions are preserved with artifact hashes. All protected prior baseline/diagnostic/binary/report files, original data identity and annotation hashes are unchanged. Independent code review found no blocking issue before launch.52 regressions passed in7.04s; compilation passed; both diff checks passed. No frontend build required. No S03 access, deployment, staging, commit or push.


## Saved-only comparison of v2 false events and missed/correct wakes

The two .90 false events (16.00s/17.04s) come from ONE reviewed wake-free KB06 ordinary-conversation source17153687-cd42-460b-b5f6-16c4ec2ee7ea, one above-threshold excursion15.92-17.12s, not two independent acoustic patterns. Peak .929118 at16.40s uses a full real context14.40-16.40s with no startup padding. Its PCM RMS .06385 is lower than representative correct/missed wake peak-context RMS (.14767/.12451), so simple loudness rejection is not supported by these cases. No audible transcript was independently inferred.

Broader finding: scores favor sustained speech/context rather than demonstrating reliable wake-word discrimination. At .50 all6 KP03 long wake-plus-question recordings are detected; only2/14 KP01/KP02 shorter wake-only recordings are. Correct8 wake duration median1.167s versus missed12 median.453s; peak-score correlation with reviewed duration is .937 (clip length .775). These20 recordings confound prompt, speech duration, support and session; this is not proof of the exact internal mechanism. False events at .50 are107 ordinary-background+2 speech-negative, plus52 echo. Do not optimize only the .90 pair or accept0.90, which misses20/20 wakes.

Representative saved comparisons: correct long f0e6760c... wake .969-2.145s, peak .80790 and .50 event1.76s; correct short e920ff2a... wake .971-1.432s, peak .54667 and event1.84s; missed comparable26e4300d... wake .691-1.122s, peak .48619 with no .50 event; missed short25b459dd... wake .314-.696s, peak .30736 with no event. Conversation outranks even the best true wake.

Next justified action is one prespecified read-only context-matched replay comparison: align complete reviewed wakes and representative reviewed nonwake speech with equal available-history/input support, using only existing real audio and explicitly flagging cases without enough context. Compare several background sources and both missed/correct wake-only and KP03 cases. This tests the duration/context confound before any architecture/sampler/training proposal; no labels, qualification changes, noise synthesis or training are implied. No such new replay was run here.

Evidence: local_wake_data/kural-cnn-v1/negative-context-comparison-8fe8d22b8f81437ca08a18ec4ae742a4/comparison.json and group-summary.json. Saved outputs/metadata/PCM statistics only; no new model inference, training, source-code changes or redundant tests. Completed run hashes unchanged. No S03 access, deployment, commit or push.


## One prespecified context-matched diagnostic completed

Plan frozen BEFORE inference at local_wake_data/kural-cnn-v1/context-matched-diagnostic-ad61c525a54449a7a1b0bdff17469ede/plan.json (SHA-256 ddc7f8282d45ee44b646f2522598805b3ee72150e87b108800c6dfac5beab62f). Included all20 S02 positives and all41 reviewed wake-free sources, not score-selected subsets. Two declared cohorts use exactly1.5 or2.0 seconds of original real audio plus consistent existing left-history padding to the2-second model input. Positives end at max(history duration, reviewed wake end+.20s), with complete interval containment and available original samples required. Speech negatives use first possible/full-record endpoints; background/echo use fixed first/quarter/half/three-quarter/end points. Previously known false endpoints16/16.4/17.04 were secondary sentinels, excluded from pooled group summaries. No endpoint/example was added after seeing new scores.

Loaded the unchanged best v2 checkpoint once and scored146 prespecified windows (budget<=200). No training, feature/statistic refit, audio-file edits, added noise or threshold selection. At1.5s,13 positive sources are supported and7 explicitly unsupported; at2s,6 supported and14 unsupported. All20 remain listed, and original primary event metrics/qualification remain unchanged. Full per-window results, exact positions/padding, per-source summaries, all unsupported pairs and readable index.html are saved separately.

| Fixed real history | Previously correct wake-only | Previously missed wake-only | KP03 | Reviewed nonwake speech |
|---|---|---|---|---|
|1.5s|2 sources, .4416-.4769|5 sources, .3474-.4875|6 sources, .6770-.7532|5 sources/9 windows, .3493-.7355|
|2.0s|2 sources, .5168-.5419|1 source, .3930|3 sources, .7399-.8037|1 source/2 windows, .5742-.5864|

At1.5s a predeclared KN11 reviewed nonwake phrase scores .7355, overlapping KP03 and outranking every matched wake-only example. At2s, generic fixed-position background windows from9 sources reach .8078; known false sentinels separately reproduce .9102/.9291/.9020. Thus equalizing real-history/padding does not restore word-specific score separation. This is an observation, not proof that utterance duration alone causes errors: speech occupancy, wake position/postroll and prompt semantics remain unmatched. Different source counts across cohorts mean cross-cohort median changes are not causal padding effects. No diagnostic event rates/recall are inferred from independent windows.

One finding: the remaining problem is keyword discrimination, not solely startup or available-history length. One next action: stop threshold/sampler tuning on this checkpoint and establish a word-specific discrimination requirement against matched nonwake speech before another training proposal. No new experiment or review cycle is launched by that recommendation.

Plan/hash/support/containment assertions passed; every original run file and both annotation hashes are unchanged. No source-code changes or redundant test suite/build runs were needed for this isolated diagnostic. Reports/script are ignored local evidence. No S03 access, deployment, commit or push.
