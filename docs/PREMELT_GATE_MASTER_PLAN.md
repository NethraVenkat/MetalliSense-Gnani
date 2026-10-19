# MetalliSense — Raw Material Stock + Pre-Melt Gate

## The idea

Today a raw material problem shows up only when the first spectrometer
reading comes back after melting. By then the energy, time and metal are
spent, and the only fixes are dilution or downgrading the heat.

MetalliSense now checks the charge **before** the furnace starts:

> Nothing goes into the furnace unless the system knows where it came from,
> what it contains, and how sure we are about that.

Four new parts sit in front of the existing system:

| Part | What it does | Who uses it |
|---|---|---|
| Raw material stock | Every lot of scrap, pig iron, returns and sponge iron from weighbridge to furnace, with a stock ledger | Stores, QA |
| Alloy additive inventory | FeSi, FeMn and recarburiser lots with certificate chemistry; the AI's additions are turned into kg from these lots | Melt shop |
| DRI QA lab entry | QA engineer types the sponge iron lab result on the stock dashboard; a second person approves it | QA engineer + QA head |
| Handheld XRF/LIBS gun simulator | OPC UA simulator (like the spectrometer one) that streams yard readings piece by piece | Yard inspector |
| Pre-Melt Gate | Predicts the melt chemistry of the charge, runs the checks and the AI, returns GO / WARN / HOLD, and locks **Start melting** | Furnace operator, engineer |

The existing spectrometer, anomaly detection, alloy recommendation, RL
optimizer and cost modules are unchanged.

## How much each data source is trusted

| Source | Trust (1σ) | Used for |
|---|---|---|
| Supplier declared | 15% of value | Starting value for scrap and untested sponge iron |
| Mill certificate | 6% | Pig iron, ferroalloys |
| QA lab (approved) | 3% | Sponge iron: metallization, C, P, S |
| Parent heat OES | 3% | Foundry returns inherit the final chemistry of the heat they came from |
| Handheld XRF/LIBS | Flags only | Accept, restrict or quarantine a scrap lot. **Never averaged into lot chemistry** — a few surface spots cannot represent a 20-tonne load |

## End-to-end workflow

```
TRUCK ─► weighbridge ─► Receive truck (GRN) ─► lot created, stock ledger RECEIPT
             │
             ├─ Steel / CI scrap ─► AWAITING_QA ─► Yard Inspection (XRF/LIBS over OPC UA)
             │                         ─► RELEASED / RESTRICTED (max % of charge) / QUARANTINED
             │                            / inconclusive (paint, oil, rust → clean and re-test)
             │
             ├─ Sponge iron (DRI) ─► AWAITING_QA ─► QA engineer enters lab result ─► PROVISIONAL
             │                         ─► second person approves ─► release rules
             │                         ─► RELEASED / RESTRICTED / QUARANTINED
             │
             ├─ Pig iron, ferroalloys ─► RELEASED on certificate
             └─ Foundry returns ─► RELEASED with parent heat chemistry

HEAT PLAN ─► pick grade + lots + kg
PRE-MELT CHECK ─► predicted melt-down chemistry ± uncertainty
                ─► 8 checks + AI risk + AI alloy additions (kg from in-stock lots)
                ─► GO / WARN / HOLD
START MELTING (interlock)
    GO    ─► starts
    WARN  ─► operator ticks "I have read these warnings"
    HOLD  ─► locked; only an engineer override with a written reason (logged)
    Charge changed or check older than 30 min ─► must re-check
    ─► stock deducted (ledger CHARGE), heat MELTING
SPECTROMETER (existing OPC UA) ─► first melt-in reading, as before
```

## The checks

| # | Check | FAIL (→ HOLD) | WARN |
|---|---|---|---|
| 1 | Charge weight | Empty charge | More than ±5% from target |
| 2 | Lot release status | Lot not tested, provisional, quarantined, rejected; restricted lot over its % limit | Restricted lot within limit |
| 3 | Stock available | Not enough kg | — |
| 4 | Handheld XRF/LIBS | Scrap never inspected, or failed | Flagged pieces (restricted) |
| 5 | Sponge iron lab | No approved result | Result older than 7 days, or wet (moisture > 1%) — re-oxidation |
| 6 | Predicted chemistry vs grade | Any element above maximum (an induction furnace cannot remove it) | C/Si/Mn below minimum (needs addition), or ±2σ band crosses a limit |
| 7 | Residuals Cu, Cr, Ni, Mo, Sn | Above limit | Above 80% of limit |
| 8 | AI off-spec risk | Risk ≥ 50% **after** the recommended additions, or AI unavailable (fail-safe) | Risk 25–50% after additions, or the charge needs additions to reach spec |

Every threshold is in `MetalliSense_Backend_Simple/premeltGate/config.js`
(or `PATCH /api/v2/premelt/config`). The demo values are illustrative.

