# MetalliSense Master Project Document

**Project:** MetalliSense
**Document status:** Repository-grounded master reference (v2, covers every module built so far)
**Last reviewed:** 2026-09-25
**Workspace root:** `MetalliSense-COMPLETE-FINAL`

> **What changed in v2:** added Supplier Scorecard (AHP-weighted), Energy per Heat and savings, Inventory Forecasting & Reorder, Purchase Requests, Sales & Dispatch (tap approval, test certificate, GST invoice, margin per heat), and the six-month Supplier History seed. It also records the stage-grouped sidebar, the renamed AI pages, the Full Analysis strategy lock, the melt-flow persistence, the molten-metal loaders, the ElevenLabs read-aloud and the `check_keys.py` key checker. Nothing in the original core flow was removed. The earlier version is kept in `_backup_before_masterdoc_20260925_093856/`.

## 1. What this project is

MetalliSense is a quality and decision-support platform for foundries and induction-furnace melt shops. It follows one heat of metal from the supplier's truck to the customer's invoice.

```text
Supplier → Stock & Inspection → Pre-Melt Gate → AI Melt Correction → Mechanical Check → Tap → Invoice
   ▲                                                                                        │
   └──────────── Supplier Scorecard · Energy per Heat · Inventory Reorder ◄─────────────────┘
```

It combines:

- **Pre-production**
  - Supplier ranking: the Supplier Scorecard, an AHP-weighted multi-criteria score with grades A to D.
  - Inventory forecasting and reorder: safety stock, reorder point, EOQ and a best-supplier suggestion.
  - Purchase requests with a maker-checker approval flow.
  - Raw-material stock, lot ledger, additives and DRI lab QA.
  - Yard inspection with a simulated handheld XRF/LIBS gun (OPC UA), plus real-format CSV ingestion.
  - The Pre-Melt Gate: melt-down chemistry prediction with uncertainty, 8 checks, GO/WARN/HOLD, and a start-melting interlock.
  - Energy per heat: a kWh prediction before melting, drivers, tariff, CO₂, savings and meter actuals.
- **AI analysis (after the gate)**
  - Composition Deviation Analysis (anomaly detection, Isolation Forest).
  - Melt Correction Planner (alloy-addition recommendation).
  - Adaptive Strategy Optimizer (closed-loop reinforcement learning with Conservative, Balanced and Aggressive strategies).
  - Full Analysis (one click through all stages, with a lock on the chosen strategy).
  - The AI Agent, with a copilot explanation, chat, speech-to-text (Groq Whisper) and read-aloud (ElevenLabs, falling back to gTTS and then the browser voice).
- **Post-production:** mechanical-property prediction from chemistry (UTS, YS, elongation, hardness) and tap approval.
- **Sales:** completed heats, a test certificate, a GST tax invoice (CGST/SGST or IGST), margin per heat, and foundry returns credited back to stock.
- **Training data and knowledge:** synthetic data, the historical dataset, semantic (vector) search, and cost/carbon/savings analysis.

The project is split into independent services. The Node backend is the public application API, the Python services provide the intelligence, and the React application is the operator UI.

## 2. System at a glance

```text
React UI :5173
    |
    v
Node/Express backend :3000
    |-- CSV stores, grade specs, prices, carbon, alerts, savings
    |-- /api/v2/premelt    stock, QA, gun, heats, gate, interlock, audit
    |-- /api/v2/insights   Supplier Scorecard (AHP) + Energy per Heat
    |-- /api/v2/inventory  forecast, reorder, purchase requests
    |-- /api/v2/sales      tap approval, certificates, invoices, margin
    |-- /api/v2/mechanical mechanical-property proxy
    |-- OPC UA spectrometer simulator :4334
    |-- OPC UA handheld-gun simulator :4335
    |-- proxy --> AI service :8000
    |-- proxy --> Agent service :8001
    |
    +--> AI service :8000
    |      anomaly model, alloy model, mechanical prediction
    |
    +--> Agent service :8001
           orchestration, copilot, voice (Groq STT, ElevenLabs TTS),
           RL, pre-melt risk, vector adapter

Optional standalone semantic-search service :8002
    dataset.csv -> sentence-transformer -> Actian VectorAI or local fallback
```

### Service matrix

| Service | Directory | Default port | Technology | Role |
|---|---|---:|---|---|
| Main backend | `MetalliSense_Backend_Simple` | 3000 | Node.js, Express | Public API, in-memory stores, business modules, proxies, OPC UA simulators |
| AI service | `MetalliSense_AI_R/MetalliSense_AI` | 8000 | FastAPI, scikit-learn | Anomaly, alloy correction, mechanical-property prediction |
| Agent service | `MetalliSense_Agent_R/MetalliSense_Agent` | 8001 | FastAPI, scikit-learn | Agent orchestration, RL, pre-melt AI, copilot, voice |
| Semantic search | `MetalliSense_VectorSearch` | 8002 | FastAPI, sentence-transformers | Free-text vector search; optional standalone service |
| Frontend | `MetalliSense_Frontend_R/MetalliSense_Frontend` | 5173 | React, Vite, Tailwind, Recharts | Dashboard and operator workflows |

## 3. Source-of-truth file map

### Root documentation

- [TORUN.md](TORUN.md): quick-start instructions, feature notes and the voice/API-key check section.
- [PREMELT_GATE_MASTER_PLAN.md](PREMELT_GATE_MASTER_PLAN.md): detailed pre-melt domain design, checks, demo script and limitations.
- [PROJECT_MASTER_DOCUMENT.md](PROJECT_MASTER_DOCUMENT.md): this consolidated reference.
- [MetalliSense_Architecture.png](MetalliSense_Architecture.png): architecture visual.

### Main backend

- [server.js](MetalliSense_Backend_Simple/server.js): Express bootstrap, main routes, proxy logic, cost/carbon/savings logic, workflow composition, service startup. It mounts `/api/v2/premelt`, `/api/v2/insights`, `/api/v2/inventory`, `/api/v2/sales` and `/api/v2/mechanical`.
- [csvDataStore.js](MetalliSense_Backend_Simple/csvDataStore.js), [gradeSpecStore.js](MetalliSense_Backend_Simple/gradeSpecStore.js), [alloyPriceStore.js](MetalliSense_Backend_Simple/alloyPriceStore.js), [carbonStore.js](MetalliSense_Backend_Simple/carbonStore.js), [sellingPriceStore.js](MetalliSense_Backend_Simple/sellingPriceStore.js): data stores. The selling-price store also supplies downgrade targets used by Sales.
- [mechanicalRoutes.js](MetalliSense_Backend_Simple/mechanicalRoutes.js): mechanical-property proxy routes.
- [opcuaService.js](MetalliSense_Backend_Simple/opcuaService.js), [opcuaClient.js](MetalliSense_Backend_Simple/opcuaClient.js), [opcua-server/opcuaServer.js](MetalliSense_Backend_Simple/opcua-server/opcuaServer.js): spectrometer OPC UA.
- [verify.js](MetalliSense_Backend_Simple/verify.js): endpoint-level verifier.
- [dataset.csv](MetalliSense_Backend_Simple/dataset.csv): backend training/history data.

