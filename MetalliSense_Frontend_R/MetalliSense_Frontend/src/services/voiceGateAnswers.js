const names = { C: 'கார்பன்', Si: 'சிலிக்கான்', Mn: 'மாங்கனீசு', P: 'பாஸ்பரஸ்', S: 'சல்பர்', Cu: 'செம்பு', Cr: 'குரோமியம்', Ni: 'நிக்கல்', Mo: 'மாலிப்டினம்', Sn: 'தகரம்' };
const tamilChecks = {
  charge_weight: 'சார்ஜ் எடை இலக்கு எடையுடன் பொருந்தவில்லை. எடையைச் சரிபார்க்கவும்',
  lot_status: 'மூலப்பொருள் தொகுதிக்கு பயன்படுத்த அனுமதி இல்லை. தர அனுமதியைச் சரிபார்க்கவும்',
  stock: 'சார்ஜுக்குத் தேவையான கையிருப்பு போதவில்லை',
  yard_inspection: 'கையடக்கக் கருவி ஆய்வு முழுமையாக இல்லை. ஆய்வைச் சரிபார்க்கவும்',
  dri_quality: 'ஸ்பாஞ்ச் இரும்பின் ஆய்வக முடிவு அல்லது தர அனுமதியைச் சரிபார்க்கவும்',
  spec_prediction: 'கணிக்கப்பட்ட உலோகக் கலவை தர வரம்பை மீறலாம். சார்ஜைச் சரிபார்க்கவும்',
  residuals: 'எஞ்சிய தனிமங்கள் தர வரம்பை மீறலாம். சார்ஜைச் சரிபார்க்கவும்',
  ai_assessment: 'செயற்கை நுண்ணறிவு மதிப்பீட்டில் தர அபாயம் அல்லது பரிந்துரை உள்ளது. திரையில் விவரங்களைச் சரிபார்க்கவும்',
};
const textOf = item => typeof item === 'string' ? item : item?.title || item?.message || item?.text || item?.id;

function tamilReason(check) {
  const details = (check.details || []).filter(d => d.status === check.status);
  const chemistry = details.filter(d => d.element && Number.isFinite(d.value));
  if (chemistry.length) return chemistry.map(d => {
    const element = `${names[d.element] || d.element} (${d.element})`;
    const value = Number(d.value.toFixed(3));
    if (d.value > d.max) return `${element} ${value} சதவீதம்; அதிகபட்ச வரம்பு ${d.max} சதவீதத்தை மீறுகிறது. சார்ஜ் கலவையை மாற்றவும்`;
    if (d.value < d.min) return `${element} ${value} சதவீதம்; குறைந்தபட்ச வரம்பு ${d.min} சதவீதத்தை விடக் குறைவு. சேர்க்கை தேவை`;
    return `${element} ${value} சதவீதம்; ${d.min ?? 0} முதல் ${d.max} சதவீத வரம்பை மீறும் அபாயம் உள்ளது. திரையில் எச்சரிக்கையைச் சரிபார்க்கவும்`;
  }).join('. ');
  if (check.id === 'lot_status' && details.length) return details.map(d =>
    /QUARANTINED/.test(d.text || '')
      ? `${d.lotId} தனிமைப்படுத்தப்பட்டுள்ளது. இந்தத் தொகுதியை சார்ஜில் பயன்படுத்த முடியாது`
      : `${d.lotId}: ${check.status === 'WARN' ? 'கட்டுப்பாடுகளுடன் மட்டுமே பயன்படுத்த அனுமதி. சார்ஜ் பங்கின் வரம்பைச் சரிபார்க்கவும்' : 'பயன்படுத்த அனுமதி இல்லை. தர அனுமதியைச் சரிபார்க்கவும்'}`
  ).join('. ');
  return tamilChecks[check.id] || 'இந்தச் சோதனையில் தரப் பிரச்சினை உள்ளது. திரையில் காரணத்தைச் சரிபார்க்கவும்';
}

export function gateReasonAnswer(gate, lang = 'ta') {
  if (!gate) return lang === 'ta' ? 'Gate சோதனை இன்னும் செய்யப்படவில்லை' : 'The gate has not been checked';
  const status = gate.decision === 'HOLD' ? 'FAIL' : gate.decision === 'WARN' ? 'WARN' : null;
  if (!status) return lang === 'ta' ? 'Gate GO. தடைகளோ எச்சரிக்கைகளோ இல்லை' : 'Gate GO. No blocking issues or warnings';
  const checks = (gate.checks || []).filter(check => check.status === status);
  if (lang === 'ta' && checks.length) return checks.map(tamilReason).join('. ');
  const reasons = (gate.decision === 'WARN' ? gate.warnings || [] : gate.blocking || []).map(textOf).filter(Boolean);
  if (reasons.length) return reasons.join('. ');
  if (checks.length) return checks.map(check => check.summary || check.title).filter(Boolean).join('. ');
  return lang === 'ta' ? 'Gate காரணம் கிடைக்கவில்லை. திரையில் விவரங்களைச் சரிபார்க்கவும்' : gate.headline || 'No gate reason available';
}

