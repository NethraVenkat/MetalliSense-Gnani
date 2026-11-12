# MetalliSense · Kural (குரல்)

**A Tamil-first voice copilot that helps foundry operators read the melt-shop screen, ask questions and carry out reviewed actions without typing.**

[Watch the demo](https://youtu.be/KxPlBhWzNms) · [Pitch and award tracks](PITCH.md) · [Run guide](docs/TORUN.md)

**Award tracks:** regional language, code-mixed speech, practical foundry workflows and the wake-word jugaad are mapped to the submission tracks in [PITCH.md](PITCH.md#award-tracks-how-kural-answers-each).

## The problem and the people

A furnace operator wearing gloves needs to inspect chemistry, find a heat, understand a HOLD and coordinate with stores. Typing through English screens interrupts that work. Kural is for melt operators, shift supervisors, unit controllers and stores staff who speak Tamil, Hindi or a mix with English.

## What it is

**MetalliSense** is the underlying **21-page foundry application**: spectrometer readings over OPC-UA, yard inspection, pre-melt gates, anomaly analysis, correction recommendations, strategy comparison, mechanical-property estimates, stock, forecasting and sales. **Kural** is its opt-in voice copilot, sharing the pages' loaded data and service functions. The page coverage is documented in the [real-app report][real-app]. This is a synthetic-data demonstration, not a certified plant control system.

## What Kural can do

- **Hands-free activation:** say “Kural”, or use Hold to talk. Hands-free is explicit opt-in and experimental.
- **Tamil, Hindi and English:** includes tested Tanglish/Hinglish phrases. IDs and technical terms stay recognizable; not every accent or wording is supported.
- **Live page answers:** status, chemistry, grade specs, stock, costs and briefing answers come from loaded application data. Missing data produces an unavailable response, not an invented value.
- **Voice actions and forms:** request a reading, check a gate, receive a truck, collect missing fields, review a draft and follow the registered approval flow.
- **Page controls:** open a page, select/read a loaded row, switch supported tabs, scroll and refresh.
- **Readable interaction:** Tamil/Hindi action-card body labels, transcript and answer display. The approved orb headings remain English by design.
- **Read-only shift handover:** summarize a shift and export/read its handover without starting a heat or changing its gate.

Feature scope: [action registry][actions], [current levels][levels], [page/control fixes][round2], [card labels][s2], [handover implementation](MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/handover.js).

## Safety by design

| Level | What happens |
|---|---|
| **ASK** | Read or navigate. Registered safe calculations, readings and gate checks have a **2-second Cancel** window. |
| **RUN** | Read back, then listen for yes/no before the registered device/simulation action. |
| **APPROVE** | Read back the draft, verify a private **6-digit passcode** and permitted role, then give **5 seconds to Cancel**. Destructive workflows require an additional exact word. |

The **3-strike lock**, salted PBKDF2 hashes, target freshness checks and one-use approval tokens are server-side. Passcode capture is excluded from transcript/audio logging. A hash-chained audit records the reported decision; optional wake/command audio retention is separate. See [current levels][levels], [foundation/security][foundation] and [Round 2 repairs][round2].

**H-1053 stays HOLD in the normal demo.** Normal “start melting” cannot turn HOLD into GO. There is a separate, explicitly registered **Unit Controller-only HOLD override** requiring a reason, read-back, passcode, the word `OVERRIDE` and Cancel window. This is not an arbitrary voice bypass. [F17 documents that exception and its limits][actions].

These local demo credentials are not voice biometrics or production plant authentication. The existing plant backend has authorization gaps, and audit outcomes are client-reported, not independent proof of a physical operation. Synthetic inputs, costs and predictions must not be treated as measured or certified plant results. [Safety limitations][actions].

## How Gnani is used

- **Prisma v3.0:** command, field-answer, confirmation and private-passcode STT; the wake check uses its own fixed request/rule.
- **Timbre v3.0 / Kalpana:** replies, read-backs and prompts. Approved Tamil tour audio is packaged locally and reused, not regenerated. [Configured model and audio evidence][s25].
- **Shared provider lease:** STT, REST TTS and SSE share one in-process request lease. Run a single Agent process with the shared key; another app/process using that key can still contend with it. Keys stay on the Agent. [Provider lease](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/provider_calls.py).
- **Explanation chat:** Groq hosts the open-weights `openai/gpt-oss-120b` model. Evon's hosted API was not available for this project, so we did not invent an Evon endpoint; an optional self-hosted integration remains. [Project pitch](PITCH.md#gnani-models-used) · [Groq configuration](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/groq_explainer.py).

We compared features instead of assuming newer settings improve the app:

| Experiment | Decision |
|---|---|
| Command keyterms + topic | Keep `STT_CONTEXT_ENABLED=false`: Tanglish routing fell **4/5 → 3/5** in the same-audio comparison. Never applied to wake/private capture. [Stage 2.5][s25] |
| Safety audio tags | Keep `TTS_AUDIO_TAGS=false`: before/after audio exists, but human listening approval is pending. [Stage 2.5][s25] |
| Streaming TTS | Keep `GNANI_TTS_STREAM=false` and `VITE_TTS_STREAM=false`: readiness varied and a failed start required retry. [Stage 2.5][s25] |
| Auto reply language | Keep `STT_AUTO_LANGUAGE=false` and `VITE_STT_AUTO_LANGUAGE=false`: requested Tamil evaluation is incomplete, and completed pairs showed a route regression. [Stage 2.6][s26] |
| Live partial words | Keep disabled: real interim-word delivery is unverified; the labelled mock replay is not streaming recognition. [LIVE_WORDS.md][live-words] |

## The wake-word jugaad

We tried local models first. English Sherpa detected **0/6 positives** while its official controls passed. The paired CNN experiment also failed its qualification screen. We then tried Prisma after a local pause gate: pause-v1 had truncated snippets; pause-v2 recognized **20/20 wakes but falsely activated on 6/10 confusables**. [Wake research and results][wake].

The retained **pause-v3** method sends a **1.5-second** onset snippet after a **0.5-second** pause, without a wake keyterm, and checks the first normalized word. This uses cloud STT as the wake check, not a qualified local keyword model. Ordinary speech can therefore be sent for checking after opt-in. [Protocol][wake].

Its original user-run screen found **10/10 wakes, 0/10 confusable wakes and 0/5 conversation-snippet wakes**. A later generated-speech screen found only **8/12 wakes and a coral false wake**. Both results matter. We kept the stricter rule, did not add a “coupon” or coral alias, and retain PTT as the fallback. These are small development screens, not a production false-activation rate. [Original screen][wake] · [later failures][s1].

## Testing and honest results

The latest recorded verification is **2,688 frontend tests, 507 Agent tests and a successful production build**. All **22 approved tour clips** matched their source and built hashes. Browser timeouts from earlier runs remain documented. [Stage 2.6 final verification][s26].

| Evidence | Recorded result | What it establishes |
|---|---|---|
| Mocked real-app checks | **435 PASS**, across **21 routes** | Real browser UI plus isolated mock Agent and synthetic microphone; muted TTS, not real speech accuracy. [Report][real-app] · [totals][round2] |
| Generated passcodes through real Prisma | **10/10** gate trials | Generated TEST speech through the private service path, not proof of natural human cadence. [Stage 1][s1] |
| Generated Tanglish through real Prisma | Correct routes **2/5 → 4/5** | Same saved transcripts replayed before/after matching repairs. [Stage 1][s1] |
| Receiving form through real Prisma | **3/3** complete PTT runs | Generated speech, temporary test identity and synthetic inventory; not three verified hands-free runs. [Stage 2][s2] |
| Synthetic noise commands | **5/5 routes at 5 dB** after repair | Full-command saved transcripts replayed through the repaired mapper. Wake itself had **0/1 detections at both 10 and 5 dB**. [Noise report][noise] |
| Hindi | Saved replay **2/5 → 5/5**; new real audio **6/8** | New-audio gate failed; no tuning after results. [Stage 2.6][s26] |
| Tanglish navigation | **3/4** new real clips | Narrow navigation grammar, original “coupon” limitation remains. [Stage 2.6][s26] |
| Auto-language Tamil | **1/4 pairs completed** | Provider failures stopped the run; no completed full-set claim. [Stage 2.6][s26] |

**Human-live evidence:** the team ran and demonstrated the full four-terminal application with Kural and Groq to an audience. The [demo video](https://youtu.be/KxPlBhWzNms) and [team's verified statement](PITCH.md#verified) document the presentation. This is separate from the mocked matrix and generated-speech benchmarks; this documentation update makes no new live calls or independent live verification.

## Known limits

- Hands-free can miss wakes or mistake ordinary speech for Kural, especially with noise. It requires network access and consumes provider calls.
- Hindi and Tanglish support is phrase-based; the latest unseen Hindi gate failed. A correct intent does not prove the transcribed heat ID is correct: review the displayed target.
- The Tamil auto-language comparison is incomplete after HTTP 403 responses. No quota/key diagnosis was inferred from status alone. [Stage 2.6][s26].
- Labels are localized, but field names, user-entered values and some technical terms can remain English. Orb headings intentionally remain English.
- Models estimate outcomes; they do not replace testing, operator judgment or authenticated plant interlocks. Do not connect this demo to a live furnace.
- Ignored experimental recordings/models are not required for the application. Some historical research tests require local evidence absent from a fresh clone. [Historical artifact caveats][round2].

## RUN THE FULL APP (Windows)

### Prerequisites

- Git; Node/npm. **Node 18 alone is not sufficient for this checkout:** use **20.19+ in the 20 series, or 22.12+** for its Vite toolchain. [Locked runtime requirements](MetalliSense_Frontend_R/MetalliSense_Frontend/package-lock.json).
- **Python 3.11 for the AI service**. Use **3.11, or 3.12 for the Agent**; the commands below use 3.11 for both. Keep the pinned requirements. [Run guide](docs/TORUN.md#prerequisites) · [dependency pins](MetalliSense_AI_R/MetalliSense_AI/requirements.txt).
- A Gnani key from [app.gnani.ai](https://app.gnani.ai) and a Groq key from [console.groq.com](https://console.groq.com). Keep both server-side.
- Chrome/Edge with a microphone, and ffmpeg on PATH for browser-audio conversion. [STT conversion](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_client.py).

Get the supplied checkout, or clone the repository, then open PowerShell at its root:

```powershell
git clone https://github.com/NethraVenkat/MetalliSense-Gnani.git
Set-Location .\MetalliSense-Gnani
# Install ffmpeg if missing, then reopen PowerShell if PATH changed:
winget install --id Gyan.FFmpeg --exact
ffmpeg -version
```

### One-time dependency setup

Run from the repository root. Existing environments/configuration should be preserved rather than overwritten.

```powershell
Push-Location .\MetalliSense_Backend_Simple
npm.cmd install
Pop-Location

Push-Location .\MetalliSense_AI_R\MetalliSense_AI
py -3.11 -m venv venv
.\venv\Scripts\python.exe -m pip install -r .\requirements.txt
Pop-Location

Push-Location .\MetalliSense_Agent_R\MetalliSense_Agent
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
if (!(Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
Pop-Location

Push-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd install
Pop-Location
```

Direct interpreter paths avoid PowerShell activation-policy changes. Do not install the isolated wake-training dependencies to run the app.

### Agent configuration

Edit the ignored `MetalliSense_Agent_R\MetalliSense_Agent\.env` locally. Secret setting **names only** are shown; no key, passcode or user-hash values are supplied here.

| Setting | Local configuration |
|---|---|
| `GNANI_API_KEY`, `GROQ_API_KEY` | Enter your own keys privately. |
| `STT_PROVIDER`, `TTS_PROVIDER` | `gnani` for both |
| `GNANI_MOCK` | `false` for real speech |
| `GNANI_STT_MODEL`, `GNANI_STT_LANGUAGE`, `GNANI_STT_FORMAT` | `prisma-v3.0`, `ta-IN,en-IN`, `codemix` |
| `GNANI_TTS_MODEL`, `GNANI_TTS_VOICE`, `GNANI_TTS_LANGUAGE` | `timbre-v3.0`, `Kalpana`, `ta-IN` |
| `COPILOT_PROVIDER`, `GROQ_MODEL` | `groq`, `openai/gpt-oss-120b` |
| `WAKE_WORD_ENABLED` | `true` for the opt-in hands-free UI |
| `VOICE_ACTIONS_ENABLED`, `VOICE_AUDIT_ENABLED` | `true` for the action demo; audit is required |
| `VOICE_AUDIO_LOG_ENABLED` | `false` recommended; enable only for explicitly consented local audio review |
| `VOICE_AUDIO_RETENTION_DAYS` | `7` if recording audio; audio retention does not purge the audit chain [foundation][foundation] |
| `VOICE_USERS` | JSON array of locally generated test-user entries, never plaintext codes |
| `STT_CONTEXT_ENABLED`, `TTS_AUDIO_TAGS`, `STT_AUTO_LANGUAGE`, `GNANI_TTS_STREAM`, `LIVE_WORDS_ENABLED` | `false` |

Configuration sources: [Gnani client](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_client.py), [Groq provider](MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/groq_explainer.py), [action setup][foundation], [experiment recommendations][s26]. Do not put keys or `VOICE_USERS` in any `VITE_` setting.

Create distinct **test** passcodes through hidden prompts, from the Agent folder:

```powershell
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-supervisor --name "Demo Supervisor" --role Supervisor
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-manager --name "Demo Manager" --role Manager
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-controller --name "Demo Controller" --role "Unit Controller"
```

Each prints a salted hash entry, never the typed code. Combine the entries into a JSON array for `VOICE_USERS` in the Agent's local configuration. Supervisor can receive a lot; Manager can approve a pending PR. Unit Controller is a separate role, not a substitute for Manager. Do not use real plant credentials in this demo. [Role policy][levels].

### Frontend configuration

Create `MetalliSense_Frontend_R\MetalliSense_Frontend\.env.local` locally with these public settings. This is an explicit demo opt-in, not a change to code defaults:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v2
VITE_COPILOT_BASE_URL=http://localhost:8001
VITE_SHOW_VOICE_PANEL=true
VITE_WAKE_WORD=true
VITE_VOICE_EVERYWHERE=true
VITE_VOICE_PAGE_ANSWERS=true
VITE_VOICE_DATA_READS=true
VITE_MORNING_BRIEFING=true
VITE_VOICE_DASHBOARD_BRIEFING=true
VITE_SHIFT_SUMMARY=true
VITE_HANDOVER=true
VITE_VOICE_ACTIONS=true
VITE_VOICE_AUDIT=true
VITE_VOICE_AUDIO_LOG=false
VITE_VOICE_TOUR=true
VITE_VOICE_TOUR_APPROVED_TAMIL=true
VITE_STT_AUTO_LANGUAGE=false
VITE_TTS_STREAM=false
VITE_LIVE_WORDS=false
VITE_LIVE_WORDS_MOCK=false
```

The existing Hindi selector also depends on the tour/everywhere flags, so retain those when demonstrating Hindi. Approved Tamil tour assets avoid live tour synthesis. Hands-free still starts **OFF** until you toggle it. Restart Vite and the Agent after configuration changes. [Feature guide][draft] · [selector dependency](MetalliSense_Frontend_R/MetalliSense_Frontend/src/hooks/useSpeak.js).

### Start the four terminals in order

Open each new terminal at the repository root. Leave the earlier processes running. Service folders and ports are recorded in [TORUN.md](docs/TORUN.md#start-the-full-app).

**Terminal 1: Backend + OPC-UA simulator**

```powershell
Set-Location .\MetalliSense_Backend_Simple
npm.cmd start
```

Wait for `OPC UA Server ready` and the backend on **3000**.

**Terminal 2: AI service**

```powershell
Set-Location .\MetalliSense_AI_R\MetalliSense_AI
.\venv\Scripts\python.exe .\app\main.py
```

Check `http://localhost:8000/health` for healthy models before continuing.

**Terminal 3: Agent + Kural**

```powershell
Set-Location .\MetalliSense_Agent_R\MetalliSense_Agent
.\.venv\Scripts\python.exe .\app\main.py
```

The Agent listens on **8001**. `Copilot failed to load` is an error to fix, not expected startup. Check the Groq/provider configuration and inspect this terminal without sharing secrets.

**Terminal 4: Frontend**

```powershell
Set-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd run dev
```

Open `http://localhost:5173`. If Vite reports a different port, resolve the existing listener rather than opening a stale app. Allow the microphone after you explicitly enable hands-free or press Hold to talk.

**Optional fifth service:** [VectorSearch](MetalliSense_VectorSearch/README.md), port **8002**, for Semantic Search only. Docker is needed for its real Actian VectorAI backend; a local in-memory fallback also exists. Embedding setup is separate from the core app. Do not block the main demo on it.

### Quick checks and commands

- `http://localhost:3000/api/v2/grades` returns JSON.
- `http://localhost:8000/health` reports healthy AI models.
- Open the AI Agent page and ask the explanation chat a question; confirm a response, not a “Copilot failed to load” startup error.
- On Spectrometer, connect the instrument through its existing control, wait for readings, then say **“Kural, what is the latest reading?”** Review the Heard text and selected target.

Use these on the relevant page. For actions, read-back and the registered level/role still apply. If wake-only activation succeeds, wait for Listening before the command; PTT remains available.

| Language | Say | Page / expected behavior |
|---|---|---|
| English | “Kural, what is the latest reading?” | Spectrometer: read loaded data |
| Tamil | “குரல், H-1053 நிலை என்ன?” | Pre-Melt Gate: read HOLD status |
| Tanglish | “Kural, oru reading edu” | Spectrometer: request a reading through its ASK flow |
| Hindi | “Kural, reading लो” | Spectrometer: request a reading |
| Hinglish | “Kural, PR approve करो” | Inventory Forecast: selected pending PR, Manager approval required |
| Tamil | “குரல், ஸ்டாக் எவ்வளவு இருக்கு?” | Stock: answer from loaded quantities |
| Tanglish | “Kural, stock page ku po” | Open Stock; no stock mutation |
| English | “Kural, receive truck” | Stock: collect missing fields and require Supervisor/Operator approval |
| English | “Kural, start melting H-1053” | Normal start must refuse HOLD |

Phrase support and limits: [Stage 1][s1], [Stage 2][s2], [Stage 2.6][s26], [actions][actions]. These are examples, not new measured live trials.

### Quick demo mode: no plant backend

Use the same Agent configuration and frontend voice flags. Start only the Agent and this frontend command in separate terminals:

```powershell
# Agent terminal, from its folder:
.\.venv\Scripts\python.exe .\app\main.py

# Frontend terminal, from its folder:
npm.cmd run dev:mock -- --configLoader runner
```

Factory data and operations are synthetic in-browser stores; Gnani speech and Groq chat still need the Agent, network access and keys. This is not an offline speech demo. Some model-backed functions need the full stack; use the full app for complete service integration. [Mock-mode distinction][draft].

### Troubleshooting

| Symptom | Check / fix |
|---|---|
| Python 3.14 dependency/install failure | Use the documented 3.11 AI environment; 3.11/3.12 for Agent. Keep pinned packages and use the intended interpreter, not global pip. |
| `ECONNREFUSED` on 8000 | Start AI service before Agent/frontend; inspect its health and model-loading errors. |
| Groq `model_decommissioned` | Set `GROQ_MODEL=openai/gpt-oss-120b` locally and restart Agent. Do not retain an obsolete model name. |
| Gnani 429 | One active request per key: stop competing clients/Agents, wait, then retry manually. Do not add parallel calls. |
| Gnani 401/403 | Check key, permissions/account access and available credits with the provider. Status alone does not identify which failed; preserve a sanitized message/request ID if available. |
| Blank or stale page after flags change | Restart Vite/Agent as applicable, then Ctrl+Shift+R. Verify the printed frontend URL. |
| npm/esbuild install-script error | Check Node compatibility and `npm.cmd config get ignore-scripts`. If local policy permits, enable trusted install scripts and run `npm.cmd rebuild esbuild` in the frontend folder. Do not remove features or switch package managers blindly. |
| No approved action / wrong role | Check audit enabled, current page/selection and locally generated `VOICE_USERS`. A Manager is not interchangeable with a Supervisor or Unit Controller. Never post codes or keys in logs. |
| Words do not appear while speaking | Real streaming partial words are not enabled. The real transcript appears after STT completes. [Live-words status][live-words]. |

For exact setup details and optional service instructions, see [docs/TORUN.md](docs/TORUN.md).

## Project structure

```text
MetalliSense_Backend_Simple/                 Node API, CSV stores, OPC-UA simulator
MetalliSense_AI_R/MetalliSense_AI/           Anomaly and alloy models
MetalliSense_Agent_R/MetalliSense_Agent/     Agent, Kural, Gnani/Groq, safety and reports
MetalliSense_Frontend_R/MetalliSense_Frontend/ React UI, voice controllers, tests
MetalliSense_VectorSearch/                  Optional semantic search
PITCH.md                                   Submission pitch, left unchanged
```

## Team

**Nethra Venkat · Manish Raghul S J**
**Sri Eshwar College of Engineering, Coimbatore**

### Who built what

- **Manish Raghul S J:** voice architecture and Gnani integration (Prisma/Timbre client, provider lease), wake-word research (CNN/Sherpa/Prisma pause gate), spoken-passcode security and audit log, voice capture and diagnostics, real-app test harnesses, full-stack setup.
- **Nethra Venkat:** Tamil/Hindi/Tanglish wording and command matching, page answers and action phrases, live voice testing and bug finding, demo video, pitch and LinkedIn launch.

Copied verbatim from [PITCH.md](PITCH.md#who-built-what).

[s1]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE1_REPORT.md
[s2]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_REPORT.md
[s25]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_5_REPORT.md
[s26]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_6_REPORT.md
[noise]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/NOISE_TEST.md
[real-app]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/REAL_APP_CHECK_REPORT.md
[round2]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/ROUND2_FIX_REPORT.md
[actions]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F17_VOICE_ACTIONS.md
[levels]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/ACTION_LEVELS.md
[foundation]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F16_VOICE_FOUNDATION.md
[live-words]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/LIVE_WORDS.md
[wake]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F14_LIVE_KURAL_DIAGNOSTIC.md
[draft]: MetalliSense_Agent_R/MetalliSense_Agent/DOCS/README_DRAFT.md