#### `premeltGate/` modules

| File | Purpose |
|---|---|
| `store.js` | In-memory lots, movements (ledger), DRI QA, gun sessions, heats and audit log; seed and reset hooks (`onSeed`) |
| `config.js` | Material types, yields, trust levels, residual limits, DRI rules, gate settings |
| `gateEngine.js` | Melt-down chemistry prediction, the 8 checks, GO/WARN/HOLD, the interlock, and the energy snapshot attached to each gate result |
| `routes.js` | `/api/v2/premelt` routes (stock, additives, QA, gun, heats, gate, config, audit, demo reset) |
| `supplierScorecard.js` | Supplier Scorecard v2: 9 criteria, 4 AHP pillars, grades, rank reasons, trend, alerts, best supplier, order split plan |
| `energy.js` | Energy per heat: prediction, drivers, tariff, CO₂, tips, actuals, summary, gate snapshot |
| `insightsRoutes.js` | `/api/v2/insights` routes (scorecard + energy) |
| `inventory.js` | Inventory forecast per item: demand, safety stock, reorder point, EOQ, status, supplier choice |
| `purchaseRequests.js` | Purchase request lifecycle: PENDING_APPROVAL → APPROVED/REJECTED → RECEIVED |
| `inventoryRoutes.js` | `/api/v2/inventory` routes |
| `sales.js` | Tap approval (complete heat), downgrade logic, returns lot, test certificate, GST invoice, margin per heat |
| `salesRoutes.js` | `/api/v2/sales` routes |
| `supplierHistory.js` | Deterministic six-month history seed (17 supplier profiles, past lots, gun sessions, QA, completed heats with meter readings) |

### Agent service

- [app/main.py](MetalliSense_Agent_R/MetalliSense_Agent/app/main.py): FastAPI application and startup initialisation, including voice status.
- `app/agents/`: manager plus anomaly/alloy wrappers.
- `app/policies/decision_policy.py`: safety and orchestration policy.
- `app/inference/`: model inference adapters.
- `app/rl/`: reward model, policy, constraints, feedback store, schemas.
- `app/premelt/`: charge-risk model, assessor, schemas.
- `app/copilot/`: Groq, Gemini and Claude explainers, and `voice_service.py`. TTS tries ElevenLabs first, then falls back to gTTS; STT uses Groq Whisper.
- `app/vectorsearch/`: embeddings, indexer, adapter, and real/fallback VectorAI selection.
- `app/training/`: training scripts for anomaly, alloy, RL and pre-melt risk models.
- `app/models/`: serialised model files.
- `check_keys.py`: checks that `GROQ_API_KEY` and the ElevenLabs key/voice/model are present and valid before a demo.
- [requirements.txt](MetalliSense_Agent_R/MetalliSense_Agent/requirements.txt): pinned dependencies.

### AI service

- [app/main.py](MetalliSense_AI_R/MetalliSense_AI/app/main.py): FastAPI application.
- `app/inference/anomaly_predict.py`, `app/inference/alloy_predict.py`: inference.
- `app/mech_predict.py`, `app/mech_api.py`: mechanical properties.
- `app/training/`, `app/models/`, `app/data/`: training, models and data.

### Frontend

- [src/App.jsx](MetalliSense_Frontend_R/MetalliSense_Frontend/src/App.jsx): routes and providers.
- `src/pages/`: user-facing workflows (Section 8), including `SupplierScorecard.jsx`, `EnergyDashboard.jsx`, `InventoryForecast.jsx` and `SalesInvoices.jsx`.
- `src/services/`: Axios clients, one per feature. The new ones are `insightsService.js` (scorecard + energy), `inventoryService.js` and `salesService.js`.
- `src/components/layout/Sidebar.jsx`: stage-grouped navigation (Section 8.1).
- `src/components/common/`:
  - `FurnaceLoader.jsx` (`FurnaceLoader`, `CrucibleIcon`, `MeltSpinner` molten-metal loaders);
  - `ReadAloud.jsx` (ElevenLabs read-aloud button);
  - `StrategyComparison.jsx`;
  - tables, cards and dialogs.
- `src/components/premelt/`: gate banner and pre-melt UI helpers.
- `src/context/`:
  - auth stub;
  - OPC state;
  - grade state;
  - `MeltFlowContext.jsx`, which carries a heat through the gate → AI → mechanical → tap flow and is persisted in `sessionStorage`.
- [src/services/api.js](MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/api.js): default API base URL and Axios behaviour.

## 4. Runtime and installation

### Prerequisites

- Windows PowerShell or an equivalent shell.
- Node.js and npm.
- Python 3.11 for the two Python services.
- Optional: Docker plus Actian VectorAI DB.
- Optional: provider API keys (Groq, ElevenLabs, Gemini, Anthropic).

### Recommended startup order

Start each command in its own terminal:

```powershell
# 1. Backend
cd MetalliSense_Backend_Simple
npm install
npm start

# 2. AI service
cd MetalliSense_AI_R\MetalliSense_AI
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app\main.py

# 3. Agent service
cd MetalliSense_Agent_R\MetalliSense_Agent
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python check_keys.py      # optional: confirms Groq + ElevenLabs keys work
python app\main.py

# 4. Optional standalone semantic search
cd MetalliSense_VectorSearch
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py

# 5. Frontend
cd MetalliSense_Frontend_R\MetalliSense_Frontend
npm install
npm run dev
```

The frontend opens at `http://localhost:5173`. Its default backend base URL is `http://localhost:3000/api/v2`; override it with `VITE_API_BASE_URL`.

### Health checks

| URL | Meaning |
|---|---|
| `http://localhost:3000/api/v1/health` | Main backend is alive |
| `http://localhost:3000/api/v2/grades` | Backend loaded grade data |
| `http://localhost:3000/api/v2/insights/suppliers/scorecard` | Scorecard computes (17 suppliers on seed data) |
| `http://localhost:3000/api/v2/insights/energy/summary` | Energy summary (39 heats on seed data) |
| `http://localhost:3000/api/v2/inventory/forecast` | Inventory forecast |
| `http://localhost:3000/api/v2/sales/heats` | Completed heats |
| `http://localhost:8000/health` | AI model readiness |
| `http://localhost:8001/health` | Agent, RL, copilot, voice readiness |
| `http://localhost:8001/copilot/voice/status` | Which TTS provider is active (ElevenLabs or fallback) |
| `http://localhost:8002/health` | Optional semantic-search readiness |

Run `node verify.js` in the backend after the required services are running.

## 5. Configuration and secrets

### Frontend

- `VITE_API_BASE_URL`: defaults to `http://localhost:3000/api/v2`.
- `VITE_API_TIMEOUT`: Axios timeout in ms; defaults to `30000`.

### Backend (`MetalliSense_Backend_Simple/config.env`)

