/**
 * Supplier Scorecard (v2 — QCDS)
 *
 * Ranks raw-material suppliers on Quality, Cost, Delivery and Service — the
 * standard QCDS framework used in supplier evaluation — using data the
 * Pre-Melt Gate already records: lots (declared vs tested chemistry, status,
 * price, yield, promised date, invoice weight, documents), handheld gun
 * sessions, DRI lab results and heats (gate decisions). No manual rating.
 *
 *   Quality  : acceptance rate, declaration accuracy, clean pieces (gun), heat impact
 *   Cost     : effective cost of good metal, metal yield
 *   Delivery : on-time delivery, invoice-vs-weighbridge weight match
 *   Service  : document compliance (test certificate, weighbridge slip, e-way bill)
 *
 * Weights come from AHP (Analytic Hierarchy Process): pairwise judgements
 * between the four pillars give the pillar weights, with a consistency check.
 * The ranking is cross-checked with TOPSIS, a second multi-criteria method.
 *
 * Suppliers are compared only within the same material type. Criteria with
 * no data are skipped and the remaining weights re-normalised, so a supplier
 * is never punished for missing data.
 */
const store = require('./store');
const { MATERIAL_TYPES } = require('./config');
const { lotChemistry } = require('./chemistry');

const DAY = 24 * 3600 * 1000;

// ------------------------------------------------------------ criteria + pillars
const PILLARS = {
  quality: { label: 'Quality', color: '#0fa055' },
  cost: { label: 'Cost', color: '#0284c7' },
  delivery: { label: 'Delivery', color: '#d97706' },
  service: { label: 'Service', color: '#7c3aed' },
};
const PILLAR_KEYS = Object.keys(PILLARS);

const CRITERIA = {
  acceptance: { label: 'Acceptance rate', pillar: 'quality' },
  accuracy: { label: 'Declaration accuracy', pillar: 'quality' },
  contamination: { label: 'Clean pieces (gun)', pillar: 'quality' },
  heatImpact: { label: 'Heat impact', pillar: 'quality' },
  effectiveCost: { label: 'Effective cost', pillar: 'cost' },
  yield: { label: 'Metal yield', pillar: 'cost' },
  onTime: { label: 'On-time delivery', pillar: 'delivery' },
  weightMatch: { label: 'Weight match (invoice vs weighbridge)', pillar: 'delivery' },
  documents: { label: 'Document compliance', pillar: 'service' },
};

// How each pillar's weight is split between its criteria.
const WITHIN_PILLAR = {
  quality: { acceptance: 0.4, accuracy: 0.22, contamination: 0.2, heatImpact: 0.18 },
  cost: { effectiveCost: 0.73, yield: 0.27 },
  delivery: { onTime: 0.6, weightMatch: 0.4 },
  service: { documents: 1 },
};

// Saaty's random consistency index, by matrix size.
const RANDOM_INDEX = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32 };

// ------------------------------------------------------------ settings
const settings = {
  // AHP pairwise judgements on Saaty's 1–9 scale: "row is N times as important as column".
  ahpJudgements: {
    'quality:cost': 2,
    'quality:delivery': 3,
    'quality:service': 6,
    'cost:delivery': 2,
    'cost:service': 4,
    'delivery:service': 2,
  },
  weights: {}, // filled from AHP below
  weightsSource: 'AHP',
  // Cost of a rejected / restricted share: return freight, re-inspection, delay, replacement premium (₹ per kg).
  rejectHandlingRsPerKg: 10,
  // Minimum decided lots before a supplier gets a grade.
  minLotsForGrade: 3,
  grades: [
    { grade: 'A', min: 85, label: 'Preferred', inspectPieces: 10 },
    { grade: 'B', min: 70, label: 'Approved', inspectPieces: 15 },
    { grade: 'C', min: 50, label: 'Conditional', inspectPieces: 25 },
    { grade: 'D', min: 0, label: 'Blocked — manager approval', inspectPieces: 30 },
  ],
  newSupplierInspectPieces: 25,
  // Suppliers are judged on recent deliveries: the last N days (rolling window).
  // The trend shows the same rolling score at the end of each of the last months.
  scoreWindowDays: 120,
  trendPoints: 5,
  // Order split rules.
  order: { maxSharePct: 60, minSharePct: 10, conditionalMaxPct: 20, newMaxPct: 10, stepPct: 5 },
};

// Nominal metal yield per material (sponge iron has none in config: its yield comes from the lab).
const NOMINAL_YIELD = { DRI: 0.82 };
const nominalYield = (type) => NOMINAL_YIELD[type] ?? MATERIAL_TYPES[type]?.yield ?? 0.92;
// Scoring slopes: how fast a criterion loses points.
const YIELD_POINTS_PER_PCT = 12.5; // each 1 % point of yield below nominal costs 12.5 points (8 % below = 0)
const COST_POINTS_PER_PCT = 2.5; // each 1 % dearer than the cheapest good metal costs 2.5 points (40 % dearer = 0)

const ACCURACY_ELEMENTS = ['C', 'Si', 'Mn', 'P', 'S', 'Cu', 'Cr', 'Ni', 'feMetallic', 'feTotal'];
// Absolute floor (in % points) so tiny values do not blow up relative error.
const ACCURACY_FLOOR = { C: 0.05, Si: 0.05, Mn: 0.05, P: 0.01, S: 0.01, Cu: 0.02, Cr: 0.02, Ni: 0.02, feMetallic: 1, feTotal: 1 };

