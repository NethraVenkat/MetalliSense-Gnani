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

Spectrometer requires OPC connected. Gate check requires saved PLANNED charge. Normal start melting reloads the heat before read-back and again before execution: PLANNED, GO/WARN, same gate ID, valid time, no stale/dirty charge; WARN requires acknowledge. Normal start never overrides HOLD. F17B adds a separate Unit Controller-only HOLD override workflow below. Existing backend freshness, fingerprint, stock and maker/checker checks remain final authority. Operator/approver/inspector names come from consumed passcode identity. PR/QA rejections require a separate reason of at least five characters before passcode; manual lot dispositions require ten. Inspection uses the current page device/pieces/surface fields and read-back warns of status change. Energy read-meter explicitly says simulated. Search is ASK with no confirmation, using the same collection/search service, reading up to three available result titles/text. Order plan is calculation only, no order placement.

RUN keeps the eight-second ready confirmation window; APPROVE keeps private passcode capture, server-owned roles, one-use token and five-second Cancel countdown. Stale page scopes refuse before execution. Backend failures/refusals never become Completed; audit records HTTP status and available IDs. A request accepted asynchronously (inspection) means the backend accepted the request, not that later inspection succeeded. Mechanical voice prediction requires the successful existing API response; it does not claim the page's local fallback as backend success.

## Never by voice

CSV ingestion/file upload stays screen-only. F17B replaces the previous blanket exclusions only with the explicit page-scoped, role-checked workflows in the table below. Other mutations, arbitrary bypasses, compound commands and actions outside their registered page remain refused; no generic mutation executor exists.

## Flags and limits

Existing defaults stay off: VITE_VOICE_ACTIONS / VOICE_ACTIONS_ENABLED; audit must also be enabled on both sides. Existing VITE_VOICE_PAGE_ANSWERS gates draft ASK answers. Restart Agent and frontend after changing local flags. No environment settings or credential values were changed.

Spoken passcodes are observable and these role identities are not real authenticated plant authorization. The existing plant backend still uses Guest/no role-authentication; the server-side voice role check is not a replacement for that missing protection. Audit outcomes are client-reported, not independent evidence of plant execution. Request service reuse preserves backend validation but does not repair pre-existing backend authorization gaps. F17B adds Tamil, Tanglish and Hindi action aliases and selected-language spoken read-backs; IDs/numbers remain English in display summaries. Native speech quality still needs real listening checks.

The two sidebar utilities are not routed data pages: Onboard Tour retains its existing narration/controller, and Technical Documentation points outside the app. Remote guide content is not loaded and is not invented. The 19 routed non-Dashboard pages have draft field adapters. A missing detail/selection/result stays unavailable.

## Review and verification

Full results, per-builder file inventory and remaining live checks are recorded in OVERNIGHT_REPORT_F17.md. Contact-sheet images under DOCS/screenshots/f17 are explicitly mocked; no physical mic/passcode/plant validation is implied.


## F17B scope change (2026-11-04)

Builder: Manish. Existing defaults remain off. All rows below are APPROVE: collect missing required fields individually, read back the full submitted draft, private passcode/role verification, optional exact confirmation word, five-second Cancel, existing service, then audit the actual HTTP result. There is no extra yes/no step for APPROVE. RUN retains yes/ok/okay, Tamil yes/no and Hindi yes/no; ASK has no approval. Confirmation words are spoken literally as written, not translated. They are bound to the action/session/token on the Agent before token consumption. This is a sequence check, not independent proof of the voice or plant identity.

| ID | Page | English phrase | Roles | Existing service | Extra word after passcode |
|---|---|---|---|---|---|
| accept_strategy | /rl-optimizer, /full-analysis | accept balanced/conservative/aggressive strategy | Supervisor / Manager | acceptHeatStrategy | None |
| approve_tap | /mechanical-properties | approve tap for H-xxxx | Supervisor / Manager | completeHeat | None |
| receive_lot | /raw-material-stock | receive truck | Operator / Supervisor | receiveLot | None |
| receive_alloy | /raw-material-stock | receive alloy batch | Operator / Supervisor | receiveFerroalloy | None |
| dri_entry | /raw-material-stock | dri lab entry | Operator / Supervisor | enterDriQa | None |
| plan_heat | /premelt-gate | plan heat | Operator / Supervisor | planHeat | None |
| edit_charge | /premelt-gate | edit charge | Operator / Supervisor | updateCharge | None |
| create_pr | /inventory-forecast | create pr | Operator / Supervisor | createPurchaseRequest | None |
| issue_invoice | /sales | issue invoice | Manager | createInvoice | None |
| create_grade | /grades | create grade spec | Manager | createGradeSpec | None |
| edit_grade | /grades | edit grade spec | Manager | updateGradeSpec | None |
| edit_prices | /cost-analysis | edit prices | Manager | updatePrices | None |
| create_training | /training-data | create training sample | Supervisor / Manager | createTrainingData | None |
| edit_training | /training-data | edit training sample | Supervisor / Manager | updateTrainingData | None |
| apply_ahp | /supplier-scorecard | apply ahp weights | Manager | updateSupplierAhp | None |
| apply_weights | /supplier-scorecard | apply criteria weights | Manager | updateSupplierWeights | None |
| release_lot | /raw-material-stock | manual lot release | Manager | setLotStatus | None |
| reject_lot | /raw-material-stock | manual lot reject | Manager | setLotStatus | None |
| replace_argon | /yard-inspection | replace argon | Operator / Supervisor | replaceArgon | None |
| override_start | /premelt-gate | hold override start | Unit Controller | startMelting | OVERRIDE |
| delete_reading | /spectrometer | delete reading | Supervisor / Manager | deleteReading | DELETE |
| delete_grade | /grades | delete grade spec | Supervisor / Manager | deleteGradeSpec | DELETE |
| delete_training | /training-data | delete training sample | Supervisor / Manager | deleteTrainingData | DELETE |
| reset_demo | /premelt-gate | reset demo | Manager | resetDemo | RESET |
| clear_chat | /anomaly | clear chat history | Supervisor / Manager | clearChatHistory | CLEAR |
| clear_chat | /recommendation | clear chat history | Supervisor / Manager | clearChatHistory | CLEAR |

