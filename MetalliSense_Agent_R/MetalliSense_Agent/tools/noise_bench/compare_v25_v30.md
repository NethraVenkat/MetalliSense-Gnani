# Prisma v2.5 versus v3.0: cached transcript comparison

Rescored on 2026-10-30. New STT calls: **0**. The transcript cache was unchanged.

| Configuration | v2.5 | v3.0 |
|---|---|---|
| Model | Prisma v2.5 (model field omitted) | prisma-v3.0 |
| Language | en-IN | ta-IN,en-IN |
| Format | transcribe | codemix |
| Cached conditions rescored | 130 | 130 |
| Coverage | 10 clean + 30 each at 20, 10, 5, 0 dB | 10 clean + 30 each at 20, 10, 5, 0 dB |

The historical v2.5 cache has three-part keys without configuration metadata.
`--include-legacy` explicitly identifies those entries as v2.5 / en-IN / transcribe
for this rescore; it does not modify or relabel the cache.

The direct comparison below uses the same ten clean recordings, with 42 normalized
reference words and seven prompts containing a heat number. Both models use the
same current frontend mapper and normalization for scoring.

| Metric: shared clean conditions | v2.5 en-IN | v3.0 ta-IN,en-IN codemix |
|---|---:|---:|
| Conditions | 10 | 10 |
| STT success | 100.0% | 100.0% |
| Normalized WER | 28.6% (12/42) | 4.8% (2/42) |
| Word accuracy | 71.4% | 95.2% |
| Exact normalized text | 30.0% (3/10) | 80.0% (8/10) |
| Heat slot | 100.0% (7/7) | 100.0% (7/7) |
| Element slots | 66.7% (2/3) | 100.0% (3/3) |
| Intent correct | 100.0% (10/10) | 100.0% (10/10) |
| Intent + heat correct | 100.0% (10/10) | 100.0% (10/10) |

All 130 cached conditions per configuration are included below: ten clean and
30 each at 20, 10, 5 and 0 dB. Conditions match by recording, noise track and SNR.
Every rescored transcript came from results_cache.json; no CSV fallback was used.

| SNR (dB) | v2.5 scored | v3.0 scored | v2.5 WER | v3.0 WER | v2.5 intent | v3.0 intent | v2.5 intent + heat | v3.0 intent + heat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| clean | 10 | 10 | 28.6% | 4.8% | 100.0% | 100.0% | 100.0% | 100.0% |
| 20 | 30 | 30 | 28.6% | 4.8% | 100.0% | 100.0% | 96.7% | 100.0% |
| 10 | 30 | 30 | 29.4% | 7.1% | 100.0% | 96.7% | 93.3% | 96.7% |
| 5 | 30 | 30 | 30.2% | 8.7% | 100.0% | 93.3% | 93.3% | 93.3% |
| 0 | 30 | 30 | 33.3% | 10.3% | 96.7% | 96.7% | 86.7% | 93.3% |

At 0 dB, v3.0 command understood: **96.7%**; command + heat: **93.3%**; normalized word accuracy: **89.7%**.

WER normalizes both reference and hypothesis with the actual frontend's exported
`normalizeTranscript`: lowercase, remove punctuation, convert English number words
(including digit-by-digit IDs), and map the specified Tamil question/action words
to Tanglish. Heat-slot scoring uses the same normalized numbers. Raw transcripts
remain verbatim in each `runs.csv`.

On clean recordings, the two remaining v3.0 word substitutions are `So` versus `Show` and `manganese`
versus `Mn`. Both produce the correct intent and parameters; these lexical differences
still count toward WER. Intent + heat checks intent and the heat number when present;
it does not validate element/alloy parameters. Element slots is the separate lexical
metric, so the v2.5 mapper's `magnus` alias can give the correct intent while failing
the lexical Mn slot.

Reproduce from the Agent directory, without loading audio or initializing STT:

```powershell
.\.venv\Scripts\python.exe tools\noise_bench.py --rescore-only --stt-model v2.5 --stt-language en-IN --stt-format transcribe --include-legacy --output-dir tools\noise_bench\v25_en
.\.venv\Scripts\python.exe tools\noise_bench.py --rescore-only --stt-model prisma-v3.0 --stt-language "ta-IN,en-IN" --stt-format codemix
```

Per-condition raw transcripts and scores: [v2.5 runs](v25_en/runs.csv),
[v3.0 runs](runs.csv). Full reports: [v2.5 report](v25_en/report.md),
[v3.0 report](report.md).
