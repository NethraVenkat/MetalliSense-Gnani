# F17 voice actions

Builder: Manish (actions). Draft ASK wording: Nethra. Local implementation; no staging, commit, push or live provider calls.

## Action registry

| ID | Page | Phrase | Level | Roles | Existing service |
|---|---|---|---|---|---|
| request_reading | /spectrometer | request reading | RUN | [] | requestOPCReading |
| gate_check | /premelt-gate | run gate check | RUN | [] | runGateCheck |
| deviation_analyze | /anomaly | run analysis | RUN | [] | predictAnomaly |
| deviation_explain | /anomaly | explain | RUN | [] | getExplanation |
| correction_plan | /recommendation | generate plan | RUN | [] | analyzeIndividual |
| correction_explain | /recommendation | explain | RUN | [] | getExplanation |
| full_analysis | /full-analysis | run full analysis | RUN | [] | runFullAnalysis |
| agent_analyze | /agent | run analysis | RUN | [] | analyzeAgent |
| agent_explain | /agent | explain | RUN | [] | explainResult |
| mechanical_predict | /mechanical-properties | predict | RUN | [] | predictMechanical |
| supplier_plan | /supplier-scorecard | plan | RUN | [] | getOrderPlan |
| gun_connect | /yard-inspection | connect gun | RUN | [] | connectGun |
| gun_disconnect | /yard-inspection | disconnect gun | RUN | [] | disconnectGun |
| energy_meter | /energy | read meter | RUN | [] | simulateHeatEnergy |
| semantic_search | /semantic-search | search | ASK | [] | semanticSearch |
| start_melting | /premelt-gate | start melting | APPROVE | ['Supervisor','Unit Controller'] | startMelting |
| approve_pr | /inventory-forecast | approve pr | APPROVE | ['Manager'] | approvePurchaseRequest |
| reject_pr | /inventory-forecast | reject pr | APPROVE | ['Manager'] | rejectPurchaseRequest |
| approve_dri_qa | /raw-material-stock | approve dri qa | APPROVE | ['Supervisor','Manager'] | approveDriQa |
| reject_dri_qa | /raw-material-stock | reject dri qa | APPROVE | ['Supervisor','Manager'] | rejectDriQa |
| inspect_lot | /yard-inspection | inspect lot | APPROVE | ['Supervisor'] | startInspection |

## Gates and target handling

All handlers use the existing page service functions. New action responses update page state only after successful HTTP completion. IDs and loaded/current selection must resolve uniquely; missing/ambiguous targets produce one spoken clarification/refusal, with no guessed target or execution. Spoken digit aliases reuse spokenNumbers. Read-back includes IDs and available quantities/composition; missing required inputs refuse.

Spectrometer requires OPC connected. Gate check requires saved PLANNED charge. Start melting reloads the heat before read-back and again before execution: PLANNED, GO/WARN, same gate ID, valid time, no stale/dirty charge; WARN requires acknowledge. HOLD never starts and cannot reach the override endpoint. Existing backend freshness, fingerprint, stock and maker/checker checks remain final authority. Operator/approver/inspector names come from consumed passcode identity. Rejections require a separate reason of at least five characters before passcode. Inspection uses the current page device/pieces/surface fields and read-back warns of status change. Energy read-meter explicitly says simulated. Search is ASK with no confirmation, using the same collection/search service, reading up to three available result titles/text. Order plan is calculation only, no order placement.

RUN keeps the eight-second ready confirmation window; APPROVE keeps private passcode capture, server-owned roles, one-use token and five-second Cancel countdown. Stale page scopes refuse before execution. Backend failures/refusals never become Completed; audit records HTTP status and available IDs. A request accepted asynchronously (inspection) means the backend accepted the request, not that later inspection succeeded. Mechanical voice prediction requires the successful existing API response; it does not claim the page's local fallback as backend success.

## Never by voice

Delete/remove, reset demo, HOLD/engineer override/bypass, clear chat, edit grade/price/training, receive lot/additive, DRI lab entry, manual lot release/reject, issue invoice, approve tap, accept strategy, apply AHP/criteria weights. Registered QA/PR rejection is the specific reviewed workflow, never manual lot disposition. No alternate mutation endpoint was introduced.

## Flags and limits

Existing defaults stay off: VITE_VOICE_ACTIONS / VOICE_ACTIONS_ENABLED; audit must also be enabled on both sides. Existing VITE_VOICE_PAGE_ANSWERS gates draft ASK answers. Restart Agent and frontend after changing local flags. No environment settings or credential values were changed.

Spoken passcodes are observable and these role identities are not real authenticated plant authorization. The existing plant backend still uses Guest/no role-authentication; the server-side voice role check is not a replacement for that missing protection. Audit outcomes are client-reported, not independent evidence of plant execution. Request service reuse preserves backend validation but does not repair pre-existing backend authorization gaps. New action phrase recognition is English and uses the existing STT text; Tamil/Hindi ASK wording remains DRAFT.

The two sidebar utilities are not routed data pages: Onboard Tour retains its existing narration/controller, and Technical Documentation points outside the app. Remote guide content is not loaded and is not invented. The 19 routed non-Dashboard pages have draft field adapters. A missing detail/selection/result stays unavailable.

## Review and verification

Full results, per-builder file inventory and remaining live checks are recorded in OVERNIGHT_REPORT_F17.md. Contact-sheet images under DOCS/screenshots/f17 are explicitly mocked; no physical mic/passcode/plant validation is implied.
