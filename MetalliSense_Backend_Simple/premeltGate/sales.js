/**
 * Sales & Dispatch — the end of the melt.
 *
 * When the engineer approves the tap (after the mechanical-property check),
 * the heat is finished: good castings are counted, runners/risers go back to
 * stock as foundry returns, and the heat can be invoiced to a customer with
 * a test certificate (chemistry vs spec, mechanical properties, and the raw
 * material lots it was made from).
 *
 * In-memory like the rest of the backend. Seller and customer details are
 * DEMO placeholders — replace them (PATCH /api/v2/sales/config) before use.
 */
const store = require('./store');
const gate = require('./gateEngine');
const energy = require('./energy');
const { RESIDUAL_LIMITS } = require('./config');
const sellingPrices = require('../sellingPriceStore');

const err = (status, message) => Object.assign(new Error(message), { status });
const round = (v, dp = 0) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** dp) / 10 ** dp);

// ------------------------------------------------------------ settings (demo placeholders)
const settings = {
  seller: {
    name: 'MetalliSense Demo Foundry',
    address: 'Plot 00, Demo Industrial Estate, Coimbatore, Tamil Nadu 641000',
    gstin: '33DEMO0000D1Z0',
    stateCode: '33',
    state: 'Tamil Nadu',
    phone: '+91 00000 00000',
    email: 'sales@example.com',
    bank: 'Demo Bank · A/c 000000000000 · IFSC DEMO0000000',
    isDemo: true,
  },
  castingYieldPct: 70, // good castings as % of liquid metal
  returnsPct: 25, // runners, risers, rejects that go back to stock as foundry returns
  gstPct: 18,
  paymentTermsDays: 30,
  hsn: { 'GREY-IRON': '73251000', 'SG-IRON': '73259920', 'LOW-CARBON-STEEL': '73259910', 'MEDIUM-CARBON-STEEL': '73259910', 'HIGH-CARBON-STEEL': '73259910' },
};

const CUSTOMERS = [
  { id: 'C-001', name: 'Kaveri Pumps & Valves (demo)', address: 'Demo Road, Coimbatore, Tamil Nadu', gstin: '33DEMOC0001C1Z1', stateCode: '33', state: 'Tamil Nadu' },
  { id: 'C-002', name: 'Deccan Auto Components (demo)', address: 'Demo Industrial Area, Hosur, Tamil Nadu', gstin: '33DEMOC0002C1Z2', stateCode: '33', state: 'Tamil Nadu' },
  { id: 'C-003', name: 'Sahyadri Agro Implements (demo)', address: 'Demo MIDC, Pune, Maharashtra', gstin: '27DEMOC0003C1Z3', stateCode: '27', state: 'Maharashtra' },
  { id: 'C-004', name: 'Malabar Marine Engineering (demo)', address: 'Demo Harbour Road, Kochi, Kerala', gstin: '32DEMOC0004C1Z4', stateCode: '32', state: 'Kerala' },
];

let invoices = [];
let invCounter = 0;
store.onSeed(() => { invoices = []; invCounter = 0; });

const fy = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
const gradeLabel = (g) => String(g || '').split('-').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ').replace('Sg ', 'SG ');