const round = (v, dp = 1) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ------------------------------------------------------------ AHP
function ahpCompute(judgements = settings.ahpJudgements) {
  const n = PILLAR_KEYS.length;
  const A = PILLAR_KEYS.map(() => PILLAR_KEYS.map(() => 1));
  PILLAR_KEYS.forEach((a, i) => PILLAR_KEYS.forEach((b, j) => {
    if (i >= j) return;
    const v = Number(judgements[`${a}:${b}`]) || 1;
    A[i][j] = v;
    A[j][i] = 1 / v;
  }));
  // Priority vector by the geometric-mean method.
  const gm = A.map((row) => row.reduce((p, x) => p * x, 1) ** (1 / n));
  const sum = gm.reduce((a, b) => a + b, 0);
  const w = gm.map((g) => g / sum);
  // Consistency: λmax, CI = (λmax − n)/(n − 1), CR = CI / RI.
  const Aw = A.map((row) => row.reduce((s, x, j) => s + x * w[j], 0));
  const lambdaMax = mean(Aw.map((v, i) => v / w[i]));
  const CI = (lambdaMax - n) / (n - 1);
  const CR = RANDOM_INDEX[n] ? CI / RANDOM_INDEX[n] : 0;
  return {
    pillars: PILLAR_KEYS.map((k, i) => ({ key: k, label: PILLARS[k].label, weight: round(w[i] * 100, 1) })),
    matrix: A.map((row) => row.map((x) => round(x, 3))),
    judgements: { ...judgements },
    lambdaMax: round(lambdaMax, 3),
    CI: round(CI, 4),
    RI: RANDOM_INDEX[n],
    CR: round(CR, 4),
    consistent: CR < 0.1,
    method: 'Geometric-mean priority vector; consistency ratio CR = CI ÷ RI must be below 0.10',
  };
}

function weightsFromAhp(ahp) {
  const out = {};
  ahp.pillars.forEach((p) => {
    Object.entries(WITHIN_PILLAR[p.key]).forEach(([c, share]) => { out[c] = Math.round(p.weight * share); });
  });
  return out;
}
settings.weights = weightsFromAhp(ahpCompute());

// ------------------------------------------------------------ store adapters
function allHeats() {
  if (store.heats?.list) return store.heats.list();
  return [];
}
function sessionsFor(lotId) {
  if (store.sessions?.list) return store.sessions.list(lotId) || [];
  return [];
}

// ------------------------------------------------------------ per-lot facts
function lotFacts(lot) {
  // A consumed lot is judged by the decision it had before it was used up.
  const status = lot.status === 'CONSUMED' ? (lot.previousStatus || 'RELEASED') : lot.status;
  const decided = !['AWAITING_QA', 'PROVISIONAL'].includes(status);
  let acceptance = null;
  if (decided) {
    if (status === 'RELEASED') acceptance = 1;
    else if (status === 'RESTRICTED') acceptance = 0.5;
    else acceptance = 0; // QUARANTINED, REJECTED
  }

  // Declaration accuracy: declared vs tested (lab), per element.
  let accuracy = null;
  const accuracyDetail = [];
  if (lot.declared && lot.tested && lot.chemistrySource === 'LAB') {
    const errs = [];
    ACCURACY_ELEMENTS.forEach((el) => {
      const d = Number(lot.declared[el]);
      const t = Number(lot.tested[el]);
      if (!Number.isFinite(d) || !Number.isFinite(t)) return;
      const rel = Math.abs(d - t) / Math.max(Math.abs(t), ACCURACY_FLOOR[el] || 0.05);
      errs.push(Math.min(rel, 1));
      accuracyDetail.push({ element: el, declared: d, tested: t, errorPct: round(rel * 100, 1) });
    });
    if (errs.length) accuracy = Math.max(0, 1 - mean(errs));
  }

  // Contamination from the handheld gun (latest session).
  let contamination = null;
  let gun = null;
  const last = sessionsFor(lot.lotId)[0] || null;
  if (last?.evidence?.piecesTested) {
    const e = last.evidence;
    const flagged = (e.cuHigh || 0) + (e.stainless || 0) + (e.alloySteel || 0);
    contamination = Math.max(0, 1 - flagged / e.piecesTested);
    gun = { piecesTested: e.piecesTested, flagged, surfaceBad: e.piecesTested - (e.reliable ?? e.piecesTested) };
  }

  // Yield: actual metal yield vs the nominal yield of its material type.
  let yieldRatio = null;
  let yieldPct = null;
  try {
    const chem = lotChemistry(lot);
    yieldPct = chem.yield * 100;
    const nominal = nominalYield(lot.materialType);
    yieldRatio = Math.max(0, Math.min(1, 1 - (Math.max(0, nominal - chem.yield) * 100 * YIELD_POINTS_PER_PCT) / 100));
  } catch { /* lot without chemistry */ }

  // Delivery: on time, and invoice weight vs weighbridge weight (received kg).
  let onTime = null;
  let lateDays = null;
  if (lot.promisedAt && lot.receivedAt) {
    lateDays = (new Date(lot.receivedAt) - new Date(lot.promisedAt)) / DAY;
    onTime = lateDays <= 0.5 ? 1 : 0;
  }
  let weightMatch = null;
  let shortPct = null;
  if (lot.invoiceKg && lot.receivedKg) {
    shortPct = ((lot.invoiceKg - lot.receivedKg) / lot.invoiceKg) * 100;
    // 0 % difference = 100 points, 5 % or more = 0 points.
    weightMatch = Math.max(0, 1 - Math.abs(shortPct) / 5);
  }

  // Service: documents that came with the truck.
  let documents = null;
  if (lot.docs) {
    const vals = Object.values(lot.docs);
    documents = vals.length ? vals.filter(Boolean).length / vals.length : null;
  }

  return { status, acceptance, accuracy, accuracyDetail, contamination, gun, yieldRatio, yieldPct, onTime, lateDays, weightMatch, shortPct, documents, decided };
}

