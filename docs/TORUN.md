# MetalliSense — How to Run Everything

This project has **5 independent folders**. Start them in this order, each
in its own terminal window, and leave them all running.

| # | Folder | Port | What it does | Required for |
|---|---|---|---|---|
| 1 | `MetalliSense_Backend_Simple` | 3000 | Main API, OPC UA simulation, CSV data, proxies to AI/RL | Everything |
| 2 | `MetalliSense_AI_R\MetalliSense_AI` | 8000 | Anomaly detection + alloy recommendation models | Anomaly Detection, Recommendation pages |
| 3 | `MetalliSense_Agent_R\MetalliSense_Agent` | 8001 | RL optimizer, agent pipeline, copilot chat | RL Optimizer, AI Agent pages |
| 4 | `MetalliSense_VectorSearch` | 8002 | Actian VectorAI DB semantic search | Semantic Search page only |
| 5 | `MetalliSense_Frontend_R\MetalliSense_Frontend` | 5173 | The React app | The whole UI |

**✅ Verified before handoff:** #1, #2, and #3 were actually booted together
and tested end-to-end in a clean install (fresh Python venvs, `npm install`,
pinned dependency versions) — including the full request chain frontend
→ backend → AI service (anomaly + alloy) and frontend → backend → Agent
service (RL optimize returning real ranked candidates). Login has been
fully removed; there is no username/password anywhere in this build.

**⚠️ Not independently verified:** #4 (`MetalliSense_VectorSearch`) — it
needs Docker and Actian VectorAI DB, which aren't available in the
environment I built this in. It's written correctly against Actian's
documented API, but you're the first to actually connect it to a real
VectorAI DB instance. Everything else in the app works with or without it
— it's an isolated bonus feature (Semantic Search page only).

---

## 1. Backend (`MetalliSense_Backend_Simple`) — start this first

```bash
cd MetalliSense_Backend_Simple
npm install
npm start
```

Wait for:
```
✅ OPC UA Server ready (Client connection pending)
MetalliSense Simple Backend running on port 3000 (no login, no database — CSV only)
```

No database, no `.env` file, no login needed. `dataset.csv` must be in
this folder (it already is in this package).

Quick check: open `http://localhost:3000/api/v2/grades` in a browser —
you should see JSON with 5 grades, not an error.

---

## 2. AI Service (`MetalliSense_AI_R\MetalliSense_AI`)

```bash
cd MetalliSense_AI_R\MetalliSense_AI
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app\main.py
```

Wait for:
```
✓ AI models loaded successfully
API Server starting on http://0.0.0.0:8000
```

Quick check: `http://localhost:8000/health` should show
`"status":"healthy"`.

