/**
 * Supplier history — six months of past deliveries for the demo.
 *
 * The Supplier Scorecard needs a track record to rank on: a handful of lots
 * per supplier is not enough to separate a good supplier from a lucky one.
 * This module seeds ~6 months of past lots, gun sessions, DRI lab results and
 * completed heats (with gate decisions and meter readings), all generated from
 * a fixed random seed so the demo gives the same ranking every time.
 *
 * Every record is marked `history: true` so the operator screens (stock list,
 * heat list) can hide it, while the Scorecard and Energy pages use it.
 */

const DAY = 24 * 3600 * 1000;

// ------------------------------------------------------------ deterministic random
function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ supplier profiles
// pRel / pRes: chance a lot is released / restricted (the rest is rejected).
// trend: change in pRel per month (+ improving, − declining).
// accErr: how far declared chemistry is from tested (fraction).
// onTime: share of trucks on or before the promised date.
// shortPct: typical invoice-vs-weighbridge shortfall.
// docs: chance each document (test certificate, weighbridge slip, e-way bill) comes with the truck.
const PROFILES = [
  // Steel scrap
  { supplier: 'Sri Balaji Scrap Traders', materialType: 'STEEL_SCRAP', price: 36, pRel: 0.9, pRes: 0.08, trend: 0, rust: 0.05, accErr: 0.05, onTime: 0.93, shortPct: 0.004, docs: 0.96, yield: 0.955, reject: 'copper', truck: 'TN 38 BK' },
  { supplier: 'Erode Steel Recyclers', materialType: 'STEEL_SCRAP', price: 35, pRel: 0.55, pRes: 0.25, trend: 0.07, rust: 0.1, accErr: 0.1, onTime: 0.85, shortPct: 0.01, docs: 0.85, yield: 0.945, reject: 'copper', truck: 'TN 33 EF' },
  { supplier: 'Coimbatore Metal Recyclers', materialType: 'STEEL_SCRAP', price: 33, pRel: 0.62, pRes: 0.2, trend: -0.07, rust: 0.2, accErr: 0.2, onTime: 0.7, shortPct: 0.025, docs: 0.7, yield: 0.925, reject: 'copper', truck: 'TN 37 CY' },
  { supplier: 'Pollachi Steel Scrap', materialType: 'STEEL_SCRAP', price: 34, pRel: 0.35, pRes: 0.15, trend: -0.06, rust: 0.24, accErr: 0.35, onTime: 0.5, shortPct: 0.035, docs: 0.5, yield: 0.92, reject: 'stainless', truck: 'TN 41 AL' },
  // Cast iron scrap
  { supplier: 'Madurai Cast Scrap Co.', materialType: 'CI_SCRAP', price: 36, pRel: 0.88, pRes: 0.1, trend: 0, rust: 0.08, accErr: 0.07, onTime: 0.9, shortPct: 0.006, docs: 0.9, yield: 0.935, reject: 'alloy', truck: 'TN 59 MC' },
  { supplier: 'Tiruppur Castings Scrap', materialType: 'CI_SCRAP', price: 34, pRel: 0.5, pRes: 0.3, trend: 0.04, rust: 0.27, accErr: 0.15, onTime: 0.8, shortPct: 0.015, docs: 0.75, yield: 0.915, reject: 'alloy', truck: 'TN 39 BZ' },
  // Sponge iron (DRI): quality comes from the lab result, not from a probability.
  { supplier: 'Karur Metallics', materialType: 'DRI', price: 29.5, declFeM: 83.5, metDrop: 0.4, moisture: 0.25, fines: 2.5, onTime: 0.92, shortPct: 0.005, docs: 0.95, truck: 'TN 47 KM' },
  { supplier: 'Trichy Iron & Alloys', materialType: 'DRI', price: 28, declFeM: 82, metDrop: 0.8, moisture: 0.4, fines: 3, onTime: 0.85, shortPct: 0.008, docs: 0.9, truck: 'TN 45 AF' },
  { supplier: 'Salem Sponge Iron Works', materialType: 'DRI', price: 26, declFeM: 83, metDrop: 7.5, moisture: 1.6, fines: 7, onTime: 0.72, shortPct: 0.02, docs: 0.65, truck: 'TN 30 SS' },
  // Pig iron
  { supplier: 'Kovai Pig Iron Co.', materialType: 'PIG_IRON', price: 50, pRel: 0.96, pRes: 0.04, trend: 0, accErr: 0.04, onTime: 0.94, shortPct: 0.003, docs: 0.97, yield: 0.97, truck: 'TN 66 KP' },
  { supplier: 'Hosur Pig Iron Traders', materialType: 'PIG_IRON', price: 47.5, pRel: 0.65, pRes: 0.25, trend: 0, accErr: 0.2, onTime: 0.62, shortPct: 0.012, docs: 0.8, yield: 0.96, truck: 'TN 70 HP' },
];