// Heats that used each lot, and how the gate judged them.
function heatImpactByLot(asOf) {
  const map = {};
  allHeats().forEach((h) => {
    const decision = h.start?.gateDecision || h.gate?.decision;
    if (!decision) return;
    const at = h.start?.at || h.gate?.at || h.createdAt;
    if (asOf && at && new Date(at) > asOf) return;
    (h.charge || []).forEach((line) => {
      map[line.lotId] = map[line.lotId] || [];
      map[line.lotId].push({ heatId: h.heatId, decision, cancelled: h.status === 'CANCELLED', overridden: h.start?.mode === 'ENGINEER_OVERRIDE' });
    });
  });
  return map;
}

// Suppliers are compared within a rank group: the material type, and for
// ferro-alloys the alloy (FeSi is not comparable with recarburiser).
const rankGroup = (lot) => (lot.materialType === 'FERROALLOY' && lot.alloyName ? `FERROALLOY:${lot.alloyName}` : lot.materialType);
const groupLabel = (materialType, group) => (group.startsWith('FERROALLOY:') ? `Ferro-alloy — ${group.slice(11)}` : MATERIAL_TYPES[materialType]?.label || materialType);

// ------------------------------------------------------------ core scoring
function gradeOf(score, decidedLots) {
  if (decidedLots < settings.minLotsForGrade) {
    return { grade: 'NEW', gradeLabel: `New supplier (${decidedLots}/${settings.minLotsForGrade} lots decided)`, inspectPieces: settings.newSupplierInspectPieces };
  }
  const g = settings.grades.find((x) => score >= x.min) || settings.grades[settings.grades.length - 1];
  return { grade: g.grade, gradeLabel: g.label, inspectPieces: g.inspectPieces };
}

/**
 * Score every supplier. opts: { materialType, asOf (Date), windowDays }
 * Returns suppliers with `raw` (0–1 criterion values) still attached.
 */