### Field collection and safety

Optional fields from an open page form are retained and read back; absent optional fields use the existing service defaults. Mandatory values cannot be skipped: `skip` explains the requirement and allows another answer; `cancel` stops without execution. No guessed IDs, wake boundaries, material quantities or operator identities are generated. Missing required values are asked separately. Repeated invalid answers refuse; no unlimited loop or write occurs during collection.

Receiving collects material/alloy and kilograms. DRI entry collects the lot and Fe total/metallic, C/S/P, checks the existing unusual-value warnings and requires explicit confirmation; a changed lot snapshot refuses. Heat planning/charge editing collects grade/target and individual lot/quantity lines. Charge edits require PLANNED; save uses the loaded page draft. PR, invoice, grade ranges, price, training sample and weights use their existing service schemas. Grade/training edits ask for a loaded target, allowed field and value; the full resulting record is read back. AHP reads back derived weights and CR and requires CR below 0.1. Direct criteria weights report CR as not applicable, rather than inventing an AHP result.

Manual lot decisions require a reason of at least ten characters and Manager identity, including grade-D decisions. The separate HOLD override requires Unit Controller, a reason of at least max(20, configured minimum), a fresh PLANNED HOLD gate with unchanged ID, valid time and saved charge, and the literal read-back warning **This overrides a HOLD gate**. After passcode it requires OVERRIDE and the countdown; engineer/operator are the verified identity. Normal start never obtains this exemption. Existing backend validation remains final.

Strategy acceptance now shares one stock transaction between regular and mock routes. It converts the accepted candidate's quantities using the heat's metal mass, prevalidates aggregate availability and rolls back on failure. Only verified deduction evidence marks the UI deducted/accepted. Identical stock transactions are idempotent; changed candidate retries refuse. Policy feedback follows a successful transaction and a feedback failure reports a warning, not stock failure; a manual repeat can submit feedback again, although stock is not rededucted. Tap completion no longer promotes PLANNED via resume:true and requires MELTING, including the voice path.

### Native phrases and review

The shared alias map covers every page action in the registry in Tamil, Tanglish and Hindi, including reading, gate check, melting, PR approval and the scoped forms. Examples: reading aliases, gate-check aliases, PR approval aliases and their IDs are regression-tested. Spoken form labels/read-backs follow the selected language; all submitted values remain visible in the English display summary. Technical field names or user-entered text may remain untranslated. No live STT/TTS or plant action was invoked during implementation.

Mocked contact sheets: screenshots/f17b/form.png, screenshots/f17b/hold-override.png and screenshots/f17b/delete.png. They exercise production card rendering with synthetic controller states, not real authorization, listening or execution. Full per-part file inventory and verification: OVERNIGHT_REPORT_F17B.md.


### Registered native phrase reference

Append the target ID before or after these aliases; a missing required form field is asked separately. English canonical phrases remain supported. These are explicit aliases, not unrestricted language understanding.

