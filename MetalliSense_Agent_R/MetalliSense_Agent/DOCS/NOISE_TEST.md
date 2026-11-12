# Generated-speech synthetic-noise screen

2026-11-12. Measurement only, branch v23-improvements. No training, model/threshold changes, downloaded audio or plant actions. Existing Gnani calls only, one in flight, temporary DATA_DIR. Synthetic noise is isolated diagnostic data; it is not injected into training.

## Frozen method

`tools/stage2_noise_diagnostic.py --live` generated a new ignored directory `tools/local_wake_data/stage2-noise-364a9d9a8888460d9ec2feaadeee8182/`. Its plan.json was written before calls. Four conditions: clean, 20 dB, 10 dB, 5 dB. Six source categories: one previously generated Tamil Timbre Kural clip and five locally generated Windows SAPI commands: latest reading; request reading; gate check H-1051; status of H-1053; approve the selected PR. No passcode is in this corpus.

All sources are mono PCM16/16kHz with half a second of additional leading/trailing silence. Seed 1729. Noise combines 50/100 Hz hum, broadband Gaussian fan/blower and intermittent exponentially decaying 1900 Hz metallic clanks. It reuses tools/noise_bench.py's full-clip-RMS mixer. Noise power is scaled to the declared SNR, then the entire mixture is scaled to avoid peak clipping, preserving the ratio. SNR is full-clip rather than speech-active SNR. A mocked regression measures the resulting ratios within 0.1 dB.

Three additional three-second noise-only clips use corresponding noise amplitude levels referenced to the clean wake source. SNR itself is undefined with no speech. No real foundry recording or human voice is represented.

Existing pause-v3 applies to each clip: RMS .01, 20ms frames, initial silence credit, at least 100ms speech, 0.5s separating silence, first onset and 1.5s tail-padded snippet; no keyterm; exact first word rule unchanged. Full command WAVs separately use the normal STT client and actual local intent/action matchers. Classification never executes an action or authorizes a role. All requests are sequential with 4.2s conservative spacing, max three attempts and 30s backoff on failure. There were **46 recorded successful Prisma HTTP responses**, with no failed HTTP response recorded, against a predeclared ceiling of 47 logical calls. One noise-only clip had no qualifying onset, so no wake request was sent for it. No synthesis provider call was needed: SAPI is local and the wake source was reused.

## Results

| Condition | Wake detected | Command routes before repair | Command routes after exact alias repair | False wakes on no-Kural commands | Noise-only activations |
|---|---:|---:|---:|---:|---:|
| Clean | 1/1 | 4/5 | 5/5 | 0/5 | N/A |
| 20 dB | 1/1 | 4/5 | 5/5 | 0/5 | 0/1; gated locally, no request |
| 10 dB | 0/1 | 4/5 | 5/5 | 0/5 | 0/1; empty transcript |
| 5 dB | 0/1 | 4/5 | 5/5 | 0/5 | 0/1; empty transcript |

These are per-clip checks, not continuous-event or false-events/hour measurements. Command rates are 80% before and 100% after the routing-only repair, using **the same saved real transcripts**, not a new inference or threshold selection. All five full-command transcripts retained their intended content at all four conditions.

The missed route was `Gate check H 1051.` → heat_status in clean and all noise conditions: it lacked the registry's leading `run`. The safe repair accepts only exact `gate check` with an optional H-ID through the existing gate_check action and its unchanged ASK cancellation/precheck rules. `gate check result` and informational questions are not actions. No additional backend service or approval bypass is introduced. Original routing.json remains unchanged; routing-afteralias.json is the separate local replay.

## What the wake failures show

Clean/20 dB onset is .60s and Prisma returns குரல். At 10/5 dB the noise crosses the fixed gate at time zero; Prisma receives the earlier 1.5s window and returns புரண். That is evidence of a noise-triggered early window plus a changed transcription, not proof of an exact word boundary or solely acoustic-model failure. Noise-only 10/5 dB also triggers a request at zero, but returns no word and never activates. The 20 dB noise-only clip stays below the onset rule.

**Wake robustness did not pass at 10/5 dB.** The rule is not loosened and no synthetic-only VAD calibration is installed. An adaptive noise floor or hum filter would require separate quiet-speech and real-noise validation; it cannot be called clearly safe from this tiny screen. Existing PTT remains the fallback.

## Evidence and limitations

plan.json, generated WAVs/hashes, results.json, requests.json, original and repaired local routing reports are retained in the ignored directory. The corpus has one generated source per category and only nine seconds of noise-only audio. The wake voice/script differs from the command voice; there is no unseen-speaker, real-microphone, narration-echo, hearing-protection, reverberation, codec or machinery-field test. No long-term reliability, production readiness or end-to-end latency claim follows. H-1053 was only read as a diagnostic target; its HOLD state was not changed.
