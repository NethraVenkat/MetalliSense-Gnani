# F13 step 0 — voice everywhere inventory and plan

2026-10-31, Asia/Calcutta. Owner: Nethra. Repository-source inventory only; no implementation, provider calls, browser operation or commit. Only this document is added for F13. Paths below are relative to `MetalliSense_Frontend_R/MetalliSense_Frontend` unless stated otherwise.

## Scope and evidence

Authoritative route inventory: `src/App.jsx`. There are **21 content routes nested under ProtectedRoute**, two public authentication routes, and the `/` redirect in that layout. **ProtectedRoute currently returns children directly; every route is open in this no-auth build.** `/charge-optimizer` exists only in mock mode. Mock routing uses HashRouter; the other build uses BrowserRouter. No catch-all route is declared. Query-selected heats/lots/drawers/tabs are workflows within these routes, not additional routes.

Read sources: `src/pages/*.jsx`, `src/context/{OPCContext,GradeContext,MeltFlowContext,AuthContext}.jsx`, services listed below, `src/mock/server.js`, `src/mock/handlers/server.js`, `src/mock/handlers/ai.js`, and `src/mock/handlers/premeltGate/{routes,store,insightsRoutes,energy,supplierScorecard,inventoryRoutes,inventory,salesRoutes}.js`. Findings describe checked-in code, not measured production API availability. No mock endpoints were called during inventory: even GET dispatch persists browser state, and some energy reads lazily populate derived data.

Mock notation: **Y** = browser handlers/data exist; **conditional** = result needs an existing manual workflow or selection; not a claim of live hardware/model equivalence. Service `api` paths normally have `/api/v2` prepended. Page-local field paths below refer to unwrapped response/state objects. Important: “protected” describes the route nesting, not proven authorization: the current AuthContext is a Guest stub, login/signup return that user without network calls, and real role enforcement must be checked before sensitive voice data is exposed.

## Complete route and workflow inventory

| Path | Component / workflow | Shows | Existing read source | dev:mock coverage / caveat |
|---|---|---|---|---|
| `/` | ProtectedRoute → MainLayout → Navigate | Redirects to Dashboard | AuthContext; no separate operational data | Y; no independent page |
| `/dashboard` | Dashboard | OPC status, grade count, reading/anomaly tiles, training visualizations | OPCContext, GradeContext; trainingDataService.getTrainingDataVisualizations; mock GET `/__mock/state` | Y; production reading/anomaly tiles are constants 1234/12; weekly/activity/distribution fixtures must not become facts |
| `/premelt-gate` | PreMeltGate | Heat selection/charge, predicted chemistry, checks, HOLD/WARN/GO, audit, manual start/override; flag-gated ShiftHandover | premeltService.getHeats/getHeat/getLots/getPremeltConfig/getAudit; premeltGate store | Y; Reset heats are initially unchecked; H-1053 becomes HOLD only after manual check |
| `/raw-material-stock` | RawMaterialStock | Stock summary, lot drawer, movements, QA, additive stock, receiving/status forms | premeltService.getStockSummary/getLots/getLot/getMovements/getAdditives; inventoryService.getPurchaseRequest | Y; chemistry/provenance and availability vary by lot state |
| `/yard-inspection` | YardInspection | XRF/LIBS status/live pieces, lot selection, inspection decisions, session history, CSV workflow | premeltService.getGunStatus/getGunLive/getGunSessions/getLots/getLot; instrument simulator + sessions store | Y; live fields require a manually started inspection; connect/inspect/import/release are writes |
| `/spectrometer` | Spectrometer | OPC connection, latest chemistry, reading history | OPCContext; spectrometerService.getAllReadings | Y; browser instrument simulator; request-reading/connect/delete are actions, not voice reads |
| `/grades` | GradeSpecs | Grade list/detail, composition ranges, physical properties, application list; CRUD forms | gradeSpecService.getAllGradeSpecs/getGradeSpecById; `/grades` | Y; these specs are not automatically identical to every separate gate-config range |
| `/supplier-scorecard` | SupplierScorecard | QCDS/rank/grade, evidence drawer, alerts, AHP/weights, order split | insightsService.getSupplierScorecard/getSupplierDetail/getSupplierAhp/getOrderPlan/getSupplierAlerts | Y; source-dependent coverage and NEW grades; edits/apply weights prohibited |
| `/energy` | EnergyDashboard | Summary, per-heat prediction/actual meter, drivers, tariff scenarios, modelled savings; actual-entry/simulate | insightsService.getEnergySummary/getEnergyForHeat/getEnergyConfig; energy module | Y; predicted vs metered vs hypothetical savings must be distinguished; GET may lazily derive state |
| `/inventory-forecast` | InventoryForecast | Forecast/items/detail, stock-out, reorder suggestions, supplier comparison, purchase-request drawer | inventoryService.getInventoryForecast/getInventoryItem/getPurchaseRequests/getPurchaseRequest/getReorderSuggestions | Y; forecast not a promise; create/approve/receive PR are writes |
| `/sales` | SalesInvoices | Finished heats, certificate, customers, invoices, financial totals; invoice/print workflow | salesService.getFinishedHeats/getInvoices/getCustomers/getCertificate | Y; finished/certificate may need manually completed heat; customer/private financial details need role policy |
| `/cost-analysis` | CostAnalysis | Element/base prices and latest cost-history entries; editor | costService.getPrices/getCostHistory | Y; configured prices, not verified current market feed; do not save prices or run estimate by voice |
| `/anomaly` | AnomalyDetection | Generated/gate reading, deviation severity/score/compliance, explanations/chat | aiService.predictAnomaly; copilotService.getExplanation; local analysisResult; MeltFlowContext | Y, conditional existing result; prediction POST can cause alerts/history, so speak loaded result only |
| `/recommendation` | Recommendation | Composition, suggested alloy additions, confidence, alternate grades, explanation/chat | aiService.analyzeIndividual; local result.aiAnalysis; MeltFlowContext | Y, conditional existing result; suggestions are not approved quantities |
| `/rl-optimizer` | RLOptimizer | Candidate strategies, rewards, cost/comparison, policy state; acceptance/rejection feedback | rlService.rlPolicyStatus; existing rlOptimize response; MeltFlowContext | Y, conditional candidates; accept can deduct stock, feedback trains/records state; neither allowed |
| `/full-analysis` | FullAnalysis | Existing anomaly → alloy → RL → cost/carbon result and root-cause hint; strategy acceptance | workflowService.runFullAnalysis response in local result.steps; MeltFlowContext | Y, conditional manually run result; workflow POST makes derived history/audit; no voice rerun |
| `/mechanical-properties` | MechanicalProperties | Predicted UTS/YS/elongation/hardness, quality/reference/CE, tap/completion workflow | existing POST `/api/v2/mechanical/predict` result; MeltFlowContext.flow.mechResult; salesService.getFinishedHeats | Y; deterministic formula mock, not Python model equivalence or physical test certification; read loaded prediction only |
| `/agent` | AIAgent | Combined agent anomaly/alloy/quality output, final recommendation, explanation audio | aiService.analyzeAgent/explainResult response in local result.aiAnalysis | Y, conditional existing result; generated narrative is not verified gate authority |
| `/synthetic` | SyntheticData | Test reading, grade/deviation, temperature/pressure, composition | SyntheticGenerator callback → local generatedReading; synthetic service path through opcService | Y, conditional generated test reading; not factory measurement; generation may persist data |
| `/training-data` | TrainingData | Paginated/filtered readings and metadata, data-management forms | trainingDataService.getPaginatedTrainingData/getTrainingDataByGrade; gradeSpecService | Y; corpus/pagination, not current shift totals; CRUD prohibited |
| `/semantic-search` | SemanticSearch | Existing query/collection + ranked text matches | semanticSearchService.semanticSearch → local results; `/semantic-search` on vector service | Y via browser TF-IDF, not live VectorAI equivalence; live service typically :8002; reindex prohibited |
| `/charge-optimizer` | mock/ChargeOptimizer | Feasibility, mix candidates, cost/risk, lot kg; Use this mix | manually executed POST `/__mock/optimize` → local result; premeltGate stock/config/chemistry | Y **mock-only route**; optimize logs recommendation; Use mix creates heat; both outside read-only voice |
| `/login` | Login | Authentication form/loading/error | AuthContext/useAuth; form-local email/password/loading | Mock auth path exists, but outside protected layout; operational data must not be exposed before authentication |
| `/signup` | SignUp | Registration form/loading/error | AuthContext/useAuth and form-local state | Mock auth path exists; no operational voice scope; registration is a write |

