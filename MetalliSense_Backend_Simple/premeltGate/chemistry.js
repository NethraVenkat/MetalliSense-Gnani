/**
 * Chemistry of lots and of a whole charge.
 *
 * predictMeltdown() answers: "if we melt these lots in these amounts,
 * what chemistry will the bath have, and how sure are we?"
 */
const {
  ALL_ELEMENTS,
  TRAMP_ELEMENTS,
  MATERIAL_TYPES,
  SOURCE_REL_SIGMA,
  ABS_SIGMA_FLOOR,
  PROCESS_REL_SIGMA,
  MELT_RECOVERY,
} = require('./config');

const NON_FE = ALL_ELEMENTS.filter((el) => el !== 'Fe');

const round = (v, dp = 4) => Math.round(v * 10 ** dp) / 10 ** dp;

function withFeBalance(comp) {
  const out = {};
  NON_FE.forEach((el) => { out[el] = Number(comp[el]) || 0; });
  out.Fe = round(Math.max(0, 100 - NON_FE.reduce((s, el) => s + out[el], 0)), 3);
  return out;
}

/**
 * Sponge iron: what 1 kg of DRI actually gives as liquid metal.
 * - Metallic Fe melts straight in.
 * - Carbon in DRI reduces some of the remaining FeO (FeO + C -> Fe + CO):
 *   12 kg C recovers 56 kg Fe. Leftover carbon dissolves in the bath.
 * - Silica/alumina (gangue) go to slag; P and S stay in the metal
 *   (an induction furnace barely removes them).
 * - Part of the fines is lost as dust or into slag.
 */
function driMetal(dri) {
  const feTotal = Number(dri.feTotal);
  const feMetallic = Number(dri.feMetallic);
  const C = Number(dri.C) || 0;
  const P = Number(dri.P) || 0;
  const S = Number(dri.S) || 0;

  const feOxide = Math.max(0, feTotal - feMetallic);
  const feFromReduction = Math.min(feOxide, (C * 56) / 12);
  const cLeft = Math.max(0, C - (feFromReduction * 12) / 56);
  const metalPer100 = feMetallic + feFromReduction + cLeft + P + S;
  const finesLoss = ((Number(dri.fines) || 0) * 0.5) / 100;

  const comp = { C: (cLeft / metalPer100) * 100, Si: 0, Mn: 0, P: (P / metalPer100) * 100, S: (S / metalPer100) * 100 };
  TRAMP_ELEMENTS.forEach((el) => { comp[el] = Number(dri[el]) || 0; });

  return {
    yield: round((metalPer100 / 100) * (1 - finesLoss), 4),
    composition: withFeBalance(comp),
    metallization: feTotal > 0 ? round((feMetallic / feTotal) * 100, 2) : null,
  };
}

/** Best-known chemistry of a lot, the metal yield, and how far to trust it. */
function lotChemistry(lot) {
  const type = MATERIAL_TYPES[lot.materialType];
  const source = lot.chemistrySource;
  const base = lot.tested || lot.declared || {};

  if (lot.materialType === 'DRI') {
    const d = driMetal(base);
    return { composition: d.composition, yield: d.yield, source, relSigma: SOURCE_REL_SIGMA[source] ?? 0.15, isAlloy: false };
  }
  return {
    composition: withFeBalance(base),
    yield: lot.yieldOverride ?? type.yield,
    source,
    relSigma: SOURCE_REL_SIGMA[source] ?? 0.15,
    isAlloy: lot.materialType === 'FERROALLOY',
  };
}

/**
 * Weighted melt-down chemistry of a charge.
 * lines: [{ lot, kg }]
 */
function predictMeltdown(lines) {
  const parts = lines
    .filter((l) => l.lot && l.kg > 0)
    .map((l) => {
      const chem = lotChemistry(l.lot);
      return { lotId: l.lot.lotId, materialType: l.lot.materialType, kg: l.kg, metalKg: l.kg * chem.yield, chem };
    });

  const metalKg = parts.reduce((s, p) => s + p.metalKg, 0);
  if (metalKg <= 0) return null;

  const composition = {};
  const sigma = {};
  const sources = {};

  NON_FE.forEach((el) => {
    let value = 0;
    let variance = 0;
    const contrib = [];
    parts.forEach((p) => {
      const w = p.metalKg / metalKg;
      const recovery = p.chem.isAlloy ? 1 : (MELT_RECOVERY[el] ?? 1);
      const c = p.chem.composition[el] * recovery;
      value += w * c;
      const lotSigma = Math.abs(c) * p.chem.relSigma + (c > 0 ? ABS_SIGMA_FLOOR[el] || 0 : 0);
      variance += (w * lotSigma) ** 2;
      contrib.push({ lotId: p.lotId, amount: w * c });
    });
    variance += (value * PROCESS_REL_SIGMA) ** 2;
    composition[el] = round(value, 4);
    sigma[el] = round(Math.sqrt(variance), 4);
    sources[el] = contrib
      .filter((c) => c.amount > 0)
      .map((c) => ({ lotId: c.lotId, sharePct: round((c.amount / (value || 1)) * 100, 1) }))
      .sort((a, b) => b.sharePct - a.sharePct);
  });

  composition.Fe = round(Math.max(0, 100 - NON_FE.reduce((s, el) => s + composition[el], 0)), 3);

  return {
    composition,
    sigma,
    sources,
    chargeKg: round(parts.reduce((s, p) => s + p.kg, 0), 1),
    metalKg: round(metalKg, 1),
    lines: parts.map((p) => ({
      lotId: p.lotId,
      materialType: p.materialType,
      kg: p.kg,
      metalKg: round(p.metalKg, 1),
      metalSharePct: round((p.metalKg / metalKg) * 100, 1),
      yieldPct: round(p.chem.yield * 100, 1),
      chemistrySource: p.chem.source,
    })),
  };
}

module.exports = { driMetal, lotChemistry, predictMeltdown, withFeBalance, round };
