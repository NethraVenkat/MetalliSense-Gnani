# Gnani Prisma noise benchmark

Generated: 2026-10-30T15:32:19.556096+00:00

New STT calls: 120. Cached results: 10. Missing recordings: 0.

| SNR (dB) | Scored / planned | STT success | WER | Word accuracy | Exact text | Heat slot | Element slots |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| clean | 10 / 10 | 100.0% | 28.6% | 71.4% | 30.0% | 100.0% | 66.7% |
| 20 | 30 / 30 | 100.0% | 28.6% | 71.4% | 30.0% | 95.2% | 66.7% |
| 10 | 30 / 30 | 100.0% | 29.4% | 70.6% | 30.0% | 90.5% | 66.7% |
| 5 | 30 / 30 | 100.0% | 30.2% | 69.8% | 26.7% | 90.5% | 66.7% |
| 0 | 30 / 30 | 100.0% | 33.3% | 66.7% | 20.0% | 90.5% | 66.7% |

WER is micro-averaged edit distance / reference words; it may exceed 100%. Word accuracy is max(0, 1 - WER).
Failed STT attempts count as empty transcripts; unattempted jobs are excluded from scores and remain visible in planned counts.
Clean is measured once per phrase, not repeated for every noise. SNR uses full-clip RMS including pauses.
Slot scoring normalizes English number words and checks heat digits and element aliases; extra elements do not erase a surviving expected slot.
expected_intent is a dataset label, not measured intent accuracy. No frontend intent mapper is invoked.
Synthetic noise is a repeatable stress test, not proof of performance in a foundry. See runs.csv for individual outcomes.
