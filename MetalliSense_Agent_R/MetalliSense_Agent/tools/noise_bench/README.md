# Gnani Prisma noise robustness bench

Run from `MetalliSense_Agent_R/MetalliSense_Agent` using the existing `.venv`.
The bench uses installed NumPy and SciPy for audio and resampling; it installs nothing.
It calls the existing `get_gnani_client().transcribe(audio_bytes, language=None)` directly,
so `GNANI_STT_LANGUAGE` from the Agent environment controls STT (currently use `en-IN`).
It does not go through the frontend mock server or require a running FastAPI server.

## Record 8–10 clean phrases

The supplied `phrases.csv` contains ten Tanglish/English prompts. Read each aloud once
and save it under the exact `file` name in `clean/`. Edit `expected_text` to match what
you actually said, preserving the spoken heat number and element. Remove unused rows
if recording only eight or nine prompts. `expected_intent` is the independent reference
label used to measure the frontend mapper's intent accuracy.

Use a quiet room and the same microphone/distance operators will use, with a consistent
normal speaking volume. Allow roughly half a second of silence before and after the
phrase, avoid clipping and long pauses, and do not enable recorder noise suppression
or automatic level adjustment if it can be disabled. Save real WAV audio, preferably
16-bit PCM, at the recorder's native sample rate (16, 44.1 or 48 kHz is fine). Stereo
and PCM/float WAVs are supported; audio is downmixed and anti-alias resampled to
16 kHz mono before mixing. Do not simply rename MP3/M4A files to `.wav`.

Prompts cover heat 42/1051 status, C/Si/Mn quantities, HOLD reason, FeSi stock, and screen
navigation. To compare operators or microphones, use distinct filenames and CSV rows.
Missing recordings are listed and skipped; no synthetic speech is substituted.

## Noise and replay

Put foundry/machine WAV recordings directly in `noise/`, preferably at least 10–15
seconds long with varied machine activity. The bench uses every WAV there; shorter
clips are deterministically repeated to match each speech clip. Only record where
allowed and retain the original recordings for listening comparisons.

If no noise WAV exists, the bench generates three 12-second WAVs with fixed seed 1051:
`synthetic_brown.wav`, `synthetic_hum.wav` (50/100 Hz and harmonics), and
`synthetic_clanks.wav` (random decaying metallic bursts). These are replayable even
after a dry run. Remove the generated WAVs when switching exclusively to real noise;
otherwise all existing WAVs are included. Clean speech is tested once per phrase,
then every noise at 20, 10, 5, and 0 dB SNR. Ten phrases with three noises = 130
conditions, not 150 (the clean baseline is not duplicated).

SNR is defined using RMS over the entire speech/noise clip, including pauses.
The mixture is scaled as a whole to avoid clipping while preserving the ratio.
Live runs save submitted 16 kHz mono WAVs under `mixed/<phrase>/` for replay.
This controlled additive-noise test does not reproduce reverberation, microphone
overload, moving sources or every property of a real foundry.

## Plan without spending credits

PowerShell, from the Agent directory:

```powershell
.\.venv\Scripts\python.exe tools\noise_bench.py --dry-run
.\.venv\Scripts\python.exe tools\noise_bench.py --dry-run --max-calls 10
```

Dry run loads and validates available audio, prepares missing synthetic noise, and
prints cached/uncached counts and the number of calls allowed by the limit. It never
initializes the Gnani client or sends STT requests, and never writes mixtures, reports
or the transcript cache. With the starter CSV and no speech recordings, it reports
130 potential conditions but zero runnable conditions and zero calls.

## Run later, when credits are authorized

The following commands make real paid STT calls; they were **not** run during setup:

```powershell
# Existing Agent .env is loaded; process environment variables take precedence.
$env:GNANI_STT_LANGUAGE = 'en-IN'
$env:GNANI_MOCK = 'false'
.\.venv\Scripts\python.exe tools\noise_bench.py --max-calls 10
```

Configure `GNANI_API_KEY` through the existing Agent environment or `.env`; do not put
it in recordings, CSVs or reports. A live run refuses mock-mode clients so placeholder
transcripts cannot be mistaken for Prisma performance. The default limit is 60 new
attempts per invocation, including failed requests and retries. The client retries a
429 once after one second and a 504 once immediately; a single remaining call in the
budget disables the retry. Dry-run counts initial attempts, before possible retries.
Jobs run in clean, 20, 10, 5, 0 dB order; reports show scored/planned coverage when
the limit stops a run. Limits apply per invocation, not per day or for all reruns.