Embedded/non-route workflows: lot detail/DRI QA/ferroalloy receipt under Stock; inspection sessions under Yard; gate start/override/audit and F7 handover under Pre-Melt; supplier evidence/AHP/order split; energy heat/tariff tabs; inventory PR approval/receipt; sales invoice/certificate/print; mechanical tap/completion; chat drawers and synthetic input panels in analysis pages. Voice may describe already-present data in these workflows but cannot submit them. F7 recording/upload invokes Batch STT and is not a free read to trigger as a question.

## Existing voice inventory and placement

Source: `src/services/{voiceIntents,voiceTranscript,voiceGateAnswers,shiftSummary}.js`, `src/components/voice/PushToTalk.jsx`, `src/components/common/AIChatInterface.jsx`.

| Existing intent/behavior | Present scope and data | Page specificity |
|---|---|---|
| `blocked` | Safety checked before every positive intent; approval/confirm/release/deduct/melting/override/invoice/delete and bridge action phrases refused | Global safety, not an action intent |
| `heat_status` | resolveHeat → premelt heat status + gate decision | Pre-Melt data, can answer globally by explicit heat; currently selected heat passed only by PreMeltGate |
| `gate_reason` | Existing HOLD/WARN checks; two spoken reasons; Tamil optional validated Evon path, Hindi templates | Pre-Melt data; no authority to recompute gate |
| `element_value` | Heat gate predicted composition and limits, existing C/Si/Mn/P/S aliases plus bridge Cu/Cr/Ni/Mo | Pre-Melt source today; **not** automatically current spectrometer chemistry |
| `stock_check` | getAdditives → alloyName/availableKg/lowStock; FeSi/FeMn/recarburiser or all additives | Cross-page but additive inventory only, not every raw-material type |
| `open_screen` | Dashboard, Pre-Melt, Spectrometer and Stock paths; e.g. spectrometer kaattu | Global navigation; no aliases for every route yet |
| `shift_summary` | VITE_SHIFT_SUMMARY; fresh heat reads; HOLD/WARN/GO/melting/unchecked, completed exclusion and first priority reason | Global summary of Pre-Melt store, not cross-module briefing or calendar shift history |
| `ask_copilot` with `bridgeAction: list_holds` / `help` | F2 bridge aliases; Hindi read-only hold list/help in current handler | Heat-domain helper, not distinct intent names |
| `ask_copilot` fallback | Unknown/no-heat requests usually get friendly retry before legacy chat branch; not a dependable arbitrary page query engine | No existing general page-aware answering |
| Automatic HOLD alert | PreMeltGate + holdAnnouncer, template speech, optional bilingual behavior | Event-driven alert, not an intent |
| F7 summary / F10 Latin display / hands-free | Separate existing flows or display adapters; same normal-transcript answer handler | Not new routed intents; do not reinterpret Latin display as command source |

Direct panel mounts: Dashboard, Spectrometer, PreMeltGate (heatId prop). AIChatInterface embeds another panel; it is used by analysis/chat UI and is not a universal shell mount. MainLayout currently has no panel. VITE_SHOW_VOICE_PANEL can suppress mounting entirely. A shell proposal must avoid duplicate mic sockets/Space listeners and preserve this flag, mute, queue, echo guard, language/clarity/register behavior and safety order.

## Proposed read-only questions and exact answering fields

Each row is one question in **Tamil/Tanglish / Hindi/Hinglish / English**. Two questions per routed content page; these are proposals, not added aliases. **Available** means a field exists now; **conditional** means no answer until that page has a legitimate loaded result. Do not fabricate missing values or run a write to obtain them. Explicit heat/lot selection wins over ambient page context; ambiguous references need clarification. No new numerical parser or gate comparisons are proposed.

