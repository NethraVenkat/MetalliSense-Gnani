# F14 v4 FINAL voice onboarding tour

2026-11-01 (Asia/Calcutta). Owner: Nethra. No commit. **0 live calls.** This team-approved script supersedes all previous F14 narration.

## Final script contract

The table below records the approved visible script. The F14b Tamil B spellings and the later Latin technical-word corrections below apply to speech only; authored display text remains unchanged. Foundry digit IDs may receive pronunciation expansion; these lines contain no IDs. No general lexicon rewrites, register substitutions or sentence splitting are applied to tour narration, including inside the speech queue. Punctuation and quotes remain intact. F13a page-help texts, safety words/order, gate logic, other answers, STT/TTS settings, local env files and README are unchanged.

The v3 Dashboard shift-summary sentence logic is removed. The v4 script is independent of VITE_SHIFT_SUMMARY and other optional feature flags. Only step 8 is conditional on VITE_HANDOVER: without it Finish is step 21. Route order, sidebar card names, tour mode, autonomous timing, pause/resume, mute and scoped cancellation remain unchanged. Charge Optimizer is excluded. Narration never enters command mapping and cannot trigger writes or checks.

VITE_VOICE_TOUR and VITE_VOICE_EVERYWHERE remain required and default false. VITE_SHOW_VOICE_PANEL still controls mounting.

## Team-approved script

| Step / card | Route | Tamil | Hindi | English | Team OK / fix |
|---|---|---|---|---|---|
| 1: Dashboard | /dashboard | வணக்கம், நான் குரல். இது டாஷ்போர்டு. பிளான்ட்ல என்ன நடக்குதுன்னு இங்கே பாக்கலாம். | नमस्ते, मैं कुरल हूँ। यह डैशबोर्ड है। प्लांट में क्या चल रहा है, यहाँ देख सकते हैं। | Hello, I'm Kural. This is the dashboard. You can see what's happening in the plant here. | |
| 2: Spectrometer | /spectrometer | இது ஸ்பெக்ட்ரோ மீட்டர். மெட்டல்ல ஒவ்வொரு எலிமென்ட்டும் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | यह स्पेक्ट्रो मीटर है। धातु में हर एलिमेंट कितना है, यहाँ देख सकते हैं। | This is the spectrometer. You can see how much of each element is in the metal. | |
| 3: Grade Specs | /grades | இது கிரேடு ஸ்பெக்ஸ். ஒவ்வொரு இரும்பு கிரேடுக்கும் தேவையான எலிமென்ட் அளவு இங்கே இருக்கு. | यह ग्रेड स्पेक्स है। हर आयरन ग्रेड के लिए ज़रूरी एलिमेंट की मात्रा यहाँ है। | This is grade specs. It shows the element limits for each iron grade. | |
| 4: Supplier Scorecard | /supplier-scorecard | இது சப்ளையர் ஸ்கோர் கார்டு. தரம், விலை, டெலிவரி வெச்சு சப்ளையர் ரேட்டிங் பாக்கலாம். | यह सप्लायर स्कोरकार्ड है। क्वालिटी, कीमत और डिलीवरी के हिसाब से सप्लायर की रेटिंग देख सकते हैं। | This is the supplier scorecard. It rates suppliers on quality, price and delivery. | |
| 5: Raw Material Stock | /raw-material-stock | இது ரா மெட்டீரியல் ஸ்டாக். பிக் அயர்ன், ஸ்க்ராப், அலாய் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | यह रॉ मटेरियल स्टॉक है। पिग आयरन, स्क्रैप और अलॉय कितना है, यहाँ देख सकते हैं। | This is raw material stock. You can see how much pig iron, scrap and alloy we have. | |
| 6: Yard Inspection (XRF/LIBS) | /yard-inspection | இது யார்டு இன்ஸ்பெக்ஷன். வந்த ஸ்க்ராப் லாட்டோட செக் ரிசல்ட் இங்கே பாக்கலாம். | यह यार्ड इंस्पेक्शन है। आए हुए स्क्रैप लॉट की जाँच का रिज़ल्ट यहाँ देख सकते हैं। | This is yard inspection. You can see the check results for incoming scrap lots. | |
| 7: Pre-Melt Gate | /premelt-gate | இது ப்ரீ மெல்ட் கேட். மெல்ட் ஆரம்பிக்கும் முன் கோ, வார்ன், ஹோல்ட் முடிவு காட்டும். ஹோல்ட் வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன். | यह प्री मेल्ट गेट है। मेल्ट से पहले गो, वार्न या होल्ड का रिज़ल्ट दिखाता है। होल्ड आने पर मेल्ट शुरू नहीं होगा, और मैं तुरंत अलर्ट दूँगी। | This is the pre-melt gate. It shows go, warn or hold before melting. On hold, melting can't start, and I'll alert you right away. | |
| 8: Shift handover | /premelt-gate | இது ஷிஃப்ட் ஹேண்டோவர். போன ஷிஃப்ட்ல சொன்னது இங்கே வரும், கேட் நிலையோட சரிபாக்கும். | यह शिफ्ट हैंडओवर है। पिछली शिफ्ट की बातें यहाँ आती हैं और गेट स्टेटस से मिलाई जाती हैं। | This is the shift handover. It shows what the last shift said and checks it against the gate status. | |
| 9: Composition Deviation Analysis | /anomaly | இது காம்போசிஷன் டிவியேஷன். மெட்டல் அளவு லிமிட்ல இருந்து எவ்வளவு மாறியிருக்குன்னு காட்டும். | यह कंपोज़िशन डेविएशन है। धातु की रीडिंग तय लिमिट से कितनी अलग है, यह दिखाता है। | This is composition deviation. It shows how far the metal readings are from the limits. | |
| 10: Melt Correction Planner | /recommendation | இது மெல்ட் கரெக்ஷன் பிளானர். மெட்டல சரியான அளவுக்கு கொண்டு வர என்ன சேர்க்கணும்னு சொல்லும். | यह मेल्ट करेक्शन प्लानर है। धातु को सही स्तर पर लाने के लिए क्या मिलाना है, यह बताता है। | This is the melt correction planner. It suggests what to add to bring the metal into range. | |
| 11: Adaptive Strategy Optimizer | /rl-optimizer | இது அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர். பல வழிகளை ஒப்பிட்டு, செலவுக்கும் தரத்துக்கும் சிறந்ததை தேர்ந்தெடுக்கும். | यह एडैप्टिव स्ट्रैटेजी ऑप्टिमाइज़र है। अलग-अलग तरीकों की तुलना करके कॉस्ट और क्वालिटी के लिए सबसे अच्छा चुनता है। | This is the adaptive strategy optimizer. It compares methods and picks the best for cost and quality. | |
| 12: Full Analysis | /full-analysis | இது ஃபுல் அனாலிசிஸ். எல்லா தகவலும் ஒரே ரிப்போர்ட்ல பாக்கலாம். | यह फुल एनालिसिस है। सारी जानकारी एक ही रिपोर्ट में देख सकते हैं। | This is full analysis. You can see everything in one report. | |
| 13: AI Agent Analysis | /agent | இது ஏ ஐ ஏஜென்ட். முழு மெல்ட்டையும் பாத்து ஒரு சின்ன சுருக்கம் சொல்லும். | यह ए आई एजेंट है। पूरे मेल्ट को देखकर एक छोटा सारांश देता है। | This is the AI agent. It reviews the whole melt and gives a short summary. | |
| 14: Energy per Heat | /energy | இது எனர்ஜி. ஒவ்வொரு ஹீட்டுக்கும் எவ்வளவு கரண்ட் தேவை, எவ்வளவு ஆச்சுன்னு பாக்கலாம். | यह एनर्जी है। हर हीट में कितनी बिजली चाहिए और कितनी लगी, यहाँ देख सकते हैं। | This is energy. You can see how much power each heat needs and how much it used. | |
| 15: Mechanical Properties | /mechanical-properties | இது மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ். டெஸ்ட்க்கு முன்னாடியே காஸ்டிங்கோட வலிமை, கடினம் கணிக்கும். | यह मैकेनिकल प्रॉपर्टीज़ है। टेस्ट से पहले कास्टिंग की मज़बूती और हार्डनेस का अनुमान देता है। | This is the mechanical properties page. It predicts casting strength and hardness before testing. | |
| 16: Sales & Dispatch | /sales | இது சேல்ஸ் அண்ட் டிஸ்பேட்ச். முடிஞ்ச ஹீட், டெஸ்ட் சர்டிஃபிகேட், கஸ்டமர் பில் இங்கே பாக்கலாம். | यह सेल्स और डिस्पैच है। तैयार हीट, टेस्ट सर्टिफिकेट और कस्टमर बिल यहाँ देख सकते हैं। | This is sales and dispatch. You can see finished heats, test certificates and customer bills. | |
| 17: Inventory Forecast | /inventory-forecast | இது இன்வென்டரி ஃபோர்காஸ்ட். எந்த மெட்டீரியல் எப்போ தீரும்னு முன்னாடியே காட்டும். அப்ரூவல் அனுமதி உள்ளவங்க ஸ்கிரீன்ல செய்வாங்க. | यह इन्वेंटरी फोरकास्ट है। कौन सा मटेरियल कब खत्म होगा, पहले से दिखाता है। अप्रूवल अधिकृत लोग स्क्रीन पर करते हैं। | This is the inventory forecast. It shows when each material may run out. Approvals are done on screen by authorised staff. | |
| 18: Cost Analysis | /cost-analysis | இது காஸ்ட் அனாலிசிஸ். மெட்டீரியல், எலிமென்ட் விலை எல்லாம் இங்கே இருக்கு. | यह कॉस्ट एनालिसिस है। मटेरियल और एलिमेंट की कीमतें यहाँ हैं। | This is cost analysis. It shows the prices of materials and elements. | |
| 19: Synthetic Data | /synthetic | இது சிந்தெடிக் டேட்டா. டெஸ்ட்க்காக மாதிரி டேட்டா உருவாக்கும், இது உண்மையான ஃபேக்டரி டேட்டா இல்ல. | यह सिंथेटिक डेटा है। टेस्टिंग के लिए सैंपल डेटा बनाता है, यह असली फैक्ट्री डेटा नहीं है। | This is synthetic data. It creates sample data for testing, not real factory data. | |
| 20: Training Data | /training-data | இது ட்ரெயினிங் டேட்டா. ஏ ஐ மாடல் கத்துக்கிட்ட பழைய ரீடிங் எல்லாம் இங்கே இருக்கு. | यह ट्रेनिंग डेटा है। ए आई मॉडल ने जिन पुरानी रीडिंग से सीखा, वो यहाँ हैं। | This is training data. These are the past readings our AI learned from. | |
| 21: Semantic Search | /semantic-search | இது செமான்டிக் சர்ச். சாதாரணமா டைப் பண்ணினாலே பழைய ரெக்கார்டு கிடைக்கும். | यह सिमैंटिक सर्च है। आम भाषा में लिखिए, पुराने रिकॉर्ड मिल जाएँगे। | This is semantic search. Type in plain words to find past records. | |
| 22: Finish | Finish | டூர் முடிஞ்சது. தமிழ், ஹிந்தி, இங்கிலீஷ், எதுல வேணும்னாலும் பேசுங்க. நான் ரெடி. | टूर पूरा हुआ। तमिल, हिंदी या इंग्लिश, किसी में भी बोलिए। मैं तैयार हूँ। | Tour complete. Speak in Tamil, Hindi or English. I'm ready to help. | |

