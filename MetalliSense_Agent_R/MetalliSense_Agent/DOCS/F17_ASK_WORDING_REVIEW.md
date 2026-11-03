# F17 ASK wording v2 — review

Builder: Nethra. All rows are team-approved ✅, including the ASK v2 review fixes. All 80 rows use deterministic realistic mock fixtures, not live plant measurements. Source details: tests/fixtures/f17-ask-v2.json (seeded lot/QA, grade specs, chemistry, supplier/inventory/energy; representative response-shaped fixtures for other outputs). Dates are fixed at 4 November 2026 for reproducible local-time examples. Spoken text uses existing toSpokenText normalization; display retains written IDs/units. No provider calls or audio changes.

| Page | Intent | Example question | en | ta | hi |
|---|---|---|---|---|---|
| /spectrometer | time ✅ | When was the reading taken? | The reading was taken at 9:05. | ரீடிங் 9:05-க்கு எடுத்தது. | रीडिंग 9:05 बजे ली गई थी। |
| /spectrometer | carbon ✅ | What is the carbon? | Carbon is 3.73%. | கார்பன் 3.73%. | कार्बन 3.73% है। |
| /spectrometer | silicon ✅ | What is the silicon? | Silicon is 2.65%. | சிலிக்கான் 2.65%. | सिलिकॉन 2.65% है। |
| /spectrometer | heat ✅ | Which heat is this reading for? | This reading is for heat H-1053. | இந்த ரீடிங் H-1053-க்கு. | यह रीडिंग हीट H-1053 की है। |
| /grades | carbon ✅ | What is the carbon? | SG-IRON carbon range is 3 to 4%. | SG-IRON கார்பன் 3 முதல் 4%. | SG-IRON कार्बन 3 से 4% है। |
| /grades | standard ✅ | What standard is shown? | Standard: ISO 1083. | ஸ்டாண்டர்ட் ISO 1083. | मानक ISO 1083 है। |
| /grades | tensile ✅ | What tensile range is shown? | SG-IRON tensile strength range is 400 to 600 MPa. | SG-IRON வலிமை 400 முதல் 600 MPa. | SG-IRON की तन्य ताकत 400 से 600 MPa है। |
| /grades | applications ✅ | What are its applications? | It is used for Automotive components, Pipe systems, Machinery parts. | இதோட பயன்பாடு Automotive components, Pipe systems, Machinery parts. | इसका उपयोग Automotive components, Pipe systems, Machinery parts के लिए होता है। |
| /supplier-scorecard | score ✅ | What is the score? | The supplier score is 95. | சப்ளையர் ஸ்கோர் 95. | सप्लायर का स्कोर 95 है। |
| /supplier-scorecard | grade ✅ | What grade is shown? | The supplier grade is A. | சப்ளையர் கிரேட் A. | सप्लायर का ग्रेड A है। |
| /supplier-scorecard | pillar ✅ | What are the pillar scores? | The score breakdown is Quality 92, Cost 100, Delivery 94, and 1 more on screen. | ஸ்கோர் விவரம் Quality 92, Cost 100, Delivery 94, மீதி 1 ஸ்கிரீன்ல. | स्कोर का विवरण Quality 92, Cost 100, Delivery 94, बाकी 1 स्क्रीन पर है। |
| /supplier-scorecard | alerts ✅ | What alerts are shown? | The supplier alerts are Supplier grade needs review. | சப்ளையர் அலர்ட் Supplier grade needs review. | सप्लायर की चेतावनियाँ Supplier grade needs review हैं। |
| /inventory-forecast | usable ✅ | What is the usable stock? | FeSi-75: 170 kg usable. | FeSi-75 170 கிலோ பயன்படுத்தலாம். | FeSi-75 170 किलो इस्तेमाल लायक है। |
| /inventory-forecast | cover ✅ | How many days will stock last? | It lasts about 6 days, running out on Nov 7. | சுமார் 6 நாள் வரும்; நவம்பர் 7-க்கு தீரும். | करीब 6 दिन चलेगा, 7 नवंबर को खत्म होगा। |
| /inventory-forecast | order ✅ | What order quantity is suggested? | Suggested order: 1,250 kg. | 1,250 கிலோ ஆர்டர் பண்ணலாம்னு சஜஷன். | 1,250 किलो ऑर्डर करने का सुझाव है। |
| /inventory-forecast | approver ✅ | Who approved this request? | PR-00001 was approved by K. Senthil. | PR-00001-ஐ K. Senthil அப்ரூவ் பண்ணாங்க. | PR-00001 को K. Senthil ने मंज़ूर किया। |
| /raw-material-stock | available ✅ | How much is available? | Lot PIG-0901 has 4,000 kg available. | PIG-0901 லாட்ல 4,000 கிலோ இருக்கு. | लॉट PIG-0901 में 4,000 किलो उपलब्ध है। |
| /raw-material-stock | reason ✅ | What is the reason? | Released — chemistry from certificate or parent heat. | ரிலீஸ் ஆனது — சான்றிதழ் அல்லது முந்தைய heat கலவை இருக்கு. | रिलीज़ हुआ — प्रमाणपत्र या पिछले हीट की संरचना उपलब्ध है। |
| /raw-material-stock | phosphorus ✅ | What is the lab phosphorus? | Lab phosphorus is 0.045%. | லேப் பாஸ்பரஸ் 0.045%. | लैब फॉस्फोरस 0.045% है। |
| /raw-material-stock | movements ✅ | What was the last stock movement? | Last move: 100 kg to H-1053 by Shift supervisor, 9:05. | கடைசியா 100 கிலோ H-1053-க்கு போச்சு, 9:05. | आख़िरी: 100 किलो H-1053 को, 9:05। |
| /yard-inspection | connected ✅ | Is the gun connected? | The gun is connected. | கன் கனெக்ட் ஆகி இருக்கு. | गन कनेक्टेड है। |
| /yard-inspection | pieces ✅ | How many pieces are done? | 3 of 8 pieces done. | 8-ல 3 பீஸ் முடிஞ்சது. | 8 में से 3 टुकड़े हो गए। |
| /yard-inspection | copper ✅ | What is the copper? | Highest copper: 0.12%, piece 3. | அதிகபட்ச காப்பர் 0.12%, பீஸ் 3. | सबसे ज़्यादा कॉपर 0.12%, टुकड़ा 3। |
| /yard-inspection | reason ✅ | What is the reason? | The lot was quarantined because Copper above limit. | காப்பர் லிமிட்டுக்கு மேல, அதனால லாட் க்வாரண்டைன் ஆச்சு. | कॉपर सीमा से ज़्यादा है, इसलिए लॉट क्वारंटीन हुआ। |
| /premelt-gate | decision ✅ | What is the gate decision? | Heat H-1053 is on HOLD. | H-1053 HOLDல இருக்கு. | हीट H-1053 HOLD पर है। |
| /premelt-gate | blocking ✅ | What is blocking start? | It can't start because copper 0.12% is above the 0.08% limit. And 1 more on screen. | காப்பர் 0.12%, லிமிட் 0.08%-க்கு மேல; அதனால ஸ்டார்ட் பண்ண முடியாது. மீதி 1 ஸ்கிரீன்ல. | कॉपर 0.12% है, सीमा 0.08% से ज़्यादा, इसलिए शुरू नहीं हो सकता। बाकी 1 स्क्रीन पर। |
| /premelt-gate | copper ✅ | What is the copper? | Predicted copper is 0.120%, give or take 0.010. | கணிச்ச காப்பர் 0.120%, கூடக்குறைய 0.010. | अनुमानित कॉपर 0.120%, लगभग 0.010 ऊपर-नीचे। |
| /premelt-gate | valid ✅ | Until when is this check valid? | This check is valid until 9:35. | இந்த செக் 9:35 வரைக்கும் செல்லும். | यह जाँच 9:35 बजे तक मान्य है। |
| /premelt-gate | charge ✅ | What is the charge? | The charge is PIG-0901 2,000 kg, RET-1043 2,500 kg, SCR-0902 500 kg, and 1 more on screen. | சார்ஜ்: PIG-0901 2,000 கிலோ, RET-1043 2,500 கிலோ, SCR-0902 500 கிலோ, மீதி 1 ஸ்கிரீன்ல. | चार्ज: PIG-0901 2,000 किलो, RET-1043 2,500 किलो, SCR-0902 500 किलो, बाकी 1 स्क्रीन पर। |
| /energy | predicted ✅ | What is the predicted energy? | Predicted energy is 556 kWh. | கணிச்ச Energy 556 kWh. | अनुमानित ऊर्जा 556 kWh है। |
| /energy | meter ✅ | What is the meter energy? | Simulated meter energy is 540 kWh. | சிமுலேட் செய்த மீட்டர் Energy 540 kWh. | सिमुलेटेड मीटर ऊर्जा 540 kWh है। |
| /energy | driver ✅ | What are the energy drivers? | The energy drivers are Melt 1 t of SG-IRON charge 570 kWh, Sponge iron 35% of charge 23.9 kWh, DRI moisture 0.3% 1.2 kWh, and 3 more on screen. | Energy காரணங்கள் Melt 1 t of SG-IRON charge 570 kWh, Sponge iron 35% of charge 23.9 kWh, DRI moisture 0.3% 1.2 kWh, மீதி 3 ஸ்கிரீன்ல. | ऊर्जा के कारण Melt 1 t of SG-IRON charge 570 kWh, Sponge iron 35% of charge 23.9 kWh, DRI moisture 0.3% 1.2 kWh, बाकी 3 स्क्रीन पर हैं। |
| /energy | savings ✅ | What are the savings? | Predicted savings are 2,500 rupees. | கணிச்ச சேமிப்பு 2,500 ரூபாய். | अनुमानित बचत 2,500 रुपये है। |
| /anomaly | severity ✅ | What is the severity? | The deviation severity is moderate. | Deviation தீவிரம் நடுத்தரம். | बदलाव की गंभीरता मध्यम है। |
| /anomaly | score ✅ | What is the score? | The anomaly score is 0.72. | Anomaly ஸ்கோர் 0.72. | असामान्यता का स्कोर 0.72 है। |
| /anomaly | compliance ✅ | How many elements are within range? | 4 of 6 elements are within range. | 6-ல 4 element ரேஞ்சுக்குள்ள இருக்கு. | 6 में से 4 तत्व सीमा में हैं। |
| /anomaly | carbon ✅ | What is the carbon? | The analyzed carbon is 3.73%. | பார்த்த கார்பன் 3.73%. | विश्लेषण में कार्बन 3.73% है। |
| /recommendation | additions ✅ | What additions are suggested? | Suggested additions are C +0.10%, Si +0.20%, Mn +0.05%, and 1 more on screen. | சேர்க்கை சஜஷன் C +0.10%, Si +0.20%, Mn +0.05%, மீதி 1 ஸ்கிரீன்ல. | जोड़ने का सुझाव C +0.10%, Si +0.20%, Mn +0.05%, बाकी 1 स्क्रीन पर है। |
| /recommendation | alternatives ✅ | What are the alternative grades? | Suggested alternative grades are GREY-IRON, SG-IRON, LOW-CARBON-STEEL, and 1 more on screen. | மாற்று கிரேட் சஜஷன் GREY-IRON, SG-IRON, LOW-CARBON-STEEL, மீதி 1 ஸ்கிரீன்ல. | वैकल्पिक ग्रेड का सुझाव GREY-IRON, SG-IRON, LOW-CARBON-STEEL, बाकी 1 स्क्रीन पर है। |
| /recommendation | available ✅ | Is the AI service available? | The service is available. | சேவை கிடைக்குது. | सेवा उपलब्ध है। |
| /recommendation | chemistry ✅ | What composition does the plan use? | The plan uses C 3.73%, Si 2.65%, Mn 0.71%, and 3 more on screen. | பிளான்ல எடுத்த கலவை C 3.73%, Si 2.65%, Mn 0.71%, மீதி 3 ஸ்கிரீன்ல. | योजना में C 3.73%, Si 2.65%, Mn 0.71%, बाकी 3 स्क्रीन पर लिया गया है। |
| /rl-optimizer | additions ✅ | What additions are suggested? | The strategy suggests C +0.100%, Si +0.200%, Mn +0.050%, and 1 more on screen. | ஸ்ட்ராடஜி சஜஷன் C +0.100%, Si +0.200%, Mn +0.050%, மீதி 1 ஸ்கிரீன்ல. | रणनीति का सुझाव C +0.100%, Si +0.200%, Mn +0.050%, बाकी 1 स्क्रीन पर है। |
| /rl-optimizer | cost ✅ | What cost is predicted? | Predicted cost is 2,400.00 rupees. | கணிச்ச செலவு 2,400.00 ரூபாய். | अनुमानित लागत 2,400.00 रुपये है। |
| /rl-optimizer | updates ✅ | How many learning updates? | There have been 12 learning updates. | கத்துக்கிட்ட அப்டேட் 12. | सीखने के 12 अपडेट हुए हैं। |
| /rl-optimizer | lots ✅ | Which lots are suggested? | The suggested lots are FESI-0901 12 kg, FEMN-0901 8 kg, REC-0901 5 kg, and 1 more on screen. | லாட் சஜஷன் FESI-0901 12 கிலோ, FEMN-0901 8 கிலோ, REC-0901 5 கிலோ, மீதி 1 ஸ்கிரீன்ல. | सुझाए गए लॉट FESI-0901 12 किलो, FEMN-0901 8 किलो, REC-0901 5 किलो, बाकी 1 स्क्रीन पर हैं। |
| /full-analysis | severity ✅ | What is the severity? | The run found moderate deviation severity. | இந்த ரன்ல Deviation தீவிரம் நடுத்தரம். | इस विश्लेषण में बदलाव की गंभीरता मध्यम है। |
| /full-analysis | correction ✅ | What correction is suggested? | The suggested correction is C +0.100%, Si +0.200%, Mn +0.050%, and 1 more on screen. | Correction சஜஷன் C +0.100%, Si +0.200%, Mn +0.050%, மீதி 1 ஸ்கிரீன்ல. | सुधार का सुझाव C +0.100%, Si +0.200%, Mn +0.050%, बाकी 1 स्क्रीन पर है। |
| /full-analysis | carbon ✅ | What is the carbon? | Carbon is 3.726%. | கார்பன் 3.726%. | कार्बन 3.726% है। |
| /full-analysis | co2 ✅ | What are the CO2 emissions? | Predicted batch CO2 is 128 kg. | கணிச்ச பேட்ச் CO2 128 கிலோ. | अनुमानित बैच CO2 128 किलो है। |
| /full-analysis | root ✅ | What is the root cause hint? | The suggested cause is Carbon above the selected range. | காரணம் சஜஷன் Carbon above the selected range. | सुझाया कारण Carbon above the selected range है। |
| /agent | grade ✅ | What grade is shown? | The analyzed grade is SG-IRON. | பார்த்த கிரேட் SG-IRON. | विश्लेषण का ग्रेड SG-IRON है। |
| /agent | anomaly ✅ | What is the anomaly result? | The deviation severity is moderate, with score 0.720. | Deviation தீவிரம் நடுத்தரம், ஸ்கோர் 0.720. | बदलाव की गंभीरता मध्यम है, स्कोर 0.720 है। |
| /agent | additions ✅ | What additions are suggested? | The suggested additions are C +0.10%, Si +0.20%, Mn +0.05%, and 1 more on screen. | சேர்க்கை சஜஷன் C +0.10%, Si +0.20%, Mn +0.05%, மீதி 1 ஸ்கிரீன்ல. | जोड़ने का सुझाव C +0.10%, Si +0.20%, Mn +0.05%, बाकी 1 स्क्रीन पर है। |
| /agent | explanation ✅ | Please explain the result. | The explanation is Carbon is above the selected range. | விளக்கம் Carbon is above the selected range. | स्पष्टीकरण Carbon is above the selected range है। |
| /mechanical-properties | tensile ✅ | What tensile range is shown? | Predicted tensile strength is 450.0 MPa. | கணிச்ச வலிமை 450.0 MPa. | अनुमानित तन्य ताकत 450.0 MPa है। |
| /mechanical-properties | elongation ✅ | What elongation is predicted? | Predicted elongation is 12.0%. | கணிச்ச நீட்சி 12.0%. | अनुमानित बढ़ाव 12.0% है। |
| /mechanical-properties | quality ✅ | What is the predicted quality? | The predicted quality result is PASS. | கணிச்ச தர முடிவு PASS. | अनुमानित गुणवत्ता परिणाम PASS है। |
| /mechanical-properties | tap ✅ | What tap details are recorded? | The recorded tap is 850 kg, SG-IRON, approved by Shift supervisor at 9:05. | பதிவான tap 850 கிலோ, SG-IRON, Shift supervisor அப்ரூவ் பண்ணது 9:05. | दर्ज tap 850 किलो, SG-IRON, Shift supervisor ने 9:05 पर मंज़ूर किया है। |
| /sales | weight ✅ | What weight is ready for invoice? | The weight ready for invoice is 850 kg. | இன்வாய்ஸ்க்கு ரெடியான எடை 850 கிலோ. | इनवॉइस के लिए तैयार वजन 850 किलो है। |
| /sales | downgrade ✅ | What grade was sold? | The sold grade is SG-IRON. | விற்ற கிரேட் SG-IRON. | बिक्री का ग्रेड SG-IRON है। |
| /sales | invoice ✅ | What is the invoice? | The invoice is INV-00001. | இன்வாய்ஸ் INV-00001. | इनवॉइस INV-00001 है। |
| /sales | rate ✅ | What rate is suggested? | The suggested rate is 85 rupees per kg. | விலை சஜஷன் கிலோவுக்கு 85 ரூபாய். | सुझाई दर 85 रुपये प्रति किलो है। |
| /synthetic | grade ✅ | What grade is shown? | The synthetic grade is SG-IRON. | Synthetic கிரேட் SG-IRON. | सिंथेटिक ग्रेड SG-IRON है। |
| /synthetic | carbon ✅ | What is the carbon? | Synthetic carbon is 3.73%. | Synthetic கார்பன் 3.73%. | सिंथेटिक कार्बन 3.73% है। |
| /synthetic | elements ✅ | What elements were changed? | The changed elements are C, Si, Mn, and 1 more on screen. | மாத்தின element C, Si, Mn, மீதி 1 ஸ்கிரீன்ல. | बदले गए तत्व C, Si, Mn, बाकी 1 स्क्रीन पर हैं। |
| /synthetic | percentage ✅ | What deviation percentage was requested? | The requested deviation is 5.00%. | கேட்ட Deviation 5.00%. | माँगा गया बदलाव 5.00% है। |
| /training-data | count ✅ | How many records match? | There are 200 matching records. | பொருந்துற பதிவு 200 இருக்கு. | मेल खाने वाले 200 रिकॉर्ड हैं। |
| /training-data | carbon ✅ | What is the carbon? | The record's carbon is 3.726%. | பதிவுல கார்பன் 3.726%. | रिकॉर्ड में कार्बन 3.726% है। |
| /training-data | severity ✅ | What is the severity? | The record's severity is no deviation. | பதிவோட தீவிரம் டீவியேஷன் இல்ல. | रिकॉर्ड की गंभीरता कोई बदलाव नहीं है। |
| /training-data | type ✅ | What sample type is shown? | The sample type is a normal sample. | சாம்பிள் வகை சாதாரண சாம்பிள். | सैंपल का प्रकार सामान्य सैंपल है। |
| /semantic-search | results ✅ | What search results were found? | The search found SG-IRON grade specification. | தேடல்ல கிடைச்சது SG-IRON grade specification. | खोज में SG-IRON grade specification मिला। |
| /semantic-search | score ✅ | What is the score? | The match score is 0.93. | பொருத்த ஸ்கோர் 0.93. | मिलान का स्कोर 0.93 है। |
| /semantic-search | collection ✅ | Which collection was searched? | The searched collection is grades. | தேடின collection grades. | खोजा गया संग्रह grades है। |
| /cost-analysis | carbon ✅ | What is the carbon? | Carbon costs 80 rupees per kg. | கார்பன் விலை கிலோவுக்கு 80 ரூபாய். | कार्बन की कीमत 80 रुपये प्रति किलो है। |
| /cost-analysis | base ✅ | What is the base metal price? | SG-IRON base metal costs 50 rupees per kg. | SG-IRON அடிப்படை உலோக விலை கிலோவுக்கு 50 ரூபாய். | SG-IRON आधार धातु की कीमत 50 रुपये प्रति किलो है। |
| /cost-analysis | batch ✅ | What batch cost is recorded? | The recorded batch cost is 1,20,000 rupees. | பதிவான பேட்ச் செலவு 1,20,000 ரூபாய். | दर्ज बैच लागत 1,20,000 रुपये है। |
| /cost-analysis | additions ✅ | What is the cost of additions? | The additions cost 2,400 rupees. | சேர்க்கை செலவு 2,400 ரூபாய். | जोड़ने की लागत 2,400 रुपये है। |
| /supplier-scorecard | rank ✅ | What is the supplier rank? | The supplier rank is 1. | சப்ளையர் ரேங்க் 1. | सप्लायर की रैंक 1 है। |
| /inventory-forecast | eoq ✅ | What is the suggested economic order? | Suggested economic order: 1,243 kg. | சிக்கன ஆர்டர் சஜஷன் 1,243 கிலோ. | किफायती ऑर्डर का सुझाव 1,243 किलो है। |
| /inventory-forecast | stockout ✅ | When will stock run out? | The stock is predicted to run out at Nov 7 10:30. | Stock நவம்பர் 7 10:30-க்கு தீரும்னு கணிப்பு. | स्टॉक 7 नवंबर 10:30 बजे खत्म होने का अनुमान है। |