| Page | Example question (ta / hi / en) | Exact existing answer field | Available today? |
|---|---|---|---|
| Dashboard | இப்போ எத்தனை ஹோல்ட்? / Abhi kitne heat hold par hain? / How many heats are on hold? | buildShiftSummary(current heats).counts.HOLD and priorityId; heat.gateResult.decision/status/expiry | Yes, reuse F9 freshness/melting rules; not the Dashboard anomaly tile |
| Dashboard | OPC connected ஆ? / OPC connected hai? / Is OPC connected? | OPCContext.opcStatus.connected, lastSeen, status | Yes, after status poll; stale/disconnected reported explicitly |
| Pre-Melt | Heat 1053 நிலை என்ன? / Heat 1053 ka status kya hai? / What is heat 1053's status? | heat.status, heat.gateResult.decision, validUntil | Yes; missing/expired check is not GO |
| Pre-Melt | ஏன் ஹோல்ட்? / Hold kyun hai? / Why is it on hold? | heat.gateResult.checks[].status/details, blocking | Yes after check; existing templates reused |
| Stock | PIG-1053 இருப்பு எவ்வளவு? / PIG-1053 kitna stock hai? / How much PIG-1053 is available? | getLots rows[].lotId/availableKg/status; getLot detail.lot | Yes; distinguish physical availability from permitted use |
| Stock | FeSi stock கம்மியா? / FeSi stock kam hai? / Is FeSi stock low? | getAdditives rows[].alloyName/availableKg/reorderLevelKg/lowStock | Yes, existing voice covers much of it |
| Yard | எத்தனை பீஸ் செக் ஆச்சு? / Kitne pieces check hue? / How many pieces have been checked? | live.piecesDone, live.piecesPlanned, live.status | Conditional active inspection; otherwise no active session |
| Yard | இந்த லாட் ஏன் நிறுத்தப்பட்டது? / Is lot ko kyun roka? / Why was this lot held? | live.result.decision.status/reason; selected session.result/decision as exposed | Conditional finished inspection; cite selected session, not another lot |
| Spectrometer | கடைசி carbon reading என்ன? / Aakhri carbon reading kya hai? / What is the latest carbon reading? | latestReading.composition.C (flat C fallback), timestamp or createdAt | Conditional recorded reading; don't substitute gate prediction |
| Spectrometer | எத்தனை readings இருக்கு? / Kitni readings hain? / How many readings are loaded? | readings.length from getAllReadings | Yes; loaded response count, not claimed lifetime count if API truncates |
| Grades | SG-IRON carbon range என்ன? / SG-IRON carbon range kya hai? / What is SG-IRON's carbon range? | selected spec.composition_ranges.C[0], C[1], spec.grade | Yes; grade-spec source named, not assumed gate-config equivalence |
| Grades | இந்த grade standard என்ன? / Is grade ka standard kya hai? / What standard does this grade use? | selected spec.standard, description | Yes; absent standard → unavailable |
| Supplier | இந்த material top supplier யார்? / Is material ka top supplier kaun hai? / Which supplier ranks first for this material? | scorecard.suppliers[] filtered materialType, rank, supplier, score, grade | Yes; existing rank only, not an instruction to buy |
| Supplier | இந்த supplier ஏன் grade C? / Is supplier ka grade C kyun hai? / Why is this supplier grade C? | selected supplier.grade/score/coverage; criteria[].label/score/evidence | Yes where evidence exists; NEW/no-data not treated as bad |
| Energy | இந்த heat energy estimate எவ்வளவு? / Is heat ki energy estimate kitni hai? / What is this heat's predicted energy? | getEnergyForHeat result.kwh, kwhPerT, heatId | Yes for nonempty charge; explicitly prediction |
| Energy | meter actual எவ்வளவு? / Meter ka actual kitna hai? / What was the actual metered energy? | summary.heats[].actualKwh, actualKwhPerT; totals.meltedWithMeter | Conditional meter record; never synthesize an actual |
| Inventory | FeSi எத்தனை நாள் வரும்? / FeSi kitne din chalega? / How many days of FeSi cover remain? | forecast.items[].item/coverDays/stockOutAt/demandBasis/lowHistory | Yes, forecast with assumptions, not guarantee |
| Inventory | critical items எத்தனை? / Kitne items critical hain? / How many items are critical? | forecast.summary.critical, reorder; items[].status/statusReason | Yes; reading suggestion does not create PR |
| Sales | invoice total எவ்வளவு? / Is invoice ka total kitna hai? / What is this invoice's total? | selected invoice.invoiceId/total/taxable/cgst/sgst/igst | Conditional existing invoice; no customer identifiers spoken by default |
| Sales | இந்த heat certificate இருக்கா? / Is heat ka certificate hai? / Is this heat's certificate available? | getCertificate result.heatId/certificateNo; existing chemistry/property rows.value/min/max/pass | Conditional completed record; certificate availability isn't new certification |
| Cost | silicon price என்ன? / Silicon ka configured price kya hai? / What is the configured silicon price? | prices.elementPrices.Si | Yes; configured price, not live market price |
| Cost | இந்த grade base cost என்ன? / Is grade ka base price kya hai? / What is this grade's base-metal price? | prices.baseMetalPrices[selectedGrade] | Yes if present; no price edits |
| Anomaly | severity என்ன? / Severity kya hai? / What is the displayed severity? | analysisResult.severity, anomaly_score | Conditional manually loaded result; not gate decision |
| Anomaly | compliance எவ்வளவு? / Compliance kitni hai? / What is the displayed compliance? | analysisResult.compliance.overallCompliance, summary.compliant/total | Conditional; missing field remains unavailable |
| Recommendation | carbon suggestion எவ்வளவு? / Carbon addition suggestion kitna hai? / What carbon addition is suggested? | result.aiAnalysis.alloyRecommendation.recommended_additions.C | Conditional; preserve existing units and identify suggestion |
| Recommendation | alternate grades என்ன? / Alternative grades kya hain? / Which alternative grades are listed? | result.aiAnalysis.alloyRecommendation.alternative_grades[] | Conditional; do not select/change grade |
| RL | balanced strategy reward என்ன? / Balanced strategy ka reward kya hai? / What reward is predicted for balanced? | result.candidates[matching strategy].predicted_reward, strategy | Conditional candidates; model score, not expected profit |
| RL | policy எத்தனை updates? / Policy ke kitne updates hue? / How many policy updates are recorded? | rlPolicyStatus data.n_updates, fitted, avg_reward_last_100 | Yes; null average explicitly unavailable; no feedback |
| Full Analysis | anomaly result என்ன? / Anomaly result kya hai? / What is the anomaly result? | result.steps.anomalyDetection.severity/anomaly_score; anomalyAlloyError | Conditional loaded workflow; error reported, no rerun |
| Full Analysis | batch cost estimate எவ்வளவு? / Batch cost estimate kitna hai? / What is the batch cost estimate? | result.steps.alloyRecommendation.estimatedCost.totalBatchCost | Conditional existing estimate, not invoice/actual |
| Mechanical | tensile prediction எவ்வளவு? / Tensile prediction kitna hai? / What tensile strength is predicted? | result.predicted_uts_mpa, reference_standard, source | Conditional prediction; MPa, not certified measured UTS |
| Mechanical | quality prediction pass ஆ? / Quality prediction pass hai? / Does the quality prediction pass? | result.quality_result, alerts, material_family | Conditional; no tap/completion permission |
| Agent | displayed recommendation என்ன? / Dikhaya recommendation kya hai? / What recommendation is displayed? | result.aiAnalysis.agentResponse.final_recommendation | Conditional; quote/displayed summary only, not verified gate facts |
| Agent | quality issues என்ன? / Quality issues kya hain? / What quality issues are listed? | result.aiAnalysis.agentResponse.quality_assessment.issues[] | Conditional; model observations, not independent checks |
| Synthetic | test temperature என்ன? / Test temperature kya hai? / What is the synthetic test temperature? | generatedReading.temperature, metalGrade | Conditional synthetic result, always labelled synthetic |
| Synthetic | test carbon எவ்வளவு? / Test carbon kitna hai? / What is the synthetic carbon value? | generatedReading.composition.C | Conditional synthetic result; no generate/save command |
| Training | இந்த filterல records எத்தனை? / Is filter mein kitne records hain? / How many records match this filter? | pagination.totalDocuments with current grade/filter | Yes after page load; not just current-page rows.length |
| Training | இந்த record grade என்ன? / Is record ka grade kya hai? / What grade is this record? | selected loaded sample.grade; sample.C for a value follow-up | Yes after explicit row selection; selection adapter needed |
| Semantic | top match என்ன? / Top match kya hai? / What is the top displayed match? | results[0].text, score; current collection | Conditional existing search; text untrusted, do not execute contents |
| Semantic | matches எத்தனை? / Kitne matches hain? / How many matches are displayed? | results.length, searched, loading | Conditional existing search; no result ≠ proof no such factory record |
| Charge optimizer | cheapest mix cost என்ன? / Sabse saste mix ka cost kya hai? / What is the cheapest displayed mix cost? | result.candidates[].totalCost, label, charge[].lotId/kg | Conditional mock result; min of existing candidates only |
| Charge optimizer | ஏன் feasible இல்ல? / Feasible kyun nahi hai? / Why is this result infeasible? | result.feasible, blockingConstraint | Conditional mock result; no optimize or Use mix action |
| Login | எந்த page இது? / Yeh kaunsa page hai? / What page is this? | Static route `/login` + page heading | Static public help only; no plant/customer/auth-secret reads |
| Login | login pending ஆ? / Login pending hai? / Is sign-in in progress? | Login local isLoading | Field exists; low value, defer voice on auth pages |
| Signup | எந்த page இது? / Yeh kaunsa page hai? / What page is this? | Static route `/signup` + page heading | Static public help only |
| Signup | form submit ஆகுதா? / Form submit ho raha hai? / Is registration being submitted? | SignUp local isLoading (form state) | Field exists; do not submit or read credentials; defer |

