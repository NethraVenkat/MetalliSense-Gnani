# Binary causal-score diagnosis - 2026-11-02

The run and reviewed labels are unchanged. The model is still unqualified; no training, new threshold, deployment or S03 access. Separate evidence and offline plots: `tools/local_wake_data/kural-cnn-v1/binary-diagnosis-292deac57ba849549776abec418140c7/`. Open `index.html` for eight standalone D3 SVG plots (representative positives, speech negatives and echo in both sessions, with extra full-context positives), reviewed boundaries, matching deadlines, thresholds and emitted events. Grey marks synthetic left-padding startup (<2s); green marks actual user-reviewed intervals. Plot-data.json and all-causal-scores.json preserve exact values. No boundaries are inferred from curves.

## Repeated maxima are a silence/startup response

Empty available audio, 80/160/500 ms of zeros, 1/2/3 seconds of digital silence all produce the same all-zero two-second context, identical log-mel features and **0.72155821 wake probability**. Full-context digital silence has this score too: the response is not uniquely caused by synthetic padding. The raw score is finite and output index1 is correct. All125 S01 and61 S02 clip maxima are within .001 of this value. Near-silent initial frames account for similar maxima in unrelated recordings; clip maxima do not establish speech discrimination.

Full-context real-audio wake-score ranges differ: S01 positives .47800-.60337, ordinary negatives .46697-.59030, echo .46447-.56835. S02 positives .50109-.59264, ordinary negatives .46978-.67493, echo .48845-.54350. High full-context silence probability and overlapping real-audio ranges identify a model-response issue in addition to missing startup eligibility. The cause in training (e.g. early checkpoint bias/negative sampling/context distribution) has not been isolated.

## Event partition on S02

Events are timestamped at the END of their causal context, not the window start, annotation start or processing time. Ordinary negative duration is275.28s, echo59.64s. Partitioning by available history gives:

| Threshold | Ordinary startup / full-context events | Echo startup / full-context events |
|---|---:|---:|
| .50 | 58 / 189 | 4 / 51 |
| .65 | 39 / 2 | 2 / 0 |
| .80 | 0 / 0 | 0 / 0 |
| .90 | 0 / 0 | 0 / 0 |

Ordinary startup support is52.10s and full-context support223.18s; echo support is4.00s and55.64s respectively. These are event-time bins, not proof every early false event was caused exclusively by padding. Startup windows contain some real audio; full-context windows contain none of the synthetic history. At .5 many failures remain during full real context, so a warm-up filter alone cannot qualify this checkpoint. Original qualification counts and limits are unchanged.

S01 comparison: .5 ordinary events162 startup/101 full, echo8/8; .65 ordinary81/0 and echo4/0. The longer S01 negative exposure is416.34s ordinary plus50.46s echo; counts should not be compared without their denominators.

## Why .65 misses every S02 wake

Verified all replay timestamps against integer sample endpoints: normal hop80ms, possible shorter final hop, times inside recording duration. An independent aggregation loop reproduces every .65 event. Two consecutive high frames at .08 and .16 produce an event at **.160 seconds** in every S02 clip. Every S02 positive's reviewed start is later (minimum .217s). Each positive has precisely that one .65 event, so all20 events are false pre-wake triggers and all20 reviewed wakes correctly remain missed.

The trigger starts the1-second cooldown until1.160s. Above-threshold scores disappear by at most1.040s in these positives; no later event is possible. Nineteen of20 clips have two-frame high-score candidates during the allowed match interval that are blocked by this cooldown. This does not prove they are wake-specific candidates: the high scores started in silence before the wake. Example 26e4300d-eace-455c-b4d3-fe1431395230: reviewed wake .691-1.122s; only event .160s; candidate frames .72/.80/.88 blocked; latest score>=.65 at.88s. The .721536 clip maximum occurred at .08s, not during the wake.

Matching correctly requires an event from reviewed wake start through reviewed wake end+1s, one event per wake. It does not retroactively match pre-wake events. Sustained high scores can repeat after cooldown; counts are cooldown activations, not speech-onset episodes. No timestamp/index/matching arithmetic defect was found. The pipeline-design gap is permitting insufficient-history/near-silent startup to prime streak and cooldown state without a declared validity policy.

## Learning versus session mismatch

The binary checkpoint has some S01 full-context ranking: wake-overlapping full-context frames versus full-context nonwake AUC **.85839** (359 positive frames vs3834 nonwake frames). S02 is **.51782**, but only22 positive full-context frames versus3502 negative frames are available; this tiny, highly correlated positive support cannot establish a broad generalization estimate. Fourteen of20 S02 positive recordings are shorter than2s, versus6/40 S01, making startup/context composition materially different. Frames are not independent examples, and this is SPK01 validation rather than held-out evaluation.

At .5 S01 wake recall is40/40 with263 ordinary and16 echo events (77 unmatched positive-clip events), versus S02 19/20 with247/55 (21 unmatched positives). High recall here is not evidence of wake-specific learning: silence/startup drives activations. The current failure combines silence-sensitive scoring, an event-validity/state-initialization gap and weaker session transfer. It is not solely majority-class collapse or solely a timestamp bug. Checkpoint1 was selected before robust discrimination; subsequent validation loss worsened despite lower S01 loss.

## Smallest justified repair before another experiment

1. Add explicit context validity/support metadata (real history versus padding) and ensure an ineligible startup context cannot increment the consecutive-frame counter or start cooldown. Regression tests should cover a false startup followed by a real wake and full-context silence. Choose/document the validity policy before scoring, not to rescue this run's metrics.
2. Retain raw scores and report rejected startup separately. Do not drop short positive recordings from denominators or silently discard their first2s: fourteen S02 positives end before full history exists. A realistic continuous-startup test needs genuinely recorded preceding context; do not manufacture that context or alter reviewed labels.
3. Before any next training authorization, require a silence/startup sanity probe and inspect S01 negative-window coverage/support and S02 context differences. Full-context silence also scores high, and .5 still has189 ordinary/51 echo full-context events; a state guard is necessary engineering hygiene, not a demonstrated detector fix. Any later fitting change must be independently specified and keep qualification limits fixed.

No repair was applied during this diagnosis, no threshold was weakened and no new run was launched. Historical results remain unchanged. Echo recordings contain no audible literal wake, so no resistance to playback saying Kural is established.

Verification: no model fitting; S01 replay inference plus saved S02 outputs, digital-silence controls and independent event/sample-time checks. Existing binary/pipeline suite **24 passed in6.12s**. Eight D3 SVG artifacts parse successfully. Every original file hash in the binary run, failed baseline and overfit diagnostic matches its before snapshot; both annotation hashes unchanged. Both git diff checks passed. Only documentation and separate ignored diagnostic/plot artifacts were added. No frontend build, S03 access, staging, commit or push.
