import { gatePhraseFacts } from './gatePhraseFacts';
import { hindiNotUnderstood } from './languageBridge';

export const hindiElements = { C: 'कार्बन', Si: 'सिलिकॉन', Mn: 'मैंगनीज़', P: 'फॉस्फोरस', S: 'सल्फर', Cu: 'कॉपर', Cr: 'क्रोमियम', Ni: 'निकल', Mo: 'मॉलिब्डेनम' };
export function formatGateLimit(value, low = false) {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const places = Math.max(0, (mantissa.split('.')[1]?.length || 0) - Number(exponent));
  return value.toFixed(Math.max(low ? 1 : 2, places));
}
export function hindiGateAnswer(heat) {
  const facts = gatePhraseFacts(heat);
  const id = heat.heatId;
  if (facts.decision === 'GO') return `हीट ${id} ठीक है, गो।`;
  if (!['HOLD', 'WARN'].includes(facts.decision)) return `हीट ${id}: गेट जाँच अभी नहीं हुई है।`;
  const lines = [facts.decision === 'HOLD' ? `हीट ${id} होल्ड पर है।` : `हीट ${id} पर चेतावनी है।`];
  for (const reason of facts.reasons) {
    if (reason.lot_id) {
      const state = reason.lot_status === 'QUARANTINED' ? 'क्वारंटीन में है' : reason.lot_status === 'RESTRICTED' ? 'का उपयोग सीमित है' : 'उपयोग के लिए जारी नहीं है';
      lines.push(`लॉट ${reason.lot_id} ${state}।`);
    } else if (reason.element) {
      const low = reason.direction === 'low';
      const name = hindiElements[reason.element] || reason.element;
      const lead = `${name} ${reason.value.toFixed(2)} प्रतिशत है`;
      // Near-limit WARN is a risk, not an actual out-of-range measurement.
      if (reason.risk) lines.push(`${lead}, ${low ? 'न्यूनतम' : 'सीमा'} के पास है।`);
      else if (Number.isFinite(low ? reason.min : reason.max)) lines.push(`${lead}, ${low ? `न्यूनतम ${formatGateLimit(reason.min, true)}` : `सीमा ${formatGateLimit(reason.max)}`} से ${low ? 'कम' : 'ज़्यादा'}।`);
      else lines.push(`${lead}।`);
    } else lines.push('जाँच का विवरण स्क्रीन पर देखें।');
  }
  if (facts.remaining_reasons) lines.push(`${facts.remaining_reasons} और बातें स्क्रीन पर।`);
  return lines.join(' ');
}

export function hindiHeatAnswer(intent, heat, params) {
  if (intent === 'heat_status' || intent === 'gate_reason') return hindiGateAnswer(heat);
  if (intent === 'element_value') {
    const detail = (heat.gateResult?.checks || []).flatMap(c => c.details || []).find(d => d.element === params.element && Number.isFinite(d.value));
    return detail ? `हीट ${heat.heatId}: ${hindiElements[params.element] || params.element} ${detail.value.toFixed(2)} प्रतिशत है।` : 'तत्व की मात्रा उपलब्ध नहीं है।';
  }
  return hindiNotUnderstood;
}
