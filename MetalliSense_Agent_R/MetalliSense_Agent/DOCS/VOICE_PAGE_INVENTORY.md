# Voice page inventory

Research date: 3 November 2026. Static inspection of the current working tree; no services, devices, providers or remote documentation were called. Existing uncommitted voice changes were read as part of the current implementation. This is a capability inventory, not authorization to implement or execute voice actions.

## Scope and reading conventions

The source of sidebar membership is `MetalliSense_Frontend_R/MetalliSense_Frontend/src/components/layout/Sidebar.jsx`; routing is in `src/App.jsx`. There are **19 routed pages excluding Dashboard**, plus two sidebar utilities, covered below. Dashboard is intentionally excluded as requested. `/charge-optimizer` exists only in mock builds and is not a sidebar entry, so it is not counted. Sidebar system-status text is hardcoded, not proof of connection.

Paths below use these roots:

- **F**: `MetalliSense_Frontend_R/MetalliSense_Frontend`; page files are relative to `F/src/pages`, services to `F/src/services`.
- **B**: `MetalliSense_Backend_Simple`.
- **A**: `MetalliSense_Agent_R/MetalliSense_Agent`.

API paths are relative to the Axios base in `services/api.js`, default `http://localhost:3000/api/v2`, unless stated otherwise. Copilot requests use a separate base, default `http://localhost:8001`; Semantic Search uses `http://localhost:8002`. These are source defaults, not verified deployment endpoints. Data paths below refer to the page's local state after response unwrapping; `[]` means the matching row, not every row indiscriminately. Missing fields must be reported unavailable, never inferred from a label or replaced with zero.

**Modes and provenance:** `src/main.jsx` starts `src/mock/server.js` only when `VITE_MOCK_MODE === 'true'`. That server intercepts requests, runs browser ports in `src/mock/handlers`, and persists demo state through `src/mock/db.js`. It is not the Node/Agent backend. In regular mode, Node supplies seeded, in-memory pre-melt/stock/insights/inventory/sales state; training records originate in `B/dataset.csv` through `csvDataStore.js`; grade specifications use `gradeSpecStore.js`; instruments are OPC UA simulators. AI calls may reach the configured AI/Agent services. An API-shaped response does not establish that the values are physical measurements. No runtime mode or availability was assumed in this research.

**Risk policy used here:** LOW = read/view/filter/refresh/navigation/request reading or nonpersistent calculation; MEDIUM = create/edit ordinary records, settings or feedback; HIGH = approve/release/start/override/delete, stock movement, or a control with those effects. A request-reading control that automatically changes a lot's disposition is HIGH overall. Risks describe effects, not HTTP verbs. Counts in the summary count distinct effect families listed in each page's action table; grouped variants are one family. Shared local form controls and shared chat controls are documented once below, outside those counts.

**Permission baseline for every action:** no authenticated role check exists in this build. `AuthContext.jsx` returns `{name: 'Guest', email: ''}` as both `user` and `mongoUser`; `ProtectedRoute.jsx` renders children. Every action table inherits this baseline. Names such as QA engineer, manager and operator indicate intended actors or supplied strings, not verified authority. Backend workflow validations are recorded separately from roles. A gate shown in a banner is not an API authorization check.

## Existing voice behavior and shared controls

Sources: `services/voicePages.js`, `voiceIntents.js`, `voiceTranscript.js`, `voicePageAnswers.js`, `loadedVoiceAnswers.js`, `voiceGateAnswers.js`, `context/VoicePageContext.jsx`, `components/voice/PushToTalk.jsx`, `KuralWakePanel.jsx`, `components/layout/MainLayout.jsx`.

- All 19 routed pages have route aliases and purpose/help metadata in `voicePages.js`. Page-aware navigation/help is conditional on `VITE_VOICE_EVERYWHERE`; wake activation and loaded-page answers have separate feature switches. Code presence is not evidence those switches are enabled in a deployment.
- `useRegisterVoicePage` provides route, selected `heatId`/`lotId`/`grade`/`invoiceId`, source and timestamp. Only Stock, Spectrometer and Grade Specs register loaded data for deterministic page answers. Most registrations are metadata only.
- Existing deterministic answers include heat status, saved gate reasons, predicted element values, additive stock and shift summaries. Stock-lot listing/detail, heat-specific spectrometer reading and grade-range intents use the read services in `voicePageAnswers.js`. Ambiguous IDs/timestamps and missing data have explicit responses.
- With `VITE_VOICE_PAGE_ANSWERS`, loaded answers can take precedence: Stock reads available kilograms/status; Spectrometer reads latest available C/Si/Mn plus timestamp and heat ID if present; Grade Specs reads up to three available ranges. This narrower path can supersede the broader API-backed intent. `pageHelp` still says “Only navigation” for some pages with newer adapters, so help copy is not a reliable capability list.
- `createTranscriptHandler` is explicitly read-only: no approve/start/override/delete/deduct handlers. Blocked mutation intents are refused. Navigation, help and answers are distinct from the future action possibilities inventoried here. Unmatched page questions normally return unavailable rather than a general LLM answer. No voice action listed below should be interpreted as already implemented.
- Shared UI-only controls on every applicable page: field edits, selections, filters, sliders, sorting, pagination, tabs, details expand/collapse, modal open/cancel/close, scroll-to-strategy and route navigation use local setters/router callbacks, have no mutation API, are LOW, and have no safety gate. Opening an approval dialog does not perform approval; its submit is listed separately.
- Shared microphone/wake/mute/repeat/language/settings controls alter voice UI or browser preferences (LOW); STT/TTS/stream requests go to Copilot voice routes and do not write plant records. Tour next/back/pause/resume/stop controls are LOW.
- **Shared chat on Anomaly and Recommendation:** `components/common/AIChatInterface.jsx`: `handleSendMessage` → `sendChatMessage` → Copilot `POST /copilot/chat` (MEDIUM: conversation state); `handleClearHistory` → `clearChatHistory` → `DELETE /copilot/chat/history` (HIGH: deletion). No role or pre-melt gate; Agent conversation state is not a per-user plant audit trail. `startRecording`/`stopRecording`/`handleTranscribeAudio` request microphone/transcription (LOW), then put text in the input. `handlePlayAudio` on AI pages only plays/pauses an existing audio URL (LOW). Browser mock chat persists in `localStorage`; this is not production history. These controls do not implement structured page questions or plant mutations.
- **Shared synthetic generator:** `components/common/SyntheticGenerator.jsx` loads `GET /grades` and `GET /grades/:grade/composition`; `toggleDeviationElement` and form setters are local LOW controls. `handleGenerate` → `generateSyntheticReading` → `POST /synthetic/generate-synthetic` is MEDIUM: it creates a synthetic reading and updates simulator/reading state. UI requires OPC connected, grade selected and at least one deviation element; there is no pre-melt or role check. All pages embedding this control inherit those conditions.

## Sidebar summary

