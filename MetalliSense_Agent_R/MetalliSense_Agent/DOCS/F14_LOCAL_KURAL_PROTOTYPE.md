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