// Ferro-alloy suppliers: two per alloy, so each alloy has a ranking.
const FERRO_PROFILES = [
  { supplier: 'Nava Bharat Ferro Alloys', alloyName: 'FeSi-75', price: 105, pRel: 0.95, accErr: 0.01, onTime: 0.93, shortPct: 0.003, docs: 0.96, yield: 0.9, truck: 'TS 07 NB' },
  { supplier: 'Coastal Ferro Alloys', alloyName: 'FeSi-75', price: 101, pRel: 0.8, accErr: 0.03, onTime: 0.75, shortPct: 0.01, docs: 0.8, yield: 0.88, truck: 'AP 05 CF' },
  { supplier: 'Maithan Alloys', alloyName: 'HC FeMn', price: 78, pRel: 0.95, accErr: 0.015, onTime: 0.9, shortPct: 0.004, docs: 0.95, yield: 0.9, truck: 'WB 23 MA' },
  { supplier: 'Deccan Manganese Alloys', alloyName: 'HC FeMn', price: 74, pRel: 0.75, accErr: 0.04, onTime: 0.7, shortPct: 0.012, docs: 0.75, yield: 0.87, truck: 'KA 19 DM' },
  { supplier: 'Goa Carbon', alloyName: 'Recarburiser', price: 65, pRel: 0.95, accErr: 0.01, onTime: 0.92, shortPct: 0.004, docs: 0.95, yield: 0.9, truck: 'GA 03 GC' },
  { supplier: 'Southern Carbon Products', alloyName: 'Recarburiser', price: 62, pRel: 0.8, accErr: 0.03, onTime: 0.8, shortPct: 0.01, docs: 0.8, yield: 0.88, truck: 'TN 22 SC' },
];
const FERRO_DECLARED = {
  'FeSi-75': { C: 0.1, Si: 75, Mn: 0.3, P: 0.03, S: 0.01 },
  'HC FeMn': { C: 6.8, Si: 1.0, Mn: 70, P: 0.25, S: 0.02 },
  Recarburiser: { C: 98.5, S: 0.4 },
};
const FERRO_DESCRIPTION = { 'FeSi-75': 'Ferrosilicon 75% (10–50 mm)', 'HC FeMn': 'High-carbon ferromanganese', Recarburiser: 'Calcined petroleum coke recarburiser' };
// Typical daily use in the melt shop: heats per day × kg per heat (and the share of heats that need it).
const FERRO_USE = { 'FeSi-75': { perHeat: 9, sd: 2.5, share: 1 }, 'HC FeMn': { perHeat: 4, sd: 1.5, share: 0.7 }, Recarburiser: { perHeat: 7, sd: 2.5, share: 0.6 } };

