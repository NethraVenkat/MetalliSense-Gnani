// Ported from csvDataStore.js; Node adapters removed.
export default function(module, require) {
function classifySeverity(totalComposition, isDeviated) {
  if (!isDeviated) return 'none';
  const diff = Math.abs(100 - totalComposition);
  if (diff > 5) return 'severe';
  if (diff > 2) return 'moderate';
  return 'mild';
}

const CSV_PATH = "browser demo samples";
function loadCsv() { return structuredClone(require("seed").trainingSeed); }
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

module.exports.snapshot=()=>({records,nextId}); module.exports.restore=s=>{records=s.records;nextId=s.nextId;};
}
