# MetalliSense Kural

## 1. Pitch

**MetalliSense Kural** is a Tamil-English (Tanglish) voice copilot for foundry furnace operators, built on Gnani AI. Operators can ask for a heat's status, hear why a pre-melt check returned HOLD or WARN, check chemistry and alloy stock, and open relevant screens without typing. Prisma transcribes mixed Tamil-English speech, Timbre speaks the reply, and deterministic, read-only intents keep furnace actions under human control. This project builds on [the original MetalliSense foundry decision-support platform, built by both team members](https://github.com/manishrahul1705/MetalliSense), retaining its gate engine and operator workflows.

## 2. Gnani AI models and implementation

Paths below are relative to `MetalliSense_Agent_R/MetalliSense_Agent/`.

| Model | Use and configuration | Implementation |
|---|---|---|
| **Prisma v3.0** | STT with `ta-IN,en-IN`, `codemix`, and foundry keyterms such as heat, FeSi, spectrometer, stock and hold. Browser audio is converted to 16 kHz mono WAV with ffmpeg. | [`app/copilot/gnani_client.py`](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_client.py) |
| **Timbre v2.5** | TTS with Tamil voice **Kamakshi**, configured through `GNANI_TTS_VOICE`; WAV replies are cached on disk in `app/data/tts_cache` to reuse repeated utterances. | [`app/copilot/gnani_client.py`](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_client.py) |
| **Evon v3.3** | Copilot provider implemented; **runs in mock mode in this demo**. The Hugging Face open-weights/self-hosted route needs a separately provisioned OpenAI-compatible endpoint, which is not configured here. | [`app/copilot/evon_explainer.py`](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/evon_explainer.py) |