## Audio: prepared offline for the team

The tool now uses a fresh `app/data/tts_cache/f14_tour_sheet/results-v4.json` journal, independent of previous versions. Only a cache-only preparation was run here: **0 TTS calls, 0 STT calls, 0/66 cached v4 clips**. No diagnostic request was attempted. The index displays exact v4 text and pending audio; old clips are not offered against changed narration.

Index: `app/data/tts_cache/f14_tour_sheet/index.html`.

For the team's network-enabled run, from the Agent directory:

```
python tools/f14_tour_sheet.py --max-calls 70
```

Live mode makes one diagnostic first. A failed diagnostic stops synthesis and prints the captured status/error, with an explicit NETWORK/SOCKET ERROR message when no HTTP response is received. After a successful diagnostic, synthesis is cache-first and sequential, with at least 1.1 seconds between request starts and a persisted cumulative maximum of 70 attempts. Kalpana v3.0, default speed and no tags are retained. Successful audio is also written into the normal TTS cache. Cache-only preparation does not prevent later synthesis of missing clips. V4 listening review remains with the team.

## Files changed and tests

Changed: frontend `src/services/voiceTour.js`, `tests/voice-tour.test.jsx`; fixture renamed from `tests/fixtures/f14-v3-script.json` to `tests/fixtures/f14-v4-script.json`; Agent `tools/f14_tour_sheet.py` and this document. Earlier uncommitted F14 changes remain intact.

Exact-script tests cover all 66 v4 strings, unchanged Dashboard text with the shift-summary flag both on and off, optional handover/order, digit-ID-only pronunciation, punctuation and queue payload preservation. Obsolete v3 sentence-drop tests were replaced. Existing tour-mode safety, read-only boundaries and playback/cancellation checks remain.

## Verification

- `npx vitest run --configLoader runner`: **1070 passed**, 15 files, **25.84 s**.
- `npm run build -- --configLoader runner`: **passed**, 2,821 modules, **9.59 s**.
- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **17.39 s**.
- Python compilation and `git diff --check`: passed.
- Offline sheet validation: all 66 texts match the supplied v4 table; v4 journal has zero calls and no diagnostic entry; no stale audio players.

No commit. No live calls. Audio generation is left to the team.

## F14b Tamil respelling audition

2026-11-01. Owner: Nethra. No commit. **0 live calls.** The approved v4 display script is unchanged. New `tools/f14b_tamil_respell.py` prepares 20 words with A/B/C variants in the exact carrier sentence, 60 clips total. Output: `app/data/tts_cache/f14b_respell/index.html`; journal: `results.json` in that directory. Cache-only preparation has zero calls and 60 pending clips. Nothing has been selected or applied automatically.

From the Agent directory, the team's network-enabled command is:

```
python tools/f14b_tamil_respell.py --max-calls 60
```

Default execution (`--max-calls 0`) is cache-only. Live mode uses one diagnostic first (also clip 01_A, so a cold sheet fits 60 calls), then cache-first sequential synthesis with at least 1.1 seconds between request starts. The cumulative journal reserves attempts before HTTP and never exceeds 60. Diagnostic failure stops the run and prints exact HTTP status/error or a clear NETWORK/SOCKET ERROR when there is no response. Production Kalpana v3.0, ta-IN, default speed and no tags are required; mock silence is rejected. Successful clips populate the normal TTS cache.

Review outcome: the user selected B for all 20 terms. Frontend `tourSpokenOverrides.ta` in `src/services/voiceTour.js` contains those spellings. They affect Tamil speech only; display text remains unchanged. Only Tamil speech is affected; Hindi/English speech and every display text remain unchanged. Matching uses literal whole words/phrases, longest first, in one pass; English replacements do not trigger another lexicon rewrite. Inflected words require their own exact entries.

Changed for F14b: new Agent `tools/f14b_tamil_respell.py` and `tests/test_f14b_respell.py`; frontend `src/services/voiceTour.js` and `tests/voice-tour.test.jsx`; this document. Six offline Python tests cover carrier construction, zero-network cache-only mode, sixty-call budget/spacing/cache reuse, and socket/HTTP failure handling. Frontend tests cover the approved map, Tamil-only override behavior, unchanged display, phrase matching and digit-ID pronunciation.

F14b verification:

- `npx vitest run --configLoader runner`: **1072 passed**, 15 files, **63.25 s**.
- `npm run build -- --configLoader runner`: **passed**, 2,821 modules, **30.84 s**.
- `python -m pytest tests -q`: **220 passed**, 12 existing warnings, **17.58 s** (six new mocked audition-tool tests).
- Python compilation, sheet text/journal checks and `git diff --check`: passed.
- **0 live calls**, no diagnostic request, no generated production audio, no commit.

## Resume audit: Tamil speech-only overrides and offline audio status

2026-11-01. This audit preserves the existing working changes; it does not attribute earlier edits beyond the owner stated in the existing F14b report. The local v4 script table above has been checked against `MetalliSense_Frontend_R/MetalliSense_Frontend/tests/fixtures/f14-v4-script.json`; it contains the approved visible Tamil wording. `tourStepText` reads that display text unchanged. `tourSpokenText` applies `tourSpokenOverrides.ta` only to speech.

All 20 approved B choices are traceable to the F14b request's A/B/C list, the local audition tool's `WORDS` table, the F14b report's recorded user selection, and `tests/test_f14b_respell.py` expected map. The frontend override map contains all 20 entries. No choice was inferred or added in this audit.

The F14 v4 offline metadata journal is `app/data/tts_cache/f14_tour_sheet/offline-respell-journal-03.json`. It covers **19 affected Tamil tour clips** (the twentieth term does not add another affected clip). Counts: **0 current, 0 missing, 19 stale**. Each stale file is still present and has a recorded SHA-256; `regeneration_status` is `not_regenerated`. The newest v4 manifest has 47 successful clips and 19 failed rows; the affected clips' prior successful provenance is from v3 and contains earlier spoken text. No stale clip is presented as regenerated or verified. The v4 sheet has 66 WAV files total; non-target current v4 audio is preserved.

The runtime tour remains available with its normal speech path: tour text is sent through `speakText` with pronunciation-only processing, and cache misses follow the existing speech synthesis/fallback behavior. The offline audit did not synthesize or prove current provider availability. No existing audio was deleted or overwritten.

**API-budget blocker:** no Gnani request, availability probe or TTS retry was made. The v4 journal records 66 prior attempts, including 19 `TTS call budget exhausted` failures with no HTTP response; that is local journal evidence, not confirmation of the provider account's current quota. The selected clips remain stale, and listening verification is pending.

The selective repair CLI validates the full explicit list against the journal and current display/spoken text before loading TTS configuration. `--live` is mandatory for synthesis; without it, this is a dry-run. It accepts only up to 19 journaled affected Tamil IDs and never expands the selection. Matching cache files are keyed by the exact spoken text and current model, voice, language, rate, speed and style; unsupported TTS settings do not count as cache hits. Invalid WAVs are misses. The run is sequential, waits at least 1.1 seconds between provider requests, sends at most one request per clip, and stops on the first provider/audio/install error. New WAVs are staged and validated before cache/target replacement; previous targets are backed up under `app/data/tts_cache/f14_tour_sheet/recovery/`. Provenance appends to `results-selective.json`; matching successes are skipped on resume. The original v4/v3 and offline journals are not overwritten.

From the Agent directory, the exact currently approved selection is:

```powershell
$ids = @('01_dashboard_ta','02_spectrometer_ta','03_grades_ta','04_supplier-scorecard_ta','05_raw-material-stock_ta','06_yard-inspection_ta','07_premelt-gate_ta','08_handover_ta','09_anomaly_ta','10_recommendation_ta','11_rl-optimizer_ta','12_full-analysis_ta','15_mechanical-properties_ta','16_sales_ta','17_inventory-forecast_ta','18_cost-analysis_ta','19_synthetic_ta','20_training-data_ta','21_semantic-search_ta')
$select = @()
foreach ($id in $ids) { $select += @('--select-id', $id) }
python tools/f14_tour_sheet.py --select-journal app/data/tts_cache/f14_tour_sheet/offline-respell-journal-03.json --max-calls 19 @select
```

That command is dry-run and makes zero TTS/network calls. After separate owner authorization and budget confirmation, the future live command is the same invocation with `--live` added:

