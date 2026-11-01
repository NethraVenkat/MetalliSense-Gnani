import { buildShiftSummary } from './shiftSummary.js';

const unwrap = response => response?.data?.data?.data ?? response?.data?.data ?? response?.data ?? response;

const replies = {
  ta: { lotId: 'எந்த லாட் IDன்னு சொல்லுங்க.', heatId: 'எந்த ஹீட் IDன்னு சொல்லுங்க.', grade: 'எந்த கிரேட்னு சொல்லுங்க.', unavailable: 'இந்த தகவல் இப்போ கிடைக்கல.', empty: 'இந்த லாட்ல தகவல் கிடைக்கல.', noLots: 'கிடைக்கிற லாட் எதுவும் இல்ல.', noReading: 'இந்த ஹீட்டுக்கு ரீடிங் கிடைக்கல.', unknownGrade: 'இந்த கிரேடு ஸ்பெக் கிடைக்கல.', ambiguous: 'இதுக்கு ஒரே பதில் கண்டுபிடிக்க முடியல.' },
  hi: { lotId: 'कौन सा लॉट ID, बताइए।', heatId: 'कौन सा हीट ID, बताइए।', grade: 'कौन सा ग्रेड, बताइए।', unavailable: 'यह जानकारी अभी उपलब्ध नहीं है।', empty: 'इस लॉट की जानकारी नहीं मिली।', noLots: 'कोई उपलब्ध लॉट नहीं मिला।', noReading: 'इस हीट की रीडिंग नहीं मिली।', unknownGrade: 'इस ग्रेड का स्पेक नहीं मिला।', ambiguous: 'एक साफ़ जवाब नहीं मिल रहा।' },
  en: { lotId: 'Please say the lot ID.', heatId: 'Please say the heat ID.', grade: 'Please say the grade.', unavailable: 'That information is unavailable right now.', empty: 'No information was found for that lot.', noLots: 'No available lots were found.', noReading: 'No reading was found for that heat.', unknownGrade: 'No specification was found for that grade.', ambiguous: 'I cannot identify one unambiguous answer.' },
};

const valueText = value => value === null || value === undefined || value === '' ? null : String(value);
const fmt = value => valueText(value);
const sameId = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();

export function resolveVoicePageQuestion(intent, params, selected = {}) {
  if (intent === 'stock_lot_detail') return { ...params, lotId: params.lotId || selected.lotId || null };
  if (intent === 'spectrometer_heat_reading') return { ...params, heatId: params.heatId || selected.heatId || null };
  if (intent === 'grade_ranges') return { ...params, grade: params.grade || selected.grade || null };
  return params;
}

function lotLine(lot, lang) {
  const id = valueText(lot?.lotId);
  if (!id) return null;
  const material = valueText(lot.materialLabel || lot.materialType || lot.description) || (lang === 'ta' ? 'மெட்டீரியல்' : lang === 'hi' ? 'मटेरियल' : 'material');
  const available = fmt(lot.availableKg), received = fmt(lot.receivedKg), status = valueText(lot.status);
  return `${id}: ${material}${available === null ? '' : `, ${available} kg available`}${received === null ? '' : `, ${received} kg received`}${status ? `, ${status}` : ''}`;
}

export function formatLotsAnswer(rows, lang = 'en') {
  if (!Array.isArray(rows)) return replies[lang]?.unavailable || replies.en.unavailable;
  const list = rows.filter(lot => Number.isFinite(Number(lot?.availableKg)) && Number(lot.availableKg) > 0 && lot?.status !== 'CONSUMED');
  if (!list.length) return replies[lang]?.noLots || replies.en.noLots;
  const lines = list.map(lot => lotLine(lot, lang)).filter(Boolean);
  return lines.length ? lines.join('. ') : replies[lang]?.unavailable || replies.en.unavailable;
}

