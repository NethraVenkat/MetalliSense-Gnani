# F17 ASK wording review

Builder: Nethra. **DRAFT — team wording approval pending.** Values replace {value} using only loaded page snapshots. IDs/digits are preserved; missing values never become zero. No plant-data API is called by these adapters.

| Page | Intent | Tamil | Hindi | English |
|---|---|---|---|---|
| /spectrometer | time | ரீடிங் நேரம்: {value}. | रीडिंग का समय: {value}। | Reading time: {value}. |
| /spectrometer | carbon | கார்பன்: {value}. | कार्बन: {value}। | Carbon: {value}. |
| /spectrometer | silicon | சிலிக்கான்: {value}. | सिलिकॉन: {value}। | Silicon: {value}. |
| /spectrometer | heat | ரீடிங் ஹீட்: {value}. | रीडिंग हीट: {value}। | Reading heat: {value}. |
| /grades | carbon | கார்பன் ரேஞ்ச்: {value}. | कार्बन रेंज: {value}। | Carbon range: {value}. |
| /grades | standard | ஸ்டாண்டர்ட்: {value}. | मानक: {value}। | Standard: {value}. |
| /grades | tensile | Tensile ரேஞ்ச்: {value}. | Tensile रेंज: {value}। | Tensile range: {value}. |
| /grades | applications | பயன்பாடுகள்: {value}. | उपयोग: {value}। | Applications: {value}. |
| /supplier-scorecard | score | சப்ளையர் ஸ்கோர்: {value}. | सप्लायर स्कोर: {value}। | Supplier score: {value}. |
| /supplier-scorecard | grade | சப்ளையர் கிரேட்: {value}. | सप्लायर ग्रेड: {value}। | Supplier grade: {value}. |
| /supplier-scorecard | pillar | ஸ்கோர் விவரம்: {value}. | स्कोर विवरण: {value}। | Score pillars: {value}. |
| /supplier-scorecard | alerts | சப்ளையர் அலர்ட்: {value}. | सप्लायर अलर्ट: {value}। | Supplier alerts: {value}. |
| /inventory-forecast | usable | பயன்படுத்தக்கூடிய இருப்பு kg: {value}. | उपयोग योग्य स्टॉक kg: {value}। | Usable stock kg: {value}. |
| /inventory-forecast | cover | இருப்பு வரும் நாட்கள்: {value}. | स्टॉक के दिन: {value}। | Cover days: {value}. |
| /inventory-forecast | order | ஆர்டர் அளவு kg: {value}. | ऑर्डर मात्रा kg: {value}। | Order kg: {value}. |
| /inventory-forecast | approver | அனுமதிச்சவர்: {value}. | मंजूरी देने वाले: {value}। | Approved by: {value}. |
| /raw-material-stock | available | லாட் இருப்பு kg: {value}. | लॉट स्टॉक kg: {value}। | Lot available kg: {value}. |
| /raw-material-stock | reason | லாட் நிலைக்கான காரணம்: {value}. | लॉट स्थिति का कारण: {value}। | Lot status reason: {value}. |
| /raw-material-stock | phosphorus | லேப் P %: {value}. | लैब P %: {value}। | Lab P %: {value}. |
| /raw-material-stock | movements | ஸ்டாக் மாற்றங்கள்: {value}. | स्टॉक बदलाव: {value}। | Stock movements: {value}. |
| /yard-inspection | connected | கன் இணைப்பு: {value}. | गन कनेक्शन: {value}। | Gun connected: {value}. |
| /yard-inspection | pieces | முடிஞ்ச பீஸ்: {value}. | पूरे हुए टुकड़े: {value}। | Pieces done: {value}. |
| /yard-inspection | copper | அதிகமான Cu %: {value}. | सबसे अधिक Cu %: {value}। | Worst Cu %: {value}. |
| /yard-inspection | reason | லாட் முடிவுக்கான காரணம்: {value}. | लॉट निर्णय का कारण: {value}। | Lot decision reason: {value}. |
| /premelt-gate | decision | கேட் முடிவு: {value}. | गेट निर्णय: {value}। | Gate decision: {value}. |
| /premelt-gate | blocking | ஸ்டார்ட் தடை: {value}. | शुरू करने की बाधाएँ: {value}। | Start blockers: {value}. |
| /premelt-gate | copper | கணிச்ச Cu %: {value}. | अनुमानित Cu %: {value}। | Predicted Cu %: {value}. |
| /premelt-gate | valid | கேட் முடிவு காலம்; freshness மறுபடி சரிபார்க்கணும்: {value}. | गेट समय सीमा; freshness फिर जाँचनी होगी: {value}। | Gate valid-until; freshness must be rechecked: {value}. |
| /premelt-gate | charge | சார்ஜ் லாட் மற்றும் kg: {value}. | चार्ज लॉट और kg: {value}। | Charge lots and kg: {value}. |
| /energy | predicted | கணிச்ச energy kWh: {value}. | अनुमानित ऊर्जा kWh: {value}। | Predicted energy kWh: {value}. |
| /energy | meter | பதிவான meter kWh: {value}. | दर्ज मीटर kWh: {value}। | Recorded meter kWh: {value}. |
| /energy | driver | Energy காரணங்கள்: {value}. | ऊर्जा के कारण: {value}। | Energy drivers: {value}. |
| /energy | savings | மாதிரி கணக்கில் சேமிச்ச ரூபாய்: {value}. | मॉडल के अनुसार बचत रुपये: {value}। | Modeled savings INR: {value}. |
| /anomaly | severity | Deviation தீவிரம்: {value}. | Deviation की गंभीरता: {value}। | Deviation severity: {value}. |
| /anomaly | score | Anomaly ஸ்கோர்: {value}. | Anomaly स्कोर: {value}। | Anomaly score: {value}. |
| /anomaly | compliance | பொருந்துற element விவரம்: {value}. | अनुपालन विवरण: {value}। | Compliance summary: {value}. |
| /anomaly | carbon | பகுப்பாய்வில் C %: {value}. | विश्लेषण में C %: {value}। | Analyzed C %: {value}. |
| /recommendation | additions | பரிந்துரைத்த சேர்க்கைகள்: {value}. | सुझाए गए मिश्रण: {value}। | Proposed additions: {value}. |
| /recommendation | alternatives | மாற்று கிரேட்கள்: {value}. | वैकल्पिक ग्रेड: {value}। | Alternative grades: {value}. |
| /recommendation | available | சேவை கிடைக்குற நிலை: {value}. | सेवा उपलब्धता: {value}। | Service available: {value}. |
| /recommendation | chemistry | பிளான் போட்ட கலவை: {value}. | योजना की संरचना: {value}। | Plan input composition: {value}. |
| /rl-optimizer | additions | தேர்ந்த ஸ்ட்ராடஜி சேர்க்கைகள்: {value}. | चुनी रणनीति के मिश्रण: {value}। | Selected strategy additions: {value}. |
| /rl-optimizer | cost | கணிச்ச செலவு: {value}. | अनुमानित लागत: {value}। | Estimated cost: {value}. |
| /rl-optimizer | updates | Policy அப்டேட்கள்: {value}. | Policy अपडेट: {value}। | Policy updates: {value}. |
| /rl-optimizer | lots | பக்கத்தில் காட்டுற லாட் விவரம்; deduction உறுதி இல்லை: {value}. | स्क्रीन पर लॉट विवरण; कटौती की पुष्टि नहीं: {value}। | Shown lot suggestions; deduction not confirmed: {value}. |
| /full-analysis | severity | கண்ட deviation தீவிரம்: {value}. | Deviation की गंभीरता: {value}। | Run deviation severity: {value}. |
| /full-analysis | correction | பரிந்துரைத்த correction: {value}. | सुझाया सुधार: {value}। | Proposed correction: {value}. |
| /full-analysis | carbon | Batch CO2 கணிப்பு kg: {value}. | Batch CO2 अनुमान kg: {value}। | Batch CO2 estimate kg: {value}. |
| /full-analysis | root | சாத்தியமான காரணம்; உறுதியான காரணம் இல்லை: {value}. | संभावित कारण; पुष्टि नहीं: {value}। | Root-cause hint; not confirmed: {value}. |
| /agent | grade | பகுப்பாய்வு கிரேட்: {value}. | विश्लेषण ग्रेड: {value}। | Analyzed grade: {value}. |
| /agent | anomaly | Agent anomaly விவரம்: {value}. | Agent anomaly विवरण: {value}। | Agent anomaly result: {value}. |
| /agent | additions | பரிந்துரைத்த சேர்க்கைகள்: {value}. | सुझाए मिश्रण: {value}। | Proposed additions: {value}. |
| /agent | explanation | கிடைச்ச விளக்கம்: {value}. | मिला स्पष्टीकरण: {value}। | Returned explanation: {value}. |
| /mechanical-properties | tensile | கணிச்ச tensile MPa; test செய்து உறுதி செய்யணும்: {value}. | अनुमानित tensile MPa; test से पुष्टि करें: {value}। | Predicted tensile MPa; verify by testing: {value}. |
| /mechanical-properties | elongation | கணிச்ச elongation %: {value}. | अनुमानित elongation %: {value}। | Predicted elongation %: {value}. |
| /mechanical-properties | quality | கணிப்பின் தர முடிவு: {value}. | अनुमान का गुणवत्ता परिणाम: {value}। | Estimate quality result: {value}. |
| /mechanical-properties | tap | பதிவான tap விவரம்: {value}. | दर्ज tap विवरण: {value}। | Recorded tap details: {value}. |
| /sales | weight | Invoiceக்கு தயாரான எடை kg: {value}. | Invoice के लिए तैयार वजन kg: {value}। | Weight ready for invoice kg: {value}. |
| /sales | downgrade | விற்பனை கிரேட்: {value}. | बिक्री ग्रेड: {value}। | Sold grade: {value}. |
| /sales | invoice | இந்த ஹீட் invoice: {value}. | इस हीट का invoice: {value}। | Heat invoice: {value}. |
| /sales | rate | பரிந்துரைத்த விலை ரூபாய்/kg: {value}. | सुझाई दर रुपये/kg: {value}। | Suggested rate INR/kg: {value}. |
| /synthetic | grade | உருவாக்கிய synthetic கிரேட்: {value}. | बनाया synthetic ग्रेड: {value}। | Generated synthetic grade: {value}. |
| /synthetic | carbon | Synthetic C %: {value}. | Synthetic C %: {value}। | Synthetic C %: {value}. |
| /synthetic | elements | மாற்றிய elements: {value}. | बदले गए elements: {value}। | Deliberately deviated elements: {value}. |
| /synthetic | percentage | கேட்ட deviation %: {value}. | माँगा deviation %: {value}। | Requested deviation %: {value}. |
| /training-data | count | ஃபில்டருக்கு பொருந்துற பதிவுகள்: {value}. | फिल्टर से मिले रिकॉर्ड: {value}। | Matching records: {value}. |
| /training-data | carbon | பதிவில் C %: {value}. | रिकॉर्ड में C %: {value}। | Record C %: {value}. |
| /training-data | severity | பதிவின் severity: {value}. | रिकॉर्ड की severity: {value}। | Record severity: {value}. |
| /training-data | type | Sample வகை: {value}. | Sample प्रकार: {value}। | Sample type: {value}. |
| /semantic-search | results | தேடலில் கிடைச்சது: {value}. | खोज के परिणाम: {value}। | Search results: {value}. |
| /semantic-search | score | பொருத்த ஸ்கோர்: {value}. | मिलान स्कोर: {value}। | Match score: {value}. |
| /semantic-search | collection | தேடிய collection: {value}. | खोजा collection: {value}। | Searched collection: {value}. |
| /cost-analysis | carbon | C விலை ரூபாய்/kg: {value}. | C दर रुपये/kg: {value}। | C price INR/kg: {value}. |
| /cost-analysis | base | SG-IRON அடிப்படை செலவு: {value}. | SG-IRON आधार लागत: {value}। | SG-IRON base cost: {value}. |
| /cost-analysis | batch | பதிவான batch செலவு: {value}. | दर्ज batch लागत: {value}। | Recorded batch cost: {value}. |
| /cost-analysis | additions | சேர்க்கைகள் செலவு: {value}. | मिश्रण लागत: {value}। | Additions cost: {value}. |
| /supplier-scorecard | rank | சப்ளையர் ரேங்க்: {value}. | सप्लायर रैंक: {value}। | Supplier rank: {value}. |
| /inventory-forecast | eoq | EOQ அளவு kg: {value}. | EOQ मात्रा kg: {value}। | EOQ kg: {value}. |
| /inventory-forecast | stockout | இருப்பு தீரும்னு கணிச்ச நேரம்: {value}. | स्टॉक खत्म होने का अनुमानित समय: {value}। | Projected stock-out time: {value}. |

Unavailable: Tamil `இந்த பேஜ்ல அந்த தகவல் இன்னும் வரல.`; Hindi `यह जानकारी इस पेज पर उपलब्ध नहीं है।`; English `That information is not available on this page.`

Existing numbered-heat/HOLD, latest-reading summary, navigation, tour and safety behavior retains priority. Exact historical approver questions are read-only exceptions to the imperative-action filter; appended mutations are refused. Missing or ambiguous loaded selections remain unavailable. Technical Documentation remote content and tour controller metadata are not new ASK routes.
