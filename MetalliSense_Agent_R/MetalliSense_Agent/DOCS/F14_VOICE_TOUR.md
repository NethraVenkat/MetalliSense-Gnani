# F14 v4 FINAL voice onboarding tour

2026-11-01 (Asia/Calcutta). Owner: Nethra. No commit. **0 live calls.** This team-approved script supersedes all previous F14 narration.

## Final script contract

Card text and speech use the table below verbatim. Only foundry digit IDs may receive pronunciation expansion; these lines contain no IDs. No lexicon rewrites, register substitutions or sentence splitting are applied to tour narration, including inside the speech queue. Punctuation and quotes remain intact. F13a page-help texts, safety words/order, gate logic, other answers, STT/TTS settings, local env files and README are unchanged.

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
