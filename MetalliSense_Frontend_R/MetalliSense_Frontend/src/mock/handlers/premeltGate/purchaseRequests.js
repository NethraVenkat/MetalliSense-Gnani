// Ported from premeltGate/purchaseRequests.js; Node adapters removed.
export default function(module, require) {
/**
 * Purchase requests (PR) — the buying side of Inventory Forecasting.
 *
 *   Suggestion → Stores creates PR (pre-filled) → PENDING_APPROVAL
 *             → Manager approves → APPROVED   (or REJECTED with a reason)
 *             → Truck arrives, received with the PR number → RECEIVED (linked to the new lot)
 *
 * In-memory, like the rest of this backend. Every step is written to the audit log.
 */
const store = require('./store');

let requests = [];
let counter = 0;
store.onSeed(() => { requests = []; counter = 0; });

const OPEN = ['PENDING_APPROVAL', 'APPROVED'];
const err = (status, message) => Object.assign(new Error(message), { status });
const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;

function list({ status, item } = {}) {
  return requests
    .filter((r) => (!status || r.status === status) && (!item || r.item === item))
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function get(prId) { return requests.find((r) => r.prId === prId) || null; }
function openFor(item) { return requests.find((r) => r.item === item && OPEN.includes(r.status)) || null; }

/**
 * data: { item, label, materialType, alloyName, qtyKg, supplier, supplierGrade, estRsPerKg, reason, requestedBy }
 */
function create(data = {}) {
  if (!data.item) throw err(400, 'item is required');
  const qtyKg = Number(data.qtyKg);
  if (!(qtyKg > 0)) throw err(400, 'qtyKg must be a positive number');
  if (!data.requestedBy || !String(data.requestedBy).trim()) throw err(400, 'requestedBy is required');
  const open = openFor(data.item);
  if (open) throw err(409, `${data.label || data.item} already has an open purchase request (${open.prId}, ${open.status.replace('_', ' ').toLowerCase()})`);
  if (data.supplierGrade === 'D') throw err(409, `${data.supplier} is a grade D supplier — choose another supplier`);
  const estRsPerKg = Number(data.estRsPerKg) || null;
  const pr = {
    prId: `PR-${String(++counter).padStart(4, '0')}`,
    item: data.item,
    label: data.label || data.item,
    materialType: data.materialType || null,
    alloyName: data.alloyName || null,
    qtyKg: round(qtyKg, 0),
    supplier: data.supplier || null,
    supplierGrade: data.supplierGrade || null,
    estRsPerKg,
    estTotalRs: estRsPerKg ? round(qtyKg * estRsPerKg, 0) : null,
    reason: data.reason || '',
    status: 'PENDING_APPROVAL',
    requestedBy: String(data.requestedBy).trim(),
    approvedBy: null,
    rejectedBy: null,
    rejectReason: null,
    createdAt: new Date(),
    approvedAt: null,
    receivedAt: null,
    linkedLotId: null,
    history: [{ at: new Date(), by: String(data.requestedBy).trim(), action: 'CREATED' }],
  };
  requests.push(pr);
  store.log('PR_CREATED', pr.prId, pr.requestedBy, `${pr.label}: ${pr.qtyKg} kg from ${pr.supplier || 'supplier to be chosen'}${pr.estTotalRs ? `, est. ₹${pr.estTotalRs.toLocaleString('en-IN')}` : ''}`);
  return pr;
}

function approve(prId, { by } = {}) {
  const pr = get(prId);
  if (!pr) throw err(404, `Purchase request ${prId} not found`);
  if (pr.status !== 'PENDING_APPROVAL') throw err(409, `${prId} is ${pr.status.replace('_', ' ').toLowerCase()}`);
  if (!by || !String(by).trim()) throw err(400, "The approving manager's name is required");
  if (String(by).trim().toLowerCase() === pr.requestedBy.toLowerCase()) throw err(403, 'Maker–checker: the person approving must be different from the requester');
  pr.status = 'APPROVED';
  pr.approvedBy = String(by).trim();
  pr.approvedAt = new Date();
  pr.history.push({ at: pr.approvedAt, by: pr.approvedBy, action: 'APPROVED' });
  store.log('PR_APPROVED', pr.prId, pr.approvedBy, `${pr.label}: ${pr.qtyKg} kg from ${pr.supplier}`);
  return pr;
}

function reject(prId, { by, reason } = {}) {
  const pr = get(prId);
  if (!pr) throw err(404, `Purchase request ${prId} not found`);
  if (pr.status !== 'PENDING_APPROVAL') throw err(409, `${prId} is ${pr.status.replace('_', ' ').toLowerCase()}`);
  if (!by || !reason || String(reason).trim().length < 5) throw err(400, 'Name and a reason (5+ characters) are required to reject');
  pr.status = 'REJECTED';
  pr.rejectedBy = String(by).trim();
  pr.rejectReason = String(reason).trim();
  pr.history.push({ at: new Date(), by: pr.rejectedBy, action: 'REJECTED', note: pr.rejectReason });
  store.log('PR_REJECTED', pr.prId, pr.rejectedBy, pr.rejectReason);
  return pr;
}

/** Check a lot being received can close this PR (before the lot is created). */
function checkReceivable(prId, { materialType, alloyName } = {}) {
  const pr = get(prId);
  if (!pr) throw err(404, `Purchase request ${prId} not found`);
  if (pr.status !== 'APPROVED') throw err(409, `${prId} is ${pr.status.replace('_', ' ').toLowerCase()} — only approved requests can be received`);
  if (pr.materialType && materialType && pr.materialType !== materialType) throw err(400, `${prId} is for ${pr.label}, not this material`);
  if (pr.alloyName && alloyName && pr.alloyName !== alloyName) throw err(400, `${prId} is for ${pr.alloyName}, not ${alloyName}`);
  return pr;
}

function receive(prId, { lotId, by } = {}) {
  const pr = get(prId);
  if (!pr) throw err(404, `Purchase request ${prId} not found`);
  if (pr.status !== 'APPROVED') throw err(409, `${prId} is ${pr.status.replace('_', ' ').toLowerCase()} — only approved requests can be received`);
  const lot = lotId ? store.getLot(lotId) : null;
  if (!lot) throw err(400, 'lotId of the received lot is required');
  pr.status = 'RECEIVED';
  pr.receivedAt = new Date();
  pr.linkedLotId = lot.lotId;
  pr.receivedKg = lot.receivedKg;
  pr.history.push({ at: pr.receivedAt, by: by || 'stores', action: 'RECEIVED', note: lot.lotId });
  lot.prId = pr.prId;
  store.log('PR_RECEIVED', pr.prId, by || 'stores', `${lot.lotId}: ${lot.receivedKg} kg ${pr.label} from ${lot.supplier}`);
  return pr;
}

module.exports = { list, get, openFor, create, approve, reject, receive, checkReceivable, OPEN };

module.exports.snapshot=()=>({requests,counter}); module.exports.restore=s=>{requests=s.requests;counter=s.counter;};

}