| Page | Reads | Actions (effect families) | Highest risk |
|---|---:|---|---|
| Onboard Tour | 3 | 1: tour controls | LOW |
| Technical Documentation | 3 | 1: open/download | LOW |
| Spectrometer | 4 | 3: load, request, delete | HIGH |
| Grade Specs | 4 | 3: load, create/edit, delete | HIGH |
| Supplier Scorecard | 4 | 4: load, AHP weights, criteria weights, order calculation | MEDIUM |
| Inventory Forecast | 4 | 5: load, create PR, approve PR, reject PR, receive navigation | HIGH |
| Raw Material Stock | 4 | 7: load, receive lot, receive alloy, enter QA, approve QA, reject QA, manual disposition | HIGH |
| Yard Inspection (XRF/LIBS) | 4 | 6: load, connect, disconnect, inspect, replace argon, ingest CSV | HIGH |
| Pre-Melt Gate | 5 | 7: load, plan, edit/save charge, gate check, start, override start, reset | HIGH |
| Energy per Heat | 4 | 4: load, recalculate, save actual, simulate actual | MEDIUM |
| Composition Deviation Analysis | 4 | 3: synthetic generation/override, analyze, explanation | HIGH |
| Melt Correction Planner | 4 | 3: synthetic generation/override, analyze, explanation | HIGH |
| Adaptive Strategy Optimizer | 4 | 5: synthetic override, optimize, policy load, accept, reject | HIGH |
| Full Analysis | 4 | 4: synthetic generation, run analysis, accept, reject | HIGH |
| AI Agent Analysis | 4 | 3: synthetic generation, analyze, explanation | MEDIUM |
| Mechanical Properties | 4 | 3: synthetic generation, predict, approve/record tap | HIGH |
| Sales & Dispatch | 4 | 3: load, issue invoice, view/print | MEDIUM |
| Synthetic Data | 4 | 1: generate | MEDIUM |
| Training Data | 4 | 3: load, create/edit, delete | HIGH |
| Semantic Search | 3 | 1: search | LOW |
| Cost Analysis | 4 | 2: load, save prices | MEDIUM |

Anomaly and Recommendation include explicit composition override controls as well as shared chat history deletion; their analysis controls do not approve melting or stock changes. Sidebar utilities have metadata reads, not plant-data reads.

## General

### Onboard Tour

**Route/component:** no route of its own; `F/src/components/layout/Sidebar.jsx` invokes `onStartTour` or `setRunTour(true)`. Controller and cards are in `src/hooks/useVoiceTour.js`, `services/voiceTour.js`, `components/voice/VoiceTourCard.jsx` and `components/layout/MainLayout.jsx`.

**Data/source:** static tour route/script metadata, current tour position and playback state, supplied by the tour services/controller. No heat/lot IDs, units or process measurements.

**READ possibilities:** “Which page is the tour explaining?” → tour snapshot `state.step.route`, `.displayName`; “What is this step for?” → `state.text`, `.spokenText` derived from the script in `voiceTour.js`; “Is the tour running?” → `state.active`, `.paused`, `.audioStatus`. These are controller metadata, not API response fields.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Start, next/back, pause/resume, repeat, select step, language, retry target, resume autoplay, stop tour | Sidebar inline callback → `onStartTour`; `createVoiceTour` controller `.control(action, value)` / `.stop()` and `tourControl` callbacks; navigation/audio only | All visitors; no process gate | LOW |

**Voice today:** tour narration and command controls, including prefixed commands through `tourVoiceCommands.js` when enabled. During a tour, ordinary plant questions are suppressed by the transcript handler.

**Gaps:** no plant-data adapter here; narration is explanatory, not evidence of live process state.

### Technical Documentation

**Route/component:** no app route/component page; external anchor in `Sidebar.jsx`, `sidebarItems[id='technical-docs'].url` points to a Google Drive download.

**Data/source:** static `label`, `url`, and inline mock guide string; remote contents were not fetched.

**READ possibilities:** “Where is the technical guide?” → `sidebarItems[].url`; “Which sidebar item opens it?” → `sidebarItems[].label`; “What does the browser demo guide explain?” → inline mock-mode Blob text (receipt, screening, QA, planning, gates, analysis, tap/invoice). Remote document questions have no inspected answer field.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Open/download guide | Anchor `href`; mock inline `onClick` creates/downloads `MetalliSense-demo-guide.txt` via Blob | All visitors; no process gate | LOW |

**Voice today:** no dedicated documentation-content adapter or named documentation route; generic tour/help only.

**Gaps:** remote content is not in page context; cannot truthfully answer remote-guide contents from the app state.

### Spectrometer

**Route/component:** `/spectrometer` → `Spectrometer.jsx`.

**Data/source:** `readings[]`, `latestReading` from `getAllReadings`; `_id`, optional `heatId`, `timestamp || createdAt`, element fields at row root or `composition.{Fe,C,Si,Mn,...}` (%). Table shows timestamp and Fe/C/Mn/Si. Latest card uses loaded reading metadata/chemistry. `spectrometerService.js` deliberately includes `/api/v1/spectrometer` inside the v2 Axios base; B mounts that combined path and the direct v1 alias. Source is Node's in-memory reading log and simulated OPC service, or browser instrument handler.

**READ possibilities:** “When was the latest reading?” → `latestReading.timestamp || latestReading.createdAt`; “What was its carbon?” → `latestReading.C` or `latestReading.composition.C`; “What is silicon in this row?” → `readings[].Si || readings[].composition.Si` as the component renders it; “Which heat does this reading belong to?” → `latestReading.heatId` if present. The `||` rendering can obscure a genuine root-level zero; voice should preserve zero/null distinctions.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Load/reload readings | `fetchReadings` → `getAllReadings` → GET `/api/v1/spectrometer` | All; no pre-melt gate | LOW |
| Request reading | `handleRequestReading` → `requestOPCReading` → POST `/api/v1/spectrometer/opc-reading`; reloads list | All; button disabled unless `opcStatus.connected`, OPC service must be usable; no HOLD check | LOW |
| Delete reading | `handleDeleteReading(id)` → `deleteReading` → DELETE `/api/v1/spectrometer/:id` | All; browser confirmation, no role check | HIGH |

**Voice today:** navigation/help; API-backed heat-specific latest reading; optional loaded latest C/Si/Mn answer with timestamp/heat ID. No spoken request/delete support.

**Gaps:** heat IDs may be missing; not every displayed row is linked to a heat; no physical instrument guarantee. Reading-delete API exists. Connection controls in service exports are not buttons on this page (global OPC controls are separate).

### Grade Specs

**Route/component:** `/grades` → `GradeSpecs.jsx`.

**Data/source:** `gradeSpecs[]`, `selectedGrade`, `filteredGrades` from `getAllGradeSpecs` → GET `/grades`; `_id`, `grade`, `standard`, `description`, `composition_ranges.{Fe,C,Si,Mn,P,S}` as `[min,max]` %, `physical_properties.tensile_strength_mpa` and `yield_strength_mpa` ranges (MPa), `elongation_percent` range (%), `typical_applications[]`. Backend `gradeSpecStore.js`; browser handler in mock mode.

**READ possibilities:** “What carbon range is configured?” → selected spec `composition_ranges.C[0..1]`; “Which standard applies?” → `standard`; “What tensile range is listed?” → `physical_properties.tensile_strength_mpa`; “What applications are listed?” → `typical_applications`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Load specs | `fetchGradeSpecs` → `getAllGradeSpecs` → GET `/grades` | All; none | LOW |
| Create/edit spec | `handleSubmit` → `createGradeSpec` POST `/grades` or `updateGradeSpec(editingGrade._id, ...)` PATCH `/grades/:id` | All; form validation, no approval gate | MEDIUM |
| Delete spec | `handleDelete` → `deleteGradeSpec` → DELETE `/grades/:id` | All; confirmation, no role check | HIGH |

**Voice today:** navigation/help, API-backed named grade/element ranges; loaded filtered-grade ranges when enabled. Loaded adapter can fall back to first displayed grade if no unique explicit/selected grade is found.

