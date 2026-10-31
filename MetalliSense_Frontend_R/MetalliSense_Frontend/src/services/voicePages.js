// F13a: route/label metadata only. No factory data, network or mutations.
export const voiceEverywhereEnabled = () => import.meta.env?.VITE_VOICE_EVERYWHERE === 'true';
const page = (path, en, ta, hi, aliases) => ({ route: '/' + path, pageName: { en, ta, hi }, aliases });
export const voicePages = [
  page('dashboard','dashboard','டாஷ்போர்டு','डैशबोर्ड',['dashboard','டாஷ்போர்டு','डैशबोर्ड']),
  page('premelt-gate','pre-melt','ப்ரீமெல்ட்','प्रीमेल्ट',['pre melt','premelt','pre melt gate','ப்ரீமெல்ட்','प्रीमेल्ट']),
  page('raw-material-stock','stock','ஸ்டாக்','स्टॉक',['stock','raw material stock','ஸ்டாக்','இருப்பு','स्टॉक']),
  page('yard-inspection','yard inspection','யார்டு இன்ஸ்பெக்ஷன்','यार्ड इंस्पेक्शन',['yard inspection','yard','யார்டு இன்ஸ்பெக்ஷன்','यार्ड इंस्पेक्शन']),
  page('spectrometer','spectrometer','ஸ்பெக்ட்ரோமீட்டர்','स्पेक्ट्रोमीटर',['spectrometer','ஸ்பெக்ட்ரோமீட்டர்','स्पेक्ट्रोमीटर']),
  page('grades','grades','கிரேட்ஸ்','ग्रेड्स',['grades','grade specs','கிரேட்ஸ்','ग्रेड्स']),
  page('supplier-scorecard','supplier scorecard','சப்ளையர் ஸ்கோர்கார்டு','सप्लायर स्कोरकार्ड',['supplier scorecard','suppliers','சப்ளையர் ஸ்கோர்கார்டு','सप्लायर स्कोरकार्ड']),
  page('energy','energy','எனர்ஜி','एनर्जी',['energy','எனர்ஜி','एनर्जी']),
  page('inventory-forecast','inventory forecast','இன்வென்டரி ஃபோர்காஸ்ட்','इन्वेंटरी फोरकास्ट',['inventory forecast','inventory','இன்வென்டரி ஃபோர்காஸ்ட்','इन्वेंटरी फोरकास्ट']),
  page('sales','sales','சேல்ஸ்','सेल्स',['sales','dispatch','சேல்ஸ்','सेल्स']),
  page('cost-analysis','cost analysis','காஸ்ட் அனாலிசிஸ்','कॉस्ट एनालिसिस',['cost analysis','cost','காஸ்ட் அனாலிசிஸ்','कॉस्ट एनालिसिस']),
  page('anomaly','anomaly','அனாமலி','अनॉमली',['anomaly','deviation analysis','அனாமலி','अनॉमली']),
  page('recommendation','recommendation','ரெக்கமெண்டேஷன்','रेकमेंडेशन',['recommendation','correction planner','ரெக்கமெண்டேஷன்','रेकमेंडेशन']),
  page('rl-optimizer','RL optimizer','ஆர்எல் ஆப்டிமைசர்','आरएल ऑप्टिमाइज़र',['rl optimizer','adaptive strategy','ஆர்எல் ஆப்டிமைசர்','आरएल ऑप्टिमाइज़र']),
  page('full-analysis','full analysis','ஃபுல் அனாலிசிஸ்','फुल एनालिसिस',['full analysis','ஃபுல் அனாலிசிஸ்','फुल एनालिसिस']),
  page('mechanical-properties','mechanical properties','மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ்','मैकेनिकल प्रॉपर्टीज',['mechanical properties','mechanical','மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ்','मैकेनिकल प्रॉपर्टीज']),
  page('agent','AI agent','ஏஐ ஏஜென்ட்','एआई एजेंट',['ai agent','agent','ஏஐ ஏஜென்ட்','एआई एजेंट']),
  page('synthetic','synthetic data','சிந்தெடிக் டேட்டா','सिंथेटिक डेटा',['synthetic data','synthetic','சிந்தெடிக் டேட்டா','सिंथेटिक डेटा']),
  page('training-data','training data','ட்ரெயினிங் டேட்டா','ट्रेनिंग डेटा',['training data','ட்ரெயினிங் டேட்டா','ट्रेनिंग डेटा']),
  page('semantic-search','semantic search','செமான்டிக் சர்ச்','सिमैंटिक सर्च',['semantic search','செமான்டிக் சர்ச்','सिमैंटिक सर्च']),
  page('charge-optimizer','charge optimizer','சார்ஜ் ஆப்டிமைசர்','चार्ज ऑप्टिमाइज़र',['charge optimizer','சார்ஜ் ஆப்டிமைசர்','चार्ज ऑप्टिमाइज़र']),
];
export const voicePage = route => voicePages.find(page => page.route === route);
const words = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export function pageVoiceIntent(transcript, { mock = import.meta.env?.VITE_MOCK_MODE === 'true' } = {}) {
  const text = words(transcript);
  if (['இங்க என்ன கேக்கலாம்','இங்கே என்ன கேட்கலாம்','yahan kya pooch sakte hain','यहाँ क्या पूछ सकते हैं','यहां क्या पूछ सकते हैं','what can i ask here'].includes(text)) return { intent:'page_help', params:{} };
  // Navigation requires a navigation verb/page marker and never consumes IDs.
  if (/\p{N}/u.test(text) || !/(?:^|\s)(?:open|show|go|page|kaattu|po|ponga|dikhao|kholo|खोलो|दिखाओ|காட்டு|போ|போங்க|திற|பேஜ்|पेज)(?:\s|$)/u.test(text)) return null;
  const padded = ` ${text} `;
  const matches = voicePages.filter(page => page.aliases.some(alias => padded.includes(` ${words(alias)} `)));
  // A multiword alias wins over a contained short alias (e.g. raw material stock).
  matches.sort((a,b) => Math.max(...b.aliases.filter(x=>padded.includes(` ${words(x)} `)).map(x=>words(x).length)) - Math.max(...a.aliases.filter(x=>padded.includes(` ${words(x)} `)).map(x=>words(x).length)));
  const target = matches[0];
  if (!target || target.route === '/charge-optimizer' && !mock) return null;
  return { intent:'open_screen', params:{route:target.route, pageAware:true} };
}
export function navigationAnswer(route, lang='en') {
  const name=voicePage(route)?.pageName[lang] || voicePage(route)?.pageName.en || 'page';
  // Short spoken shop-floor register; no IDs or factory facts.
  return lang==='ta'?`${name} பேஜ் ஓப்பன் செய்யப்பட்டது`:lang==='hi'?`${name} पेज खोला गया`:`${name[0].toUpperCase()+name.slice(1)} page opened`;
}
export const pagePurposes = {
  '/dashboard':['இந்த பேஜ்ல பிளான்ட் ஸ்டேட்டஸ், கனெக்ஷன் பாக்கலாம்.','यहाँ प्लांट का स्टेटस और कनेक्शन दिखता है।','This page shows the plant overview and connection status.'],
  '/premelt-gate':['இந்த பேஜ்ல ஹீட் கேட் செக், ஹோல்ட் காரணம் பாக்கலாம்.','यहाँ हीट का गेट चेक दिखता है। होल्ड की वजह भी दिखती है।','This page shows the heat charge and pre-melt gate result.'],
  '/raw-material-stock':['இந்த பேஜ்ல ராமெட்டீரியல் லாட், ஸ்டாக் பாக்கலாம்.','यहाँ रॉ मटेरियल लॉट और स्टॉक दिखते हैं।','This page shows raw-material lots and stock.'],
  '/yard-inspection':['இந்த பேஜ்ல யார்டு செக் ரீடிங், ரிசல்ட் பாக்கலாம்.','यहाँ यार्ड चेक रीडिंग और रिज़ल्ट दिखते हैं।','This page shows yard inspection readings and results.'],
  '/spectrometer':['இந்த பேஜ்ல ஸ்பெக்ட்ரோமீட்டர் ரீடிங், கனெக்ஷன் பாக்கலாம்.','यहाँ स्पेक्ट्रोमीटर की रीडिंग और कनेक्शन दिखते हैं।','This page shows spectrometer readings and connection status.'],
  '/grades':['இந்த பேஜ்ல கிரேடு ஸ்பெக், எலிமென்ட் லிமிட் பாக்கலாம்.','यहाँ ग्रेड स्पेक और एलिमेंट लिमिट दिखते हैं।','This page shows grade specifications and element limits.'],
  '/supplier-scorecard':['இந்த பேஜ்ல சப்ளையர் ஸ்கோர், ரேங்க் பாக்கலாம்.','यहाँ सप्लायर का स्कोर और रैंक दिखता है।','This page shows supplier scores and rankings.'],
  '/energy':['இந்த பேஜ்ல ஹீட் எனர்ஜி, மீட்டர் ரீடிங் பாக்கலாம்.','यहाँ हीट एनर्जी का एस्टिमेट दिखता है। मीटर रीडिंग भी देख सकते हैं।','This page shows predicted heat energy and meter records.'],
  '/inventory-forecast':['இந்த பேஜ்ல ஸ்டாக் ஃபோர்காஸ்ட், பர்ச்சேஸ் ரிக்வெஸ்ட் பாக்கலாம்.','यहाँ स्टॉक फोरकास्ट और परचेज़ रिक्वेस्ट दिखती हैं।','This page shows stock forecasts and purchase requests.'],
  '/sales':['இந்த பேஜ்ல ஃபினிஷ்டு ஹீட், சர்டிஃபிகேட், சேல்ஸ் பில் பாக்கலாம்.','यहाँ फिनिश्ड हीट, सर्टिफिकेट, सेल्स बिल दिखते हैं।','This page shows finished heats, certificates and sales bills.'],
  '/cost-analysis':['இந்த பேஜ்ல மெட்டீரியல் ரேட், காஸ்ட் ரெக்கார்டு பாக்கலாம்.','यहाँ मटेरियल रेट और कॉस्ट रिकॉर्ड दिखते हैं।','This page shows configured material prices and cost records.'],
  '/anomaly':['இந்த பேஜ்ல காம்பொசிஷன் டிவியேஷன் ரிசல்ட் பாக்கலாம்.','यहाँ कंपोज़िशन डेविएशन का रिज़ल्ट दिखता है।','This page shows the composition deviation analysis result.'],
  '/recommendation':['இந்த பேஜ்ல காம்பொசிஷன் கரெக்ஷன் சஜெஷன் பாக்கலாம்.','यहाँ कंपोज़िशन करेक्शन के सजेशन दिखते हैं।','This page shows suggested composition corrections.'],
  '/rl-optimizer':['இந்த பேஜ்ல ஸ்ட்ராடஜி கம்பேரிசன், மாடல் ஸ்கோர் பாக்கலாம்.','यहाँ स्ट्रैटेजी कंपैरिजन और मॉडल स्कोर दिखते हैं।','This page compares strategies and model scores.'],
  '/full-analysis':['இந்த பேஜ்ல காம்பொசிஷன் அனாலிசிஸ், காஸ்ட் எஸ்டிமேட் பாக்கலாம்.','यहाँ कंपोज़िशन अनालिसिस और कॉस्ट एस्टिमेट दिखते हैं।','This page combines composition analysis and cost estimates.'],
  '/mechanical-properties':['இந்த பேஜ்ல ஸ்ட்ரெங்த், ஹார்ட்னஸ் எஸ்டிமேட் பாக்கலாம்.','यहाँ स्ट्रेंथ और हार्डनेस के एस्टिमेट दिखते हैं।','This page shows predicted strength and hardness.'],
  '/agent':['இந்த பேஜ்ல ஏஐ அனாலிசிஸ், சஜெஷன் பாக்கலாம்.','यहाँ एआई अनालिसिस और सजेशन दिखते हैं।','This page shows AI analysis and recommendations.'],
  '/synthetic':['இந்த பேஜ்ல டெஸ்டுக்கான சிந்தெடிக் ரீடிங் பாக்கலாம்.','यहाँ टेस्ट के लिए सिंथेटिक रीडिंग दिखती है।','This page shows synthetic readings for testing.'],
  '/training-data':['இந்த பேஜ்ல ட்ரெயினிங் ரெக்கார்டு, டீடெயில் பாக்கலாம்.','यहाँ ट्रेनिंग रिकॉर्ड और डिटेल दिखती है।','This page shows training records and their details.'],
  '/semantic-search':['இந்த பேஜ்ல சர்ச் மேட்ச் ரெக்கார்டு பாக்கலாம்.','यहाँ सर्च से मैच करते रिकॉर्ड दिखते हैं।','This page shows records matching a search.'],
  '/charge-optimizer':['இந்த பேஜ்ல சார்ஜ் மிக்ஸ், காஸ்ட் கம்பேரிசன் பாக்கலாம்.','यहाँ चार्ज मिक्स और कॉस्ट कंपैरिजन दिखता है।','This page compares charge mixes and their costs.'],
};
export function pageHelp(context,lang='en') {
  const route=context?.route;
  const index=lang==='ta'?0:lang==='hi'?1:2;
  const purpose=(pagePurposes[route]||['இது தகவல் பேஜ்.','यह जानकारी का पेज है।','This is an information page.'])[index];
  // Purpose and capabilities only; no example questions or unbuilt adapters.
  const capabilities=route==='/premelt-gate'
    ?['வாய்ஸ்ல ஹீட் நிலை, காரணம் கேக்கலாம்.','वॉइस से हीट स्टेटस, वजह पूछ सकते हैं।','Voice can read heat status, blocking reasons and element values.']
    :route==='/raw-material-stock'
      ?['வாய்ஸ்ல அலாய் ஸ்டாக் கேக்கலாம்.','वॉइस से अलॉय स्टॉक पूछ सकते हैं।','Voice can read alloy additive stock.']
      :['இப்போ இங்க நேவிகேஷன் மட்டும்.','अभी यहाँ सिर्फ नेविगेशन।','Only navigation on this page for now'];
  return `${purpose} ${capabilities[index]}`;
}

// Each turn captures a route scope. The shared panel survives navigation, but
// work started on the previous page must not display, speak or navigate later.
export function scopeVoiceCallbacks(callbacks, isCurrent) {
  return Object.fromEntries(Object.entries(callbacks).map(([key, fn]) => [key,(...args)=>isCurrent()?fn(...args):undefined]));
}
