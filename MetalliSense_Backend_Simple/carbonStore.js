/**
 * carbonStore.js
 *
 * Carbon Intelligence — kg CO2e per kg of contained element added, and per
 * kg of base metal, mirroring alloyPriceStore.js's pattern exactly.
 *
 * ⚠️ ILLUSTRATIVE PLACEHOLDER DEFAULTS based on published order-of-magnitude
 * emission factors for ferroalloy/steel production (not certified LCA data).
 * Update via PATCH /api/v2/carbon/factors to match real supplier EPDs.
 */

// kg CO2e per kg of CONTAINED element, via its typical delivery alloy.
let elementCarbon = {
  Fe: { co2PerKg: 0.8, via: "Pig iron top-up", note: "Lower than virgin steel; blast furnace route" },
  C: { co2PerKg: 0.4, via: "Calcined petroleum coke", note: null },
  Si: { co2PerKg: 4.0, via: "75% Ferrosilicon (FeSi)", note: "Electric-arc smelting is energy-intensive" },
  Mn: { co2PerKg: 2.8, via: "High-carbon Ferromanganese (FeMn)", note: null },
  P: { co2PerKg: 0, via: "Not typically added deliberately", note: null },
  S: { co2PerKg: 0, via: "Not typically added deliberately", note: null },
  Cr: { co2PerKg: 3.5, via: "High-carbon Ferrochrome (FeCr)", note: null },
  Ni: { co2PerKg: 6.5, via: "Ferronickel (FeNi)", note: "Among the highest-carbon ferroalloys" },
  Mo: { co2PerKg: 7.2, via: "Ferromolybdenum (FeMo)", note: "Among the highest-carbon ferroalloys" },
  Cu: { co2PerKg: 3.0, via: "Copper cathode", note: null },
};

// kg CO2e per kg of melt, by grade — reflects typical scrap-vs-virgin blend.
// Grades using more recycled scrap have a lower footprint per kg.
let baseMetalCarbon = {
  "SG-IRON": 0.9,
  "GREY-IRON": 0.85,
  "LOW-CARBON-STEEL": 0.7,   // typically higher scrap fraction
  "MEDIUM-CARBON-STEEL": 0.75,
  "HIGH-CARBON-STEEL": 0.8,
};

const DEFAULT_BASE_CARBON = 0.8;

function getElementCarbon() {
  return elementCarbon;
}

function getBaseMetalCarbon() {
  return baseMetalCarbon;
}

function getBaseCarbonForGrade(grade) {
  if (!grade) return DEFAULT_BASE_CARBON;
  return baseMetalCarbon[grade.toUpperCase()] ?? DEFAULT_BASE_CARBON;
}

function getElementCo2(element) {
  return elementCarbon[element]?.co2PerKg ?? 0;
}

function updateElementCarbon(updates) {
  Object.entries(updates).forEach(([el, factor]) => {
    if (elementCarbon[el] && typeof factor === "number" && factor >= 0) {
      elementCarbon[el] = { ...elementCarbon[el], co2PerKg: factor };
    }
  });
  return elementCarbon;
}

function updateBaseMetalCarbon(updates) {
  Object.entries(updates).forEach(([grade, factor]) => {
    if (typeof factor === "number" && factor >= 0) {
      baseMetalCarbon[grade.toUpperCase()] = factor;
    }
  });
  return baseMetalCarbon;
}

module.exports = {
  getElementCarbon,
  getBaseMetalCarbon,
  getBaseCarbonForGrade,
  getElementCo2,
  updateElementCarbon,
  updateBaseMetalCarbon,
};