- `PORT` (defaults to 3000), `AI_SERVICE_URL` (defaults to `http://localhost:8000`), `AGENT_SERVICE_URL` (defaults to `http://127.0.0.1:8001`).
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_EMAIL`: optional real email alerts.

**Security action required:** the checked-in `config.env` contains credential-looking Gmail values. Rotate the app password, remove secrets from version control, and use untracked local configuration.

### Business-module settings (runtime, via PATCH)

These are in-memory defaults. A plant calibrates them without a code change:

- `PATCH /api/v2/insights/suppliers/ahp`: AHP pairwise judgements.
- `PATCH /api/v2/insights/suppliers/weights`: direct criterion weights.
- `PATCH /api/v2/insights/energy/config`: base kWh/t, factors, tariff bands, peak hours, grid CO₂.
- `PATCH /api/v2/inventory/config`: service level, horizon, smoothing α, history days, overstock days.
- `PATCH /api/v2/sales/config`: seller details, casting yield %, returns %, GST %, payment terms.

**Seller and customer details are demo placeholders.** Replace them before issuing a real invoice.

### Agent `.env`

The Agent loads `.env` from the service root, independent of the working directory.

- `GROQ_API_KEY`: default copilot LLM and Whisper transcription.
- `GROQ_MODEL`: Groq chat model.
- `COPILOT_PROVIDER`: `groq` (default), `gemini` or `claude`.
- `GOOGLE_GEMINI_API_KEY`, `ANTHROPIC_API_KEY`: optional providers.
- `TTS_PROVIDER=elevenlabs`: ElevenLabs first, with gTTS and then browser speech as fallbacks.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (default `JBFqnCBsd6RMkjVDRZzb`), `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`).
- `VECTORAI_HOST`: real VectorAI endpoint; defaults to `localhost:50051`.

`python check_keys.py` reports whether each key is present and accepted. A missing key degrades only the related copilot or voice feature. Core anomaly, alloy, RL, pre-melt, scorecard, energy, inventory and sales features need no LLM key.

## 6. Backend API catalogue

All routes are under `http://localhost:3000`. The frontend reaches them through `/api/v2`.

### Health and alerts

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Basic backend health |
| GET | `/api/v2/alerts/email-status` | Email configuration status |
| POST | `/api/v2/alerts/send-email` | Send a real deviation email when configured |
| POST | `/api/v2/alerts/simulate` | Draft a simulated escalation; never sends |
| GET | `/api/v2/alerts/history` | Recent simulated alerts |

### Training data

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/training-data` | All CSV rows |
| GET | `/api/v2/training-data/paginated` | Filtered, sorted, paginated rows |
| GET | `/api/v2/training-data/visualizations` | Dashboard aggregates |
| GET | `/api/v2/training-data/grade/:gradeName` | Rows for one grade |
| GET | `/api/v2/training-data/grade/:gradeName/statistics` | Grade statistics by sample type |
| GET | `/api/v2/training-data/:id` | One row |
| POST/PATCH/DELETE | `/api/v2/training-data` or `/:id` | In-memory CRUD |

### Grades

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/v2/grades` | All grade specs / create one in memory |
| GET | `/api/v2/grades/:gradeName` | One grade |
| GET | `/api/v2/grades/:gradeName/composition` | Composition ranges |
| PATCH/DELETE | `/api/v2/grades/:id` | Update or remove a grade |

### Spectrometer and synthetic readings

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/synthetic/opc-status` | OPC UA status |
| POST | `/api/v2/synthetic/opc-connect` / `opc-disconnect` | Connect or disconnect the client |
| POST | `/api/v2/synthetic/opc-reading` | Request a simulated spectrometer reading |
| POST | `/api/v2/synthetic/generate-synthetic` | Generate a reading without OPC UA |
| GET/POST | `/api/v2/synthetic` | In-memory reading collection |
| GET/DELETE | `/api/v2/synthetic/:id` | Read or delete a stored reading |

Compatibility aliases exist under `/api/v1/spectrometer` and `/api/v2/api/v1/spectrometer`.

### AI proxy routes

| Method | Route | Downstream |
|---|---|---|
| GET | `/api/v2/ai/health` | AI `GET /health` |
| POST | `/api/v2/ai/anomaly/predict` | AI `POST /anomaly/predict` |
| POST | `/api/v2/ai/individual/analyze` | Backend combines AI anomaly and alloy calls |
| POST | `/api/v2/ai/agent/analyze` | Agent `POST /agents/analyze` |
| POST | `/api/v2/ai/explain` | Agent copilot explanation, adapted for the UI |
| POST | `/api/v2/ai/analyze-with-explanation` | Agent explanation proxy |
| POST | `/api/v2/ai/what-if` | Agent what-if proxy |
| GET | `/api/v2/ai/gemini/health` | Agent health compatibility route |

### Connected full analysis

`POST /api/v2/workflow/full-analysis` takes `{ metalGrade, composition, batchWeightKg, topK }` and composes six steps:

1. Agent anomaly analysis.
2. Alloy recommendation.
3. RL candidates.
4. Cost and carbon annotations.
5. A historical root-cause hint.
6. A best-effort owner email for medium or high severity.

A downstream failure is recorded in the affected step, and the rest of the result still returns.

### RL proxy and annotations

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v2/rl/optimize` | RL candidates plus cost/carbon/savings annotations |
| POST | `/api/v2/rl/feedback` | Forward operator outcome feedback |
| GET | `/api/v2/rl/policy/status` | RL policy status |
| GET | `/api/v2/rl/feedback` | Backend in-memory feedback log |

### Vector proxy

`GET /api/v2/vector/status`, `POST /api/v2/vector/reindex`, `POST /api/v2/vector/search`, `POST /api/v2/vector/memory/add`, `POST /api/v2/vector/memory/recall`.

### Cost, carbon, selling prices and root cause

| Method | Route | Purpose |
|---|---|---|
| GET/PATCH | `/api/v2/cost/prices` | Element and base-metal prices |
| POST | `/api/v2/cost/estimate` | Batch and addition cost |
| GET | `/api/v2/cost/history` | Recent estimates |
| GET/PATCH | `/api/v2/cost/selling-prices` | Selling-price ladder |
| GET | `/api/v2/cost/savings-analysis` | Correction cost versus downgrade/rejection loss |
| GET/PATCH | `/api/v2/carbon/factors` | Emission factors |
| POST | `/api/v2/carbon/estimate` | Batch CO₂e |
| GET | `/api/v2/carbon/history` | Recent carbon estimates |
| GET | `/api/v2/rootcause/:gradeName` | Explainable historical outlier ranking |

### Pre-melt API: `/api/v2/premelt`