Review fixes applied, 4 November 2026: Full Analysis now has separate element-carbon (reading.composition.C) and CO2 (batch estimate) intents. Emissions require explicit CO2/emission/carbon-footprint/Tamil/Hindi terms; other pages cannot silently answer them with element C. Recommendation availability requires an AI/service availability question; Cost additions requires a cost question. Whole-word English matching and explicit per-page precedence address score/scorecard, pillar/score, order/economic order/approver, energy/meter/drivers/savings, quantity/cost, attribute/context, and other audited collisions across all 19 pages. Safety refusal still precedes reads.

Formatting follows the owning screen: Spectrometer/shared composition uses 2dp (3.73%); Full Analysis and Training Data use 3dp; Mechanical Properties uses 1dp; grade ranges and QA phosphorus retain their displayed precision. Inventory days are rounded whole days. Dates use localized month names (Nov 7 / நவம்பர் 7 / 7 नवंबर), local h:mm when relevant, and a year for a different year. Stock reasons put status first and lowercase English reasons while retaining written IDs. Money uses Indian grouping and English rupees; grouping commas are removed only from the spoken preparation before existing normalization. Severity/sample-type and known lot-status enums map to words. Underlying numbers and plant data are never modified.

Verification: **682 focused ASK checks passed in 2.66s; full Vitest 2348 passed across 40 files in 186.20s; production build passed in 14.35s** (large-chunk warning remains). Added 99 checks since the previous ASK v2 snapshot, including multilingual collisions and every review fix. All 80 rows are team-approved ✅. Both staged and unstaged diff checks pass, with Git line-ending/ignore-access warnings only. All 22 source and 22 built tour WAV hashes match the approved manifest.

Files updated: frontend src/services/voiceAskContent.js, voiceAskAnswers.js, voiceAskFormatters.js; tests/f17-ask.test.js; tests/fixtures/f17-ask-v2.json and f17-ask-v2-expected.json; this document. Existing F17B action work, flags, backend, approved audio and unrelated .claude settings remain untouched. No live provider or audible speech tests; no stage, commit or push. Local test/build logs: frontend node_modules/.cache/ask-v2-review-*.log, including the repaired connected/blocking morphology check.
