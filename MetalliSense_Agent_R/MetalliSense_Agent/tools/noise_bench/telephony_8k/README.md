# Phone-band synthetic track and separate REAL call recordings

These tracks do not overwrite or pool with the original 16 kHz noise benchmark.
Use Python 3.11 (the repository runtime), NumPy/SciPy and the existing Gnani client.
Real M4A/MP3/OGG/AAC decoding also needs ffmpeg on PATH. Nothing edits `.env`.

## What synthetic telephony simulates

For each original clean clip and each original noise/SNR mixture, `--telephony`:

1. Reuses the existing 16 kHz mixture, including its noise level and peak scaling.
2. Applies a fourth-order Butterworth band-pass at **300–3400 Hz**.
3. Anti-alias resamples to **8 kHz mono**.
4. Applies one ideal **G.711 mu-law encode/decode** round-trip using Python 3.11's
   `audioop` module, then writes a mono 16-bit PCM WAV.

This approximates narrowband bandwidth and companding quantization. It does not
reproduce an actual carrier/phone codec path: AMR/EVS/Opus or transcoding chains,
packet loss, jitter, dropouts, acoustic echo, speakerphone/microphone response,
automatic gain control, noise suppression, network variation or real foundry audio.
The SNR label describes the original mixture **before** filtering and companding;
the effective in-band SNR can differ after processing. Clean means no added noise,
not an undegraded wideband recording. Ten phrases and three noises give 130 conditions.

The [REST docs](https://docs.gnani.ai/api/STT/speech-to-text.md) state
“Automatically converted to 16000 Hz mono” for uploaded files. The bench uploads
its actual **8 kHz WAV unchanged**; normalization happens on the service. The
existing client's WAV path does not resample it. [Prisma v3.0 limits](https://docs.gnani.ai/api/STT/models/prisma-v3.md)
say “30 seconds per request.” Longer files are rejected locally; nothing is silently
truncated. This REST file path is distinct from WebSocket sample-rate parameters.

## Synthetic commands (Agent directory)

```powershell
python tools\noise_bench.py --telephony --dry-run
# Paid calls: run only with an authorized budget.
python tools\noise_bench.py --telephony --max-calls 130
# Rescore completed conditions without new requests:
python tools\noise_bench.py --telephony --max-calls 0
```

STT model, locales, output format and keyterms come from the existing Agent environment
or `.env`; the intended configuration is `prisma-v3.0`, `ta-IN,en-IN`, `codemix` and
the existing foundry keyterms. The tool prints the actual configuration. Existing
`--stt-model`, `--stt-language` and `--stt-format` overrides also apply to these tracks.

Reports are `report.md`, `report.csv`, `runs.csv` in this directory. Submitted WAVs
are saved in `mixed/`; `results_cache.json` lives here, separately from the original
cache. Keys contain `telephony=8k` and `track=synthetic_telephony_8k`; fingerprints
include processed audio, STT/keyterm settings, URL and processing version. Failure
results are also cached. One HTTP attempt per condition, no automatic retries;
failed attempts consume the same hard `--max-calls` budget and count as incorrect.
Successful unchanged cached reruns cost zero calls. Dry runs initialize no client
and write no audio, reports or cache. Unattempted conditions are excluded from scores.

## Record a separate REAL phone-call set

The template is [real_calls/phrases.csv](../real_calls/phrases.csv): ten phrases each
for file labels `manish` and `nethra`. These are speaker labels, not words to read out.

1. With permission from the participants, call **phone B from phone A**. Put A on
   speakerphone near an ordinary fan, TV or traffic sound, and speak the ten template
   phrases clearly. Only read the synthetic foundry commands and invented heat IDs;
   include no real names, phone/account numbers or other personal information.
2. **Phone B records the received call audio**. Check that its recording captures the
   remote speaker, rather than only B's microphone. Repeat for the other speaker.
3. Export and split the received audio into one phrase per clip, each **at most 30 s**.
   Keep the phone recording's natural background sound. Do not add synthetic noise,
   apply extra companding, or improve it with a speech enhancer.
4. Put clips in `real_calls/` as `real_manish_01.m4a` through `real_manish_10.m4a`
   and `real_nethra_01.m4a` through `real_nethra_10.m4a`. WAV, MP3, OGG and AAC are
   also accepted; change the matching `file` cell in the CSV to the actual extension.
   Adjust independent reference text only to match what was actually spoken; retain
   the correct heat ID and intent label.

```powershell
python tools\noise_bench.py --real-calls --dry-run
# Future paid real-call run; do not run until recordings and credits are authorized:
python tools\noise_bench.py --real-calls --max-calls 20
```

Real clips are converted directly to 8 kHz mono 16-bit WAV, with **no added noise or
simulated phone filter/codec**. Their cache and reports stay in `real_calls/`, with
`track=real_calls` in keys and rows. `report.md` has a summary by speaker, a combined
**real-only** row, and an individual table for each speaker. The report writer rejects
synthetic rows. Missing/invalid files are listed and skipped. With zero files the
tool prints `no real-call recordings yet`, makes zero requests and exits successfully.

Both tracks use the original frontend normalizer and `score_intents.mjs`. Raw
transcripts are retained. Intent + heat requires the heat only when the reference
contains one; a bare `Yen HOLD` prompt has no heat slot to verify. No synthetic and
real results, speakers or sample counts are combined across tracks.
