import { normalizeSpokenNumbers } from './spokenNumbers.js';
import {pageVoiceIntent,voiceEverywhereEnabled} from './voicePages.js';
const tamilWords = {
  'எப்படி இருக்கு': 'epdi irukku', 'எவ்வளவு': 'evvalavu', 'என்ன': 'enna',
  'காட்டு': 'kaattu', 'நிலை': 'status', 'ஏன்': 'yen',
};
const tamilPhrase = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${Object.keys(tamilWords).join('|')})(?![\\p{L}\\p{M}\\p{N}])`, 'gu');

// Shared with the offline benchmark: keep speech aliases out of WER normalization.
export function normalizeTranscript(transcript) {
  return normalizeSpokenNumbers(String(transcript ?? '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(tamilPhrase, phrase => tamilWords[phrase])
  );
}
function normalizeIntentTranscript(transcript) {
  return normalizeTranscript(transcript)
    .replace(/\b(?:in a|inna|ena|yenna|anna)(?=\s*(?:[.!?,;:]|$))/g, 'enna')
    .replace(/\b(?:evalavu|evolve|evalu|how much)\b/g, 'evvalavu')
    .replace(/\b(?:kattu|cut too|show)\b/g, 'kaattu')
    .replace(/\b(?:en|why)\b/g, 'yen')
    // Cached 8 kHz transcript: "Y hold heat one zero five one."
    .replace(/\by(?=\s+hold\b)/g, 'yen');
}
// Mn spellings observed in cached Prisma en-IN transcripts of the benchmark phrases.
const elements = { C: ['carbon', 'c', 'கார்பன்'], Si: ['silicon', 'si', 'சிலிக்கான்'], Mn: ['manganese', 'mn', 'மாங்கனீசு', 'magnus', 'magnes', 'magnis'], P: ['phosphorus', 'p'], S: ['sulphur', 'sulfur', 's'] };
const has = (text, word) => text.split(/[^\p{L}\p{M}\p{N}]+/u).includes(word);
const hasBridgeAction = text => /\b(?:approv\w*|ap+ro+v\w*|apruv\w*|melting|milting|smelting|meltin|melton)\b|\b(?:start|shuru|suru|override|over\s+ride|release|deduct)\s*(?:karo|kro|kar|करो)?\b|(?:\bstock|स्टॉक)\s+(?:kam\b|kum\b|कम)|अप्रूव|एप्रूव|मंजूर|अनुमोदन|मेल्टिंग|मैल्टिंग|पिघला|शुरू|स्टार्ट|ओवरराइड|रिलीज|कन्फर्म/u.test(text);
export function mapIntent(transcript, { langBridge = false, shiftSummary = import.meta.env?.VITE_SHIFT_SUMMARY === 'true', everywhere = voiceEverywhereEnabled() } = {}) {
  let text = normalizeIntentTranscript(transcript);
  const params = {};
  if (langBridge) {
    // These action checks precede every read-only alias, slot and navigation rule.
    if (hasBridgeAction(text)) {
      return { intent: 'blocked', params, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen.", hi: 'यह वॉइस से नहीं हो सकता। स्क्रीन पर कीजिए।' } };
    }
    const aliases = { 'हीट': 'heat', 'होल्ड': 'hold', 'स्टेटस': 'status', 'क्यों': 'yen', 'क्यूं': 'yen', 'क्या': 'enna', 'कितना': 'evvalavu', 'कार्बन': 'carbon', 'सिलिकॉन': 'silicon', 'मैंगनीज़': 'manganese', 'फॉस्फोरस': 'phosphorus', 'सल्फर': 'sulphur', 'कॉपर': 'copper', 'क्रोमियम': 'chromium', 'निकल': 'nickel', 'मॉलिब्डेनम': 'molybdenum' };
    for (const [word, alias] of Object.entries(aliases)) text = text.replace(new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'gu'), alias);
    text = normalizeIntentTranscript(text).replace(/\b(?:kyun|kyu|kyon)\b/g, 'yen').replace(/\b(?:kya|batao)\b/g, 'enna').replace(/\bkitna\b/g, 'evvalavu');
    // Only in the observed why-HOLD context; do not rewrite standalone N/என்.
    text = text.replace(/\bn(?=\s+hold\b)/g, 'yen').replace(/என்(?=\s+hold\b)/gu, 'yen');
  }
  // Keep the read-only Pre-Melt screen name as a compound. Every action check
  // runs before slots, stock, navigation or copilot, including "stock melting".
  const actionText = text.replace(/\bpre\s+melt\b/g, 'premelt');
  if (/approve|approval|confirm|release|deduct|start\s+melt|\bmelt(?:ing)?\b|\bstart\s+pann[ua]\b|override|invoice|delete|உருக்க|அனுமதி|ஒப்புதல்/u.test(actionText)) return { intent: 'blocked', params, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen." } };
  if(everywhere) {
    const pageIntent=pageVoiceIntent(transcript);
    if(pageIntent && hasBridgeAction(normalizeIntentTranscript(transcript))) return { intent: 'blocked', params, reply: { ta: 'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.', en: "This can't be done by voice. Please use the screen.", hi: 'यह वॉइस से नहीं हो सकता। स्क्रीन पर कीजिए।' } };
    if(pageIntent && (pageIntent.intent==='page_help'||!/(?:^|\s)\d+(?=\s|$)/u.test(text)))return pageIntent;
  }
  if (shiftSummary) {
    // Match original script tokens: bridge aliases rewrite batao before this point.
    const summaryText = normalizeTranscript(transcript);
    const contains = words => words.some(word => has(summaryText, normalizeTranscript(word)));
    const shiftWord = contains(['shift','swift','sift','ஷிஃப்ட்','ஷிப்ட்','शिफ्ट','शिफ़्ट']);
    const summaryWord = contains(['summary','samari','summery','சுருக்கம்','சம்மரி','सारांश','समरी']);
    const askWord = contains(['sollu','சொல்','சொல்லு','சொல்லுங்க','batao','बताओ','बताइए','बता','tell','give']);
    const countQuestion = ['எத்தனை ஹோல்ட்','kitne hold hai','कितने होल्ड','how many heats on hold']
      .some(phrase => ` ${summaryText} `.includes(` ${normalizeTranscript(phrase)} `));
    // Retain the original Tamil shift-status alias as a bounded phrase.
    const shiftStatus = shiftWord && ` ${summaryText} `.includes(' நிலைமை enna ');
    // Normalization includes spoken/native-script numbers. Leave numbered
    // utterances to the existing heat/element/reason rules below.
    if (!/(?:^|\s)\d+(?=\s|$)/u.test(summaryText)
        && (summaryWord && (shiftWord || askWord) || countQuestion || shiftStatus)) {
      return { intent:'shift_summary', params };
    }
  }
  if (langBridge && /\bhold\b/.test(text) && /\b(?:kaun|kon|list)\b|कौन|कौनसे/u.test(text)) return { intent: 'ask_copilot', params: { bridgeAction: 'list_holds' } };
  if (langBridge && /\b(?:help|madad)\b|मदद/u.test(text)) return { intent: 'ask_copilot', params: { bridgeAction: 'help' } };
  const hasStatusWord = /\b(?:status|epdi|enna|in\s+a|nilai)\b/u.test(text) || has(text, 'நிலை');
  const heat = text.match(/\b(?:heat|heath|sheet|hit|hate|eat|heet|he\s+t|h)[\s-]*(\d+)\b/i)
    || text.match(/^\s*(\d+)\b/)
    || (hasStatusWord ? text.match(/\b(\d{3,4})\b/) : null);
  if (heat) params.heatNumber = Number(heat[1]);
  else if (/\b(?:heat|heath|sheet|heet)\b/u.test(text)) params.unparsedHeat = true;
  if (/stock|இருப்பு/u.test(text) && !/open|kaattu|காட்டு|திற/u.test(text)) {
    if (/fesi|ferro\s*silicon/i.test(text) || has(text, 'fpsi')) params.alloy = 'FeSi';
    else if (/femn|ferro\s*manganese/i.test(text)) params.alloy = 'FeMn';
    else if (/recarburiser|recarburizer/i.test(text)) params.alloy = 'Recarburiser';
    return { intent: 'stock_check', params };
  }
  if (/\b(?:hold|warn|warning|warnings)\b|தடை|எச்சரிக்கை/u.test(text) && /\b(?:why|yen|reason)\b|ஏன்|காரண/u.test(text)) return { intent: 'gate_reason', params };
  const bridgeElements = langBridge ? { ...elements, Cu: ['copper'], Cr: ['chromium'], Ni: ['nickel'], Mo: ['molybdenum'] } : elements;
  for (const [element, aliases] of Object.entries(bridgeElements)) if (aliases.some(alias => has(text, alias))) return { intent: 'element_value', params: { ...params, element } };
  for (const [pattern, route] of [[/dashboard|டாஷ்போர்டு/u, '/dashboard'], [/pre[\s-]*melt|premelt/u, '/premelt-gate'], [/spectrometer|ஸ்பெக்ட்ரோமீட்டர்/u, '/spectrometer'], [/stock|இருப்பு/u, '/raw-material-stock']]) {
    if (pattern.test(text)) return { intent: 'open_screen', params: { ...params, route } };
  }
  if (heat || /heat\s*status|வெப்ப.*நிலை/u.test(text)) return { intent: 'heat_status', params };
  return { intent: 'ask_copilot', params };
}