| Area | Routes |
|---|---|
| Stock | `GET /summary`, `GET /lots`, `GET /lots/:id`, `POST /lots`, `PATCH /lots/:id/status`, `POST /lots/:id/adjust`, `GET /movements` |
| Additives | `GET /additives`, `POST /additives/receive`, `POST /additives/deduct` |
| DRI QA | `POST /lots/:id/dri-qa`, `GET /dri-qa`, `POST /dri-qa/:qaId/approve`, `POST /dri-qa/:qaId/reject` |
| Handheld gun | `GET /gun/status`, `POST /gun/connect`, `POST /gun/disconnect`, `POST /gun/inspect`, `GET /gun/live`, `POST /gun/ingest-csv`, `GET /gun/sessions`, `GET /gun/sessions/:id`, `GET /gun/sessions/:id/csv`, `POST /gun/argon/replace`, `GET /gun/scenarios` |
| Heat gate | `GET /heats`, `POST /heats`, `GET /heats/:id`, `PUT /heats/:id/charge`, `POST /heats/:id/gate-check`, `POST /heats/:id/start-melting` |
| Configuration | `GET/PATCH /config`, `GET /audit`, `POST /demo/reset` |

Interlock responses:

- `428`: gate check or warning acknowledgement required.
- `423`: HOLD, melting locked.
- `409`: charge changed or result expired.
- `200`: melting started, stock deducted.

Every gate result now carries an `energy` snapshot (Section 10.4). Starting the furnace stores `heat.energyAtStart`.

### Insights API: `/api/v2/insights` (Supplier Scorecard + Energy)

| Method | Route | Purpose |
|---|---|---|
| GET | `/suppliers/scorecard?materialType=` | Ranked suppliers per material, with score, grade, pillars, criteria, rank reason, trend, alerts |
| GET | `/suppliers/detail?name=&materialType=` | One supplier: every criterion with evidence and formula, lot history, pillar ranks, comparison with the next-ranked supplier |
| GET | `/suppliers/lot-grade/:lotId` | Supplier grade for a lot (drives the inspection sample size) |
| GET | `/suppliers/best?materialType=&alloyName=` | Best eligible supplier for a material or alloy |
| PATCH | `/suppliers/weights` | Override criterion weights |
| GET/PATCH | `/suppliers/ahp` | Read or change the AHP pairwise judgements; returns pillar weights and the consistency ratio |
| GET | `/suppliers/order-plan?materialType=&tonnes=` | Split an order across suppliers by score, with caps |
| GET | `/suppliers/alerts?materialType=` | Grade drop/up, declining/improving, blocked, hidden-cost alerts |
| GET/PATCH | `/energy/config` | Energy model settings |
| GET | `/energy/summary` | Plant kWh/t benchmarks, drivers, savings by type, prediction error |
| GET | `/energy/heat/:heatId` | Predicted energy for one heat, with drivers, tariff, CO₂, tips and actual if recorded |
| POST | `/energy/heat/:heatId/actual` | Record an actual meter reading `{ actualKwh, by }` |
| POST | `/energy/heat/:heatId/simulate` | Simulate a meter reading (demo) |

### Inventory API: `/api/v2/inventory`

| Method | Route | Purpose |
|---|---|---|
| GET | `/forecast` | All items with status, cover days, stock-out date, safety stock, reorder point, order quantity and supplier |
| GET | `/forecast/:item` | Step-by-step calculation for one item (demand → smoothing → planned demand → SS → ROP → EOQ → status) |
| GET | `/reorder-suggestions` | CRITICAL/REORDER items with no open purchase request, each with a pre-filled order |
| GET/POST | `/purchase-requests` | List (filter by `status`, `item`) or create a PR |
| GET | `/purchase-requests/:id` | One PR |
| POST | `/purchase-requests/:id/approve` | Manager approves `{ by }` |
| POST | `/purchase-requests/:id/reject` | Manager rejects `{ by, reason }` |
| POST | `/purchase-requests/:id/receive` | Link the arriving lot `{ lotId, by }` → RECEIVED |
| GET/PATCH | `/config` | Inventory settings |

### Sales API: `/api/v2/sales`

| Method | Route | Purpose |
|---|---|---|
| POST | `/heats/:heatId/complete` | Tap approval `{ approvedBy, composition, mechanical, standard, acceptedStrategy }` → heat COMPLETED |
| GET | `/heats` | Completed heats with tap result and margin |
| GET | `/certificates/:heatId` | Test certificate: chemistry vs spec, mechanical properties, source lots |
| GET | `/customers` | Demo customer list |
| GET/POST | `/invoices` | List or create a GST invoice for a completed heat |
| GET | `/invoices/:id` | One invoice |
| GET/PATCH | `/config` | Seller details, yields, GST, payment terms |

### Mechanical properties

Mechanical routes are under `/api/v2/mechanical` ([mechanicalRoutes.js](MetalliSense_Backend_Simple/mechanicalRoutes.js)). The model is in the AI service (`mech_predict.py`, `mech_api.py`).

## 7. Python service API catalogue

### AI service on port 8000

- `GET /`, `GET /health`.
- `POST /anomaly/predict`: grade-aware anomaly score and LOW/MEDIUM/HIGH severity.
- `POST /alloy/recommend`: element additions, confidence, message, warning.
- `GET /grades`, `GET /grades/{grade}`.
- Mechanical-property routes from `mech_api.py`.

### Agent service on port 8001

- `GET /`, `GET /health`.
- `POST /agents/analyze`: always runs anomaly detection, runs alloy correction for medium/high severity; human approval is required.
- `POST /anomaly/predict`, `POST /alloy/recommend`, `GET /grades`, `GET /grades/{grade}`.
- `GET /vector/status`, `POST /vector/reindex`, `POST /vector/search`, `POST /vector/memory/add`, `POST /vector/memory/recall`.
- `POST /copilot/explain`, `POST /copilot/chat`, `DELETE /copilot/chat/history`.
- `POST /copilot/voice/transcribe` (Groq Whisper), `POST /copilot/voice/synthesize` (ElevenLabs → gTTS), `GET /copilot/voice/status`, `GET /copilot/voice/languages`.
- `POST /rl/optimize`, `POST /rl/feedback`, `GET /rl/policy/status`.
- `POST /premelt/assess`, `GET /premelt/model/status`.

## 8. Frontend route and feature map

### 8.1 Sidebar (stage-grouped navigation)

The sidebar follows the plant flow. **General** comes first; the stage groups follow in order:

| Section | Pages (in order) |
|---|---|
| **General** | Onboard Tour, Technical Docs, Dashboard, Spectrometer, Grade Specs |
| **Pre-Production** | Supplier Scorecard, Inventory Forecast, Raw Material Stock, Yard Inspection, Pre-Melt Gate, Energy per Heat |
| **AI Analysis** | Composition Deviation Analysis, Melt Correction Planner, Adaptive Strategy Optimizer, Full Analysis, AI Agent |
| **Post-Production** | Mechanical Properties |
| **Sales** | Sales & Dispatch |
| **Training Data** | Synthetic Data, Training Data, Semantic Search, Cost Analysis |

### 8.2 Route table

