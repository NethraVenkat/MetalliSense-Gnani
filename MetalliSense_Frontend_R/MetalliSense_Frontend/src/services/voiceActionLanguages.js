// Native command aliases; IDs and numeric arguments are never translated.
export const nativeActions={
  "request_reading": {
    "canonical": "request reading",
    "ta": [
      "ரீடிங் எடு"
    ],
    "tanglish": [
      "reading edu", "oru reading edu", "reading kudu", "oru reading ediu"
    ],
    "hi": [
      "रीडिंग लो"
    ]
  },
  "gate_check": {
    "canonical": "run gate check",
    "ta": [
      "கேட் செக் பண்ணு"
    ],
    "tanglish": [
      "gate check pannu", "gate check பண்ணு"
    ],
    "hi": [
      "गेट चेक करो"
    ]
  },
  "deviation_analyze": {
    "canonical": "run analysis",
    "ta": [
      "பகுப்பாய்வு பண்ணு"
    ],
    "tanglish": [
      "analysis pannu"
    ],
    "hi": [
      "विश्लेषण करो"
    ]
  },
  "deviation_explain": {
    "canonical": "explain",
    "ta": [
      "விளக்கி சொல்லு"
    ],
    "tanglish": [
      "vilakki sollu"
    ],
    "hi": [
      "समझाओ"
    ]
  },
  "correction_plan": {
    "canonical": "generate plan",
    "ta": [
      "பிளான் போடு"
    ],
    "tanglish": [
      "plan podu"
    ],
    "hi": [
      "प्लान बनाओ"
    ]
  },
  "correction_explain": {
    "canonical": "explain",
    "ta": [
      "விளக்கி சொல்லு"
    ],
    "tanglish": [
      "vilakki sollu"
    ],
    "hi": [
      "समझाओ"
    ]
  },
  "full_analysis": {
    "canonical": "run full analysis",
    "ta": [
      "முழு பகுப்பாய்வு பண்ணு"
    ],
    "tanglish": [
      "full analysis pannu"
    ],
    "hi": [
      "पूरा विश्लेषण करो"
    ]
  },
  "agent_analyze": {
    "canonical": "run analysis",
    "ta": [
      "பகுப்பாய்வு பண்ணு"
    ],
    "tanglish": [
      "analysis pannu"
    ],
    "hi": [
      "विश्लेषण करो"
    ]
  },
  "agent_explain": {
    "canonical": "explain",
    "ta": [
      "விளக்கி சொல்லு"
    ],
    "tanglish": [
      "vilakki sollu"
    ],
    "hi": [
      "समझाओ"
    ]
  },
  "mechanical_predict": {
    "canonical": "predict",
    "ta": [
      "கணிச்சு சொல்லு"
    ],
    "tanglish": [
      "predict pannu"
    ],
    "hi": [
      "अनुमान करो"
    ]
  },
  "supplier_plan": {
    "canonical": "plan",
    "ta": [
      "ஆர்டர் பிளான்"
    ],
    "tanglish": [
      "order plan pannu"
    ],
    "hi": [
      "ऑर्डर प्लान"
    ]
  },
  "gun_connect": {
    "canonical": "connect gun",
    "ta": [
      "கன் கனெக்ட் பண்ணு"
    ],
    "tanglish": [
      "gun connect pannu"
    ],
    "hi": [
      "गन कनेक्ट करो"
    ]
  },
  "gun_disconnect": {
    "canonical": "disconnect gun",
    "ta": [
      "கன் டிஸ்கனெக்ட் பண்ணு"
    ],
    "tanglish": [
      "gun disconnect pannu"
    ],
    "hi": [
      "गन डिस्कनेक्ट करो"
    ]
  },
  "energy_meter": {
    "canonical": "read meter",
    "ta": [
      "மீட்டர் ரீடிங் எடு"
    ],
    "tanglish": [
      "meter reading edu"
    ],
    "hi": [
      "मीटर पढ़ो"
    ]
  },
  "semantic_search": {
    "canonical": "search",
    "ta": [
      "தேடு"
    ],
    "tanglish": [
      "thedu"
    ],
    "hi": [
      "खोजो"
    ]
  },
  "start_melting": {
    "canonical": "start melting",
    "ta": [
      "மெல்ட்டிங் ஸ்டார்ட் பண்ணு"
    ],
    "tanglish": [
      "melting start pannu"
    ],
    "hi": [
      "मेल्टिंग शुरू करो"
    ]
  },
  "approve_pr": {
    "canonical": "approve pr",
    "ta": [
      "PR அப்ரூவ் பண்ணு"
    ],
    "tanglish": [
      "PR approve pannu"
    ],
    "hi": [
      "PR अप्रूव करो"
    ]
  },
  "reject_pr": {
    "canonical": "reject pr",
    "ta": [
      "PR ரிஜெக்ட் பண்ணு"
    ],
    "tanglish": [
      "PR reject pannu"
    ],
    "hi": [
      "PR रिजेक्ट करो"
    ]
  },
  "approve_dri_qa": {
    "canonical": "approve dri qa",
    "ta": [
      "DRI QA அப்ரூவ் பண்ணு"
    ],
    "tanglish": [
      "DRI QA approve pannu"
    ],
    "hi": [
      "DRI QA अप्रूव करो"
    ]
  },
  "reject_dri_qa": {
    "canonical": "reject dri qa",
    "ta": [
      "DRI QA ரிஜெக்ட் பண்ணு"
    ],
    "tanglish": [
      "DRI QA reject pannu"
    ],
    "hi": [
      "DRI QA रिजेक्ट करो"
    ]
  },
  "inspect_lot": {
    "canonical": "inspect lot",
    "ta": [
      "லாட் இன்ஸ்பெக்ட் பண்ணு"
    ],
    "tanglish": [
      "lot inspect pannu"
    ],
    "hi": [
      "लॉट निरीक्षण करो"
    ]
  }
};
export function nativeActionText(text,definitions){
 const normalized=String(text||'').normalize('NFKC').replace(/(?<!\d)\.|\.(?!\d)|[!?]/g,'').replace(/,(?!\d)/g,' ').replace(/\s+/g,' ').trim();
 for(const d of definitions){const entry=nativeActions[d.id];if(!entry)continue;
  for(const phrase of [...(entry.en||[]),...entry.ta,...entry.tanglish,...entry.hi]){
   if(normalized.toLowerCase()===phrase.toLowerCase())return entry.canonical;
   if(normalized.toLowerCase().startsWith(phrase.toLowerCase()+' '))return entry.canonical+' '+normalized.slice(phrase.length).trim();
   if(normalized.toLowerCase().endsWith(' '+phrase.toLowerCase()))return entry.canonical+' '+normalized.slice(0,-phrase.length).trim();
  }
 }
 return normalized;
}
export function nativeReadback(id,summary,lang='en'){
 if(lang==='en')return summary;const entry=nativeActions[id];if(!entry)return summary;
 if(id==='request_reading'&&!summary.includes(':'))return lang==='ta'?'இணைந்த OPC கருவியிலிருந்து ஒரு Spectrometer reading எடுக்கப்போறேன்.':'जुड़े OPC उपकरण से एक Spectrometer reading लेंगे।';
 const label=entry[lang]?.[0]||entry.canonical;const colon=summary.indexOf(':');
 // Action headings can contain the target (or search collection). Retain those
 // facts instead of discarding everything before the first colon.
 const heading=colon>=0?summary.slice(0,colon).replace(new RegExp('^'+entry.canonical,'i'),'').trim():'';
 let facts=id==='inspect_lot'?summary.replace(/^Inspect /,''):colon>=0?[heading,summary.slice(colon+1).trim()].filter(Boolean).join(': '):summary.replace(new RegExp(entry.canonical,'i'),'').trim();
 const terms=lang==='ta'?{'simulated meter reading':'சிமுலேட் செய்த மீட்டர் ரீடிங்','calculation only, no purchase order':'கணக்கு மட்டும்; ஆர்டர் அனுப்பாது','handheld gun simulator':'கையடக்க கன் சிமுலேட்டர்','This may change the lot status':'இதனால் லாட் நிலை மாறலாம்','surface prepared':'மேற்பரப்பு தயார்','pieces':'பீஸ்','version':'பதிப்பு','supplier':'சப்ளையர்','weight unavailable':'எடை கிடைக்கவில்லை','gate':'கேட்'}:{'simulated meter reading':'सिमुलेटेड मीटर रीडिंग','calculation only, no purchase order':'केवल गणना; खरीद ऑर्डर नहीं','handheld gun simulator':'हैंडहेल्ड गन सिमुलेटर','This may change the lot status':'इससे लॉट की स्थिति बदल सकती है','surface prepared':'सतह तैयार','pieces':'टुकड़े','version':'संस्करण','supplier':'सप्लायर','weight unavailable':'वजन उपलब्ध नहीं','gate':'गेट'};
 for(const [from,to] of Object.entries(terms))facts=facts.replaceAll(from,to);
 return label+': '+facts+(lang==='ta'?' — விவரங்களை சரிபாருங்க.':' — विवरण जाँच लें।');
}

