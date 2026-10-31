# F7 voice shift handover

2026-10-31 (Asia/Calcutta). Owner: Manish. Branch `f7-shift-handover`. No commit.

## Documentation checked before coding

- [Batch transcription](https://docs.gnani.ai/api/STT/stt-batch.md) describes create -> start -> poll -> file listing -> signed transcript download at `https://api.vachana.ai`. Batch requests authenticate with `X-API-Key-ID`.
- [Create job](https://docs.gnani.ai/api/STT/batch/create-job.md): direct file upload is **part of creation**, not a separate upload step. `POST /stt/v3/batch/jobs` is multipart with a JSON `config` part and `files` audio part. The direct-upload limit is "10 MB" per file (up to 100 files). This app accepts one file, conservatively capped at 10,000,000 bytes. A job is created in `CREATED` and must be started explicitly.
- [Start job](https://docs.gnani.ai/api/STT/batch/start-job.md): `POST /stt/v3/batch/jobs/{job_id}/start` returns `STARTING`/202. The client sends an empty JSON object. Some older response messages mention `/v1/jobs`; the docs explicitly direct clients to use `/stt/v3/batch/jobs/...` instead.
- [Get job](https://docs.gnani.ai/api/STT/batch/get-job.md): "Poll no faster than every **10 seconds**." Active states include CREATED, STARTING, QUEUED, IN_PROGRESS, CANCELLING. Terminal states: COMPLETED, PARTIAL_FAILURE, FAILED, START_FAILED, CANCELLED. Only successful files are fetched for a partial failure.
- [Get files](https://docs.gnani.ai/api/STT/batch/get-files.md), and the [current v3 result page](https://docs.gnani.ai/api/STTBatch/Get_Job_Files.md): `GET /stt/v3/batch/jobs/{job_id}/files?status=COMPLETED` returns file records in `data`, not transcript text. `transcript_url` expires in "1 hour"; download it without the API key. The JSON contains segments with speaker_id, start_time, end_time, text, and per-segment language_detected.
- The Batch overview specifies `model`, `language_code`, `format`, `keyterms`, `with_diarization`, `num_speakers`, and optional mode. Keyterms are an array on this API. With v3, the language hint supports up to four comma-separated locales (or indic-auto/auto). We use ta-IN,en-IN, plus hi-IN when LANG_BRIDGE is on.
- Important difference: the overview calls num_speakers an "upper limit, not a target". Two requested speakers does not guarantee two actual speakers. With v3, labels may be produced regardless; with_diarization determines whether diarization failure fails the file.
- Important difference: the v3 example does not contain emotion or sentiment. Older examples include these as null. No documented config option guarantees non-null emotion/sentiment. The UI and route preserve provided string labels and otherwise report unavailable/null, never inventing labels.
- The overview says "billing is per audio duration either way". The pages checked do not publish an account-specific credits-per-minute rate, so exact deducted credits cannot be inferred from their text alone.

## Architecture and flags

`HANDOVER_ENABLED=off` and `VITE_HANDOVER=false` are the defaults, documented only in example env files. Existing `.env` and `.env.local` were not edited. Mock Vite mode exposes the frontend flag too. When disabled, the card's inner component is not mounted (no microphone or upload request); Agent POST returns 404 with handover_disabled.

The flagged Pre-Melt card records with MediaRecorder, automatically stops at 90 seconds, or accepts an uploaded audio file. It shows upload/processing progress. It sends multipart audio to our Agent's `POST /copilot/handover`; the API key remains server-side. The mock transport permits this real Agent endpoint with a sufficiently long batch deadline; it never fabricates a successful transcription on failure.

Agent validation checks bytes and **decoded audio samples**, not caller duration metadata. PCM16 mono/stereo WAV is decoded/resampled locally to 16 kHz mono; other supported audio containers use ffmpeg with local-only protocols and a bounded decoder timeout. WebM/M4A/MP3 require ffmpeg on the Agent PATH. This tool shell did not expose ffmpeg, so live verification used supported PCM16 WAV. Recordings outside 0.1–90 seconds or over 10 MB are rejected before provider calls. Only one normalized WAV is uploaded.

Batch create+upload -> start -> poll with 10/15/20-second intervals -> files -> signed JSON download. The total batch operation has a 120-second deadline. Requests use 20-second individual timeouts. Observed 429s on start/file-list calls are handled with bounded Retry-After/backoff (minimum 10 seconds, maximum 30; at most three attempts, all within the total deadline). GET retries also cover transient 5xx errors; creation is **never automatically retried**, avoiding duplicate jobs. A 429 start retry uses the same job. File download sends no API-key header and permits only HTTPS provider S3 URLs, without redirects.

The response contains `{segments:[{speaker,start,end,text,emotion,sentiment,language_detected}],job_id,duration_s}`. Speakers are anonymous labels in order of first appearance; unknown labels remain unknown. Provider errors return fixed safe codes through the existing Agent error envelope. No provider body, signed URL or API key is returned or logged by the handover client.

## Deterministic read-only cross-check

The frontend reuses `normalizeSpokenNumbers`, the shared Tamil/Hindi/Hinglish/English number parser. It extracts prefixed heat IDs and leading dictated IDs per segment, then associates each claim with its heat/clause. Separate numeric heat IDs are not added together. A four-digit number elsewhere in arbitrary chatter is not automatically a heat reference.

Keyword claims: OK/okay/ready/fine/சரி/ரெடி/ठीक -> says OK; hold/problem/பிரச்சனை/பிரச்சினை/गड़बड़ -> says problem; otherwise mentioned. Common explicit negation is handled conservatively. This is a small deterministic classifier, not an assertion that arbitrary conversation is understood.

| Claim / current gate | Result |
|---|---|
| says OK + HOLD or WARN | Red Mismatch |
| says problem + GO | Amber Check |
| Consistent claim and known gate | Green Consistent |
| Gate HOLD but heat never mentioned | Amber HOLD heat not mentioned in handover |
| Unknown/unchecked/stale gate | Amber Gate unavailable / recheck |

Gate snapshots come from existing read-only heat summaries, refreshed after a live response and via a Refresh button. Page snapshot changes also update the card. The component never invokes a gate check, start, approval, charge, stock or release mutation. A template-only optional summary uses existing Tamil/English voice preference and TTS; it never calls Evon. The sample button is explicit and labelled **Sample, not live — synthetic test fixture**; its fixture does not replace actual gate data.

## Script and expected demo result

Synthetic script for the team to act later (no human recording was made here). Live verification used two distinct Timbre v3.0 voices, not a recording of team members:

1. Speaker 1: **Heat one zero five three is fine.**
2. Speaker 2: **Heat one zero five two has a problem.**
3. Speaker 1: **Heat one zero five three is on hold.**

Kalpana rendered turns 1/3; Avinash rendered turn 2. There are 0.6-second pauses between clips and after the last clip. Total audio: **9.32 s**, safely under the first-smoke 20-second limit and subsequent 60-second live-job limit.

- For actual H-1053 after its existing pre-melt check returns HOLD: turn 1 is red Mismatch; turn 3 is green Consistent. The contradiction remains visible rather than being silently resolved.
- H-1052 uses its **actual current** decision. If GO, turn 2 is amber Check; if WARN/HOLD, it is green Consistent; if unchecked, it is amber Gate unavailable / recheck. This feature does not claim the untouched H-1052 reset seed has a GO/WARN decision, and does not run its gate automatically.
- To demonstrate omission: use only a handover about H-1052; existing checked HOLD H-1053 is amber as not mentioned.
- Tests cover all four requested outcomes with H-1053/H-1052 snapshots, plus actual mock-store integration proving H-1053 stays HOLD and stock/gates remain unchanged.

To reproduce: externally enable both flags and restart Agent/Vite; Pre-Melt Gate -> Reset -> select H-1053 -> Run pre-melt check -> Shift handover -> upload the generated local smoke WAV or record the script. For offline testing, click Load sample result (test only); the result stays visibly labelled sample/not live. No feature flag or local panel preference was changed in this task.

## Live results

**2 / 3 authorized batch jobs; 3 / 6 authorized TTS calls.** No further jobs, TTS or realtime/REST STT calls were made. The same cached 9.32-second synthetic recording was reused for job 2. Generated audio and the durable live-attempt journal remain ignored under `app/data/tts_cache/f7_handover/`.

| Job | Audio duration | Result / timing |
|---|---:|---|
| First smoke | 9.32 s | Create succeeded. Initial route returned batch_upstream_error after 1.550 s at start; start later returned 202 on the same job. Result-list GETs returned 429 during manual recovery. Successful final resume took 21.527 s. This is not a single uninterrupted end-to-end latency measurement. |
| Full corrected route | 9.32 s | HTTP 200 in **32.359 s end to end**, including local audio validation, upload/create, rate-limit backoff, start, poll and result download. States CREATED -> STARTING -> COMPLETED; start/file-list 429s recovered without duplicate creation. |

The initial start failure's HTTP status was not retained, so it is not attributed definitively to body shape or rate limiting. Explicit empty JSON starts succeeded. Subsequent start and files **429** responses were captured and directly motivated the tested backoff. The first job's provider timestamps show ~1.16 seconds from started to completed, but the much larger manual recovery latency must not be presented as processing time.

Both jobs returned the same raw segment fields below. The emotion and sentiment keys were **absent**, not present with a measured neutral value. The route normalizes those absent labels to null:

```json
[
  {"speaker_id":1,"start_time":0,"end_time":2.99,"text":"Heat 1053 is fine.","language_detected":"en-IN"},
  {"speaker_id":2,"start_time":2.99,"end_time":5.86,"text":"Heat 1052 has a problem","language_detected":"en-IN"},
  {"speaker_id":1,"start_time":5.86,"end_time":9.32,"text":"Heat 1053 is on hold.","language_detected":"en-IN"}
]
```

**Diarization:** correct two-voice separation and recurrence, IDs **1 -> 2 -> 1**, matching the authored voices. Segment boundaries include pauses, rather than precisely matching synthesis clip boundaries (0–2.72, 3.32–5.56, 6.16–8.72 s). All three transcripts preserve the intended IDs and claims. This establishes only this short, clean, synthetic example; no noisy human handover accuracy claim is made.

**Billing basis:** two 9.32-second completed files = **18.64 seconds**, or **0.310667 audio-minutes**. At the account's batch rate R credits/minute, that implies 0.310667 × R credits, plus the separately billed three TTS requests. The public pages checked do not establish R, and account balances were not queried. Exact credits deducted are therefore **unverified**, rather than invented. Polls/downloads/manual resumes did not create more batch jobs.

## Limits / work not performed

- No manual browser microphone recording, real operators, real factory audio or human emotion validation. A two-voice synthetic result cannot guarantee diarization on overlapping/noisy speech. Emotion/sentiment unavailable is shown explicitly.
- No long 60–90-second live job; duration/size and timeout boundaries are covered locally/mocked. No third job was needed after the full corrected route succeeded.
- Batch timeout/disconnecting the browser does not guarantee cancellation of an already-started provider job; this initial feature has no persistent job history or public resume/status route. The smoke tool has explicit internal resume support without duplicate jobs. Provider processing/billing may continue after a failed client wait.
- Keyword claims are limited and can miss nuanced negation, references spanning segments, or implicit/plural shared claims. The screen always shows the actual transcript and gate snapshot; operators must review it.
- Other audio containers require ffmpeg. PCM handling uses Python 3.11 audioop, consistent with the existing project runtime; its deprecation for Python 3.13 is visible in tests.
- Gate logic, seeds, intents/safety, STT/TTS defaults, streaming, Evon, F2 behavior, `.env`, `.env.local`, README and prior benchmark result files were not changed. No commit.

## Verification

- Agent: `python -m pytest tests -q` -> **188 passed**, **12 warnings**, **10.74 s**. All 171 previous cases retained; **17 new cases** cover multipart configuration/flow/states, rate-limited start and files backoff with one creation, internal resume, 120-second timeout, terminal failures, partial failure, HTTP errors, size/decoded duration boundaries, flag-off route, sanitized responses, and secret rejection. HTTP and sleeps are mocked for provider behavior; local PCM decoding is real.
- Frontend: `npx vitest run --configLoader runner` -> **434 passed**, eight files, **5.83 s**. All 404 previous cases retained; **30 added** cover English/Tamil/Hindi/Hinglish ID extraction, classifiers/negation, per-heat claim binding, no adding distinct IDs, all four requested outcomes plus stale/unknown gates, flag-off hiding, sample-not-live fixture labeling, unavailable Agent behavior, multipart/no-key requests, and actual H-1053/H-1052 store integration without mutations.
- Build: `npm run build -- --configLoader runner` -> **passed**, **2,810 modules**, **8.96 s**.
- `git diff --check` passed. No real browser/microphone test was performed. Live Batch verification used our actual Agent route via TestClient without startup/lifespan side effects, plus internal read-only recovery for job 1; it did not exercise the running dev-server network hop or browser capture.

## Files changed

Agent (`MetalliSense_Agent_R/MetalliSense_Agent`):

- `.env.example`
- `app/main.py`
- `app/copilot/gnani_batch.py` (new)
- `tests/test_gnani_batch.py` (new)
- `tools/f7_handover_smoke.py` (new)
- `DOCS/F7_HANDOVER.md` (new)

Frontend (`MetalliSense_Frontend_R/MetalliSense_Frontend`):

- `.env.example`
- `vite.config.js`
- `vitest.config.js`
- `src/pages/PreMeltGate.jsx`
- `src/mock/copilotTransport.js`
- `src/services/handover.js` (new)
- `src/components/voice/ShiftHandover.jsx` (new)
- `src/fixtures/handover-sample.json` (new)
- `tests/handover.test.jsx` (new)
- `tests/mock-unit.test.js`

Unrelated `.claude/` files were left untouched. No credentials or signed result URLs were added to tracked files. The smoke tool has durable attempt counters and requires explicit `--new-job` to create a further authorized job; normal reruns only print saved results. No third job or further synthesis was run.
