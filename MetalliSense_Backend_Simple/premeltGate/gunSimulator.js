/**
 * Handheld XRF / LIBS gun simulator.
 *
 * It models the LOAD, not just the readings: every scrap lot is a pile of
 * ~400 pieces with a hidden truth (clean, copper-contaminated, stainless
 * mixed in, painted/dirty, wrong grade). The inspector tests only N random
 * pieces, exactly like the yard. So a contaminated lot can slip through if
 * no bad piece is sampled — that is realistic, and it is why the spectrometer
 * melt-in check still exists after the gate.
 *
 * Device limits follow the research:
 *  - XRF cannot measure carbon; low Si, P and S are "<LOD".
 *  - LIBS measures carbon (argon purge, ~9–12 s shot plus grinding).
 *  - Paint, oil or rust gives an unreliable surface reading.
 *
 * Output is the CSV row format a real gun exports, so a real device can
 * replace the simulator without touching the ingest code.
 */

const CSV_COLUMNS = ['timestamp', 'device_id', 'device_type', 'mode', 'lot_id', 'piece_no', 'surface_ok', 'test_seconds',
  'Cu', 'Ni', 'Cr', 'Mo', 'Sn', 'Mn', 'Si', 'C', 'P', 'S', 'flags'];

const PIECES_PER_LOAD = 400;

// Share of "bad" pieces in the hidden load per scenario.
const SCENARIOS = {
  clean: { label: 'Clean load', copper: 0, stainless: 0, alloy: 0, badSurface: 0.05 },
  copper: { label: 'Copper-contaminated (motor windings, wire)', copper: 0.06, stainless: 0, alloy: 0, badSurface: 0.05 },
  stainless: { label: 'Stainless steel mixed in', copper: 0, stainless: 0.1, alloy: 0, badSurface: 0.05 },
  dirty: { label: 'Painted / oily / rusty load', copper: 0, stainless: 0, alloy: 0, badSurface: 0.45 },
  wrong_grade: { label: 'Wrong grade (alloy steel supplied)', copper: 0, stainless: 0, alloy: 0.7, badSurface: 0.05 },
};

// ------------------------------------------------------------- random
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngFor = (key) => mulberry32(hashString(key));
const between = (r, lo, hi) => lo + r() * (hi - lo);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------- the load
/** The hidden truth of a lot: deterministic per lot. */
function buildLoad(lot) {
  const sc = SCENARIOS[lot.simulation?.scenario] || SCENARIOS.clean;
  const r = rngFor(`${lot.lotId}#load`);
  const d = lot.declared || {};
  const base = (el) => Math.max(0, (Number(d[el]) || 0) * (1 + 0.1 * gauss(r)));

  const pieces = [];
  for (let no = 1; no <= PIECES_PER_LOAD; no++) {
    const x = r();
    let kind = 'normal';
    if (x < sc.copper) kind = 'copper';
    else if (x < sc.copper + sc.stainless) kind = 'stainless';
    else if (x < sc.copper + sc.stainless + sc.alloy) kind = 'alloy';

    const chem = { Cu: base('Cu'), Ni: base('Ni'), Cr: base('Cr'), Mo: base('Mo'), Sn: base('Sn'), Mn: base('Mn'), Si: base('Si'), C: base('C'), P: base('P'), S: base('S') };
    if (kind === 'copper') Object.assign(chem, { Cu: between(r, 2, 30) });
    if (kind === 'stainless') Object.assign(chem, { Cr: between(r, 16.5, 19), Ni: between(r, 8, 10.5), Mn: between(r, 1.2, 1.9), Mo: between(r, 0, 0.3), C: between(r, 0.02, 0.07), Cu: between(r, 0.2, 0.5) });
    if (kind === 'alloy') Object.assign(chem, { Cr: between(r, 0.85, 1.2), Mo: between(r, 0.15, 0.3), Mn: between(r, 0.75, 1.0), C: between(r, 0.35, 0.45) });

    const surfaceBad = r() < sc.badSurface;
    const surface = surfaceBad ? ['painted', 'oily', 'rusty'][Math.floor(r() * 3)] : 'ok';
    pieces.push({ no, kind, surface, chem });
  }
  return { scenario: lot.simulation?.scenario || 'clean', label: sc.label, pieces };
}

// ------------------------------------------------------------- a session
function fmt(v) { return v === null || v === undefined ? '' : String(v); }

function deviceValue(r, device, el, trueValue) {
  const noisy = Math.max(0, trueValue * (1 + 0.03 * gauss(r)) + 0.002 * gauss(r));
  if (device === 'XRF') {
    if (el === 'C') return 'NA'; // XRF cannot see carbon
    if (el === 'Si' && trueValue < 0.1) return '<LOD';
    if ((el === 'P' || el === 'S') && trueValue < 0.05) return '<LOD';
  } else {
    if ((el === 'P' || el === 'S') && trueValue < 0.02) return '<LOD';
  }
  return r3(noisy);
}

/**
 * Simulate one inspection session. Returns rows in CSV-export order.
 * opts: { device: 'XRF'|'LIBS', deviceId, pieces, surfacePrepared, sessionNo, startAt }
 */
function simulateSession(lot, opts = {}) {
  const device = opts.device === 'LIBS' ? 'LIBS' : 'XRF';
  const deviceId = opts.deviceId || `${device}-01`;
  const n = Math.max(1, Math.min(60, Number(opts.pieces) || 15));
  const load = buildLoad(lot);
  const r = rngFor(`${lot.lotId}#session${opts.sessionNo || 1}#${device}`);

  // choose n distinct pieces
  const idx = load.pieces.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const chosen = idx.slice(0, n).map((i) => load.pieces[i]);

  let clock = new Date(opts.startAt || Date.now()).getTime();
  const rows = chosen.map((piece) => {
    // LIBS always grinds a spot first; XRF only if the operator prepared surfaces.
    const prepared = device === 'LIBS' || opts.surfacePrepared;
    const surfaceOk = piece.surface === 'ok' || (prepared && r() < 0.95);
    const testSeconds = device === 'LIBS' ? r3(between(r, 9, 12) + between(r, 20, 40)) : r3(between(r, 3, 5) + (opts.surfacePrepared ? between(r, 10, 20) : 0));
    clock += (testSeconds + between(r, 15, 40)) * 1000;

    const row = {
      timestamp: new Date(clock).toISOString(),
      device_id: deviceId,
      device_type: device,
      mode: device === 'LIBS' ? 'carbon-argon' : 'alloy',
      lot_id: lot.lotId,
      piece_no: piece.no,
      surface_ok: surfaceOk ? 1 : 0,
      test_seconds: testSeconds,
      flags: '',
    };
    ['Cu', 'Ni', 'Cr', 'Mo', 'Sn', 'Mn', 'Si', 'C', 'P', 'S'].forEach((el) => {
      row[el] = surfaceOk ? deviceValue(r, device, el, piece.chem[el]) : '';
    });
    if (!surfaceOk) row.flags = `SURFACE_${piece.surface.toUpperCase()}`;
    return row;
  });

  return { rows, device, deviceId, loadLabel: load.label };
}

function toCsv(rows) {
  return [CSV_COLUMNS.join(','), ...rows.map((row) => CSV_COLUMNS.map((c) => fmt(row[c])).join(','))].join('\n');
}

module.exports = { simulateSession, buildLoad, toCsv, CSV_COLUMNS, SCENARIOS };
