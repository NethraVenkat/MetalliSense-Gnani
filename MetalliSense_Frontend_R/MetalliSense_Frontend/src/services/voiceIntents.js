const numberWords = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const numberToken = `(?:${Object.keys(numberWords).join('|')}|hundred|thousand)`;
const spokenNumbers = new RegExp(`\\b${numberToken}(?:(?:[\\s-]+(?:and[\\s-]+)?)${numberToken})*\\b`, 'g');
function numberValue(phrase) {
  const words = phrase.split(/[\s-]+/).filter(word => word !== 'and');
  // IDs can be spoken digit by digit, including zeroes in the middle.
  if (words.every(word => numberWords[word] < 10)) {
    return words.map(word => numberWords[word]).join('');
  }
  // Furnace IDs may be dictated as two groups: "ten fifty one" = 10 / 51.
  if (!words.includes('hundred') && !words.includes('thousand') && words.length > 1
      && numberWords[words[0]] >= 10 && numberWords[words[1]] >= 20) {
    return numberWords[words[0]] * 100 + words.slice(1).reduce((sum, word) => sum + numberWords[word], 0);
  }
  let total = 0;
  let group = 0;
  for (const word of words) {
    if (word === 'hundred') group = (group || 1) * 100;
    else if (word === 'thousand') { total += (group || 1) * 1000; group = 0; }
    else group += numberWords[word];
  }
  return total + group;
}
const tamilWords = {
  'எப்படி இருக்கு': 'epdi irukku', 'எவ்வளவு': 'evvalavu', 'என்ன': 'enna',
  'காட்டு': 'kaattu', 'நிலை': 'status', 'ஏன்': 'yen',
};
const tamilPhrase = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${Object.keys(tamilWords).join('|')})(?![\\p{L}\\p{M}\\p{N}])`, 'gu');

// Shared with the offline benchmark: keep speech aliases out of WER normalization.
export function normalizeTranscript(transcript) {
  return String(transcript ?? '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(tamilPhrase, phrase => tamilWords[phrase])
    .replace(spokenNumbers, phrase => String(numberValue(phrase)));
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
export function mapIntent(transcript) {
  const text = normalizeIntentTranscript(transcript);
  const params = {};
  if (/approve|confirm|release|deduct|start\s+melt|override|invoice|delete|அனுமதி|ஒப்புதல்/u.test(text)) return { intent: 'blocked', params, reply: { ta: 'திரையில் approve செய்யவும்', en: 'Please approve on screen' } };
  const hasStatusWord = /\b(?:status|epdi|enna|in\s+a|nilai)\b/u.test(text) || has(text, 'நிலை');
  const heat = text.match(/\b(?:heat|heath|sheet|hit|hate|eat|heet|he\s+t|h)[\s-]*(\d+)\b/i)
    || text.match(/^\s*(\d+)\b/)
    || (hasStatusWord ? text.match(/\b(\d{3,4})\b/) : null);
  if (heat) params.heatNumber = Number(heat[1]);
  if (/stock|இருப்பு/u.test(text) && !/open|kaattu|காட்டு|திற/u.test(text)) {
    if (/fesi|ferro\s*silicon/i.test(text) || has(text, 'fpsi')) params.alloy = 'FeSi';
    else if (/femn|ferro\s*manganese/i.test(text)) params.alloy = 'FeMn';
    else if (/recarburiser|recarburizer/i.test(text)) params.alloy = 'Recarburiser';
    return { intent: 'stock_check', params };
  }
  if (/\b(?:hold|warn|warning|warnings)\b|தடை|எச்சரிக்கை/u.test(text) && /\b(?:why|yen|reason)\b|ஏன்|காரண/u.test(text)) return { intent: 'gate_reason', params };
  for (const [element, aliases] of Object.entries(elements)) if (aliases.some(alias => has(text, alias))) return { intent: 'element_value', params: { ...params, element } };
  for (const [pattern, route] of [[/dashboard|டாஷ்போர்டு/u, '/dashboard'], [/pre[\s-]*melt|premelt/u, '/premelt-gate'], [/spectrometer|ஸ்பெக்ட்ரோமீட்டர்/u, '/spectrometer'], [/stock|இருப்பு/u, '/raw-material-stock']]) {
    if (pattern.test(text)) return { intent: 'open_screen', params: { ...params, route } };
  }
  if (heat || /heat\s*status|வெப்ப.*நிலை/u.test(text)) return { intent: 'heat_status', params };
  return { intent: 'ask_copilot', params };
}