```powershell
python tools/f14_tour_sheet.py --select-journal app/data/tts_cache/f14_tour_sheet/offline-respell-journal-03.json --max-calls 19 --live @select
```

The live command has a hard ceiling of 19 provider requests; cache hits and already-completed clips use none. Do not run the legacy whole-sheet generation path for this repair. After generation, the team still needs to listen to the 19 Tamil clips and approve pronunciation; dry-run, cache matching and WAV validation are not listening verification.

Offline journal command used: `python tools/f14_tour_sheet.py --offline-journal`. It branches before dotenv loading and `GnaniClient` initialization; the mode reports zero network/TTS calls and never writes WAVs. The new `-03` journal preserves both earlier offline journals. Each clip records its latest failed attempt as well as the prior success provenance.


Resume audit verification (2026-11-01): focused `tests/test_f14b_respell.py` **9 passed**; focused frontend tour tests **138 passed**; full Vitest **1075 passed**, 15 files; Agent `python -m pytest tests -q` with `GNANI_MOCK=true` **223 passed**, 12 existing warnings; `npm run build -- --configLoader runner` **passed**, 2,821 modules. No external requests were permitted or made.


Selective repair preparation verification (2026-11-01): `python tools/f14_tour_sheet.py --select-journal app/data/tts_cache/f14_tour_sheet/offline-respell-journal-03.json --max-calls 19` with the 19 explicit `--select-id` arguments reported **0 cache hits, 0 completed, 19 requests required**, and **0 network/TTS calls** (`written: false`). The actual journal's visible and spoken Tamil strings matched the current tour script. Focused tooling tests: **20 passed**. Focused tour tests: **138 passed**. Full Agent suite with `GNANI_MOCK=true`: **234 passed**, 12 existing warnings. Python compilation passed. No frontend files were changed by selective-repair preparation, so no production build or full frontend suite was needed. The live command was not run; the 19 files remain stale pending generation and human listening review.

## Current navbar-only guided onboarding

This section replaces the superseded layout experiments and their obsolete Focus/dock instructions. The sidebar Onboard Tour and existing voice launch use the same F14 controller when both voice-tour/everywhere flags are enabled. The normal navbar is now the only tour layout. Sidebar and app header stay mounted/visible throughout; the large Kural panel remains mounted but hidden during the tour. Close cancels speech/navigation work, removes the spotlight and restores normal connection/profile header controls. The flag-off original visual tour is retained. No browser fullscreen or navigation-hiding state remains.

### Guide identity, playback and step selector

The white guide header uses a forest-green circular voice emblem, small KURAL GUIDE eyebrow and dark wrapping current-page title. A divider separates identity/progress from the segmented Back / primary Play-Pause / Next cluster; language and Close are the quieter right utilities. Actual audio state drives the emblem: loading spinner, playing sound bars, static paused symbol or finished check. Sound bars exist only for `audioStatus=playing`, after the playback-start callback; loading/paused/finished/muted/unavailable do not show playing animation. Reduced-motion disables both bar and spinner animation.

The actual-count progress button (for example 09 / 22) opens Tour steps with a small progress ring. Only the approved flag-dependent sequence is listed; Dashboard precedes Spectrometer, optional handover follows the existing flag, and Charge Optimizer is excluded. Current and actually visited steps are marked. A visit is recorded only after a real target becomes ready (not on an attempted jump), and resets for each new tour session. Selecting an integer index dispatches `select-step` to the existing controller, which immediately cancels old narration/callbacks, navigates and waits for the same readiness path before speaking. Invalid indices are rejected. No separate navigation/audio controller exists.

The step dialog focuses the current step on open. Arrow keys, Home/End and Enter navigate/select; Escape or Tab dismisses and restores trigger focus, outside pointer dismissal leaves the clicked destination alone. Its position and bounded scrolling height are measured within the viewport, including narrow widths. Opening/closing the selector, changing caption visibility and scrolling the selector itself do not replay narration or suspend autoplay. Main-page/narration user scrolling still suspends automatic advancement; audio may finish on the current step until explicit Resume autoplay or Next. Audio Pause/Resume remains separate.

Captions remain directly below the toolbar, initially expanded and independently collapsible. Tamil/Hindi line spacing, bounded internal scrolling, compact audio/exploration status and the small Resume autoplay button are preserved. No narration, pronunciation overrides, audio, feature defaults, read-only boundaries or H-1053 gate behavior changed. The 19 stale Tamil clips and collected pronunciation corrections remain pending.

### Readiness and Grade Specs repair retained

The top-level highlight measures the page shell from the top of the app viewport beside the subtly dimmed sidebar; handover retains its specific target. Geometry is remeasured after route/layout changes, resizing, page mutations and nested scrolling. The header reserves its real height so content never sits underneath it. No global overflow masking is added.

The earlier Grade Specs defect was reproduced by delaying its real lazy bundle 9.5 seconds: the page rendered after navigation timed out, but the guide kept the error. The repair remains: an inner Outlet Suspense boundary preserves the guide/shell; Grade Specs has `data-tour-page="grades"`; a late matching route or actually mounted target can reopen readiness and must pass visible/stable geometry before speech. A genuinely missing target retains an honest fallback. Stale tokens, a newer selection or Close cannot resurrect old speech. Tests keep this coverage.

### Task scope and pending manual checks

The navbar-only redesign edits `src/components/voice/VoiceTourCard.jsx`, `src/components/layout/{MainLayout,TopBar}.jsx`, `src/services/voiceTour.js`, both tour regression files and this document. It removes Focus controls/menu entries, floating layout styles, hidden-navigation branches, controller state and obsolete Focus tests/documentation. All unrelated staged/unstaged/untracked work is preserved. Builder attribution is not inferred. No commit/stage/push or provider calls occur.

Styled inspection uses the ignored local `node_modules/.cache/f14-header-check.mjs` script, the actual mock application stylesheet/pages, mocked provider boundaries, and blocked nonlocal requests. Captures under `node_modules/.cache/f14-header-*.png` cover redesigned badge, open steps, English/Tamil/Hindi, desktop/narrow, long-title step 09, paused/finished states and exploration suspension. Listening, microphone, real acoustic quality and audio repair remain unverified. No backend source changes or Agent pytest are required for this frontend task.


### Verification for the interactive navbar

Focused `npx.cmd --no-install vitest run --configLoader runner tests/voice-tour.test.jsx tests/voice-everywhere.test.jsx tests/voice-page-answers.test.js tests/voice-dashboard-briefing.test.js tests/voice-intents.test.js`: **586 passed**, 5 files, **29.61 s**. Full `npx.cmd --no-install vitest run --configLoader runner`: **1,153 passed**, 17 files, **32.81 s**. Sequential `npm.cmd run build -- --configLoader runner`: **passed**, 2,824 modules, **12.82 s**. Staged and unstaged `git diff --check` passed.

Six state-indicator cases cover loading/playing/paused/finished/muted/unavailable and prove only playing contains animated bars. Direct-selection tests cover invalid indices, cancellation/currentness of previous speech, approved list/order, visited versus skipped targets and real readiness. Mounted regressions cover step dialog keyboard/selection/focus restoration, persistent controls, language changes, captions, sidebar/header retention/restoration, route transitions, Grade Specs recovery, scroll suspension, safety and HOLD behavior. Obsolete Focus/dock tests were removed; shared coverage was retained.

Styled Chromium check passed at 1440 by 1000 and 390 by 844, using English/Tamil/Hindi. Header bounds were x=288/y=0/width=1152/height=161 on desktop, and x=0/y=0/width=390/height=281 (Tamil 288) on narrow viewports. The same guide stayed mounted, the selector stayed within viewport bounds, long title Composition Deviation Analysis wrapped without pushing controls outside, document width matched viewport width, no Focus controls/floating layout appeared and fullscreen calls stayed zero. Mock Audio's actual onplaying/onended events exercised speaking, pause/resume and finished/exploration indicators. Caption and selector interactions did not add speech calls; reduced-motion computed animation was none. Screenshots inspected include `f14-header-en-desktop.png`, `f14-header-en-steps-desktop.png`, `f14-header-ta-steps-narrow.png`, and `f14-header-long-title-step-09-desktop.png`; additional captures cover all languages and paused/finished states. Existing mobile-sidebar overlay behavior is unchanged. No microphone, provider availability or listening quality was tested.


Outside-click dismissal was also verified in the styled app without replay. The added pointer check initially clicked caption coordinates covered by the open popover, so Playwright correctly refused the intercepted click; the check was corrected to click the exposed voice emblem and passed in all languages/widths. This was a browser-check targeting issue, not an application defect; the successful final script regenerated the captures. No additional source changes followed the passing full suite/build.


## Latin technical-word TTS input correction (listening pending)

This speech-only correction preserves the twenty existing Tamil B map entries and their English spelling/case. It extends the literal override map to Hindi and adds only the requested technical terms, their explicit inflected Tamil forms, equivalent approved page names, and related result/testing/hardness forms present in the script. Existing lowercase `spectrometer` and `mechanical properties` remain valid approved Latin spellings; they are not duplicated with conflicting case variants. English prose stays unchanged except explicit GO/WARN/HOLD capitalization in the gate narration. Other native words/borrowings outside this correction set are not broadly rewritten.

The matcher is Unicode token/phrase aware, longest-first, and single-pass. It does not partially rewrite an unknown inflection or chain an English replacement through another rule. Explicit Tamil whole-token entries preserve grammatical suffixes as Latin stem + Tamil suffix, without dangling combining vowel signs or invented spaces: `element` + conjunctive suffix, `heat` + dative suffix, `test` + dative/purpose suffixes, and `casting`/`scrap lot` + possessive suffix. See exact strings below. Hindi postpositions/conjunctions and genuine Hindi words such as the check/inspection word remain native; whole sentences are not translated.

