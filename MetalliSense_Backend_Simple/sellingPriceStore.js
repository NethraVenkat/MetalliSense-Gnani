/**
 * sellingPriceStore.js
 *
 * Finished/semi-finished casting SELLING prices per grade (₹/ton) — this
 * is a DIFFERENT number from alloyPriceStore.js's base metal RAW MATERIAL
 * cost. Selling price includes foundry margin, conversion cost (melting,
 * molding, labor, energy), not just the metal input cost.
 *
 * Used to model: if a batch fails spec and gets downgraded to a lower
 * grade, the real loss is (target grade selling price − downgraded grade
 * selling price), not an arbitrary assumed percentage.
 *
 * Sourcing / confidence:
 *   - GREY-IRON: ₹157/kg (₹1,804/MT), ChemAnalyst India, June 2026 — real,
 *     sourced. This is priced at the "cast iron material" level (ingot/
 *     simple casting), not a machined finished part.
 *   - SG-IRON (ductile iron): no direct India ₹/ton quote found this pass.
 *     Estimated as Grey Iron price × 1.15 (ductile/nodular iron typically
 *     commands a 10-20% premium over grey iron due to magnesium treatment
 *     and higher mechanical properties) — REASONED ESTIMATE, not sourced.
 *   - LOW/MEDIUM/HIGH-CARBON-STEEL: no India-specific finished-casting
 *     price found this pass. Estimated using a common ~15% step-up per
 *     carbon tier (higher carbon = tighter composition control, typically
 *     higher-value end use) off a general mild-steel billet baseline —
 *     REASONED ESTIMATE, not sourced. Replace with real quotes if you have
 *     them (PATCH /api/v2/cost/selling-prices).
 *
 * Still NOT a live feed — update via PATCH /api/v2/cost/selling-prices.
 */

let sellingPrices = {
  "SG-IRON": { pricePerTon: 83000, confidence: "sourced", note: "Median of ₹70/78/80/85/100 per kg, ductile iron castings, IndiaMART 2026" },
  "GREY-IRON": { pricePerTon: 62000, confidence: "sourced", note: "Median of ₹45/55/60/61/64/68/80 per kg, grey iron castings, IndiaMART 2026" },
  "HIGH-CARBON-STEEL": { pricePerTon: 101000, confidence: "estimated", note: "Anchored to the sourced Low-Carbon price with a +30% step-up. Real retail quotes for high-carbon/spring steel wire (₹65-78/kg, IndiaMART 2026) actually came in BELOW low-carbon steel's price — but that's comparing different product forms (wire vs plate), not a clean carbon-tier signal. Kept monotonic (low<medium<high) as a deliberate simplification — verify against a real quote for your actual product form." },
  "MEDIUM-CARBON-STEEL": { pricePerTon: 87000, confidence: "estimated", note: "Anchored to the sourced Low-Carbon price with a +12% step-up. The one real quote found (C45 round bar, ₹60/kg, IndiaMART) was treated as an outlier (different product form, single data point) rather than used directly, since it would make medium-carbon cheaper than both low and high carbon — not used per your instruction to keep a logical low<medium<high ordering." },
  "LOW-CARBON-STEEL": { pricePerTon: 78000, confidence: "sourced", note: "Median of ₹65-92/kg range, mild steel (plate/bar/angle/channel), Comaron 2026" },
};

// When a batch of this grade fails spec, what does it actually get sold
// as? (per your instruction: downgrades to the next lower grade)
const downgradeChain = {
  "HIGH-CARBON-STEEL": "MEDIUM-CARBON-STEEL",
  "MEDIUM-CARBON-STEEL": "LOW-CARBON-STEEL",
  "LOW-CARBON-STEEL": null, // no lower steel grade tracked — treat as scrap
  "SG-IRON": "GREY-IRON",
  "GREY-IRON": null, // no lower iron grade tracked — treat as scrap
};

// Fallback scrap price (₹/ton) used when there's no lower grade to
// downgrade to — i.e. the batch is sold as plain scrap, not a lower grade.
const SCRAP_PRICE_PER_TON = 32000; // approx Indian melting scrap, order-of-magnitude

// For grades where there's no tracked "next lower grade" but going all the
// way to scrap overstates the real loss (e.g. GREY-IRON in practice gets
// sold as a lower-spec iron casting grade, not scrapped outright), use an
// explicit downgrade price instead of SCRAP_PRICE_PER_TON.
const noLowerGradeOverridePrice = {
  "GREY-IRON": 50000, // ~19% below its own selling price — lower-grade iron casting, not scrap
};

function getSellingPrices() {
  return sellingPrices;
}

function getSellingPrice(grade) {
  return sellingPrices[grade?.toUpperCase()]?.pricePerTon ?? null;
}

function getDowngradeTarget(grade) {
  const g = grade?.toUpperCase();
  if (!(g in downgradeChain)) return null;
  return downgradeChain[g]; // may be null (no lower grade -> scrap)
}

function getDowngradeLossPerTon(grade) {
  const targetPrice = getSellingPrice(grade);
  if (targetPrice == null) return null;
  const g = grade.toUpperCase();
  const downgradeTarget = getDowngradeTarget(grade);
  const downgradePrice = downgradeTarget
    ? getSellingPrice(downgradeTarget)
    : (noLowerGradeOverridePrice[g] ?? SCRAP_PRICE_PER_TON);
  return {
    targetGrade: g,
    targetSellingPricePerTon: targetPrice,
    downgradeGrade: downgradeTarget || (noLowerGradeOverridePrice[g] ? `${g} (lower-grade casting)` : "SCRAP"),
    downgradeSellingPricePerTon: downgradePrice,
    lossPerTon: Math.round((targetPrice - downgradePrice) * 100) / 100,
  };
}

function updateSellingPrices(updates) {
  // updates: { "HIGH-CARBON-STEEL": 62000, ... }
  Object.entries(updates).forEach(([grade, price]) => {
    const g = grade.toUpperCase();
    if (typeof price === "number" && price >= 0) {
      sellingPrices[g] = { ...(sellingPrices[g] || {}), pricePerTon: price, confidence: "user-provided" };
    }
  });
  return sellingPrices;
}

module.exports = {
  getSellingPrices,
  getSellingPrice,
  getDowngradeTarget,
  getDowngradeLossPerTon,
  updateSellingPrices,
  SCRAP_PRICE_PER_TON,
};