function scoreSuppliers({ materialType, asOf, windowDays } = {}) {
  const until = asOf ? new Date(asOf) : null;
  const from = until && windowDays ? new Date(until.getTime() - windowDays * DAY) : null;
  const lots = store.listLots().filter((l) => {
    if (!l.supplier || /^in-house$/i.test(String(l.supplier).trim())) return false;
    if (materialType && l.materialType !== materialType) return false;
    const at = new Date(l.receivedAt);
    if (until && at > until) return false;
    if (from && at <= from) return false;
    return true;
  });
  const heatMap = heatImpactByLot(until);

  const groups = {};
  lots.forEach((lot) => {
    const group = rankGroup(lot);
    const key = `${group}::${lot.supplier.trim()}`;
    groups[key] = groups[key] || { supplier: lot.supplier.trim(), materialType: lot.materialType, group, lots: [] };
    groups[key].lots.push(lot);
  });

  const suppliers = Object.values(groups).map((g) => {
    const facts = g.lots.map((l) => ({ lot: l, f: lotFacts(l) }));
    const decided = facts.filter((x) => x.f.acceptance !== null);
    const kgTotal = g.lots.reduce((s, l) => s + (Number(l.receivedKg) || 0), 0);
    const pick = (k) => facts.map((x) => x.f[k]).filter((v) => v !== null && v !== undefined);

    const acceptance = mean(decided.map((x) => x.f.acceptance));
    const accuracy = mean(pick('accuracy'));
    const contamination = mean(pick('contamination'));
    const yieldRatio = mean(pick('yieldRatio'));
    const onTime = mean(pick('onTime'));
    const weightMatch = mean(pick('weightMatch'));
    const documents = mean(pick('documents'));

    // Heat impact: share of heats using this supplier that were WARN / HOLD.
    const heats = [];
    g.lots.forEach((l) => (heatMap[l.lotId] || []).forEach((h) => heats.push(h)));
    const uniqHeats = Object.values(Object.fromEntries(heats.map((h) => [h.heatId, h])));
    const holds = uniqHeats.filter((h) => h.decision === 'HOLD').length;
    const warns = uniqHeats.filter((h) => h.decision === 'WARN').length;
    const heatImpact = uniqHeats.length ? Math.max(0, 1 - (holds + 0.5 * warns) / uniqHeats.length) : null;

    // Effective cost: ₹ per tonne of GOOD metal.
    const priced = g.lots.filter((l) => Number(l.costPerKg) > 0);
    let effectiveRsPerT = null;
    let invoiceRsPerT = null;
    let costParts = null;
    if (priced.length) {
      const wKg = priced.reduce((s, l) => s + (Number(l.receivedKg) || 1), 0);
      invoiceRsPerT = (priced.reduce((s, l) => s + l.costPerKg * (Number(l.receivedKg) || 1), 0) / wKg) * 1000;
      const y = yieldRatio !== null ? mean(pick('yieldPct')) / 100 : nominalYield(g.materialType);
      const rejectShare = acceptance !== null ? 1 - acceptance : 0;
      effectiveRsPerT = invoiceRsPerT / Math.max(y, 0.3) + rejectShare * settings.rejectHandlingRsPerKg * 1000;
      costParts = {
        invoiceRsPerT: round(invoiceRsPerT, 0),
        yieldPct: round(y * 100, 1),
        yieldLossRsPerT: round(invoiceRsPerT / Math.max(y, 0.3) - invoiceRsPerT, 0),
        rejectSharePct: round(rejectShare * 100, 1),
        rejectPenaltyRsPerKg: settings.rejectHandlingRsPerKg,
        rejectCostRsPerT: round(rejectShare * settings.rejectHandlingRsPerKg * 1000, 0),
        effectiveRsPerT: round(effectiveRsPerT, 0),
      };
    }

    const statusCounts = facts.reduce((m, x) => ({ ...m, [x.f.status]: (m[x.f.status] || 0) + 1 }), {});
    const gunLots = facts.filter((x) => x.f.gun);
    const lateList = pick('lateDays');
    const shortList = pick('shortPct');
    const docLots = facts.filter((x) => x.lot.docs);
    const yList = pick('yieldPct');
    const evidence = {
      lotsTotal: g.lots.length,
      lotsDecided: decided.length,
      released: decided.filter((x) => x.f.acceptance === 1).length,
      restricted: decided.filter((x) => x.f.acceptance === 0.5).length,
      rejected: decided.filter((x) => x.f.acceptance === 0).length,
      labTestedLots: pick('accuracy').length,
      gunLots: gunLots.length,
      piecesTested: gunLots.reduce((a, x) => a + x.f.gun.piecesTested, 0),
      piecesFlagged: gunLots.reduce((a, x) => a + x.f.gun.flagged, 0),
      avgYieldPct: yList.length ? round(mean(yList), 1) : null,
      nominalYieldPct: round(nominalYield(g.materialType) * 100, 1),
      deliveryLots: lateList.length,
      lateLots: lateList.filter((d) => d > 0.5).length,
      avgLateDays: lateList.filter((d) => d > 0.5).length ? round(mean(lateList.filter((d) => d > 0.5)), 1) : 0,
      weighedLots: shortList.length,
      avgShortPct: shortList.length ? round(mean(shortList), 2) : null,
      shortKg: round(facts.reduce((s, x) => s + (x.lot.invoiceKg ? x.lot.invoiceKg - x.lot.receivedKg : 0), 0), 0),
      docLots: docLots.length,
      docsMissing: docLots.reduce((s, x) => s + Object.values(x.lot.docs).filter((v) => !v).length, 0),
      docsTotal: docLots.reduce((s, x) => s + Object.values(x.lot.docs).length, 0),
      heatsUsed: uniqHeats.length,
      heatsHold: holds,
      heatsWarn: warns,
      heatList: uniqHeats.map((h) => ({ heatId: h.heatId, decision: h.decision })),
    };
    const perLot = facts
      .sort((a, b) => new Date(b.lot.receivedAt) - new Date(a.lot.receivedAt))
      .map(({ lot, f }) => ({
        lotId: lot.lotId,
        status: f.status,
        consumed: lot.status === 'CONSUMED',
        history: !!lot.history,
        receivedAt: lot.receivedAt,
        receivedKg: lot.receivedKg,
        invoiceKg: lot.invoiceKg || null,
        costPerKg: lot.costPerKg ?? null,
        acceptance: f.acceptance === null ? null : round(f.acceptance * 100, 0),
        accuracy: f.accuracy === null ? null : round(f.accuracy * 100, 0),
        gun: f.gun,
        yieldPct: f.yieldPct === null ? null : round(f.yieldPct, 1),
        lateDays: f.lateDays === null ? null : round(Math.max(0, f.lateDays), 1),
        shortPct: f.shortPct === null ? null : round(f.shortPct, 2),
        docs: lot.docs || null,
        heats: (heatMap[lot.lotId] || []).map((h) => `${h.heatId} ${h.decision}`),
      }));
    return {
      supplier: g.supplier,
      materialType: g.materialType,
      group: g.group,
      materialLabel: groupLabel(g.materialType, g.group),
      lots: g.lots.length,
      decidedLots: decided.length,
      receivedKg: round(kgTotal, 0),
      statusCounts,
      raw: { acceptance, accuracy, contamination, heatImpact, yield: yieldRatio, onTime, weightMatch, documents },
      evidence,
      perLot,
      costBreakdown: costParts,
      invoiceRsPerT: round(invoiceRsPerT, 0),
      effectiveRsPerT: round(effectiveRsPerT, 0),
      heatsUsed: uniqHeats.length,
      heatsWarnOrHold: holds + warns,
      accuracyDetail: facts.flatMap((x) => x.f.accuracyDetail.map((d) => ({ lotId: x.lot.lotId, ...d }))),
      lotList: g.lots.map((l) => ({ lotId: l.lotId, status: l.status, receivedAt: l.receivedAt, receivedKg: l.receivedKg, costPerKg: l.costPerKg, statusReason: l.statusReason })),
    };
  });

  // Effective cost is relative: cheapest good metal in its material type = 100.
  const byType = {};
  suppliers.forEach((s) => { (byType[s.group] = byType[s.group] || []).push(s); });
  Object.values(byType).forEach((list) => {
    const costs = list.map((s) => s.effectiveRsPerT).filter((v) => v !== null);
    const min = Math.min(...costs);
    list.forEach((s) => {
      s.dearerPct = s.effectiveRsPerT === null ? null : round((s.effectiveRsPerT / min - 1) * 100, 1);
      s.raw.effectiveCost = s.effectiveRsPerT === null ? null : Math.max(0, 1 - (s.dearerPct * COST_POINTS_PER_PCT) / 100);
    });
  });

  // Weighted score over available criteria, and pillar scores.
  const allWeight = Object.values(settings.weights).reduce((a, b) => a + b, 0);
  suppliers.forEach((s) => {
    let wSum = 0;
    let total = 0;
    s.criteria = Object.entries(CRITERIA).map(([key, meta]) => {
      const v = s.raw[key];
      const w = settings.weights[key] || 0;
      if (v !== null && v !== undefined && w > 0) { wSum += w; total += w * v; }
      return { key, label: meta.label, pillar: meta.pillar, weight: w, score: v === null || v === undefined ? null : round(v * 100, 0) };
    });
    s.score = wSum > 0 ? round((total / wSum) * 100, 0) : null;
    s.criteria.forEach((c) => {
      c.weightShare = c.score === null || wSum === 0 || !c.weight ? 0 : round((c.weight / wSum) * 100, 1);
      c.points = c.score === null || wSum === 0 || !c.weight ? null : round((c.weight / wSum) * c.score, 1);
    });
    const e = s.evidence;
    const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;
    const how = {
      acceptance: { evidence: `${e.released} released, ${e.restricted} restricted, ${e.rejected} quarantined/rejected of ${e.lotsDecided} decided lots`, formula: '(released + 0.5 × restricted) ÷ decided lots' },
      accuracy: { evidence: e.labTestedLots ? `${e.labTestedLots} lab-tested lot(s), ${s.accuracyDetail.length} element comparisons` : 'No lab-tested lots yet', formula: '1 − average |declared − tested| ÷ tested (per element, capped at 100%)' },
      contamination: { evidence: e.piecesTested ? `${e.piecesFlagged} flagged of ${e.piecesTested} gun-tested pieces (${e.gunLots} lot(s))` : 'No gun inspections (not a scrap material)', formula: '1 − flagged pieces ÷ tested pieces (Cu-high, stainless, alloy)' },
      heatImpact: { evidence: e.heatsUsed ? `${e.heatsUsed} heat(s) used their lots: ${e.heatsHold} HOLD, ${e.heatsWarn} WARN` : 'Not used in any heat yet', formula: '1 − (HOLD + 0.5 × WARN) ÷ heats using their lots' },
      effectiveCost: { evidence: s.effectiveRsPerT !== null ? `${inr(s.effectiveRsPerT)}/t effective${s.dearerPct ? `, ${s.dearerPct}% dearer than the cheapest good metal` : ' — cheapest good metal'} in ${s.materialLabel}` : 'No prices recorded', formula: `1 − ${COST_POINTS_PER_PCT} × (% dearer than the cheapest effective ₹/t) ÷ 100` },
      yield: { evidence: e.avgYieldPct !== null ? `${e.avgYieldPct}% metal yield vs ${e.nominalYieldPct}% nominal` : 'No yield data', formula: `1 − ${YIELD_POINTS_PER_PCT} × (% points below nominal yield) ÷ 100` },
      onTime: { evidence: e.deliveryLots ? `${e.deliveryLots - e.lateLots} of ${e.deliveryLots} trucks on time${e.lateLots ? `; late ones ${e.avgLateDays} days on average` : ''}` : 'No promised dates recorded', formula: 'trucks received on or before the promised date ÷ trucks' },
      weightMatch: { evidence: e.weighedLots ? `invoice weight ${e.avgShortPct}% above weighbridge on average (${Number(e.shortKg).toLocaleString('en-IN')} kg short in total)` : 'No invoice weights recorded', formula: '1 − |invoice kg − weighbridge kg| ÷ invoice kg ÷ 5% (5% short = 0)' },
      documents: { evidence: e.docsTotal ? `${e.docsTotal - e.docsMissing} of ${e.docsTotal} documents received (test certificate, weighbridge slip, e-way bill)` : 'No document records', formula: 'documents received ÷ documents required' },
    };
    s.criteria.forEach((c) => Object.assign(c, how[c.key]));
    s.pillars = PILLAR_KEYS.map((pk) => {
      const cs = s.criteria.filter((c) => c.pillar === pk && c.score !== null && c.weight > 0);
      const pw = cs.reduce((a, c) => a + c.weight, 0);
      const fullW = Object.keys(WITHIN_PILLAR[pk]).reduce((a, c) => a + (settings.weights[c] || 0), 0);
      return {
        key: pk,
        label: PILLARS[pk].label,
        score: pw ? round(cs.reduce((a, c) => a + c.weight * c.score, 0) / pw, 0) : null,
        weight: fullW,
        weightPct: allWeight ? round((fullW / allWeight) * 100, 1) : 0,
        points: round(cs.reduce((a, c) => a + (c.points || 0), 0), 1),
      };
    });
    s.coverage = round((wSum / allWeight) * 100, 0);
    Object.assign(s, gradeOf(s.score, s.decidedLots));
  });

  // Rank within each material type — overall and per pillar.
  Object.values(byType).forEach((list) => {
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    list.forEach((s, i) => { s.rank = i + 1; s.rankOf = list.length; });
    PILLAR_KEYS.forEach((pk) => {
      const sorted = [...list].sort((a, b) => (b.pillars.find((p) => p.key === pk).score ?? -1) - (a.pillars.find((p) => p.key === pk).score ?? -1));
      sorted.forEach((s, i) => { const p = s.pillars.find((x) => x.key === pk); p.rank = p.score === null ? null : i + 1; });
    });
  });
  return { suppliers, byType };
}