## How the melt-down chemistry is predicted

For each lot in the charge:

- **Metal it gives** = kg × metal yield (scrap 95%, pig iron 97%, returns 98%,
  ferroalloy 90%). For sponge iron the yield is calculated from the lab result:
  metallic Fe, plus FeO reduced by the DRI's own carbon (12 kg C frees 56 kg Fe),
  less half of the fines. Gangue goes to slag; P and S stay in the metal.
- **Bath chemistry** = metal-weighted average of each lot's best-known chemistry,
  with melting losses (C 4%, Si 5%, Mn 7%).
- **Uncertainty** = each lot's trust level combined, plus 2% process variation.
- **Fe** is the balance element and is never checked against a limit.

The gate also reports which lot each element comes from ("P 0.07% — 68% from CIS-0915").

## The AI part

New endpoint on the Agent service (`:8001`): `POST /premelt/assess`

1. **Charge risk model** (new): one gradient-boosted classifier per grade,
   trained on `dataset.csv` (`is_deviated` labels) with C, Si, Mn, P, S.
   Holdout AUC 0.95–0.97. It samples the prediction 400 times inside its
   uncertainty, so a charge backed only by supplier declarations scores riskier
   than the same numbers backed by lab results.
2. **Alloy Correction Agent** (existing model): what to add (C, Si, Mn only).
3. **Risk again after those additions.**

If the risk stays high after correction, additions cannot save the heat — the
charge must change. That is the core decision the gate makes.

Why not the existing Anomaly Detection Agent: it is one Isolation Forest across
all grades, built to spot spectrometer drift. It scores *normal* SG iron at 0.58
and normal grey iron at 0.77 (HIGH), so it cannot judge a charge for a grade.

## Handheld gun simulator (OPC UA)

`opc.tcp://localhost:4335/MetalliSense/HandheldGun` — started with the backend,
next to the spectrometer simulator on 4334.

- The backend's OPC UA client writes `Gun.Command`; the server "shoots" pieces
  one by one (every 350 ms) and publishes `Gun.LastReading`, `Gun.PiecesDone`,
  `Gun.ReadingsCsv`, `Gun.Status`, `Gun.ArgonRemaining`.
- Each scrap lot is a hidden pile of 400 pieces: clean, copper-contaminated,
  stainless mixed in, painted/dirty, or wrong grade. The inspector samples N
  pieces, so a bad lot can slip through — realistic, and the reason the
  spectrometer check still follows.
- Device limits: XRF reports no carbon and "<LOD" for low Si/P/S; LIBS measures
  carbon, needs grinding and uses one argon test per piece (150 per canister).
- Output is the CSV format a real gun exports (also saved to
  `premeltGate/gun_exports/`). A real gun's CSV can be uploaded to
  `POST /api/v2/premelt/gun/ingest-csv` — the same rules apply.
- A lot quarantined by the gun stays quarantined even if a later shot passes.
  Only a named QA decision with a reason can release it.

## DRI QA entry (stock dashboard)

Fields: Fe total, Fe metallic, C, P, S (required); SiO₂, Al₂O₃, CaO, MgO,
moisture, fines; method; analyst. Calculated: metallization, equivalent
metallization (+5 × C).

- Hard checks: Fe metallic ≤ Fe total, no negatives, plausible ranges.
- Soft checks (must confirm): far from the supplier's declaration, metallization < 70%.
- Maker–checker: the approver must be a different person. Until approved the
  lot is PROVISIONAL and cannot be charged.
- Release rules: metallization ≥ 85% released, 80–85% restricted to 25%, < 80%
  quarantined; P > 0.05% restricted to 25%, > 0.08% quarantined; S > 0.03%
  restricted to 30%, > 0.05% quarantined.
- Results are never deleted; a re-test is a new version.

## Files added / changed

```
MetalliSense_Backend_Simple/
  server.js                       + mounts /api/v2/premelt, starts gun OPC UA server
  premeltGate/
    config.js         thresholds, grade + residual limits, trust levels
    store.js          lots, stock ledger, QA, gun sessions, heats, audit, seed data
    chemistry.js      DRI metal yield, melt-down prediction with uncertainty
    gunSimulator.js   piece-level load model, XRF/LIBS limits, CSV export
    gunOpcuaServer.js OPC UA server for the gun (port 4335)
    gunService.js     OPC UA client, live session buffer
    gunIngest.js      CSV → piece flags → lot decision
    driQa.js          lab entry, validation, maker–checker, release rules
    additives.js      AI additions → kg from in-stock ferroalloy lots
    gateEngine.js     checks, AI call, GO/WARN/HOLD, start-melting interlock
    routes.js         REST API
MetalliSense_Agent_R/MetalliSense_Agent/app/
  main.py                          + /premelt/assess, /premelt/model/status
  premelt/                          risk model, assessor, schemas
  training/train_premelt_risk.py
  models/premelt_risk_model.pkl     (retrained automatically if missing)
MetalliSense_Frontend_R/MetalliSense_Frontend/src/
  pages/RawMaterialStock.jsx        stock dashboard, receive truck, DRI QA entry/approval, additives
  pages/YardInspection.jsx          gun connection, live readings, decision, CSV upload
  pages/PreMeltGate.jsx             heat planning, charge, checks, AI panel, furnace interlock
  services/premeltService.js
  components/premelt/premeltUi.jsx
  App.jsx, Sidebar.jsx, MainLayout.jsx  + routes and "Raw Material & Pre-Melt" menu
```

