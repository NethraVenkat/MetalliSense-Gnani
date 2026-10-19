/**
 * Loads dataset.csv into memory once, on startup. No database of any kind.
 * Expected columns: timestamp, grade, is_deviated, Fe, C, Si, Mn, P, S,
 * total_composition
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_PATH = process.env.DATA_CSV || path.join(__dirname, 'dataset.csv');

function classifySeverity(totalComposition, isDeviated) {
  if (!isDeviated) return 'none';
  const diff = Math.abs(100 - totalComposition);
  if (diff > 5) return 'severe';
  if (diff > 2) return 'moderate';
  return 'mild';
}

function loadCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`⚠️  CSV not found at ${CSV_PATH}. Endpoints will return empty data.`);
    return [];
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(raw, { columns: true, trim: true, skip_empty_lines: true });

  return rows.map((row, index) => {
    const isDeviated = String(row.is_deviated).trim().toLowerCase() === 'true';
    const totalComposition = parseFloat(row.total_composition);
    return {
      _id: String(index + 1),
      grade: (row.grade || '').toUpperCase(),
      Fe: parseFloat(row.Fe),
      C: parseFloat(row.C),
      Si: parseFloat(row.Si),
      Mn: parseFloat(row.Mn),
      P: parseFloat(row.P),
      S: parseFloat(row.S),
      total_composition: totalComposition,
      deviated: isDeviated ? 1 : 0,
      sample_type: isDeviated ? 'deviated' : 'normal',
      severity: classifySeverity(totalComposition, isDeviated),
      createdAt: row.timestamp ? new Date(row.timestamp) : null,
      updatedAt: row.timestamp ? new Date(row.timestamp) : null,
    };
  });
}

let records = loadCsv();
let nextId = records.length + 1;

module.exports = {
  getAll: () => records,
  findById: (id) => records.find((r) => r._id === String(id)) || null,
  create: (doc) => {
    const rec = {
      _id: String(nextId++),
      grade: (doc.grade || '').toUpperCase(),
      Fe: Number(doc.Fe), C: Number(doc.C), Si: Number(doc.Si),
      Mn: Number(doc.Mn), P: Number(doc.P), S: Number(doc.S),
      total_composition:
        Number(doc.Fe) + Number(doc.C) + Number(doc.Si) +
        Number(doc.Mn) + Number(doc.P) + Number(doc.S),
      deviated: doc.deviated ? 1 : 0,
      sample_type: doc.sample_type || (doc.deviated ? 'deviated' : 'normal'),
      severity: doc.severity || 'none',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    records.push(rec);
    return rec;
  },
  updateById: (id, updates) => {
    const rec = records.find((r) => r._id === String(id));
    if (!rec) return null;
    Object.assign(rec, updates, { updatedAt: new Date() });
    return rec;
  },
  deleteById: (id) => {
    const idx = records.findIndex((r) => r._id === String(id));
    if (idx === -1) return false;
    records.splice(idx, 1);
    return true;
  },
  reload: () => {
    records = loadCsv();
    nextId = records.length + 1;
    return records.length;
  },
  CSV_PATH,
};