// ------------------------------------------------------------ rank explanation
function explainRanks(byType) {
  Object.values(byType).forEach((list) => {
    list.forEach((s, i) => {
      const other = i > 0 ? list[i - 1] : list[i + 1];
      if (!other || s.score === null || other.score === null) {
        s.rankReason = list.length === 1 ? `Only supplier of ${s.materialLabel} so far.` : null;
        return;
      }
      const diffs = s.criteria
        .map((c) => {
          const o = other.criteria.find((x) => x.key === c.key);
          return c.points === null || o?.points === null || o?.points === undefined ? null : { label: c.label, pillar: c.pillar, delta: round(c.points - o.points, 1) };
        })
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const gap = round(s.score - other.score, 0);
      s.rankVs = { supplier: other.supplier, rank: other.rank, score: other.score, gap, diffs };
      const nonZero = diffs.filter((d) => Math.abs(d.delta) >= 0.1);
      const top = nonZero.length
        ? `Biggest differences: ${nonZero.slice(0, 2).map((d) => `${d.label} (${d.delta > 0 ? '+' : ''}${d.delta} pts)`).join(' and ')}.`
        : 'Equal on every criterion with data.';
      s.rankReason = i === 0
        ? `Ranked #1, ${gap} points ahead of ${other.supplier}. ${top}`
        : `Ranked #${s.rank}, ${Math.abs(gap)} points behind ${other.supplier}. ${top}`;
    });
  });
}