## API (base `/api/v2/premelt`)

| Area | Endpoints |
|---|---|
| Stock | `GET /summary`, `GET /lots`, `GET /lots/:id`, `POST /lots`, `PATCH /lots/:id/status`, `POST /lots/:id/adjust`, `GET /movements`, `GET /additives` |
| DRI QA | `POST /lots/:id/dri-qa`, `GET /dri-qa`, `POST /dri-qa/:qaId/approve`, `POST /dri-qa/:qaId/reject` |
| Gun | `GET /gun/status`, `POST /gun/connect`, `POST /gun/disconnect`, `POST /gun/inspect`, `GET /gun/live`, `POST /gun/ingest-csv`, `GET /gun/sessions`, `GET /gun/sessions/:id/csv`, `POST /gun/argon/replace`, `GET /gun/scenarios` |
| Heats + gate | `GET /heats`, `POST /heats`, `GET /heats/:id`, `PUT /heats/:id/charge`, `POST /heats/:id/gate-check`, `POST /heats/:id/start-melting` |
| Misc | `GET/PATCH /config`, `GET /audit`, `POST /demo/reset` |

`start-melting` answers 428 (run the check / acknowledge warnings), 423 (HOLD —
locked), 409 (charge changed or check expired) or 200 (started, stock deducted).

## Run it

```bash
# 1. Agent service (:8001) — trains the pre-melt risk model on first start if the .pkl is missing
cd MetalliSense_Agent_R/MetalliSense_Agent && python app/main.py
# 2. AI service (:8000) as before
# 3. Backend (:3000) — also starts spectrometer OPC UA (:4334) and gun OPC UA (:4335)
cd MetalliSense_Backend_Simple && npm install && npm start
# 4. Frontend
cd MetalliSense_Frontend_R/MetalliSense_Frontend && npm install && npm run dev
```

Frontend `.env`: `VITE_API_BASE_URL=http://localhost:3000/api/v2`.
Data is in memory like the rest of this backend; **Reset demo data** on the
Pre-Melt Gate page restores the starting point.

## 3-minute demo script (seed data)

1. **Raw Material Stock** — 4 alerts: three scrap trucks and one sponge iron lot waiting.
2. **Yard Inspection** → SCR-0913 (HMS), XRF, 15 pieces → copper pieces light up
   one by one → **Quarantined: copper contamination**.
3. CIS-0915 (painted castings) → XRF → *Inconclusive, clean and re-test* → tick
   "surfaces cleaned" → re-test.
4. **Stock** → DRI-0917 → *Enter lab result* (Fe total 90.6, Fe metallic 81.2,
   C 0.16, P 0.052, S 0.019) → approve as a different person → **Restricted, max 25%**.
5. **Pre-Melt Gate** → H-1051 → *Run pre-melt check* → **WARN**: Si and Mn low;
   AI: risk 100% as charged, ~4% after additions; 11.9 kg FeSi-75, 7.2 kg FeMn,
   2.4 kg recarburiser from stock → *Add these to the charge* → re-check → **GO**
   → *Start melting* → stock deducted.
6. Plan a heat with PIG-0901 + SCR-0913 → **HOLD** (quarantined lot, AI risk) →
   *Start melting — locked*.
7. Close: *"This was caught at the gate, minutes after the truck arrived — not
   hours later in the furnace."*

## Honest limits (say these before the jury asks)

- The gun screens; it can miss a contaminated piece. That is why the
  spectrometer melt-in check stays.
- Real guns export CSV/Bluetooth/cloud, not OPC UA. The simulator uses OPC UA to
  match the spectrometer setup, but its output is the real CSV format, and real
  CSVs can be uploaded today.
- The AI is trained on the synthetic dataset. Its Fe values for irons (~86%) are
  not a real balance (~93%), so the gate treats Fe as balance and neutralises
  it for the alloy model.
- Limits, yields and recoveries are illustrative defaults for the plant to set.
- Data is in memory (like the rest of the Simple backend) — a restart resets it.

## Next steps

- Re-run the gate on every mid-melt addition (induction furnaces are charged progressively).
- Weigh actual charged kg at the bucket, not the plan.
- Compare each gate prediction with the first spectrometer reading and use the
  error to correct supplier chemistry (melt-in learning).
- Persist to MongoDB.