The Energy sentence's word order, both occurrences of the original Tamil quantity word, punctuation and ending are unchanged. Only Energy, heat and current spoken tokens change. Visible captions remain byte-for-byte equal to the approved v4 fixture in all 66 strings. No navbar/UI, narration order, flags, provider parameters, audio files or safety behavior changed.

The controller continues passing `pronunciationOnly:true`; `useSpeak` therefore bypasses general clarity/register/normalization rewriting. Exact REST and SSE payload tests verify the final outgoing strings even with normalization/clarity enabled. The inspected Agent `tts_text` function strips tags/trims and optionally adds existing configured tags; it does not transliterate Latin words. A stdlib/AST-only execution of that pure function with existing default no-tags settings preserved all 31 corrected inputs without importing a client, loading dotenv or making a request. No SSML, phoneme/language tags, model/voice/speed changes or per-word audio requests were introduced.

### Exact before/after TTS inputs requested for review

Before means the immediately preceding runtime speech text, including existing Tamil B overrides; it is not necessarily the text recorded in older cached audio. These are input corrections, not proof of synthesized pronunciation. All require team listening before acceptance.

| Step / language | Before TTS input | After TTS input (pending listening) |
|---|---|---|
| 02_spectrometer_ta | இது spectrometer. மெட்டல்ல ஒவ்வொரு எலிமென்ட்டும் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | இது spectrometer. மெட்டல்ல ஒவ்வொரு elementஉம் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். |
| 02_spectrometer_hi | यह स्पेक्ट्रो मीटर है। धातु में हर एलिमेंट कितना है, यहाँ देख सकते हैं। | यह spectrometer है। धातु में हर element कितना है, यहाँ देख सकते हैं। |
| 05_raw-material-stock_ta | இது raw material stock. பிக் அயர்ன், ஸ்க்ராப், அலாய் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | இது raw material stock. Pig iron, scrap, alloy எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். |
| 05_raw-material-stock_hi | यह रॉ मटेरियल स्टॉक है। पिग आयरन, स्क्रैप और अलॉय कितना है, यहाँ देख सकते हैं। | यह raw material stock है। Pig iron, scrap और alloy कितना है, यहाँ देख सकते हैं। |
| 06_yard-inspection_ta | இது yard inspection. வந்த ஸ்க்ராப் லாட்டோட செக் ரிசல்ட் இங்கே பாக்கலாம். | இது yard inspection. வந்த scrap lotஓட check result இங்கே பாக்கலாம். |
| 06_yard-inspection_hi | यह यार्ड इंस्पेक्शन है। आए हुए स्क्रैप लॉट की जाँच का रिज़ल्ट यहाँ देख सकते हैं। | यह yard inspection है। आए हुए scrap lot की जाँच का result यहाँ देख सकते हैं। |
| 07_premelt-gate_ta | இது pre-melt gate. மெல்ட் ஆரம்பிக்கும் முன் கோ, வார்ன், ஹோல்ட் முடிவு காட்டும். ஹோல்ட் வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன். | இது pre-melt gate. மெல்ட் ஆரம்பிக்கும் முன் GO, WARN, HOLD முடிவு காட்டும். HOLD வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன். |
| 07_premelt-gate_hi | यह प्री मेल्ट गेट है। मेल्ट से पहले गो, वार्न या होल्ड का रिज़ल्ट दिखाता है। होल्ड आने पर मेल्ट शुरू नहीं होगा, और मैं तुरंत अलर्ट दूँगी। | यह pre-melt gate है। मेल्ट से पहले GO, WARN या HOLD का result दिखाता है। HOLD आने पर मेल्ट शुरू नहीं होगा, और मैं तुरंत अलर्ट दूँगी। |
| 07_premelt-gate_en | This is the pre-melt gate. It shows go, warn or hold before melting. On hold, melting can't start, and I'll alert you right away. | This is the pre-melt gate. It shows GO, WARN or HOLD before melting. On HOLD, melting can't start, and I'll alert you right away. |
| 14_energy_ta | இது எனர்ஜி. ஒவ்வொரு ஹீட்டுக்கும் எவ்வளவு கரண்ட் தேவை, எவ்வளவு ஆச்சுன்னு பாக்கலாம். | இது Energy. ஒவ்வொரு heatக்கும் எவ்வளவு current தேவை, எவ்வளவு ஆச்சுன்னு பாக்கலாம். |
| 14_energy_hi | यह एनर्जी है। हर हीट में कितनी बिजली चाहिए और कितनी लगी, यहाँ देख सकते हैं। | यह Energy है। हर heat में कितनी बिजली चाहिए और कितनी लगी, यहाँ देख सकते हैं। |
| 15_mechanical-properties_ta | இது mechanical properties. டெஸ்ட்க்கு முன்னாடியே காஸ்டிங்கோட வலிமை, கடினம் கணிக்கும். | இது mechanical properties. testக்கு முன்னாடியே castingஓட வலிமை, கடினம் கணிக்கும். |
| 15_mechanical-properties_hi | यह मैकेनिकल प्रॉपर्टीज़ है। टेस्ट से पहले कास्टिंग की मज़बूती और हार्डनेस का अनुमान देता है। | यह mechanical properties है। test से पहले casting की मज़बूती और hardness का अनुमान देता है। |
| 22_finish_ta | டூர் முடிஞ்சது. தமிழ், ஹிந்தி, இங்கிலீஷ், எதுல வேணும்னாலும் பேசுங்க. நான் ரெடி. | Tour முடிஞ்சது. தமிழ், Hindi, English, எதுல வேணும்னாலும் பேசுங்க. நான் ரெடி. |
| 22_finish_hi | टूर पूरा हुआ। तमिल, हिंदी या इंग्लिश, किसी में भी बोलिए। मैं तैयार हूँ। | Tour पूरा हुआ। तमिल, Hindi या English, किसी में भी बोलिए। मैं तैयार हूँ। |

### Affected clips and cache evidence

31 speech inputs changed in this task: 9 Tamil, 21 Hindi and 1 English. All 31 named WAVs exist, have mismatching previous spoken-text metadata, and are classified stale/not_regenerated. Their SHA-256 hashes were read and checked unchanged after the audit. No WAV was deleted or overwritten. The existing journals, failed attempt evidence and index were not rewritten.

- `ta` changed/stale: `02_spectrometer_ta`, `05_raw-material-stock_ta`, `06_yard-inspection_ta`, `07_premelt-gate_ta`, `14_energy_ta`, `15_mechanical-properties_ta`, `16_sales_ta`, `19_synthetic_ta`, `22_finish_ta`.
- `hi` changed/stale: `01_dashboard_hi`, `02_spectrometer_hi`, `03_grades_hi`, `04_supplier-scorecard_hi`, `05_raw-material-stock_hi`, `06_yard-inspection_hi`, `07_premelt-gate_hi`, `08_handover_hi`, `09_anomaly_hi`, `10_recommendation_hi`, `11_rl-optimizer_hi`, `12_full-analysis_hi`, `14_energy_hi`, `15_mechanical-properties_hi`, `16_sales_hi`, `17_inventory-forecast_hi`, `18_cost-analysis_hi`, `19_synthetic_hi`, `20_training-data_hi`, `21_semantic-search_hi`, `22_finish_hi`.
- `en` changed/stale: `07_premelt-gate_en`.

Across all 66 named sheet files, latest successful journal text (`results-v4.json`, then v3, then the original journal) gives 43 stale, 23 metadata-matching existing, and 0 missing: Tamil 21 stale/1 matching, Hindi 21 stale/1 matching, English 1 stale/21 matching. Metadata matching is not playback/listening verification. The 43 include the previous 19 stale Tamil clips; 7 of those also receive a new input correction here, and 24 additional clips become stale. The runtime content-addressed cache uses text/settings, so these new inputs must not reuse an old-text file as a matching synthesis.

The prior `offline-respell-journal-03.json` remains historical: seven of its intended Tamil strings are now outdated, while Energy/Finish and Hindi/English changes are outside its original 19-clip selection. The existing selective tool's text/fingerprint validation must reject an outdated selection. Do not run that old repair command unchanged; a later authorized offline journal/selection update must account for the new texts and language scope before any selective audio generation. No quota probe, synthesis retry or budget-recovery claim is made here.

Task edits: frontend `src/services/voiceTour.js`, `tests/voice-tour.test.jsx`, `tests/tts-speed.test.js`, `tests/voice-everywhere.test.jsx` (updated mocked Hindi narration expectation), new exact-input fixture `tests/fixtures/f14-latin-speech.json`, and this document. All existing UI and other uncommitted work is preserved. No commit/stage operation, provider call or audio regeneration occurred. Pronunciation, code-switching and suffix delivery remain awaiting listening verification.

Verification for this correction: focused `npx.cmd --no-install vitest run --configLoader runner tests/voice-tour.test.jsx tests/tts-speed.test.js tests/voice-register.test.js tests/voice-everywhere.test.jsx` passed **576 tests**, 4 files, **25.53 s**. Full `npx.cmd --no-install vitest run --configLoader runner` passed **1200 tests**, 17 files, **33.29 s**; sequential `npm.cmd run build -- --configLoader runner` passed, **2,824 modules**, **10.64 s**. All 66 sheet WAV SHA-256 hashes remained unchanged. An initial focused run exposed an obsolete capitalization assertion for legitimate mixed-script suffix text; it was replaced with exact punctuation preservation and the focused suite passed. Final full checks were repeated with saved local logs because earlier completion output was truncated. Staged and unstaged diff checks passed. No backend behavior changed; no Agent suite or physical listening was performed. Zero live calls; no audio generation.

## Separate full Tamil hi-IN listening audition

2026-11-01. Backend-only preparation; no provider/network attempts in the socket-blocked agent environment. The complete optional-handover order contains 22 steps, Dashboard then Spectrometer through Finish, with no Charge Optimizer. No active narration, captions, language routing, flags or tour audio changed. Builder attribution is not inferred.