const DECLARED = {
  STEEL_SCRAP: { C: 0.15, Si: 0.15, Mn: 0.5, P: 0.025, S: 0.025, Cu: 0.12, Cr: 0.07, Ni: 0.05, Mo: 0.015, Sn: 0.01 },
  CI_SCRAP: { C: 3.3, Si: 2.0, Mn: 0.6, P: 0.1, S: 0.08, Cu: 0.2, Cr: 0.1, Ni: 0.05, Mo: 0.02, Sn: 0.02 },
  PIG_IRON: { C: 4.1, Si: 1.1, Mn: 0.08, P: 0.035, S: 0.015, Cu: 0.01, Cr: 0.02, Ni: 0.02, Mo: 0.005, Sn: 0.002 },
};
const DESCRIPTION = {
  STEEL_SCRAP: ['HMS 1&2 heavy melting scrap', 'CRCA bundles', 'Shredded steel scrap', 'Plate and structural cuttings'],
  CI_SCRAP: ['Grey iron machine castings', 'Cast iron borings (briquetted)', 'Broken castings'],
  PIG_IRON: ['Foundry-grade pig iron', 'SG-grade pig iron (low Mn, low P)'],
  DRI: ['Coal-based sponge iron lumps'],
};
const KG_RANGE = { STEEL_SCRAP: [5000, 9000], CI_SCRAP: [3000, 5000], PIG_IRON: [3000, 5000], DRI: [3000, 4000] };
const PREFIX = { STEEL_SCRAP: 'SCR', CI_SCRAP: 'CIS', PIG_IRON: 'PIG', DRI: 'DRI' };
const RECIPE = {
  'SG-IRON': { PIG_IRON: 0.4, STEEL_SCRAP: 0.35, DRI: 0.15, CI_SCRAP: 0.1 },
  'GREY-IRON': { CI_SCRAP: 0.5, STEEL_SCRAP: 0.3, PIG_IRON: 0.2 },
  'LOW-CARBON-STEEL': { STEEL_SCRAP: 0.7, DRI: 0.3 },
};
const GRADE_ROTATION = ['SG-IRON', 'SG-IRON', 'GREY-IRON', 'SG-IRON', 'LOW-CARBON-STEEL', 'GREY-IRON'];

const r2 = (v, dp = 3) => Math.round(v * 10 ** dp) / 10 ** dp;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Delivery + document fields for any lot, from its supplier's habits. */
function deliveryFields(profile, receivedAt, receivedKg, rand) {
  const onTime = rand() < (profile?.onTime ?? 0.85);
  const promisedAt = onTime
    ? new Date(receivedAt.getTime() + Math.floor(rand() * 3) * DAY)
    : new Date(receivedAt.getTime() - (1 + Math.floor(rand() * 5)) * DAY);
  const short = (profile?.shortPct ?? 0.01) * (0.3 + rand() * 1.4);
  const invoiceKg = Math.round((receivedKg * (1 + short)) / 10) * 10;
  const p = profile?.docs ?? 0.85;
  const docs = { testCertificate: rand() < p, weighbridgeSlip: rand() < Math.min(1, p + 0.08), ewayBill: rand() < Math.min(1, p + 0.05) };
  return { promisedAt, invoiceKg, docs };
}

/**
 * Seed history into the store's internal collections.
 * api: { addLot, lots, movements, qaResults, gunSessions, heats, counters, nextId }
 */