**If you see `sklearn` version warnings or `No module named
'sklearn.ensemble._gb_losses'`** — this means something installed a
scikit-learn version other than the pinned `1.3.2`. Delete the `venv`
folder and reinstall from `requirements.txt` exactly (don't `pip install
scikit-learn` separately first).

---

## 3. Agent Service (`MetalliSense_Agent_R\MetalliSense_Agent`)

```bash
cd MetalliSense_Agent_R\MetalliSense_Agent
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app\main.py
```

Wait for:
```
✓ RL Optimization Engine initialized (N prior updates loaded)
API Server starting on http://0.0.0.0:8001
```

The RL reward model comes pre-bootstrapped in this package (`app\models\
rl_reward_model.pkl`), so **you should NOT need to run `train_rl.py`** —
it already works out of the box. Only re-run it if you want to reset the
learned policy back to a fresh bootstrap from the CSV:

```bash
cd app\training
python train_rl.py 2000
```
(the number is how many CSV rows to use — 2000 finishes in under a
minute; omit it to use all 20,000, which takes much longer)

**Expected, not a bug:** `✗ Copilot failed to load` and `✗ Voice Service
failed to load` — these need a `GROQ_API_KEY` environment variable, which
this build doesn't have configured. The RL Optimizer, Anomaly Detection,
and Recommendation pages don't need these. Only the AI Agent chat/voice
features do. To enable them, get a free key at console.groq.com and set
`GROQ_API_KEY` before running `python app\main.py`.

---

## 4. VectorSearch (`MetalliSense_VectorSearch`) — optional, for Semantic Search page only

```bash
# First, get Actian VectorAI DB running via Docker — follow their guide:
# https://docs.vectoraidb.actian.com/home/installation/instructions

cd MetalliSense_VectorSearch
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Wait for `✓ Indexed N training-data readings + grade specs into VectorAI
DB`. If you see a connection error instead, VectorAI DB isn't reachable —
double check Docker is running and `VECTORAI_HOST` matches its actual
port. See `MetalliSense_VectorSearch\README.md` for full detail and
troubleshooting.

If you skip this entirely, everything else in the app still works — only
the "Semantic Search" sidebar item won't return results.

---

## 5. Frontend (`MetalliSense_Frontend_R\MetalliSense_Frontend`) — start this last

```bash
cd MetalliSense_Frontend_R\MetalliSense_Frontend
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). It goes
straight to the Dashboard — no login screen.

---

## Cost Intelligence (new — runs inside the Backend, no extra service needed)

Once the Backend (port 3000) is running, these work immediately:
- `GET /api/v2/cost/prices` — current ₹/kg prices for alloys + base metal by grade
- `PATCH /api/v2/cost/prices` — update prices
- `POST /api/v2/cost/estimate` — `{ grade, batchWeightKg, recommendedAdditions }` → full cost breakdown
- `GET /api/v2/cost/history` — recent estimates

In the frontend: **Cost Analysis** page (price editor + history table), and every
RL Optimizer candidate card now shows a ₹ cost box alongside its predicted reward.

⚠️ Prices are illustrative placeholder defaults (labeled as such in the UI),
not live market data — edit them via the Cost Analysis page to match your
real supplier quotes.

---

## Cost Intelligence (new — runs inside the Backend, no extra service needed)

Once the Backend (port 3000) is running, these work immediately:
- `GET /api/v2/cost/prices` — current ₹/kg prices for alloys + base metal by grade
- `PATCH /api/v2/cost/prices` — update prices
- `POST /api/v2/cost/estimate` — `{ grade, batchWeightKg, recommendedAdditions }` → full cost breakdown
- `GET /api/v2/cost/history` — recent estimates

In the frontend: **Cost Analysis** page (price editor + history table), and every
RL Optimizer candidate card now shows a ₹ cost box alongside its predicted reward.

⚠️ Prices are illustrative placeholder defaults (labeled as such in the UI),
not live market data — edit them via the Cost Analysis page to match your
real supplier quotes.

## Carbon Intelligence (new — same pattern as Cost, no extra service)

- `GET/PATCH /api/v2/carbon/factors` — kg CO2e per kg for each element + base metal by grade
- `POST /api/v2/carbon/estimate` — same shape as cost/estimate, returns CO2e breakdown
- `GET /api/v2/carbon/history`

Every RL Optimizer candidate now also carries `estimatedCarbon` alongside
`estimatedCost` — compare cost AND carbon footprint, not just predicted reward.

⚠️ Same caveat as cost prices: illustrative placeholder emission factors,
not certified LCA data.

## Confidence-Weighted Trust Score (new — automatic, no setup)

Every RL Optimizer candidate now also includes `trustScore` (0–1) and
`trustLabel` ("High confidence" / "Moderate confidence — spot-check
recommended" / "Low confidence — verify manually"), combining the model's
own confidence with deviation severity and any constraint violations. Tells
operators when to double-check an AI suggestion instead of trusting it blindly.

## Root Cause Hypothesis (new — automatic, no setup)

`GET /api/v2/rootcause/:gradeName` (e.g. `/api/v2/rootcause/SG-IRON`) —
rule-based statistical analysis over your CSV training data: which element
is the most frequent outlier in deviated batches for that grade, with a
plain-English hypothesis and the underlying methodology shown (fully
explainable, not a black box).

## Alert/Escalation Simulation (new — automatic, no setup)

- `POST /api/v2/alerts/simulate` — `{ grade, severity, deviationElements, batchId, operatorName }`
  → drafts a realistic supervisor alert (subject, body, recipient role,
  channel) for severe deviations. **Nothing is actually sent** — this
  demonstrates the "AI → human escalation" story for a demo without needing
  real SMS/email integration.
- `GET /api/v2/alerts/history` — see past simulated alerts

## AI Reasoning via Google Gemini (optional — needs YOUR Gemini API key)

⚠️ Note: your ORIGINAL project's `geminiService.js` was misleadingly named
— it actually called Groq internally, not real Gemini. This is a genuine
integration with Google's real API, using their current `google-genai`
SDK (the older `google-generativeai` package is fully deprecated —
deliberately not used here).

```
pip install google-genai   # already in requirements.txt now
```

Set these environment variables before running `python app\main.py`:
```
COPILOT_PROVIDER=gemini
GOOGLE_GEMINI_API_KEY=...   # get one at https://aistudio.google.com/apikey
```

⚠️ **Not tested against a live call** — no Gemini API key in the
environment this was built in. Package installation, the "no key" error
path, and successful client construction were all confirmed working
(`app/copilot/gemini_explainer.py`) — the actual API response is
unverified. If it errors, paste the exact error and it can be fixed from
the real response.

## AI Reasoning via Claude (optional — needs YOUR Anthropic API key)

By default the Agent service's explanations use Groq (unchanged). To use
Anthropic Claude instead:

```
pip install anthropic   # already in requirements.txt now
```

Set these environment variables before running `python app\main.py`:
```
COPILOT_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...   # get one at https://console.anthropic.com/
```

⚠️ **Not tested against a live call** — I have no Anthropic API key in the
environment this was built in. The request/response shape matches
Anthropic's public Messages API docs exactly (`app/copilot/claude_explainer.py`),
and the "no key" error path was confirmed working, but the actual API call
is unverified. If it errors, paste the exact error and it can be fixed
from the real response.

## ElevenLabs Voice (optional — needs YOUR ElevenLabs API key)

By default text-to-speech uses gTTS (unchanged, free, already working).
To use ElevenLabs instead (higher quality voice):

```
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...   # get one at https://elevenlabs.io/
ELEVENLABS_VOICE_ID=...  # optional, defaults to a standard premade voice
```

Speech-to-text (transcription) still always uses Groq Whisper regardless —
only text-to-speech output changes.

⚠️ **Not tested against a live call** — no ElevenLabs key or network access
in the environment this was built in (`api.elevenlabs.io` isn't reachable
there). The fallback logic (falls back to gTTS if the key is missing OR if
the real API call fails) was tested and confirmed working. The actual
ElevenLabs audio output is unverified — paste the exact error if it doesn't
work and it can be fixed from the real response.

---

## Connected Full Analysis Workflow (new — the "connect all pages" feature)

One backend call chains everything from a single composition input:

`POST /api/v2/workflow/full-analysis` — `{ metalGrade, composition, batchWeightKg, topK }` returns:
1. **Anomaly Detection** result (with trust score)
2. **Alloy Recommendation** for that exact anomaly (with cost, carbon, trust)
3. **Closed-Loop RL** candidates for the same composition (with cost, carbon, trust each)
4. **Root Cause Hint** from historical CSV data for that grade

✅ **Verified live** before packaging — real anomaly (HIGH severity, 0.90
score) correctly fed into a real alloy recommendation (with ₹46,255 cost,
905 kg CO2e), which fed into real RL candidates (conservative/balanced/
aggressive, each with reward + cost + carbon + trust), plus a real root
cause hint pulled from the CSV ("Si is the most frequent outlier...").

**Frontend:** new **Full Analysis** page (top of the sidebar) — generate
one reading, click "Run Full Analysis", see all 4 steps stacked together.
Accept/Modify/Reject buttons on RL candidates work the same as the
standalone RL Optimizer page. The individual pages (Anomaly Detection,
Recommendation, RL Optimizer, Cost Analysis) still exist separately too,
if you want to work with just one piece at a time.

## Real Industry Prices (updated — Cost Intelligence)

`alloyPriceStore.js` now uses actual researched Indian ferroalloy market
prices (Aug 2026), not made-up placeholders:
- **Ferro Chrome**: ₹74,000–75,000/MT alloy (BigMint, Apr 2026) → ~₹124/kg contained Cr
- **Ferro Silicon (75%)**: ₹85,000–120,000/MT alloy (IndiaMART, 2026) → ~₹130-135/kg contained Si
- **Silico/Ferro Manganese**: ₹55-105/kg alloy, median ~₹65/kg (IndiaMART, Jun-Jul 2026) → ~₹108/kg contained Mn
- **Pig iron**: ~₹50,510/MT (CEIC/JPC, Jun 2026)

Ni/Mo/Cu remain lower-confidence estimates (no India-specific per-kg quote
found this pass) — flagged as such in the data, verify before relying on them.

Still not a live feed — real commodity prices move; re-run research
periodically or connect a paid metals-price API for that.

---

## System Verifier (new — one command checks everything)

After starting the Backend (and optionally AI/Agent/VectorSearch), run:

```
cd MetalliSense_Backend_Simple
node verify.js
```

This checks every endpoint actually returns the correct response shape
(not just "is the port open") and gives a clear pass/fail report,
distinguishing required checks (Backend + CSV data) from optional ones
(AI/RL/Semantic Search — only needed for those specific pages).

✅ Verified: I ran this against real live services before packaging —
it correctly passed all required checks and correctly flagged services
that weren't running as optional failures.

## Cost Spread Rule (RL Optimizer / Full Analysis)

Conservative/Balanced/Aggressive now carry a deterministic, clearly-labeled
"operational premium" (representing handling/QA/rework-risk cost that
scales with correction aggressiveness — not raw material cost):
- Conservative sits ₹1,000–5,000 BELOW Balanced
- Aggressive sits ₹5,000–10,000 ABOVE Balanced

✅ Verified live: conservative ₹876.62 / balanced ₹4,555.45 / aggressive
₹11,778.12 — gaps of ₹3,678.83 and ₹7,222.67, both within the required ranges.

## Trust/Confidence Removed

All Trust Score, Trust Label, and confidence-percentage displays have been
removed from the backend (RL candidates, anomaly detection, alloy
recommendation annotations) and the frontend (RL Optimizer, Full Analysis,
Recommendation pages). The `computeTrustScore` function itself has been
deleted from the backend.

## Semantic Search — see MetalliSense_VectorSearch/VECTORSEARCH_README.md

A dedicated, detailed guide now lives in that folder explaining exactly
what was broken (hard dependency on Actian's SDK/Docker), how it was fixed
(automatic fallback to a local in-memory vector store, same interface
either way), what's verified vs. not, and full troubleshooting steps.

---

## Quick health-check checklist


Open each of these in a browser once everything is running:

| URL | Expect |
|---|---|
| `http://localhost:3000/api/v2/grades` | JSON, 5 grades |
| `http://localhost:8000/health` | `"status":"healthy"` |
| `http://localhost:8001/health` (if it exists) or check its terminal | RL Engine initialized line |
| `http://localhost:8002/health` (only if running VectorSearch) | `"vectorai_connected": true` |
| `http://localhost:5173` | Dashboard loads with charts, no login prompt |

## If something still doesn't work

Check, in this order:
1. Is the right service actually running on the right port? (`findstr`
   a distinctive line from that service's own file to make sure you're
   not running a stale/mixed-up copy)
2. What's the exact error in that service's own terminal — not just what
   the frontend shows?
3. Are you in the right folder when running each command? (`app\main.py`
   must be run from the service's root folder, not from inside `app\`)

---

## Voice (ElevenLabs) + API key check

Keys live in `MetalliSense_Agent_R\MetalliSense_Agent\.env` (same values in the AI service `.env`):
`GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`.

Verify every key against the live services (venv active):

```bash
cd MetalliSense_Agent_R\MetalliSense_Agent
python check_keys.py
```
It prints ✅/❌ per key and saves `elevenlabs_test.mp3` if ElevenLabs works.

Then start the Agent service — the log shows `🔊 TTS provider: elevenlabs`.
`GET http://localhost:8001/copilot/voice/status` shows which voice engine is active
(and the last ElevenLabs error, if any). "Read aloud" buttons on the Pre-Melt Gate and
RL Optimizer (plus all existing voice buttons) now speak through ElevenLabs, falling back
to gTTS server-side, and to the browser voice if the Agent service is offline.