Fixture: `tests/fixtures/f14_tamil_audition_drafts.json`, storing original caption, original runtime speech, proposed speech and review status per step. Stock is the only user-approved listening sample. Six other supplied drafts await listening; the Pre-melt draft retains the existing HOLD prevention/alert sentence to preserve safety meaning, and that combined wording is pending review. Remaining drafts are unreviewed minimal edits; standalone technical words do not guarantee pronunciation.

Settings: Kalpana / timbre-v3.0 / hi-IN; public speed omitted (default), mono 16-bit PCM WAV at 22050 Hz. Playground speakingSpeed 0.5 mapping remains unknown; pace parity is not claimed. The descriptive application User-Agent and verified TLS are retained. Credentials remain backend-only.

Tool: `tools/f14_tamil_audition.py`. Dry-run default; fixed isolated output `app/data/tts_cache/f14_tamil_hi_audition/run-01/`. Exact text/settings fingerprints gate resume; valid completed clips skip requests. Reservations precede transport; failed/uncertain rows stop and are never automatically retried. Cumulative ceiling 22, at most one request per step; with approved Stock reused, at most 21 new requests. Sequential transport only, 1.1 seconds between completed request and next start, no retries/fallback. RIFF response evidence is saved before decoding; tested paired streaming placeholders are finalized without changing PCM. Other malformed/truncated or misaligned data is rejected. Prior run evidence is untouched.

Preparation results: 0 actual requests, 1 reused (Stock, 7.2 seconds), 0 generated, 0 failed, 21 pending. Stock source `stock_pronunciation_audition/run-20261101T172546009819Z/offline-recovery/`; recovery and original-request hashes/settings verified. Review page `app/data/tts_cache/f14_tamil_hi_audition/run-01/index.html` shows text, generation status, durations and per-clip audio controls. Listening selectors are browser-local review notes, not approval written into the manifest; export team feedback separately. Initial status is pending except approved Stock.

Local backend PowerShell batch command (authorized ceiling, no probes):

```powershell
& .\.venv\Scripts\python.exe .\tools\f14_tamil_audition.py --live
```

Open review without synthesis:

```powershell
Start-Process ".\app\data\tts_cache\f14_tamil_hi_audition\run-01\index.html"
```

### Original captions versus proposed audition speech

The original runtime speech is also recorded verbatim in the fixture. This table does not replace the approved active script.

| Step / page | Original visible Tamil | Proposed audition speech | Review |
|---|---|---|---|
| 1 / Dashboard | வணக்கம், நான் குரல். இது டாஷ்போர்டு. பிளான்ட்ல என்ன நடக்குதுன்னு இங்கே பாக்கலாம். | வணக்கம், நான் குரல். இது Dashboard. பிளான்ட்ல என்ன நடக்குதுன்னு இங்கே பாக்கலாம். | unreviewed audition wording |
| 2 / Spectrometer | இது ஸ்பெக்ட்ரோ மீட்டர். மெட்டல்ல ஒவ்வொரு எலிமென்ட்டும் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | இது Spectrometer. மெட்டல்ல இருக்குற ஒவ்வொரு element அளவையும் இங்கே பாக்கலாம். | user-supplied draft; listening pending |
| 3 / Grade Specs | இது கிரேடு ஸ்பெக்ஸ். ஒவ்வொரு இரும்பு கிரேடுக்கும் தேவையான எலிமென்ட் அளவு இங்கே இருக்கு. | இது Grade Specs. ஒவ்வொரு இரும்பு கிரேடுக்கும் தேவையான element அளவு இங்கே இருக்கு. | unreviewed audition wording |
| 4 / Supplier Scorecard | இது சப்ளையர் ஸ்கோர் கார்டு. தரம், விலை, டெலிவரி வெச்சு சப்ளையர் ரேட்டிங் பாக்கலாம். | இது Supplier Scorecard. தரம், விலை, டெலிவரி வெச்சு சப்ளையர் ரேட்டிங் பாக்கலாம். | unreviewed audition wording |
| 5 / Raw Material Stock | இது ரா மெட்டீரியல் ஸ்டாக். பிக் அயர்ன், ஸ்க்ராப், அலாய் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம். | இது Raw Material Stock. Pig iron, scrap, alloy — இந்த பொருட்கள் எவ்ளோ இருக்குன்னு இங்கே பாக்கலாம். | user-approved Stock |
| 6 / Yard Inspection (XRF/LIBS) | இது யார்டு இன்ஸ்பெக்ஷன். வந்த ஸ்க்ராப் லாட்டோட செக் ரிசல்ட் இங்கே பாக்கலாம். | இது Yard Inspection. வந்த scrap lot எப்படி இருக்கு என்பதை check result மூலம் இங்கே பாக்கலாம். | user-supplied draft; listening pending |
| 7 / Pre-Melt Gate | இது ப்ரீ மெல்ட் கேட். மெல்ட் ஆரம்பிக்கும் முன் கோ, வார்ன், ஹோல்ட் முடிவு காட்டும். ஹோல்ட் வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன். | இது Pre-melt Gate. உருக்க ஆரம்பிக்கிறதுக்கு முன்னாடி, GO, WARN, HOLD — இந்த முடிவுகளில் ஒண்ணை இங்கே காட்டும். HOLD வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன். | user-supplied draft plus preserved HOLD safety sentence; wording/listening pending |
| 8 / Shift handover | இது ஷிஃப்ட் ஹேண்டோவர். போன ஷிஃப்ட்ல சொன்னது இங்கே வரும், கேட் நிலையோட சரிபாக்கும். | இது Shift Handover. போன ஷிஃப்ட்ல சொன்னது இங்கே வரும், கேட் நிலையோட சரிபாக்கும். | unreviewed audition wording |
| 9 / Composition Deviation Analysis | இது காம்போசிஷன் டிவியேஷன். மெட்டல் அளவு லிமிட்ல இருந்து எவ்வளவு மாறியிருக்குன்னு காட்டும். | இது Composition Deviation. மெட்டல் அளவு லிமிட்ல இருந்து எவ்வளவு மாறியிருக்குன்னு காட்டும். | unreviewed audition wording |
| 10 / Melt Correction Planner | இது மெல்ட் கரெக்ஷன் பிளானர். மெட்டல சரியான அளவுக்கு கொண்டு வர என்ன சேர்க்கணும்னு சொல்லும். | இது Melt Correction Planner. மெட்டல சரியான அளவுக்கு கொண்டு வர என்ன சேர்க்கணும்னு சொல்லும். | unreviewed audition wording |
| 11 / Adaptive Strategy Optimizer | இது அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர். பல வழிகளை ஒப்பிட்டு, செலவுக்கும் தரத்துக்கும் சிறந்ததை தேர்ந்தெடுக்கும். | இது Adaptive Strategy Optimizer. பல வழிகளை ஒப்பிட்டு, செலவுக்கும் தரத்துக்கும் சிறந்ததை தேர்ந்தெடுக்கும். | unreviewed audition wording |
| 12 / Full Analysis | இது ஃபுல் அனாலிசிஸ். எல்லா தகவலும் ஒரே ரிப்போர்ட்ல பாக்கலாம். | இது Full Analysis. எல்லா தகவலும் ஒரே ரிப்போர்ட்ல பாக்கலாம். | unreviewed audition wording |
| 13 / AI Agent Analysis | இது ஏ ஐ ஏஜென்ட். முழு மெல்ட்டையும் பாத்து ஒரு சின்ன சுருக்கம் சொல்லும். | இது AI Agent. முழு மெல்ட்டையும் பாத்து ஒரு சின்ன சுருக்கம் சொல்லும். | unreviewed audition wording |
| 14 / Energy per Heat | இது எனர்ஜி. ஒவ்வொரு ஹீட்டுக்கும் எவ்வளவு கரண்ட் தேவை, எவ்வளவு ஆச்சுன்னு பாக்கலாம். | இது Energy. ஒவ்வொரு heat முடிக்க எவ்ளோ current தேவை, எவ்ளோ பயன்படுத்தியிருக்குன்னு இங்கே பாக்கலாம். | user-supplied draft; listening pending |
| 15 / Mechanical Properties | இது மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ். டெஸ்ட்க்கு முன்னாடியே காஸ்டிங்கோட வலிமை, கடினம் கணிக்கும். | இது Mechanical Properties. test நடக்கும் முன்னாடியே, casting வலிமை மற்றும் கடினத்தன்மையை கணிக்கும். | user-supplied draft; listening pending |
| 16 / Sales & Dispatch | இது சேல்ஸ் அண்ட் டிஸ்பேட்ச். முடிஞ்ச ஹீட், டெஸ்ட் சர்டிஃபிகேட், கஸ்டமர் பில் இங்கே பாக்கலாம். | இது Sales and Dispatch. முடிஞ்ச heat, test சர்டிஃபிகேட், கஸ்டமர் பில் இங்கே பாக்கலாம். | unreviewed audition wording |
| 17 / Inventory Forecast | இது இன்வென்டரி ஃபோர்காஸ்ட். எந்த மெட்டீரியல் எப்போ தீரும்னு முன்னாடியே காட்டும். அப்ரூவல் அனுமதி உள்ளவங்க ஸ்கிரீன்ல செய்வாங்க. | இது Inventory Forecast. எந்த மெட்டீரியல் எப்போ தீரும்னு முன்னாடியே காட்டும். அப்ரூவல் அனுமதி உள்ளவங்க ஸ்கிரீன்ல செய்வாங்க. | unreviewed audition wording |
| 18 / Cost Analysis | இது காஸ்ட் அனாலிசிஸ். மெட்டீரியல், எலிமென்ட் விலை எல்லாம் இங்கே இருக்கு. | இது Cost Analysis. மெட்டீரியல், element விலை எல்லாம் இங்கே இருக்கு. | unreviewed audition wording |
| 19 / Synthetic Data | இது சிந்தெடிக் டேட்டா. டெஸ்ட்க்காக மாதிரி டேட்டா உருவாக்கும், இது உண்மையான ஃபேக்டரி டேட்டா இல்ல. | இது Synthetic Data. test செய்ய மாதிரி டேட்டா உருவாக்கும், இது உண்மையான ஃபேக்டரி டேட்டா இல்ல. | unreviewed audition wording |
| 20 / Training Data | இது ட்ரெயினிங் டேட்டா. ஏ ஐ மாடல் கத்துக்கிட்ட பழைய ரீடிங் எல்லாம் இங்கே இருக்கு. | இது Training Data. AI மாடல் கத்துக்கிட்ட பழைய ரீடிங் எல்லாம் இங்கே இருக்கு. | unreviewed audition wording |
| 21 / Semantic Search | இது செமான்டிக் சர்ச். சாதாரணமா டைப் பண்ணினாலே பழைய ரெக்கார்டு கிடைக்கும். | இது Semantic Search. சாதாரணமா டைப் பண்ணினாலே பழைய ரெக்கார்டு கிடைக்கும். | unreviewed audition wording |
| 22 / Finish | டூர் முடிஞ்சது. தமிழ், ஹிந்தி, இங்கிலீஷ், எதுல வேணும்னாலும் பேசுங்க. நான் ரெடி. | Tour முடிஞ்சது. தமிழ், Hindi, English — எந்த மொழியில வேணும்னாலும் பேசுங்க. நான் ரெடி. | user-supplied draft; listening pending |

