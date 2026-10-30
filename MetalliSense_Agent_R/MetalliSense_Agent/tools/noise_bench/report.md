# Gnani Prisma noise benchmark

Generated: 2026-10-30T16:14:53.458748+00:00

STT model: prisma-v3.0. Language: ta-IN,en-IN. Format: codemix.

New STT calls: 120. Cached results: 10. Missing recordings: 0.

| SNR (dB) | Scored / planned | STT success | WER | Word accuracy | Exact text | Heat slot | Element slots | Intent correct | Intent + heat correct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| clean | 10 / 10 | 100.0% | 4.8% | 95.2% | 80.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| 20 | 30 / 30 | 100.0% | 4.8% | 95.2% | 80.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| 10 | 30 / 30 | 100.0% | 7.1% | 92.9% | 80.0% | 95.2% | 88.9% | 96.7% | 96.7% |
| 5 | 30 / 30 | 96.7% | 8.7% | 91.3% | 76.7% | 95.2% | 88.9% | 93.3% | 93.3% |
| 0 | 30 / 30 | 100.0% | 10.3% | 89.7% | 73.3% | 90.5% | 88.9% | 96.7% | 93.3% |

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
