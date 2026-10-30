# Gnani Prisma noise benchmark

Generated: 2026-10-30T16:07:21.287389+00:00

STT model: prisma-v2.5 (model omitted). Language: en-IN. Format: transcribe.

New STT calls: 0. Cached results: 130. Re-scored from saved attempts; audio availability was not checked.

| SNR (dB) | Scored / planned | STT success | WER | Word accuracy | Exact text | Heat slot | Element slots | Intent correct | Intent + heat correct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| clean | 10 / 10 | 100.0% | 28.6% | 71.4% | 30.0% | 100.0% | 66.7% | 100.0% | 100.0% |
| 20 | 30 / 30 | 100.0% | 28.6% | 71.4% | 30.0% | 95.2% | 66.7% | 100.0% | 96.7% |
| 10 | 30 / 30 | 100.0% | 29.4% | 70.6% | 30.0% | 90.5% | 66.7% | 100.0% | 93.3% |
| 5 | 30 / 30 | 100.0% | 30.2% | 69.8% | 26.7% | 90.5% | 66.7% | 100.0% | 93.3% |
| 0 | 30 / 30 | 100.0% | 33.3% | 66.7% | 20.0% | 90.5% | 66.7% | 96.7% | 86.7% |

WER and exact text use the frontend's shared normalization: lowercase, punctuation removal, English number words (including digit-by-digit IDs), and Tamil question/action words mapped to Tanglish. Raw transcripts are preserved in runs.csv.
WER is micro-averaged edit distance / reference words; it may exceed 100%. Word accuracy is max(0, 1 - WER).
Failed STT attempts count as empty transcripts; unattempted jobs are excluded from scores and remain visible in planned counts.
Clean is measured once per phrase, not repeated for every noise. SNR uses full-clip RMS including pauses.
Slot scoring uses that same number normalization and checks heat digits and element aliases; extra elements do not erase a surviving expected slot.
Intent correct compares the real frontend mapIntent result with expected_intent. Intent + heat correct also requires the expected heat number when present; prompts without a heat use intent correctness alone.
Failed STT attempts count as incorrect for both intent metrics. All scored attempts are included in their denominators.
Element slots remains the original lexical alias metric; frontend aliases such as magnus -> Mn affect intent scoring, not the literal transcript or WER. Intent correctness alone does not guarantee the element or alloy parameter is correct; inspect predicted_params in runs.csv.
For a saved-only re-score, planned counts describe saved conditions, not recordings or unattempted conditions that might exist on disk.
Synthetic noise is a repeatable stress test, not proof of performance in a foundry. See runs.csv for individual outcomes.
