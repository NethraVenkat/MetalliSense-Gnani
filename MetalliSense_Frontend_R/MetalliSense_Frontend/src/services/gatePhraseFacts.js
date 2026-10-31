// Select the same non-AI reason order as spokenGateReasonAnswer. Only bounded
// structured facts leave the browser; no free text, model advice or gate mutation.
export function gatePhraseFacts(heat) {
  const gate = heat.gateResult;
  const rank = { FAIL: 0, WARN: 1 };
  const priority = { lot_status: 0, spec_prediction: 1, residuals: 2, stock: 3 };
  const checks = (gate?.checks || []).filter(c => c.id !== 'ai_assessment'
    && (c.status === 'FAIL' && gate.decision === 'HOLD' || c.status === 'WARN'))
    .sort((a, b) => rank[a.status] - rank[b.status] || (priority[a.id] ?? 4) - (priority[b.id] ?? 4));
  const reasons = checks.flatMap(check => {
    const details = (check.details || []).filter(d => d.status === check.status);
    return (details.length ? details : [{}]).map(detail => {
      const reason = { check: check.id, status: check.status };
      if (detail.element && Number.isFinite(detail.value)) {
        reason.element = detail.element; reason.value = detail.value;
        for (const key of ['min', 'max']) if (Number.isFinite(detail[key])) reason[key] = detail[key];
        const low = detail.value < detail.min || (detail.value <= detail.max && Number.isFinite(detail.min)
          && detail.value - detail.min < detail.max - detail.value);
        reason.direction = low ? 'low' : 'high';
        if (check.status === 'WARN' && (!Number.isFinite(detail.min) || detail.value >= detail.min)
          && (!Number.isFinite(detail.max) || detail.value <= detail.max)) reason.risk = true;
      }
      if (check.id === 'lot_status' && detail.lotId) {
        reason.lot_id = detail.lotId;
        reason.lot_status = /QUARANTINED/.test(detail.text || '') ? 'QUARANTINED' : check.status === 'WARN' ? 'RESTRICTED' : 'UNRELEASED';
      }
      return reason;
    });
  });
  return { heat_id: heat.heatId, decision: gate?.decision, reasons: reasons.slice(0, 2),
    ...(reasons.length > 2 ? { remaining_reasons: reasons.length - 2 } : {}) };
}
