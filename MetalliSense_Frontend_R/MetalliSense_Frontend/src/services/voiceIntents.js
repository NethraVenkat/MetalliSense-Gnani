const elements = { C: ['carbon', 'c', 'கார்பன்'], Si: ['silicon', 'si', 'சிலிக்கான்'], Mn: ['manganese', 'mn', 'மாங்கனீசு'], P: ['phosphorus', 'p'], S: ['sulphur', 'sulfur', 's'] };
const has = (text, word) => text.split(/[^\p{L}\p{M}\p{N}]+/u).includes(word);
export function mapIntent(transcript) {
  const text = String(transcript ?? '').normalize('NFKC').toLowerCase().trim();
  const params = {};
  if (/approve|confirm|release|deduct|start\s+melt|invoice|delete|அனுமதி|ஒப்புதல்/u.test(text)) return { intent: 'blocked', params, reply: { ta: 'திரையில் approve செய்யவும்', en: 'Please approve on screen' } };
  const heat = text.match(/(?:\bheat\s*|\bh[\s-]*)(\d+)\b/i) || text.match(/^\s*(\d+)\b/);
  if (heat) params.heatNumber = heat[1];
  if (/stock|இருப்பு/u.test(text) && !/open|kaattu|காட்டு|திற/u.test(text)) {
    if (/fesi|ferro\s*silicon/i.test(text)) params.alloy = 'FeSi';
    else if (/femn|ferro\s*manganese/i.test(text)) params.alloy = 'FeMn';
    else if (/recarburiser|recarburizer/i.test(text)) params.alloy = 'Recarburiser';
    return { intent: 'stock_check', params };
  }
  if (/hold|தடை/u.test(text) && /why|yen|ஏன்|reason|காரண/u.test(text)) return { intent: 'gate_reason', params };
  for (const [element, aliases] of Object.entries(elements)) if (aliases.some(alias => has(text, alias))) return { intent: 'element_value', params: { ...params, element } };
  for (const [pattern, route] of [[/dashboard|டாஷ்போர்டு/u, '/dashboard'], [/pre[\s-]*melt|premelt/u, '/premelt-gate'], [/spectrometer|ஸ்பெக்ட்ரோமீட்டர்/u, '/spectrometer'], [/stock|இருப்பு/u, '/raw-material-stock']]) {
    if (pattern.test(text)) return { intent: 'open_screen', params: { ...params, route } };
  }
  if (heat || /heat\s*status|வெப்ப.*நிலை/u.test(text)) return { intent: 'heat_status', params };
  return { intent: 'ask_copilot', params };
}
