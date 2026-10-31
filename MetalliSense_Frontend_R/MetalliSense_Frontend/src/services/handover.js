import { normalizeSpokenNumbers } from './spokenNumbers';

export function classifyHandoverClaim(text) {
  const normalized = String(text).normalize('NFKC').toLowerCase().replace(/['’]/g, ' ');
  if (/\b(?:not|isn t)\s+(?:ok|okay|ready|fine)\b|சரியில்லை|சரி\s*இல்லை|ரெடி இல்லை|ठीक\s*नहीं/u.test(normalized)) return 'says problem';
  if (/\bno\s+problem\b/.test(normalized)) return 'says OK';
  if (/\b(?:hold|problem)\b|பிரச்சனை|பிரச்சினை|ஹோல்ட்|होल्ड|गड़बड़/u.test(normalized)) return 'says problem';
  if (/\b(?:ok|okay|ready|fine)\b|சரி|ரெடி|ठीक/u.test(normalized)) return 'says OK';
  return 'mentioned';
}

export function extractHeatClaims(text) {
  return String(text).split(/[.!?;।]+/u).flatMap(clause => {
    const normalized = normalizeSpokenNumbers(clause.normalize('NFKC').toLowerCase()
      .replace(/(\d{4})\s*(?:and|,)\s*(?=\d{4})/g, '$1 heat ')
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ').replace(/-/g, ' '));
    const matches = [...normalized.matchAll(/(?:\b(?:heat|heats|h)\s*|ஹீட்\s*|हीट\s*|^\s*)(\d{4})(?!\d)/gu)];
    return matches.map((match, index) => ({ heatId: `H-${Number(match[1])}`,
      claim: classifyHandoverClaim(normalized.slice(match.index, matches[index + 1]?.index)) }));
  });
}

export function crossCheckHandover(segments, heats) {
  const byId = new Map(heats.map(heat => [heat.heatId, heat]));
  const mentioned = new Set();
  const checks = segments.flatMap((segment, index) => extractHeatClaims(segment.text).map(({ heatId, claim }) => {
    mentioned.add(heatId);
    const gate = byId.get(heatId)?.gateResult || byId.get(heatId)?.gate;
    const decision = gate?.decision;
    const base = { heatId, claim, decision: decision || 'not checked', segment: index };
    if (!decision || gate.stale) return { ...base, severity: 'amber', label: 'Gate unavailable / recheck' };
    if (claim === 'says OK' && ['HOLD', 'WARN'].includes(decision)) return { ...base, severity: 'red', label: 'Mismatch' };
    if (claim === 'says problem' && decision === 'GO') return { ...base, severity: 'amber', label: 'Check' };
    return { ...base, severity: 'green', label: claim === 'mentioned' ? 'Mentioned' : 'Consistent' };
  }));
  for (const heat of heats) {
    if ((heat.gateResult || heat.gate)?.decision === 'HOLD' && !mentioned.has(heat.heatId)) {
      checks.push({ heatId: heat.heatId, claim: 'not mentioned', decision: 'HOLD', severity: 'amber', label: 'HOLD heat not mentioned in handover' });
    }
  }
  return checks;
}

export async function submitHandover(file, signal) {
  const body = new FormData(); body.append('audio', file);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new Error('handover_cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 155000);
  try {
    const response = await fetch(`${(import.meta.env.VITE_COPILOT_BASE_URL || 'http://localhost:8001').replace(/\/$/, '')}/copilot/handover`,
      { method: 'POST', body, signal: controller.signal, timeout: 155000 });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const allowed = ['handover_disabled','audio_size_limit','audio_duration_limit','invalid_audio','audio_decoder_unavailable','batch_timeout','batch_failed'];
      const code = data.detail?.code || data.error?.code;
      throw new Error(allowed.includes(code) ? code : 'handover_unavailable');
    }
    const data = await response.json();
    if (!Array.isArray(data.segments)) throw new Error('handover_unavailable');
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