Evon weights are published on [Hugging Face](https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B). Gnani also advertises a [hosted API closed-beta waitlist](https://www.gnani.ai/ja-jp/evon-waitlist); this repository does not claim live Evon API inference. Mock Evon replies are placeholders, not evidence of model performance.

## 3. Architecture

```text
React operator UI (:5173)
  -> Agent FastAPI (:8001)
      -> Gnani APIs: Prisma STT / Timbre TTS
  <- transcript and spoken audio
  -> read-only intent mapper -> factory data -> answer / screen navigation
```

In `dev:mock`, the factory stores and existing pre-melt gate engine run in the browser; voice and chat requests are routed to the Agent. The Node backend, separate AI service and VectorSearch service are not required for this demo mode. The base project's full multi-service setup remains documented in the [original project](https://github.com/manishrahul1705/MetalliSense).

The frontend normalizes Tamil-script question/action words and spoken numbers, including `one zero five three` -> `1053`. Recognized voice intents read heat/gate/stock data or navigate. **Approvals, stock deductions, overrides and furnace starts remain manual screen actions.**

## 4. Results

**At 0 dB synthetic noise, Prisma v3.0 understood the command in 96.7% of attempts, got command + heat correct in 93.3%, and achieved 89.7% normalized word accuracy.**

The [cache-only v2.5/v3.0 comparison](MetalliSense_Agent_R/MetalliSense_Agent/tools/noise_bench/compare_v25_v30.md) includes all 130 scored conditions per configuration: 10 clean, plus 30 at each noise level. Both configurations were rescored with the same current frontend mapper and normalization, using cached transcripts only and zero new STT calls. The results table below matches that comparison exactly.

| SNR (dB) | v2.5 scored | v3.0 scored | v2.5 WER | v3.0 WER | v2.5 intent | v3.0 intent | v2.5 intent + heat | v3.0 intent + heat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| clean | 10 | 10 | 28.6% | 4.8% | 100.0% | 100.0% | 100.0% | 100.0% |
| 20 | 30 | 30 | 28.6% | 4.8% | 100.0% | 100.0% | 96.7% | 100.0% |
| 10 | 30 | 30 | 29.4% | 7.1% | 100.0% | 96.7% | 93.3% | 96.7% |
| 5 | 30 | 30 | 30.2% | 8.7% | 100.0% | 93.3% | 93.3% | 93.3% |
| 0 | 30 | 30 | 33.3% | 10.3% | 96.7% | 96.7% | 86.7% | 93.3% |

v2.5 scores higher on intent alone at 10 and 5 dB, while v3.0 has better word accuracy at every SNR and better command + heat accuracy at 20, 10 and 0 dB.

v2.5 uses `en-IN / transcribe`; v3.0 uses `ta-IN,en-IN / codemix`. Historical v2.5 cache keys lack model metadata and were explicitly identified during rescoring. See the [v2.5 report](MetalliSense_Agent_R/MetalliSense_Agent/tools/noise_bench/v25_en/report.md).

- **Command understood** means the actual frontend mapper returned the expected intent.
- **Command + heat** additionally requires the expected heat number when the prompt contains one. It does not validate every element/alloy parameter.
- WER is micro-averaged word edit distance after normalizing case, punctuation, English number words and the supported Tamil-to-Tanglish terms. Word accuracy is `max(0, 1 - WER)`.
- Raw transcripts remain in [v3.0 runs.csv](MetalliSense_Agent_R/MetalliSense_Agent/tools/noise_bench/runs.csv). Each noisy SNR has 30 attempts: ten phrases across three synthetic noise tracks. Failed requests count against accuracy.

## 5. Safety: voice capabilities and boundaries

| Voice can | Voice cannot |
|---|---|
| Read heat status, chemistry, gate blockers and warnings | Start melting, approve/release a heat or override HOLD |
| Check alloy stock | Reserve, consume or deduct stock |
| Open dashboard, spectrometer and other supported screens | Delete records, issue invoices or make plant mutations |
| Speak concise Tamil/English reasons while keeping full explanations on screen | Replace operator review or the gate's furnace interlock |

`approve`, `start melting` and `override HOLD` are blocked with **திரையில் approve செய்யவும்** in Tamil. Spoken gate reasons prioritize at most two issues, round element values to two decimals and omit AI-risk narration; remaining details stay on screen. Generic copilot explanations are advisory, and mock Evon text must not be treated as a live plant assessment.

## 6. Setup and run: Windows PowerShell

Prerequisites: Git, Python **3.11**, Node.js **20.19+ or 22.12+**, npm, a Gnani API key for live speech, and ffmpeg on PATH. Start from the repository root.

Install ffmpeg once, then reopen PowerShell if PATH changed:

```powershell
winget install ffmpeg
ffmpeg -version
```

Terminal 1: create the Agent environment and install dependencies:

```powershell
cd MetalliSense_Agent_R\MetalliSense_Agent
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

If activation is blocked by your PowerShell policy, use `.\.venv\Scripts\python.exe` instead of `python` for the commands above and below. Keep an existing `.env`; replace its provider settings with the following values as appropriate. **The API key below is a placeholder, never a real credential.**

```dotenv
STT_PROVIDER=gnani
TTS_PROVIDER=gnani
GNANI_API_KEY=YOUR_GNANI_API_KEY
GNANI_BASE_URL=https://api.vachana.ai
GNANI_MOCK=false
GNANI_STT_MODEL=prisma-v3.0
GNANI_STT_LANGUAGE=ta-IN,en-IN
GNANI_STT_FORMAT=codemix
GNANI_STT_KEYTERMS=heat,carbon,silicon,manganese,phosphorus,sulphur,FeSi,FeMn,spectrometer,dashboard,premelt,status,stock,hold
GNANI_TTS_MODEL=timbre-v2.5
GNANI_TTS_VOICE=Kamakshi
GNANI_TTS_LANGUAGE=ta-IN
GNANI_TTS_SAMPLE_RATE=22050
GNANI_TTS_CACHE_DIR=app/data/tts_cache
COPILOT_PROVIDER=evon
COPILOT_LANGUAGE=auto
EVON_MODEL=gnani/gnani-evon-v3.3-30B-A3B
EVON_BASE_URL=
EVON_API_KEY=
EVON_MOCK=true
```

Leave `GNANI_API_KEY` empty or set `GNANI_MOCK=true` for zero-credit speech mock mode; it does not demonstrate live Prisma recognition or live Timbre speech. `EVON_MOCK=true` is independent of the Gnani speech setting. Do not commit `.env` or keys. Live uncached speech requests consume provider credits.

Start the Agent in Terminal 1:

```powershell
python app/main.py
```

Agent API docs: <http://localhost:8001/docs>.

Terminal 2, starting at the repository root:

```powershell
cd MetalliSense_Frontend_R\MetalliSense_Frontend
npm ci
npm run dev:mock
```

Open the URL Vite prints, normally <http://localhost:5173>. Allow microphone access, choose **தமிழ்** or **English**, and unmute. Factory data is mocked; live audio still needs the Agent and configured speech providers. The mock-only **Demo transcripts** buttons exercise the same response path without an STT request.

Frontend checks:

```powershell
npx vitest run
npm run build
```

If sandboxed Vite configuration loading fails, append `--configLoader runner` to Vitest, or use `npm run build -- --configLoader runner`. On PowerShell installations that block npm's script wrappers, use `npm.cmd` / `npx.cmd`.

## 7. Demo

Follow [HOLD_VOICE_DEMO.md](MetalliSense_Frontend_R/MetalliSense_Frontend/docs/HOLD_VOICE_DEMO.md) for the 2–3 minute recording sequence: **Pre-Melt Gate -> Reset -> H-1053 -> Run pre-melt check**. The seeded SG-IRON / 1000 kg charge produces two real blockers: a quarantined lot and excess copper. Ask `Heat 1053 status என்ன`, `ஏன் HOLD`, or `why hold heat 1053`; then demonstrate that approval and furnace-start commands stay blocked. Reset rearms the once-only HOLD alert.

## 8. Team and contributions

The summaries below are grouped from `git log --format="%an|%s"`, not inferred from file ownership. Manish's commits use the author names `Manish Rahul` and `manishrahul1705`; his requested team display name is shown below. Import commits indicate imported components, not proof of sole authorship of the base project.

| Member | Contributions |
|---|---|
| Nethra Venkat | Gnani Prisma/Timbre/Evon integration; Tamil-first read-only voice controls; Tamil-script and digit-by-digit normalization; v3.0 codemix benchmark results; H-1053 HOLD seed, Tamil gate reasons and voice safety. |
| Manish Raghul S J | Prisma v3.0 keyterms/codemix configuration and benchmark overrides; noise benchmark and intent-level scoring; heat-word and Mn/FeSi speech aliases; Agent voice/chat routing in mock mode; backend language delegation and voice-error guards; recording cleanup. |

The base MetalliSense platform was built jointly by Nethra Venkat and Manish Raghul S J; its components were imported into this repo for the challenge. The contributions above cover work done for MetalliSense Kural.

## 9. Limitations

- Noise results use **synthetic noise**, not recordings from a working foundry. They do not establish industrial microphone, accent or safety performance.
- Factory stock, instruments and heats are **mock data** in `dev:mock`. Real factory integration needs separate validation.
- **Evon runs in mock mode** here; no live Evon quality or latency claim is made. The deterministic gate-reason path reads actual demo gate checks rather than the mock LLM reply.
- Speech depends on microphone quality, connectivity, provider availability and correct heat transcription. Operators must confirm critical details on screen.
- Live speech requires credentials; an empty key selects mock speech. Disk-cached TTS avoids repeated synthesis only for matching cached inputs.

The original project's history includes retrospective component imports; commit timestamps do not establish the development dates of those components. Bundled Montserrat and JetBrains Mono fonts retain their [SIL Open Font License notices](MetalliSense_Frontend_R/MetalliSense_Frontend/src/assets/demo-fonts/).
