/**
 * Sales & Dispatch — mounted at /api/v2/sales
 */
const express = require('express');
const sales = require('./sales');

const router = express.Router();
const wrap = (fn) => (req, res) => {
  try { res.json({ status: 'success', data: fn(req) }); } catch (e) { res.status(e.status || 500).json({ status: e.status && e.status < 500 ? 'fail' : 'error', message: e.message }); }
};

router.post('/heats/:heatId/complete', wrap((req) => sales.completeHeat(req.params.heatId, req.body || {})));
router.get('/heats', wrap(() => sales.listCompleted()));
router.get('/certificates/:heatId', wrap((req) => sales.certificate(req.params.heatId)));
router.get('/customers', wrap(() => sales.CUSTOMERS));
router.get('/invoices', wrap(() => sales.listInvoices()));
router.post('/invoices', wrap((req) => sales.createInvoice(req.body || {})));
router.get('/invoices/:id(*)', wrap((req) => sales.getInvoice(req.params.id)));
router.get('/config', wrap(() => sales.getConfig()));
router.patch('/config', wrap((req) => sales.updateConfig(req.body || {})));

module.exports = router;