function seedHistory(api) {
  const rand = mulberry32(20260925);
  const gauss = () => { const u = Math.max(rand(), 1e-9); const v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const now = Date.now();
  const lotNo = { STEEL_SCRAP: 700, CI_SCRAP: 700, PIG_IRON: 700, DRI: 700 };
  const historyLots = [];

  PROFILES.forEach((pf) => {
    const nLots = 7;
    for (let i = 0; i < nLots; i++) {
      const daysAgo = 185 - i * 25 - rand() * 8;
      const receivedAt = new Date(now - daysAgo * DAY);
      const monthsAgo = daysAgo / 30;
      const [lo, hi] = KG_RANGE[pf.materialType];
      const receivedKg = Math.round((lo + rand() * (hi - lo)) / 10) * 10;
      const price = r2(pf.price * (1 + 0.03 * (6 - monthsAgo) / 6) + (rand() - 0.5) * 0.8, 1);
      const lotId = `${PREFIX[pf.materialType]}-0${++lotNo[pf.materialType]}`;
      const delivery = deliveryFields(pf, receivedAt, receivedKg, rand);

      let declared;
      let tested = null;
      let status;
      let statusReason;
      let restriction = null;
      let yieldOverride;
      let qa = null;
      let session = null;

      if (pf.materialType === 'DRI') {
        declared = { feTotal: 91, feMetallic: pf.declFeM, C: 0.15, P: 0.045, S: 0.018, SiO2: 5, Al2O3: 2.5, fines: 3 };
        const feT = r2(90.8 - rand() * 1.2 - (pf.metDrop > 3 ? 1.5 : 0), 2);
        const feM = r2(pf.declFeM - pf.metDrop - Math.abs(gauss()) * (pf.metDrop > 3 ? 2.5 : 0.4), 2);
        const P = r2(0.04 + rand() * (pf.metDrop > 3 ? 0.03 : 0.01), 3);
        const moisture = r2(pf.moisture * (0.6 + rand() * 0.8), 2);
        const fines = r2(pf.fines * (0.7 + rand() * 0.6), 1);
        const met = r2((feM / feT) * 100, 2);
        tested = { feTotal: feT, feMetallic: feM, C: 0.14, S: 0.018, P, SiO2: 5.2, Al2O3: 2.6, CaO: 0.9, MgO: 0.4, moisture, fines };
        if (met < 80 || P > 0.08) { status = 'REJECTED'; statusReason = `QA: metallization ${met}% below 80% — returned to supplier`; }
        else if (met < 85 || P > 0.05) { status = 'RESTRICTED'; statusReason = `QA: metallization ${met}%, P ${P}% — limit to 25% of charge`; restriction = { maxSharePct: 25 }; }
        else { status = 'RELEASED'; statusReason = `QA approved: metallization ${met}%, P ${P}%`; }
        qa = {
          qaId: api.nextId('qa', 'QA', 5), lotId, version: 1, sampleId: `S-${lotId.slice(4)}-1`,
          sampledAt: new Date(receivedAt.getTime() + 0.2 * DAY), testedAt: new Date(receivedAt.getTime() + 0.4 * DAY),
          values: tested, method: 'Ferric chloride', analyst: 'R. Priya (QA)', status: 'APPROVED', approvedBy: 'K. Senthil (QA Head)',
          approvedAt: new Date(receivedAt.getTime() + 0.5 * DAY), enteredAt: new Date(receivedAt.getTime() + 0.4 * DAY),
          calculated: { metallization: met, equivalentMetallization: r2(met + 0.7, 2) }, history: true,
        };
      } else {
        declared = { ...DECLARED[pf.materialType] };
        tested = {};
        Object.entries(declared).forEach(([el, d]) => {
          const bias = ['Cu', 'Cr', 'Ni', 'Sn'].includes(el) ? Math.abs(gauss()) * pf.accErr * 1.5 : gauss() * pf.accErr;
          tested[el] = r2(Math.max(0.001, d * (1 + bias)), 3);
        });
        const pRel = clamp(pf.pRel + pf.trend * (6 - monthsAgo), 0.05, 0.98);
        const pRes = pf.pRes;
        const x = rand();
        status = x < pRel ? 'RELEASED' : x < pRel + pRes ? 'RESTRICTED' : 'REJECTED';
        yieldOverride = r2(pf.yield + (rand() - 0.5) * 0.01, 3);

        if (['STEEL_SCRAP', 'CI_SCRAP'].includes(pf.materialType)) {
          const pieces = pf.pRel >= 0.85 ? 15 : 25;
          const rust = clamp(pf.rust * (0.5 + rand()), 0, 0.28);
          const reliable = pieces - Math.round(pieces * rust);
          const ev = { piecesTested: pieces, reliable, cuHigh: 0, stainless: 0, alloySteel: 0, worst: {} };
          if (status === 'RELEASED') statusReason = `${reliable} pieces tested, none flagged`;
          if (status === 'RESTRICTED') {
            if (rand() < 0.6) { ev.cuHigh = 1; statusReason = `1/${reliable} copper-bearing piece(s) — pick out visible copper, limit share`; restriction = { maxSharePct: 20 }; }
            else { ev.alloySteel = 1; statusReason = `1/${reliable} alloy-steel piece(s) — limit share`; restriction = { maxSharePct: 25 }; }
          }
          if (status === 'REJECTED') {
            if (pf.reject === 'stainless') { ev.stainless = 1 + Math.floor(rand() * 2); statusReason = `${ev.stainless} stainless piece(s) found — load returned to supplier`; }
            else if (pf.reject === 'alloy') { ev.alloySteel = Math.ceil(reliable * 0.22); statusReason = `Wrong grade: ${ev.alloySteel}/${reliable} pieces alloy steel — returned`; }
            else { ev.cuHigh = Math.ceil(reliable * 0.12) + 1; statusReason = `Copper contamination: ${ev.cuHigh}/${reliable} pieces above 0.5% Cu — returned`; }
          }
          session = {
            sessionId: api.nextId('gun', 'GUN', 5), lotId, device: 'XRF', deviceId: 'XRF-01', inspector: 'M. Karthik (yard)', via: 'HISTORY',
            startedAt: new Date(receivedAt.getTime() + 0.1 * DAY), endedAt: new Date(receivedAt.getTime() + 0.12 * DAY),
            readings: [], evidence: ev, decision: { status: status === 'REJECTED' ? 'QUARANTINED' : status, reason: statusReason, applied: true }, csv: '', history: true,
          };
        } else {
          // Pig iron: certificate chemistry, spot-checked on the spectrometer.
          statusReason = status === 'RELEASED' ? 'Certificate chemistry confirmed by spectrometer spot check'
            : status === 'RESTRICTED' ? 'Spectrometer: P above certificate — limit share' : 'Spectrometer: chemistry does not match certificate — returned';
          if (status === 'RESTRICTED') restriction = { maxSharePct: 30 };
        }
      }

      const lot = api.addLot({
        lotId, materialType: pf.materialType, description: pick(DESCRIPTION[pf.materialType]), supplier: pf.supplier,
        truckNo: `${pf.truck} ${1000 + Math.floor(rand() * 8999)}`, receivedKg, costPerKg: price, receivedAt,
        bay: 'Yard', declared, status, statusReason, restriction, ...delivery,
      }, 'stores');
      lot.history = true;
      lot.tested = tested;
      lot.chemistrySource = 'LAB';
      if (yieldOverride) lot.yieldOverride = yieldOverride;
      lot.decidedBy = pf.materialType === 'DRI' ? 'QA' : session ? 'GUN' : 'QA';
      // Receipt movement should carry the real receipt date.
      const mv = api.movements[api.movements.length - 1];
      if (mv && mv.lotId === lotId) mv.at = receivedAt;
      if (qa) { api.qaResults.set(qa.qaId, qa); lot.qaIds.push(qa.qaId); }
      if (session) { api.gunSessions.set(session.sessionId, session); lot.sessionIds.push(session.sessionId); }
      historyLots.push({ lot, pf, remaining: status === 'REJECTED' ? 0 : receivedKg });
    }
  });

  // ------------------------------------------------------------ past heats
  let heatNo = 1000;
  const quality = (entry) => (entry.pf.materialType === 'DRI'
    ? (entry.lot.status === 'RELEASED' ? 0.9 : 0.6)
    : (entry.pf.pRel ?? 0.8));
  for (let daysAgo = 170, k = 0; daysAgo > 4; daysAgo -= 4.5, k++) {
    const at = new Date(now - daysAgo * DAY);
    at.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), 0, 0);
    const grade = GRADE_ROTATION[k % GRADE_ROTATION.length];
    const targetKg = 1000;
    const charge = [];
    let risk = 0;
    let restricted = null;
    Object.entries(RECIPE[grade]).forEach(([type, share]) => {
      const pool = historyLots.filter((h) => h.pf.materialType === type && h.remaining >= share * targetKg
        && h.lot.receivedAt <= at && h.lot.receivedAt.getTime() >= at.getTime() - 70 * DAY);
      if (!pool.length) return;
      const h = pick(pool);
      const kg = Math.round(share * targetKg);
      charge.push({ lotId: h.lot.lotId, kg, entry: h });
      risk += share * (1 - quality(h));
      if (h.lot.status === 'RESTRICTED') { risk += 0.12; restricted = h.lot; }
    });
    if (charge.length < 2) continue;
    const x = rand();
    const decision = x < risk * 0.45 ? 'HOLD' : x < risk * 0.45 + risk * 0.75 + (restricted ? 0.1 : 0) ? 'WARN' : 'GO';
    const worstLine = [...charge].sort((a, b) => quality(a.entry) - quality(b.entry))[0];
    const blocking = decision === 'HOLD' ? [`Residuals: Cu predicted above the ${grade} limit — ${worstLine.lotId} (${worstLine.entry.pf.supplier}) is the main source`] : [];
    const warnings = decision === 'WARN' ? [restricted
      ? `${restricted.lotId} is RESTRICTED — keep it within its ${restricted.restriction?.maxSharePct || 25}% share`
      : `Residual Cu close to the ${grade} limit (${worstLine.lotId}, ${worstLine.entry.pf.supplier})`] : [];
    const cancelled = decision === 'HOLD' && rand() < 0.7;
    const heatId = `H-${++heatNo}`;
    const gateId = `G-${heatId}-1`;
    const gate = {
      gateId, heatId, at, by: 'Shift supervisor', decision,
      headline: decision === 'GO' ? 'All checks passed. The furnace can start.' : decision === 'WARN' ? '1 warning(s). The operator must acknowledge them before starting.' : '1 blocking issue(s). Furnace start is locked.',
      blocking, warnings, checks: [], history: true,
    };
    const heat = {
      heatId, grade, targetKg, history: true,
      status: cancelled ? 'CANCELLED' : 'COMPLETED',
      statusReason: cancelled ? 'Held by the Pre-Melt Gate — charge re-planned, this melt never started' : null,
      plannedBy: pick(['Shift A supervisor', 'Shift B supervisor', 'Shift C supervisor']),
      createdAt: new Date(at.getTime() - 0.1 * DAY),
      charge: charge.map(({ lotId, kg }) => ({ lotId, kg })),
      gate, gateHistory: [{ gateId, at, decision, by: gate.by, blocking: blocking.length, warnings: warnings.length }],
    };
    if (!cancelled) {
      heat.start = {
        at, by: pick(['S. Murugan', 'P. Ravi', 'K. Arun']),
        mode: decision === 'HOLD' ? 'ENGINEER_OVERRIDE' : decision === 'WARN' ? 'WARN_ACKNOWLEDGED' : 'GO',
        gateId, gateDecision: decision,
        acknowledgedWarnings: decision === 'WARN' ? warnings : [],
        override: decision === 'HOLD' ? { engineer: 'V. Shankar (Melt engineer)', reason: 'Urgent customer order; castings to be checked 100% by spectrometer', blocking } : null,
      };
      heat.completedAt = new Date(at.getTime() + 0.08 * DAY);
      // Energy meter: actual kWh = prediction × this factor (energy.js applies it).
      heat.meterFactor = r2(1.01 + gauss() * 0.035, 3);
      charge.forEach(({ lotId, kg, entry }) => {
        entry.remaining -= kg;
        api.movements.push({ id: api.nextId('mv', 'MV', 5), lotId, type: 'CHARGE', kg: -kg, heatId, by: heat.start.by, note: `Charged to ${heatId}`, at });
      });
    }
    api.heats.set(heatId, heat);
  }

  // ------------------------------------------------------------ close out history lots
  // A lot is used a little every day over the weeks after it arrives (not in one
  // lump), so daily consumption looks like a real melt shop. Days that are still
  // in the future stay as stock on hand: those lots become visible current stock.
  const rand2 = mulberry32(4242);
  const USE_DAYS = 30;
  historyLots.forEach((h) => {
    const { lot } = h;
    if (lot.status === 'REJECTED') {
      api.movements.push({ id: api.nextId('mv', 'MV', 5), lotId: lot.lotId, type: 'RETURN', kg: -lot.receivedKg, by: 'stores', note: 'Returned to supplier', at: new Date(lot.receivedAt.getTime() + 2 * DAY) });
      return;
    }
    if (h.remaining > 0) {
      const weights = Array.from({ length: USE_DAYS }, () => 0.4 + rand2() * 1.2);
      const wSum = weights.reduce((a, b) => a + b, 0);
      let left = h.remaining;
      const days = weights.map((w, k) => {
        const at = new Date(lot.receivedAt.getTime() + (k + 1) * DAY);
        at.setHours(6 + Math.floor(rand2() * 14), 0, 0, 0);
        return { at, kg: Math.round((h.remaining * w) / wSum) };
      });
      const past = days.filter((x) => x.at.getTime() < now);
      past.forEach((x, k) => {
        // When every day is in the past, the last day takes the rounding remainder so the lot closes out.
        const use = k === past.length - 1 && past.length === days.length ? left : Math.min(x.kg, left);
        if (use <= 0) return;
        left -= use;
        api.movements.push({ id: api.nextId('mv', 'MV', 5), lotId: lot.lotId, type: 'CHARGE', kg: -use, by: 'melt shop', note: 'Charged to heats', at: x.at });
      });
      h.remaining = left;
    }
    if (h.remaining > 0.5) {
      // Still being used today: show it as current stock.
      lot.history = false;
      return;
    }
    lot.previousStatus = lot.status;
    lot.status = 'CONSUMED';
    lot.statusReason = 'All stock charged';
  });

  seedFerroHistory(api, rand2, now);
  api.movements.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { lots: historyLots.length, heats: heatNo - 1000 };
}

