# Synthetic telephony 8 kHz versus existing 16 kHz Prisma v3.0

The new synthetic track scored all 130 matched conditions using exactly **130 live STT calls**, no retries, and zero real-call requests. The existing 16 kHz results were read unchanged; no 16 kHz requests were repeated.

Both use prisma-v3.0, ta-IN,en-IN, codemix and the same foundry keyterms and frontend scoring. Ten clean conditions and thirty at each noisy SNR. Real phone-call results are never included.

| SNR (dB) | 16 kHz WER | 8 kHz WER | 16 kHz intent | 8 kHz intent | 16 kHz intent + heat | 8 kHz intent + heat |
|---|---:|---:|---:|---:|---:|---:|
| clean | 4.8% | 14.3% | 100.0% | 90.0% | 100.0% | 90.0% |
| 20 | 4.8% | 19.8% | 100.0% | 90.0% | 100.0% | 83.3% |
| 10 | 7.1% | 18.3% | 96.7% | 86.7% | 96.7% | 86.7% |
| 5 | 8.7% | 15.9% | 93.3% | 90.0% | 93.3% | 90.0% |
| 0 | 10.3% | 17.5% | 96.7% | 90.0% | 93.3% | 83.3% |

One 8 kHz STT request failed at 10 dB and is included as an empty/incorrect attempt. No retry was made. Other 129 requests succeeded.

Processing: existing mixture -> 300-3400 Hz Butterworth band-pass -> anti-alias resampling to 8 kHz -> ideal G.711 mu-law encode/decode -> mono 16-bit WAV. WAVs were uploaded as 8 kHz; the REST service performs its own normalization.

SNR labels describe the original mixtures before phone processing. Filtering can change effective in-band SNR, and a single small run can be non-monotonic. These synthetic results are not measurements of a real phone line, real carrier codecs or packet loss.

Sources: [8 kHz report](report.md), [8 kHz raw runs](runs.csv), [16 kHz report](../report.md).

The [separate real-call report](../real_calls/report.md) currently has zero recordings and N/A metrics; its [20-row template](../real_calls/phrases.csv) is ready to fill. [Recording instructions](README.md) describe the two-phone setup.