**Gaps:** displayed catalogue edits are not evidence that every AI model or local hardcoded standard uses the same revision. Voice does not create/edit/delete grades. No revision approval workflow on the page.

## Pre-Production

### Supplier Scorecard

**Route/component:** `/supplier-scorecard` → `SupplierScorecard.jsx` (including `AhpPanel`, `WeightsEditor`, `OrderPlanner`, `SupplierDrawer`).

**Data/source:** `getSupplierScorecard` GET `/insights/suppliers/scorecard`, `getSupplierAhp` GET `/insights/suppliers/ahp`, `getOrderPlan` GET `/insights/suppliers/order-plan`. `data.suppliers[]` identifies suppliers by `supplier` and `materialType`; includes `score`, `grade`, `rank`, `pillars[]`, `trend[]`, `accuracyDetail[]`; data also includes criteria/weights, alerts and method cross-checks. Drawer shows lot-level quality/chemistry, delivery/documents and effective cost. AHP `judgements`, computed `CR`, weights; plan quantities tonnes and costs INR, supplier rates INR/kg or INR/t as labeled. Computed by `B/premeltGate/supplierScorecard.js` over seeded/received lots, inspection/QA and historical records (`supplierHistory.js`), not an external supplier feed.

**READ possibilities:** “What is this supplier's score and rank?” → `data.suppliers[].score`, `.rank`; “What grade are they?” → `.grade`; “Which pillar explains the score?” → `.pillars[].key`, `.score`; “Which suppliers generated alerts?” → `data.alerts[].text`, `.level`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Refresh/filter/view supplier details | `load` → `getSupplierScorecard`; drawer selection is local | All; none | LOW |
| Apply AHP weights | `AhpPanel.apply` → `updateSupplierAhp(j,true)` → PATCH `/insights/suppliers/ahp` | All; UI requires `CR < 0.1`; no manager authentication | MEDIUM |
| Apply manual criteria weights | `WeightsEditor.save` → `updateSupplierWeights` → PATCH `/insights/suppliers/weights` | All; backend normalizes/validates weights; no process gate | MEDIUM |
| Calculate order split | `OrderPlanner.load` → `getOrderPlan(type,tonnes)` → GET `/insights/suppliers/order-plan` | All; calculation only, no order placement | LOW |

**Voice today:** route navigation/purpose help; no score/rank/AHP/order-plan answer adapter.

**Gaps:** supplier identity is name/material grouping, not authenticated account ID; no purchase order submission here; changing weights affects rankings used elsewhere without a role approval gate.

### Inventory Forecast

**Route/component:** `/inventory-forecast` → `InventoryForecast.jsx`, `CreatePrDialog`, `ApproveDialog`, `ItemDetail`.

**Data/source:** `getInventoryForecast` GET `/inventory/forecast`, `getInventoryItem` GET `/inventory/forecast/:item`, `getPurchaseRequests` GET `/inventory/purchase-requests`. Item key `item`; `label`, `status`, `statusReason`, `usableKg`, `onHandKg`, `dailyDemandKg`, `coverDays`, `leadDays`, `reorderPointKg`, `orderKg`, `eoqKg`, `stockOutAt`, `supplierOptions[]`, `openPr`, `history[].onHandKg`, `projection[].projectedKg`. Kilograms, kg/day, days, timestamps, INR and supplier rates. PR `prId`, `qtyKg`, `supplier`, `requestedBy`, `approvedBy`, `status`, `estRsPerKg`, `estTotalRs`, `linkedLotId`, history. Computed by `B/premeltGate/inventory.js` and `purchaseRequests.js` from stock, planned heats/consumption and supplier scores; browser equivalents in mock mode.

**READ possibilities:** “How much usable material remains?” → selected item `usableKg`; “When will it run out?” → `stockOutAt`, `coverDays`; “How much should we order?” → `orderKg` and `eoqKg`; “Who approved this request?” → `prs[].approvedBy`, correlated by `prId`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Refresh/open item detail | `load`, `openDetail`/`ItemDetail` effect → forecast/item/PR GET services | All; none | LOW |
| Create PR (including “anyway”) | `CreatePrDialog.submit` → `createPurchaseRequest` → POST `/inventory/purchase-requests` | Named `requestedBy` (stores intent); positive qty; no duplicate open PR; grade-D suppliers blocked; no role authentication | MEDIUM |
| Approve PR | `ApproveDialog.go` → `approvePurchaseRequest` → POST `/inventory/purchase-requests/:id/approve` | Manager name; pending PR; backend name must differ from requester; no authenticated manager role | HIGH |
| Reject PR | `ApproveDialog.go` → `rejectPurchaseRequest` → POST `/inventory/purchase-requests/:id/reject` | Pending PR; name and reason >=5 chars; no same-person check on rejection | HIGH |
| Receive approved PR | Inline receive navigation to `/raw-material-stock?pr=...`; actual write is Stock receipt | All; PR must be approved for backend receipt; this button itself only navigates | LOW |

**Voice today:** navigation/help only for forecast/PR data; selected item key is registered as `selected.item`, without a forecast answer adapter.

**Gaps:** no actual PO dispatch/payment/vendor portal; forecast values are modeled. `receivePurchaseRequest` and configuration service exports exist but are not independent page submit controls. Stock receipt closes the PR through the backend, not this navigation button.

### Raw Material Stock

**Route/component:** `/raw-material-stock` → `RawMaterialStock.jsx`, `ReceiveModal`, `FerroalloyReceiveModal`, `DriQaModal`, `ApproveModal`, `LotDetailModal`.

**Data/source:** `getStockSummary`, `getLots`, `getLot`, `getAdditives`, `getScenarios`; GET `/premelt/summary`, `/lots`, `/lots/:lotId`, `/additives`, `/gun/scenarios`; optional PR via GET `/inventory/purchase-requests/:prId`. Lot `lotId`, `materialType`, `description`, `supplier`, `truckNo`, `receivedKg`, `availableKg`, `costPerKg`, `receivedAt`, `status`, `statusReason`, `declared`, `tested`, `chemistrySource`, supplier grade/flags. Chemistry percent; kg; INR/kg. Detail includes `meltContribution.yieldPct`, `.composition`, `qa[]` (`qaId`, `version`, `analyst`, `approvedBy`, `values`, `calculated.metallization`, status/time), `gunSessions[]`, `movements[]` (`id`, `type`, signed `kg`, `heatId`, `by`, `at`, `note`). DRI additionally Fe total/metallic, C/P/S, oxides, moisture/fines %. Additives carry `alloyName`, `availableKg`, `reorderLevelKg`, `lowStock`, `lots[]`. Node seeded/in-memory ledger plus received records (`store.js`, `driQa.js`, `additives.js`); browser state when mocked.

