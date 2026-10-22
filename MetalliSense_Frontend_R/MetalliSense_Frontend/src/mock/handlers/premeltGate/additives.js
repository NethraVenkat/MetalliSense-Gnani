// Ported from premeltGate/additives.js; Node adapters removed.
export default function(module, require) {
/**
 * Alloy additive inventory.
 *
 * Ferroalloy lots (FeSi, FeMn, recarburiser) are ordinary lots with
 * materialType FERROALLOY and certificate chemistry. This module turns the
 * AI's recommended additions (percentage points of the bath) into kilograms
 * of a specific in-stock lot, and reports stock and reorder alerts.
 */
const store = require('./store');
const { ADDITIVE_FOR } = require('./config');
const { round } = require('./chemistry');

// Reorder when available stock drops below this (kg). Illustrative.
const REORDER_LEVEL_KG = { 'FeSi-75': 100, 'HC FeMn': 60, Recarburiser: 80 };

const usable = (lot) => ['RELEASED', 'RESTRICTED'].includes(lot.status);

function lotsFor(alloyName) {
  return store.listLots()
    .filter((l) => l.materialType === 'FERROALLOY' && l.alloyName === alloyName && usable(l) && store.availableKg(l.lotId) > 0)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt)); // FIFO
}

/**
 * additionsPct: { Si: 0.75, Mn: 0.3 } — percentage points of the bath.
 * metalKg: expected liquid metal of the heat.
 * alreadyPlannedKg: { lotId: kg } already in the charge (so stock isn't double-counted).
 */
function suggest(additionsPct, metalKg, alreadyPlannedKg = {}) {
  return Object.entries(additionsPct || {})
    .filter(([el, pct]) => ADDITIVE_FOR[el] && pct > 0)
    .map(([el, pct]) => {
      const { alloyName, recovery } = ADDITIVE_FOR[el];
      const elementKg = (pct / 100) * metalKg;
      const candidates = lotsFor(alloyName);
      const lot = candidates[0];
      if (!lot) {
        return { element: el, pct: round(pct, 3), alloyName, lotId: null, kg: null, inStock: false,
          note: `No released ${alloyName} in stock` };
      }
      const content = Number(lot.declared?.[el]) || 0;
      const kg = content > 0 ? elementKg / ((content / 100) * recovery) : null;
      const available = store.availableKg(lot.lotId) - (alreadyPlannedKg[lot.lotId] || 0);
      return {
        element: el,
        pct: round(pct, 3),
        alloyName,
        lotId: lot.lotId,
        kg: kg === null ? null : round(kg, 1),
        availableKg: round(available, 1),
        inStock: kg !== null && available >= kg,
        costRs: kg === null ? null : round(kg * lot.costPerKg, 0),
        note: kg !== null && available < kg ? `Only ${round(available, 1)} kg ${alloyName} available` : null,
      };
    });
}

function inventory() {
  const lots = store.listLots().filter((l) => l.materialType === 'FERROALLOY');
  const byAlloy = {};
  lots.forEach((l) => {
    const a = l.alloyName || l.description;
    byAlloy[a] = byAlloy[a] || { alloyName: a, availableKg: 0, lots: [], reorderLevelKg: REORDER_LEVEL_KG[a] ?? null };
    const kg = store.availableKg(l.lotId);
    byAlloy[a].availableKg = round(byAlloy[a].availableKg + (usable(l) ? kg : 0), 1);
    byAlloy[a].lots.push(store.view(l));
  });
  return Object.values(byAlloy).map((a) => ({
    ...a,
    lowStock: a.reorderLevelKg !== null && a.availableKg < a.reorderLevelKg,
  }));
}

module.exports = { suggest, inventory, REORDER_LEVEL_KG };

}