| UI route | Page | Main capability |
|---|---|---|
| `/dashboard` | Dashboard | Operational overview, charts, health signals |
| `/spectrometer` | Spectrometer | OPC UA connection and readings |
| `/grades` | GradeSpecs | Grade specifications (3D molten-pour loader) |
| `/supplier-scorecard` | SupplierScorecard | Ranked suppliers, grades, AHP pillars, rank explanation, trend, alerts, order plan |
| `/inventory-forecast` | InventoryForecast | Stock cover, stock-out dates, reorder suggestions, purchase requests |
| `/raw-material-stock` | RawMaterialStock | Lots, ledger, additives, DRI QA |
| `/yard-inspection` | YardInspection | Handheld XRF/LIBS inspection and CSV ingestion |
| `/premelt-gate` | PreMeltGate | Heat plan, 8 checks, GO/WARN/HOLD, interlock, audit trail |
| `/energy` | EnergyDashboard | kWh/t per heat, drivers, tariff, CO₂, savings, meter actuals |
| `/anomaly` | AnomalyDetection → **Composition Deviation Analysis** | Score deviation severity of the gate-predicted chemistry |
| `/recommendation` | Recommendation → **Melt Correction Planner** | Alloy corrections |
| `/rl-optimizer` | RLOptimizer → **Adaptive Strategy Optimizer** | Conservative/Balanced/Aggressive comparison, accept/modify/reject, policy learning |
| `/full-analysis` | FullAnalysis | One-click anomaly → alloy → RL → cost/carbon → root cause |
| `/agent` | AIAgent | Coordinated agent result, explanation, voice |
| `/mechanical-properties` | MechanicalProperties | UTS/YS/elongation/hardness from chemistry and tap approval |
| `/sales` | SalesInvoices → **Sales & Dispatch** | Completed heats, certificate, GST invoice, margin |
| `/synthetic` | SyntheticData | Synthetic deviations |
| `/training-data` | TrainingData | Historical rows |
| `/semantic-search` | SemanticSearch | Free-text vector search |
| `/cost-analysis` | CostAnalysis | Prices, estimates, savings, history |

The internal component names are unchanged. Only the displayed names, headings and nav labels were renamed.

### 8.3 UI behaviours added

- **Melt flow lock (`MeltFlowContext`).**
  - The AI pages are locked until a heat passes the gate (GO, or HOLD overridden with a written reason).
  - They receive the gate's predicted chemistry.
  - Stock is deducted only when a strategy is accepted.
  - Rejecting every strategy forces a new gate run.
  - The flow is saved in `sessionStorage`, so a page refresh does not lose the heat. If the server restarted, tap approval can close the heat with `resume` (the heat is logged as `HEAT_RESUMED`).
- **Adaptive Strategy Optimizer layout.** The Strategy Comparison is shown above Policy Learning. The accuracy/balance/composite comparison grid also appears when the page is reached from the gate flow.
- **Full Analysis strategy lock.** Once the operator accepts Conservative, Balanced or Aggressive, the other two are frozen (disabled).
- **Pre-Melt Gate UI.**
  - Professional result layout with full-width sections.
  - The audit trail spans left to right.
  - A single "Reset" button replaces the old reset/demo-data buttons.
- **Loaders.** Molten-metal / furnace loaders (`FurnaceLoader`, `CrucibleIcon`, `MeltSpinner`). The 3D pour, with metal flowing downward and no background, is used only on Grade Specs.
- **Read aloud.** `ReadAloud.jsx` sends text to the Agent's `/copilot/voice/synthesize`. It uses ElevenLabs when a key is configured, otherwise gTTS, otherwise browser speech.

The frontend still has no effective authentication. `AuthContext` returns a Guest user, `ProtectedRoute` renders its children, and `api.js` uses `withCredentials: false`.

## 9. Core business workflows (end to end)

### 9.1 The full plant lifecycle

1. **Choose the supplier.** The Supplier Scorecard ranks suppliers per material, and its grade decides the yard inspection sample: A inspects 10 pieces, B 15, C 25, D 30 plus manager approval, and a New supplier 30.
2. **Buy.** Inventory Forecast flags CRITICAL/REORDER items and pre-fills an order: EOQ quantity from the best-graded supplier. Stores creates a purchase request, a manager approves it, and it is received against the new lot.
3. **Receive and inspect.** The lot enters Raw Material Stock. Scrap is checked with the handheld gun; DRI goes through lab QA with maker-checker approval.
4. **Plan the heat and run the gate.** The Pre-Melt Gate predicts melt-down chemistry with uncertainty, runs the 8 checks, and returns GO, WARN or HOLD together with an energy estimate.
5. **Start melting** only when the interlock allows it.
6. **Correct the melt.** Composition Deviation Analysis, then the Melt Correction Planner, then the Adaptive Strategy Optimizer. The operator accepts a strategy, and the alloy stock is deducted.
7. **Mechanical check and tap approval.** Properties are predicted from chemistry, and an engineer approves the tap.
8. **Sales.** Castings are counted, returns go back to stock, the heat is downgraded if it failed, and a test certificate and GST invoice are produced with the margin per heat.
9. **Feedback.** Gate decisions and heat outcomes feed back into the Scorecard (heat impact), the Energy benchmarks (meter actuals) and Inventory (consumption history).

### 9.2 Standard composition analysis

The operator generates a synthetic or OPC UA reading. The backend proxies it to the AI service, and the anomaly and alloy results return. The results are recommendations only.

### 9.3 Pre-melt gate

1. Receive and identify lots.
2. Inspect scrap with the gun, or upload a CSV.
3. Approve DRI QA with two different names.
4. Build a heat from released or restricted lots.
5. Run the checks: chemistry, residuals, stock, source quality and AI risk.
6. Resolve additions from inventory.
7. Receive GO, WARN or HOLD.
8. Acknowledge warnings, or obtain an engineer override where allowed.
9. Start melting through the interlock.

Source trust (σ):

| Source | σ |
|---|---:|
| Declared | 15% |
| Certificate | 6% |
| Lab or parent heat | 3% |

A per-grade HistGradientBoosting risk model runs 400 Monte Carlo samples. Fe is treated as the balance element.

### 9.4 RL feedback loop

1. Request strategies from `/rl/optimize`.
2. The operator accepts, modifies or rejects.
3. The outcome is sent to `/rl/feedback`.
4. The SGD reward model updates online.

### 9.5 Procurement loop (new)

```text
Forecast → CRITICAL/REORDER → Reorder suggestion (qty = EOQ, supplier = best grade)
  → POST purchase-requests → PENDING_APPROVAL
  → approve (manager) → APPROVED      | reject (reason) → REJECTED
  → truck arrives, lot received with PR → RECEIVED (linked to lotId)
```

Only one open PR is allowed per item, and an item with an open PR drops out of the suggestions. Every step is written to the audit log (`PR_CREATED`, `PR_APPROVED`, `PR_REJECTED`, `PR_RECEIVED`).

### 9.6 Tap-to-invoice loop (new)

```text
Heat MELTING → Mechanical Properties → engineer approves tap
  → chemistry vs spec + mechanical vs standard
  → PASS  : sold at grade price
  → FAIL  : DOWNGRADED to next grade (or SCRAP) with a written reason
  → castings = metal × 70 %, returns = metal × 25 % → new RETURNS lot (RET-xxxx, ₹38/kg)
  → energy meter reading recorded
  → Sales & Dispatch: certificate + GST invoice + margin
```