**READ possibilities:** “How much of lot X is available?” → `lots[].availableKg`; “Why is it quarantined?” → `lots[].statusReason`; “What did the lab find for phosphorus?” → selected detail `qa[].values.P` with status/version or lot `tested.P`, not supplier `declared.P`; “Who changed this lot's stock?” → `movements[].by`, `.kg`, `.type`, `.at`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Refresh/open lot | `load`; detail effect → summary/lots/lot/additives GET services | All; none | LOW |
| Receive truck/lot | `ReceiveModal.submit` → `receiveLot` → POST `/premelt/lots` | All; receipt validation; linked PR must be approved/material-compatible; scrap awaits inspection, DRI awaits QA; pig/returns/ferroalloy certificate-based receipt can release immediately | HIGH (stock increase) |
| Receive additive batch | `FerroalloyReceiveModal.submit` → `receiveFerroalloy` → POST `/premelt/additives/receive` | `receivedBy:'stores'` string; certificate chemistry; immediate release; PR checks if linked | HIGH |
| Enter DRI lab result / confirm unusual values | `DriQaModal.submit(false/true)` → `enterDriQa` → POST `/premelt/lots/:lotId/dri-qa` | Named analyst; required lab fields; unusual-value 422 requires confirmation; leaves provisional/pending approval | MEDIUM |
| Approve DRI QA | `ApproveModal.act('approve')` → `approveDriQa` → POST `/premelt/dri-qa/:qaId/approve` | Named approver must differ from analyst (case/space normalized); pending QA; release rules/grade-D manager requirement; no authenticated role | HIGH |
| Reject DRI QA | `ApproveModal.act('reject')` → `rejectDriQa` → POST `/premelt/dri-qa/:qaId/reject` | Name/reason required; pending QA; backend may preserve prior approved result; no distinct-person requirement on rejection | HIGH |
| Manual release/reject decision | `LotDetailModal.manual` → `setLotStatus` → PATCH `/premelt/lots/:lotId/status` | `by` plus reason >=10 chars; grade-D release requires `managerApproval`; consumed lots forbidden; DRI release needs LAB chemistry. UI offers RELEASED/REJECTED for eligible rows; API additionally supports RESTRICTED/QUARANTINED | HIGH |

**Voice today:** navigation/help, additive-stock questions; API-backed lot lists/detail; optional loaded lots/additive available kg/status. Detail selection registers `lotId`.

**Gaps:** `adjustStock`, `deductAdditives` exports are not generic stock-adjust buttons here. No verified analyst/manager identities; manager checkbox is self-asserted. Supplier-declared chemistry, approved lab chemistry and gun evidence must remain distinct in answers. No spoken stock/QA writes.

### Yard Inspection (XRF/LIBS)

**Route/component:** `/yard-inspection` → `YardInspection.jsx`.

**Data/source:** gun status/live/sessions and scrap lots through `premeltService.js`; `/premelt/gun/status`, `/live`, `/sessions?lotId=...`, `/premelt/lots`. `form.lotId`, device, pieces, surface preparation, inspector; `status.client.isConnected`, `status.server.endpoint`, `.isRunning`, `.argonRemaining` (carbon tests); `live.sessionId`, `lotId`, `device`, `status`, `piecesDone`, `piecesPlanned`, `readings[].pieceNo`, `.values.{Cu,Ni,Cr,Mo,Sn,Mn,Si,C,P,S}` %, `.surfaceOk`, `.flags`; `live.result.decision`, `.evidence`. History `sessionId`, `via`, `inspector`, counts/status. Backend `gunService.js`, OPC UA simulator, `gunIngest.js`; uploaded real-format CSV is manually supplied, not proof of device authenticity.

**READ possibilities:** “Is the gun connected?” → `status.client.isConnected`; “How many pieces are done?” → `live.piecesDone`, `.piecesPlanned`; “What was the worst copper reading?” → `live.result.evidence.worst.Cu.value`; “Why was the lot restricted?” → `live.result.decision.reason` (or matched historical session `.decision.reason`).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Load/poll/history/CSV download | `loadStatus`, `loadLots`, `loadSessions`, `poll`; GET services; `gunCsvUrl(sessionId)` GET `/premelt/gun/sessions/:sessionId/csv` | All; none | LOW |
| Connect gun | `toggleConnection` → `connectGun` → POST `/premelt/gun/connect` | All; simulator availability | LOW |
| Disconnect gun | `toggleConnection` → `disconnectGun` → POST `/premelt/gun/disconnect` | All; no role gate | LOW |
| Start inspection | `run` → `startInspection` → POST `/premelt/gun/inspect` | Inspector name or default; selected scrap; supplier-grade minimum sample count, surface/device/argon checks; may change lot disposition; grade-D manager release requirement retained | HIGH |
| Replace argon | Inline async → `replaceArgon` → POST `/premelt/gun/argon/replace` | All; simulator consumable reset, not verified physical replacement | MEDIUM |
| Ingest gun CSV | `uploadCsv` → `ingestGunCsv` → POST `/premelt/gun/ingest-csv` | All; parser/evidence rules; may release/restrict/quarantine lot | HIGH |

**Voice today:** navigation/help and selected `lotId` metadata; no gun-live/session answer adapter.

**Gaps:** XRF cannot supply reliable carbon/low Si/P/S; unreliable surfaces and missing measurements are not zero. Gun readings are disposition evidence, not replacement lot chemistry. Reinspection alone does not automatically clear a previous quarantine; named manual QA occurs on Stock.

### Pre-Melt Gate

**Route/component:** `/premelt-gate` → `PreMeltGate.jsx`, `Interlock`, `GateEnergy`.

**Data/source:** heats/heat/lots/config/audit GET `/premelt/heats`, `/heats/:heatId`, `/lots`, `/config`, `/audit?limit=12`. `heat.heatId`, `grade`, `targetKg`, `status`, `charge[].{lotId,kg}`; `heat.gateResult` (backend stores `heat.gate`), `gateId`, `decision`, `headline`, `blocking[]`, `warnings[]`, `checks[]`, `at`, `validUntil`, `prediction.{chargeKg,metalKg,composition,sigma}`, `spec.ranges`, `suggestedAdditions[].{lotId,kg,element,alloyName,cost}`, `ai`, `energy`; start operator/override; audit action/ref/by/time/note. Composition and sigma %, masses kg, costs INR, energy kWh. Gate uses Node `gateEngine.js`, material chemistry/stock/inspection/QA and AI assessments; not a PLC command interface.

**READ possibilities:** “Is this heat GO, WARN or HOLD?” → `heat.gateResult.decision`; “What blocks starting?” → `.blocking` and `.checks[]` with FAIL; “What copper is predicted?” → `.prediction.composition.Cu`, `.prediction.sigma.Cu`; “Is this check still valid?” → `.validUntil` plus backend fingerprint validation (time alone cannot prove freshness); “Which lots and weights make the charge?” → `heat.charge[].lotId`, `.kg`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Select/load heat, lots and audit | `loadHeats`, `loadHeat`, `loadLots`, `loadAudit` → GET services | All; none | LOW |
| Plan heat | `createHeat` → `planHeat` → POST `/premelt/heats` | `plannedBy:'Melt shop'`; grade/weight validation; no role check | MEDIUM |
| Add/remove/edit/save charge, apply suggested additions | `addLine`, `removeLine`, `editLine`, `applyAdditions` are draft edits; `saveCharge` → `updateCharge` → PUT `/premelt/heats/:heatId/charge` | PLANNED heat; changed charge invalidates gate; draft removal is not lot deletion | MEDIUM |
| Run check (saves dirty charge first) | `check` → `saveCharge` if needed → `runGateCheck` → POST `/premelt/heats/:heatId/gate-check` | PLANNED only; evaluates stock/status, inspection, DRI, composition/residual and AI risks; writes gate record/audit | MEDIUM |
| Start melting | `Interlock.start(undefined)` → `startMelting` → POST `/premelt/heats/:heatId/start-melting` | Operator name; PLANNED; existing gate; fingerprint current; unexpired; WARN must be acknowledged; stock rechecked; HOLD blocks ordinary start; deducts charge stock | HIGH |
| Engineer override and start | `Interlock.start({engineer,reason})` → same start API | Same freshness/stock checks; HOLD needs engineer name and reason >= configured minimum (UI 20 chars); self-asserted engineer, no role verification | HIGH |
| Reset demo data | `reset` → `resetDemo` → POST `/premelt/demo/reset` | Browser confirmation; no role check; reseeds backend/browser records | HIGH |