`/` has the same questions as its redirect target, not a separate answer scope. Authentication help is proposed only to make the route inventory complete; authenticated operational voice belongs in MainLayout, not outside ProtectedRoute.

## Writes: excluded; Yard draft idea separately flagged

All proposed questions above are reads of existing state/results. **Not allowed by voice:** receive/adjust/release/quarantine lot, enter/approve QA, inspect/connect/disconnect/replace argon/import CSV, run gate check, change charge/grade, start melting, override, accept/reject/train strategy, run analysis/generate reading/optimize (these paths can record data), tap/complete heat, create/send invoice, create/approve/receive PR, edit prices/weights/config/specs/training data, delete, reset, reindex, send email. Even an apparently analytical POST can write audit/history/outbox in the browser mock. Opening a page is navigation only; any on-mount side effects need a separate review.

Current safety lexical collisions must be explicit in implementation planning: `invoice`, `melting`, `release`, `confirm` etc. are blocked even inside a read question. Thus the proposed invoice-total question is **data-ready but not mapper-ready** today. Do not bypass the global guard to implement a page adapter. Either use a nonblocked read phrase (e.g. “displayed total”) or obtain a separately reviewed, narrowly read-only intent design; action phrases must continue to refuse. Likewise scope “what does this result say?” rather than “release this lot”. No such safety change is made or authorized in this inventory.

**Separate future idea — Yard draft note (write-capable; NOT part of read-only F13):** dictate a visible unsaved draft observation for the selected lot/session. No store/API write or effect on lot/gate state until explicit manual review/save. Even a persistent local draft is a write and needs separate scope, storage/privacy design and tests. No existing draft-note service was identified. Estimate **4–6 additional hours**, unranked and unauthorized for implementation here.

## Proposed Dashboard morning briefing

Start with a short bounded snapshot: "Current plant snapshot" with retrieval time/source; not "this morning's production" unless an actual time filter is applied. Existing F9 has no shift-boundary definition. Independent API reads are not an atomic cross-module transaction.

| Safe number / priority | Exact source | Required qualification |
|---|---|---|
| HOLD/WARN/GO/melting/unchecked active heat counts; priority first HOLD else WARN | F9 buildShiftSummary; current heat.status/gateResult/validUntil/checks | Exclude completed; expired never GO; only saved check results; don't run checks |
| Additive low-stock count and FeSi available kg | `/premelt/additives`: filter lowStock; alloyName, availableKg | Physical stock vs usable/restricted status; no deduction |
| Quarantined lot count | `/premelt/lots`: count status === QUARANTINED; or summary.byStatus | State count, not a count of today's arrivals |
| Critical/reorder items and next forecast stock-out | `/inventory/forecast`: summary.critical/reorder/nextStockOut | Modelled cover/demand assumptions, not instruction to order |
| Supplier alerts / at-risk supplier count | `/insights/suppliers/scorecard`: alerts.length, suppliers filtered grade C/D | Include scoreWindowDays; no vendor name by default in brief speech; no procurement action |
| Actual-meter heat count and recorded kWh; optional predicted kWh | `/insights/energy/summary`: totals.meltedWithMeter/actualKwh/predictedKwh | Existing summary scope, not necessarily today's; never call simulated/modelled avoided energy cash savings |
| Finished heat / existing invoice count | `/sales/heats` and `/sales/invoices` list length, explicitly filtered timestamp if desired | Paginated/truncated data must be labelled loaded count; separate completion vs invoice; role restriction |
| OPC connected and latest reading age | OPCContext.opcStatus.connected/lastSeen; latest reading.timestamp or createdAt | Simulator label in mock; stale timestamp is not live telemetry |

Recommended first briefing: heat priorities + low-stock additives + critical forecast + OPC freshness. Add supplier/energy/sales as optional detail to keep speech short. Never read Dashboard's hard-coded 1234/12, decorative weekly chart/recentActivity or mock outbox anomaly count as real factory totals. `extra.outbox` anomaly subjects count demo notifications, not unique failed heats. Include section-level unavailable markers instead of substituting zero on network failure. Do not invent cross-module anomaly or production totals by summing overlapping models.

## Implementation plan and estimates (proposal only)

Shared prerequisite **12–18 engineering hours**, once: one authenticated shell-level panel; explicit page context contract (route/selection/source/as-of/loading/error); register/unregister page-local read snapshots; typed read-only answer adapters; multilingual aliases after global safety; explicit heat-vs-current-page disambiguation; stale/empty responses; preserve all feature flags and F2/F7/F9/F11 behavior; prevent duplicate chat-panel capture and stale-route replies; regression tests. Do not move page-local state into a new authoritative factory store just for speech. Use existing services for fresh reads where safe, and existing result snapshots for analyses. No generic unrestricted API executor or LLM decision layer.

Below are **incremental per-page engineering estimates after that prerequisite**, including two question adapters, ta/hi/en templates, source labels and focused tests; human pronunciation review and API/hardware outages are additional. Demo impact is a subjective 1–5 score; rank sorts impact / estimated hours, with operational usefulness breaking ties. These are planning estimates, not measured delivery times. No feature code is authorized by this document.