Compare models without editing `.env` (these examples are dry runs):

```powershell
.\.venv\Scripts\python.exe tools\noise_bench.py --dry-run --stt-model v2.5 --stt-language en-IN --stt-format transcribe
.\.venv\Scripts\python.exe tools\noise_bench.py --dry-run --stt-model prisma-v3.0 --stt-language "ta-IN,en-IN" --stt-format codemix
```

Remove `--dry-run` only when ready to spend credits. Overrides affect only the process
environment; `.env` is never written. `v2.5`/`prisma-v2.5` (or an empty model argument)
omits the model field; the default is `prisma-v3.0`. v2.5 supports a single language
and `verbatim`/`transcribe`; v3.0 also supports up to four comma-separated language
hints, `indic-auto`, `codemix`, and `transliterate`. `GNANI_STT_KEYTERMS` comes from the
environment; an empty value disables it. Keyterms are a v3.0 feature.

`results_cache.json` keys are JSON tuples `[file, noise, snr, model, language, format]`,
so v2.5/v3.0 and language/format variants coexist. Each entry also fingerprints the
submitted audio, keyterms, mixing version and service URL. Historical three-part keys
remain intact and can be re-scored, but are not reused for new calls because they do
not record a known model configuration. Saved runs/reports identify model, language
and format. With multiple configurations cached, use the three `--stt-*` options with
`--rescore-only` to select a comparison rather than pooling incompatible conditions.
Unchanged completed reruns cost zero calls; partially completed runs spend credits
only on uncached conditions, subject to the limit. With `--max-calls 0`, only cached
results are scored. Changing recordings/noise/config invalidates affected entries.
Failed attempts are also cached to prevent accidental repeated spending; delete only
their entries if you deliberately want to retry. Stop other benchmark processes before
editing or running: the cache is designed for a single writer, with atomic saves after
each request. If interrupted while a request is in flight before its result is saved,
that request may need to be repeated and can incur credits again.

## Reports and scoring

Re-score the saved transcripts after changing the frontend mapper, with zero STT calls:

```powershell
.\.venv\Scripts\python.exe tools\noise_bench.py --rescore-only
```

This path reads only `runs.csv` for reference labels and `results_cache.json` for
transcripts (falling back to a saved CSV transcript when its cache entry is absent).
It does not load `.env`, read audio, generate mixtures, initialize Gnani or modify the
transcript cache. It updates `runs.csv`, `report.csv` and `report.md`; its planned counts
refer to saved conditions only. A cache entry without a CSV reference label is an error,
so unlabeled attempts are not silently dropped. Keep the saved CSV and cache together.

Reporting requires Node on PATH. Python sends rows as JSON to `score_intents.mjs`,
which imports the actual frontend `src/services/voiceIntents.js` and calls `mapIntent`
for every transcript. The script also accepts a JSON array on stdin and emits scored
JSON on stdout; it contains no STT or network code. Optional local scoring checks:

```powershell
node --test tools/noise_bench/score_intents.test.mjs
```

Live/cache-only runs produce `report.csv` and `report.md` (per-SNR accuracy summaries),
plus `runs.csv` (one row per completed condition). WER uses case/punctuation-normalized token edit distance;
number words remain words for WER. It may exceed 100% with insertions. Word accuracy
is `max(0, 1 - aggregate WER)`, and exact-text accuracy is also reported.

Slot scoring separately normalizes English number words (including “ten fifty one”)
and heat aliases, then checks heat digits and C/Si/Mn/P/S names/symbols, including Tamil
aliases. N/A means that phrase does not ask for that slot. Missing/failed STT counts
as a failed slot and empty transcript; unattempted conditions are excluded from
accuracy denominators and remain visible in coverage counts. The summary is pooled
across noise tracks, with per-track results in `runs.csv`. The original lexical element
metric and WER remain unchanged by frontend speech-alias fixes, preserving comparability.

`Intent correct` requires a successful STT result and a mapper intent equal to
`expected_intent`. `Intent + heat correct` also requires the reference heat number
when present; prompts without a heat are scored on intent alone. Failed attempts
count as incorrect. `runs.csv` includes `predicted_intent`, `predicted_params`,
`intent_correct`, and `intent_heat_correct` for inspection. These two metrics do not
check element/alloy parameters; an intent match alone is not complete command accuracy.

WAVs and `results_cache.json` are ignored by Git. `phrases.csv`, this README and
`report.md` remain trackable; reports and CSVs contain your phrase text and transcripts,
so review their contents before committing. No recordings ship with this bench.