Object.assign(nativeActions,{"accept_strategy": {"canonical": "accept", "ta": ["ஸ்ட்ராடஜி ஏற்றுக்கொள்"], "tanglish": ["strategy accept pannu"], "hi": ["रणनीति स्वीकार करो"]}, "approve_tap": {"canonical": "approve tap", "ta": ["டேப் அப்ரூவ் பண்ணு"], "tanglish": ["tap approve pannu"], "hi": ["टैप अप्रूव करो"]}});

Object.assign(nativeActions,{"receive_lot": {"canonical": "receive truck", "ta": ["லாட் வரவு பதிவு பண்ணு"], "tanglish": ["lot receive pannu"], "hi": ["लॉट प्राप्त करो"]}, "receive_alloy": {"canonical": "receive alloy batch", "ta": ["அலாய் பேட்ச் வரவு பதிவு பண்ணு"], "tanglish": ["alloy batch receive pannu"], "hi": ["अलॉय बैच प्राप्त करो"]}, "dri_entry": {"canonical": "dri lab entry", "ta": ["DRI லேப் பதிவு பண்ணு"], "tanglish": ["DRI lab entry pannu"], "hi": ["DRI लैब दर्ज करो"]}, "plan_heat": {"canonical": "plan heat", "ta": ["ஹீட் பிளான் பண்ணு"], "tanglish": ["heat plan pannu"], "hi": ["हीट प्लान करो"]}, "edit_charge": {"canonical": "edit charge", "ta": ["சார்ஜ் திருத்து"], "tanglish": ["charge edit pannu"], "hi": ["चार्ज बदलो"]}, "create_pr": {"canonical": "create pr", "ta": ["PR உருவாக்கு"], "tanglish": ["PR create pannu"], "hi": ["PR बनाओ"]}, "issue_invoice": {"canonical": "issue invoice", "ta": ["இன்வாய்ஸ் போடு"], "tanglish": ["invoice podu"], "hi": ["इनवॉइस बनाओ"]}, "create_grade": {"canonical": "create grade spec", "ta": ["கிரேட் ஸ்பெக் உருவாக்கு"], "tanglish": ["grade spec create pannu"], "hi": ["ग्रेड स्पेक बनाओ"]}, "edit_grade": {"canonical": "edit grade spec", "ta": ["கிரேட் ஸ்பெக் திருத்து"], "tanglish": ["grade spec edit pannu"], "hi": ["ग्रेड स्पेक बदलो"]}, "edit_prices": {"canonical": "edit prices", "ta": ["விலை திருத்து"], "tanglish": ["price edit pannu"], "hi": ["कीमत बदलो"]}, "create_training": {"canonical": "create training sample", "ta": ["ட்ரெயினிங் சாம்பிள் உருவாக்கு"], "tanglish": ["training sample create pannu"], "hi": ["ट्रेनिंग सैंपल बनाओ"]}, "edit_training": {"canonical": "edit training sample", "ta": ["ட்ரெயினிங் சாம்பிள் திருத்து"], "tanglish": ["training sample edit pannu"], "hi": ["ट्रेनिंग सैंपल बदलो"]}, "apply_ahp": {"canonical": "apply ahp weights", "ta": ["AHP வெயிட் பயன்படுத்து"], "tanglish": ["AHP weights apply pannu"], "hi": ["AHP वेट लागू करो"]}, "apply_weights": {"canonical": "apply criteria weights", "ta": ["கிரைடீரியா வெயிட் பயன்படுத்து"], "tanglish": ["criteria weights apply pannu"], "hi": ["मानदंड वेट लागू करो"]}, "release_lot": {"canonical": "manual lot release", "ta": ["லாட் ரிலீஸ் பண்ணு"], "tanglish": ["lot release pannu"], "hi": ["लॉट रिलीज करो"]}, "reject_lot": {"canonical": "manual lot reject", "ta": ["லாட் ரிஜெக்ட் பண்ணு"], "tanglish": ["lot reject pannu"], "hi": ["लॉट रिजेक्ट करो"]}, "replace_argon": {"canonical": "replace argon", "ta": ["ஆர்கான் மாற்று"], "tanglish": ["argon replace pannu"], "hi": ["आर्गन बदलो"]}, "override_start": {"canonical": "hold override start", "ta": ["ஹோல்ட் ஓவர்ரைடு செய்து ஸ்டார்ட் பண்ணு"], "tanglish": ["hold override start pannu"], "hi": ["होल्ड ओवरराइड करके शुरू करो"]}, "delete_reading": {"canonical": "delete reading", "ta": ["ரீடிங் நீக்கு"], "tanglish": ["reading delete pannu"], "hi": ["रीडिंग हटाओ"]}, "delete_grade": {"canonical": "delete grade spec", "ta": ["கிரேட் ஸ்பெக் நீக்கு"], "tanglish": ["grade spec delete pannu"], "hi": ["ग्रेड स्पेक हटाओ"]}, "delete_training": {"canonical": "delete training sample", "ta": ["ட்ரெயினிங் சாம்பிள் நீக்கு"], "tanglish": ["training sample delete pannu"], "hi": ["ट्रेनिंग सैंपल हटाओ"]}, "reset_demo": {"canonical": "reset demo", "ta": ["டெமோ ரீசெட் பண்ணு"], "tanglish": ["demo reset pannu"], "hi": ["डेमो रीसेट करो"]}, "clear_chat": {"canonical": "clear chat history", "ta": ["சாட் வரலாறு நீக்கு"], "tanglish": ["chat clear pannu"], "hi": ["चैट इतिहास साफ करो"]}});

export const runConfirmationPrompt={en:'Say yes or no.',ta:'ஆமா இல்லன்னா இல்லை சொல்லுங்க.',hi:'हाँ या नहीं बोलिए।'};
export const approvalPrompt={en:'Say your passcode.',ta:'உங்கள் அனுமதி குறியீட்டை சொல்லுங்க.',hi:'अपना पासकोड बोलिए।'};
Object.assign(nativeActions,{
 opc_connect:{canonical:'connect spectrometer',en:['connect OPC'],ta:['ஸ்பெக்ட்ரோமீட்டர் இணை','OPC இணை'],tanglish:['spectrometer connect pannu'],hi:['स्पेक्ट्रोमीटर कनेक्ट करो','OPC कनेक्ट करो']},
 opc_disconnect:{canonical:'disconnect spectrometer',en:['disconnect','disconnect OPC'],ta:['ஸ்பெக்ட்ரோமீட்டர் இணைப்பை துண்டி','OPC துண்டி'],tanglish:['spectrometer disconnect pannu'],hi:['स्पेक्ट्रोमीटर डिस्कनेक्ट करो','OPC डिस्कनेक्ट करो']},
});
