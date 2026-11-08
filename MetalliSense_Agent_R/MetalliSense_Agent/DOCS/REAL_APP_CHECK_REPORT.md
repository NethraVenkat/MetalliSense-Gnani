# Round 2 real-app check

Real dev:mock UI, isolated mock Agent, Chromium synthetic microphone. Initial commands use the development transcript control; replies use real browser capture and the Agent transcription endpoint. TTS is muted in this check; TTS completion ordering is covered by the unit tests. RUN uses the registered test action (no plant effect). No live plant services are called.

| Page | Check | Expected | Result | reason_code |
|---|---|---|---|---|
| /premelt-gate | workflow select H-1051 | executed with exact reply count | PASS | executed |
| /premelt-gate | workflow run gate check H-1051 | executed with exact reply count | PASS | executed |
| /premelt-gate | workflow private non-digit retry | refusal without mutation | PASS | code_not_digits |
| /premelt-gate | workflow private wrong role | refusal without mutation | PASS | wrong_role |
| /premelt-gate | workflow private three wrong credentials | refusal without mutation | PASS | locked |
| /premelt-gate | workflow reset | unlocked | PASS | executed |
| /premelt-gate | workflow retry start melting H-1051 | executed with exact reply count | PASS | executed |
| /rl-optimizer | workflow private non-digit retry | refusal without mutation | PASS | code_not_digits |
| /rl-optimizer | workflow private wrong role | refusal without mutation | PASS | wrong_role |
| /rl-optimizer | workflow private three wrong credentials | refusal without mutation | PASS | locked |
| /rl-optimizer | workflow reset | unlocked | PASS | executed |
| /rl-optimizer | workflow retry accept balanced | executed with exact reply count | PASS | executed |
| /full-analysis | workflow run full analysis | executed with exact reply count | PASS | executed |
| /full-analysis | workflow private non-digit retry | refusal without mutation | PASS | code_not_digits |
| /full-analysis | workflow private wrong role | refusal without mutation | PASS | wrong_role |
| /full-analysis | workflow private three wrong credentials | refusal without mutation | PASS | locked |
| /full-analysis | workflow reset | unlocked | PASS | executed |
| /full-analysis | workflow retry accept balanced | executed with exact reply count | PASS | executed |
| /mechanical-properties | workflow predict | executed with exact reply count | PASS | executed |
| /mechanical-properties | workflow private non-digit retry | refusal without mutation | PASS | code_not_digits |
| /mechanical-properties | workflow private wrong role | refusal without mutation | PASS | wrong_role |
| /mechanical-properties | workflow private three wrong credentials | refusal without mutation | PASS | locked |
| /mechanical-properties | workflow reset | unlocked | PASS | executed |
| /mechanical-properties | workflow retry approve tap H-1051 | executed with exact reply count | PASS | executed |
| /sales | workflow private non-digit retry | refusal without mutation | PASS | code_not_digits |
| /sales | workflow private wrong role | refusal without mutation | PASS | wrong_role |
| /sales | workflow private three wrong credentials | refusal without mutation | PASS | locked |
| /sales | workflow reset | unlocked | PASS | executed |
| /sales | workflow retry issue invoice H-1051 customer C-001 10 kg at 50 | executed with exact reply count | PASS | executed |
| /premelt-gate | workflow start melting H-1051 | executed with exact reply count | PASS | executed |
| /rl-optimizer | workflow accept balanced | executed with exact reply count | PASS | executed |
| /full-analysis | workflow accept balanced | executed with exact reply count | PASS | executed |
| /mechanical-properties | workflow approve tap H-1051 | executed with exact reply count | PASS | executed |
| /sales | workflow issue invoice H-1051 customer C-001 10 kg at 50 | executed with exact reply count | PASS | executed |
| /anomaly | safe action run analysis | executed without yes/no | PASS | executed |
| /recommendation | safe action generate plan | executed without yes/no | PASS | executed |
| /full-analysis | safe action run full analysis | executed without yes/no | PASS | executed |
| /mechanical-properties | safe action predict | executed without yes/no | PASS | executed |
| /agent | safe action run analysis | executed without yes/no | PASS | executed |
| /premelt-gate | safe action run gate check | executed without yes/no | PASS | executed |
| /supplier-scorecard | safe action plan 10 tonnes of STEEL_SCRAP | executed without yes/no | PASS | executed |
| /semantic-search | safe action search carbon | executed without yes/no | PASS | executed |
| /supplier-scorecard | ASK/control what can i ask here | executed | PASS | executed |
| /supplier-scorecard | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /supplier-scorecard | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /supplier-scorecard | ASK/control scroll down | executed | PASS | executed |
| /supplier-scorecard | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /supplier-scorecard | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /supplier-scorecard | row control select Erode Steel Recyclers | executed | PASS | executed |
| /supplier-scorecard | row control தேர்ந்தெடு Erode Steel Recyclers | executed | PASS | executed |
| /supplier-scorecard | row control चुनो Erode Steel Recyclers | executed | PASS | executed |
| /supplier-scorecard | row control read this row | executed | PASS | executed |
| /supplier-scorecard | navigate | destination opened | PASS | nav_matched |
| /supplier-scorecard | go back | original page restored | PASS | nav_matched |
| /supplier-scorecard | refresh | executed and audited | PASS | executed |
| /energy | ASK/control what can i ask here | executed | PASS | executed |
| /energy | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /energy | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /energy | ASK/control scroll down | executed | PASS | executed |
| /energy | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /energy | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /energy | row control select H-1053 | executed | PASS | executed |
| /energy | row control தேர்ந்தெடு H-1053 | executed | PASS | executed |
| /energy | row control चुनो H-1053 | executed | PASS | executed |
| /energy | row control read this row | executed | PASS | executed |
| /energy | navigate | destination opened | PASS | nav_matched |
| /energy | go back | original page restored | PASS | nav_matched |
| /energy | refresh | executed and audited | PASS | executed |
| /inventory-forecast | ASK/control what can i ask here | executed | PASS | executed |
| /inventory-forecast | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /inventory-forecast | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /inventory-forecast | ASK/control scroll down | executed | PASS | executed |
| /inventory-forecast | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /inventory-forecast | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /inventory-forecast | row controls | no loaded rows | N/A | no_target |
| /inventory-forecast | navigate | destination opened | PASS | nav_matched |
| /inventory-forecast | go back | original page restored | PASS | nav_matched |
| /inventory-forecast | refresh | executed and audited | PASS | executed |
| /sales | ASK/control what can i ask here | executed | PASS | executed |
| /sales | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /sales | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /sales | ASK/control scroll down | executed | PASS | executed |
| /sales | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /sales | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /sales | row controls | no loaded rows | N/A | no_target |
| /sales | navigate | destination opened | PASS | nav_matched |
| /sales | go back | original page restored | PASS | nav_matched |
| /sales | refresh | executed and audited | PASS | executed |
| /cost-analysis | ASK/control what can i ask here | executed | PASS | executed |
| /cost-analysis | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /cost-analysis | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /cost-analysis | ASK/control scroll down | executed | PASS | executed |
| /cost-analysis | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /cost-analysis | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /cost-analysis | row controls | no loaded rows | N/A | no_target |
| /cost-analysis | navigate | destination opened | PASS | nav_matched |
| /cost-analysis | go back | original page restored | PASS | nav_matched |
| /cost-analysis | refresh | executed and audited | PASS | executed |
| /anomaly | ASK/control what can i ask here | executed | PASS | executed |
| /anomaly | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /anomaly | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /anomaly | ASK/control scroll down | executed | PASS | executed |
| /anomaly | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /anomaly | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /anomaly | row controls | no loaded rows | N/A | no_target |
| /anomaly | navigate | destination opened | PASS | nav_matched |
| /anomaly | go back | original page restored | PASS | nav_matched |
| /anomaly | refresh | executed and audited | PASS | executed |
| /recommendation | ASK/control what can i ask here | executed | PASS | executed |
| /recommendation | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /recommendation | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /recommendation | ASK/control scroll down | executed | PASS | executed |
| /recommendation | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /recommendation | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /recommendation | row controls | no loaded rows | N/A | no_target |
| /recommendation | navigate | destination opened | PASS | nav_matched |
| /recommendation | go back | original page restored | PASS | nav_matched |
| /recommendation | refresh | executed and audited | PASS | executed |
| /rl-optimizer | ASK/control what can i ask here | executed | PASS | executed |
| /rl-optimizer | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /rl-optimizer | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /rl-optimizer | ASK/control scroll down | executed | PASS | executed |
| /rl-optimizer | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /rl-optimizer | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /rl-optimizer | row controls | no loaded rows | N/A | no_target |
| /rl-optimizer | navigate | destination opened | PASS | nav_matched |
| /rl-optimizer | go back | original page restored | PASS | nav_matched |
| /rl-optimizer | refresh | executed and audited | PASS | executed |
| /full-analysis | ASK/control what can i ask here | executed | PASS | executed |
| /full-analysis | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /full-analysis | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /full-analysis | ASK/control scroll down | executed | PASS | executed |
| /full-analysis | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /full-analysis | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /full-analysis | row controls | no loaded rows | N/A | no_target |
| /full-analysis | navigate | destination opened | PASS | nav_matched |
| /full-analysis | go back | original page restored | PASS | nav_matched |
| /full-analysis | refresh | executed and audited | PASS | executed |
| /mechanical-properties | ASK/control what can i ask here | executed | PASS | executed |
| /mechanical-properties | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /mechanical-properties | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /mechanical-properties | ASK/control scroll down | executed | PASS | executed |
| /mechanical-properties | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /mechanical-properties | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /mechanical-properties | row controls | no loaded rows | N/A | no_target |
| /mechanical-properties | navigate | destination opened | PASS | nav_matched |
| /mechanical-properties | go back | original page restored | PASS | nav_matched |
| /mechanical-properties | refresh | executed and audited | PASS | executed |
| /agent | ASK/control what can i ask here | executed | PASS | executed |
| /agent | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /agent | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /agent | ASK/control scroll down | executed | PASS | executed |
| /agent | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /agent | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /agent | row controls | no loaded rows | N/A | no_target |
| /agent | navigate | destination opened | PASS | nav_matched |
| /agent | go back | original page restored | PASS | nav_matched |
| /agent | refresh | executed and audited | PASS | executed |
| /synthetic | ASK/control what can i ask here | executed | PASS | executed |
| /synthetic | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /synthetic | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /synthetic | ASK/control scroll down | executed | PASS | executed |
| /synthetic | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /synthetic | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /synthetic | row controls | no loaded rows | N/A | no_target |
| /synthetic | navigate | destination opened | PASS | nav_matched |
| /synthetic | go back | original page restored | PASS | nav_matched |
| /synthetic | refresh | executed and audited | PASS | executed |
| /training-data | ASK/control what can i ask here | executed | PASS | executed |
| /training-data | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /training-data | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /training-data | ASK/control scroll down | executed | PASS | executed |
| /training-data | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /training-data | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /training-data | row control select 175 | executed | PASS | executed |
| /training-data | row control தேர்ந்தெடு 175 | executed | PASS | executed |
| /training-data | row control चुनो 175 | executed | PASS | executed |
| /training-data | row control read this row | executed | PASS | executed |
| /training-data | navigate | destination opened | PASS | nav_matched |
| /training-data | go back | original page restored | PASS | nav_matched |
| /training-data | refresh | executed and audited | PASS | executed |
| /semantic-search | ASK/control what can i ask here | executed | PASS | executed |
| /semantic-search | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /semantic-search | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /semantic-search | ASK/control scroll down | executed | PASS | executed |
| /semantic-search | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /semantic-search | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /semantic-search | row controls | no loaded rows | N/A | no_target |
| /semantic-search | navigate | destination opened | PASS | nav_matched |
| /semantic-search | go back | original page restored | PASS | nav_matched |
| /semantic-search | refresh | executed and audited | PASS | executed |
| /charge-optimizer | ASK/control what can i ask here | executed | PASS | executed |
| /charge-optimizer | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /charge-optimizer | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /charge-optimizer | ASK/control scroll down | executed | PASS | executed |
| /charge-optimizer | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /charge-optimizer | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /charge-optimizer | row controls | no loaded rows | N/A | no_target |
| /charge-optimizer | navigate | destination opened | PASS | nav_matched |
| /charge-optimizer | go back | original page restored | PASS | nav_matched |
| /charge-optimizer | refresh | executed and audited | PASS | executed |
| /dashboard | ASK/control what can i ask here | executed | PASS | executed |
| /dashboard | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /dashboard | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /dashboard | ASK/control scroll down | executed | PASS | executed |
| /dashboard | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /dashboard | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /dashboard | row controls | no loaded rows | N/A | no_target |
| /dashboard | navigate | destination opened | PASS | nav_matched |
| /dashboard | go back | original page restored | PASS | nav_matched |
| /dashboard | refresh | executed and audited | PASS | executed |
| /premelt-gate | ASK/control what can i ask here | executed | PASS | executed |
| /premelt-gate | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /premelt-gate | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /premelt-gate | ASK/control scroll down | executed | PASS | executed |
| /premelt-gate | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /premelt-gate | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /premelt-gate | row control select PIG-0901 | executed | PASS | executed |
| /premelt-gate | row control தேர்ந்தெடு PIG-0901 | executed | PASS | executed |
| /premelt-gate | row control चुनो PIG-0901 | executed | PASS | executed |
| /premelt-gate | row control read this row | executed | PASS | executed |
| /premelt-gate | navigate | destination opened | PASS | nav_matched |
| /premelt-gate | go back | original page restored | PASS | nav_matched |
| /premelt-gate | refresh | executed and audited | PASS | executed |
| /raw-material-stock | ASK/control what can i ask here | executed | PASS | executed |
| /raw-material-stock | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /raw-material-stock | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /raw-material-stock | ASK/control scroll down | executed | PASS | executed |
| /raw-material-stock | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /raw-material-stock | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /raw-material-stock | row control select PIG-1053 | executed | PASS | executed |
| /raw-material-stock | row control தேர்ந்தெடு PIG-1053 | executed | PASS | executed |
| /raw-material-stock | row control चुनो PIG-1053 | executed | PASS | executed |
| /raw-material-stock | row control read this row | executed | PASS | executed |
| /raw-material-stock | navigate | destination opened | PASS | nav_matched |
| /raw-material-stock | go back | original page restored | PASS | nav_matched |
| /raw-material-stock | refresh | executed and audited | PASS | executed |
| /yard-inspection | ASK/control what can i ask here | executed | PASS | executed |
| /yard-inspection | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /yard-inspection | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /yard-inspection | ASK/control scroll down | executed | PASS | executed |
| /yard-inspection | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /yard-inspection | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /yard-inspection | row control select SCR-0912 | executed | PASS | executed |
| /yard-inspection | row control தேர்ந்தெடு SCR-0912 | executed | PASS | executed |
| /yard-inspection | row control चुनो SCR-0912 | executed | PASS | executed |
| /yard-inspection | row control read this row | executed | PASS | executed |
| /yard-inspection | navigate | destination opened | PASS | nav_matched |
| /yard-inspection | go back | original page restored | PASS | nav_matched |
| /yard-inspection | refresh | executed and audited | PASS | executed |
| /spectrometer | ASK/control what can i ask here | executed | PASS | executed |
| /spectrometer | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /spectrometer | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /spectrometer | ASK/control scroll down | executed | PASS | executed |
| /spectrometer | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /spectrometer | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /spectrometer | row controls | no loaded rows | N/A | no_target |
| /spectrometer | navigate | destination opened | PASS | nav_matched |
| /spectrometer | go back | original page restored | PASS | nav_matched |
| /spectrometer | refresh | executed and audited | PASS | executed |
| /grades | ASK/control what can i ask here | executed | PASS | executed |
| /grades | ASK/control இங்க என்ன கேக்கலாம் | executed | PASS | executed |
| /grades | ASK/control यहाँ क्या पूछ सकते हैं | executed | PASS | executed |
| /grades | ASK/control scroll down | executed | PASS | executed |
| /grades | ASK/control மேலே நகர்த்து | executed | PASS | executed |
| /grades | ASK/control नीचे स्क्रॉल करो | executed | PASS | executed |
| /grades | row control select SG-IRON | executed | PASS | executed |
| /grades | row control தேர்ந்தெடு SG-IRON | executed | PASS | executed |
| /grades | row control चुनो SG-IRON | executed | PASS | executed |
| /grades | row control read this row | executed | PASS | executed |
| /grades | navigate | destination opened | PASS | nav_matched |
| /grades | go back | original page restored | PASS | nav_matched |
| /grades | refresh | executed and audited | PASS | executed |
| /training-data | native APPROVE right credential | executed | PASS | executed |
| /training-data | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /training-data | native APPROVE wrong credential then retry | executed | PASS | executed |
| /training-data | native APPROVE three wrong credentials | locked | PASS | locked |
| /training-data | native reset approval lock | unlocked; zero failures | PASS | executed |
| /inventory-forecast | native APPROVE right credential | executed | PASS | executed |
| /inventory-forecast | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /inventory-forecast | native APPROVE wrong credential then retry | executed | PASS | executed |
| /inventory-forecast | native APPROVE three wrong credentials | locked | PASS | locked |
| /inventory-forecast | native reset approval lock | unlocked; zero failures | PASS | executed |
| /anomaly | native APPROVE right credential | executed | PASS | executed |
| /anomaly | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /anomaly | native APPROVE wrong credential then retry | executed | PASS | executed |
| /anomaly | native APPROVE three wrong credentials | locked | PASS | locked |
| /anomaly | native reset approval lock | unlocked; zero failures | PASS | executed |
| /recommendation | native APPROVE right credential | executed | PASS | executed |
| /recommendation | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /recommendation | native APPROVE wrong credential then retry | executed | PASS | executed |
| /recommendation | native APPROVE three wrong credentials | locked | PASS | locked |
| /recommendation | native reset approval lock | unlocked; zero failures | PASS | executed |
| /premelt-gate | native APPROVE right credential | executed | PASS | executed |
| /premelt-gate | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /premelt-gate | native APPROVE wrong credential then retry | executed | PASS | executed |
| /premelt-gate | native APPROVE three wrong credentials | locked | PASS | locked |
| /premelt-gate | native reset approval lock | unlocked; zero failures | PASS | executed |
| /raw-material-stock | native APPROVE right credential | executed | PASS | executed |
| /raw-material-stock | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /raw-material-stock | native APPROVE wrong credential then retry | executed | PASS | executed |
| /raw-material-stock | native APPROVE three wrong credentials | locked | PASS | locked |
| /raw-material-stock | native reset approval lock | unlocked; zero failures | PASS | executed |
| /yard-inspection | native APPROVE right credential | executed | PASS | executed |
| /yard-inspection | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /yard-inspection | native APPROVE wrong credential then retry | executed | PASS | executed |
| /yard-inspection | native APPROVE three wrong credentials | locked | PASS | locked |
| /yard-inspection | native reset approval lock | unlocked; zero failures | PASS | executed |
| /grades | native APPROVE right credential | executed | PASS | executed |
| /grades | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /grades | native APPROVE wrong credential then retry | executed | PASS | executed |
| /grades | native APPROVE three wrong credentials | locked | PASS | locked |
| /grades | native reset approval lock | unlocked; zero failures | PASS | executed |
| /supplier-scorecard | native APPROVE right credential | executed | PASS | executed |
| /supplier-scorecard | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /supplier-scorecard | native APPROVE wrong credential then retry | executed | PASS | executed |
| /supplier-scorecard | native APPROVE three wrong credentials | locked | PASS | locked |
| /supplier-scorecard | native reset approval lock | unlocked; zero failures | PASS | executed |
| /cost-analysis | native APPROVE right credential | executed | PASS | executed |
| /cost-analysis | native APPROVE non-digit retry | refused | PASS | code_not_digits |
| /cost-analysis | native APPROVE wrong credential then retry | executed | PASS | executed |
| /cost-analysis | native APPROVE three wrong credentials | locked | PASS | locked |
| /cost-analysis | native reset approval lock | unlocked; zero failures | PASS | executed |
| /spectrometer | ASK | answered and audited | PASS | executed |
| /spectrometer | page control | executed | PASS | executed |
| /spectrometer | select loaded row | no loaded rows | N/A | no_target |
| /spectrometer | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /spectrometer | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /spectrometer | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /spectrometer | APPROVE right credential | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 1 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 2 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 3 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 4 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 5 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 6 | executed | PASS | executed |
| /spectrometer | APPROVE right credential repeat 7 | executed | PASS | executed |
| /spectrometer | APPROVE non-digit retry | refused | PASS | code_not_digits |
| /spectrometer | APPROVE wrong credential then retry | executed | PASS | executed |
| /spectrometer | APPROVE three wrong credentials | locked | PASS | locked |
| /spectrometer | reset approval lock | unlocked; zero failures | PASS | executed |
| /spectrometer | safe request reading | executed without yes/no | PASS | executed |
| /spectrometer | safe-action connection setup | executed | PASS | executed |
| /raw-material-stock | ASK | answered and audited | PASS | executed |
| /raw-material-stock | page control | executed | PASS | executed |
| /raw-material-stock | select loaded row | selected | PASS | executed |
| /raw-material-stock | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /raw-material-stock | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /raw-material-stock | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /supplier-scorecard | ASK | answered and audited | PASS | executed |
| /supplier-scorecard | page control | executed | PASS | executed |
| /supplier-scorecard | select loaded row | selected | PASS | executed |
| /supplier-scorecard | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /supplier-scorecard | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /supplier-scorecard | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /energy | ASK | answered and audited | PASS | executed |
| /energy | page control | executed | PASS | executed |
| /energy | select loaded row | selected | PASS | executed |
| /energy | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /energy | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /energy | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /dashboard | ASK | answered and audited | PASS | executed |
| /dashboard | page control | executed | PASS | executed |
| /dashboard | select loaded row | no loaded rows | N/A | no_target |
| /dashboard | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /dashboard | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /dashboard | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /premelt-gate | ASK | answered and audited | PASS | executed |
| /premelt-gate | page control | executed | PASS | executed |
| /premelt-gate | select loaded row | selected | PASS | executed |
| /premelt-gate | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /premelt-gate | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /premelt-gate | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /yard-inspection | ASK | answered and audited | PASS | executed |
| /yard-inspection | page control | executed | PASS | executed |
| /yard-inspection | select loaded row | selected | PASS | executed |
| /yard-inspection | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /yard-inspection | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /yard-inspection | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /grades | ASK | answered and audited | PASS | executed |
| /grades | page control | executed | PASS | executed |
| /grades | select loaded row | selected | PASS | executed |
| /grades | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /grades | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /grades | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /inventory-forecast | ASK | answered and audited | PASS | executed |
| /inventory-forecast | page control | executed | PASS | executed |
| /inventory-forecast | select loaded row | no loaded rows | N/A | no_target |
| /inventory-forecast | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /inventory-forecast | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /inventory-forecast | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /sales | ASK | answered and audited | PASS | executed |
| /sales | page control | executed | PASS | executed |
| /sales | select loaded row | no loaded rows | N/A | no_target |
| /sales | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /sales | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /sales | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /cost-analysis | ASK | answered and audited | PASS | executed |
| /cost-analysis | page control | executed | PASS | executed |
| /cost-analysis | select loaded row | no loaded rows | N/A | no_target |
| /cost-analysis | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /cost-analysis | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /cost-analysis | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /anomaly | ASK | answered and audited | PASS | executed |
| /anomaly | page control | executed | PASS | executed |
| /anomaly | select loaded row | no loaded rows | N/A | no_target |
| /anomaly | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /anomaly | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /anomaly | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /recommendation | ASK | answered and audited | PASS | executed |
| /recommendation | page control | executed | PASS | executed |
| /recommendation | select loaded row | no loaded rows | N/A | no_target |
| /recommendation | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /recommendation | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /recommendation | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /rl-optimizer | ASK | answered and audited | PASS | executed |
| /rl-optimizer | page control | executed | PASS | executed |
| /rl-optimizer | select loaded row | no loaded rows | N/A | no_target |
| /rl-optimizer | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /rl-optimizer | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /rl-optimizer | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /full-analysis | ASK | answered and audited | PASS | executed |
| /full-analysis | page control | executed | PASS | executed |
| /full-analysis | select loaded row | no loaded rows | N/A | no_target |
| /full-analysis | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /full-analysis | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /full-analysis | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /mechanical-properties | ASK | answered and audited | PASS | executed |
| /mechanical-properties | page control | executed | PASS | executed |
| /mechanical-properties | select loaded row | no loaded rows | N/A | no_target |
| /mechanical-properties | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /mechanical-properties | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /mechanical-properties | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /agent | ASK | answered and audited | PASS | executed |
| /agent | page control | executed | PASS | executed |
| /agent | select loaded row | no loaded rows | N/A | no_target |
| /agent | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /agent | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /agent | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /synthetic | ASK | answered and audited | PASS | executed |
| /synthetic | page control | executed | PASS | executed |
| /synthetic | select loaded row | no loaded rows | N/A | no_target |
| /synthetic | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /synthetic | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /synthetic | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /training-data | ASK | answered and audited | PASS | executed |
| /training-data | page control | executed | PASS | executed |
| /training-data | select loaded row | selected | PASS | executed |
| /training-data | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /training-data | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /training-data | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /semantic-search | ASK | answered and audited | PASS | executed |
| /semantic-search | page control | executed | PASS | executed |
| /semantic-search | select loaded row | no loaded rows | N/A | no_target |
| /semantic-search | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /semantic-search | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /semantic-search | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /charge-optimizer | ASK | answered and audited | PASS | executed |
| /charge-optimizer | page control | executed | PASS | executed |
| /charge-optimizer | select loaded row | no loaded rows | N/A | no_target |
| /charge-optimizer | RUN voice yes | executed; one STT per spoken reply | PASS | executed |
| /charge-optimizer | RUN voice no | cancelled; one STT per spoken reply | PASS | cancelled |
| /charge-optimizer | RUN voice silence | timeout; one STT per spoken reply | PASS | timeout |
| /agent | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /charge-optimizer | safe action availability | no registered ASK action on this page | N/A | no_target |
| /charge-optimizer | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /cost-analysis | safe action availability | no registered ASK action on this page | N/A | no_target |
| /dashboard | safe action availability | no registered ASK action on this page | N/A | no_target |
| /dashboard | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /energy | safe action availability | no registered ASK action on this page | N/A | no_target |
| /energy | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /grades | safe action availability | no registered ASK action on this page | N/A | no_target |
| /inventory-forecast | safe action availability | no registered ASK action on this page | N/A | no_target |
| /raw-material-stock | safe action availability | no registered ASK action on this page | N/A | no_target |
| /rl-optimizer | safe action availability | no registered ASK action on this page | N/A | no_target |
| /sales | safe action availability | no registered ASK action on this page | N/A | no_target |
| /semantic-search | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /synthetic | safe action availability | no registered ASK action on this page | N/A | no_target |
| /synthetic | private action availability | no registered APPROVE action on this page | N/A | no_target |
| /training-data | safe action availability | no registered ASK action on this page | N/A | no_target |
| /yard-inspection | safe action availability | no registered ASK action on this page | N/A | no_target |

Coverage: 21 routed pages. Initial commands enter through the development transcript control; synthetic microphone replies use the Agent transcription endpoint. RUN yes/no/silence uses the registered harmless test action on every route. Native APPROVE matrices cover each route that registers APPROVE actions, including heat-workflow setup for strategy acceptance, tap and invoice. Safe action checks cover each page with a registered safe action. Pages without an applicable registered action or loaded row are explicitly N/A.

Limitations: this is mocked, not live microphone/STT or audible TTS validation. The sweep exercises one representative native action per applicable page; it does not execute every possible action/data/role combination. Next/previous and portal-tab handler regressions are covered separately in the real-page suite. Earlier failed runs are retained in logs; table rows reflect their latest rerun. No passcodes, audio or keys are included.
