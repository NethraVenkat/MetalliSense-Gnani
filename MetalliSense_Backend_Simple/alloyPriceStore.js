/**
 * alloyPriceStore.js
 *
 * In-memory price list for the Cost Intelligence feature. Prices are
 * "effective ₹/kg of contained element" — i.e. already grossed up for the
 * alloy's typical element content and recovery rate, so they can be
 * multiplied directly against a { element: kg } additions map without
 * needing separate yield calculations.
 *
 * Informed by August 2026 web research on Indian ferroalloy/scrap markets
 * (BigMint, IndexBox, CEIC, ScrapMonster, IndiaMART — see notes per item).
 * Still illustrative approximations, NOT live quotes — commodity prices
 * move daily/weekly. Update via PATCH /api/v2/cost/prices with your
 * actual current supplier rates.
 */

// Effective ₹/kg of CONTAINED element, delivered via the typical alloy
// used to add it (e.g. Si via 75% FeSi, Cr via high-carbon FeCr).
let elementPrices = {
  Fe: { pricePerKg: 50, via: "Pig iron top-up", note: "~₹50,510/MT for Pig Iron LM Gr.IV, Delhi, Jun 2026 (CEIC/JPC)" },
  C: { pricePerKg: 65, via: "Calcined petroleum coke (recarburizer)", note: null },
  Si: { pricePerKg: 135, via: "75% Ferrosilicon (FeSi)", note: "FeSi bulk alloy ₹85,000-120,000/MT in India (2026); ÷0.75 Si content" },
  Mn: { pricePerKg: 110, via: "High-carbon Ferromanganese (FeMn)", note: null },
  P: { pricePerKg: 0, via: "Not typically added deliberately", note: "Usually minimized, not added — flagged if present in recommendation" },
  S: { pricePerKg: 0, via: "Not typically added deliberately", note: "Usually minimized, not added — flagged if present in recommendation" },
  Cr: { pricePerKg: 125, via: "High-carbon Ferrochrome (FeCr)", note: "FeCr domestic bulk ₹74,000-75,000/MT, ~60% Cr (BigMint, 2026); ÷0.6 Cr content" },
  Ni: { pricePerKg: 1300, via: "Ferronickel (FeNi)", note: "Price-volatile — check current quote" },
  Mo: { pricePerKg: 2800, via: "Ferromolybdenum (FeMo)", note: "Price-volatile — check current quote" },
  Cu: { pricePerKg: 820, via: "Copper cathode", note: null },
};

// Base metal (scrap + pig iron blend) cost per kg of melt, by grade.
// Rough blend cost, not a single raw-material price. Grounded against
// India pig iron (~₹50/kg) and iron scrap (~$433/MT ≈ ₹36/kg, Q1 2026)
// blended per typical charge mix for each grade.
let baseMetalPrices = {
  "SG-IRON": 46,             // needs higher-quality pig iron fraction
  "GREY-IRON": 42,
  "LOW-CARBON-STEEL": 38,    // higher scrap fraction typical
  "MEDIUM-CARBON-STEEL": 40,
  "HIGH-CARBON-STEEL": 42,
};

const DEFAULT_BASE_PRICE = 42; // fallback for unlisted/custom grades

function getElementPrices() {
  return elementPrices;
}

function getBaseMetalPrices() {
  return baseMetalPrices;
}

function getBasePriceForGrade(grade) {
  if (!grade) return DEFAULT_BASE_PRICE;
  return baseMetalPrices[grade.toUpperCase()] ?? DEFAULT_BASE_PRICE;
}

function getElementPrice(element) {
  return elementPrices[element]?.pricePerKg ?? 0;
}

function updateElementPrices(updates) {
  // updates: { Si: 135, Mn: 105, ... } — partial, only touches given keys
  Object.entries(updates).forEach(([el, price]) => {
    if (elementPrices[el] && typeof price === "number" && price >= 0) {
      elementPrices[el] = { ...elementPrices[el], pricePerKg: price };
    }
  });
  return elementPrices;
}

function updateBaseMetalPrices(updates) {
  Object.entries(updates).forEach(([grade, price]) => {
    if (typeof price === "number" && price >= 0) {
      baseMetalPrices[grade.toUpperCase()] = price;
    }
  });
  return baseMetalPrices;
}

module.exports = {
  getElementPrices,
  getBaseMetalPrices,
  getBasePriceForGrade,
  getElementPrice,
  updateElementPrices,
  updateBaseMetalPrices,
};