| Rank | Page | Hours | Demo impact / 5 | Impact/hour | Main risk |
|---:|---|---:|---:|---:|---|
| 1 | Pre-Melt `/premelt-gate` | 4 | 5 | 1.25 | Selected heat, expired checks; reuse rather than duplicate existing answers |
| 2 | Stock `/raw-material-stock` | 5 | 5 | 1.00 | Available vs released/usable; general stock intent currently additive-only |
| 3 | Spectrometer `/spectrometer` | 5 | 5 | 1.00 | Gate prediction vs live reading collision; missing/stale readings |
| 4 | Grades `/grades` | 4 | 4 | 1.00 | Grade-spec ranges may differ from gate config |
| 5 | Cost `/cost-analysis` | 4 | 3 | 0.75 | Configured prices are not a live market feed |
| 6 | Yard `/yard-inspection` | 7 | 5 | 0.71 | No active session; never start inspection/change lot status |
| 7 | Dashboard + morning briefing `/dashboard` | 9 | 5 | 0.56 | Hard-coded tiles; multi-source latency and no shared shift window |
| 8 | Inventory `/inventory-forecast` | 9 | 5 | 0.56 | Forecast assumptions; never turn suggestion into PR action |
| 9 | Energy `/energy` | 8 | 4 | 0.50 | Lazy derived reads, model vs meter, misleading savings scope |
| 10 | Supplier `/supplier-scorecard` | 8 | 4 | 0.50 | Partial evidence/NEW grades and material-specific ranking |
| 11 | Training `/training-data` | 4 | 2 | 0.50 | Filter/pagination vs corpus total, not shift activity |
| 12 | Synthetic `/synthetic` | 4 | 2 | 0.50 | No generated result; synthetic must always be labelled |
| 13 | Anomaly `/anomaly` | 9 | 4 | 0.44 | No loaded result; slow inference and side-effecting POST forbidden |
| 14 | Recommendation `/recommendation` | 9 | 4 | 0.44 | Units/suggestion vs approval; missing remote result |
| 15 | Mechanical `/mechanical-properties` | 9 | 4 | 0.44 | Prediction vs actual certification; mock formula limitations |
| 16 | Sales `/sales` | 7 | 3 | 0.43 | Role/privacy, missing certificate, invoice actions blocked |
| 17 | RL `/rl-optimizer` | 10 | 4 | 0.40 | Feedback/acceptance writes and candidate stock deductions |
| 18 | Full analysis `/full-analysis` | 10 | 4 | 0.40 | Multi-step partial errors, slow APIs; no automatic rerun |
| 19 | Charge optimizer `/charge-optimizer` | 8 | 3 | 0.38 | Route is mock-only; no production service contract |
| 20 | Agent `/agent` | 10 | 3 | 0.30 | Narrative may not be verified; no existing result after navigation |
| 21 | Semantic `/semantic-search` | 8 | 2 | 0.25 | Live :8002 unavailable; browser TF-IDF not VectorAI parity |
| Defer | Login `/login` | 2 | 0 | 0.00 | No plant voice before auth; static help only |
| Defer | Signup `/signup` | 2 | 0 | 0.00 | Registration is a write; no credentials in voice context |
| — | Root `/` | 0 | — | — | Redirect only; use Dashboard scope |

All 21 protected content routes have some browser mock implementation, but Charge Optimizer has no non-mock route and analysis/result pages are conditional. Real APIs/hardware were not probed. Mock handlers insert roughly 150–600 ms artificial delay per intercepted request, and production analysis wrappers can wait on remote services (e.g. 30 s per workflow subcall); a briefing must not serially invoke analyses. Saved page results can disappear on unmount, so retain only explicitly scoped snapshots and reject late replies after navigation. Cache source/as-of metadata, not unqualified facts indefinitely.

## Inventory verification

Compared all `<Route>` declarations in App.jsx against the route table; inspected service calls and page render fields for proposed answers; checked mock router mounts/fallbacks and found the mock-only route and Dashboard placeholders. No source, tests, configuration, seed, audio, API state or existing reports changed. No tests/build run for this document-only inventory. No live calls. No commit.

## F13a — Kural everywhere foundation

2026-10-31. Owner: Nethra. Branch `f13-voice-everywhere`. Implemented behind **VITE_VOICE_EVERYWHERE=false** by default. No live calls and no commit. The step-0 inventory above remains historical planning; page data adapters proposed there are **not** implemented by F13a.

### Placement and context

With the flag on, MainLayout mounts one persistent shared PushToTalk panel inside the existing content-route layout. All legacy page-level and chat-embedded PushToTalk wrappers return null before mounting the inner panel. Thus there is one mic owner, one panel Space listener and the existing module-level speech queue; the panel is not remounted as routes change. VITE_SHOW_VOICE_PANEL=false still suppresses the inner panel entirely. Login/Signup are outside the layout and receive no shared panel. ProtectedRoute remains the existing no-auth pass-through; this feature does not add authentication or claim access control.

With the flag off, MainLayout has no panel/provider, and the original Dashboard/Spectrometer/Pre-Melt mounts remain unchanged, as do legacy chat-embedded panels where those chats render. Existing wrappers are retained rather than deleted, preserving off-mode placement. No local env file was edited; the new flag is documented in the frontend `.env.example` and exposed by mock-mode envPrefix.

`VoicePageContext` is an ephemeral UI registry, not a factory store. Its snapshot contract is `{route, pageName:{ta,hi,en}, selected:{heatId?,lotId?,grade?,item?,invoiceId?}, source, asOf}` with internal registration/scope helpers. All 21 content components register/unregister source metadata. Existing selections are published by Pre-Melt, Yard, Stock, Grade Specs, Energy, Inventory, Sales, Training, synthetic/analysis pages and the existing unlocked melt-flow banners. Pages without a selected ID publish an empty selection. No chemistry, gate facts, customer details, free-form notes, factory setters or new API reads enter this registry. `asOf` means metadata registration time, not a fresh factory measurement.

Pre-Melt publishes its selected heatId, so the shared panel resolves an unnumbered existing heat question against that heat. Explicit heat numbers still take precedence over ambient selection and keep the existing answer path. The existing Pre-Melt holdAnnouncer effect and bilingual/alert ordering were left in place, using the existing shared speech module. No gate or seed changes.

### Navigation aliases

Navigation matching is flag-gated and follows the existing safety block. It requires a bounded page alias plus a navigation marker (`open/show/go/page/kaattu/po/dikhao/kholo`, native equivalents). Word order and punctuation do not matter. Existing normalized numerical heat slots, including spoken numbers, retain their old intents rather than being consumed as navigation. No login/signup target exists. The existing Hindi safety predicate is reused, without adding/removing words, to prevent newly recognized navigation from bypassing Hindi action refusal even when F2 is off. Existing F2/global answers and flag-off mapping retain their previous behavior.