**Voice today:** navigation/help; heat status, HOLD/WARN reasons, predicted elements and shift summaries; gate-result/HOLD announcement helpers; selected heat/grade. Existing start/override controls are manual only.

**Gaps:** actual backend start immediately deducts charge stock, despite the context comment claiming deduction only at RL acceptance. `continueToAI`/`gatePassed` only update browser flow/navigation; they do not independently start the furnace. Gate pass in session storage is not durable authorization. No verified furnace hardware start acknowledgement.

### Energy per Heat

**Route/component:** `/energy` → `EnergyDashboard.jsx`, `HeatAnalysis`.

**Data/source:** `getEnergySummary` GET `/insights/energy/summary`; `getEnergyForHeat(heatId,{holdingMin,hour,tapTempC})` GET `/insights/energy/heat/:heatId`. Summary `d.totals.avgPredictedKwhPerT`, `.avgActualKwhPerT`, `d.avgRsPerT`, `tariffRsPerKwh`, `savings.{rsAvoided,kwhAvoided,co2AvoidedKg,badMeltsAvoided}`, `predictionErrorPct`, `heats[]`, `drivers[]`, `byGrade[]`. Selected heat `e.kwh`, `kwhPerT`, `rs`, `rsPerT`, `co2Kg`, `tariffBand`, `drivers[].kwh`, `profile`, `tips`, `actual.{actualKwh,kwhPerT,deviationPct,by,source}`. kWh, kWh/t, INR, INR/t, kg CO2, minutes, hour, degrees C. Backend `energy.js` modeled charge/holding/tariffs and stored entered/simulated readings; not a verified live meter feed.

**READ possibilities:** “What is predicted energy for this heat?” → `e.kwh`, `e.kwhPerT`; “What did the meter record?” → `e.actual.actualKwh` and `.source`; “Which driver uses the most energy?” → max of `e.drivers[].kwh` with `.label`; “How much energy cost has the gate avoided?” → `d.savings.rsAvoided`, `.kwhAvoided` (modeled savings).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Refresh/select heat | outer `load` → `getEnergySummary`; `HeatAnalysis.load` → heat GET | All; none | LOW |
| Change what-if holding/hour/tap temperature | setters trigger `HeatAnalysis.load` → same heat GET with params | All; modeled recalculation, no process command | LOW |
| Save actual reading | `meter(false)` → `recordHeatEnergy` → POST `/insights/energy/heat/:heatId/actual` | `by:'Melt shop'`; numeric reading validation; no pre-melt approval | MEDIUM |
| Read meter (sim) | `meter(true)` → `simulateHeatEnergy` → POST `/insights/energy/heat/:heatId/simulate` | All; writes a simulated actual, not just refresh | MEDIUM |

**Voice today:** navigation/help; selected heat metadata only, no energy-specific answer adapter.

**Gaps:** simulated/entered actuals must be labeled by `source`; tariff/grid factors illustrative. Config service exports exist but no configuration-save form here.

## AI Analysis

### Composition Deviation Analysis

**Route/component:** `/anomaly` → `AnomalyDetection.jsx`.

**Data/source:** `generatedReading` from shared generator or `flow.predictedComposition`; grade, composition %, temperature degrees C, pressure atm. `analysisResult` from `predictAnomaly` POST `/ai/anomaly/predict` (Node → configured AI service); `severity`, `anomaly_score`, `message`, `compliance.overallCompliance`, `compliance.summary.{compliant,total}`. `copilotExplanation` through Copilot `/copilot/explain`; browser shared flow records `_reading` and heat/gate context.

**READ possibilities:** “How severe is the deviation?” → `analysisResult.severity`; “What is its anomaly score?” → `analysisResult.anomaly_score`; “How many elements comply?” → `analysisResult.compliance.summary.compliant` and `.total`; “What carbon was analyzed?” → `generatedReading.composition.C` (and source/heat to distinguish predicted vs synthetic).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate test reading/chemist replacement | shared `SyntheticGenerator.handleGenerate` → synthetic POST; `handleSyntheticDataGenerated` stores it and analyzes | All; shared OPC/form checks, no authenticated chemist role | MEDIUM standalone; HIGH for explicit gate-flow composition override |
| Analyze, including auto-run | `performAnalysis` → `predictAnomaly` → POST `/ai/anomaly/predict`; `anomalyDone` stores browser flow | `canRunAnomaly` enables gate-flow auto-run; standalone synthetic analysis remains possible; no backend furnace gate on analysis | LOW |
| Get/retry explanation | `handleGetAIExplanation` / `generateCopilotExplanation` → `getExplanation` → Copilot POST `/copilot/explain` | Requires reading/result; no process mutation gate | LOW |

**Voice today:** global navigation/help and heat/gate answers; explanation text/audio and shared voice-enabled chat. No deterministic anomaly-result field adapter. Shared chat history deletion is HIGH (see shared controls).

**Gaps:** `GateBanner` explains flow but does not authenticate or forbid standalone analysis; generated/predicted input is not measured final chemistry. Analysis results in local state are not a completed production decision record.

### Melt Correction Planner

**Route/component:** `/recommendation` → `Recommendation.jsx`.

**Data/source:** `syntheticReading` or gate flow; `result` from `analyzeIndividual` POST `/ai/individual/analyze`. `result.aiAnalysis.serviceAvailable`, `.errors`, `.alloyRecommendation.recommended_additions` (element percentage-point additions as rendered), `.alternative_grades`, confidence where returned; reading composition %, temperature degrees C, pressure atm. Copilot explanations from Agent. Node orchestrates configured anomaly/alloy services; mock uses demo AI handlers.

**READ possibilities:** “Which elements should be added?” → `result.aiAnalysis.alloyRecommendation.recommended_additions`; “What alternatives are offered?” → `.alternative_grades`; “Is the AI service available?” → `result.aiAnalysis.serviceAvailable`, `.errors.alloy`; “Which chemistry produced this plan?” → `syntheticReading.composition` and `.metalGrade`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate/replace test reading | shared generator → synthetic POST; `handleGenerate` receives it | All; OPC/form checks; no verified chemist role | MEDIUM standalone; HIGH for explicit gate-flow composition override |
| Generate correction plan (including auto-run) | `handleGenerate` → `analyzeIndividual` → POST `/ai/individual/analyze`; `alloyDone` browser context | `canRunAlloy` requires anomaly result for automatic gate flow; standalone generator allowed; not stock application | LOW |
| Get/retry explanation | `handleGetAIExplanation` / `generateCopilotExplanation` → Copilot POST `/copilot/explain` | Reading/result required; no process gate | LOW |

**Voice today:** navigation/help, shared explanation/chat audio, heat/gate questions. No correction-result adapter. Shared history deletion is HIGH.

**Gaps:** recommended element percentages are not additive lot kg; no apply/deduct approval here. Confidence/service errors must accompany answers. Shared chat context is not guaranteed to identify the currently selected heat.

### Adaptive Strategy Optimizer

**Route/component:** `/rl-optimizer` → `RLOptimizer.jsx`; comparison UI `src/components/rl/StrategyComparison.jsx`.