Verification: `.\.venv\Scripts\python.exe -m unittest discover -s tests -p "*audition.py" -q`: **16 passed**. Tool dry-run produced the counts above; staged and unstaged diff checks passed. No frontend code changed; frontend tests/build were not run. No synthesis, microphone or new listening verification occurred. Active WAV hashes verified unchanged. Task files: new batch tool, separate fixture and batch tests; existing audition harness gained a single-candidate explicit-settings argument, preserving default behavior; this document. No staging or commit.

## Mechanical Properties audition factual revision

2026-11-01. User approved pronunciation of the complete original 22-clip audition set. That approval is recorded with all 22 original audio hashes in `app/data/tts_cache/f14_tamil_hi_audition/mechanical-revision-01/approval-record.json`; other 21 approvals remain retained. Mechanical Properties content now needs the revised text and a new listening check. Original batch manifests and WAVs remain unchanged; active tour integration is unchanged.

Inspected `src/pages/MechanicalProperties.jsx`: page sends grade plus composition C, Si, Mn, P, S and `mode: formula` to the existing prediction endpoint. Gate flow may supply predicted composition; standalone readings supply composition. API failure uses the same five-element/grade client formula. Both branches estimate UTS/YS and hardness (plus elongation); carbon equivalent is derived, not the sole predictor. AI `app/mech_api.py` and `app/mech_predict.py` confirm these inputs and property outputs. Physical test confirmation in the revised sentence is appropriate; predictions are not measured results.

Only step 15 proposed text/fingerprint changed. The exact new text remains in the separate audition fixture, never active narration. `tools/f14_mechanical_revision.py` prepares a one-candidate explicit-settings run: Kalpana / timbre-v3.0 / hi-IN / speed omitted, one attempt maximum, no retries/fallback. It refuses a second execution into the same clip directory, protects original files and verifies all original WAV hashes before proceeding.

Local backend PowerShell, single changed clip only:

```powershell
& .\.venv\Scripts\python.exe .\tools\f14_mechanical_revision.py --live
```

Output: `app/data/tts_cache/f14_tamil_hi_audition/mechanical-revision-01/clip/`; successful audio and playback `index.html` are created there. Do not rerun the full batch: its existing fingerprint correctly rejects the revised fixture. Preparation here made zero requests. Revised audio generation and listening remain pending.

Verification: one targeted revision regression passed (only step 15 fingerprint changes and all 22 original WAV hashes match); 12 existing harness regressions passed; staged and unstaged diff checks passed. No frontend code changed, no build, no commit/stage. Task edits: separate audition fixture, new single-step revision tool/test, this documentation. No calculations, models, UI or safety behavior changed.

## Approved prerecorded Tamil navbar tour integration

2026-11-01. User listening approval covers all 22 selected clips, including the separately approved revised Mechanical Properties clip (11.04 seconds; SHA-256 `75e456ee62eca9615f9acaef440dd35e783c1de3382bcbd13eb8dd32fcd3f17a`). Approval is user-provided, distinct from integration tests; no new audible listening review or synthesis occurred here.

Explicit selection: frontend `src/assets/approvedTourTamil.json`. It records step ID, exact approved Tamil text, source provenance, generation settings, duration and SHA-256. All 22 sources were checked against request manifests, exact candidate texts, hashes and readable mono 16-bit/22050 Hz PCM WAV properties. Stock retains its approved reuse provenance; Mechanical Properties comes from `mechanical-revision-01/clip/`, identified by text/hash/properties despite its inherited spectrometer filename. The old Mechanical Properties batch WAV is not selected. Original source manifests, response evidence and audio remain unchanged.

Durable package: frontend `public/audio/kural-tour-ta-v1/`, copied without re-encoding. All 22 copied and production-output hashes match approved sources (137.68 seconds total). A narrow root `.gitignore` exception makes only this approved application asset directory eligible for tracking; unrelated audition WAVs remain ignored. No raw responses, backend environment or credentials are packaged. Runtime URLs use Vite BASE_URL; no runtime backend cache paths are used.

Flag: `VITE_VOICE_TOUR_APPROVED_TAMIL=false` in `.env.example` and test defaults, exposed in mock mode. Enabled only in existing local `.env.local` for review. Existing `VITE_VOICE_EVERYWHERE=true`, `VITE_VOICE_TOUR=true` and panel-mount requirements still apply. Handover remains conditional on `VITE_HANDOVER`; with it enabled all 22 steps are presented. Revert asset selection by setting the new flag false and restarting Vite; previous behavior is retained. Deployment environments must opt in explicitly.

Tamil UI language stays `ta`. hi-IN is provenance for generation only. When the asset flag is enabled, Tamil captions and speech text match the approved manifest exactly. Hindi/English and flag-off captions/speech remain unchanged. The same tour controller waits for target readiness, and the same useSpeak queue serializes playback. Audio pause/resume preserves the actual media position. Next/Back/direct selection/close/language changes abort the old media session, release the queue and invalidate callbacks. Autoplay waits for ended and respects exploration suspension. Missing or failed media invokes the existing localized unavailable state with captions/manual controls, never live synthesis or stale audio.

Startup (frontend PowerShell): stop/restart the existing dev server after env changes, then `npm.cmd run dev:mock -- --configLoader runner` (or `npm.cmd run dev -- --configLoader runner` for the normal backend setup). Choose Tamil, unmute, click Sidebar Onboard Tour. No auto-start occurs on refresh. The default config-loader launch encountered the existing esbuild access restriction here; runner startup succeeded. Local Chromium checked the styled Dashboard navbar, actual packaged WAV load, pause at 0.242088 seconds with no position change, resume from that position, then cancellation/asset loading on Next to Spectrometer. External requests were blocked and no synthesis endpoint was requested. Screenshot: frontend ignored `node_modules/.cache/approved-tour-dashboard.png`. This is headless media-lifecycle verification, not audible listening.

Manual review: Dashboard should show the approved caption and play immediately after target readiness; Pause/Resume must preserve position. Use Tour steps to visit Raw Material Stock (approved 7.2-second clip), Mechanical Properties (revised composition-data/testing caption and 11.04-second clip), then Finish. Check language switching cancels Tamil audio and close restores normal navbar/panel. Check a failed local asset retains captions and manual navigation without contacting TTS. Pronunciation approval is already recorded; user device/audio-output checks remain manual.

### Source-to-step selection

Base = `app/data/tts_cache/f14_tamil_hi_audition/run-01/`. Revision = sibling `mechanical-revision-01/clip/`. All selected clips are user-approved; copies preserve exact hashes listed in the selection manifest.

| Step ID | Source relative to base (unless Revision) | Duration seconds |
|---|---|---|
| dashboard | step-01/spectrometer_A_tamil.wav | 5.68 |
| spectrometer | step-02/spectrometer_A_tamil.wav | 4.4 |
| grades | step-03/spectrometer_A_tamil.wav | 5.2 |
| supplier-scorecard | step-04/spectrometer_A_tamil.wav | 6.32 |
| raw-material-stock | 05_stock.wav (approved recovery reuse) | 7.2 |
| yard-inspection | step-06/spectrometer_A_tamil.wav | 5.68 |
| premelt-gate | step-07/spectrometer_A_tamil.wav | 12.32 |
| handover | step-08/spectrometer_A_tamil.wav | 5.52 |
| anomaly | step-09/spectrometer_A_tamil.wav | 5.12 |
| recommendation | step-10/spectrometer_A_tamil.wav | 5.44 |
| rl-optimizer | step-11/spectrometer_A_tamil.wav | 7.52 |
| full-analysis | step-12/spectrometer_A_tamil.wav | 4.24 |
| agent | step-13/spectrometer_A_tamil.wav | 4.8 |
| energy | step-14/spectrometer_A_tamil.wav | 6.32 |
| mechanical-properties | Revision/spectrometer_A_tamil.wav | 11.04 |
| sales | step-16/spectrometer_A_tamil.wav | 5.6 |
| inventory-forecast | step-17/spectrometer_A_tamil.wav | 7.44 |
| cost-analysis | step-18/spectrometer_A_tamil.wav | 4.56 |
| synthetic | step-19/spectrometer_A_tamil.wav | 6.32 |
| training-data | step-20/spectrometer_A_tamil.wav | 5.52 |
| semantic-search | step-21/spectrometer_A_tamil.wav | 4.8 |
| finish | step-22/spectrometer_A_tamil.wav | 6.64 |