| Route | English example | Tamil/Tanglish example | Hindi/Hinglish example |
|---|---|---|---|
| `/dashboard` | open dashboard | dashboard போ | डैशबोर्ड दिखाओ |
| `/premelt-gate` | open pre-melt | ப்ரீமெல்ட் காட்டு | प्रीमेल्ट दिखाओ |
| `/raw-material-stock` | open stock | stock page போ | स्टॉक दिखाओ |
| `/yard-inspection` | open yard inspection | யார்டு இன்ஸ்பெக்ஷன் காட்டு | यार्ड इंस्पेक्शन दिखाओ |
| `/spectrometer` | open spectrometer | spectrometer kaattu | स्पेक्ट्रोमीटर दिखाओ |
| `/grades` | open grades | கிரேட்ஸ் காட்டு | ग्रेड्स दिखाओ |
| `/supplier-scorecard` | open supplier scorecard | சப்ளையர் ஸ்கோர்கார்டு காட்டு | supplier scorecard kholo |
| `/energy` | open energy | எனர்ஜி காட்டு | energy dikhao |
| `/inventory-forecast` | open inventory forecast | இன்வென்டரி ஃபோர்காஸ்ட் காட்டு | इन्वेंटरी फोरकास्ट दिखाओ |
| `/sales` | open sales | சேல்ஸ் காட்டு | सेल्स दिखाओ |
| `/cost-analysis` | open cost analysis | காஸ்ட் அனாலிசிஸ் காட்டு | कॉस्ट एनालिसिस दिखाओ |
| `/anomaly` | open anomaly | அனாமலி காட்டு | अनॉमली दिखाओ |
| `/recommendation` | open recommendation | ரெக்கமெண்டேஷன் காட்டு | रेकमेंडेशन दिखाओ |
| `/rl-optimizer` | open RL optimizer | ஆர்எல் ஆப்டிமைசர் காட்டு | आरएल ऑप्टिमाइज़र दिखाओ |
| `/full-analysis` | open full analysis | ஃபுல் அனாலிசிஸ் காட்டு | फुल एनालिसिस दिखाओ |
| `/mechanical-properties` | open mechanical properties | மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ் காட்டு | मैकेनिकल प्रॉपर्टीज दिखाओ |
| `/agent` | open AI agent | ஏஐ ஏஜென்ட் காட்டு | एआई एजेंट दिखाओ |
| `/synthetic` | open synthetic data | சிந்தெடிக் டேட்டா காட்டு | सिंथेटिक डेटा दिखाओ |
| `/training-data` | open training data | ட்ரெயினிங் டேட்டா காட்டு | ट्रेनिंग डेटा दिखाओ |
| `/semantic-search` | open semantic search | செமான்டிக் சர்ச் காட்டு | सिमैंटिक सर्च दिखाओ |
| `/charge-optimizer` | open charge optimizer | சார்ஜ் ஆப்டிமைசர் காட்டு | चार्ज ऑप्टिमाइज़र दिखाओ |

Charge Optimizer is navigable **only in mock mode**, matching its actual App route. Safety-sensitive wording such as “melt correction planner” is not used to bypass the melt block; use “recommendation”. Likewise “open invoice” remains blocked; “open sales” is navigation only. Confirmations use the native page labels, e.g. `ஸ்டாக் பேஜ் திறக்குது`, `स्टॉक पेज खुल रहा है`, `Opening stock`. New navigation/help language detection is local to these new behaviors; REST F2 and single-locale hands-free STT behavior are unchanged.

### Page help and late replies

`இங்க என்ன கேக்கலாம்?`, `yahan kya pooch sakte hain?`, and `what can I ask here?` map to page_help only when the feature is on. Pre-Melt offers three existing heat/status/reason/element examples; Stock offers two existing additive-stock questions. Every other page currently says `இந்த பேஜ்ல navigation மட்டும் இப்போ` / `abhi sirf navigation` / `navigation only on this page for now`. These are page-adapter capabilities, not a removal of global explicit-heat/stock/F9 questions. No F13b answers or morning briefing are advertised or computed.

Each turn captures the route key/path/search scope. Navigation invalidates the previous heard/Latin/answer display, stops an active PTT recording, and resets the panel's processing state. Old STT results, async answers, badges, navigation callbacks and Latin results cannot update the new page. An old pending microphone permission cannot start capture on the new page. The normal shared speech queue has an optional scope predicate: late REST audio is not played, and late streaming chunks are rejected without triggering REST fallback. Already-playing speech is not forcibly interrupted. A navigation confirmation can finish on its intended destination, but is dropped after a subsequent unrelated navigation. No STT/TTS payload settings, model/voice/normalization/register rules, mute/echo guard or alert ordering change; existing callers without a scope predicate retain their original path.

### Tests and verification

119 additional Vitest cases retain the preceding 704 cases: 117 in `voice-everywhere.test.jsx` plus two late-audio cases in `tts-speed.test.js`. Coverage includes 63 navigation combinations (21 routes × three languages), mixed aliases, flag-off mapping/mounting, hidden-panel behavior, existing global intent collisions, spoken-number precedence, Hindi/English safety precedence, help for each page, callback isolation, and mocked late REST/SSE audio. Offline Node scorer imports remain supported through explicit `.js` dependency resolution and optional Vite-env access.

The mounted browser regression uses local Chromium, real MainLayout/PushToTalk/context/router, representative page and chat mounts, mocked services/speech/microphone and the actual HOLD announcer. It visits all 21 route targets with the flag on and off, checks persistent panel identity and one Space listener, selection unregistration, no panel on Login, HOLD alert style, and late REST STT / heat-answer rejection. Every non-fixture network request is blocked. Its compiled fixtures live under ignored `node_modules/.cache/`; no real Agent, mic, factory endpoint or provider is contacted. This is not a claim that every real page was manually mic-tested.

Final verification:

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **12.24 s**.
- `npx vitest run --configLoader runner`: **823 passed**, 14 files, **21.34 s** (all 704 preceding cases retained; 119 additional cases).
- `npm run build -- --configLoader runner`: **passed**, **2,818 modules**, **12.62 s**.
- `git diff --check`: passed. No live calls and no commit.

Physical microphone testing remains with the team; F13b and real authentication remain outside this step.

### Files changed for F13a

Frontend foundation: `.env.example`, `vite.config.js`, `vitest.config.js`; `src/context/VoicePageContext.jsx` (new); `src/services/voicePages.js` (new), `voiceIntents.js`, `voiceTranscript.js`, `ttsStream.js`; `src/hooks/useSpeak.js`; `src/components/layout/MainLayout.jsx`; `src/components/voice/PushToTalk.jsx`.

Metadata registration only: `src/pages/Dashboard.jsx`, `Spectrometer.jsx`, `PreMeltGate.jsx`, `RawMaterialStock.jsx`, `YardInspection.jsx`, `GradeSpecs.jsx`, `SupplierScorecard.jsx`, `EnergyDashboard.jsx`, `InventoryForecast.jsx`, `SalesInvoices.jsx`, `CostAnalysis.jsx`, `AnomalyDetection.jsx`, `Recommendation.jsx`, `RLOptimizer.jsx`, `FullAnalysis.jsx`, `MechanicalProperties.jsx`, `AIAgent.jsx`, `SyntheticData.jsx`, `TrainingData.jsx`, `SemanticSearch.jsx`; `src/mock/ChargeOptimizer.jsx`.