**Data/source:** `reading` from prior flow or synthetic generator; `result.candidates[]` from `rlOptimize` POST `/rl/optimize`; `strategy`, `recommended_additions` (element percentage additions), `aggressiveness`, estimates including `estimatedCost`, predicted risk/reward where supplied; locally computed mechanical comparison using `predictMech` (UTS/YS MPa, elongation %, hardness HB, CE), `policyStatus.n_updates`, `.reward_trend` from GET `/rl/policy/status`. Gate carries `suggestedAdditions[].{lotId,kg}`, heat/grade, estimated metal kg. Node proxies optimization/feedback to A `/rl/*`; browser mock has its own acceptance transaction.

**READ possibilities:** “What additions does the balanced strategy propose?” → matched `result.candidates[].recommended_additions`; “What does it cost?” → candidate `.estimatedCost`; “How many policy updates exist?” → `policyStatus.n_updates`; “Which lots would be deducted in this regular-mode handler?” → `flow.suggestedAdditions[].lotId`, `.kg` (not necessarily candidate-specific quantities).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate/chemist override input | shared generator → synthetic POST; `handleGenerate` | All; OPC/form checks; override label is not authenticated role check | HIGH (explicit workflow input override) |
| Score/re-run strategies | `handleGenerate`, `buildGateReading` → `rlOptimize` → POST `/rl/optimize`; `rlDone` saves browser state | `canRunRL` sequences auto-run after alloy result; standalone analysis allowed | LOW |
| Load policy status | `loadPolicyStatus` → `rlPolicyStatus` → GET `/rl/policy/status` | All; none | LOW |
| Accept strategy | `handleFeedback(candidate,'accepted')` → `rlSubmitFeedback` POST `/rl/feedback`; regular mode optionally `deductAdditives` POST `/premelt/additives/deduct`, then `acceptStrategy`; mock POST `/__mock/accept-strategy` | UI disables concurrent/already deducted accept; no authenticated operator; regular API feedback lacks heat/gate authorization; deduction validates lots/availability; mock requires MELTING and prevents different repeat acceptance | HIGH |
| Reject strategy | `handleFeedback(candidate,'rejected')` → POST `/rl/feedback`, `rejectAll` clears local RL result | All; requires reading; no process gate; updates learned policy | MEDIUM |

**Voice today:** navigation/help, selected heat/grade and existing global gate/stock reads; no candidate/feedback voice adapter or spoken acceptance.

**Gaps:** regular handler deducts gate-suggested additions, not necessarily accepted candidate quantities. It submits learning feedback before deduction and still calls `acceptStrategy` if deduction fails, making `stockStatus='deducted'` misleading. Mock acceptance computes selected-candidate kg and rolls back on failure; this is a separate behavior. “Reject all” semantics in context can be triggered by rejecting one candidate. Local mechanical comparisons are estimates, not tests.

### Full Analysis

**Route/component:** `/full-analysis` → `FullAnalysis.jsx`.

**Data/source:** `reading`, `batchWeightKg`, `result.steps` from `runFullAnalysis` POST `/workflow/full-analysis`; `.anomalyDetection.{severity,anomaly_score,explanation}`, `.alloyRecommendation.{recommended_additions,estimatedCost,estimatedCarbon}`, `.rlOptimization.candidates[]`, `.rootCauseHint`, per-step errors. Costs INR, batch kg, carbon kg CO2e, percentage additions; local mechanical strategy comparison `faPredictMech`. Node chains configured AI/Agent calls and cost/carbon/root-cause annotations; gate inputs from session context or synthetic generation.

**READ possibilities:** “What severity did the run find?” → `result.steps.anomalyDetection.severity`; “What correction was proposed?” → `.alloyRecommendation.recommended_additions`; “What is the batch carbon estimate?” → `.alloyRecommendation.estimatedCarbon.totalBatchCo2Kg`; “What root cause was suggested?” → `.rootCauseHint` (a hint, not confirmed cause).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate reading | shared generator → synthetic POST; `handleGenerate` clears prior result/choice | All; OPC/form checks | MEDIUM |
| Run analysis | `handleRunAnalysis` → `runFullAnalysis` → POST `/workflow/full-analysis` with grade/composition/batch/topK | Reading required; gate prefills when unlocked; standalone run allowed; no process gate on API | LOW |
| Accept strategy | `handleFeedback(c,'accepted')` → POST `/rl/feedback`; `setChosenStrategy`, `acceptStrategy`; mock uses POST `/__mock/accept-strategy` instead | Requires reading; local single-choice lock; no verified role; mock transaction has heat/stock checks | HIGH |
| Reject strategy | `handleFeedback(c,'rejected')` → POST `/rl/feedback` | Reading and no chosen strategy; updates policy; no gate check | MEDIUM |

**Voice today:** navigation/help, selected heat/grade, global gate/stock questions; no full-analysis step/candidate answer adapter.

**Gaps:** regular-mode accept never calls stock deduction, yet `acceptStrategy` sets `stockStatus='deducted'` and toast claims stock deducted. Mock path does deduct. Flow is browser-local, not a backend single-choice approval record. Partial step errors must not be read as success; CO2/cost/mechanical outputs are estimates.

### AI Agent Analysis

**Route/component:** `/agent` → `AIAgent.jsx`.

**Data/source:** `syntheticReading` from generator; `result.aiAnalysis` through `analyzeAgent` POST `/ai/agent/analyze`; `.serviceAvailable`, `.anomalyDetection`, `.alloyRecommendation`, service errors; input grade/composition %, temperature degrees C, pressure atm. `aiExplanation` from `explainResult` POST `/ai/explain`, extracting `geminiExplanation.explanation`; optional returned base64 audio. Node proxies Agent orchestration; provider availability not verified.

**READ possibilities:** “Which grade was analyzed?” → `syntheticReading.metalGrade`; “What anomaly did the agent identify?” → `result.aiAnalysis.anomalyDetection`; “What additions are proposed?” → `result.aiAnalysis.alloyRecommendation.recommended_additions`; “What explanation was returned?” → `aiExplanation` (and service availability from `result.aiAnalysis.serviceAvailable`).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate input | shared generator → synthetic POST | All; OPC/form checks | MEDIUM |
| Run Agent analysis | `handleGenerate` → `analyzeAgent` → POST `/ai/agent/analyze` | All; invoked after generation; gate banner is not API enforcement | LOW |
| Explain result | `handleGetAIExplanation` → `explainResult` → POST `/ai/explain`; `handlePlayAudio` local playback | Result/reading required; no process gate | LOW |

**Voice today:** navigation/help, optional explanation audio; selected grade/heat metadata and global answers. No structured Agent-result read adapter.

**Gaps:** page result is advisory and not a plant action executor. An unlocked heat does not automatically make this generated reading belong to that heat. Explanations/audio can be unavailable; no backend approve/apply button here.

## Post-Production

### Mechanical Properties

**Route/component:** `/mechanical-properties` → `MechanicalProperties.jsx`.

**Data/source:** `reading` from gate composition or generator; `result` from direct fetch `${API_BASE}/api/v2/mechanical/predict`, where `API_BASE = VITE_API_URL || 'http://localhost:3000'`, with `mode:'formula'`, falling back to local `predictFromChemistry`. `predicted_uts_mpa`, `predicted_ys_mpa`, `predicted_elongation_pct`, `predicted_hardness_hb`, `carbon_equivalent`, `ce_budget`, `element_contributions`, `quality_result`, `alerts`, `reference_standard`; local `STANDARDS` thresholds. `finished` from sales completion/finished-heats API includes `tap` yields and disposition. Strength MPa, elongation %, HB, CE and chemistry %, masses kg, rates INR/kg.