/**
 * Ferro-alloy history: past alloy lots and the daily additions the melt shop
 * made (deducted when a strategy is accepted). Uses the lots in stock FIFO,
 * including today's current alloy lots, so current stock reflects real use.
 */
function seedFerroHistory(api, rand, now) {
  const gauss = () => { const u = Math.max(rand(), 1e-9); const v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let no = 700;
  const lots = [];
  FERRO_PROFILES.forEach((pf) => {
    const use = FERRO_USE[pf.alloyName];
    const dailyMean = 3 * use.perHeat * use.share;
    for (let i = 0; i < 7; i++) {
      const daysAgo = 188 - i * 25 - rand() * 6;
      const receivedAt = new Date(now - daysAgo * DAY);
      const receivedKg = Math.round((dailyMean * 25 / 2) * (0.78 + rand() * 0.2) / 10) * 10;
      const status = rand() < pf.pRel ? 'RELEASED' : 'RESTRICTED';
      const declared = { ...FERRO_DECLARED[pf.alloyName] };
      const tested = Object.fromEntries(Object.entries(declared).map(([el, d]) => [el, r2(d * (1 + gauss() * pf.accErr), 3)]));
      const lot = api.addLot({
        lotId: `ALY-0${++no}`, materialType: 'FERROALLOY', alloyName: pf.alloyName, description: FERRO_DESCRIPTION[pf.alloyName], supplier: pf.supplier,
        truckNo: `${pf.truck} ${1000 + Math.floor(rand() * 8999)}`, receivedKg, costPerKg: r2(pf.price * (1 + 0.02 * i / 6) + (rand() - 0.5), 1), receivedAt,
        bay: 'Alloy store', declared, status,
        statusReason: status === 'RELEASED' ? 'Certificate confirmed by spectrometer spot check' : 'Size grading off-spec (fines) — limit share',
        restriction: status === 'RESTRICTED' ? { maxSharePct: 50 } : null,
        ...deliveryFields(pf, receivedAt, receivedKg, rand),
      }, 'stores');
      lot.history = true;
      lot.tested = tested;
      lot.chemistrySource = 'LAB';
      lot.yieldOverride = pf.yield;
      lot.decidedBy = 'QA';
      lots.push(lot);
    }
  });

  // Daily additions over the past six months, FIFO across all lots of the alloy.
  const all = [...api.lots.values()].filter((l) => l.materialType === 'FERROALLOY');
  const left = Object.fromEntries(all.map((l) => [l.lotId, l.receivedKg]));
  for (let d = 185; d >= 1; d--) {
    const day = new Date(now - d * DAY);
    const dow = day.getDay();
    const heats = dow === 0 ? Math.floor(rand() * 2) : 2 + Math.floor(rand() * 3); // Sundays are quiet
    Object.entries(FERRO_USE).forEach(([alloy, u]) => {
      let need = 0;
      for (let h = 0; h < heats; h++) if (rand() < u.share) need += Math.max(1, u.perHeat + gauss() * u.sd);
      need = Math.round(need * 10) / 10;
      const pool = all.filter((l) => l.alloyName === alloy && new Date(l.receivedAt) < day && left[l.lotId] > 0.05)
        .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
      for (const l of pool) {
        if (need <= 0) break;
        const kg = Math.round(Math.min(need, left[l.lotId]) * 10) / 10;
        left[l.lotId] -= kg;
        need -= kg;
        const at = new Date(day);
        at.setHours(10 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
        api.movements.push({ id: api.nextId('mv', 'MV', 5), lotId: l.lotId, type: 'CHARGE', kg: -kg, by: 'melt shop', note: `Strategy accepted: ${alloy} addition`, at });
      }
    });
  }
  // Past alloy lots: trim any small remainder so they close out exactly.
  lots.forEach((lot) => {
    const rem = Math.round(left[lot.lotId] * 10) / 10;
    if (rem > 0.05) {
      if (rem > lot.receivedKg * 0.6) { lot.history = false; return; } // barely used: still in stock
      lot.receivedKg = Math.round((lot.receivedKg - rem) * 10) / 10;
      const mv = api.movements.find((m) => m.lotId === lot.lotId && m.type === 'RECEIPT');
      if (mv) mv.kg = lot.receivedKg;
      if (lot.invoiceKg) lot.invoiceKg = Math.round(lot.receivedKg * (lot.invoiceKg / (lot.receivedKg + rem)) / 10) * 10;
    }
    lot.previousStatus = lot.status;
    lot.status = 'CONSUMED';
    lot.statusReason = 'All stock charged';
  });
}

/** Promised date, invoice weight and documents for the demo's current lots. */
function decorateLots(lots) {
  const rand = mulberry32(777);
  lots.forEach((lot) => {
    if (lot.history || lot.promisedAt || /^in-house$/i.test(lot.supplier)) return;
    const pf = PROFILES.find((p) => p.supplier === lot.supplier) || FERRO_PROFILES.find((p) => p.supplier === lot.supplier);
    Object.assign(lot, deliveryFields(pf, new Date(lot.receivedAt), lot.receivedKg, rand));
  });
}

module.exports = { seedHistory, decorateLots, PROFILES };
