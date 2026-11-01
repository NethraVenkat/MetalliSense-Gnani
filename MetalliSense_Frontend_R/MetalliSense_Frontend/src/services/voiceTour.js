import {voicePage,voiceEverywhereEnabled} from './voicePages.js';
import {colloquialInput} from './voiceRegister.js';
import {approvedTourAssetsEnabled,approvedTamilClip,approvedTourAsset} from './approvedTourAudio.js';

export const voiceTourEnabled=()=>voiceEverywhereEnabled()&&import.meta.env?.VITE_VOICE_TOUR==='true';
const tourDisplayNames={
 '/dashboard':'Dashboard','/spectrometer':'Spectrometer','/grades':'Grade Specs','/supplier-scorecard':'Supplier Scorecard',
 '/raw-material-stock':'Raw Material Stock','/yard-inspection':'Yard Inspection (XRF/LIBS)','/premelt-gate':'Pre-Melt Gate',
 '/anomaly':'Composition Deviation Analysis','/recommendation':'Melt Correction Planner','/rl-optimizer':'Adaptive Strategy Optimizer',
 '/full-analysis':'Full Analysis','/agent':'AI Agent Analysis','/energy':'Energy per Heat','/mechanical-properties':'Mechanical Properties',
 '/sales':'Sales & Dispatch','/inventory-forecast':'Inventory Forecast','/cost-analysis':'Cost Analysis',
 '/synthetic':'Synthetic Data','/training-data':'Training Data','/semantic-search':'Semantic Search',
};
// Team-reviewed F14 v4 FINAL narration. Preserve verbatim except foundry digit IDs.
const script=[
  {
    "number": 1,
    "label": "Dashboard",
    "ta": "வணக்கம், நான் குரல். இது டாஷ்போர்டு. பிளான்ட்ல என்ன நடக்குதுன்னு இங்கே பாக்கலாம்.",
    "hi": "नमस्ते, मैं कुरल हूँ। यह डैशबोर्ड है। प्लांट में क्या चल रहा है, यहाँ देख सकते हैं।",
    "en": "Hello, I'm Kural. This is the dashboard. You can see what's happening in the plant here."
  },
  {
    "number": 2,
    "label": "Spectrometer",
    "ta": "இது ஸ்பெக்ட்ரோ மீட்டர். மெட்டல்ல ஒவ்வொரு எலிமென்ட்டும் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம்.",
    "hi": "यह स्पेक्ट्रो मीटर है। धातु में हर एलिमेंट कितना है, यहाँ देख सकते हैं।",
    "en": "This is the spectrometer. You can see how much of each element is in the metal."
  },
  {
    "number": 3,
    "label": "Grade Specs",
    "ta": "இது கிரேடு ஸ்பெக்ஸ். ஒவ்வொரு இரும்பு கிரேடுக்கும் தேவையான எலிமென்ட் அளவு இங்கே இருக்கு.",
    "hi": "यह ग्रेड स्पेक्स है। हर आयरन ग्रेड के लिए ज़रूरी एलिमेंट की मात्रा यहाँ है।",
    "en": "This is grade specs. It shows the element limits for each iron grade."
  },
  {
    "number": 4,
    "label": "Supplier Scorecard",
    "ta": "இது சப்ளையர் ஸ்கோர் கார்டு. தரம், விலை, டெலிவரி வெச்சு சப்ளையர் ரேட்டிங் பாக்கலாம்.",
    "hi": "यह सप्लायर स्कोरकार्ड है। क्वालिटी, कीमत और डिलीवरी के हिसाब से सप्लायर की रेटिंग देख सकते हैं।",
    "en": "This is the supplier scorecard. It rates suppliers on quality, price and delivery."
  },
  {
    "number": 5,
    "label": "Raw Material Stock",
    "ta": "இது ரா மெட்டீரியல் ஸ்டாக். பிக் அயர்ன், ஸ்க்ராப், அலாய் எவ்வளவு இருக்குன்னு இங்கே பாக்கலாம்.",
    "hi": "यह रॉ मटेरियल स्टॉक है। पिग आयरन, स्क्रैप और अलॉय कितना है, यहाँ देख सकते हैं।",
    "en": "This is raw material stock. You can see how much pig iron, scrap and alloy we have."
  },
  {
    "number": 6,
    "label": "Yard Inspection",
    "ta": "இது யார்டு இன்ஸ்பெக்ஷன். வந்த ஸ்க்ராப் லாட்டோட செக் ரிசல்ட் இங்கே பாக்கலாம்.",
    "hi": "यह यार्ड इंस्पेक्शन है। आए हुए स्क्रैप लॉट की जाँच का रिज़ल्ट यहाँ देख सकते हैं।",
    "en": "This is yard inspection. You can see the check results for incoming scrap lots."
  },
  {
    "number": 7,
    "label": "Pre-Melt Gate",
    "ta": "இது ப்ரீ மெல்ட் கேட். மெல்ட் ஆரம்பிக்கும் முன் கோ, வார்ன், ஹோல்ட் முடிவு காட்டும். ஹோல்ட் வந்தா மெல்ட் ஆரம்பிக்க முடியாது, நான் உடனே அலர்ட் சொல்லுவேன்.",
    "hi": "यह प्री मेल्ट गेट है। मेल्ट से पहले गो, वार्न या होल्ड का रिज़ल्ट दिखाता है। होल्ड आने पर मेल्ट शुरू नहीं होगा, और मैं तुरंत अलर्ट दूँगी।",
    "en": "This is the pre-melt gate. It shows go, warn or hold before melting. On hold, melting can't start, and I'll alert you right away."
  },
  {
    "number": 8,
    "label": "Shift Handover",
    "ta": "இது ஷிஃப்ட் ஹேண்டோவர். போன ஷிஃப்ட்ல சொன்னது இங்கே வரும், கேட் நிலையோட சரிபாக்கும்.",
    "hi": "यह शिफ्ट हैंडओवर है। पिछली शिफ्ट की बातें यहाँ आती हैं और गेट स्टेटस से मिलाई जाती हैं।",
    "en": "This is the shift handover. It shows what the last shift said and checks it against the gate status."
  },
  {
    "number": 9,
    "label": "Composition Deviation",
    "ta": "இது காம்போசிஷன் டிவியேஷன். மெட்டல் அளவு லிமிட்ல இருந்து எவ்வளவு மாறியிருக்குன்னு காட்டும்.",
    "hi": "यह कंपोज़िशन डेविएशन है। धातु की रीडिंग तय लिमिट से कितनी अलग है, यह दिखाता है।",
    "en": "This is composition deviation. It shows how far the metal readings are from the limits."
  },
  {
    "number": 10,
    "label": "Melt Correction Planner",
    "ta": "இது மெல்ட் கரெக்ஷன் பிளானர். மெட்டல சரியான அளவுக்கு கொண்டு வர என்ன சேர்க்கணும்னு சொல்லும்.",
    "hi": "यह मेल्ट करेक्शन प्लानर है। धातु को सही स्तर पर लाने के लिए क्या मिलाना है, यह बताता है।",
    "en": "This is the melt correction planner. It suggests what to add to bring the metal into range."
  },
  {
    "number": 11,
    "label": "Adaptive Strategy Optimizer",
    "ta": "இது அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர். பல வழிகளை ஒப்பிட்டு, செலவுக்கும் தரத்துக்கும் சிறந்ததை தேர்ந்தெடுக்கும்.",
    "hi": "यह एडैप्टिव स्ट्रैटेजी ऑप्टिमाइज़र है। अलग-अलग तरीकों की तुलना करके कॉस्ट और क्वालिटी के लिए सबसे अच्छा चुनता है।",
    "en": "This is the adaptive strategy optimizer. It compares methods and picks the best for cost and quality."
  },
  {
    "number": 12,
    "label": "Full Analysis",
    "ta": "இது ஃபுல் அனாலிசிஸ். எல்லா தகவலும் ஒரே ரிப்போர்ட்ல பாக்கலாம்.",
    "hi": "यह फुल एनालिसिस है। सारी जानकारी एक ही रिपोर्ट में देख सकते हैं।",
    "en": "This is full analysis. You can see everything in one report."
  },
  {
    "number": 13,
    "label": "AI Agent Analysis",
    "ta": "இது ஏ ஐ ஏஜென்ட். முழு மெல்ட்டையும் பாத்து ஒரு சின்ன சுருக்கம் சொல்லும்.",
    "hi": "यह ए आई एजेंट है। पूरे मेल्ट को देखकर एक छोटा सारांश देता है।",
    "en": "This is the AI agent. It reviews the whole melt and gives a short summary."
  },
  {
    "number": 14,
    "label": "Energy per Heat",
    "ta": "இது எனர்ஜி. ஒவ்வொரு ஹீட்டுக்கும் எவ்வளவு கரண்ட் தேவை, எவ்வளவு ஆச்சுன்னு பாக்கலாம்.",
    "hi": "यह एनर्जी है। हर हीट में कितनी बिजली चाहिए और कितनी लगी, यहाँ देख सकते हैं।",
    "en": "This is energy. You can see how much power each heat needs and how much it used."
  },
  {
    "number": 15,
    "label": "Mechanical Properties",
    "ta": "இது மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ். டெஸ்ட்க்கு முன்னாடியே காஸ்டிங்கோட வலிமை, கடினம் கணிக்கும்.",
    "hi": "यह मैकेनिकल प्रॉपर्टीज़ है। टेस्ट से पहले कास्टिंग की मज़बूती और हार्डनेस का अनुमान देता है।",
    "en": "This is the mechanical properties page. It predicts casting strength and hardness before testing."
  },
  {
    "number": 16,
    "label": "Sales & Dispatch",
    "ta": "இது சேல்ஸ் அண்ட் டிஸ்பேட்ச். முடிஞ்ச ஹீட், டெஸ்ட் சர்டிஃபிகேட், கஸ்டமர் பில் இங்கே பாக்கலாம்.",
    "hi": "यह सेल्स और डिस्पैच है। तैयार हीट, टेस्ट सर्टिफिकेट और कस्टमर बिल यहाँ देख सकते हैं।",
    "en": "This is sales and dispatch. You can see finished heats, test certificates and customer bills."
  },
  {
    "number": 17,
    "label": "Inventory Forecast",
    "ta": "இது இன்வென்டரி ஃபோர்காஸ்ட். எந்த மெட்டீரியல் எப்போ தீரும்னு முன்னாடியே காட்டும். அப்ரூவல் அனுமதி உள்ளவங்க ஸ்கிரீன்ல செய்வாங்க.",
    "hi": "यह इन्वेंटरी फोरकास्ट है। कौन सा मटेरियल कब खत्म होगा, पहले से दिखाता है। अप्रूवल अधिकृत लोग स्क्रीन पर करते हैं।",
    "en": "This is the inventory forecast. It shows when each material may run out. Approvals are done on screen by authorised staff."
  },
  {
    "number": 18,
    "label": "Cost Analysis",
    "ta": "இது காஸ்ட் அனாலிசிஸ். மெட்டீரியல், எலிமென்ட் விலை எல்லாம் இங்கே இருக்கு.",
    "hi": "यह कॉस्ट एनालिसिस है। मटेरियल और एलिमेंट की कीमतें यहाँ हैं।",
    "en": "This is cost analysis. It shows the prices of materials and elements."
  },
  {
    "number": 19,
    "label": "Synthetic Data",
    "ta": "இது சிந்தெடிக் டேட்டா. டெஸ்ட்க்காக மாதிரி டேட்டா உருவாக்கும், இது உண்மையான ஃபேக்டரி டேட்டா இல்ல.",
    "hi": "यह सिंथेटिक डेटा है। टेस्टिंग के लिए सैंपल डेटा बनाता है, यह असली फैक्ट्री डेटा नहीं है।",
    "en": "This is synthetic data. It creates sample data for testing, not real factory data."
  },
  {
    "number": 20,
    "label": "Training Data",
    "ta": "இது ட்ரெயினிங் டேட்டா. ஏ ஐ மாடல் கத்துக்கிட்ட பழைய ரீடிங் எல்லாம் இங்கே இருக்கு.",
    "hi": "यह ट्रेनिंग डेटा है। ए आई मॉडल ने जिन पुरानी रीडिंग से सीखा, वो यहाँ हैं।",
    "en": "This is training data. These are the past readings our AI learned from."
  },
  {
    "number": 21,
    "label": "Semantic Search",
    "ta": "இது செமான்டிக் சர்ச். சாதாரணமா டைப் பண்ணினாலே பழைய ரெக்கார்டு கிடைக்கும்.",
    "hi": "यह सिमैंटिक सर्च है। आम भाषा में लिखिए, पुराने रिकॉर्ड मिल जाएँगे।",
    "en": "This is semantic search. Type in plain words to find past records."
  },
  {
    "number": 22,
    "label": "Finish",
    "ta": "டூர் முடிஞ்சது. தமிழ், ஹிந்தி, இங்கிலீஷ், எதுல வேணும்னாலும் பேசுங்க. நான் ரெடி.",
    "hi": "टूर पूरा हुआ। तमिल, हिंदी या इंग्लिश, किसी में भी बोलिए। मैं तैयार हूँ।",
    "en": "Tour complete. Speak in Tamil, Hindi or English. I'm ready to help."
  }
];
export const tourFinish=Object.fromEntries(['ta','hi','en'].map(lang=>[lang,script.at(-1)[lang]]));
export function voiceTourSteps(handover=import.meta.env?.VITE_HANDOVER==='true') {
  const order=['dashboard','spectrometer','grades','supplier-scorecard','raw-material-stock','yard-inspection','premelt-gate','handover','anomaly','recommendation','rl-optimizer','full-analysis','agent','energy','mechanical-properties','sales','inventory-forecast','cost-analysis','synthetic','training-data','semantic-search','finish'];
  return order.flatMap((id,n)=>{
    if(id==='handover'&&!handover)return [];
    const route=id==='finish'?null:id==='handover'?'/premelt-gate':'/'+id;
    const texts=Object.fromEntries(['ta','hi','en'].map(lang=>[lang,script[n][lang]]));
    return [{id,route,target:id==='grades'?'[data-tour-page="grades"]':id==='handover'?'[aria-label="Shift handover"]':'main',displayName:id==='handover'?'Shift handover':id==='finish'?'Finish':tourDisplayNames[route],
      pageName:route?voicePage(route).pageName:{ta:'டூர் முடிஞ்சது',hi:'टूर पूरा हुआ',en:'Tour complete'},texts,
      ...(id==='handover'?{target:'[aria-label="Shift handover"]'}:{})}];
  });
}
export const tourStepText=(step,lang)=>lang==='ta'&&approvedTourAssetsEnabled()?(approvedTamilClip(step.id)?.spokenText||step.texts[lang]):step.texts[lang];
// ID pronunciation only: no vocabulary, punctuation, decimal or sentence rewrites.
export const tourPronunciation=(text,lang)=>String(text).replace(/(?:(?:\bHeat|ஹீட்|हीट|\bLot|லாட்|लॉट)\s+)?\b[A-Z]{1,8}-\d{1,8}\b/g,match=>colloquialInput(match,lang));
// Speech-only literal forms. Keep the approved B choices; inflected Tamil forms
// are explicit entries, never a stem/substring rewrite. Cards always use texts.
export const tourSpokenOverrides={ta:{
  'டாஷ்போர்டு':'dashboard',
  'ஸ்பெக்ட்ரோ மீட்டர்':'spectrometer',
  'கிரேடு ஸ்பெக்ஸ்':'grade specs',
  'சப்ளையர் ஸ்கோர் கார்டு':'supplier scorecard',
  'ரா மெட்டீரியல் ஸ்டாக்':'raw material stock',
  'யார்டு இன்ஸ்பெக்ஷன்':'yard inspection',
  'ப்ரீ மெல்ட் கேட்':'pre-melt gate',
  'ஷிஃப்ட் ஹேண்டோவர்':'shift handover',
  'காம்போசிஷன் டிவியேஷன்':'composition deviation',
  'மெல்ட் கரெக்ஷன் பிளானர்':'melt correction planner',
  'அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர்':'adaptive strategy optimizer',
  'ஃபுல் அனாலிசிஸ்':'full analysis',
  'மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ்':'mechanical properties',
  'சேல்ஸ் அண்ட் டிஸ்பேட்ச்':'sales and dispatch',
  'இன்வென்டரி ஃபோர்காஸ்ட்':'inventory forecast',
  'காஸ்ட் அனாலிசிஸ்':'cost analysis',
  'சிந்தெடிக் டேட்டா':'synthetic data',
  'ட்ரெயினிங் டேட்டா':'training data',
  'செமான்டிக் சர்ச்':'semantic search',
  'எலிமென்ட்':'element',
  'எலிமென்ட்டும்':'elementஉம்',
  'பிக் அயர்ன்':'Pig iron',
  'ஸ்க்ராப்':'scrap',
  'அலாய்':'alloy',
  'ஸ்க்ராப் லாட்டோட':'scrap lotஓட',
  'செக் ரிசல்ட்':'check result',
  'கோ':'GO',
  'வார்ன்':'WARN',
  'ஹோல்ட்':'HOLD',
  'எனர்ஜி':'Energy',
  'ஹீட்':'heat',
  'ஹீட்டுக்கும்':'heatக்கும்',
  'கரண்ட்':'current',
  'டெஸ்ட்':'test',
  'டெஸ்ட்க்கு':'testக்கு',
  'டெஸ்ட்க்காக':'testக்காக',
  'காஸ்டிங்கோட':'castingஓட',
  'டூர்':'Tour',
  'ஹிந்தி':'Hindi',
  'இங்கிலீஷ்':'English',
},hi:{
  'डैशबोर्ड':'dashboard',
  'स्पेक्ट्रो मीटर':'spectrometer',
  'ग्रेड स्पेक्स':'grade specs',
  'सप्लायर स्कोरकार्ड':'supplier scorecard',
  'रॉ मटेरियल स्टॉक':'raw material stock',
  'यार्ड इंस्पेक्शन':'yard inspection',
  'प्री मेल्ट गेट':'pre-melt gate',
  'शिफ्ट हैंडओवर':'shift handover',
  'कंपोज़िशन डेविएशन':'composition deviation',
  'मेल्ट करेक्शन प्लानर':'melt correction planner',
  'एडैप्टिव स्ट्रैटेजी ऑप्टिमाइज़र':'adaptive strategy optimizer',
  'फुल एनालिसिस':'full analysis',
  'मैकेनिकल प्रॉपर्टीज़':'mechanical properties',
  'सेल्स और डिस्पैच':'sales और dispatch',
  'इन्वेंटरी फोरकास्ट':'inventory forecast',
  'कॉस्ट एनालिसिस':'cost analysis',
  'सिंथेटिक डेटा':'synthetic data',
  'ट्रेनिंग डेटा':'training data',
  'सिमैंटिक सर्च':'semantic search',
  'एलिमेंट':'element',
  'पिग आयरन':'Pig iron',
  'स्क्रैप लॉट':'scrap lot',
  'स्क्रैप':'scrap',
  'अलॉय':'alloy',
  'रिज़ल्ट':'result',
  'गो':'GO',
  'वार्न':'WARN',
  'होल्ड':'HOLD',
  'एनर्जी':'Energy',
  'हीट':'heat',
  'टेस्ट':'test',
  'टेस्टिंग':'testing',
  'कास्टिंग':'casting',
  'हार्डनेस':'hardness',
  'टूर':'Tour',
  'हिंदी':'Hindi',
  'इंग्लिश':'English',
},en:{go:'GO',warn:'WARN',hold:'HOLD'}};
export function tourSpokenText(step,lang,overrides=tourSpokenOverrides) {
  if(lang==='ta'&&approvedTourAssetsEnabled())return tourStepText(step,lang);
  let text=tourStepText(step,lang);
  {
    const words=Object.entries(overrides?.[lang]||{}).filter(([word,value])=>word&&typeof value==='string'&&value.length);
    if(words.length) {
      // Longest phrase first, literal boundaries, one pass: never chain rewrites.
      const escape=word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const pattern=words.map(([word])=>word).sort((a,b)=>b.length-a.length).map(escape).join('|');
      text=text.replace(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{M}\\p{N}_])`,'gu'),word=>overrides[lang][word]);
    }
  }
  return tourPronunciation(text,lang);
}
export const tourRunningReply={ta:"டூர் நடக்குது. 'டூர் நிறுத்து'னு சொல்லுங்க.",hi:"टूर चल रहा है। 'टूर बंद करो' बोलिए।",en:"Tour is running. Say 'stop tour'."};
export const tourStatusText={
  loading:{ta:'பேஜ் திறக்குது. கொஞ்சம் காத்திருங்க.',hi:'पेज खुल रहा है। ज़रा रुकिए।',en:'Opening the page. Please wait.'},
  audioUnavailable:{ta:'ஆடியோ கிடைக்கல. டூர் பொத்தான்களைப் பயன்படுத்துங்க.',hi:'ऑडियो उपलब्ध नहीं है। टूर के बटन इस्तेमाल करें।',en:'Audio is unavailable. Use the tour controls.'},
  targetUnavailable:{ta:'இந்த பேஜ் இப்போ திறக்கல. அடுத்தது அல்லது நிறுத்து அழுத்துங்க.',hi:'यह पेज नहीं खुला। आगे या बंद करें।',en:'This page did not open. Use Next or Close.'},
  targetMissing:{ta:'இந்த இடம் கிடைக்கல. அடுத்தது அல்லது நிறுத்து அழுத்துங்க.',hi:'यह जगह नहीं मिली। आगे या बंद करें।',en:'This spot was not found. Use Next or Close.'},
};
export const tourExplorationStatus={
  ta:'நீங்கள் பார்க்கும் போது தானாக அடுத்த படிக்கு செல்லாது.',
  hi:'आपके देखने तक टूर अपने आप आगे नहीं बढ़ेगा।',
  en:'Auto-advance paused while you explore.',
};
const commandText=text=>String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export function tourCommand(text,enabled=voiceTourEnabled()) {
  if(!enabled)return null;
  const value=commandText(text);
  for(const [action,aliases] of Object.entries({
    start:['டூர் ஆரம்பி','tour start karo','start tour','टूर शुरू करो'],
    next:['அடுத்தது','aage','next','आगे'],back:['முன்னாடி','peeche','back','पीछे'],
    repeat:['திரும்ப சொல்லு','dobara','repeat','दोबारा'],pause:['நிறுத்தி வை','ruko','pause','रुको'],resume:['தொடரு','chalo','resume','चलो'],stop:['டூர் நிறுத்து','tour band karo','stop tour','टूर बंद करो','stop'],
  }))if(aliases.includes(value))return action;
  return null;
}
const DONE='metallisense.voice.tour.done';
let session=0;
// Pure navigation/speech state machine. It has no factory services or setters.
export function createVoiceTour({navigate,speak,onChange=()=>{},isMuted=()=>false,storage=()=>globalThis.localStorage,location={route:'',scope:''},steps=voiceTourSteps(),enabled=voiceTourEnabled,setTimer=setTimeout,clearTimer=clearTimeout,navigationTimeoutMs=8000}={}) {
  const ownSession=++session;
  let done=false;try{done=storage()?.getItem(DONE)==='true';}catch{/* optional storage */}
  let state={active:false,paused:false,autoAdvancePaused:false,index:0,visited:[],steps:steps.map(({id,displayName,pageName})=>({id,displayName,pageName})),total:steps.length,lang:'ta',done,ready:false,targetMissing:false,notice:null,audioStatus:'ready'},version=0,abort=null,disposed=false,timer=null,routeTimer=null;
  let here=location,awaiting=null,timedOutNavigation=null,assetPlayback=null;
  const issued=new Set();
  const publish=()=>{if(!disposed)onChange({...state});};
  function cancel(keepRouteWait=false){version++;clearTimer(timer);timer=null;if(!keepRouteWait){clearTimer(routeTimer);routeTimer=null;}abort?.abort();abort=null;assetPlayback=null;}
  function scheduleAdvance(delay,ticket=version,scope=here.scope){
    clearTimer(timer);timer=setTimer(()=>{timer=null;if(!disposed&&state.active&&!state.paused&&!state.autoAdvancePaused&&ticket===version&&here.scope===scope)controller.control('next');},delay);
  }
  const mutedDelay=()=>Math.max(4000,Math.ceil(state.text.length/12)*1000);
  function markVisited(){if(!state.visited.includes(state.step.id))state={...state,visited:[...state.visited,state.step.id]};}
  function speakStep(){
    if(state.paused||!state.ready||state.targetMissing)return;
    const ticket=version,scope=here.scope;
    abort=new AbortController();
    const asset=approvedTourAsset(state.step.id,state.lang);
    const current=()=>!disposed&&state.active&&(asset!==undefined||!state.paused)&&ticket===version&&here.scope===scope;
    const advance=()=>{if(current()&&!state.autoAdvancePaused)scheduleAdvance(0,ticket,scope);};
    if(isMuted()){state={...state,audioStatus:'muted'};publish();if(!state.autoAdvancePaused)scheduleAdvance(mutedDelay(),ticket,scope);}
    else {
      let unavailable=false;
      state={...state,audioStatus:'loading'};publish();
      const fail=()=>{if(!current())return;unavailable=true;state={...state,audioStatus:'unavailable',notice:tourStatusText.audioUnavailable[state.lang]};publish();};
      const audioStarted=()=>{if(!current())return;state={...state,audioStatus:'playing'};publish();};
      void Promise.resolve(speak(state.spokenText,state.lang,'normal',{signal:abort.signal,isCurrent:current,pronunciationOnly:true,onAudioStart:audioStarted,onUnavailable:fail,
        ...(asset!==undefined?{approvedAsset:asset,isPaused:()=>state.paused,onPlaybackReady:handle=>{if(current()){assetPlayback=handle;if(state.paused)handle.pause();}else handle.cancel();}}:{})
      })).then(()=>{if(current()&&!unavailable){state={...state,audioStatus:'finished'};publish();if(!state.paused)advance();}},fail);
    }
  }
  function targetTimeout(kind='targetMissing'){
    if(!state.active||state.ready)return;
    clearTimer(routeTimer);routeTimer=null;timedOutNavigation=awaiting;awaiting=null;
    state={...state,ready:true,targetMissing:true,notice:tourStatusText[kind][state.lang]};publish();
  }
  function show(at){
    cancel();timedOutNavigation=null;
    const selected=steps[at];
    state={...state,active:true,autoAdvancePaused:false,index:at,step:selected,text:tourStepText(selected,state.lang),spokenText:tourSpokenText(selected,state.lang),ready:!selected.route,targetMissing:false,notice:selected.route?(state.lang==='en'?`Opening ${selected.displayName}...`:tourStatusText.loading[state.lang]):null,audioStatus:'ready'};
    if(selected.id==='finish'){
      state.done=true;try{storage()?.setItem(DONE,'true');}catch{/* optional storage */}
    }
    publish();
    if(selected.route&&(selected.route!==here.route||issued.size>0)){
      awaiting=`${ownSession}:${version}`;issued.add(awaiting);
      const token=awaiting;
      routeTimer=setTimer(()=>{if(state.active&&awaiting===token)targetTimeout('targetUnavailable');},navigationTimeoutMs);
      navigate(selected.route,{state:{kuralTour:awaiting}});
    }else if(selected.route){awaiting=null;publish();}
    else{awaiting=null;markVisited();publish();speakStep();}
  }
  const controller={
    attach(){disposed=false;},
    snapshot:()=>({...state}),
    control(action,lang){
      if(disposed||!enabled())return false;
      if(action==='start'){if(state.active)return true;state.lang=['ta','hi','en'].includes(lang)?lang:'ta';state.paused=false;state.visited=[];show(0);return true;}
      if(!state.active)return false;
      if(action==='voice-next')return state.index<steps.length-1?controller.control('next'):true;
      if(action==='voice-back')return state.index>0?controller.control('back'):true;
      if(action==='voice-pause'){controller.control('user-scroll');if(state.audioStatus==='finished'){state.paused=true;publish();return true;}return controller.control('pause');}
      if(action==='voice-continue'){
        if(state.paused&&state.audioStatus==='finished')state.paused=false;
        controller.control('resume');return controller.control('resume-autoplay');
      }
      if(action==='language'){
        if(!['ta','hi','en'].includes(lang)||state.lang===lang)return true;
        cancel(true);state={...state,lang,text:tourStepText(state.step,lang),spokenText:tourSpokenText(state.step,lang),notice:state.ready?null:tourStatusText.loading[lang]};publish();
        if(state.ready&&!state.targetMissing)speakStep();
        return true;
      }
      if(action==='user-scroll'){
        if(!state.autoAdvancePaused){clearTimer(timer);timer=null;state={...state,autoAdvancePaused:true};publish();}
        return true;
      }
      if(action==='resume-autoplay'){
        if(state.autoAdvancePaused){state={...state,autoAdvancePaused:false};publish();if(state.audioStatus==='finished')scheduleAdvance(0);else if(state.audioStatus==='muted')scheduleAdvance(mutedDelay());}
        return true;
      }
      if(action==='select-step'){
        if(!Number.isInteger(lang)||lang<0||lang>=steps.length)return false;
        state.paused=false;show(lang);return true;
      }
      if(action==='retry-target'){
        if(state.targetMissing&&!awaiting&&state.step.route===here.route){state={...state,ready:false,targetMissing:false,notice:tourStatusText.loading[state.lang],audioStatus:'ready'};publish();}
        return true;
      }
      if(action==='target-ready'){
        if(!awaiting&&!state.ready&&!state.targetMissing&&(!state.step.route||state.step.route===here.route)){
          clearTimer(routeTimer);routeTimer=null;awaiting=null;state={...state,ready:true,notice:null};markVisited();publish();speakStep();
        }
        return true;
      }
      if(action==='target-missing'){targetTimeout('targetMissing');return true;}
      if(action==='stop'){controller.stop();return true;}
      if(action==='pause'){if(approvedTourAsset(state.step.id,state.lang)!==undefined){clearTimer(timer);timer=null;assetPlayback?.pause();}else cancel(true);state={...state,paused:true,audioStatus:'paused'};publish();return true;}
      if(action==='resume'){if(state.paused){state.paused=false;publish();if(assetPlayback){if(state.audioStatus==='finished'){if(!state.autoAdvancePaused)scheduleAdvance(0);}else assetPlayback.resume();}else if(!awaiting&&(approvedTourAsset(state.step.id,state.lang)===undefined||!abort))speakStep();}return true;}
      if(action==='next'){if(state.index===steps.length-1)controller.stop();else show(state.index+1);return true;}
      if(action==='back'){show(Math.max(0,state.index-1));return true;}
      if(action==='repeat'){show(state.index);return true;}
      return false;
    },
    routeChanged(next){
      const previous=here;here=next;
      if(!state.active)return;
      const internal=issued.delete(next.tourToken);
      if(internal){
        if((next.tourToken===awaiting||next.tourToken===timedOutNavigation)&&next.route===state.step.route){
          const recover=next.tourToken===timedOutNavigation;
          clearTimer(routeTimer);routeTimer=null;awaiting=null;timedOutNavigation=null;
          if(recover)state={...state,ready:false,targetMissing:false,notice:tourStatusText.loading[state.lang],audioStatus:'ready'};
          publish();
        }
      }else if(next.scope!==previous.scope)controller.stop();
    },
    stop(){cancel();issued.clear();awaiting=null;timedOutNavigation=null;state={...state,active:false,paused:false,autoAdvancePaused:false};publish();},
    dispose(){cancel();issued.clear();disposed=true;},
  };
  return controller;
}
