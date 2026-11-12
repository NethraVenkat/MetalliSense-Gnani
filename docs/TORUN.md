# MetalliSense + Kural: Windows run guide

Use this guide for the complete local application. Start the four core processes in separate terminals, in the order below. VectorSearch is optional. The [judge README](../README.md) explains features, evidence and limitations.

## Prerequisites

- Git and Node/npm. Node 18 alone is insufficient for the current Vite checkout: use Node **20.19+ in the 20 series, or 22.12+**. See the [frontend lockfile](../MetalliSense_Frontend_R/MetalliSense_Frontend/package-lock.json).
- **Python 3.11 for AI**, **3.11 or 3.12 for Agent**. Use 3.11 for both in the commands below; do not use Python 3.14 with these pinned model dependencies. [AI requirements](../MetalliSense_AI_R/MetalliSense_AI/requirements.txt) · [Agent requirements](../MetalliSense_Agent_R/MetalliSense_Agent/requirements.txt).
- Gnani API key from [app.gnani.ai](https://app.gnani.ai); Groq API key from [console.groq.com](https://console.groq.com).
- Chrome/Edge, microphone permission, internet for provider calls, and ffmpeg on PATH. If missing, install ffmpeg and reopen the terminal:

```powershell
winget install --id Gyan.FFmpeg --exact
ffmpeg -version
```

The packaged models and CSV files must remain in their supplied locations. Do not retrain the models just to start the app. Use direct interpreter paths to avoid changing PowerShell execution policy.

## One-time setup

Run from the repository root, preserving any existing environment/configuration:

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

For an Agent-only Python 3.12 installation, substitute `py -3.12 -m venv .venv` in its setup block. Keep the AI service on 3.11. Keep the requirements pins, particularly the model serialization dependencies; do not upgrade scikit-learn independently.

## Agent configuration and test identities

The Agent **does need configuration** for real Kural speech and Groq chat. Edit its ignored `.env` privately; the following table contains configuration values but **no secret values**:

| Setting | Set locally |
|---|---|
| `GNANI_API_KEY`, `GROQ_API_KEY` | Your own provider keys, never copied into frontend settings |
| `STT_PROVIDER`, `TTS_PROVIDER` | `gnani` |
| `GNANI_MOCK` | `false` for real provider speech |
| `GNANI_STT_MODEL` | `prisma-v3.0` |
| `GNANI_STT_LANGUAGE`, `GNANI_STT_FORMAT` | `ta-IN,en-IN`, `codemix` |
| `GNANI_TTS_MODEL`, `GNANI_TTS_VOICE`, `GNANI_TTS_LANGUAGE` | `timbre-v3.0`, `Kalpana`, `ta-IN` |
| `COPILOT_PROVIDER`, `GROQ_MODEL` | `groq`, `openai/gpt-oss-120b` |
| `WAKE_WORD_ENABLED` | `true` to offer experimental hands-free activation |
| `VOICE_ACTIONS_ENABLED`, `VOICE_AUDIT_ENABLED` | `true` for registered voice actions; audit is required |
| `VOICE_AUDIO_LOG_ENABLED` | `false` recommended; optional consented local recording only |
| `VOICE_AUDIO_RETENTION_DAYS` | `7` for optional audio retention; audit retention is separate |
| `VOICE_USERS` | Local JSON array of test-user salted-hash entries |
| `STT_CONTEXT_ENABLED`, `TTS_AUDIO_TAGS`, `STT_AUTO_LANGUAGE`, `GNANI_TTS_STREAM`, `LIVE_WORDS_ENABLED` | `false` |

Sources: [client](../MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/gnani_client.py), [Groq configuration](../MetalliSense_Agent_R/MetalliSense_Agent/app/copilot/groq_explainer.py), [identity/audio setup](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F16_VOICE_FOUNDATION.md), [latest experiment report](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_6_REPORT.md).

From the Agent folder, generate your own distinct test codes using hidden prompts:

```powershell
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-supervisor --name "Demo Supervisor" --role Supervisor
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-manager --name "Demo Manager" --role Manager
.\.venv\Scripts\python.exe .\tools\voice_passcode_hash.py --id demo-controller --name "Demo Controller" --role "Unit Controller"
```

Combine the printed JSON entries into the `VOICE_USERS` array in your local Agent configuration. Do not store plaintext codes or paste them into a terminal command, browser setting, screenshot or Git. A Supervisor can receive a lot; a Manager can approve a PR. Unit Controller has a separate explicit override policy, not general Manager permissions. See [current action levels](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/ACTION_LEVELS.md).

Run only one Agent process with the key. Its process-wide lease serializes Gnani calls, but cannot coordinate an unrelated process or another person's app using the same key. A startup `Copilot failed to load` is **not expected** for this configured demo: fix the provider/dependency error before continuing. Shell environment variables can take precedence over `.env`; restart after changes. Never post secret configuration when reporting an error.

## Frontend configuration

Create the ignored `MetalliSense_Frontend_R\MetalliSense_Frontend\.env.local` locally:

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

These are public demo opt-ins, not new code defaults. The existing Hindi language selector requires the everywhere/tour flags; preserve those for a Hindi demonstration. Hands-free still requires its explicit runtime toggle and microphone consent. `VITE_VOICE_AUDIO_LOG` should only become true when the backend audio flag is also enabled and everyone consents. Approved Tamil tour files are already packaged. [Feature overview](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/README_DRAFT.md) · [Hindi selector](../MetalliSense_Frontend_R/MetalliSense_Frontend/src/hooks/useSpeak.js).

Restart Vite after changes. Keep all API keys and `VOICE_USERS` out of `VITE_` variables. Experimental context, audio tags, auto-language, streaming and live-word modes remain off per [Stage 2.5](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_5_REPORT.md) and [Stage 2.6](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_6_REPORT.md).

## Start the full app

Open each terminal at the repository root and leave earlier processes running:

| Order | Service | Port | Scope |
|---|---|---:|---|
| 1 | Backend + OPC-UA simulator | 3000 | Main API and synthetic plant workflow |
| 2 | AI service | 8000 | Anomaly/alloy models |
| 3 | Agent + Kural | 8001 | Agent/RL, Gnani speech, Groq explanations |
| 4 | Frontend | 5173 | Operator UI |

Port sources: [backend](../MetalliSense_Backend_Simple/server.js), [AI config](../MetalliSense_AI_R/MetalliSense_AI/app/config.py), [Agent config](../MetalliSense_Agent_R/MetalliSense_Agent/app/config.py), [frontend](../MetalliSense_Frontend_R/MetalliSense_Frontend/package.json).

**Terminal 1**

```powershell
Set-Location .\MetalliSense_Backend_Simple
npm.cmd start
```

Wait for `OPC UA Server ready` and the backend listening message. Check `http://localhost:3000/api/v2/grades` returns JSON. The backend uses its supplied CSV stores; it does not need the Agent's keys.

**Terminal 2**

```powershell
Set-Location .\MetalliSense_AI_R\MetalliSense_AI
.\venv\Scripts\python.exe .\app\main.py
```

Wait for loaded-model messages. Check `http://localhost:8000/health` for `status: healthy`. A degraded model load must be investigated in this terminal before testing downstream analysis.

**Terminal 3**

```powershell
Set-Location .\MetalliSense_Agent_R\MetalliSense_Agent
.\.venv\Scripts\python.exe .\app\main.py
```

Check Agent initialization and `http://localhost:8001/health`. Its health route describes model/RL loading, not proof of provider access. No `Copilot failed to load` or voice-service import error should remain. Test the AI Agent explanation chat through the UI after the frontend starts; this uses Groq, not a made-up Evon hosted endpoint.

**Terminal 4**

```powershell
Set-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd run dev
```

Open `http://localhost:5173` or the exact URL Vite prints. If the expected port is occupied, identify the old listener rather than unknowingly testing a different instance.

## First demonstration

- Open the AI Agent page and ask the explanation chat a question.
- On Spectrometer, use the existing connection control, wait for readings, then enable hands-free and say “Kural, what is the latest reading?”
- On Pre-Melt Gate, ask “குரல், H-1053 நிலை என்ன?” Normal start must refuse HOLD.
- Use “Kural, receive truck” on Stock to collect a reviewed draft. It requires a permitted test identity and the registered approval path; do not use a real stock system.
- Use the [multilingual command table](../README.md#quick-checks-and-commands) for more examples. Inspect Heard text, target and read-back before confirming anything.

The team reports that the full four-terminal application with Kural and Groq was run and presented live; see the [demo](https://youtu.be/KxPlBhWzNms) and [pitch](../PITCH.md#verified). That human demonstration is separate from the synthetic-microphone [435-check browser matrix](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/REAL_APP_CHECK_REPORT.md). No services or provider calls were run for this docs-only update.

## Quick demo mode

Only Agent and frontend are required for synthetic in-browser plant data. Preserve the Agent configuration above and frontend voice flags:

```powershell
# Terminal A, starting from repository root
Set-Location .\MetalliSense_Agent_R\MetalliSense_Agent
.\.venv\Scripts\python.exe .\app\main.py
```

```powershell
# Terminal B, starting from repository root
Set-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd run dev:mock -- --configLoader runner
```

No plant backend/AI-service process is needed for the in-browser fixture data, but live Gnani speech and Groq chat still use internet and keys. Some model-backed operations need the full stack. Do not describe mock mode as real plant operation or offline speech. [Mock evidence scope](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/README_DRAFT.md).

## Optional VectorSearch

The optional fifth process serves **8002**, only for Semantic Search. Follow [its README](../MetalliSense_VectorSearch/README.md) for the venv, requirements and `python main.py`. Docker plus Actian setup is needed for the real VectorAI database route; the service also has a local in-memory fallback. Embedding/model setup is separate and is not required for the core four-terminal demo. Do not claim a real database connection when using the fallback.

## Troubleshooting

| Symptom | Next check |
|---|---|
| Python 3.14 cannot install/load pinned packages | Use the intended 3.11 AI interpreter and 3.11/3.12 Agent interpreter; check `--version` on that executable. Preserve the old venv for diagnosis rather than deleting it blindly. |
| `ECONNREFUSED` on 8000 | Start the AI service, then check its model loading and `/health`. |
| `Copilot failed to load` | Check Agent requirements, `COPILOT_PROVIDER=groq`, key presence and `GROQ_MODEL`; do not treat this as an expected warning. |
| Groq `model_decommissioned` | Use the repository-configured `openai/gpt-oss-120b` and restart Agent. |
| Gnani 429 | Stop competing key users and duplicate Agents; one request may be active per key. Wait before a manual retry. |
| Gnani 401/403 | Check key, permissions/account access and credits with Gnani. A status alone cannot establish which condition applies; retain a sanitized provider error/request ID. |
| Wrong/stale page or flags | Restart relevant processes, use their printed URLs and Ctrl+Shift+R. |
| npm/esbuild scripts blocked | Confirm supported Node; inspect `npm.cmd config get ignore-scripts`. If your policy permits trusted scripts, correct that local setting and run `npm.cmd rebuild esbuild` in the frontend. |
| Action unavailable / wrong role | Confirm both action and audit flags, current loaded target and permitted identity. Retain the lock/refusal; never bypass authorization to finish a demo. |
| No word-by-word transcript | Real interim-word delivery remains unavailable; do not enable the mock replay as if it were live recognition. [LIVE_WORDS.md](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/LIVE_WORDS.md). |

## Recorded verification and limits

Latest recorded full result: **2688 frontend tests, successful build, 507 Agent tests**, with approved tour hashes unchanged. [Stage 2.6 report](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/STAGE2_6_REPORT.md). These are prior recorded results, not tests rerun for this documentation change. Older ignored research artifacts may be missing in a fresh clone; do not fabricate them or relax tests to reproduce a count.

This is a synthetic-data demo. Normal HOLD start stays refused; a separately scoped Unit Controller override exists with explicit safeguards, as [F17](../MetalliSense_Agent_R/MetalliSense_Agent/DOCS/F17_VOICE_ACTIONS.md) explains. Local spoken test passcodes, client-reported audit and a backend without full plant authentication are not production security certification.