**READ possibilities:** “What tensile strength is predicted?” → `result.predicted_uts_mpa`; “What elongation is predicted?” → `.predicted_elongation_pct`; “Did the estimate pass?” → `.quality_result`, `.alerts`; “Who approved the tap and what weight finished?” → `finished.tap.approvedBy`, `.castingsKg` (unavailable before completion).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate standalone input | shared generator → synthetic POST; `handleGenerate` | All; OPC/form checks | MEDIUM |
| Predict/retry (also auto-run on reading) | `runPrediction` → POST `/api/v2/mechanical/predict` at page API_BASE; fallback local formula; `mechDone` browser context | Needs grade/composition; standalone prediction allowed; not physical test certification | LOW |
| Approve Tap / record finished heat recovery | `handleApproveTap` → `completeHeat` → POST `/sales/heats/:heatId/complete` with `approvedBy`, chemistry, mechanical, standard, accepted strategy, `resume:true`; `approveTap` updates browser state | UI name required and flow/strategy conditions; backend normally requires MELTING; resume can move a PLANNED heat to MELTING from saved flow and deduct stock, bypassing a new normal start check; no authenticated engineer | HIGH |

**Voice today:** navigation/help and selected heat/grade only; no strength/quality/tap answer adapter.

**Gaps:** formula estimates can exist with no AI engine; local thresholds need not match editable Grade Specs. Failed quality can be recorded as downgraded rather than blocking completion. Completion returns runners/risers to stock and computes castings, so it is more than UI approval. `resume:true` is a consequential demo recovery path, not fresh pre-melt authorization. No measured tensile/hardness test or final spectrometer verification is required by this handler.

## Sales

### Sales & Dispatch

**Route/component:** `/sales` → `SalesInvoices.jsx`, `InvoiceDialog`, `DocViewer`, `InvoiceDoc`, `CertificateDoc`.

**Data/source:** `getFinishedHeats`, `getInvoices`, `getCustomers` GET `/sales/heats`, `/invoices`, `/customers`; `getCertificate(heatId)` GET `/sales/certificates/:heatId`. `heats[].heatId`, `grade`, `tap.{castingsKg,returnsKg,result,soldGrade,sellingRsPerKg,approvedBy}`, invoice linkage; `invoices[].invoiceId`, `heatId`, customer/seller, qty/rate, tax/total, creation/date/PO fields; customer `id` (e.g. C-001), GST/address/state; certificate chemistry/mechanical checks and source lot traceability. kg, INR/kg, INR, tax %, timestamps. Backend `sales.js` uses seeded demo business details and computed casting/returns yields; mock browser equivalent. These are not validated tax or lab certificates.

**READ possibilities:** “What weight is ready to invoice?” → matched `heats[].tap.castingsKg`; “Was this heat downgraded?” → `.tap.result`, `.tap.soldGrade`; “Which invoice covers this heat?” → matching `invoices[].heatId`, `.invoiceId`; “What rate is suggested?” → `heats[].tap.sellingRsPerKg` (dialog may override).

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Refresh sales/customer/invoice data | `load` → GET services | All; none | LOW |
| Issue invoice | `InvoiceDialog.submit` → `createInvoice` → POST `/sales/invoices` | `createdBy` name, valid customer, approved tap, no existing uncancelled invoice for heat, positive qty <= castings and positive rate; no authenticated sales role | MEDIUM (creates sales record; does not operate physical dispatch) |
| View certificate/invoice, print/save PDF | local `setView`; `DocViewer` effect → certificate GET; inline `window.print()` | Certificate requires approved tap; no process mutation | LOW |

**Voice today:** navigation/help; viewing a document registers heat/invoice IDs. No invoice/finished-goods/certificate answer adapter or spoken issuance.

**Gaps:** no dispatch/start shipment, delete invoice, customer CRUD or payment button/API call from this page. Title “Dispatch” does not imply logistics execution. Seller/customer details and yield/tax defaults are demo placeholders; certificate mechanical values are predicted. Config service exports are not an on-page settings form.

## Training Data group

### Synthetic Data

**Route/component:** `/synthetic` → `SyntheticData.jsx` and shared generator.

**Data/source:** generated response `generatedReading.metalGrade`, `deviationPercentage`, `temperature` degrees C, `pressure` atm, `composition` %, `deviationElements[]`, `appliedDeviations[]`; local displayed reading from synthetic service/OPC simulator, not CSV training-row creation.

**READ possibilities:** “Which grade did we generate?” → `generatedReading.metalGrade`; “What carbon did it generate?” → `.composition.C`; “Which elements were deliberately deviated?” → `.deviationElements`; “What deviation percentage was requested?” → `.deviationPercentage`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Generate reading | `SyntheticGenerator.handleGenerate` → `generateSyntheticReading` POST `/synthetic/generate-synthetic`; `handleDataGenerated` stores returned reading | All; connected OPC, grade and deviations required; no pre-melt role/gate | MEDIUM |

**Voice today:** navigation/help and selected grade only; no generated-reading answer adapter.

**Gaps:** no “save as training record” action; displayed synthetic values must never be called physical readings or production approvals.

### Training Data

**Route/component:** `/training-data` → `TrainingData.jsx`.

**Data/source:** `getPaginatedTrainingData` GET `/training-data/paginated` with page/limit/grade/sample_type/severity/sort; `getAllGradeSpecs` for grade choices. `trainingData[]._id`, `grade`, `Fe,C,Si,Mn,P,S` %, `deviated`, `severity`, `sample_type`, timestamps when supplied; `pagination.totalDocuments`, paging fields. Node `csvDataStore.js` loads `dataset.csv` and supports CRUD; browser seeded records in mock mode. Not a live production historian.

**READ possibilities:** “How many records match these filters?” → `pagination.totalDocuments`; “What carbon does record X contain?” → matched `trainingData[].C`; “What severity label does it have?” → `.severity`; “Is this a normal or deviated sample?” → `.sample_type`, `.deviated`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Load/refresh/filter/sort/page/view record | `fetchTrainingData`, `handleFilterChange`, `handleView` → paginated GET or local state | All; no process gate | LOW |
| Create/edit sample | `handleSubmit` → `createTrainingData` POST `/training-data` or `updateTrainingData(editingSample._id,...)` PATCH `/training-data/:id` | All; form numeric/grade checks; no QA approval or role check | MEDIUM |
| Delete sample | `handleDelete` → `deleteTrainingData` → DELETE `/training-data/:id` | All; browser confirmation; no role check | HIGH |

**Voice today:** navigation/help, selected sample/filter grade metadata only; no row/filter-count adapter.

**Gaps:** editing records is not model retraining; no retrain/publish control here. No row-level provenance approval, verified creator or model-version linkage; Agent/vector index synchronization is not established by a successful page save.

### Semantic Search

**Route/component:** `/semantic-search` → `SemanticSearch.jsx`.

**Data/source:** `query`, `collection` (`training_data` or `grades`), `results[].text`, `.score` from `semanticSearch(query,collection,8)` → separate VectorSearch service POST `/semantic-search`. Display score is `score * 100` percent match, not confidence in a plant action. Source vector index (Actian integration in `MetalliSense_VectorSearch`); mock may return demo results.