// ------------------------------------------------------------ amount in words (Indian system)
function inWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const three = (n) => `${n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${n % 100 ? two(n % 100) : ''}`;
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1e3;
  if (crore) parts.push(`${two(crore) || three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `Rupees ${parts.join(' ')}${paise ? ` and ${two(paise)} Paise` : ''} Only`;
}

// ------------------------------------------------------------ checks
function chemistryCheck(grade, composition) {
  const spec = gate.specFor(grade);
  const residual = RESIDUAL_LIMITS[String(grade).toUpperCase()] || {};
  const rows = [];
  Object.entries(spec?.ranges || {}).forEach(([el, [lo, hi]]) => {
    const v = Number(composition?.[el]);
    if (!Number.isFinite(v)) return;
    const pass = el === 'P' || el === 'S' ? v <= hi : v >= lo && v <= hi;
    rows.push({ element: el, value: round(v, 3), min: el === 'P' || el === 'S' ? null : lo, max: hi, pass });
  });
  Object.entries(residual).forEach(([el, max]) => {
    const v = Number(composition?.[el]);
    if (!Number.isFinite(v)) return;
    rows.push({ element: el, value: round(v, 3), min: null, max, pass: v <= max, residual: true });
  });
  return { rows, pass: rows.every((r) => r.pass), specSource: spec?.source || null };
}

function mechanicalCheck(mech = {}, standard = {}) {
  const rows = [];
  const add = (label, unit, value, min, max) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
    const v = Number(value);
    rows.push({ property: label, unit, value: round(v, 1), min: min ?? null, max: max ?? null, pass: (min == null || v >= min) && (max == null || v <= max) });
  };
  add('Tensile strength (UTS)', 'MPa', mech.predicted_uts_mpa, standard.uts_min, null);
  add('Yield strength (YS)', 'MPa', mech.predicted_ys_mpa, standard.ys_min, null);
  add('Elongation', '%', mech.predicted_elongation_pct, standard.elong_min, null);
  add('Hardness', 'HB', mech.predicted_hardness_hb, null, standard.hb_max);
  const pass = mech.quality_result ? mech.quality_result === 'PASS' : rows.every((r) => r.pass);
  return { rows, pass, standard: standard.ref || null, basis: 'Predicted from final chemistry (empirical model) — confirm with a tensile test bar' };
}

// ------------------------------------------------------------ finish the heat (Approve Tap)
/**
 * body: { approvedBy, composition, mechanical, standard, acceptedStrategy }
 */
function completeHeat(heatId, body = {}) {
  const heat = store.heats.get(heatId);
  if (!heat) throw err(404, `Heat ${heatId} not found`);
  if (heat.status === 'COMPLETED' && heat.tap) return heatView(heat);
  if (!body.approvedBy || !String(body.approvedBy).trim()) throw err(400, "The engineer's name is required to approve the tap");
  if (heat.status === 'PLANNED' && body.resume) {
    // The browser still has this heat's melt flow, but the server was restarted
    // (demo data reset) so the heat is back to PLANNED. Close it from the saved flow.
    heat.charge.forEach((l) => {
      const kg = Math.min(Number(l.kg), store.availableKg(l.lotId));
      if (kg > 0) store.addMovement({ lotId: l.lotId, type: 'CHARGE', kg: -kg, heatId, by: String(body.approvedBy).trim(), note: `Charged to ${heatId}` });
    });
    heat.status = 'MELTING';
    heat.start = { at: new Date(), by: String(body.approvedBy).trim(), mode: 'RESUMED', gateId: heat.gate?.gateId || null, gateDecision: body.gateDecision || heat.gate?.decision || null, note: 'Melted before a server restart; closed from the saved melt flow' };
    try { heat.energyAtStart = energy.gateSnapshot(heat, heat.start.gateDecision); } catch { /* optional */ }
    store.log('HEAT_RESUMED', heatId, heat.start.by, 'Server restarted during the melt — heat closed from the saved melt flow');
  }
  if (heat.status !== 'MELTING') throw err(409, `Heat ${heatId} is ${String(heat.status).toLowerCase()} — start melting it on the Pre-Melt Gate first`);

  const composition = body.composition || heat.gate?.prediction?.composition || {};
  const chem = chemistryCheck(heat.grade, composition);
  const mech = mechanicalCheck(body.mechanical, body.standard);
  const chargeKg = heat.charge.reduce((s, l) => s + Number(l.kg), 0);
  const metalKg = Number(heat.gate?.prediction?.metalKg) || chargeKg * 0.95;
  const castingsKg = round(metalKg * (settings.castingYieldPct / 100), 0);
  const returnsKg = round(metalKg * (settings.returnsPct / 100), 0);

  // Downgrade if chemistry or mechanical properties failed.
  const ok = chem.pass && mech.pass;
  const down = ok ? null : sellingPrices.getDowngradeLossPerTon(heat.grade);
  const soldGrade = ok ? heat.grade : (sellingPrices.getDowngradeTarget(heat.grade) || down?.downgradeGrade || 'SCRAP');
  const pricePerT = ok ? sellingPrices.getSellingPrice(heat.grade) : (down?.downgradeSellingPricePerTon ?? sellingPrices.SCRAP_PRICE_PER_TON);

  heat.status = 'COMPLETED';
  heat.finalChemistry = composition;
  heat.completedAt = new Date();
  heat.tap = {
    at: heat.completedAt,
    approvedBy: String(body.approvedBy).trim(),
    chemistry: chem,
    mechanical: { ...mech, raw: body.mechanical || null },
    acceptedStrategy: body.acceptedStrategy ? { strategy: body.acceptedStrategy.strategy || null, estimatedCost: body.acceptedStrategy.estimatedCost ?? body.acceptedStrategy.estimated_cost ?? null } : null,
    metalKg: round(metalKg, 0),
    castingsKg,
    returnsKg,
    castingYieldPct: settings.castingYieldPct,
    result: ok ? 'PASS' : 'DOWNGRADED',
    soldGrade,
    sellingRsPerKg: round((pricePerT || 0) / 1000, 2),
    downgradeNote: ok ? null : `${[
      !chem.pass ? `chemistry (${chem.rows.filter((r) => !r.pass).map((r) => r.element).join(', ')})` : null,
      !mech.pass ? `mechanical properties (${mech.rows.filter((r) => !r.pass).map((r) => r.property.replace(/ \(.*\)/, '')).join(', ') || 'predicted FAIL'})` : null,
    ].filter(Boolean).join(' and ').replace(/^./, (c) => c.toUpperCase())} outside ${gradeLabel(heat.grade)} limits — sold as ${soldGrade === 'SCRAP' ? 'scrap' : gradeLabel(soldGrade)}`,
  };

  // Runners and risers go back to stock as foundry returns, with this heat's chemistry.
  if (returnsKg > 0) {
    const lot = store.addLot({
      lotId: `RET-${heatId.replace(/^H-/, '')}`, materialType: 'RETURNS', description: `${gradeLabel(heat.grade)} returns (runners, risers) from ${heatId}`,
      supplier: 'In-house', receivedKg: returnsKg, costPerKg: 38, parentHeatId: heatId, bay: 'Returns bay',
      declared: Object.fromEntries(Object.entries(composition).filter(([k]) => k !== 'Fe').map(([k, v]) => [k, round(v, 3)])),
    }, heat.tap.approvedBy);
    heat.tap.returnsLotId = lot.lotId;
  }
  // Energy meter reading for the finished heat (simulated in the demo).
  try { if (!energy.predictHeat(heat).actual) energy.simulateActual(heatId, 'energy meter'); } catch { /* optional */ }

  store.log('TAP_APPROVED', heatId, heat.tap.approvedBy, `${castingsKg} kg castings (${heat.tap.result}${ok ? '' : ` → ${soldGrade}`}), ${returnsKg} kg returns`);
  return heatView(heat);
}

// ------------------------------------------------------------ margin per heat
function heatCosts(heat) {
  const moves = store.listMovements().filter((m) => m.heatId === heat.heatId && m.type === 'CHARGE' && m.kg < 0);
  let chargeRs = 0;
  let alloyRs = 0;
  moves.forEach((m) => {
    const lot = store.getLot(m.lotId);
    const rs = -m.kg * (Number(lot?.costPerKg) || 0);
    if (lot?.materialType === 'FERROALLOY') alloyRs += rs; else chargeRs += rs;
  });
  const energyRs = heat.energyAtStart?.rs ?? null;
  const returnsCreditRs = (heat.tap?.returnsKg || 0) * 38;
  return { chargeRs: round(chargeRs, 0), alloyRs: round(alloyRs, 0), energyRs: round(energyRs, 0), returnsCreditRs: round(returnsCreditRs, 0) };
}

function heatView(heat) {
  const inv = invoices.find((i) => i.heatId === heat.heatId && i.status !== 'CANCELLED');
  const costs = heatCosts(heat);
  const revenue = heat.tap ? heat.tap.castingsKg * heat.tap.sellingRsPerKg : null;
  const totalCost = (costs.chargeRs || 0) + (costs.alloyRs || 0) + (costs.energyRs || 0) - (costs.returnsCreditRs || 0);
  return {
    heatId: heat.heatId, grade: heat.grade, gradeLabel: gradeLabel(heat.grade), status: heat.status, completedAt: heat.completedAt || null,
    tap: heat.tap || null,
    invoiceId: inv?.invoiceId || null,
    margin: heat.tap ? {
      revenueRs: round(revenue, 0), ...costs, totalCostRs: round(totalCost, 0), marginRs: round(revenue - totalCost, 0),
      marginPct: revenue ? round(((revenue - totalCost) / revenue) * 100, 1) : null,
      note: 'Revenue at list price (before GST) minus charge materials, alloy additions and melt energy, plus returns credited back to stock. Moulding, labour and overheads are not included.',
    } : null,
  };
}

function listCompleted() {
  return store.heats.list().filter((h) => h.tap).map(heatView);
}

// ------------------------------------------------------------ test certificate
function certificate(heatId) {
  const heat = store.heats.get(heatId);
  if (!heat) throw err(404, `Heat ${heatId} not found`);
  if (!heat.tap) throw err(409, `Heat ${heatId} has no approved tap yet — finish it on Mechanical Properties first`);
  const lines = heat.charge.map((l) => {
    const lot = store.getLot(l.lotId);
    return { lotId: l.lotId, material: lot?.alloyName || lot?.materialType, supplier: lot?.supplier, kg: Number(l.kg), status: lot?.previousStatus || lot?.status };
  });
  const additions = store.listMovements().filter((m) => m.heatId === heatId && m.type === 'CHARGE' && !heat.charge.some((c) => c.lotId === m.lotId))
    .map((m) => { const lot = store.getLot(m.lotId); return { lotId: m.lotId, material: lot?.alloyName || lot?.materialType, supplier: lot?.supplier, kg: -m.kg, status: 'Addition' }; });
  const inv = invoices.find((i) => i.heatId === heatId && i.status !== 'CANCELLED');
  return {
    certificateNo: `TC/${fy(new Date(heat.tap.at))}/${heatId}`,
    type: 'Test certificate (EN 10204 type 3.1 format)',
    issuedAt: heat.tap.at,
    seller: settings.seller,
    customer: inv ? inv.customer : null,
    invoiceId: inv?.invoiceId || null,
    heatId, grade: heat.grade, gradeLabel: gradeLabel(heat.grade),
    result: heat.tap.result, soldGrade: heat.tap.soldGrade, downgradeNote: heat.tap.downgradeNote,
    castingsKg: heat.tap.castingsKg,
    chemistry: heat.tap.chemistry,
    mechanical: heat.tap.mechanical,
    gate: { gateId: heat.start?.gateId || heat.gate?.gateId || null, decision: heat.start?.gateDecision || heat.gate?.decision || null, mode: heat.start?.mode || null },
    traceability: [...lines, ...additions],
    approvedBy: heat.tap.approvedBy,
    startedBy: heat.start?.by || null,
  };
}

// ------------------------------------------------------------ invoices
function createInvoice(body = {}) {
  const heat = store.heats.get(body.heatId);
  if (!heat) throw err(404, `Heat ${body.heatId} not found`);
  if (!heat.tap) throw err(409, `Heat ${heat.heatId} is not finished — approve the tap first`);
  if (invoices.some((i) => i.heatId === heat.heatId && i.status !== 'CANCELLED')) throw err(409, `Heat ${heat.heatId} is already invoiced`);
  const customer = CUSTOMERS.find((c) => c.id === body.customerId);
  if (!customer) throw err(400, 'Choose a customer');
  if (!body.createdBy || !String(body.createdBy).trim()) throw err(400, 'Your name is required');
  const qtyKg = body.qtyKg !== undefined && body.qtyKg !== '' ? Number(body.qtyKg) : heat.tap.castingsKg;
  if (!(qtyKg > 0) || qtyKg > heat.tap.castingsKg) throw err(400, `Quantity must be between 1 and ${heat.tap.castingsKg} kg (castings from this heat)`);
  const rate = body.ratePerKg !== undefined && body.ratePerKg !== '' ? Number(body.ratePerKg) : heat.tap.sellingRsPerKg;
  if (!(rate > 0)) throw err(400, 'Rate must be a positive number');

  const soldGrade = heat.tap.soldGrade;
  const taxable = round(qtyKg * rate, 2);
  const intra = customer.stateCode === settings.seller.stateCode;
  const gst = settings.gstPct;
  const cgst = intra ? round((taxable * gst) / 200, 2) : 0;
  const sgst = intra ? round((taxable * gst) / 200, 2) : 0;
  const igst = intra ? 0 : round((taxable * gst) / 100, 2);
  const beforeRound = taxable + cgst + sgst + igst;
  const total = Math.round(beforeRound);
  const issuedAt = new Date();
  const due = new Date(issuedAt.getTime() + settings.paymentTermsDays * 86400000);
  const inv = {
    invoiceId: `INV/${fy(issuedAt)}/${String(++invCounter).padStart(4, '0')}`,
    status: 'ISSUED',
    issuedAt, dueAt: due,
    heatId: heat.heatId,
    seller: settings.seller,
    customer,
    poNumber: body.poNumber || null,
    placeOfSupply: `${customer.state} (${customer.stateCode})`,
    lines: [{
      description: `${soldGrade === 'SCRAP' ? 'Iron/steel scrap' : `${gradeLabel(soldGrade)} castings`} — Heat ${heat.heatId}${heat.tap.result === 'DOWNGRADED' ? ` (downgraded from ${gradeLabel(heat.grade)})` : ''}`,
      hsn: settings.hsn[soldGrade] || '73259990',
      qtyKg: round(qtyKg, 0), unit: 'kg', rate: round(rate, 2), amount: taxable,
    }],
    taxable, gstPct: gst, intraState: intra, cgst, sgst, igst,
    roundOff: round(total - beforeRound, 2),
    total,
    totalInWords: inWords(total),
    certificateNo: `TC/${fy(new Date(heat.tap.at))}/${heat.heatId}`,
    paymentTerms: `${settings.paymentTermsDays} days from invoice date`,
    createdBy: String(body.createdBy).trim(),
  };
  invoices.push(inv);
  store.log('INVOICE_ISSUED', inv.invoiceId, inv.createdBy, `${heat.heatId}: ${inv.lines[0].qtyKg} kg to ${customer.name}, ₹${total.toLocaleString('en-IN')}`);
  return inv;
}

function listInvoices() { return invoices.slice().sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt)); }
function getInvoice(id) { const i = invoices.find((x) => x.invoiceId === id); if (!i) throw err(404, `Invoice ${id} not found`); return i; }

function getConfig() { return { ...settings, customers: CUSTOMERS }; }
function updateConfig(patch = {}) {
  if (patch.seller && typeof patch.seller === 'object') {
    ['name', 'address', 'gstin', 'stateCode', 'state', 'phone', 'email', 'bank'].forEach((k) => { if (typeof patch.seller[k] === 'string') settings.seller[k] = patch.seller[k]; });
    settings.seller.isDemo = false;
  }
  ['castingYieldPct', 'returnsPct', 'gstPct', 'paymentTermsDays'].forEach((k) => { if (typeof patch[k] === 'number' && patch[k] >= 0) settings[k] = patch[k]; });
  return getConfig();
}

module.exports = { completeHeat, listCompleted, certificate, createInvoice, listInvoices, getInvoice, getConfig, updateConfig, CUSTOMERS, inWords };