Task changes: new approved manifest, approvedTourAudio service, 22 public WAVs, focused asset tests; narrow updates to voiceTour/useSpeak, example/local env, Vite/Vitest configuration and root ignore exception; this report. Pre-existing navbar design, controllers and other F13/F14 work were preserved. No backend code/model change, commit or staging.

Final integration verification: focused `npx.cmd --no-install vitest run --configLoader runner tests/approved-tour-audio.test.js tests/voice-tour.test.jsx tests/tts-speed.test.js tests/voice-page-answers.test.js tests/voice-dashboard-briefing.test.js` passed **308 tests**, 5 files. Final `npx.cmd --no-install vitest run --configLoader runner` passed **1207 tests**, 18 files, **37.56 s**. Sequential `npm.cmd run build -- --configLoader runner` passed, **2,826 modules**, **11.26 s**. All 22 source/public/dist SHA-256 hashes match and all production WAVs are readable; all 66 legacy sheet WAV hashes remain unchanged. Staged and unstaged diff checks passed. Earlier full run passed 1206 tests; it was repeated after adding the explicit rapid-selection/language-change cancellation test. No failed test run or synthesis occurred in this integration. Headless Chromium checks and screenshot are described above; narrow-device and audible output checks remain manual.

## Opt-in prefixed tour voice controls

2026-11-01. Dedicated `VITE_VOICE_TOUR_COMMANDS=false` in the example configuration and test defaults; enabled in the existing frontend `.env.local` only for manual review. Existing everywhere/tour/panel flags and the approved-Tamil-assets flag remain as configured. Restart Vite after changing flags: `npm.cmd run dev:mock -- --configLoader runner` (normal backend setup: `npm.cmd run dev -- --configLoader runner`). Backend stream/STT must be available for actual microphone commands; browser mock mode does not simulate the provider WebSocket. No provider calls were made in implementation/tests.

This is transcript-level command gating, not an acoustic wake-word detector. Every recognized utterance must itself start with Kural or its Tamil spelling; case, whitespace and ordinary punctuation normalize. Bare Kural never arms a later utterance. Complete-command matching rejects incidental mentions, fuzzy aliases, extra words and conflicts. Existing global safety checks execute first: mixed command/action requests do neither action. During the enabled active-tour path, rejected text is silent and makes no data reads or synthesized acknowledgements. Outside active tours the prior intent path is retained; flag-off keeps the legacy transcript path/buttons.

| Action | Accepted complete utterances |
|---|---|
| Next | குரல் அடுத்து; குரல் அடுத்து போ; குரல் அடுத்த பக்கம் போ; Kural aduthu po; Kural next; Kural go next; Kural आगे जाओ; Kural अगला पेज |
| Previous | குரல் பின்னாடி போ; குரல் முந்தைய பக்கம் போ; Kural pinnadi po; Kural go back; Kural previous page; Kural पीछे जाओ |
| Pause | குரல் நிறுத்து; குரல் கொஞ்சம் நிறுத்து; Kural niruthu; Kural pause; Kural pause pannu; Kural रुको |
| Continue | குரல் தொடரு; குரல் continue பண்ணு; குரல் resume பண்ணு; Kural thodaru; Kural continue; Kural resume; Kural जारी रखो |
| Close | குரல் tour முடி; குரல் டூர் முடி; Kural tour mudichidu; Kural close tour; Kural exit tour; Kural टूर बंद करो |

Rejected: `next`, `அடுத்து`, `நிறுத்து`, `continue`, `Kural` followed by a separate `next`, `please Kural next`, `Kural next and pause`, `Kural next and approve the heat`, and unclear transcription `அகலவற ஜாவா`. The navbar shows the hint `குரல் அடுத்து போ · குரல் நிறுத்து · குரல் continue பண்ணு` with localized mic/status labels and no synthesized acknowledgement.

### Explicit microphone opt-in, capture and limitations

Starting a tour no longer starts the previous automatic tour hands-free effect or requests microphone permission. The hidden large panel stops its capture and cannot own the Space shortcut during the tour. The dedicated toolbar Mic toggle opts into the existing hands-free session/capture code; no persisted tour-listening preference auto-starts it. Close, language changes and unmount stop that session and release tracks, sockets and timers. Step transitions keep opted-in continuous listening available; route changes invalidate pending hold-to-talk results. An existing application hands-free preference outside the tour retains its prior behavior; closing the tour does not automatically restart capture.

The existing echo guard drops captured frames during playback and for 400 ms afterward; guarded final results are also rejected. Pausing prerecorded audio now clears the speaking state, allowing command capture after that echo tail. **Reliable barge-in during narration is not established.** Use the toolbar Hold to talk button to pause narration/autoplay before recording, or pause via the existing button and then speak. The UI says “Audio playing; hold to talk” rather than claiming active interruption. Do not treat the prefix as acoustic feedback protection: narration can mention Kural.

Hold to talk reuses MediaRecorder, the existing 30-second PTT lifecycle and REST STT service. It waits for the old streaming socket to close before capture; a failed handoff stays in error rather than opening another provider session. An unresolved REST transcription prevents a second tour capture even after cancellation; late results cannot execute. Tracks release on stop, cap, cancellation and teardown; empty captures make no REST request. Silence, permission denial and STT failure leave manual buttons available. No automatic REST retry is added. Existing streaming retries/backoff/rotation remain bounded by the shared implementation.

Opted-in hands-free sends continuous eligible 16 kHz PCM frames through the existing Agent WebSocket; provider utterance/VAD handling and the Agent's existing 60-second session/10-second audio-idle bounds remain unchanged. Echo-guarded gaps may cause an existing idle rotation. Each nonempty hold-to-talk recording submits one REST transcription. **Prefix rejection occurs after STT: it does not avoid capture, requests or billing for unprefixed speech.** Stream language remains the existing backend configuration; these transcript aliases do not guarantee native-script recognition in all languages/accents or change global STT settings.

For tour sessions only, duplicate finals use a provider result/utterance ID if available, otherwise the existing processing-event boundary plus text. A new processing boundary permits an immediately repeated command. Repeated identical finals without a new boundary are conservatively ignored; a backend protocol with neither boundary nor identity cannot distinguish a genuine repeat from a duplicate perfectly. No backend protocol change is introduced.

Manual check: Start tour → enable microphone → say “next” (no movement) → say “குரல் அடுத்து போ” (next step) → “குரல் நிறுத்து” → “குரல் continue பண்ணு” → “Kural go back” → “Kural close tour”. While narration is playing, use Hold to talk for the command or pause the audio first; after a voice Pause, the same opted-in hands-free session can receive Continue. Hold to talk deliberately stops continuous listening to hand over the microphone, so re-enable Mic if continuous listening is desired afterward. Physical microphone, accent, echo, noisy-room and device permission checks remain pending.

Supported commands (every phrase requires the prefix in the same utterance) are listed below. Next/Back route through the shared controller, abort old audio and wait for target readiness; first/last voice boundaries do not replay or close. Pause suspends audio plus autoplay. Continue resumes existing audio and restores autoplay, or advances via the existing readiness flow if narration finished. Close aborts audio/listening and restores the normal navbar. Existing buttons and all 22 approved WAVs/captions remain unchanged.

### Prefixed-control verification and task files

Focused final command: `npx.cmd --no-install vitest run --configLoader runner tests/tour-voice-commands.test.js tests/approved-tour-audio.test.js tests/hands-free.test.js tests/voice-tour.test.jsx tests/voice-intents.test.js`: **413 passed**, five files, **2.60 s**. The broader focused run including the mounted Chromium foundation regression passed **636 tests**, six files before the last handoff cleanup cases. Final `npx.cmd --no-install vitest run --configLoader runner`: **1264 passed**, 19 files, **62.26 s**. Sequential `npm.cmd run build -- --configLoader runner`: passed, **2,829 modules**, **10.40 s**. Full checks were repeated after adding socket-handoff teardown coverage preserving the outside-tour callback signature, and guarding the close-time transcript race; no failed test run was discarded or hidden. New `tour-voice-commands.test.js` adds 57 cases. Existing tour/F13/HOLD tests remain passing. All 22 public and built approved WAV SHA-256 hashes match the existing approved selection. Staged/unstaged diff checks passed after removing a trailing blank line in this report.

No backend code changed, so Agent pytest was not run. No real STT/TTS/provider calls, generated audio or physical microphone/noise/accent/echo tests occurred. New tour microphone UI and actual hardware interaction require the manual sequence above; the full suite's browser fixture is mocked and does not establish real microphone performance.

Task changes: new `src/services/tourVoiceCommands.js`, `src/services/tourMicrophone.js`, `src/hooks/useTourMicrophone.js`, `tests/tour-voice-commands.test.js`; narrow integration updates to MainLayout, VoiceTourCard, PushToTalk, voiceTranscript, voiceTour, useHandsFree, useSpeak and approvedTourAudio; example/local env and Vite/Vitest flag exposure; this F14 report. Pre-existing navbar design, approved selection/captions and audio, F13/F14 tooling and staged/unstaged/untracked work remain preserved. No staging, commit or push.

## Genuine local Kural wake detection: feasibility checkpoint

2026-11-02. Investigation only; **no genuine acoustic wake detector is implemented**. The existing prefix parser is not one. No new runtime dependency, model, flag, animation, microphone permission, ambient capture or provider request was introduced. Existing code/settings/audio remain unchanged. A zero-inference-fee local prototype is technically plausible; suitability for spoken Kural / குரல் is not established and is not claimed impossible.

Repository evidence: package.json contains no wake-word engine or inference runtime. No ONNX/TFLite/PPN/WASM detector assets exist under frontend src/public. Current streamCapture requests channelCount 1, echoCancellation and noiseSuppression, but not autoGainControl, and does not inspect applied getSettings. Existing echo coordination suppresses capture during playback and its short tail. Current opted-in Mic uses cloud-backed streaming STT, including ambient frames eligible for transmission; transcript prefix rejection happens afterward and does not reduce those uploads. Keep that Mic off and use Hold to talk if continuous upload is unwanted. No existing behavior or preference was silently changed by this investigation.

