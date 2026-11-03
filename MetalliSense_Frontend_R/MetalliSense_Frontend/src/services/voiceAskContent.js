// DRAFT · Builder: Nethra. All F17 ASK sentences for team review.
export const voiceAskDrafts=[
  {
    "page": "/spectrometer",
    "intent": "time",
    "pattern": "timestamp|when|நேரம்|कब",
    "path": "latestReading.timestamp",
    "fallback": "latestReading.createdAt",
    "ta": "ரீடிங் நேரம்: {value}.",
    "hi": "रीडिंग का समय: {value}।",
    "en": "Reading time: {value}."
  },
  {
    "page": "/spectrometer",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "latestReading.C",
    "fallback": "latestReading.composition.C",
    "ta": "கார்பன்: {value}.",
    "hi": "कार्बन: {value}।",
    "en": "Carbon: {value}."
  },
  {
    "page": "/spectrometer",
    "intent": "silicon",
    "pattern": "silicon|சிலிக்கான்|सिलिकॉन",
    "path": "latestReading.Si",
    "fallback": "latestReading.composition.Si",
    "ta": "சிலிக்கான்: {value}.",
    "hi": "सिलिकॉन: {value}।",
    "en": "Silicon: {value}."
  },
  {
    "page": "/spectrometer",
    "intent": "heat",
    "pattern": "heat|ஹீட்|हीट",
    "path": "latestReading.heatId",
    "fallback": null,
    "ta": "ரீடிங் ஹீட்: {value}.",
    "hi": "रीडिंग हीट: {value}।",
    "en": "Reading heat: {value}."
  },
  {
    "page": "/grades",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "grade.composition_ranges.C",
    "fallback": null,
    "ta": "கார்பன் ரேஞ்ச்: {value}.",
    "hi": "कार्बन रेंज: {value}।",
    "en": "Carbon range: {value}."
  },
  {
    "page": "/grades",
    "intent": "standard",
    "pattern": "standard|ஸ்டாண்டர்ட்|मानक",
    "path": "grade.standard",
    "fallback": null,
    "ta": "ஸ்டாண்டர்ட்: {value}.",
    "hi": "मानक: {value}।",
    "en": "Standard: {value}."
  },
  {
    "page": "/grades",
    "intent": "tensile",
    "pattern": "tensile|வலிமை|तन्य",
    "path": "grade.physical_properties.tensile_strength_mpa",
    "fallback": null,
    "ta": "Tensile ரேஞ்ச்: {value}.",
    "hi": "Tensile रेंज: {value}।",
    "en": "Tensile range: {value}."
  },
  {
    "page": "/grades",
    "intent": "applications",
    "pattern": "applications|பயன்பாடு|उपयोग",
    "path": "grade.typical_applications",
    "fallback": null,
    "ta": "பயன்பாடுகள்: {value}.",
    "hi": "उपयोग: {value}।",
    "en": "Applications: {value}."
  },
  {
    "page": "/supplier-scorecard",
    "intent": "score",
    "pattern": "score|ஸ்கோர்|स्कोर",
    "path": "supplier.score",
    "fallback": null,
    "ta": "சப்ளையர் ஸ்கோர்: {value}.",
    "hi": "सप्लायर स्कोर: {value}।",
    "en": "Supplier score: {value}."
  },
  {
    "page": "/supplier-scorecard",
    "intent": "grade",
    "pattern": "grade|கிரேட்|ग्रेड",
    "path": "supplier.grade",
    "fallback": null,
    "ta": "சப்ளையர் கிரேட்: {value}.",
    "hi": "सप्लायर ग्रेड: {value}।",
    "en": "Supplier grade: {value}."
  },
  {
    "page": "/supplier-scorecard",
    "intent": "pillar",
    "pattern": "pillar|காரணம்|कारण",
    "path": "supplier.pillars",
    "fallback": null,
    "ta": "ஸ்கோர் விவரம்: {value}.",
    "hi": "स्कोर विवरण: {value}।",
    "en": "Score pillars: {value}."
  },
  {
    "page": "/supplier-scorecard",
    "intent": "alerts",
    "pattern": "alert|அலர்ட்|चेतावनी",
    "path": "data.alerts",
    "fallback": null,
    "ta": "சப்ளையர் அலர்ட்: {value}.",
    "hi": "सप्लायर अलर्ट: {value}।",
    "en": "Supplier alerts: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "usable",
    "pattern": "usable|available|இருப்பு|उपलब्ध",
    "path": "item.usableKg",
    "fallback": null,
    "ta": "பயன்படுத்தக்கூடிய இருப்பு kg: {value}.",
    "hi": "उपयोग योग्य स्टॉक kg: {value}।",
    "en": "Usable stock kg: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "cover",
    "pattern": "cover|எத்தனை நாள்|दिन",
    "path": "item.coverDays",
    "fallback": null,
    "ta": "இருப்பு வரும் நாட்கள்: {value}.",
    "hi": "स्टॉक के दिन: {value}।",
    "en": "Cover days: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "order",
    "pattern": "order|ஆர்டர்|ऑर्डर",
    "path": "item.orderKg",
    "fallback": null,
    "ta": "ஆர்டர் அளவு kg: {value}.",
    "hi": "ऑर्डर मात्रा kg: {value}।",
    "en": "Order kg: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "approver",
    "pattern": "approved|approver|அனுமதி|मंजूर",
    "path": "pr.approvedBy",
    "fallback": null,
    "ta": "அனுமதிச்சவர்: {value}.",
    "hi": "मंजूरी देने वाले: {value}।",
    "en": "Approved by: {value}."
  },
  {
    "page": "/raw-material-stock",
    "intent": "available",
    "pattern": "available|amount|எவ்வளவு|कितना",
    "path": "lot.availableKg",
    "fallback": null,
    "ta": "லாட் இருப்பு kg: {value}.",
    "hi": "लॉट स्टॉक kg: {value}।",
    "en": "Lot available kg: {value}."
  },
  {
    "page": "/raw-material-stock",
    "intent": "reason",
    "pattern": "reason|quarantine|காரணம்|कारण",
    "path": "lot.statusReason",
    "fallback": null,
    "ta": "லாட் நிலைக்கான காரணம்: {value}.",
    "hi": "लॉट स्थिति का कारण: {value}।",
    "en": "Lot status reason: {value}."
  },
  {
    "page": "/raw-material-stock",
    "intent": "phosphorus",
    "pattern": "phosphorus|பாஸ்பரஸ்|फॉस्फोरस",
    "path": "detail.qa.0.values.P",
    "fallback": "lot.tested.P",
    "ta": "லேப் P %: {value}.",
    "hi": "लैब P %: {value}।",
    "en": "Lab P %: {value}."
  },
  {
    "page": "/raw-material-stock",
    "intent": "movements",
    "pattern": "movement|changed|மாற்றம்|बदला",
    "path": "detail.movements",
    "fallback": null,
    "ta": "ஸ்டாக் மாற்றங்கள்: {value}.",
    "hi": "स्टॉक बदलाव: {value}।",
    "en": "Stock movements: {value}."
  },
  {
    "page": "/yard-inspection",
    "intent": "connected",
    "pattern": "connect|கனெக்ட்|कनेक्ट",
    "path": "status.client.isConnected",
    "fallback": null,
    "ta": "கன் இணைப்பு: {value}.",
    "hi": "गन कनेक्शन: {value}।",
    "en": "Gun connected: {value}."
  },
  {
    "page": "/yard-inspection",
    "intent": "pieces",
    "pattern": "pieces|பீஸ்|टुकड़े",
    "path": "live.piecesDone",
    "fallback": null,
    "ta": "முடிஞ்ச பீஸ்: {value}.",
    "hi": "पूरे हुए टुकड़े: {value}।",
    "en": "Pieces done: {value}."
  },
  {
    "page": "/yard-inspection",
    "intent": "copper",
    "pattern": "copper|காப்பர்|कॉपर",
    "path": "live.result.evidence.worst.Cu.value",
    "fallback": null,
    "ta": "அதிகமான Cu %: {value}.",
    "hi": "सबसे अधिक Cu %: {value}।",
    "en": "Worst Cu %: {value}."
  },
  {
    "page": "/yard-inspection",
    "intent": "reason",
    "pattern": "reason|காரணம்|कारण",
    "path": "live.result.decision.reason",
    "fallback": null,
    "ta": "லாட் முடிவுக்கான காரணம்: {value}.",
    "hi": "लॉट निर्णय का कारण: {value}।",
    "en": "Lot decision reason: {value}."
  },
  {
    "page": "/premelt-gate",
    "intent": "decision",
    "pattern": "decision|status|நிலை|स्थिति",
    "path": "heat.gateResult.decision",
    "fallback": null,
    "ta": "கேட் முடிவு: {value}.",
    "hi": "गेट निर्णय: {value}।",
    "en": "Gate decision: {value}."
  },
  {
    "page": "/premelt-gate",
    "intent": "blocking",
    "pattern": "block|reason|தடை|कारण",
    "path": "heat.gateResult.blocking",
    "fallback": null,
    "ta": "ஸ்டார்ட் தடை: {value}.",
    "hi": "शुरू करने की बाधाएँ: {value}।",
    "en": "Start blockers: {value}."
  },
  {
    "page": "/premelt-gate",
    "intent": "copper",
    "pattern": "copper|காப்பர்|कॉपर",
    "path": "heat.gateResult.prediction.composition.Cu",
    "fallback": null,
    "ta": "கணிச்ச Cu %: {value}.",
    "hi": "अनुमानित Cu %: {value}।",
    "en": "Predicted Cu %: {value}."
  },
  {
    "page": "/premelt-gate",
    "intent": "valid",
    "pattern": "valid|expiry|காலம்|वैध",
    "path": "heat.gateResult.validUntil",
    "fallback": null,
    "ta": "கேட் முடிவு காலம்; freshness மறுபடி சரிபார்க்கணும்: {value}.",
    "hi": "गेट समय सीमा; freshness फिर जाँचनी होगी: {value}।",
    "en": "Gate valid-until; freshness must be rechecked: {value}."
  },
  {
    "page": "/premelt-gate",
    "intent": "charge",
    "pattern": "charge|சார்ஜ்|चार्ज",
    "path": "heat.charge",
    "fallback": null,
    "ta": "சார்ஜ் லாட் மற்றும் kg: {value}.",
    "hi": "चार्ज लॉट और kg: {value}।",
    "en": "Charge lots and kg: {value}."
  },
  {
    "page": "/energy",
    "intent": "predicted",
    "pattern": "predicted|energy|எனர்ஜி|ऊर्जा",
    "path": "energy.kwh",
    "fallback": null,
    "ta": "கணிச்ச energy kWh: {value}.",
    "hi": "अनुमानित ऊर्जा kWh: {value}।",
    "en": "Predicted energy kWh: {value}."
  },
  {
    "page": "/energy",
    "intent": "meter",
    "pattern": "meter|மீட்டர்|मीटर",
    "path": "energy.actual.actualKwh",
    "fallback": null,
    "ta": "பதிவான meter kWh: {value}.",
    "hi": "दर्ज मीटर kWh: {value}।",
    "en": "Recorded meter kWh: {value}."
  },
  {
    "page": "/energy",
    "intent": "driver",
    "pattern": "driver|காரணம்|कारण",
    "path": "energy.drivers",
    "fallback": null,
    "ta": "Energy காரணங்கள்: {value}.",
    "hi": "ऊर्जा के कारण: {value}।",
    "en": "Energy drivers: {value}."
  },
  {
    "page": "/energy",
    "intent": "savings",
    "pattern": "saving|சேமிப்பு|बचत",
    "path": "data.savings.rsAvoided",
    "fallback": null,
    "ta": "மாதிரி கணக்கில் சேமிச்ச ரூபாய்: {value}.",
    "hi": "मॉडल के अनुसार बचत रुपये: {value}।",
    "en": "Modeled savings INR: {value}."
  },
  {
    "page": "/anomaly",
    "intent": "severity",
    "pattern": "severity|deviation|தீவிரம்|गंभीर",
    "path": "result.severity",
    "fallback": null,
    "ta": "Deviation தீவிரம்: {value}.",
    "hi": "Deviation की गंभीरता: {value}।",
    "en": "Deviation severity: {value}."
  },
  {
    "page": "/anomaly",
    "intent": "score",
    "pattern": "score|ஸ்கோர்|स्कोर",
    "path": "result.anomaly_score",
    "fallback": null,
    "ta": "Anomaly ஸ்கோர்: {value}.",
    "hi": "Anomaly स्कोर: {value}।",
    "en": "Anomaly score: {value}."
  },
  {
    "page": "/anomaly",
    "intent": "compliance",
    "pattern": "compli|பொருத்தம்|अनुपालन",
    "path": "result.compliance.summary",
    "fallback": null,
    "ta": "பொருந்துற element விவரம்: {value}.",
    "hi": "अनुपालन विवरण: {value}।",
    "en": "Compliance summary: {value}."
  },
  {
    "page": "/anomaly",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "reading.composition.C",
    "fallback": null,
    "ta": "பகுப்பாய்வில் C %: {value}.",
    "hi": "विश्लेषण में C %: {value}।",
    "en": "Analyzed C %: {value}."
  },
  {
    "page": "/recommendation",
    "intent": "additions",
    "pattern": "addition|சேர்க்கை|जोड़",
    "path": "result.aiAnalysis.alloyRecommendation.recommended_additions",
    "fallback": null,
    "ta": "பரிந்துரைத்த சேர்க்கைகள்: {value}.",
    "hi": "सुझाए गए मिश्रण: {value}।",
    "en": "Proposed additions: {value}."
  },
  {
    "page": "/recommendation",
    "intent": "alternatives",
    "pattern": "alternative|மாற்று|विकल्प",
    "path": "result.aiAnalysis.alloyRecommendation.alternative_grades",
    "fallback": null,
    "ta": "மாற்று கிரேட்கள்: {value}.",
    "hi": "वैकल्पिक ग्रेड: {value}।",
    "en": "Alternative grades: {value}."
  },
  {
    "page": "/recommendation",
    "intent": "available",
    "pattern": "available|service|கிடைக்குதா|उपलब्ध",
    "path": "result.aiAnalysis.serviceAvailable",
    "fallback": null,
    "ta": "சேவை கிடைக்குற நிலை: {value}.",
    "hi": "सेवा उपलब्धता: {value}।",
    "en": "Service available: {value}."
  },
  {
    "page": "/recommendation",
    "intent": "chemistry",
    "pattern": "chemistry|composition|கலவை|संरचना",
    "path": "reading.composition",
    "fallback": null,
    "ta": "பிளான் போட்ட கலவை: {value}.",
    "hi": "योजना की संरचना: {value}।",
    "en": "Plan input composition: {value}."
  },
  {
    "page": "/rl-optimizer",
    "intent": "additions",
    "pattern": "addition|சேர்க்கை|जोड़",
    "path": "candidate.recommended_additions",
    "fallback": null,
    "ta": "தேர்ந்த ஸ்ட்ராடஜி சேர்க்கைகள்: {value}.",
    "hi": "चुनी रणनीति के मिश्रण: {value}।",
    "en": "Selected strategy additions: {value}."
  },
  {
    "page": "/rl-optimizer",
    "intent": "cost",
    "pattern": "cost|செலவு|लागत",
    "path": "candidate.estimatedCost",
    "fallback": null,
    "ta": "கணிச்ச செலவு: {value}.",
    "hi": "अनुमानित लागत: {value}।",
    "en": "Estimated cost: {value}."
  },
  {
    "page": "/rl-optimizer",
    "intent": "updates",
    "pattern": "update|அப்டேட்|अपडेट",
    "path": "policyStatus.n_updates",
    "fallback": null,
    "ta": "Policy அப்டேட்கள்: {value}.",
    "hi": "Policy अपडेट: {value}।",
    "en": "Policy updates: {value}."
  },
  {
    "page": "/rl-optimizer",
    "intent": "lots",
    "pattern": "lot|லாட்|लॉट",
    "path": "flow.suggestedAdditions",
    "fallback": null,
    "ta": "பக்கத்தில் காட்டுற லாட் விவரம்; deduction உறுதி இல்லை: {value}.",
    "hi": "स्क्रीन पर लॉट विवरण; कटौती की पुष्टि नहीं: {value}।",
    "en": "Shown lot suggestions; deduction not confirmed: {value}."
  },
  {
    "page": "/full-analysis",
    "intent": "severity",
    "pattern": "severity|தீவிரம்|गंभीर",
    "path": "result.steps.anomalyDetection.severity",
    "fallback": null,
    "ta": "கண்ட deviation தீவிரம்: {value}.",
    "hi": "Deviation की गंभीरता: {value}।",
    "en": "Run deviation severity: {value}."
  },
  {
    "page": "/full-analysis",
    "intent": "correction",
    "pattern": "correction|addition|சேர்க்கை|सुधार",
    "path": "result.steps.alloyRecommendation.recommended_additions",
    "fallback": null,
    "ta": "பரிந்துரைத்த correction: {value}.",
    "hi": "सुझाया सुधार: {value}।",
    "en": "Proposed correction: {value}."
  },
  {
    "page": "/full-analysis",
    "intent": "carbon",
    "pattern": "carbon|co2|கார்பன்|कार्बन",
    "path": "result.steps.alloyRecommendation.estimatedCarbon.totalBatchCo2Kg",
    "fallback": null,
    "ta": "Batch CO2 கணிப்பு kg: {value}.",
    "hi": "Batch CO2 अनुमान kg: {value}।",
    "en": "Batch CO2 estimate kg: {value}."
  },
  {
    "page": "/full-analysis",
    "intent": "root",
    "pattern": "root|காரணம்|कारण",
    "path": "result.steps.rootCauseHint",
    "fallback": null,
    "ta": "சாத்தியமான காரணம்; உறுதியான காரணம் இல்லை: {value}.",
    "hi": "संभावित कारण; पुष्टि नहीं: {value}।",
    "en": "Root-cause hint; not confirmed: {value}."
  },
  {
    "page": "/agent",
    "intent": "grade",
    "pattern": "grade|கிரேட்|ग्रेड",
    "path": "reading.metalGrade",
    "fallback": null,
    "ta": "பகுப்பாய்வு கிரேட்: {value}.",
    "hi": "विश्लेषण ग्रेड: {value}।",
    "en": "Analyzed grade: {value}."
  },
  {
    "page": "/agent",
    "intent": "anomaly",
    "pattern": "anomaly|deviation|டெவியேஷன்|विचलन",
    "path": "result.aiAnalysis.anomalyDetection",
    "fallback": null,
    "ta": "Agent anomaly விவரம்: {value}.",
    "hi": "Agent anomaly विवरण: {value}।",
    "en": "Agent anomaly result: {value}."
  },
  {
    "page": "/agent",
    "intent": "additions",
    "pattern": "addition|சேர்க்கை|जोड़",
    "path": "result.aiAnalysis.alloyRecommendation.recommended_additions",
    "fallback": null,
    "ta": "பரிந்துரைத்த சேர்க்கைகள்: {value}.",
    "hi": "सुझाए मिश्रण: {value}।",
    "en": "Proposed additions: {value}."
  },
  {
    "page": "/agent",
    "intent": "explanation",
    "pattern": "explain|விளக்கம்|समझा",
    "path": "explanation",
    "fallback": null,
    "ta": "கிடைச்ச விளக்கம்: {value}.",
    "hi": "मिला स्पष्टीकरण: {value}।",
    "en": "Returned explanation: {value}."
  },
  {
    "page": "/mechanical-properties",
    "intent": "tensile",
    "pattern": "tensile|வலிமை|तन्य",
    "path": "result.predicted_uts_mpa",
    "fallback": null,
    "ta": "கணிச்ச tensile MPa; test செய்து உறுதி செய்யணும்: {value}.",
    "hi": "अनुमानित tensile MPa; test से पुष्टि करें: {value}।",
    "en": "Predicted tensile MPa; verify by testing: {value}."
  },
  {
    "page": "/mechanical-properties",
    "intent": "elongation",
    "pattern": "elongation|நீட்சி|बढ़ाव",
    "path": "result.predicted_elongation_pct",
    "fallback": null,
    "ta": "கணிச்ச elongation %: {value}.",
    "hi": "अनुमानित elongation %: {value}।",
    "en": "Predicted elongation %: {value}."
  },
  {
    "page": "/mechanical-properties",
    "intent": "quality",
    "pattern": "quality|pass|தரம்|गुणवत्ता",
    "path": "result.quality_result",
    "fallback": null,
    "ta": "கணிப்பின் தர முடிவு: {value}.",
    "hi": "अनुमान का गुणवत्ता परिणाम: {value}।",
    "en": "Estimate quality result: {value}."
  },
  {
    "page": "/mechanical-properties",
    "intent": "tap",
    "pattern": "tap|finished|டேப்|पूरा",
    "path": "finished.tap",
    "fallback": null,
    "ta": "பதிவான tap விவரம்: {value}.",
    "hi": "दर्ज tap विवरण: {value}।",
    "en": "Recorded tap details: {value}."
  },
  {
    "page": "/sales",
    "intent": "weight",
    "pattern": "weight|எடை|वजन",
    "path": "saleHeat.tap.castingsKg",
    "fallback": null,
    "ta": "Invoiceக்கு தயாரான எடை kg: {value}.",
    "hi": "Invoice के लिए तैयार वजन kg: {value}।",
    "en": "Weight ready for invoice kg: {value}."
  },
  {
    "page": "/sales",
    "intent": "downgrade",
    "pattern": "downgrade|grade|கிரேட்|ग्रेड",
    "path": "saleHeat.tap.soldGrade",
    "fallback": null,
    "ta": "விற்பனை கிரேட்: {value}.",
    "hi": "बिक्री ग्रेड: {value}।",
    "en": "Sold grade: {value}."
  },
  {
    "page": "/sales",
    "intent": "invoice",
    "pattern": "invoice|இன்வாய்ஸ்|इनवॉइस",
    "path": "invoice.invoiceId",
    "fallback": null,
    "ta": "இந்த ஹீட் invoice: {value}.",
    "hi": "इस हीट का invoice: {value}।",
    "en": "Heat invoice: {value}."
  },
  {
    "page": "/sales",
    "intent": "rate",
    "pattern": "rate|விலை|दर",
    "path": "saleHeat.tap.sellingRsPerKg",
    "fallback": null,
    "ta": "பரிந்துரைத்த விலை ரூபாய்/kg: {value}.",
    "hi": "सुझाई दर रुपये/kg: {value}।",
    "en": "Suggested rate INR/kg: {value}."
  },
  {
    "page": "/synthetic",
    "intent": "grade",
    "pattern": "grade|கிரேட்|ग्रेड",
    "path": "reading.metalGrade",
    "fallback": null,
    "ta": "உருவாக்கிய synthetic கிரேட்: {value}.",
    "hi": "बनाया synthetic ग्रेड: {value}।",
    "en": "Generated synthetic grade: {value}."
  },
  {
    "page": "/synthetic",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "reading.composition.C",
    "fallback": null,
    "ta": "Synthetic C %: {value}.",
    "hi": "Synthetic C %: {value}।",
    "en": "Synthetic C %: {value}."
  },
  {
    "page": "/synthetic",
    "intent": "elements",
    "pattern": "element|deviated|எலிமெண்ட்|तत्व",
    "path": "reading.deviationElements",
    "fallback": null,
    "ta": "மாற்றிய elements: {value}.",
    "hi": "बदले गए elements: {value}।",
    "en": "Deliberately deviated elements: {value}."
  },
  {
    "page": "/synthetic",
    "intent": "percentage",
    "pattern": "percentage|percent|சதவீதம்|प्रतिशत",
    "path": "reading.deviationPercentage",
    "fallback": null,
    "ta": "கேட்ட deviation %: {value}.",
    "hi": "माँगा deviation %: {value}।",
    "en": "Requested deviation %: {value}."
  },
  {
    "page": "/training-data",
    "intent": "count",
    "pattern": "count|how many|எத்தனை|कितने",
    "path": "pagination.totalDocuments",
    "fallback": null,
    "ta": "ஃபில்டருக்கு பொருந்துற பதிவுகள்: {value}.",
    "hi": "फिल्टर से मिले रिकॉर्ड: {value}।",
    "en": "Matching records: {value}."
  },
  {
    "page": "/training-data",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "sample.C",
    "fallback": null,
    "ta": "பதிவில் C %: {value}.",
    "hi": "रिकॉर्ड में C %: {value}।",
    "en": "Record C %: {value}."
  },
  {
    "page": "/training-data",
    "intent": "severity",
    "pattern": "severity|தீவிரம்|गंभीर",
    "path": "sample.severity",
    "fallback": null,
    "ta": "பதிவின் severity: {value}.",
    "hi": "रिकॉर्ड की severity: {value}।",
    "en": "Record severity: {value}."
  },
  {
    "page": "/training-data",
    "intent": "type",
    "pattern": "normal|sample|வகை|प्रकार",
    "path": "sample.sample_type",
    "fallback": null,
    "ta": "Sample வகை: {value}.",
    "hi": "Sample प्रकार: {value}।",
    "en": "Sample type: {value}."
  },
  {
    "page": "/semantic-search",
    "intent": "results",
    "pattern": "result|found|find|கிடைச்ச|मिला",
    "path": "results",
    "fallback": null,
    "ta": "தேடலில் கிடைச்சது: {value}.",
    "hi": "खोज के परिणाम: {value}।",
    "en": "Search results: {value}."
  },
  {
    "page": "/semantic-search",
    "intent": "score",
    "pattern": "score|match|ஸ்கோர்|स्कोर",
    "path": "searchResult.score",
    "fallback": null,
    "ta": "பொருத்த ஸ்கோர்: {value}.",
    "hi": "मिलान स्कोर: {value}।",
    "en": "Match score: {value}."
  },
  {
    "page": "/semantic-search",
    "intent": "collection",
    "pattern": "collection|தொகுப்பு|संग्रह",
    "path": "collection",
    "fallback": null,
    "ta": "தேடிய collection: {value}.",
    "hi": "खोजा collection: {value}।",
    "en": "Searched collection: {value}."
  },
  {
    "page": "/cost-analysis",
    "intent": "carbon",
    "pattern": "carbon|கார்பன்|कार्बन",
    "path": "elementPrices.C.pricePerKg",
    "fallback": null,
    "ta": "C விலை ரூபாய்/kg: {value}.",
    "hi": "C दर रुपये/kg: {value}।",
    "en": "C price INR/kg: {value}."
  },
  {
    "page": "/cost-analysis",
    "intent": "base",
    "pattern": "base|sg iron|அடிப்படை|आधार",
    "path": "baseMetalPrices.SG-IRON",
    "fallback": null,
    "ta": "SG-IRON அடிப்படை செலவு: {value}.",
    "hi": "SG-IRON आधार लागत: {value}।",
    "en": "SG-IRON base cost: {value}."
  },
  {
    "page": "/cost-analysis",
    "intent": "batch",
    "pattern": "batch|estimate|பேட்ச்|बैच",
    "path": "costRecord.totalBatchCost",
    "fallback": null,
    "ta": "பதிவான batch செலவு: {value}.",
    "hi": "दर्ज batch लागत: {value}।",
    "en": "Recorded batch cost: {value}."
  },
  {
    "page": "/cost-analysis",
    "intent": "additions",
    "pattern": "addition|சேர்க்கை|जोड़",
    "path": "costRecord.totalAdditionsCost",
    "fallback": null,
    "ta": "சேர்க்கைகள் செலவு: {value}.",
    "hi": "मिश्रण लागत: {value}।",
    "en": "Additions cost: {value}."
  },
  {
    "page": "/supplier-scorecard",
    "intent": "rank",
    "pattern": "rank|ரேங்க்|रैंक",
    "path": "supplier.rank",
    "fallback": null,
    "ta": "சப்ளையர் ரேங்க்: {value}.",
    "hi": "सप्लायर रैंक: {value}।",
    "en": "Supplier rank: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "eoq",
    "pattern": "eoq|ஈஓக்யூ|ईओक्यू",
    "path": "item.eoqKg",
    "fallback": null,
    "ta": "EOQ அளவு kg: {value}.",
    "hi": "EOQ मात्रा kg: {value}।",
    "en": "EOQ kg: {value}."
  },
  {
    "page": "/inventory-forecast",
    "intent": "stockout",
    "pattern": "run out|stockout|தீரும் நேரம்|खत्म",
    "path": "item.stockOutAt",
    "fallback": null,
    "ta": "இருப்பு தீரும்னு கணிச்ச நேரம்: {value}.",
    "hi": "स्टॉक खत्म होने का अनुमानित समय: {value}।",
    "en": "Projected stock-out time: {value}."
  }
];
export const voiceAskUnavailable={ta:'இந்த பேஜ்ல அந்த தகவல் இன்னும் வரல.',hi:'यह जानकारी इस पेज पर उपलब्ध नहीं है।',en:'That information is not available on this page.'};