**READ possibilities:** “What did the search find?” → `results[].text`; “How strong is the match?” → matching `results[].score`; “Which collection was searched?” → `collection`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Submit search | `handleSearch` → `semanticSearch` → VectorSearch POST `/semantic-search` with query/collection/limit 8 | All; nonblank query; no process gate | LOW |

**Voice today:** navigation/help only; no speech-to-query or deterministic results adapter.

**Gaps:** UI renders text/score only, not source record IDs or verified heat links. Empty results and service failure can look similar; result text is not proof a record is current. `reindex` service export has no page button; voice must not claim a reindex action exists here.

### Cost Analysis

**Route/component:** `/cost-analysis` → `CostAnalysis.jsx`.

**Data/source:** `getPrices` GET `/cost/prices`; `getCostHistory(20)` GET `/cost/history?limit=20`. `elementPrices[element].pricePerKg`, `.via` (INR/kg contained element and source label), `baseMetalPrices[grade]` INR/kg; `history[]._id`, `.grade`, `.batchWeightKg`, `.baseMetalCost`, `.totalAdditionsCost`, `.totalBatchCost`, `.costPerKg`. Backend `alloyPriceStore.js` and Node cost routes/estimate history; entered/default prices, not an automatic market quote feed.

**READ possibilities:** “What carbon price is configured?” → `elementPrices.C.pricePerKg`; “What base cost is used for SG iron?” → `baseMetalPrices['SG-IRON']`; “What was this batch estimate?” → matched `history[].totalBatchCost`, `.batchWeightKg`; “How much was attributed to additions?” → `history[].totalAdditionsCost`.

| Action | Handler/API | Allowed/gate | Risk |
|---|---|---|---|
| Load/refresh prices and history | `loadAll` → `getPrices`, `getCostHistory` GET services | All; none | LOW |
| Save edited element/grade prices | `handleSave` → `updatePrices({elementPrices:editedElements,baseMetalPrices:editedGrades})` → PATCH `/cost/prices` | All; no-op if no edits; numeric nonnegative UI; no pricing-role approval | MEDIUM |

**Voice today:** navigation/help only; no price/history adapter.

**Gaps:** “current market rate” UI text does not mean live market integration; no quote timestamp or supplier contract verification. Estimate service exists but no direct estimate-creation form here; refreshing does not create a new estimate. Price edits do not necessarily recalculate historical records.

## Auth, roles, identities and permission gaps

Evidence: `F/src/context/AuthContext.jsx`, `components/ProtectedRoute.jsx`, `pages/Login.jsx`, `pages/SignUp.jsx`, `components/layout/TopBar.jsx`, `services/api.js`; `B/server.js`, `B/premeltGate/routes.js`, `driQa.js`, `purchaseRequests.js`, `gateEngine.js`, `sales.js`.

- `/login` and `/signup` still render forms. Login calls `login(email,password)`; signup collects name/email/password and role, calling `signup(...)`. Those functions are stubs returning Guest; they do not authenticate/create users. `logout` and `updateUserProfile` are no-ops. Backend is explicitly no-auth with open CORS. `api.js` has an obsolete JWT-cookie comment but actually sets `withCredentials:false`; its 401 redirect is not an auth implementation.
- Signup role options: **Chemical Engineer 1, Chemical Engineer 2, Chemical Engineer 3, Supervisor, Manager, Unit Controller**. TopBar displays `mongoUser?.metadata?.role || 'Chemical Engineer 1'`; this fallback is presentation, not a permission grant.
- Current auth user has no `_id`, `id`, `userId` or token. `mongoUser` is an alias for the Guest object, not evidence of Mongo-backed users. `_id` on grades/readings/training/cost records identifies resources; customer `id`, `lotId`, `qaId`, `heatId`, `gateId`, `sessionId`, `prId` and `invoiceId` are business/resource IDs, not actor identities.
- Intended operational actors are free-text `analyst`, `approver`, `inspector`, `operator`, `engineer`, `by`, `receivedBy`, `plannedBy`, `requestedBy`, `approvedBy`, `createdBy`; some are hardcoded to stores/operator/Melt shop. None are tied to a login principal. A differently typed name satisfies maker-checker comparisons.
- DRI approval and PR approval have real backend *name difference* checks; rejection does not have the equivalent maker-checker check. Grade-D lot release uses `managerApproval` boolean plus supplied name. HOLD override validates engineer/reason but not engineer role. These validations must not be described as role-based access control.
- There is no central page action authorization matrix or server-verified role boundary in the inspected routes. Browser/session flow sequencing, disabled controls, warning acknowledgement and reason length are workflow checks, with no identity proof.

## Audit hooks on the Agent side

These are research findings/proposed hook locations, not implemented changes.

| Hook location | Existing behavior | Useful event boundary / missing linkage |
|---|---|---|
| `A/app/main.py`: `transcribe_audio`, `stream_voice`, `transcribe_handover`, `evon_phrase`, `explain_analysis`, `chat_with_copilot` | STT, streaming, phrasing/explanation/chat; provider/latency logs exist in voice modules | Capture request/correlation ID, source route/scope, language, intent outcome and failure category. These endpoints do not know browser-selected lot/heat unless supplied; transcription is not an executed plant action. Avoid treating raw audio/transcript/provider logs as a durable action ledger. |
| `A/app/main.py`: `rl_feedback` → `rl_engine.record_feedback` in `A/app/rl/policy.py` → `append_feedback` in `A/app/rl/feedback_store.py` | Existing append-only JSONL at `DATA_DIR / 'rl_feedback_log.jsonl'`; records operator decisions/outcomes with timestamp; policy updates online | Strongest existing Agent mutation audit hook. Current UI feedback payload contains grade/composition/additions/aggressiveness/outcome/operator note, not verified actor, heat/gate/candidate transaction ID or stock result. Correlate policy-update and append success/failure; feedback alone does not prove stock applied. |
| `A/app/main.py`: `rl_optimize`, `predict_anomaly`, `recommend_alloy_additions`, `agent_analysis`, `premelt_assess` | Produces recommendations/predictions | Record input provenance/hash, model/policy version, returned candidate/result ID and decision metadata so a later human approval can refer to the exact result. These are advisory operations, not melt-start events. |
| Future Agent command dispatcher (none exists in current read-only voice path) | Intent matching and most deterministic answers currently run in **F/services/voiceTranscript.js**, not Agent | A future dispatcher would need authenticated actor/role, resolved resource IDs, requested action, confirmation record for high risk, backend gate/stock preconditions, denial reason and definitive backend result under one correlation/idempotency key. Logging STT alone misses frontend-local decisions. |

**Backend counterpart:** `B/premeltGate/store.js` already exposes `log`, stock movements and `audit()`; GET `/premelt/audit` is displayed by Pre-Melt Gate. Gate checks/start/override, QA/disposition, PR lifecycle and completion/invoices have domain log points. Node owns authoritative pre-melt/stock/sales side effects, so an Agent-side log must correlate to Node's definitive response and movement/resource IDs. It must not claim an action succeeded because speech was recognized, an RL feedback request succeeded, or browser `acceptStrategy` ran. Seed/reset and process restart can remove Node's in-memory audit/history; Agent JSONL is an existing feedback log, not a complete durable plant action audit service.

## Verification boundary

Static cross-check covered Sidebar/App route membership, each listed component and its nested mutation controls, service URL construction, Node route mounts/domain guards, voice dispatch/adapters, auth stubs and Agent feedback logging. No runtime behavior, deployed feature flags, provider health or real instrument values were tested. No code/config/tests changed and no staging, commits or pushes were performed. Documentation is the only intended new artifact.
