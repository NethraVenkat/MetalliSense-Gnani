# Synthetic telephony 8 kHz versus existing 16 kHz Prisma v3.0

Rescored all **130 matched conditions per track from cache**, with **0 new STT calls and 0 TTS calls**. The original synthetic telephony run used 130 STT attempts: 129 successful responses and one connection failure. No request was retried. Real phone-call recordings are excluded.

Both tracks use prisma-v3.0, ta-IN,en-IN, codemix, the same foundry keyterms, and the actual frontend mapper. Each has 10 clean conditions and 30 at each noisy SNR.

## Current comparison

| SNR (dB) | 16 kHz WER | 8 kHz WER | 16 kHz intent | 8 kHz intent | 16 kHz intent + heat | 8 kHz intent + heat |
|---|---:|---:|---:|---:|---:|---:|
| clean | 4.8% | 14.3% | 100.0% | 100.0% | 100.0% | 100.0% |
| 20 | 4.8% | 19.8% | 100.0% | 100.0% | 100.0% | 93.3% |
| 10 | 7.1% | 18.3% | 96.7% | 96.7% | 96.7% | 96.7% |
| 5 | 8.7% | 15.9% | 93.3% | 100.0% | 93.3% | 100.0% |
| 0 | 10.3% | 17.5% | 96.7% | 100.0% | 93.3% | 93.3% |

## Mapper-only before / after: 8 kHz

Only the intent-specific normalizer changed: a standalone `Y` immediately before `hold` means `why`. This is justified by the raw cached transcript `Y hold heat one zero five one.`. WER normalization does not apply this alias. All 13 HOLD-reason rows now map to `gate_reason` with heat 1051.

| SNR (dB) | Conditions | WER before / after | Intent before | Intent after | Intent + heat before | Intent + heat after |
|---|---:|---:|---:|---:|---:|---:|
| clean | 10 | 14.3% / 14.3% | 90.0% | 100.0% | 90.0% | 100.0% |
| 20 | 30 | 19.8% / 19.8% | 90.0% | 100.0% | 83.3% | 93.3% |
| 10 | 30 | 18.3% / 18.3% | 86.7% | 96.7% | 86.7% | 96.7% |
| 5 | 30 | 15.9% / 15.9% | 90.0% | 100.0% | 90.0% | 100.0% |
| 0 | 30 | 17.5% / 17.5% | 90.0% | 100.0% | 83.3% | 93.3% |

The entire 16 kHz v3.0 per-SNR summary and all 130 scored rows are unchanged. Both transcript-cache files and every raw transcript are unchanged. This is a rescore of existing recordings, not a fresh STT evaluation.

## Every failing 8 kHz row before the fix

Causes: **(a)** mapper/normalizer gap; **(b)** Prisma misheard a key word or heat digit; **(c)** connection failure. Noise filenames and SNR identify each individual condition.

### hold_reason.wav

Expected text: `Why hold heat 1051`. Expected intent: `gate_reason`.

| SNR (dB) | Noise | Raw transcript | Predicted intent before | Predicted params before | Intent correct | Intent + heat correct | Cause |
|---|---|---|---|---|---|---|---|
| clean | none | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 20 | synthetic_brown.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 20 | synthetic_clanks.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 20 | synthetic_hum.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 10 | synthetic_brown.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 10 | synthetic_clanks.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 10 | synthetic_hum.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 5 | synthetic_brown.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 5 | synthetic_clanks.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 5 | synthetic_hum.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 0 | synthetic_brown.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 0 | synthetic_clanks.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |
| 0 | synthetic_hum.wav | `Y hold heat one zero five one.` | heat_status | `{"heatNumber":1051}` | False | False | (a) Missing contextual Y = why; fixed |

### manganese_tanglish.wav

Expected text: `Heat 1051 Mn enna`. Expected intent: `element_value`.

| SNR (dB) | Noise | Raw transcript | Predicted intent before | Predicted params before | Intent correct | Intent + heat correct | Cause |
|---|---|---|---|---|---|---|---|
| 20 | synthetic_clanks.wav | `Heat one zero five, and manganese in a.` | element_value | `{"heatNumber":105,"element":"Mn"}` | True | False | (b) final heat digit missing; keep heat 105 |
| 20 | synthetic_hum.wav | `Heat one zero five, and manganese in an.` | element_value | `{"heatNumber":105,"element":"Mn"}` | True | False | (b) final heat digit missing; keep heat 105 |
| 0 | synthetic_hum.wav | `Heat one zero five on manganese FeMn.` | element_value | `{"heatNumber":105,"element":"Mn"}` | True | False | (b) final one became on; keep heat 105 |

### silicon_english.wav

Expected text: `What is the silicon level in heat 1051`. Expected intent: `element_value`.

| SNR (dB) | Noise | Raw transcript | Predicted intent before | Predicted params before | Intent correct | Intent + heat correct | Cause |
|---|---|---|---|---|---|---|---|
| 0 | synthetic_clanks.wav | `What is the silicon level in Fe 1051?` | element_value | `{"element":"Si"}` | True | False | (b) heat became Fe (also the iron symbol); no heat inferred |

### carbon_tanglish.wav

Expected text: `Heat 1051 carbon evvalavu`. Expected intent: `element_value`.

| SNR (dB) | Noise | Raw transcript | Predicted intent before | Predicted params before | Intent correct | Intent + heat correct | Cause |
|---|---|---|---|---|---|---|---|
| 10 | synthetic_hum.wav | (empty) | ask_copilot | `{}` | False | False | (c) Connection reset 10054; not retried |

Five joint failures remain: three incorrect manganese heat numbers, one silicon transcript with `Fe` instead of `heat`, and the connection failure. Intent alone fails only for the connection failure. No aliases were added for these ambiguous or missing heat identifiers.

## Audio and interpretation

Processing: existing mixture -> 300-3400 Hz Butterworth band-pass -> anti-alias resampling to 8 kHz -> ideal G.711 mu-law encode/decode -> mono 16-bit WAV. WAVs were uploaded as 8 kHz; the REST service performs its own normalization.

SNR labels describe the original mixtures before phone processing. Filtering can change effective in-band SNR, and a single small run can be non-monotonic. These synthetic results do not measure a real phone line, carrier codec behavior, or packet loss.

Sources: [8 kHz report](report.md), [8 kHz raw runs](runs.csv), [16 kHz report](../report.md).

The [separate real-call report](../real_calls/report.md) has zero recordings and N/A metrics; its [20-row template](../real_calls/phrases.csv) is ready to fill. [Recording instructions](README.md) describe the two-phone setup.