| Action | Tamil | Tanglish | Hindi |
|---|---|---|---|
| request_reading | ரீடிங் எடு | reading edu | रीडिंग लो |
| gate_check | கேட் செக் பண்ணு | gate check pannu | गेट चेक करो |
| deviation_analyze | பகுப்பாய்வு பண்ணு | analysis pannu | विश्लेषण करो |
| deviation_explain | விளக்கி சொல்லு | vilakki sollu | समझाओ |
| correction_plan | பிளான் போடு | plan podu | प्लान बनाओ |
| correction_explain | விளக்கி சொல்லு | vilakki sollu | समझाओ |
| full_analysis | முழு பகுப்பாய்வு பண்ணு | full analysis pannu | पूरा विश्लेषण करो |
| agent_analyze | பகுப்பாய்வு பண்ணு | analysis pannu | विश्लेषण करो |
| agent_explain | விளக்கி சொல்லு | vilakki sollu | समझाओ |
| mechanical_predict | கணிச்சு சொல்லு | predict pannu | अनुमान करो |
| supplier_plan | ஆர்டர் பிளான் | order plan pannu | ऑर्डर प्लान |
| gun_connect | கன் கனெக்ட் பண்ணு | gun connect pannu | गन कनेक्ट करो |
| gun_disconnect | கன் டிஸ்கனெக்ட் பண்ணு | gun disconnect pannu | गन डिस्कनेक्ट करो |
| energy_meter | மீட்டர் ரீடிங் எடு | meter reading edu | मीटर पढ़ो |
| semantic_search | தேடு | thedu | खोजो |
| start_melting | மெல்ட்டிங் ஸ்டார்ட் பண்ணு | melting start pannu | मेल्टिंग शुरू करो |
| approve_pr | PR அப்ரூவ் பண்ணு | PR approve pannu | PR अप्रूव करो |
| reject_pr | PR ரிஜெக்ட் பண்ணு | PR reject pannu | PR रिजेक्ट करो |
| approve_dri_qa | DRI QA அப்ரூவ் பண்ணு | DRI QA approve pannu | DRI QA अप्रूव करो |
| reject_dri_qa | DRI QA ரிஜெக்ட் பண்ணு | DRI QA reject pannu | DRI QA रिजेक्ट करो |
| inspect_lot | லாட் இன்ஸ்பெக்ட் பண்ணு | lot inspect pannu | लॉट निरीक्षण करो |
| accept_strategy | ஸ்ட்ராடஜி ஏற்றுக்கொள் | strategy accept pannu | रणनीति स्वीकार करो |
| approve_tap | டேப் அப்ரூவ் பண்ணு | tap approve pannu | टैप अप्रूव करो |
| receive_lot | லாட் வரவு பதிவு பண்ணு | lot receive pannu | लॉट प्राप्त करो |
| receive_alloy | அலாய் பேட்ச் வரவு பதிவு பண்ணு | alloy batch receive pannu | अलॉय बैच प्राप्त करो |
| dri_entry | DRI லேப் பதிவு பண்ணு | DRI lab entry pannu | DRI लैब दर्ज करो |
| plan_heat | ஹீட் பிளான் பண்ணு | heat plan pannu | हीट प्लान करो |
| edit_charge | சார்ஜ் திருத்து | charge edit pannu | चार्ज बदलो |
| create_pr | PR உருவாக்கு | PR create pannu | PR बनाओ |
| issue_invoice | இன்வாய்ஸ் போடு | invoice podu | इनवॉइस बनाओ |
| create_grade | கிரேட் ஸ்பெக் உருவாக்கு | grade spec create pannu | ग्रेड स्पेक बनाओ |
| edit_grade | கிரேட் ஸ்பெக் திருத்து | grade spec edit pannu | ग्रेड स्पेक बदलो |
| edit_prices | விலை திருத்து | price edit pannu | कीमत बदलो |
| create_training | ட்ரெயினிங் சாம்பிள் உருவாக்கு | training sample create pannu | ट्रेनिंग सैंपल बनाओ |
| edit_training | ட்ரெயினிங் சாம்பிள் திருத்து | training sample edit pannu | ट्रेनिंग सैंपल बदलो |
| apply_ahp | AHP வெயிட் பயன்படுத்து | AHP weights apply pannu | AHP वेट लागू करो |
| apply_weights | கிரைடீரியா வெயிட் பயன்படுத்து | criteria weights apply pannu | मानदंड वेट लागू करो |
| release_lot | லாட் ரிலீஸ் பண்ணு | lot release pannu | लॉट रिलीज करो |
| reject_lot | லாட் ரிஜெக்ட் பண்ணு | lot reject pannu | लॉट रिजेक्ट करो |
| replace_argon | ஆர்கான் மாற்று | argon replace pannu | आर्गन बदलो |
| override_start | ஹோல்ட் ஓவர்ரைடு செய்து ஸ்டார்ட் பண்ணு | hold override start pannu | होल्ड ओवरराइड करके शुरू करो |
| delete_reading | ரீடிங் நீக்கு | reading delete pannu | रीडिंग हटाओ |
| delete_grade | கிரேட் ஸ்பெக் நீக்கு | grade spec delete pannu | ग्रेड स्पेक हटाओ |
| delete_training | ட்ரெயினிங் சாம்பிள் நீக்கு | training sample delete pannu | ट्रेनिंग सैंपल हटाओ |
| reset_demo | டெமோ ரீசெட் பண்ணு | demo reset pannu | डेमो रीसेट करो |
| clear_chat | சாட் வரலாறு நீக்கு | chat clear pannu | चैट इतिहास साफ करो |