| Candidate | Official evidence | Decision / concrete gap |
|---|---|---|
| Sherpa-ONNX open-vocabulary KWS | Apache-2.0 engine; custom keyword token sequences without retraining. Official browser KWS bindings and Emscripten build exist. Public KWS catalog lists Chinese, English and Chinese-English models. English candidate: sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01. | Best zero-fee prototype lead, not installed. No Tamil-validated Kural model/recordings or browser runtime bundle is present. Code license does not establish model weight license. Selected model card/license could not be verified through accessible hosting pages (ModelScope timed out; attempted Hugging Face URL inaccessible). Do not assume lack of access means restrictive licensing. English KURAL tokenization may be experimentally useful but does not verify Tamil pronunciation coverage. |
| openWakeWord | Apache-2.0 code; included pretrained weights CC BY-NC-SA 4.0; current supported models English. Custom training supported. | No Kural weights in the catalog/repository; commercial-compatible training/data/weights must be established separately. The documented examples/web stream to a server, so that example alone does not satisfy browser-local inference. A custom browser runtime would also be required. |
| Porcupine Web | Custom Web/WASM PPN models; Chrome/Chromium, Edge, Firefox and Safari documented. Requires account, AccessKey and generated target-platform model. FAQ lists English and other languages but not Tamil. | No account/key/custom PPN supplied. Ongoing zero-cost commercial entitlement was not verified; a free signup is not proof of it. Not selected and no secret would be embedded in frontend configuration. |

Official sources (checked through web documentation only):

- Sherpa engine license: https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE
- Open-vocabulary KWS: https://github.com/k2-fsa/sherpa/blob/master/docs/source/onnx/kws/index.rst
- Model catalog/custom keyword tokenization: https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html
- Browser bindings: https://github.com/k2-fsa/sherpa-onnx/tree/master/wasm/kws
- Build/setup: https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/build-wasm-simd-kws.sh and https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/wasm/kws/assets/README.md
- openWakeWord license, language and training: https://github.com/dscripka/openWakeWord#license and https://github.com/dscripka/openWakeWord#training-new-models
- Porcupine browser requirements: https://picovoice.ai/docs/quick-start/porcupine-web/ and language list https://picovoice.ai/docs/faq/porcupine/

### Proposed next step before dependency integration

Verify the selected Sherpa weights' license/artifact hashes and obtain/build a pinned browser KWS bundle in a network-enabled development environment. Upstream's current build script uses Emscripten (4.0.23 known-working), CMake, make and explicit encoder/decoder/joiner/token assets; its example bundles a Chinese model and is not a ready-made Kural configuration. The English candidate needs its own matching token/BPE assets and KURAL keyword tokenization. Test native Tamil and Tanglish recordings plus ordinary conversation locally before adopting it. Unknown browser-version/CPU/latency behavior must be checked on the actual deployment devices; generic WASM support is not a verified browser compatibility matrix.

Only after those artifacts and constraints are verified should a new default-off local-wake flag connect a single shared microphone owner to a local Worker: Disabled → Waiting → wake event → pause narration → Listening → one bounded recording → Processing → Waiting. Waiting must never open STT sockets or upload ambient frames. A wake token must expire, be consumed once and never authorize later utterances. Post-wake command-only text can use the strict existing command aliases behind that token; unarmed text remains rejected. Timeout/error must leave narration paused and keep manual controls.

Proposed capture evaluation: request only supported echoCancellation/noiseSuppression/autoGainControl constraints and inspect applied track settings, recording only those booleans/sample rate/channel count (no device IDs). VAD requires measured pre-roll and hangover; candidate starting values such as 300 ms pre-roll, 700 ms hangover, 5-second no-speech, 30-second cap and 15-second processing deadline are design proposals, not tuned results. Do not upload pre-wake ambient pre-roll; a same-phrase Kural-plus-command must retain only the post-wake command onset using detector timing. Model/VAD latency may require a bounded local ring buffer. No enhancement model is selected.

Speaker barge-in is unresolved: Kural narration itself can cause a real detector to fire. Without verified acoustic echo rejection, disable wake inference during playback and use pause/Hold to talk, explicitly sacrificing barge-in; do not bypass that with cloud prefix matching. Headphones and speakers must be measured separately. A click-to-arm single-command VAD flow is an alternative that needs no wake model, but it must be labelled click-to-arm rather than wake detection and has not been added without resolving the requested detector decision.

Manual sheet: `DOCS/F14_WAKE_MANUAL_TEST.csv`. All measurements are pending. Run each intentional-wake scenario at least 10 times per target device/speaker, record hits/attempts, correct commands/total and wake/command latency; record observed conversation minutes and false activations rather than reporting zero without observation. Include quiet room, fan/TV, headphones/speakers, bare Kural plus a gap, one-phrase Kural aduthu po, no-prefix conversation, unsafe mixed requests and cleanup. Record unsupported barge-in honestly. No current flag or command starts a real Kural detector; existing dev startup runs the previous feature only.

This checkpoint fulfills the request to report a concrete blocker before adding dependencies or claiming completion. The wake state machine, new orb, VAD, applied-device diagnostics and wake-session regressions remain unimplemented pending that decision/model evidence. No guessed model or paid/free-trial service was substituted.

## Concrete local Kural prototype follow-up

2026-11-02. Continued beyond the inventory. The earlier model-license gap is now resolved for the first candidate by an explicit maintainer Apache-2.0 confirmation in official Sherpa issue 3802 (October 26). Recommended first benchmark: Sherpa-ONNX 2.0.1 native CPU plus GigaSpeech 3.3M English int8 KWS. Tamil pronunciation coverage remains unmeasured. Browser deployment remains a later stage, not a claimed completed wake feature.

Full exact file list, published sizes, model/runtime license evidence, setup/recording/benchmark commands and ASR comparison are in [F14_LOCAL_KURAL_PROTOTYPE.md](F14_LOCAL_KURAL_PROTOTYPE.md). First-candidate setup is explicit/default-off and acquires no second model. Whisper Tiny comparison is documented only; no weights/runtime have been downloaded or installed. Existing tour controls, app flags and the 22 approved audio clips/captions are unchanged.

New isolated files: tools/local_kural_benchmark.py, tools/setup_local_kural.py, tools/collect_kural_recordings.html, tools/local_kural_samples.example.csv, tests/test_local_kural_benchmark.py; local audio/model/result directory is narrowly ignored. No model loaded or real recording supplied: no wake-success, false-activation or real-time latency result is claimed. A mockable boundary test is not an acoustic model. Cold CLI timing is explicitly separated from detection latency.

Focused tests with GNANI_MOCK=true: `.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_local_kural_benchmark.py -v`: 8 passed. Python compilation passed; disabled benchmark/setup invocations made zero downloads/capture/inference/provider calls. A preliminary PowerShell setup script could not execute due local execution policy; it was replaced by the Python entry point without changing policy. No setup download or native engine execution has occurred here.

Current frontend regression verification (unchanged frontend): focused 413 passed; full 1264 passed, 19 files, 57.61 s; sequential production build passed, 34.91 s. Staged/unstaged diff checks passed. Approved asset hashes remain unchanged. Physical recordings, installed native runtime/model validation, measured Kural reliability/echo/streaming latency, and app integration remain pending. No commit, stage or push.

## Isolated Sherpa setup resume repair

2026-11-02. Added explicit --resume to tools/setup_local_kural.py; full details and exact command are in F14_LOCAL_KURAL_PROTOTYPE.md. Existing archives and extracted members verified read-only; pypinyin 0.55.0 is present. Resume skips completed stages, validates environment/imports and raw/encoded KURAL tokens, preserves mismatches and writes a completion manifest only after success. Fresh tokenizer dependencies now include pypinyin. No tour control, audio, app flag or model inference changed. 7 focused setup tests plus 8 benchmark tests passed with GNANI_MOCK=true; compilation and both diff checks passed. No downloads/installations/provider calls in the agent environment; no frontend build needed. No commit/stage/push.


## Reviewed local integration and commit verification

The existing pending merge of e4370ce was concluded as 892476f without replaying the respelling patch; the original commit remains an ancestor. Later work was split into F13/stability (5fbac58), navbar/approved Tamil playback (6807776), prefixed microphone controls (dea0ef5), isolated wake experiment (039538d), and audition/recovery tools (64f4d92). This accumulated status document is a separate cross-cutting documentation commit. Working files were preserved while intermediate versions were staged for shared files; no history was rewritten and nothing was pushed.

The test-only setup_module alias was renamed to setup_tools to avoid pytest's xUnit hook detection. The selected Agent checks with GNANI_MOCK=true passed 108 tests, 7 existing warnings, 6.60 s. A first rename guard expected six occurrences instead of five, stopped before editing, and the unchanged selection repeated the known 100-pass/eight-error result; after the corrected rename, all 108 passed. No checks were skipped or weakened.

Commit-boundary verification: the exported F13 staged snapshot passed 72 focused tests. An initial export under node_modules caused Vite to externalize source and yielded three module-resolution failures before tests could run; relocating the export outside node_modules with a junction to the existing dependencies resolved the harness placement issue. The exported navbar/audio snapshot then passed 476 focused tests including the mounted browser regression. The final microphone selection passed 413 tests.

Final frontend verification, sequential: full Vitest using an ignored temporary configuration that adds the explicitly requested ptt-recording.test.js to the existing include list passed 1266 tests, 20 files, 30.94 s. Production build passed, 2829 modules, 11.95 s. All 22 approved WAVs match their manifest hashes in the original backup, working public assets, committed blobs and final dist output; built WAVs are readable. No WAV was regenerated, edited or re-encoded. Staged and unstaged diff checks passed before commits. No provider calls, downloads or installation occurred. Physical microphone/echo/noise reliability and additional audible review were not performed by this commit task. Local settings, debug logs, credentials, recordings, runtime/model artifacts, environments and caches remain excluded.