## 10. Feature deep dives: algorithms and formulas

### 10.1 Composition Deviation Analysis (anomaly)

- Isolation Forest over 18 features (element values and their deviation from the grade range).
- The score maps to LOW, MEDIUM or HIGH severity.
- It flags unstable chemistry. It is not a pass/fail gate.

### 10.2 Melt Correction Planner (alloy)

- A multi-output gradient-boosting regressor predicts the kg of each addition needed to bring the melt into range.
- Confidence blends model certainty, the distance to the spec window and historical agreement (weights 0.4/0.3/0.3).

### 10.3 Adaptive Strategy Optimizer (RL)

- Three strategies scale the correction:

  | Strategy | Scale |
  |---|---:|
  | Conservative | 0.3× |
  | Balanced | 1.0× |
  | Aggressive | 2.0× |

- An online SGDRegressor reward model scores each strategy. The composite score weights accuracy, cost, risk and speed 35/25/25/15.
- Accepting a strategy deducts the alloy stock and feeds the reward back.

### 10.4 Energy per Heat (`energy.js`)

**Prediction before melting (kWh):**

```text
base         = charge t × baseKwhPerT[grade]
tapTemp      = charge t × (tap °C − reference °C) × 0.45 kWh/t/°C
rust         = base × 3.0 % per 10 % rusty/painted scrap pieces (from gun sessions)
DRI share    = base × 1.2 % per 10 % DRI in the charge
moisture     = base × 2.0 % per 1 % DRI moisture × DRI share
fines        = base × 1.0 % per 5 % DRI fines × DRI share
light scrap  = base × 1.5 % per 10 % light steel scrap
dense charge = base × −1.5 % per 10 % pig iron / returns   (saves energy)
alloys       = 0.45 kWh per kg of ferro-alloy
holding      = 60 kW/t × furnace t × holding minutes (default 15)
```

| Grade | Base kWh/t | Reference tap °C |
|---|---:|---:|
| SG iron | 570 | 1500 |
| Grey iron | 550 | 1480 |
| Low-carbon steel | 620 | 1620 |
| Medium-carbon steel | 610 | 1600 |
| High-carbon steel | 600 | 1580 |

**Cost and CO₂:**

- The tariff band follows the hour:
  - off-peak (22:00–05:59): ₹6.8/kWh;
  - peak (09–11 and 18–21): ₹9.6/kWh;
  - normal: ₹8.0/kWh.
- CO₂ = kWh × 0.71 kg/kWh (grid factor).

**Outputs:**

- For each heat: kWh, kWh/t, the baseline for the grade, ₹, ₹/t, CO₂, drivers ranked by kWh, potential kWh/₹ saved, and tips such as drying the DRI, shot-blasting rusty scrap, reducing holding time or shifting to off-peak.
- **Gate snapshot:** every gate result shows the top three energy drivers. If the decision is HOLD, the energy that the stopped melt would have used is reported as `avoidedIfHeld`, which counts as energy saved by the gate.
- **Actuals:** a meter reading per heat (recorded, or simulated on tap).
- **Summary:** plant average kWh/t (about 617 kWh/t on 39 seed heats), the driver breakdown, savings by type (gate holds, off-peak shifts, charge fixes) and prediction error %.

### 10.5 Supplier Scorecard v2 (`supplierScorecard.js`)

**Nine criteria in four pillars:**

| Pillar | Criterion | Formula (0–1, ×100 for points) | Share within pillar |
|---|---|---|---:|
| Quality | Acceptance rate | (released + 0.5 × restricted) ÷ decided lots | 40% |
| Quality | Declaration accuracy | 1 − average \|declared − tested\| ÷ tested, per element (C, Si, Mn, P, S, Cu, Cr, Ni, Fe metallic/total), capped | 22% |
| Quality | Clean pieces (gun) | 1 − flagged pieces ÷ tested pieces (Cu-high, stainless, alloy) | 20% |
| Quality | Heat impact | 1 − (HOLD + 0.5 × WARN) ÷ heats using their lots | 18% |
| Cost | Effective cost | 1 − 2.5 × (% dearer than cheapest effective ₹/t) ÷ 100 (40% dearer = 0) | 73% |
| Cost | Metal yield | 1 − 12.5 × (% points below nominal yield) ÷ 100 (8 points below = 0) | 27% |
| Delivery | On-time delivery | trucks on/before promised date ÷ trucks | 60% |
| Delivery | Weight match | 1 − \|invoice kg − weighbridge kg\| ÷ invoice kg ÷ 5% | 40% |
| Service | Document compliance | documents received ÷ documents required | 100% |

**Effective cost of good metal:**

```text
effective ₹/t = invoice ₹/t ÷ yield + reject share × ₹10/kg × 1000
```

The ₹10/kg reject handling covers return freight, re-inspection, delay and replacement premium. A supplier that is cheap on the invoice but poor in yield or rejects gets a HIDDEN_COST alert.

**AHP pillar weights.** These come from Saaty 1–9 pairwise judgements:

| Judgement | Value |
|---|---:|
| Quality : Cost | 2 |
| Quality : Delivery | 3 |
| Quality : Service | 6 |
| Cost : Delivery | 2 |
| Cost : Service | 4 |
| Delivery : Service | 2 |

- The principal eigenvector gives pillar weights of about **Quality 49%, Cost 28%, Delivery 15% and Service 8%**.
- The consistency ratio is about 0.004. AHP accepts a ratio below 0.10.
- Each pillar weight is then split across its criteria. This gives roughly: acceptance 20, accuracy 11, clean pieces 10, heat impact 9, effective cost 21, yield 8, on-time 9, weight match 6, documents 8.
- A criterion with no data for a supplier is skipped and the other weights are re-normalised, so a new supplier is not punished for missing history.

**Score, grade and rank:**

- Score = Σ (weight share × criterion score) over the available criteria (0–100).

| Grade | Score | Meaning | Pieces inspected per lot |
|---|---|---|---:|
| A | ≥ 85 | Preferred | 10 |
| B | ≥ 70 | Approved | 15 |
| C | ≥ 50 | Conditional | 25 |
| D | < 50 | Blocked, manager approval | 30 |
| New | fewer than 3 decided lots | Not yet graded | 30 |

- Suppliers are ranked within each material type, overall and per pillar.
- **Rank reason:** each supplier gets a plain-language explanation of its position against the next supplier, listing the criteria where it gains or loses points (zero-point differences are hidden).
- **Detail view:** every criterion shows its evidence (for example "invoice weight 2.1% above weighbridge"), the formula, the points earned and the lot history.
- **Trend:** a rolling score at the end of each of the last 5 months. Improving is +5 points or more; declining is −5 or less.
- **Alerts:** GRADE_DROP, GRADE_UP, DECLINING, IMPROVING, BLOCKED (grade D), HIDDEN_COST.
- **Order plan:** splits N tonnes across eligible suppliers in proportion to (score − 40)².
  - Grade D is excluded.
  - Caps: at most 60% per supplier, 20% for grade C and 10% for a New supplier.
  - Minimum share 10%, in steps of 5%.
  - Surplus is redistributed ("water-filling").