// ------------------------------------------------------------ TOPSIS
/**
 * TOPSIS (Technique for Order Preference by Similarity to Ideal Solution).
 * Each supplier is a point in criteria space; rank by closeness to the ideal
 * supplier (best value on every criterion) vs the anti-ideal (worst on every).
 * All criteria are "higher is better" (cost is already inverted to a 0–1 score).
 */
function topsis(list) {
  const keys = Object.keys(CRITERIA).filter((k) => (settings.weights[k] || 0) > 0 && list.some((s) => s.raw[k] !== null && s.raw[k] !== undefined));
  if (list.length < 2 || !keys.length) {
    list.forEach((s) => { s.topsis = null; });
    return null;
  }
  // Missing value → average of the others (neutral: neither helps nor hurts).
  const col = {};
  keys.forEach((k) => {
    const vals = list.map((s) => s.raw[k]).filter((v) => v !== null && v !== undefined);
    const avg = mean(vals);
    col[k] = list.map((s) => (s.raw[k] === null || s.raw[k] === undefined ? avg : s.raw[k]));
  });
  const wTot = keys.reduce((a, k) => a + settings.weights[k], 0);
  const weighted = {};
  keys.forEach((k) => {
    const norm = Math.sqrt(col[k].reduce((a, v) => a + v * v, 0)) || 1;
    weighted[k] = col[k].map((v) => (v / norm) * (settings.weights[k] / wTot));
  });
  const best = Object.fromEntries(keys.map((k) => [k, Math.max(...weighted[k])]));
  const worst = Object.fromEntries(keys.map((k) => [k, Math.min(...weighted[k])]));
  list.forEach((s, i) => {
    const dPlus = Math.sqrt(keys.reduce((a, k) => a + (weighted[k][i] - best[k]) ** 2, 0));
    const dMinus = Math.sqrt(keys.reduce((a, k) => a + (weighted[k][i] - worst[k]) ** 2, 0));
    const c = dPlus + dMinus === 0 ? 1 : dMinus / (dPlus + dMinus);
    s.topsis = { closeness: round(c, 3), dPlus: round(dPlus, 4), dMinus: round(dMinus, 4) };
  });
  [...list].sort((a, b) => b.topsis.closeness - a.topsis.closeness).forEach((s, i) => { s.topsis.rank = i + 1; });

  // Agreement between the weighted score and TOPSIS: Spearman rank correlation.
  const n = list.length;
  const d2 = list.reduce((a, s) => a + (s.rank - s.topsis.rank) ** 2, 0);
  const rho = n > 1 ? 1 - (6 * d2) / (n * (n * n - 1)) : 1;
  const top = list.find((s) => s.rank === 1);
  const topT = list.find((s) => s.topsis.rank === 1);
  return {
    materialType: list[0].materialType,
    materialLabel: list[0].materialLabel,
    criteriaUsed: keys.map((k) => CRITERIA[k].label),
    spearmanRho: round(rho, 2),
    sameTop: top?.supplier === topT?.supplier,
    weightedTop: top?.supplier,
    topsisTop: topT?.supplier,
    verdict: top?.supplier === topT?.supplier
      ? (rho >= 0.8 ? 'Both methods agree on the ranking.' : 'Both methods pick the same #1; lower places differ slightly.')
      : `The methods disagree on #1 (${top?.supplier} vs ${topT?.supplier}) — the top two are close; check the pillar scores.`,
  };
}

// ------------------------------------------------------------ trend + alerts
function trendSeries(materialType) {
  const now = new Date();
  const points = [];
  for (let i = settings.trendPoints - 1; i >= 0; i--) {
    const asOf = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const { suppliers } = scoreSuppliers({ materialType, asOf, windowDays: settings.scoreWindowDays });
    points.push({ label: i === 0 ? 'Now' : `${MONTH[asOf.getMonth()]}`, asOf, suppliers });
  }
  return points;
}

function attachTrends(suppliers, materialType) {
  const series = trendSeries(materialType);
  const alerts = [];
  suppliers.forEach((s) => {
    s.trend = series.map((p) => {
      const x = p.suppliers.find((q) => q.supplier === s.supplier && q.group === s.group);
      return { label: p.label, score: x?.score ?? null, grade: x ? x.grade : null, lots: x?.lots ?? 0 };
    });
    const graded = s.trend.filter((t) => t.score !== null && t.grade !== 'NEW');
    const last = graded[graded.length - 1];
    const prev = graded[graded.length - 2];
    const first = graded[0];
    s.trendDelta = last && first && last !== first ? round(last.score - first.score, 0) : 0;
    s.trendDirection = s.trendDelta >= 5 ? 'improving' : s.trendDelta <= -5 ? 'declining' : 'stable';

    const tag = `${s.supplier} (${s.materialLabel})`;
    const order = { A: 4, B: 3, C: 2, D: 1 };
    if (last && prev && order[last.grade] < order[prev.grade]) {
      alerts.push({ level: 'error', supplier: s.supplier, materialType: s.materialType, kind: 'GRADE_DROP', text: `${tag} dropped from grade ${prev.grade} to ${last.grade} (score ${prev.score} → ${last.score}).` });
    } else if (last && prev && order[last.grade] > order[prev.grade]) {
      alerts.push({ level: 'success', supplier: s.supplier, materialType: s.materialType, kind: 'GRADE_UP', text: `${tag} moved up from grade ${prev.grade} to ${last.grade}.` });
    }
    if (s.trendDirection === 'declining' && !alerts.some((a) => a.supplier === s.supplier && a.kind === 'GRADE_DROP')) {
      alerts.push({ level: 'warning', supplier: s.supplier, materialType: s.materialType, kind: 'DECLINING', text: `${tag} is declining: ${s.trendDelta} points over ${graded.length} months. Talk to the supplier before the next order.` });
    }
    if (s.trendDirection === 'improving' && !alerts.some((a) => a.supplier === s.supplier && a.kind === 'GRADE_UP')) {
      alerts.push({ level: 'success', supplier: s.supplier, materialType: s.materialType, kind: 'IMPROVING', text: `${tag} is improving: +${s.trendDelta} points over ${graded.length} months.` });
    }
    if (s.grade === 'D') {
      alerts.push({ level: 'error', supplier: s.supplier, materialType: s.materialType, kind: 'BLOCKED', text: `${tag} is grade D — new lots need manager approval before release, and 30 pieces are inspected per lot.` });
    }
    // Hidden cost: the gap between invoice and effective cost is much bigger than the best peer's.
    const premium = (x) => (x.effectiveRsPerT && x.invoiceRsPerT ? x.effectiveRsPerT / x.invoiceRsPerT - 1 : null);
    const peers = suppliers.filter((q) => q.group === s.group && premium(q) !== null);
    const bestPremium = peers.length ? Math.min(...peers.map(premium)) : null;
    if (premium(s) !== null && bestPremium !== null && premium(s) - bestPremium >= 0.08) {
      alerts.push({ level: 'warning', supplier: s.supplier, materialType: s.materialType, kind: 'HIDDEN_COST', text: `${tag}: cheap on the invoice (₹${s.invoiceRsPerT.toLocaleString('en-IN')}/t) but good metal costs ₹${s.effectiveRsPerT.toLocaleString('en-IN')}/t — ${Math.round(premium(s) * 100)}% above invoice, against ${Math.round(bestPremium * 100)}% for the best peer.` });
    }
  });
  const rank = { error: 0, warning: 1, success: 2, info: 3 };
  alerts.sort((a, b) => rank[a.level] - rank[b.level]);
  return { alerts, trendLabels: series.map((p) => p.label) };
}