export function formatLotDetailAnswer(payload, lotId, lang = 'en') {
  const lot = payload?.lot || payload;
  if (!lot || !sameId(lot.lotId, lotId)) return replies[lang]?.empty || replies.en.empty;
  const base = lotLine(lot, lang);
  const chemistry = lot.tested && typeof lot.tested === 'object' ? lot.tested : lot.declared;
  const chemistryText = chemistry && Object.entries(chemistry)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([element, value]) => `${element} ${value}`);
  const details = [base, lot.supplier ? `supplier ${valueText(lot.supplier)}` : null, lot.chemistrySource ? `chemistry source ${valueText(lot.chemistrySource)}` : null, lot.receivedAt ? `received at ${valueText(lot.receivedAt)}` : null]
    .filter(Boolean);
  if (chemistryText?.length) details.push(`chemistry ${chemistryText.join(', ')}`);
  return details.join('. ');
}

const readingTime = row => {
  const raw = row?.timestamp ?? row?.createdAt;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export function latestReadingForHeat(rows, heatId) {
  const matching = (Array.isArray(rows) ? rows : []).filter(row => sameId(row?.heatId, heatId));
  const timed = matching.map((row, index) => ({ row, index, time: readingTime(row) })).filter(item => item.time !== null);
  if (!timed.length) return { status: matching.length ? 'untimed' : 'missing' };
  timed.sort((a, b) => b.time - a.time || a.index - b.index);
  if (timed.length > 1 && timed[0].time === timed[1].time) return { status: 'ambiguous' };
  return { status: 'ok', row: timed[0].row, timestamp: timed[0].row.timestamp ?? timed[0].row.createdAt };
}

export function formatHeatReadingAnswer(result, heatId, lang = 'en') {
  if (result?.status === 'ambiguous') return replies[lang]?.ambiguous || replies.en.ambiguous;
  if (result?.status === 'missing') return replies[lang]?.noReading || replies.en.noReading;
  if (result?.status !== 'ok') return replies[lang]?.unavailable || replies.en.unavailable;
  const row = result.row;
  const composition = row.composition && typeof row.composition === 'object' ? row.composition : row;
  const elements = Object.entries(composition).filter(([key, value]) =>
    /^[A-Z][a-z]?$/u.test(key) && value !== null && value !== undefined && typeof value !== 'object'
  );
  if (!elements.length) return replies[lang]?.unavailable || replies.en.unavailable;
  const lead = lang === 'ta' ? 'சமீபத்தில் கிடைத்த ரீடிங்' : lang === 'hi' ? 'सबसे नई उपलब्ध रीडिंग' : 'Latest available reading';
  return `${lead} ${heatId}. ${elements.map(([key, value]) => `${key} ${value}%`).join(', ')}. ${result.timestamp}`;
}

export function formatGradeRangesAnswer(specs, grade, element, lang = 'en') {
  const matches = (Array.isArray(specs) ? specs : []).filter(spec => sameId(spec?.grade, grade));
  if (!matches.length) return replies[lang]?.unknownGrade || replies.en.unknownGrade;
  if (matches.length > 1) return replies[lang]?.ambiguous || replies.en.ambiguous;
  const spec = matches[0], ranges = spec.composition_ranges || {};
  const selected = (element ? Object.entries(ranges).filter(([key]) => key.toLowerCase() === element.toLowerCase()) : Object.entries(ranges))
    .filter(([, range]) => Array.isArray(range) && range.length >= 2);
  if (!selected.length) return replies[lang]?.unavailable || replies.en.unavailable;
  const lead = lang === 'ta' ? 'கட்டமைத்த கிரேடு ரேஞ்ச்' : lang === 'hi' ? 'कॉन्फ़िगर ग्रेड रेंज' : 'Configured grade range';
  return `${lead} ${spec.grade}. ${selected.map(([key, range]) => `${key} ${range[0]}–${range[1]}%`).join(', ')}`;
}

export async function answerVoicePageQuestion({ intent, params, selected = {}, lang = 'en', services }) {
  const slot = resolveVoicePageQuestion(intent, params, selected);
  const text = replies[lang] || replies.en;
  if (params?.ambiguous) return text.ambiguous;
  if (intent === 'stock_lots') {
    try { return formatLotsAnswer(unwrap(await services.getLots()), lang); }
    catch { return text.unavailable; }
  }
  if (intent === 'stock_lot_detail') {
    if (!slot.lotId) return text.lotId;
    try { return formatLotDetailAnswer(unwrap(await services.getLot(slot.lotId)), slot.lotId, lang); }
    catch { return text.empty; }
  }
  if (intent === 'spectrometer_heat_reading') {
    if (!slot.heatId) return text.heatId;
    try { return formatHeatReadingAnswer(latestReadingForHeat(unwrap(await services.getAllReadings()), slot.heatId), slot.heatId, lang); }
    catch { return text.unavailable; }
  }
  if (intent === 'grade_ranges') {
    if (!slot.grade) return text.grade;
    try { return formatGradeRangesAnswer(unwrap(await services.getAllGradeSpecs()), slot.grade, slot.element, lang); }
    catch { return text.unavailable; }
  }
  return text.unavailable;
}

const briefingWords = {
  ta: { heading:'டாஷ்போர்டு சுருக்கம்.', returned:'திரும்பிய ஹீட் ரெக்கார்டு', active:'ஆக்டிவ்', excluded:'முடிஞ்ச/மற்ற ஹீட் கணக்கில் இல்லை', counts:'ஸ்டேட்டஸ்', hold:'HOLD', warn:'WARN', go:'GO', melting:'ஃபர்னஸ்ல ஓடுது', unchecked:'செக் ஆகல/காலாவதி', priority:'முதல்ல கவனிக்க', none:'திரும்பிய ஆக்டிவ் ஹீட்ல சேவ் ஆன HOLD/WARN இல்லை', latestGate:'திரும்பிய கேட் செக் நேரம்', timeUnavailable:'நேரம் கிடைக்கல', heatUnavailable:'ஹீட் லிஸ்ட் தகவல் கிடைக்கல', heatEmpty:'ஹீட் லிஸ்ட்ல ரெக்கார்டு வரல; எண்ணிக்கை கிடைக்கல', opc:'OPC', connected:'கனெக்டட்', disconnected:'கனெக்ட் ஆகல', statusUnavailable:'OPC ஸ்டேட்டஸ் கிடைக்கல', timestamp:'சோர்ஸ் நேரம்', sourceTimeUnavailable:'சோர்ஸ் நேரம் கிடைக்கல' },
  hi: { heading:'डैशबोर्ड ब्रीफिंग।', returned:'लौटे हीट रिकॉर्ड', active:'एक्टिव', excluded:'पूरे और बाकी हीट शामिल नहीं', counts:'स्टेटस', hold:'HOLD', warn:'WARN', go:'GO', melting:'भट्टी में चल रहे', unchecked:'अनचेक या एक्सपायर', priority:'पहले देखें', none:'लौटे एक्टिव हीट में सेव HOLD/WARN नहीं है', latestGate:'लौटा गेट चेक समय', timeUnavailable:'समय नहीं मिला', heatUnavailable:'हीट लिस्ट जानकारी उपलब्ध नहीं', heatEmpty:'हीट लिस्ट में रिकॉर्ड नहीं मिले; गिनती उपलब्ध नहीं', opc:'OPC', connected:'कनेक्टेड', disconnected:'कनेक्ट नहीं', statusUnavailable:'OPC स्टेटस उपलब्ध नहीं', timestamp:'सोर्स समय', sourceTimeUnavailable:'सोर्स समय उपलब्ध नहीं' },
  en: { heading:'Dashboard briefing.', returned:'Returned heat rows', active:'active', excluded:'completed and other inactive rows excluded', counts:'Statuses', hold:'HOLD', warn:'WARN', go:'GO', melting:'melting', unchecked:'unchecked or expired', priority:'First priority', none:'No saved HOLD/WARN appears among returned active heats', latestGate:'Latest returned gate-check event', timeUnavailable:'timestamp unavailable', heatUnavailable:'Heat-list data unavailable', heatEmpty:'Heat list returned no rows; status counts unavailable', opc:'OPC', connected:'connected', disconnected:'disconnected', statusUnavailable:'OPC status unavailable', timestamp:'source timestamp', sourceTimeUnavailable:'source timestamp unavailable' },
};

const rawTimestamp = value => value instanceof Date ? value.toISOString() : typeof value === 'string' && value.trim() ? value : null;
function latestReturnedGateTimestamp(rows) {
  const events = rows.map(row => row?.gateResult || row?.gate).map(gate => ({ raw:rawTimestamp(gate?.at), ms:Date.parse(gate?.at) })).filter(item => item.raw && Number.isFinite(item.ms));
  events.sort((a,b)=>b.ms-a.ms);
  return events[0]?.raw || null;
}
function statusSentence(status, lang) {
  const labels=briefingWords[lang]||briefingWords.en;
  if(status?.kind==='failed') return labels.statusUnavailable;
  if(status?.kind!=='available') return labels.statusUnavailable;
  if(typeof status.connected!=='boolean') return labels.statusUnavailable;
  return `${labels.opc} ${status.connected?labels.connected:labels.disconnected}`;
}

export function formatDashboardBriefing({ heats, opcStatus, now=Date.now() } = {}, lang='en') {
  const labels=briefingWords[lang]||briefingWords.en, lines=[labels.heading];
  if(heats?.kind==='failed') lines.push(`${labels.heatUnavailable}.`);
  else if(heats?.kind!=='available' || !Array.isArray(heats.rows)) lines.push(`${labels.heatUnavailable}.`);
  else if(heats.rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||typeof row.heatId!=='string'||typeof row.status!=='string')) lines.push(`${labels.heatUnavailable}.`);
  else if(heats.rows.length===0) lines.push(`${labels.heatEmpty}.`);
  else {
    const summary=buildShiftSummary(heats.rows,now), groups=summary.groups;
    const active=Object.values(groups).reduce((total,items)=>total+items.length,0);
    lines.push(`${labels.returned} ${heats.rows.length}; ${labels.active} ${active}, ${labels.excluded}: ${summary.excludedCompleted+summary.excludedOther}.`);
    const counts=`${labels.counts}: ${labels.hold} ${summary.counts.HOLD}, ${labels.warn} ${summary.counts.WARN}, ${labels.go} ${summary.counts.GO}, ${labels.melting} ${summary.counts.melting}, ${labels.unchecked} ${summary.counts.not_checked}`;
    const idList=(key)=>{
      const all=groups[key], shown=all.slice(0,3);
      return all.length?`${labels[key==='HOLD'?'hold':'warn']} ${all.length}: ${shown.join(', ')}${all.length>shown.length?` (+${all.length-shown.length})`:''}`:null;
    };
    const priority=summary.priorityId?`${labels.priority}: ${groups.HOLD.length?labels.hold:labels.warn} ${summary.priorityId}`:labels.none;
    const items=[idList('HOLD'),idList('WARN')].filter(Boolean).join('; ');
    lines.push(`${counts}; ${items?`${items}; `:''}${priority}.`);
    const gateAt=latestReturnedGateTimestamp(heats.rows);
    lines.push(`${labels.latestGate}: ${gateAt||labels.timeUnavailable}.`);
  }
  const opc=statusSentence(opcStatus,lang);
  const opcAt=opcStatus?.kind==='available'?rawTimestamp(opcStatus.timestamp):null;
  lines.push(`${opc}; ${labels.timestamp}: ${opcAt||labels.sourceTimeUnavailable}.`);
  return lines.join(' ');
}

export async function getDashboardBriefing({ services, now=Date.now() }) {
  const [heatResult,opcResult]=await Promise.allSettled([
    Promise.resolve().then(()=>services.getShiftSummaryHeats()),
    Promise.resolve().then(()=>services.getOPCStatus()),
  ]);
  let heats={kind:'failed'},opcStatus={kind:'failed'};
  if(heatResult.status==='fulfilled') {
    const rows=unwrap(heatResult.value);
    heats=Array.isArray(rows)&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.heatId==='string'&&typeof row.status==='string')?{kind:'available',rows}:{kind:'failed'};
  }
  if(opcResult.status==='fulfilled') {
    const data=unwrap(opcResult.value), status=data?.opcStatus||data, client=status?.client;
    opcStatus={kind:'available',connected:client?.isConnected,timestamp:data?.timestamp||status?.timestamp||null};
  }
  return { textByLanguage:Object.fromEntries(['ta','hi','en'].map(lang=>[lang,formatDashboardBriefing({heats,opcStatus,now},lang)])), heats, opcStatus };
}