// Speech is intentionally separate from the complete on-screen explanation.
export function spokenGateReasonAnswer(gate, lang = 'ta') {
  if (!gate || !['HOLD', 'WARN'].includes(gate.decision)) return gateReasonAnswer(gate, lang);
  const rank = { FAIL: 0, WARN: 1 };
  const priority = { lot_status: 0, spec_prediction: 1, residuals: 2, stock: 3 };
  const checks = (gate.checks || []).filter(c => c.id !== 'ai_assessment'
    && (c.status === 'FAIL' && gate.decision === 'HOLD' || c.status === 'WARN'))
    .sort((a, b) => rank[a.status] - rank[b.status] || (priority[a.id] ?? 4) - (priority[b.id] ?? 4));
  const reasons = checks.flatMap(check => {
    const details = (check.details || []).filter(d => d.status === check.status);
    if (details.length) return details.map(d => {
      if (d.element && Number.isFinite(d.value)) {
        const low = d.value < d.min || (d.value <= d.max && Number.isFinite(d.min)
          && d.value - d.min < d.max - d.value);
        const value = d.value.toFixed(2);
        return lang === 'ta'
          ? `${names[d.element] || d.element} ${value} சதவீதம், ${low ? 'குறைவு' : 'அதிகம்'}`
          : `${d.element} ${value} percent, ${low ? 'low' : 'high'}`;
      }
      if (check.id === 'lot_status') return lang === 'ta'
        ? `${d.lotId}: ${/QUARANTINED/.test(d.text || '') ? 'தனிமைப்படுத்தப்பட்டுள்ளது' : check.status === 'WARN' ? 'பயன்பாட்டுக் கட்டுப்பாடு' : 'பயன்படுத்த அனுமதி இல்லை'}`
        : `${d.lotId}: ${/QUARANTINED/.test(d.text || '') ? 'quarantined' : 'use restricted'}`;
      return lang === 'ta' ? (tamilChecks[check.id] || 'தரப் பிரச்சினை உள்ளது').split('.')[0]
        : (textOf(d) || check.title || check.summary).split(/[.!?](?=\s|$)/)[0];
    });
    return [lang === 'ta' ? (tamilChecks[check.id] || 'தரப் பிரச்சினை உள்ளது').split('.')[0]
      : (check.summary || check.title || 'Review gate check').split(/[.!?](?=\s|$)/)[0]];
  });
  if (!(gate.checks || []).length) {
    const saved = gate.decision === 'WARN' ? gate.warnings || [] : gate.blocking || [];
    reasons.push(...saved.filter(item => item?.id !== 'ai_assessment').map(textOf).filter(Boolean)
      .filter(text => !/\b(?:AI|off-spec risk|confidence)\b/i.test(text))
      .map(text => text.split(/[.!?](?=\s|$)/)[0]));
  }
  const more = reasons.length - 2;
  const summary = reasons.slice(0, 2);
  if (more > 0) summary.push(lang === 'ta' ? `மேலும் ${more} விவரங்கள் திரையில்` : `${more} more on screen`);
  return summary.join('. ') || (lang === 'ta' ? 'மேலும் விவரங்கள் திரையில்' : 'See details on screen');
}

export function heatVoiceAnswer(intent, heat, params = {}, lang = 'ta') {
  const gate = heat.gateResult;
  if (intent === 'heat_status') return lang === 'ta'
    ? `Heat ${heat.heatId}: நிலை ${heat.status}. Gate ${gate?.decision || 'தகவல் இல்லை'}`
    : `Heat ${heat.heatId}: ${heat.status}. Gate ${gate?.decision || 'not checked'}`;
  if (intent === 'gate_reason') return gateReasonAnswer(gate, lang);
  const detail = gate?.checks?.find(c => c.id === 'spec_prediction')?.details?.find(d => d.element === params.element);
  return detail ? `Heat ${heat.heatId}: ${params.element} ${detail.value}%. ${lang === 'ta' ? 'வரம்பு' : 'Range'} ${detail.min ?? '—'} ${lang === 'ta' ? 'முதல்' : 'to'} ${detail.max ?? '—'}%. ${detail.status || ''}`
    : lang === 'ta' ? 'தனிம அளவு கிடைக்கவில்லை' : 'Element value unavailable';
}

export function createHoldAnnouncer() {
  const decisions = new Map();
  return {
    reset() { decisions.clear(); },
    announce(heatId, gate, speak, lang = 'ta', muted = false) {
      if (!heatId) return;
      const previous = decisions.get(heatId);
      if (gate?.decision === 'HOLD' && muted) return;
      decisions.set(heatId, gate?.decision);
      if (gate?.decision !== 'HOLD' || previous === 'HOLD') return;
      const message = lang === 'ta'
        ? `Heat ${heatId}: Gate HOLD. உருக்கத் தொடங்க முடியாது. ${spokenGateReasonAnswer(gate, lang)}`
        : `Heat ${heatId}: Gate HOLD. Furnace start is locked. ${spokenGateReasonAnswer(gate, lang)}`;
      return speak(message, lang);
    },
  };
}

export const holdAnnouncer = createHoldAnnouncer();