// ------------------------------------------------------------ public API
function computeScorecard({ materialType, withTrend = true } = {}) {
  const { suppliers, byType } = scoreSuppliers({ materialType, asOf: new Date(), windowDays: settings.scoreWindowDays });
  explainRanks(byType);
  const methods = Object.values(byType).map((list) => topsis(list)).filter(Boolean);
  const trend = withTrend ? attachTrends(suppliers, materialType) : { alerts: [], trendLabels: [] };
  suppliers.forEach((s) => { delete s.raw; });
  suppliers.sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
  const ahp = ahpCompute();
  return {
    generatedAt: new Date(),
    framework: 'QCDS — Quality, Cost, Delivery, Service',
    pillars: PILLAR_KEYS.map((k) => ({
      key: k,
      label: PILLARS[k].label,
      color: PILLARS[k].color,
      weight: Object.keys(WITHIN_PILLAR[k]).reduce((a, c) => a + (settings.weights[c] || 0), 0),
      criteria: Object.keys(WITHIN_PILLAR[k]).map((c) => ({ key: c, label: CRITERIA[c].label, weight: settings.weights[c] || 0 })),
    })),
    criteria: Object.entries(CRITERIA).map(([key, m]) => ({ key, label: m.label, pillar: m.pillar, weight: settings.weights[key] || 0 })),
    weights: settings.weights,
    weightsSource: settings.weightsSource,
    ahp,
    methods,
    grades: settings.grades,
    alerts: trend.alerts,
    trendLabels: trend.trendLabels,
    scoreWindowDays: settings.scoreWindowDays,
    suppliers,
  };
}

function supplierDetail(name, materialType) {
  const card = computeScorecard({ materialType });
  return card.suppliers.find((s) => s.supplier.toLowerCase() === String(name).toLowerCase()) || null;
}

/** Grade of every supplier (fast — no trend). Key: `${materialType}::${supplier}`. */
function gradeIndex() {
  const { suppliers } = scoreSuppliers({ asOf: new Date(), windowDays: settings.scoreWindowDays });
  return Object.fromEntries(suppliers.map((s) => [`${s.group}::${s.supplier}`, { grade: s.grade, gradeLabel: s.gradeLabel, score: s.score, inspectPieces: s.inspectPieces, rank: s.rank, rankOf: s.rankOf }]));
}

/** Grade of the supplier behind a lot — sets inspection intensity and release approval. */
function gradeForLot(lot, index) {
  if (!lot?.supplier || /^in-house$/i.test(String(lot.supplier).trim())) return null;
  const idx = index || gradeIndex();
  return idx[`${rankGroup(lot)}::${lot.supplier.trim()}`]
    || { grade: 'NEW', gradeLabel: 'New supplier (no decided lots yet)', score: null, inspectPieces: settings.newSupplierInspectPieces };
}

/** Best-ranked supplier for a material / alloy — used by inventory reorder. */
function bestSupplierFor(materialType, alloyName) {
  const list = computeScorecard({ materialType, withTrend: false }).suppliers;
  const filtered = alloyName
    ? list.filter((s) => store.listLots().some((l) => l.supplier?.trim() === s.supplier && l.alloyName === alloyName))
    : list;
  return filtered.find((s) => s.grade !== 'D') || null;
}

/**
 * Order split: turn the ranking into a buying decision.
 * Grade D is excluded, C is capped (probation), NEW gets a small trial share,
 * no supplier gets more than maxSharePct (avoid single-source risk).
 * Compared with buying everything from the lowest invoice price.
 */