Tests: `tests/voice-everywhere.test.jsx` (new), `tests/fixtures/voice-everywhere.html` and `.jsx` (new), `tests/tts-speed.test.js`. Agent: this document only. Local env files, README, backend source/tests, gate logic, seeds, existing answers, benchmark results, configured STT/TTS, unrelated `.claude/` files and production data remain untouched. No commit.

## F13a real-mic fixes

2026-10-31. Owner: Nethra. No live calls or commit. This follow-up supersedes the earlier F13a confirmation/help/refusal and alert descriptions above. The user's final clarification is applied: **page help is purpose and current voice capability only, with NO example questions**.

### Professional confirmations and purpose-only help

Navigation now confirms `<page> பேஜ் ஓப்பன் செய்யப்பட்டது` / `<page> पेज खोला गया` / `<Page> page opened`. For Stock: `ஸ்டாக் பேஜ் ஓப்பன் செய்யப்பட்டது`, `स्टॉक पेज खोला गया`, `Stock page opened`. The previous colloquial confirmation has been removed from production navigation replies. Both new page-aware aliases and legacy navigation use the professional confirmation; the scope guard still permits that confirmation on its intended destination.

Each of the 21 pages has a deterministic short purpose sentence in Tamil, Hindi and English, grounded in the inventory's Shows column. It is followed by one capability sentence, not questions. Pre-Melt describes heat status/reasons/element values; Stock describes **alloy additive stock only**, without suggesting that lot answers exist. Other pages append exactly `இந்த பேஜ்ல இப்போ navigation மட்டும்` / `is page par abhi sirf navigation` / `Only navigation on this page for now`. These are static descriptions, not new data adapters, calculations or factory requests.

For navigation, page help and blocked replies only, `questionReplyLanguage` reuses the existing F2 picker with script/Tanglish/Hinglish evidence and an explicit plain-English fallback. Clear English questions answer in English even if the panel is Tamil or a conflicting detected code is supplied. Undecidable input falls back to the toggle. Other existing data-intent language and answer behavior is unchanged.

### General refusal

All existing safety predicates and their order are retained. Every blocked action now returns a general refusal, without naming an approval action as an instruction:

| Language | Exact reply |
|---|---|
| Tamil | இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க. |
| Hindi | यह वॉइस से नहीं हो सकता। स्क्रीन पर कीजिए। |
| English | This can't be done by voice. Please use the screen. |

The transcript handler explicitly passes the question's reply language to speech for blocked requests, including hands-free. The legacy colloquial refusal formatter also produces this neutral wording if given an old refusal string; unrelated formal speech snapshots remain unchanged. No approval, release, invoice or melt action is exposed.

### HOLD alerts are check events, never page-load effects

The old render/load announcement effect is removed. The Pre-Melt effect calls `holdAnnouncer.observe` only to establish a silent baseline. A successful response from the existing manual `runGateCheck` handler calls `checkResult` using that response, the previous decision and the latest selected voice language/mute state. Saving a dirty charge uses the existing saved response to establish its prior decision; no gate engine or store logic changes.

`checkResult` speaks only for a transition from unchecked/non-HOLD to HOLD. HOLD-to-HOLD rechecks, page load, refresh, route return and language changes do not announce. A session ledger deduplicates actual gateId values (object identity fallback for older test fixtures); reset clears this UI ledger. Muted results are consumed, so unmuting does not replay a previous check. A plain load of an already-HOLD heat cannot trigger speech, including on a cold page refresh.

**VITE_BILINGUAL_ALERT=false** is a new independent default, documented in `.env.example`, exposed in mock mode and isolated in Vitest defaults. With it off, alerts use only the panel's selected language; LANG_BRIDGE=on does not enable bilingual announcements. With it explicitly true, an event queues Tamil then Hindi sequentially and omits English, even when the toggle is English. Thus no event queues English + Tamil + Hindi. Alert style, short template/clarity pipeline and the shared queue are retained. No local env file or TTS/STT setting was edited.

### Changed tests and verification

Updated existing assertions (not removed):

- `voice-everywhere.test.jsx`: professional confirmation capitalization/wording; purpose and capability with no questions for every page; source wiring now observes saved gates and announces only in the check-response handler. Its browser fixture enters saved HOLD silently, performs GO→HOLD check events, and verifies one selected-language alert despite repeat/route visits.
- `fixtures/voice-everywhere.jsx`: explicit mocked check buttons replace the old page-entry announcement.
- `voice-intents.test.js`: neutral refusal payloads; safety intent/order checks unchanged; alert tests use explicit check events.
- `hands-free.test.js`: English blocked commands use the English general refusal and explicitly pass English to speech; read-only/no-mutation checks retained.
- `mock-unit.test.js`: check-event entry point, new-result deduplication and muted-result consumption replace the old unmute replay expectation.
- `language-bridge.test.js`: bilingual behavior requires VITE_BILINGUAL_ALERT; bridge alone keeps selected-language speech.
- `tts-speed.test.js`: bilingual streaming/order test explicitly sets the new flag and uses a check event.
- `evon-phrase.test.jsx`, `transliterate.test.jsx`: neutral English blocked reply; no-Evon and main-transcript isolation retained.
- `voice-register.test.js`: legacy colloquial blocked formatting now uses the neutral refusal, not an approve instruction; historical formal snapshots still pass.
- `mock-e2e.spec.js`: expected English refusal updated; this standalone Playwright suite was not run in this follow-up (the local mocked browser regression runs inside Vitest).

New regression cases cover question language against opposite toggles, exact professional confirmations, general refusals through the clarity pipeline, silent saved-HOLD load/refresh/return, duplicate gate IDs, and all selected-language × bridge × bilingual combinations. No audio was generated; browser microphones, service results and speech are mocked and non-local network requests are blocked. Physical mic verification remains with the team.

Files changed in this follow-up: frontend `src/services/voicePages.js`, `languageBridge.js`, `voiceTranscript.js`, `voiceIntents.js`, `voiceClarity.js`, `voiceGateAnswers.js`; `src/pages/PreMeltGate.jsx`; `.env.example`, `vite.config.js`, `vitest.config.js`; the tests/fixture listed above; this report. Earlier uncommitted F13a foundation files remain intact. No backend source/test, safety-word list, gate engine, seed, number parser, benchmark result, local env, README or provider configuration changes.

Follow-up verification:

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **15.87 s**.
- `npx vitest run --configLoader runner`: **868 passed**, 14 files, **14.23 s**. All 823 preceding cases retained with the changed expectations above; **45 additional cases**.
- `npm run build -- --configLoader runner`: **passed**, **2,818 modules**, **5.33 s**.
- `git diff --check`: passed. **0 live calls**, no audio generation and no commit.


## F13a polish: colloquial page-help review

2026-10-31. Owner: Nethra. No live calls and no commit. Tamil help now uses short shop-floor Tanglish in Tamil script; Hindi uses native-script Hinglish. Technical terms are transliterated, not left in Latin letters. All page names used by Tamil/Hindi confirmations were checked for native script; the established confirmation wording is unchanged. English help is frozen in an independent 21-route baseline and remains byte-for-byte unchanged. No page adapter, safety, gate, alert, language picker or TTS setting changes.