On seed data, 17 suppliers are graded (for example Goa A/100, Coimbatore C/65, Pollachi D/40).

### 10.6 Inventory Forecasting & Reorder (`inventory.js`)

**Items:** FeSi-75, HC FeMn and Recarburiser (alloys); steel scrap, cast-iron scrap, pig iron, DRI and foundry returns (charge; returns are made in-house).

**The calculation, step by step:**

1. **Usable stock.**
   - RELEASED lots count in full.
   - RESTRICTED lots count up to their charge limit over the horizon.
   - AWAITING_QA, HOLD and REJECTED lots are listed as not usable, with the reason.
   - DRI older than 7 days since its lab test gets a re-oxidation warning. Wet DRI (moisture above 1%) is also flagged.
2. **History:** daily consumption over the last 30 days from the ledger (CHARGE movements and alloy deductions).
3. **Smoothing:** exponential smoothing with α = 0.3 gives the daily demand.
4. **Planned demand:** kg from PLANNED heats over the 14-day horizon. Alloy demand comes from the heat's alloy lines, or the gate's suggested additions, or the typical kg/t per grade (for example SG iron uses 12 kg/t FeSi-75). The higher of the smoothed and planned demand is used.
5. **Variation:** σ of daily use. If there is little history, 30% of demand is used instead.
6. **Safety stock:** `SS = z × σ_daily × √(lead days)`, with z = 1.65 at a 95% service level (Acklam inverse-normal, rounded up).
7. **Reorder point:** `ROP = daily demand × lead days + SS`.
8. **Order quantity:** `EOQ = √(2 × annual demand × order cost ÷ holding cost per kg per year)`. The order is the largest of EOQ, the minimum order and the shortfall, rounded to the pack size.
9. **Cover and stock-out:** cover days = net usable kg ÷ daily demand, which gives the stock-out date.
10. **Status:**

    | Status | Condition |
    |---|---|
    | CRITICAL | cover < lead + 1 day, or below safety stock (returns: under 2 days) |
    | REORDER | net ≤ ROP |
    | OVERSTOCK | cover > 60 days |
    | OK | above the reorder point |
    | NO_DEMAND | no use and no plan |

11. **Supplier choice:** the best-graded eligible supplier from the Scorecard, with a plain-language comparison against the alternative (price, quality, and late-delivery risk when stock is critical).

| Item | Lead days | Order cost ₹ | Holding %/yr | Min order kg | Round to kg |
|---|---:|---:|---:|---:|---:|
| FeSi-75, HC FeMn | 5 | 1,500 | 18 | 100 | 50 |
| Recarburiser | 3 | 1,000 | 18 | 50 | 50 |
| Steel scrap | 2 | 2,500 | 12 | 5,000 | 500 |
| CI scrap, pig iron | 3 / 4 | 2,500 | 12 | 3,000 | 500 |
| DRI | 3 | 2,500 | 12 | 3,000 | 500 |

On seed data, FeSi-75 is REORDER (1,300 kg from Nava Bharat, grade A), steel scrap and CI scrap are CRITICAL, and the rest are OK.

### 10.7 Sales & Dispatch (`sales.js`)

**Tap approval** (`POST /sales/heats/:id/complete`):

- Requires the engineer's name.
- Checks the final chemistry against the grade spec and the residual limits, and the predicted mechanical properties (UTS, YS, elongation minimums; hardness maximum) against the chosen standard.
- **PASS:** sold at the grade's selling price.
- **DOWNGRADED:** sold at the next grade down, or as scrap, with a written reason (for example "Chemistry (Cu) outside SG Iron limits — sold as Grey Iron").

**Yields:**

- Metal = gate-predicted metal kg, or charge × 0.95.
- Castings = metal × 70%.
- Returns = metal × 25%. These become a new lot `RET-<heat>` (supplier "In-house", ₹38/kg) carrying the heat's chemistry, so they can be charged again with lab-level trust.

**Test certificate:** grade, chemistry versus spec (pass/fail per element), mechanical properties, the source lots and suppliers, gate decision, and approver.

**GST invoice:**

- The HSN code comes from the grade.
- Taxable value = castings kg × ₹/kg.
- GST is 18%. Within the same state it is split into CGST 9% and SGST 9%; across states it is IGST 18%.
- The total is rounded, the amount is written out in words (Indian system: crore and lakh), the invoice number is based on the financial year, and payment terms are 30 days.

**Margin per heat:**

```text
revenue (list price, before GST) − (charge ₹ + alloy ₹ + energy ₹ − returns credit)
```

Moulding, labour and overheads are not included.

### 10.8 Supplier History seed (`supplierHistory.js`)

- Generates about six months of past lots, gun sessions, DRI lab results and completed heats, with gate decisions and meter readings, for 17 supplier profiles.
- Each profile has a release/restrict probability, a monthly trend, declaration error, on-time share and so on.
- A fixed random seed (mulberry32) gives the same ranking in every demo.
- Records are tagged `history: true`, so the operator stock and heat lists hide them while the Scorecard and Energy pages use them.

## 11. Data, models and persistence

- **Data:**
  - backend `dataset.csv`;
  - AI and Agent `app/data`;
  - vector `dataset.csv`;
  - seeded pre-melt data: 3 live heats (H-1043 completed, H-1051, H-1052), plus history for a total of 39 heats and 17 suppliers.
- **Persistence:**
  - All backend operational state is in process memory: lots, movements, QA, gun sessions, heats, audit, readings, prices, carbon, alerts, RL feedback, purchase requests, invoices, energy actuals and module settings.
  - `POST /api/v2/premelt/demo/reset` (the "Reset" button) re-seeds everything. PRs and invoices clear through `store.onSeed`.
- **Models:** serialised under each Python service's `app/models`. The training commands are:

```powershell
python app\training\train_anomaly.py
python app\training\train_alloy_agent.py
python app\training\train_premelt_risk.py
python app\training\train_rl.py 2000
```

## 12. OPC UA devices

- **Spectrometer:** `opc.tcp://localhost:4334/MetalliSense/Spectrometer`. The server starts at boot; the client connects on request.
- **Handheld gun:** `opc.tcp://localhost:4335/MetalliSense/HandheldGun`.
  - It emits piece-level readings, status, count, CSV and argon state.
  - XRF does not measure carbon.
  - LIBS needs grinding and uses argon on every piece.
  - Real gun CSV files can be ingested.

These simulators are integration scaffolds, not certified drivers.

## 13. Cost, carbon and business assumptions