function orderPlan(materialType, tonnes = 50) {
  if (!materialType) throw Object.assign(new Error('materialType is required'), { status: 400 });
  const t = Number(tonnes) > 0 ? Number(tonnes) : 50;
  const o = settings.order;
  const list = computeScorecard({ materialType, withTrend: false }).suppliers.filter((s) => s.effectiveRsPerT);
  if (!list.length) return { materialType, tonnes: t, lines: [], note: 'No priced suppliers for this material yet.' };

  const eligible = list.filter((s) => s.grade !== 'D');
  const cap = (s) => (s.grade === 'NEW' ? o.newMaxPct : s.grade === 'C' ? o.conditionalMaxPct : o.maxSharePct);
  const pull = (s) => Math.max(1, (s.score ?? 50) - 40) ** 2;

  // Water-filling: share ∝ (score − 40)², capped per supplier, surplus redistributed.
  const share = Object.fromEntries(eligible.map((s) => [s.supplier, 0]));
  let open = [...eligible];
  let left = 100;
  for (let guard = 0; guard < 10 && left > 0.01 && open.length; guard++) {
    const tot = open.reduce((a, s) => a + pull(s), 0);
    const next = [];
    let used = 0;
    open.forEach((s) => {
      const want = (left * pull(s)) / tot;
      const room = cap(s) - share[s.supplier];
      const give = Math.min(want, room);
      share[s.supplier] += give;
      used += give;
      if (room - give > 0.01) next.push(s);
    });
    left -= used;
    open = next;
  }
  // Round to the step; drop shares below the minimum; put the remainder on #1.
  Object.keys(share).forEach((k) => {
    share[k] = Math.round(share[k] / o.stepPct) * o.stepPct;
    if (share[k] < o.minSharePct && eligible.find((s) => s.supplier === k)?.grade !== 'NEW') share[k] = 0;
  });
  const sum = Object.values(share).reduce((a, b) => a + b, 0);
  const top = eligible[0];
  if (top && sum !== 100) share[top.supplier] += 100 - sum;

  const ordered = eligible.filter((s) => share[s.supplier] > 0).sort((a, b) => a.rank - b.rank);
  const lines = list.map((s) => {
    const pct = share[s.supplier] || 0;
    const pos = ordered.indexOf(s);
    const reason = s.grade === 'D' ? 'Grade D — blocked until quality improves'
      : pct === 0 ? 'Score too low for a share of this order'
        : s.grade === 'NEW' ? `New supplier — trial order (max ${o.newMaxPct}%)`
          : s.grade === 'C' ? `Grade C — on probation (max ${o.conditionalMaxPct}%)`
            : pos === 0 ? (pct >= o.maxSharePct ? `Best score — capped at ${o.maxSharePct}% to avoid depending on one supplier` : 'Best score — largest share')
              : `Grade ${s.grade} — ${pos === 1 ? 'second' : 'third'} source`;
    return {
      supplier: s.supplier, grade: s.grade, score: s.score, rank: s.rank,
      sharePct: pct, tonnes: round((t * pct) / 100, 1),
      invoiceRsPerT: s.invoiceRsPerT, effectiveRsPerT: s.effectiveRsPerT,
      invoiceRs: round(((t * pct) / 100) * s.invoiceRsPerT, 0),
      effectiveRs: round(((t * pct) / 100) * s.effectiveRsPerT, 0),
      reason,
    };
  });
  const plan = lines.reduce((a, l) => ({ invoice: a.invoice + l.invoiceRs, effective: a.effective + l.effectiveRs }), { invoice: 0, effective: 0 });
  const cheapest = [...list].sort((a, b) => a.invoiceRsPerT - b.invoiceRsPerT)[0];
  const priceOnly = { supplier: cheapest.supplier, grade: cheapest.grade, invoiceRs: round(cheapest.invoiceRsPerT * t, 0), effectiveRs: round(cheapest.effectiveRsPerT * t, 0) };
  return {
    materialType,
    materialLabel: list[0].materialLabel,
    tonnes: t,
    rules: o,
    lines: lines.sort((a, b) => b.sharePct - a.sharePct || a.rank - b.rank),
    plan: { invoiceRs: round(plan.invoice, 0), effectiveRs: round(plan.effective, 0), effectiveRsPerT: round(plan.effective / t, 0) },
    priceOnly,
    savingRs: round(priceOnly.effectiveRs - plan.effective, 0),
    explanation: `Buying all ${t} t from the lowest invoice price (${cheapest.supplier}) looks ₹${Math.round(plan.invoice - priceOnly.invoiceRs).toLocaleString('en-IN')} cheaper on paper, but costs ₹${Math.round(priceOnly.effectiveRs - plan.effective).toLocaleString('en-IN')} more in good metal once yield loss and rejections are counted.`,
  };
}

function updateWeights(patch = {}) {
  let changed = false;
  Object.entries(patch).forEach(([k, v]) => {
    if (k in settings.weights && Number(v) >= 0) { settings.weights[k] = Number(v); changed = true; }
  });
  if (changed) settings.weightsSource = 'MANUAL';
  return settings.weights;
}

function getAhp() {
  const ahp = ahpCompute();
  return { ...ahp, withinPillar: WITHIN_PILLAR, criteriaWeights: weightsFromAhp(ahp), currentWeights: settings.weights, weightsSource: settings.weightsSource };
}

/** Save new AHP judgements; apply=true also re-weights the criteria (only if consistent). */
function updateAhp({ judgements = {}, apply = true } = {}) {
  const next = { ...settings.ahpJudgements };
  Object.entries(judgements).forEach(([k, v]) => {
    const n = Number(v);
    if (k in next && n >= 1 / 9 && n <= 9) next[k] = n;
  });
  const ahp = ahpCompute(next);
  if (!ahp.consistent && apply) {
    throw Object.assign(new Error(`Judgements are inconsistent (CR ${ahp.CR} ≥ 0.10). Adjust them so they do not contradict each other.`), { status: 400, ahp });
  }
  settings.ahpJudgements = next;
  if (apply) { settings.weights = weightsFromAhp(ahp); settings.weightsSource = 'AHP'; }
  return getAhp();
}

module.exports = {
  computeScorecard, supplierDetail, gradeForLot, gradeIndex, bestSupplierFor, orderPlan,
  updateWeights, getAhp, updateAhp, ahpCompute, settings, CRITERIA, PILLARS,
};
