// Ported from premeltGate/store.js; Node adapters removed.
export default function(module, require) {
/**
 * Pre-Melt Gate — in-memory store (same "no database" style as the rest of
 * this backend). Holds raw material + additive lots, the stock ledger,
 * DRI lab results, handheld-gun sessions, heats and an audit log.
 *
 * Stock is never edited directly: every change is a ledger movement and
 * available kg is always calculated from the ledger.
 */
const { MATERIAL_TYPES } = require('./config');
const supplierHistory = require('./supplierHistory');

let lots, movements, qaResults, gunSessions, heats, audit, counters;

const DAY = 24 * 3600 * 1000;
const ago = (ms) => new Date(Date.now() - ms);

function nextId(key, prefix, pad = 4) {
  counters[key] = (counters[key] || 0) + 1;
  return `${prefix}-${String(counters[key]).padStart(pad, '0')}`;
}

function log(type, ref, by, detail) {
  audit.unshift({ at: new Date(), type, ref, by: by || 'system', detail });
  // Browser audit is persistent and uncapped.
}

// ------------------------------------------------------------------ lots
function availableKg(lotId) {
  return Math.round(movements.filter((m) => m.lotId === lotId).reduce((s, m) => s + m.kg, 0) * 10) / 10;
}

function view(lot) {
  if (!lot) return null;
  const { simulation, ...rest } = lot;
  return {
    ...rest,
    materialLabel: MATERIAL_TYPES[lot.materialType]?.label,
    availableKg: availableKg(lot.lotId),
    demoLoadCondition: simulation?.scenario || null,
  };
}

function getLot(lotId) { return lots.get(lotId) || null; }
function listLots() { return [...lots.values()]; }

function touch(lot) { lot.version += 1; lot.updatedAt = new Date(); }

function setStatus(lot, status, reason, by, extra = {}) {
  lot.status = status;
  lot.statusReason = reason;
  lot.restriction = extra.restriction ?? (status === 'RESTRICTED' ? lot.restriction : null);
  if (extra.decidedBy) lot.decidedBy = extra.decidedBy;
  touch(lot);
  log('LOT_STATUS', lot.lotId, by, `${status}: ${reason}`);
}

function addLot(data, by) {
  const type = MATERIAL_TYPES[data.materialType];
  const counterKey = `lot_${data.materialType}`;
  counters[counterKey] = counters[counterKey] || (data.materialType === 'RETURNS' ? 0 : 920);
  const lotId = data.lotId || `${type.prefix}-${String(++counters[counterKey]).padStart(4, '0')}`;
  const lot = {
    lotId,
    materialType: data.materialType,
    description: data.description || type.label,
    alloyName: data.alloyName || null,
    supplier: data.supplier || 'Unknown supplier',
    truckNo: data.truckNo || null,
    grnNo: data.grnNo || nextId('grn', 'GRN', 5),
    bay: data.bay || 'Yard',
    receivedAt: data.receivedAt || new Date(),
    receivedKg: Number(data.receivedKg),
    costPerKg: Number(data.costPerKg) || 0,
    declared: data.declared || {},
    tested: data.tested || null,
    chemistrySource: data.chemistrySource || type.trust,
    status: data.status || (type.needs ? 'AWAITING_QA' : 'RELEASED'),
    statusReason: data.statusReason || (type.needs === 'GUN'
      ? 'Waiting for handheld XRF/LIBS yard inspection'
      : type.needs === 'LAB' ? 'Waiting for QA lab result' : 'Chemistry from certificate / parent heat'),
    restriction: data.restriction || null,
    flags: data.flags || [],
    storage: data.storage || { wet: false },
    // Delivery + documents (used by the Supplier Scorecard). All optional.
    promisedAt: data.promisedAt ? new Date(data.promisedAt) : null,
    invoiceKg: Number(data.invoiceKg) > 0 ? Number(data.invoiceKg) : null,
    docs: data.docs || null,
    parentHeatId: data.parentHeatId || null,
    simulation: { scenario: data.demoScenario || 'clean' },
    qaIds: [],
    sessionIds: [],
    version: 1,
    updatedAt: new Date(),
  };
  lots.set(lotId, lot);
  movements.push({ id: nextId('mv', 'MV', 5), lotId, type: 'RECEIPT', kg: lot.receivedKg, at: lot.receivedAt, by: by || 'stores', note: `GRN ${lot.grnNo}` });
  log('LOT_RECEIVED', lotId, by, `${lot.receivedKg} kg ${lot.description} from ${lot.supplier}`);
  return lot;
}

function addMovement({ lotId, type, kg, heatId, by, note }) {
  const mv = { id: nextId('mv', 'MV', 5), lotId, type, kg, heatId: heatId || null, by: by || 'system', note: note || '', at: new Date() };
  movements.push(mv);
  log('STOCK_MOVEMENT', heatId || lotId, by, `${type}: ${lotId} ${kg} kg ? ${note || ''}`);
  const lot = lots.get(lotId);
  if (lot) {
    touch(lot);
    if (availableKg(lotId) <= 0.05 && lot.status !== 'CONSUMED') {
      lot.previousStatus = lot.status;
      lot.status = 'CONSUMED';
      lot.statusReason = 'All stock charged';
    }
  }
  return mv;
}

// ------------------------------------------------------------------ seed
function seed() {
  lots = new Map();
  movements = [];
  qaResults = new Map();
  gunSessions = new Map();
  heats = new Map();
  audit = [];
  counters = { heat: 1050 };

  // Completed heats — the source of foundry returns chemistry.
  heats.set('H-1043', {
    heatId: 'H-1043', grade: 'SG-IRON', targetKg: 1000, status: 'COMPLETED', charge: [],
    createdAt: ago(3 * DAY), plannedBy: 'Shift A',
    finalChemistry: { Fe: 93.43, C: 3.6, Si: 2.45, Mn: 0.3, P: 0.035, S: 0.012, Cu: 0.05, Cr: 0.03, Ni: 0.03, Mo: 0.005, Sn: 0.004 },
    gate: null, gateHistory: [],
  });

  const T = 'Trichy Iron & Alloys';
  addLot({ lotId: 'PIG-0901', materialType: 'PIG_IRON', description: 'SG-grade pig iron (low Mn, low P)', supplier: 'Kovai Pig Iron Co.', receivedKg: 4000, costPerKg: 50, receivedAt: ago(6 * DAY), bay: 'Bay 1',
    declared: { C: 4.1, Si: 1.1, Mn: 0.08, P: 0.035, S: 0.015, Cu: 0.01, Cr: 0.02, Ni: 0.02, Mo: 0.005, Sn: 0.002 } }, 'stores');
  addLot({ lotId: 'RET-1043', materialType: 'RETURNS', description: 'SG iron returns (runners, risers) from H-1043', supplier: 'In-house', receivedKg: 2500, costPerKg: 38, receivedAt: ago(3 * DAY), bay: 'Bay 2',
    parentHeatId: 'H-1043', declared: { C: 3.6, Si: 2.45, Mn: 0.3, P: 0.035, S: 0.012, Cu: 0.05, Cr: 0.03, Ni: 0.03, Mo: 0.005, Sn: 0.004 } }, 'melt shop');
  addLot({ lotId: 'SCR-0912', materialType: 'STEEL_SCRAP', description: 'CRCA bundles (clean low-carbon sheet)', supplier: 'Sri Balaji Scrap Traders', truckNo: 'TN 38 BK 4412', receivedKg: 6000, costPerKg: 36, receivedAt: ago(2 * DAY), bay: 'Bay 3',
    demoScenario: 'clean', declared: { C: 0.05, Si: 0.02, Mn: 0.25, P: 0.015, S: 0.012, Cu: 0.04, Cr: 0.03, Ni: 0.03, Mo: 0.01, Sn: 0.01 } }, 'stores');
  addLot({ lotId: 'SCR-0913', materialType: 'STEEL_SCRAP', description: 'HMS 1&2 mixed heavy melting scrap', supplier: 'Coimbatore Metal Recyclers', truckNo: 'TN 37 CY 9081', receivedKg: 8000, costPerKg: 33, receivedAt: ago(0.1 * DAY), bay: 'Bay 4',
    demoScenario: 'copper', declared: { C: 0.2, Si: 0.2, Mn: 0.65, P: 0.03, S: 0.03, Cu: 0.2, Cr: 0.1, Ni: 0.08, Mo: 0.02, Sn: 0.015 } }, 'stores');
  addLot({ lotId: 'SCR-0914', materialType: 'STEEL_SCRAP', description: 'Shredded steel scrap', supplier: 'Pollachi Steel Scrap', truckNo: 'TN 41 AL 2230', receivedKg: 5000, costPerKg: 34, receivedAt: ago(0.2 * DAY), bay: 'Bay 5',
    demoScenario: 'stainless', declared: { C: 0.12, Si: 0.15, Mn: 0.5, P: 0.025, S: 0.025, Cu: 0.15, Cr: 0.08, Ni: 0.06, Mo: 0.015, Sn: 0.012 } }, 'stores');
  addLot({ lotId: 'CIS-0915', materialType: 'CI_SCRAP', description: 'Grey iron machine castings (painted)', supplier: 'Tiruppur Castings Scrap', truckNo: 'TN 39 BZ 7710', receivedKg: 3000, costPerKg: 34, receivedAt: ago(1 * DAY), bay: 'Bay 6',
    demoScenario: 'dirty', declared: { C: 3.3, Si: 2.0, Mn: 0.65, P: 0.12, S: 0.09, Cu: 0.25, Cr: 0.15, Ni: 0.05, Mo: 0.02, Sn: 0.02 } }, 'stores');

  // Sponge iron — one already through QA, one waiting for the lab.
  const dri1 = addLot({ lotId: 'DRI-0911', materialType: 'DRI', description: 'Coal-based sponge iron lumps', supplier: T, truckNo: 'TN 45 AF 1122', receivedKg: 3000, costPerKg: 28, receivedAt: ago(2 * DAY), bay: 'Covered shed',
    declared: { feTotal: 91, feMetallic: 81.9, C: 0.15, P: 0.045, S: 0.018, SiO2: 5, Al2O3: 2.5, fines: 3 } }, 'stores');
  const qa1 = {
    qaId: 'QA-00001', lotId: dri1.lotId, version: 1, sampleId: 'S-0911-1', sampledAt: ago(1.8 * DAY), testedAt: ago(1.6 * DAY),
    values: { feTotal: 90.8, feMetallic: 81.5, C: 0.14, S: 0.018, P: 0.045, SiO2: 5.2, Al2O3: 2.6, CaO: 0.9, MgO: 0.4, moisture: 0.3, fines: 2.8 },
    method: 'Ferric chloride', analyst: 'R. Priya (QA)', status: 'APPROVED', approvedBy: 'K. Senthil (QA Head)', approvedAt: ago(1.5 * DAY), enteredAt: ago(1.6 * DAY),
    calculated: { metallization: 89.76, equivalentMetallization: 90.46 },
  };
  qaResults.set(qa1.qaId, qa1);
  dri1.qaIds.push(qa1.qaId);
  dri1.tested = { ...qa1.values };
  dri1.chemistrySource = 'LAB';
  dri1.status = 'RELEASED';
  dri1.statusReason = 'QA approved: metallization 89.8%, P 0.045%';
  counters.qa = 1;

  addLot({ lotId: 'DRI-0917', materialType: 'DRI', description: 'Coal-based sponge iron lumps', supplier: T, truckNo: 'TN 45 AF 1187', receivedKg: 3500, costPerKg: 27, receivedAt: ago(0.15 * DAY), bay: 'Covered shed',
    declared: { feTotal: 91, feMetallic: 82, C: 0.15, P: 0.05, S: 0.02, SiO2: 5, Al2O3: 2.5, fines: 3 } }, 'stores');

  // Alloy additives (ferroalloys) — certificate chemistry.
  addLot({ lotId: 'ALY-0903', materialType: 'FERROALLOY', alloyName: 'FeSi-75', description: 'Ferrosilicon 75% (10–50 mm)', supplier: 'Nava Bharat Ferro Alloys', receivedKg: 500, costPerKg: 105, receivedAt: ago(10 * DAY), bay: 'Alloy store',
    declared: { C: 0.1, Si: 75, Mn: 0.3, P: 0.03, S: 0.01 } }, 'stores');
  addLot({ lotId: 'ALY-0904', materialType: 'FERROALLOY', alloyName: 'HC FeMn', description: 'High-carbon ferromanganese', supplier: 'Maithan Alloys', receivedKg: 300, costPerKg: 78, receivedAt: ago(12 * DAY), bay: 'Alloy store',
    declared: { C: 6.8, Si: 1.0, Mn: 70, P: 0.25, S: 0.02 } }, 'stores');
  addLot({ lotId: 'ALY-0905', materialType: 'FERROALLOY', alloyName: 'Recarburiser', description: 'Calcined petroleum coke recarburiser', supplier: 'Goa Carbon', receivedKg: 400, costPerKg: 65, receivedAt: ago(9 * DAY), bay: 'Alloy store',
    declared: { C: 98.5, S: 0.4 } }, 'stores');

  // A planned heat ready for the demo: base charge without alloy additions.
  // H-1051: balanced SG-iron charge that predicts clean GO on first check
  // Composition: C≈3.30, Si≈2.34, Mn≈0.66, P≈0.035, S≈0.013 — all mid-spec
  heats.set('H-1051', {
    heatId: 'H-1051', grade: 'SG-IRON', targetKg: 1020, status: 'PLANNED', plannedBy: 'Shift B supervisor', createdAt: new Date(),
    charge: [
      { lotId: 'PIG-0901', kg: 400 },  // 40% — C4.1 Si1.1 base iron
      { lotId: 'RET-1043', kg: 500 },  // 50% — C3.6 Si2.45 high-Si returns
      { lotId: 'SCR-0912', kg: 100 },  // 10% — clean CRCA scrap
      { lotId: 'ALY-0903', kg: 12 },   // FeSi-75: raises Si to ~2.34%
      { lotId: 'ALY-0904', kg: 8 },    // HC FeMn: raises Mn to ~0.66%
    ],
    gate: null, gateHistory: [],
  });
  // H-1052: a second heat for the demo — charge with DRI to show DRI QA path
  heats.set('H-1052', {
    heatId: 'H-1052', grade: 'SG-IRON', targetKg: 1000, status: 'PLANNED', plannedBy: 'Shift A supervisor', createdAt: new Date(),
    charge: [{ lotId: 'PIG-0901', kg: 350 }, { lotId: 'DRI-0911', kg: 350 }, { lotId: 'RET-1043', kg: 300 }],
    gate: null, gateHistory: [],
  });
  counters.heat = 1052;

  // Six months of past deliveries and heats, so suppliers have a track record.
  const auditBefore = audit.length;
  supplierHistory.seedHistory({ addLot, lots, movements, qaResults, gunSessions, heats, counters, nextId });
  audit.splice(0, audit.length - auditBefore); // keep the audit log for today's demo only
  supplierHistory.decorateLots([...lots.values()]);
}

// Modules that keep their own demo state (e.g. purchase requests) register
// here so a demo reset clears them too.
const seedHooks = [];
function onSeed(fn) { seedHooks.push(fn); }
function reseed() { seed(); seedHooks.forEach((fn) => { try { fn(); } catch (e) { console.error('seed hook failed:', e.message); } }); }

seed();

module.exports = {
  seed: reseed,
  onSeed,
  log,
  // lots
  getLot, listLots, addLot, view, availableKg, setStatus, touch,
  // ledger
  addMovement,
  listMovements: (lotId) => (lotId ? movements.filter((m) => m.lotId === lotId) : movements).slice().reverse(),
  // QA
  qa: {
    get: (id) => qaResults.get(id) || null,
    list: (lotId) => [...qaResults.values()].filter((q) => !lotId || q.lotId === lotId).sort((a, b) => b.enteredAt - a.enteredAt),
    add: (rec) => { const qaId = nextId('qa', 'QA', 5); const r = { qaId, ...rec }; qaResults.set(qaId, r); return r; },
  },
  // gun sessions
  sessions: {
    get: (id) => gunSessions.get(id) || null,
    list: (lotId) => [...gunSessions.values()].filter((s) => !lotId || s.lotId === lotId).sort((a, b) => b.startedAt - a.startedAt),
    add: (s) => { gunSessions.set(s.sessionId, s); return s; },
    nextId: () => nextId('gun', 'GUN', 5),
  },
  // heats
  heats: {
    get: (id) => heats.get(id) || null,
    list: () => [...heats.values()].sort((a, b) => (b.heatId > a.heatId ? 1 : -1)),
    add: (h) => { const heatId = `H-${++counters.heat}`; const heat = { heatId, ...h }; heats.set(heatId, heat); return heat; },
  },
  audit: () => audit,
};

module.exports.snapshot=()=>({lots:[...lots],movements,qaResults:[...qaResults],gunSessions:[...gunSessions],heats:[...heats],audit,counters});
module.exports.restore=s=>{lots=new Map(s.lots);movements=s.movements;qaResults=new Map(s.qaResults);gunSessions=new Map(s.gunSessions);heats=new Map(s.heats);audit=s.audit;counters=s.counters;};
}
