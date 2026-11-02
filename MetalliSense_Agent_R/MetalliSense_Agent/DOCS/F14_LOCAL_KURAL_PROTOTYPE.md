# Isolated local Kural benchmark — first candidate

2026-11-02. Existing tour controls, flags, approved captions/audio and application capture code are untouched. No model, runtime dependency or recording has been installed/acquired by the agent. No provider calls. This is a file-only benchmark prototype, not a running browser wake detector or an accuracy claim.

## Recommendation and license evidence

Start with **Sherpa-ONNX 2.0.1 + sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01, int8 encoder/decoder/joiner**. It is an open-vocabulary English keyword spotter; create the keyword using its own BPE tokenizer as `KURAL @KURAL`, never guessed phoneme/subword tokens. No custom training is required to attempt this keyword. Native Tamil pronunciation and accents must be screened with our recordings; the model is not documented as Tamil-capable. If misses remain unacceptable after a documented threshold evaluation, training or a multilingual comparison may be needed.

New primary-source evidence supersedes the earlier unresolved-license checkpoint: the model maintainer explicitly confirmed both named models are Apache-2.0 on October 26, 2026: [maintainer clarification in issue 3802](https://github.com/k2-fsa/sherpa-onnx/issues/3802) (final csukuangfj comment, October 26). The [engine LICENSE](https://github.com/k2-fsa/sherpa-onnx/blob/v2.0.1/LICENSE) is Apache-2.0. These permit redistribution subject to license/notice requirements; preserve the model README and bundled third-party notices. Setup refuses a downloaded model without its expected Apache-2.0 notice. No unknown-license weights are bundled here.

Official artifact sources:

- [Model archive](https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2), [model release sizes](https://github.com/k2-fsa/sherpa-onnx/releases/expanded_assets/kws-models), [model documentation](https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html).
- [Windows x64 CPU runtime archive](https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-win-x64-shared-MT-Release-no-tts.tar.bz2), [release sizes/digests](https://github.com/k2-fsa/sherpa-onnx/releases/expanded_assets/v2.0.1). Published runtime SHA-256: `a644dfe2f7944afec9a356d2557c0452380f20ffcf2f8c704653cfce37558596`; setup verifies it before extraction.
- [Tokenizer CLI implementation](https://github.com/k2-fsa/sherpa-onnx/blob/v2.0.1/sherpa-onnx/python/sherpa_onnx/cli.py), [keyword tokenization instructions](https://k2-fsa.github.io/sherpa/onnx/kws/index.html).

| First-candidate file | Upstream published size |
|---|---:|
| Model archive, including unused fp32 variants/test examples | 16.8 MB compressed |
| encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx | 4.6M in upstream `ls -lh` |
| decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx | 272K |
| joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx | 160K |
| tokens.txt | 4.9K |
| bpe.model (keyword preparation, not inference graph) | 240K |
| README.md (model notice/provenance) | 743 bytes in upstream listing |
| Windows runtime archive above | 24.4 MB compressed |

These are upstream rounded sizes, **not measured exact local byte counts**. Listing/ModelScope API access did not yield exact per-file byte metadata here; no sizes were invented. `artifacts.json` records exact bytes and SHA-256 for every selected file after local setup. Selected inference graphs total roughly 5 MiB; runtime/Python tokenizer packages add disk/memory overhead. Package download sizes vary by platform and are not included in the two archive sizes. Only this one model is acquired; bundled fp32 files are variants of the same model, not a second candidate.

## Comparison, not a second installation

| Approach | Concrete candidate | Placement/hardware | Language/cost/limitation |
|---|---|---|---|
| Small KWS, recommended first | Sherpa-ONNX 2.0.1 and int8 GigaSpeech 3.3M files above | Initial offline native Windows x64 CPU; no GPU. Browser port uses the official WASM KWS bindings/Emscripten with matching English assets. Peak RAM and end-device latency not measured. | Engine and model Apache-2.0. No keyword retraining for a first attempt; English-only acoustic model does not establish Tamil Kural success. |
| Local ASR then whole-word text check | Multilingual Whisper Tiny Q5_1, `ggml-tiny-q5_1.bin`, whisper.cpp 1.9.5 | CPU-native initial comparison; browser WASM exists but adds integration/load cost. Model file published as 32.2 MB; upstream unquantized tiny reference uses ~273 MB memory, not a measured Q5 result. | [Whisper code/weights MIT](https://github.com/openai/whisper#license), [converted model MIT card](https://huggingface.co/ggerganov/whisper.cpp), [whisper.cpp MIT](https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/LICENSE). Tamil is a supported transcription language, not guaranteed isolated-name recognition. Hallucinated text can cause false wakes. No training required for a test. |

Whisper reference only: [official converted files](https://huggingface.co/ggerganov/whisper.cpp/tree/main), [downloader lists tiny-q5_1](https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/models/download-ggml-model.sh), [Tamil tokenizer language](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py), [runtime platform/memory](https://github.com/ggml-org/whisper.cpp). **Do not install/download Whisper now.** The harness has an optional comparison adapter tested only with fixture bytes; no second weights/runtime are installed or queued. Revisit only if first-candidate recordings justify it.

Browser-local remains the intended deployment direction: no ambient audio crosses even loopback. Native file evaluation is more practical for this first evidence gate because it avoids a WASM toolchain/Worker/audio-owner change. It has no live backend or LAN listener. A later persistent local backend engine would add loopback transfer/buffering but avoid browser compilation; that is not equivalent to browser-local privacy and must never run on a remote server without an explicit redesign. Cold CLI processes per clip are unsuitable for production wake latency; a live prototype must keep the model loaded.

## Exact local setup — first model only

From the Agent directory in a **local Windows x64 PowerShell terminal**:

```powershell
& .\.venv\Scripts\python.exe .\tools\setup_local_kural.py --download
```

This explicit command downloads the two official archives over verified HTTPS, checks the runtime digest, validates extraction paths/model notice, and creates an isolated tokenizer environment under ignored `tools/local_wake_data/sherpa-2.0.1/`. It installs `sherpa-onnx==2.0.1`, Click and SentencePiece there, generates KURAL tokens with the model's BPE, and records dependency versions and exact file bytes/hashes. It does not change project requirements, infer audio, contact Gnani, or install a second model. A fresh invocation refuses an existing setup directory. Use the explicit validated resume command below for partial/completed setup; it never overwrites mismatching artifacts.

The setup entry point defaults to doing nothing without `--download`. A PowerShell-script version was syntax-checked but execution was blocked by this host's execution policy; it was replaced with Python, not a policy bypass. Actual downloads/installations have not been tested in this network-restricted agent environment. No account, API key, paid service, TLS bypass or proxy change is required. Browser app flags are unchanged.

## Short recording collection

Serve only the tools directory locally (does not serve `.env`):

```powershell
& .\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
```

Turn the existing tour Mic off and close other recorders first so the collector is the only microphone owner. Open `http://127.0.0.1:8766/collect_kural_recordings.html`. Record explicitly; the page has no upload code and a `connect-src 'none'` CSP. It requests supported echo cancellation/noise suppression/AGC, saves only relevant applied settings (no device identifiers), and caps each take at 30 seconds. It is a collection tool, **not a detector**. Record/Stop are manual; no VAD or wake event is implied. Audio and metadata download locally; discard private speech that participants did not consent to record.

- Positive first screen: ten takes each of `Kural`, `குரல்`, `குரல்` + a natural ~0.5-second gap + `அடுத்து போ`, and `Kural aduthu po`; use at least two consenting speakers and natural near/far speech. No training is required yet.
- Similar-sounding negatives: `குரங்கு`, `குழல்`, `குறள்`, coral, cruel, neural, and bare `அடுத்து போ`. Their intended negative label is not proof the acoustic model can distinguish them.
- Background: ordinary Tamil/English conversation without Kural, fan/TV and silence; record actual duration and annotate any genuine wake-word occurrence before evaluating.
- Echo: record approved Dashboard/Finish narration over speakers without a human wake word, then a Stock clip as a non-Kural playback control. Repeat with headphones. Do not edit approved audio. A standalone detector may correctly hear the narration's Kural; app-level echo suppression must prevent that detection from executing a command. No speaker barge-in claim is made.

Copy recordings into `tools/local_wake_data/recordings/` and convert locally with the already-supported FFmpeg utility, e.g.:

```powershell
ffmpeg -i .\tools\local_wake_data\recordings\P01_take01.webm -ar 16000 -ac 1 -c:a pcm_s16le .\tools\local_wake_data\recordings\P01_take01.wav
```

Listen and annotate first. Copy `tools/local_kural_samples.example.csv` beside the WAVs as `samples.csv`, remove unrecorded rows, add real takes, and correct expected_wakes/conditions. Each file is 0–30 seconds with zero or one intended wake. Background observation can be multiple 30-second clips; record total minutes. Negative echo labels describe unwanted application activation, not absence of the acoustic word. Ground truth is human annotated, never inferred from the model's output.

## Run the isolated benchmark

From Agent PowerShell after setup and recordings:

```powershell
$artifacts = Get-Content .\tools\local_wake_data\sherpa-2.0.1\artifacts.json -Raw | ConvertFrom-Json
& .\.venv\Scripts\python.exe .\tools\local_kural_benchmark.py --enable-local-wake-bench --engine sherpa --executable $artifacts.executable --models $artifacts.models --keywords $artifacts.keywords --dataset .\tools\local_wake_data\recordings\samples.csv --output .\tools\local_wake_data\results-sherpa-01
```

Default is off without `--enable-local-wake-bench`. All artifacts and WAVs validate before any process starts. Results are exclusive/new directories; no overwrite, retries, microphone, network, provider, cloud transcript, app control or mutation integration. Executable/model/WAV hashes are recorded. Missing artifact, malformed WAV or engine timeout stops safely; subprocess.run's timeout kills/waits for the direct child. Model loading failure cannot arm the separate mockable one-command boundary.

`results.json` records missed positive clips, false-activation events, observed negative minutes and cold process wall time. KWS token offsets are diagnostic, **not measured detection latency**. `detection_latency_ms` remains null: a real-time replay/Worker must timestamp the actual detection event against a human-labelled wake end. The manual sheet `F14_WAKE_MANUAL_TEST.csv` includes that pending measurement. No model accuracy/latency numbers have been generated here.

Next gate: examine missed wakes and false events per speaker/condition, then run a resident streaming replay to measure real latency/CPU/RAM. Only then decide whether to tune thresholds, collect training data or justify the larger ASR comparison. Before app integration, prove one activation consumes one command, expiry/no-speech and processing deadlines, cleanup/cancellation and global unsafe-command refusal. Cloud STT may receive only the bounded post-activation command audio; Waiting must have no STT socket. Preserve one microphone owner and keep playback suppression as the safe default until speaker echo is measured.

Verification: 8 isolated mocked tests passed with GNANI_MOCK=true, Python compilation and collector JavaScript syntax check passed, and staged/unstaged diff checks passed. Both setup and benchmark disabled defaults were exercised without downloads or inference. All 22 approved tour WAV hashes remain unchanged. No real model loading, recordings, wake scores, false-activation rates or real-time latency were measured. No frontend runtime file changed.


## Resume an existing partial setup

2026-11-02. The initial local setup failed at tokenization because pypinyin was missing. The user installed pypinyin 0.55.0 in the isolated tokenizer environment. Read-only inspection confirms both archives and all their extracted members are present and match; the runtime archive matches its official SHA-256. Actual archive sizes: runtime 25,567,228 bytes, model 17,626,723 bytes. Model README contains the Apache-2.0 notice. The official runtime archive contains no LICENSE/NOTICE member; its verified digest and upstream Apache-2.0 source license are recorded explicitly rather than claiming a bundled notice exists. Retain upstream notices on any redistribution.

The tokenizer environment validates its own prefix and imports/versions: Sherpa 2.0.1, Click 8.5.0, SentencePiece 0.2.2, pypinyin 0.55.0. Existing raw keyword is KURAL @KURAL. Neither final keywords.txt nor artifacts.json exists yet. No partial files were deleted or replaced by this audit.

From Agent PowerShell, run exactly:

```powershell
& .\.venv\Scripts\python.exe .\tools\setup_local_kural.py --resume
```

For this observed state, resume will revalidate archives/files/model notice/environment, skip all downloads, extraction of already-present matching files, environment creation and package installation, then run KURAL tokenization. Output is staged to a unique retained pending file; only validated vocabulary pieces that reconstruct KURAL with the correct label become keywords.txt. Then dependency versions and the completed artifact manifest are written. The manifest is never written before all required files and keyword tokens validate. Completed reruns validate and reuse the existing manifest without rewriting it or tokenizing again.

Resume alone permits no downloads or package installation. If an archive or dependency is genuinely missing, it stops with an explanation; only the separate explicit --download option permits filling missing artifacts/dependencies. Fresh setup now includes pypinyin==0.55.0. Installed wrong pinned versions, differing extracted bytes, bad archives or invalid existing keywords are preserved and rejected; they are not overwritten. Existing manifests are hash-checked before dependency actions. Missing extracted files can be restored from validated existing archives without redownloading.

Verification: 7 new setup tests passed (fresh, partial tokenization resume, completed reuse, missing dependency, corrupted archives/extractions, invalid keyword output and missing-file restoration); 8 existing benchmark tests passed. GNANI_MOCK=true; Python compilation and staged/unstaged diff checks passed. No frontend code changed, so no frontend tests/build were rerun. No downloads, installation, inference, provider calls, staging, commit or push. Changes: setup_local_kural.py, new test_setup_local_kural.py, this document and the F14 status entry.


## P01-P03 non-detection diagnosis (2026-11-02)

No confirmed pipeline defect was found. The completed setup manifest hashes validate. Re-running the installed Sherpa 2.0.1 text2token CLI with this model's tokens.txt, bpe.model and --tokens-type bpe produces exactly the existing UTF-8 keyword file: `▁K UR AL @KURAL`. This verifies orthographic BPE encoding, not Tamil pronunciation support. The runtime's displayed modeling_unit=cjkchar default does not retokenize this pre-encoded keyword file; BPE encoding is performed separately by text2token.

The versioned native file-runner source adds 0.8 seconds of zero tail, calls InputFinished, drains IsReady and writes each detected result as JSON to stdout. Our command uses that runner and our parser reads stdout. P01's saved diagnostic and P02/P03 raw output contain no detections; these were successful executions with no reported wake, not evidence based solely on exit code.

Official controls already bundled in the same model archive were byte-verified against their archive members, then tested individually with bundled test_wavs/test_keywords.txt and the same int8 model/default thresholds. 0.wav detected LIGHT UP (token timestamps 3.00, 3.04, 3.08, 3.20 s). 1.wav detected LOVELY CHILD (5.40, 5.60, 5.84, 6.00, 6.04 s) and FOREVER. Token timestamps are decoder offsets, not streaming latency; the later FOREVER result follows the runner's reset and is not presented as an absolute file timestamp. Both known-positive files passed. No KURAL control was available.

Evidence: tools/local_wake_data/diagnosis-P01-P03-20261102-01/diagnosis.json and keywords-reencoded.txt. Prior evidence and all original recordings remain unchanged. No thresholds, model files, tour code or audio changed. No downloads, installs or cloud/provider requests. No harness defect was repaired, so no regression tests were added and no frontend build was needed.

Possible remaining cause: this English BPE acoustic model may not match the recorded pronunciation of குரல் or its recording conditions. Valid spelling and passing English controls do not establish which cause applies. Next diagnostic: decode the existing P01-P03 files with the already-installed transducer recognizer and same model to inspect its unconstrained English token hypotheses before choosing any alternate keyword spelling or collecting more recordings. No such follow-up decode or threshold tuning was performed in this diagnosis.

Official evidence: https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/v2.0.1/sherpa-onnx/csrc/sherpa-onnx-keyword-spotter.cc and https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html (GigaSpeech 3.3M section). Documentation/source text was inspected; no model/runtime artifacts were downloaded.


## Unconstrained existing-clip decode (2026-11-02)

The installed sherpa-onnx.exe transducer recognizer loaded the exact same int8 encoder/decoder/joiner and tokens successfully. Its executable was byte-verified against the existing official runtime archive, and setup manifest artifacts were hash-checked. CPU, one thread, greedy_search; no keyword list, hotwords or external language model. Three local decode executions; no cloud/provider calls, downloads or installations. Existing WAV format/frame alignment and unchanged hashes were verified.

| Clip | Intended prompt | Emitted hypothesis | Execution |
|---|---|---|---|
| P01 | User-confirmed audible Kural; full prompt not established | GOOD AND COULDN'T HAVE | Exit 0, nonempty |
| P02 | Kural (Tamil-script metadata prompt) | GOOD ERRAL | Exit 0, nonempty |
| P03 | Kural ... aduthu po (Tamil-script metadata prompt) | GOOD AND ADDED TO | Exit 0, nonempty |

Recognition results are emitted on stderr by this recognizer; stdout contains setup timing. Both streams and exact commands are retained in tools/local_wake_data/unconstrained-P01-P03-20261102-01/ (P01-raw.json through P03-raw.json, manifest.json, summary.json and recognizer-help.txt). These are diagnostic hypotheses, not transcriptions verified by listening, a supported Tamil capability, or replacement keyword recommendations. The emitted result objects have is_final=false/is_eof=false as printed by this CLI. P01 includes token offsets 3.24-3.68 s beyond its 3.00-second source duration during tail decoding; those tokens cannot be assigned to recorded speech.

Together with passing official English controls, the hypotheses support a pronunciation/acoustic-model mismatch, while recording conditions and the small English model's limitations remain possible contributors. Next single experiment: test a frozen candidate-alias set derived from these hypotheses against the same positives AND a deliberately chosen similar-sounding negative set (including good, good and, coral and curl), before selecting any replacement keyword. No aliases or thresholds were changed in this task. No source code changed or new tests were needed; no frontend build was run. Original recordings and all previous evidence remain preserved.


## Local commit verification

Renamed the test-only imported module alias setup_module to setup_tools so pytest does not interpret it as an xUnit hook. No benchmark behavior changed. The selected mocked Agent suite (stream, local setup/benchmark and audition tools) passes: 108 tests, 7 existing warnings, GNANI_MOCK=true. An initial rename guard used an incorrect occurrence count, left the file unchanged and repeated the known eight setup errors; the corrected rename passes. No test was skipped or weakened.


## Multilingual Whisper Tiny setup attempt (2026-11-02)

Selected only multilingual ggml-tiny-q5_1.bin and whisper.cpp v1.8.3 Windows x64 CPU runtime. Official sources/checksums rechecked: runtime ZIP SHA-256 d824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d; model published SHA-1 2827a03e495b1ed3048ef28a6a4620537db4ee51. Sources: https://github.com/ggml-org/whisper.cpp/releases/expanded_assets/v1.8.3 and https://huggingface.co/ggerganov/whisper.cpp/raw/main/README.md . Both runtime and model are MIT: retain OpenAI and ggml copyright/permission notices, model card and bundled third-party notices on redistribution. Exact downloaded/extracted sizes and binary dependency checks remain pending: no archive was received.

The single setup invocation stopped at the first runtime URL: URLError / WinError 10013 (socket access forbidden). No retries, model request, completed download, runtime execution, recording upload, cloud STT or synthesis. Failure journal is in ignored tools/local_wake_data/whisper-tiny-q5_1-v1.8.3/. All six inputs validate mono PCM16 at 16000 Hz, complete frames and unchanged hashes: P01 3.00 s; P02 take01 3.06 s; P03 3.00 s; P02 take02 4.68 s; take03 3.48 s; take04 5.16 s. Whisper outcomes are NOT RUN, not recognition misses.

New default-off tools/setup_whisper_kural.py validates artifacts/checksums before extraction/execution, checks archive members before reuse, preserves partials/mismatches and prior manifests, and checks native CLI options. It downloads only the selected model/runtime and license/card text. Complete checksum-verified partials can be reused; incomplete partials remain evidence and a later explicit run starts a separate attempt, not byte-range continuation. No dependency installation. Runtime contents, installed bytes, hashes, help, exact inference arguments, raw stdout/stderr and process timings are recorded on success. Every clip uses -l ta --no-timestamps --no-gpu without translation, prompts or keyword hints. Existing subprocess.run timeout is 60 seconds and kills/waits for the direct child; no microphone or persistent inference session is created.

The adapter already recognized Tamil; it now preserves actual matched Tamil/Latin strings with Unicode letter/mark/number boundaries rejecting attached suffixes. Full hypotheses and failure/timeout streams are saved separately. Engine failures stop the batch instead of counting as recognition misses. Focused mocked setup/benchmark tests: 14 passed, GNANI_MOCK=true. No frontend changes/build. An initial inline input-validation script needed tools on sys.path; this was corrected for that inspection script only, with no inference or network retry.

From the Agent directory, run once in local PowerShell:

```powershell
& .\.venv\Scripts\python.exe .\tools\setup_whisper_kural.py --download --benchmark
```

The command validates/reuses complete artifacts and creates new result directories. After six hypotheses are available, decide whether similar-sounding negatives, silence/noise and narration echo warrant testing. These positives cannot measure false activations. Cold transcription time includes loading/offline decoding, not streaming wake latency. No app integration or approved audio changes.


## Whisper failure-journal/manual-placement inspection

Both existing failure journals omit the artifact and URL: one records WinError 10013, the other WinError 10054. Neither identifies the failed URL from durable evidence. At inspection there are only the two failure JSONs and input-validation.json: no ZIP/model/license download or partial file is present. Thus no download bytes are currently saved; the old journals did not record transfer-byte counts. The helper's first configured artifact is runtime.zip, but that ordering is not substituted for a recorded failed URL. No requests were made during this inspection.

For manual browser setup, the first required archive is https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip . Save/rename it to tools/local_wake_data/whisper-tiny-q5_1-v1.8.3/runtime.zip (not the upstream filename). Required SHA-256: d824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d. The exact multilingual model URL is https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin ; save ggml-tiny-q5_1.bin in the same directory; published SHA-1: 2827a03e495b1ed3048ef28a6a4620537db4ee51. No model or TLS changes.

The helper already accepts these manually placed target files, validates checksums before extraction/execution and does not redownload them. Invalid targets are rejected without overwriting. New mocked tests prove manual reuse and corrupt-file refusal. Future failures now record artifact, public requested_url (not signed redirect URLs), partial_file, partial_exists and saved_bytes. Error URLs are stripped of userinfo/query strings. Existing failure journals and partials remain unchanged. Mocked tests cover both absent files and four-byte interrupted downloads, retaining partial bytes. Focused setup/benchmark suite: 16 passed; staged and unstaged diff checks passed. No inference, network retry, frontend build, staging or commit.

To perform entirely offline setup and inference after manually supplying the two artifacts AND the three license/card files named in FILES, use `.\.venv\Scripts\python.exe .\tools\setup_whisper_kural.py --benchmark`. Omit --download: a missing required file stops without networking. The required notice URLs remain the pinned whisper.cpp LICENSE, OpenAI Whisper LICENSE and converted-model README already listed by the helper; notices have content checks rather than invented published checksums.


## Separate Hey Nova preparation (untested candidate)

Created ignored tools/local_wake_data/hey-nova-sherpa-2.0.1-01/ with HEY NOVA @HEY_NOVA raw text, model-generated BPE tokens, tokenizer command/output and candidate manifest. Tokens are U+2581 HE, Y, U+2581 NO, V, A (word-boundary marker attached to HE and NO); all exist in the installed model vocabulary and reconstruct HEY NOVA. Original KURAL file hash remains a852b00075b8179dec74bc911d9c20edc9483d28224548ab38b33be76c8cb305. No downloads, installs, inference, threshold changes, app/tour integration or approved-audio edits.

Collector adds only HN01 - Hey Nova (untested candidate); all prior IDs/texts remain unchanged. Select HN01, keep the page open, and record three natural takes: one second silence, say Hey Nova once, one second silence, Stop. Replay each complete phrase. Expected downloads: HN01_take01 through HN01_take03, each audio (.webm or .mp4 depending browser) plus JSON metadata. Do not rename older Kural recordings or overwrite takes from previous sessions.

From Agent PowerShell:

```powershell
& .\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
```

Open http://127.0.0.1:8766/collect_kural_recordings.html . Turn tour Mic off and close other recorders before granting this page the microphone. The collector has connect-src none, no detector, no cloud API and no automatic recording.

After recordings exist, preserve/hash originals and metadata, convert copies using existing FFmpeg to mono PCM16 at 16000 Hz, validate frames/duration, and test with this candidate's keywords.txt and --keyword-label HEY_NOVA. The benchmark label option changes result filtering only; default remains KURAL and acoustic thresholds stay unchanged. The candidate recordings/samples.csv is a template with pending listening review, not evidence that recordings exist. Detection has NOT run. Positive recognition and false activations remain unmeasured; negative/echo testing is a later gate.

Verification: node tests/recording_collector.test.cjs passed offline DOM/media mocks for preserved prompts, new prompt and three filenames/metadata pairs, explicit mic access, 30-second cap and track cleanup without networking. Mocked benchmark/Whisper setup regressions: 17 passed, GNANI_MOCK=true. No physical microphone/browser listening check or frontend build was performed. No staging or commit.


## Personal-use custom Kural pilot collection (no training yet)

The English Sherpa controls passed, but KURAL missed six positives; multilingual Tiny Q5_1 also missed all six and the 1.0-3.0-second P02 take02 crop still missed. The user confirms the complete word is audible in that crop. These files and all their derivatives remain exploratory development evidence, not enough training data and not an untouched test set. No custom CNN has been trained or integrated.

Machine-readable plan: ../tools/kural_pilot_plan.json . Collection page: ../tools/collect_kural_pilot.html . Speaker SPK01, personal use only: S01_TRAIN = 40 natural positives, 60 varied speech negatives and 300 seconds background; S02_VALID = 20 positives, 30 negatives and 300 seconds background in a separate later sitting, preferably another day. S03_TEST_RESERVED is declared before training and locked in this collector. Its counts/protocol must be frozen before future test collection; do not inspect it while choosing weights/thresholds. Same-speaker validation measures personal/session behavior, not unseen-speaker generalization. These counts are an initial experiment, not evidence of reliability.

Positives rotate natural Tamil-script Kural, the same word labelled in Latin script, and Kural before a short read-only question. Vary normal pace and distance; do not substitute a different wake phrase. Negatives rotate similar-sounding Tamil words, coral/curl/cruel/neural/good I/good and, and ordinary Tamil/English speech; vary sentence context across repetitions. Each background cycle has four room/fan blocks, four consenting Tamil/English conversation blocks and two approved-narration speaker-playback blocks, up to 30 seconds each. Repeat as needed to reach at least five minutes. Counts reflect saved unreviewed takes; duration progress is capture wall time, not decoded audio. Validate actual WAV durations before training. Literal wakes in negative/background audio must be annotated rather than silently labelled absent. Narration containing the real wake is a playback/self-activation case and needs separate system-level treatment.

Consent is explicit per session and recorded with timestamp, scope and speaker/session IDs. Audio originals and metadata get unique session/split/prompt/UUID filenames. The collector retains local progress metadata in this browser and exports a private session journal. Replay each take and annotate actual wake start/end in seconds, or explicitly mark no audible wake; uncertain intervals stay null. Annotation downloads are separate sidecars, preserving original capture metadata. Validate interval bounds against decoded audio later. All originals, crops and augmentations must retain original_recording_id, speaker_id, session_id and split. No derivative can move into another split. Existing exploratory audio never becomes held-out test evidence.

First recording step from Agent PowerShell:

```powershell
& .\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
```

Open http://127.0.0.1:8766/collect_kural_pilot.html . Turn tour Mic off and close other recorders. Select S01_TRAIN, Positive, and the real acoustic condition; grant consent. Record one second silence, one natural Kural, one second silence, then Stop. Replay and mark the wake interval if confident; save annotation and export the journal. Begin with that one pilot take before completing the remaining 39 positives. Keep the uniquely named audio/JSON/annotation/journal under ignored tools/local_wake_data/kural-personal-pilot-v1/SPK01/S01_TRAIN/. Do not rename to lose the lineage. Plan the validation sitting separately; its data must never feed training or augmentation. The existing collector links to this page and retains all previous prompt IDs, including HN01.

This is a collection tool, not a substitute for required hands-free activation. The eventual qualification gate remains: loaded real local detector -> local wake event -> one bounded command recording -> Gnani STT for that command only -> cleanup/rearm. Waiting cannot upload ambient audio or open a cloud STT stream. Preserve a single microphone owner across the app/detector/command session, cancellation and read-only safety. Do not display waiting-for-Kural until an actual detector is loaded/running. Noise, narration echo, false activations/hour, missed wakes and streaming wake-end latency remain unmeasured. No tour/controller/audio modification is authorized by collection.

Tests: node tests/recording_collector.test.cjs and node tests/kural_pilot_collector.test.cjs pass with local DOM/media mocks. Coverage includes legacy prompts, embedded/JSON plan parity, consent, counts/session IDs, split/unique filenames, reload progress, separate annotation sidecars, locked test session, duplicate-start guard, background/narration blocks, 30-second cap, denied/error and late-permission/page-exit cleanup, and no network API usage. connect-src none remains enforced. A narrow .gitignore rule excludes generated kural-personal-pilot-v1_* audio/sidecars/private journal filenames even if misplaced. Staged/unstaged diff checks passed. No actual recording or microphone/browser listening test, TensorFlow install, training, inference, synthesis, frontend build, staging, commit or push.


## S01_TRAIN import and file validation (no training)

Selected Downloads journal kural-personal-pilot-v1_SPK01_journal_9563595e-87de-4353-81ec-f44bd361e9ab.json (123 records). The other journal, 607e771c-ebd5-44f1-8b9d-636e356e3cab, contains 27 identical common records and is a strict subset, not a competing/conflicting session. Both journals and all 123 WebM/JSON pairs were copied without changing Downloads originals into ignored tools/local_wake_data/kural-personal-pilot-v1/SPK01/S01_TRAIN/originals/. Source/copy SHA-256 values are recorded. No annotation sidecars exist. No expected files are missing and no extra pilot files were found.

New tools/import_kural_pilot.py is explicit/default-off, imports only SPK01/S01_TRAIN/train, preflights conflicting destinations, preserves identical files for validated reuse, rejects missing pairs/duplicate IDs rather than guessing, decodes separate WAV copies with existing hash-verified FFmpeg and no denoising/normalization, and generates a local review page. Results are in S01_TRAIN/validation-be12d89f58704705aa9e5311c70c2599/ (validation.json, WAVs, index.html and manifest-selection-and-source-audit.json). These are file validation results, not validation-split recordings.

Results: all 123 pairs decode to complete mono PCM16, 16000 Hz WAVs. Matched prompted positives 40/40; speech negatives 60/60; 23 background blocks total 297.54 decoded seconds/300 target, a deficit of 2.46 seconds. The collector's wall-clock sum was 301.4139 seconds, demonstrating why capture progress cannot replace decoded-duration validation. Four narration echo blocks total 50.46 seconds and remain marked echo, not ordinary wake-free negatives. Zero missing pairs, duplicate manifest IDs, duplicate decoded-audio hashes, corrupt/empty audio, or metadata inconsistencies were found.

All 123 records declare consent, speaker SPK01, session S01_TRAIN and split train. All 123 still say pending listening annotation with no accepted ground-truth labels; prompt categories do not prove what was spoken. No intervals were invented. No validation/test recordings entered training. Review full positive words, negative speech and accidental literal wakes, and distinguish narration playback before accepting labels. A decoded background top-up of at least 2.46 seconds is also required before the five-minute target is met (record a modest margin, then validate actual duration). Do not silently modify existing session records or counts to hide the deficit.

From Agent PowerShell, open:

```powershell
Start-Process ".\tools\local_wake_data\kural-personal-pilot-v1\SPK01\S01_TRAIN\validation-be12d89f58704705aa9e5311c70c2599\index.html"
```

Smallest immediate step: replay the first positive and mark its actual wake interval in a separate annotation; complete listening review before training preparation. The page is a read-only playback index and does not itself save annotations. Existing collection annotation sidecars or separately recorded review files can be imported later. Test-session reservation remains intact.

Verification: six new mocked importer tests passed (source preservation/reuse, missing pairs, duplicate IDs, destination conflicts, validation-session exclusion, invalid PCM/annotation bounds). Both diff checks passed. Generated audio/evidence remain under ignored local_wake_data; original filename ignore rules remain in force. No frontend change/build, installation/download, training, upload, inference, tour/approved-audio edit, staging, commit or push.


## Separate S01_TRAIN three-task correction collector

New tools/collect_kural_topup.html is local-only and has exactly TP01 (one natural Kural positive, one second silence before/after), TN01 (the complete speech-negative phrase good and), and TB01 (at least 10 seconds room/fan sound without speaking; aim for 12-15 seconds to allow for decoded-duration differences). All captures remain SPK01 / S01_TRAIN / train, pending listening review, with null wake intervals. No annotations are fabricated.

TP01 metadata replaces_recording_id = aff7301e-74b4-40f4-ab27-fd41140ec8a7; TN01 supplements_recording_id = 5f512dcd-2d0b-4e4e-bc9f-5aded5a1a5be. Each new capture has its own recording_id/original_recording_id and a separate topup_batch_id (S01_TOPUP_UUID). These are proposed replacement/supplement relationships only: neither original is deleted, overwritten or automatically included/excluded by this page/importer. Later reviewed dataset assembly must apply the agreed replacement explicitly.

Progress uses a distinct localStorage namespace ending topup-corrections-v1 and never reads/writes the main collector's progress. Captures download unique audio/JSON pairs and have actual condition, timestamped personal-use consent, browser audio settings and estimated capture duration. Export includes exactly the completed task candidates in records, plus all attempts separately; short background attempts are preserved as local downloads/evidence, excluded from completed records and leave the task pending. Export can be partial and declares complete=false until all three tasks are captured. Audio and metadata remain pending replay review even at 3/3.

Existing importer support is narrowed to collection_type=s01_topup_v1: validate batch/task type, capture requirement and fixed relationship IDs; show batch targets 1 positive / 1 speech negative / 10 seconds rather than pretending it is the full session. Preserve relationship fields and do not merge training datasets automatically. After conversion, a background shorter than 10 actual decoded seconds is flagged even if its capture timer passed. Original imported audio/journals are untouched. Exported records already match the existing capture metadata format. Failed/short attempts are preserved separately and are not accepted training rows.

From Agent PowerShell:

```powershell
& .\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools
```

Open http://127.0.0.1:8766/collect_kural_topup.html . Turn tour Mic off and close other recorders. Consent, select task/actual condition, Record, then Stop and replay each take. TP01: one second silence, natural Kural, one second silence. TN01: one second silence, say all of good and, one second silence. TB01: no talking, room/fan sound for 12-15 seconds. Finally export the top-up manifest and retain all files together. Generated filenames match the existing ignored kural-personal-pilot-v1_* rule and should be stored under ignored local_wake_data. Capture time is an estimate until decoded validation.

Tests: new node tests/kural_topup_collector.test.cjs passes all three tasks, unique filenames/batches, separate progress/reload, consent, relationships, actual importer inspection of exported audio/JSON pairs, partial exports and short background preservation, duplicate-start prevention, 30-second cap and Stop/error/page-exit/late-permission track cleanup. Existing pilot and legacy collector checks also pass unchanged. Eight mocked importer tests pass, including top-up relationship checks and decoded background minimum. CSP connect-src none and no network APIs; no actual mic/browser listening verification. Both diff checks pass. No installation/download, recording collection, training, cloud/provider calls, tour/approved-audio changes, staging, commit or push.


## S01 top-up import and user content approval overlay

Imported expected batch S01_TOPUP_701733df-155c-48ff-9777-6f58671004b5 from its unique Downloads manifest and three matching audio/JSON pairs. Top-up validation evidence: S01_TRAIN/validation-2df589e716994496b091ecace16f357c/. All three pairs validate mono PCM16 at 16000 Hz with complete frames, no missing/duplicate/corrupt pairs or metadata issues. Actual top-up background is 12.00 seconds. Source/copy hashes remain unchanged and replacement/supplement IDs remain metadata; neither original was deleted or overwritten.

The user's subsequent confirmation approves all three top-up contents. Saved a separate content-only overlay and updated playback index at S01_TRAIN/review-overlay-49e087ab681b48ae820b096ad84baa88/. Original reports, metadata, audio and earlier evidence remain immutable. New tools/review_kural_s01.py is explicit/default-off and rejects missing/ambiguous correction IDs, invalid files, wrong batches, relationships or cross-session records. It does not infer transcripts for uncorrected records or generate wake intervals.

User-reported corrections: 5342717e-cd43-41e9-8eb8-e0064515073d, 59c039aa-9b7f-465d-860f-a56961fead4a, 054ac5a1-c301-4125-af6b-81af1646d30f and d0edc637-4831-4ef9-b10b-9b5e3ec2f1f6 contain only Kural: retain wake-positive, classify wake_only rather than wake-plus-command. aff7301e-74b4-40f4-ab27-fd41140ec8a7 is excluded from training because the user reports no audible audio; file validity did not prove audible content. 5f512dcd-2d0b-4e4e-bc9f-5aded5a1a5be is retained as a speech-negative with user-reported content and, not verified good and coverage for that recording. All other original contents are user-approved. Four narration echo flags remain unchanged.

Final content-approved S01 inventory: 40 positives, 61 speech negatives, 24 background blocks totalling 309.54 actual seconds. This is 122 usable originals plus three approved top-ups; one original remains excluded/preserved. Of total background, four echo blocks are 50.46 seconds; they are not ordinary wake-free negatives. All wake intervals remain null/not supplied. Approval is the user's content review, not independent agent listening, fine-grained alignment or readiness to train. S02_VALID in a separate sitting remains a prerequisite for evaluated training; S03_TEST_RESERVED stays untouched.

Open review from Agent PowerShell:

```powershell
Start-Process ".\tools\local_wake_data\kural-personal-pilot-v1\SPK01\S01_TRAIN\review-overlay-49e087ab681b48ae820b096ad84baa88\index.html"
```

For S02_VALID: in a separate later sitting (preferably another day), use the existing local collector URL http://127.0.0.1:8766/collect_kural_pilot.html . If needed serve it with `.\.venv\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1 --directory .\tools`. Select S02_VALID, re-confirm personal consent and actual condition. Record 20 natural Kural positives with surrounding silence, 30 varied speech negatives including similar-sounding Tamil/English words and complete phrases, plus five minutes of room/fan, consenting speech and narration-playback blocks. Keep the same speaker SPK01, use the separate session progress, replay/annotate honestly and export its journal. Do not copy S01 originals/crops into validation, reset S01 progress, or use the S01 top-up page for validation. The five-minute display is capture-time only: validate decoded duration and address any deficit later. No test collection until recipe/decision rules are frozen.

Checks: importer and review-overlay suite 12 passed, GNANI_MOCK=true. Tests cover explicit top-up approval without inferred intervals, original preservation, exclusions, echo flags, per-session scope, rejected IDs/batches/relationships and default pending approvals. Rechecked all 254 original/top-up source/copy hash records; all match. Both diff checks pass; audio/evidence remain Git-ignored. No frontend build, downloads, training, inference, upload, tour/approved-audio edits, staging, commit or push. Existing uncommitted work preserved.


## Isolated custom CNN pipeline (2026-11-02)

Prepared a default-off scratch TensorFlow/Keras baseline, human waveform/playback annotation page and saved-prediction evaluation. See [setup, gates and exact commands](F14_CUSTOM_KURAL_PIPELINE.md). Current S01 hashes/consent/effective overlay validate: 40 positives, 61 speech negatives, 309.54 seconds background including four separately flagged echo blocks; excluded original preserved. No wake intervals were inferred. S02_VALID remains missing, and reviewed wake boundaries/absence labels are required before training. S03 stays untouched.

One isolated dependency setup attempt failed with No matching distribution found for tensorflow==2.20.0; no training dependencies were installed and no training ran. The compatible official Windows wheel exists; the captured error does not prove the underlying network cause. No retry was made. Partial isolated environment and failure log are preserved. Agent dependencies and production controls/audio remain unchanged.

Verification: focused Python suite 50 passed in 8.63 seconds; annotation and all three existing collector Node checks passed; Python compilation passed; 22/22 approved production WAV hashes match. No frontend build required because no frontend code changed. Generated evidence/environments/models remain ignored. Both staged and unstaged diff checks passed. No cloud/provider calls, training, staging, commit or push.


## Context-validity policy and negative-support audit

Implemented and tested a default-off two-second real-history policy for local checkpoint replay. Raw scores preserved; ineligible frames cannot prime event streak/cooldown. All20 S02 wakes remain reported, including14 short clips and one expired matching opportunity. No threshold qualifies. See [policy results and documented S01 repair proposal](F14_KURAL_CONTEXT_VALIDITY.md). Independent audit supports adding reviewed-negative S01 causal prefixes to future sampling; no training was run, no labels changed, and S03 remains untouched.

## Isolated real-time microphone diagnostic

2026-11-02. Added an explicit Start/Stop localhost diagnostic using the unchanged negative-context v2 checkpoint, frozen shared features and ungated event logic. It shows live scores and timestamped events at the four existing thresholds, and records manual expected wakes separately. It has no tour/app actions, cloud calls, automatic training import or threshold tuning. See [launch command, guided exercises and actual verification](F14_LIVE_KURAL_DIAGNOSTIC.md). Chromium checks used mocked capture/scores; actual microphone recognition and echo remain unverified. Prior data, annotations and runs are preserved; S03 remains untouched.
