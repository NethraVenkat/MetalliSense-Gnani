/**
 * Derives grade composition specs from the CSV data (min/max per element
 * observed for each grade). No database — a small in-memory overlay lets
 * you create/edit/delete grades via the API for the life of the process.
 */
const store = require('./csvDataStore');

const ELEMENTS = ['Fe', 'C', 'Si', 'Mn', 'P', 'S'];
const overlay = new Map();
const hidden = new Set();
let nextId = 1;

function computeDerivedSpec(grade, rows) {
  const ranges = {};
  const means = {};
  ELEMENTS.forEach((el) => {
    const values = rows.map((r) => r[el]);
    ranges[el] = [Math.min(...values), Math.max(...values)];
    means[el] = values.reduce((a, b) => a + b, 0) / values.length;
  });

  // The "most important" alloying element = the one with the tightest
  // allowed variation relative to its own typical level (coefficient of
  // variation) — i.e. the element this grade's spec controls most strictly,
  // excluding Fe (always the dominant base element, not an "alloying"
  // addition) and P/S (impurities to minimize, not intentional alloying).
  const alloyingCandidates = ELEMENTS.filter((el) => !['Fe', 'P', 'S'].includes(el));
  let mostImportant = alloyingCandidates[0];
  let tightestCV = Infinity;
  alloyingCandidates.forEach((el) => {
    const [min, max] = ranges[el];
    const cv = means[el] > 0 ? (max - min) / means[el] : Infinity;
    if (cv < tightestCV) {
      tightestCV = cv;
      mostImportant = el;
    }
  });

  const [miMin, miMax] = ranges[mostImportant];
  const description = `${mostImportant} is the most important alloying element for ${grade} — tightly controlled between ${miMin.toFixed(2)}% and ${miMax.toFixed(2)}%.`;

  return {
    _id: `csv-${grade}`,
    grade,
    description,
    standard: 'Derived from data',
    composition_ranges: ranges,
    physical_properties: {},
    typical_applications: [],
  };
}

function getAllSpecs() {
  const byGrade = {};
  store.getAll().forEach((r) => {
    if (!byGrade[r.grade]) byGrade[r.grade] = [];
    byGrade[r.grade].push(r);
  });
  return Object.entries(byGrade)
    .filter(([grade]) => !hidden.has(grade))
    .map(([grade, rows]) =>
      overlay.has(grade) ? overlay.get(grade) : computeDerivedSpec(grade, rows),
    );
}

module.exports = {
  getAllSpecs,
  getByName: (gradeName) =>
    getAllSpecs().find((s) => s.grade === gradeName.toUpperCase()) || null,
  getById: (id) => getAllSpecs().find((s) => s._id === id) || null,
  create: (body) => {
    const grade = (body.grade || '').toUpperCase();
    const spec = {
      _id: `custom-${nextId++}`,
      grade,
      description: body.description || '',
      standard: body.standard || '',
      composition_ranges: body.composition_ranges || {},
      physical_properties: body.physical_properties || {},
      typical_applications: body.typical_applications || [],
    };
    overlay.set(grade, spec);
    hidden.delete(grade);
    return spec;
  },
  update: (id, body) => {
    const existing = getAllSpecs().find((s) => s._id === id);
    if (!existing) return null;
    const updated = { ...existing, ...body, grade: existing.grade };
    overlay.set(existing.grade, updated);
    return updated;
  },
  remove: (id) => {
    const existing = getAllSpecs().find((s) => s._id === id);
    if (!existing) return false;
    overlay.delete(existing.grade);
    hidden.add(existing.grade);
    return true;
  },
};
