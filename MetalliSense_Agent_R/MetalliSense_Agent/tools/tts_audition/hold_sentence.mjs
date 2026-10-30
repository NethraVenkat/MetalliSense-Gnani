// Build the audition sentence with the app's formatter and its actual H-1053 seed.
// No browser, STT, gate mutation or network requests.
import { buildHoldAlert } from '../../../../MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceGateAnswers.js';
import configFactory from '../../../../MetalliSense_Frontend_R/MetalliSense_Frontend/src/mock/handlers/premeltGate/config.js';
import historyFactory from '../../../../MetalliSense_Frontend_R/MetalliSense_Frontend/src/mock/handlers/premeltGate/supplierHistory.js';
import storeFactory from '../../../../MetalliSense_Frontend_R/MetalliSense_Frontend/src/mock/handlers/premeltGate/store.js';
const factories = { './config': configFactory, './supplierHistory': historyFactory, './store': storeFactory };
const modules = new Map();
function require(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const module = { exports: {} };
  modules.set(name, module);
  if (!factories[name]) throw new Error(`Unexpected seed dependency: ${name}`);
  factories[name](module, require);
  return module.exports;
}
const store = require('./store');
const heat = store.heats.get('H-1053');
const lot = store.getLot(heat.charge[0].lotId);
const max = require('./config').RESIDUAL_LIMITS[heat.grade].Cu;
if (lot.status !== 'QUARANTINED' || lot.declared.Cu <= max) throw new Error('H-1053 HOLD seed changed; review audition fixture');
const gate = { decision: 'HOLD', checks: [
  { id: 'lot_status', status: 'FAIL', details: [{ lotId: lot.lotId, status: 'FAIL', text: lot.status }] },
  { id: 'residuals', status: 'FAIL', details: [{ element: 'Cu', value: lot.declared.Cu, max, status: 'FAIL' }] },
] };
process.stdout.write(JSON.stringify({ text: buildHoldAlert(heat.heatId, gate, 'ta') }));