- **Cost:** element prices, base-metal price and a strategy premium (handling/QA/rework risk, not material price).
- **Carbon:** illustrative batch factors. Energy CO₂ uses 0.71 kg/kWh.
- **Savings analysis:** a 1,000 kg batch; the correction cost is compared with the downgrade loss or the rejection fraction.
- **Energy:** the base kWh/t, factor percentages and tariff bands in Section 10.4 are illustrative for a coreless induction furnace.
- **Scorecard:** reject handling ₹10/kg, nominal DRI yield 82%, the AHP judgements and the grade thresholds are defaults for the plant to calibrate.
- **Inventory:** service level 95%, horizon 14 days, α 0.3, 30-day history, 60-day overstock, plus the per-item lead times and costs in Section 10.6.
- **Sales:** casting yield 70%, returns 25%, returns value ₹38/kg, GST 18%, payment terms 30 days. Seller and customers are demo placeholders.
- None of these values are live market feeds.

## 14. Known limitations

1. **Secrets:** the checked-in Gmail values must be rotated and removed.
2. **No authentication or role-based access:** auth is a stub and CORS is open. Role-based access control (per-role page access for stores, QA, melt shop, engineer, manager and sales) is designed but **not implemented**. The maker-checker rules use typed names only.
3. **In-memory backend:** a restart loses state, including purchase requests, invoices and energy actuals.
4. **VectorAI** may run on the local fallback.
5. **Synthetic data:** the models and the supplier history are demo data. Validate against plant data before relying on them.
6. **Illustrative constants:** yields, trust, residual limits, energy factors, tariffs, scorecard weights and inventory costs need plant calibration.
7. **LLM and voice** need keys and network. Fallbacks are expected.
8. **Email:** simulated alerts never send.
9. **Legacy auth pages** remain.
10. **Port fallback:** if port 3000 is busy, point the frontend at the actual port.
11. **Compatibility aliases** and field translations exist between the older frontend and the current Python schemas.
12. **Operator approval:** AI never actuates the furnace.
13. **Invoices are not statutory documents.** No e-invoice IRN, e-way bill or GST filing. Use the ERP for real billing.
14. **Energy actuals are simulated** unless a meter reading is posted.
15. **Slow first load on some Windows machines:** loading `premeltGate/routes.js` (which pulls in `node-opcua`) can take tens of seconds, so the backend can appear slow to become ready.

## 15. Validation checklist

### Installation and runtime

- [ ] Backend and frontend dependencies installed; Python 3.11 virtual environments with scikit-learn 1.3.2.
- [ ] Model files exist; `VITE_API_BASE_URL` matches the backend port.
- [ ] Backend, AI and Agent health checks pass; OPC UA ports 4334 and 4335 are up.
- [ ] `python check_keys.py` reports Groq and ElevenLabs OK (or the fallback is understood).
- [ ] `node verify.js` passes.

### Feature smoke tests

- [ ] Synthetic reading → Composition Deviation Analysis → Melt Correction Planner.
- [ ] Full Analysis. Accepting one strategy disables the other two.
- [ ] Adaptive Strategy Optimizer. The comparison grid shows when reached from the gate.
- [ ] Cost and carbon update, and root cause for a known grade.
- [ ] Receive a lot, gun inspection, and DRI QA approved by two different names.
- [ ] Create a heat and run the gate. GO/WARN/HOLD is shown with an energy snapshot, and the interlock returns 428, 423 or 409 as expected.
- [ ] Supplier Scorecard shows 17 suppliers with grades, a rank reason, drill-down evidence, trend and alerts. Changing AHP judgements re-ranks them.
- [ ] Order plan splits tonnes within the caps.
- [ ] Energy page shows heats, kWh/t, drivers and savings. Posting an actual updates the prediction error.
- [ ] Inventory shows CRITICAL/REORDER items. Detail steps show SS, ROP and EOQ.
- [ ] Create, approve and receive a PR. The item leaves the suggestions.
- [ ] Mechanical check → tap approval → returns lot created → certificate → GST invoice (test both intra-state and inter-state) → margin.
- [ ] Refresh mid-flow. The melt flow is restored from `sessionStorage`.
- [ ] Read aloud plays through ElevenLabs, or through a fallback.
- [ ] Semantic search reports Actian or the fallback.

## 16. Demo sequence (story order)

1. Start the Agent, AI, backend and frontend. Press **Reset** on the Pre-Melt Gate for clean data.
2. **Supplier Scorecard:** why Goa is A and Pollachi is D. Open a supplier to show evidence, formulas, the AHP weights and the trend, then the order plan for 50 t.
3. **Inventory Forecast:** show the CRITICAL scrap and the FeSi-75 reorder. Open the calculation steps, raise a PR, approve it as manager, and receive it.
4. **Raw Material Stock / Yard Inspection:** run a gun inspection (the inspection sample size follows the supplier grade), then DRI QA with maker and checker.
5. **Pre-Melt Gate:** build a heat and run the gate. Show the predicted chemistry, uncertainty, WARN/HOLD reasons, additions and the energy snapshot. On a HOLD, show the "energy avoided".
6. **Energy per Heat:** the heat's kWh/t versus the baseline, the drivers, the tariff band, CO₂ and the plant savings.
7. **AI Analysis:** Composition Deviation Analysis → Melt Correction Planner → Adaptive Strategy Optimizer. Accept Balanced; stock is deducted. Optionally show Full Analysis with the strategy lock and the AI Agent reading its explanation aloud.
8. **Mechanical Properties:** predicted UTS, YS, elongation and hardness, then approve the tap.
9. **Sales & Dispatch:** test certificate, GST invoice, margin per heat, and the returns lot back in stock.
10. Close with Cost Analysis and Semantic Search.

## 17. Future production hardening

- Secrets in a manager; rotate the exposed credentials.
- **Role-based access control:** per-role page access (Stores, QA lab, Melt shop, Metallurgist/engineer, Purchase manager, Sales, Admin), server-side enforcement, maker-checker by user identity, restricted CORS.
- A database for lots, heats, audit, PRs, invoices, energy actuals and settings.
- Real energy-meter integration (Modbus/OPC UA) and live tariff schedules.
- ERP, GST e-invoice and e-way bill integration; a supplier portal.
- Validation, rate limiting, structured logs, tracing and metrics.
- Certified instrument drivers and device security.
- Versioned datasets and models, with provenance for every recommendation.
- Plant calibration of chemistry, energy, scorecard and inventory parameters.
- End-to-end and contract tests; health probes, retries and circuit breakers.

## 18. Related documentation

- [TORUN.md](TORUN.md): startup guide, and the voice/key check.
- [PREMELT_GATE_MASTER_PLAN.md](PREMELT_GATE_MASTER_PLAN.md): pre-melt requirements, chemistry, checks, gun simulator, API, demo and limits.
- `MetalliSense_Backend_Simple/premeltGate/README.md`: pre-melt implementation notes.
- `MetalliSense_VectorSearch/README.md`, `VECTORSEARCH_README.md`: semantic search.
- `MetalliSense_Agent_R/MetalliSense_Agent/DOCS/`, `MetalliSense_AI_R/MetalliSense_AI/DOCS/`: service documentation.

## 19. One-sentence operating principle

MetalliSense follows every heat from the supplier's truck to the customer's invoice. It ranks who to buy from, forecasts what to buy, stops a bad charge before power is spent, corrects the melt, proves its properties and bills it, while the final production decision, the pre-melt interlock and the physical furnace action stay under human control.