Every Tamil/Hindi sentence is at most eight whitespace-separated words. There are no example questions or Latin-letter IDs in these static descriptions. The Tamil formal words specified by the team are absent. Pages without adapters retain the navigation-only capability, now spoken as `????? ???? ????????? ???????.` / `??? ???? ????? ?????????`. Stock only advertises alloy stock; no lot-answer capability was added.

### Complete team-review table

| Route | Tamil help (full text) | Hindi help (full text) |
|---|---|---|
| `/dashboard` | இந்த பேஜ்ல பிளான்ட் ஸ்டேட்டஸ், கனெக்ஷன் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ प्लांट का स्टेटस और कनेक्शन दिखता है। अभी यहाँ सिर्फ नेविगेशन। |
| `/premelt-gate` | இந்த பேஜ்ல ஹீட் கேட் செக், ஹோல்ட் காரணம் பாக்கலாம். வாய்ஸ்ல ஹீட் நிலை, காரணம் கேக்கலாம். | यहाँ हीट का गेट चेक दिखता है। होल्ड की वजह भी दिखती है। वॉइस से हीट स्टेटस, वजह पूछ सकते हैं। |
| `/raw-material-stock` | இந்த பேஜ்ல ராமெட்டீரியல் லாட், ஸ்டாக் பாக்கலாம். வாய்ஸ்ல அலாய் ஸ்டாக் கேக்கலாம். | यहाँ रॉ मटेरियल लॉट और स्टॉक दिखते हैं। वॉइस से अलॉय स्टॉक पूछ सकते हैं। |
| `/yard-inspection` | இந்த பேஜ்ல யார்டு செக் ரீடிங், ரிசல்ட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ यार्ड चेक रीडिंग और रिज़ल्ट दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/spectrometer` | இந்த பேஜ்ல ஸ்பெக்ட்ரோமீட்டர் ரீடிங், கனெக்ஷன் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ स्पेक्ट्रोमीटर की रीडिंग और कनेक्शन दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/grades` | இந்த பேஜ்ல கிரேடு ஸ்பெக், எலிமென்ட் லிமிட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ ग्रेड स्पेक और एलिमेंट लिमिट दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/supplier-scorecard` | இந்த பேஜ்ல சப்ளையர் ஸ்கோர், ரேங்க் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ सप्लायर का स्कोर और रैंक दिखता है। अभी यहाँ सिर्फ नेविगेशन। |
| `/energy` | இந்த பேஜ்ல ஹீட் எனர்ஜி, மீட்டர் ரீடிங் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ हीट एनर्जी का एस्टिमेट दिखता है। मीटर रीडिंग भी देख सकते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/inventory-forecast` | இந்த பேஜ்ல ஸ்டாக் ஃபோர்காஸ்ட், பர்ச்சேஸ் ரிக்வெஸ்ட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ स्टॉक फोरकास्ट और परचेज़ रिक्वेस्ट दिखती हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/sales` | இந்த பேஜ்ல ஃபினிஷ்டு ஹீட், சர்டிஃபிகேட், சேல்ஸ் பில் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ फिनिश्ड हीट, सर्टिफिकेट, सेल्स बिल दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/cost-analysis` | இந்த பேஜ்ல மெட்டீரியல் ரேட், காஸ்ட் ரெக்கார்டு பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ मटेरियल रेट और कॉस्ट रिकॉर्ड दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/anomaly` | இந்த பேஜ்ல காம்பொசிஷன் டிவியேஷன் ரிசல்ட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ कंपोज़िशन डेविएशन का रिज़ल्ट दिखता है। अभी यहाँ सिर्फ नेविगेशन। |
| `/recommendation` | இந்த பேஜ்ல காம்பொசிஷன் கரெக்ஷன் சஜெஷன் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ कंपोज़िशन करेक्शन के सजेशन दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/rl-optimizer` | இந்த பேஜ்ல ஸ்ட்ராடஜி கம்பேரிசன், மாடல் ஸ்கோர் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ स्ट्रैटेजी कंपैरिजन और मॉडल स्कोर दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/full-analysis` | இந்த பேஜ்ல காம்பொசிஷன் அனாலிசிஸ், காஸ்ட் எஸ்டிமேட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ कंपोज़िशन अनालिसिस और कॉस्ट एस्टिमेट दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/mechanical-properties` | இந்த பேஜ்ல ஸ்ட்ரெங்த், ஹார்ட்னஸ் எஸ்டிமேட் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ स्ट्रेंथ और हार्डनेस के एस्टिमेट दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/agent` | இந்த பேஜ்ல ஏஐ அனாலிசிஸ், சஜெஷன் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ एआई अनालिसिस और सजेशन दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/synthetic` | இந்த பேஜ்ல டெஸ்டுக்கான சிந்தெடிக் ரீடிங் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ टेस्ट के लिए सिंथेटिक रीडिंग दिखती है। अभी यहाँ सिर्फ नेविगेशन। |
| `/training-data` | இந்த பேஜ்ல ட்ரெயினிங் ரெக்கார்டு, டீடெயில் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ ट्रेनिंग रिकॉर्ड और डिटेल दिखती है। अभी यहाँ सिर्फ नेविगेशन। |
| `/semantic-search` | இந்த பேஜ்ல சர்ச் மேட்ச் ரெக்கார்டு பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ सर्च से मैच करते रिकॉर्ड दिखते हैं। अभी यहाँ सिर्फ नेविगेशन। |
| `/charge-optimizer` | இந்த பேஜ்ல சார்ஜ் மிக்ஸ், காஸ்ட் கம்பேரிசன் பாக்கலாம். இப்போ இங்க நேவிகேஷன் மட்டும். | यहाँ चार्ज मिक्स और कॉस्ट कंपैरिजन दिखता है। अभी यहाँ सिर्फ नेविगेशन। |

Changed for this polish: `src/services/voicePages.js`, `tests/voice-everywhere.test.jsx`, `tests/f13a-english-help-baseline.json` (new), and this document. Added 42 native-script/style/length/name cases plus 21 exact English regression cases; the existing 21 page-help capability assertions now expect native-script navigation suffixes. Earlier uncommitted F13a changes remain intact. No local env files, README, backend source/tests, factory data or audio changed.

Polish verification:

- `npx vitest run --configLoader runner`: **931 passed**, 14 files, **15.31 s**; all preceding 868 cases retained plus 63 new cases.
- `npm run build -- --configLoader runner`: **passed**, **2,818 modules**, **5.54 s**.
- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **8.77 s**. The first run hit the pre-existing 30 ms WebSocket audio-idle timing failure; the unchanged full suite passed on rerun. No Agent code/tests changed.
- `git diff --check`: passed. **0 live calls**, no audio generation, no commit. Team microphone/listening review remains manual.
