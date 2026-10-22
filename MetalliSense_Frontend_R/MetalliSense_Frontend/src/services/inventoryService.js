import api from "./api";

// Inventory Forecasting & Reorder — backend routes under /api/v2/inventory.
const P = "/inventory";

export const getInventoryForecast = () => api.get(`${P}/forecast`);
export const getInventoryItem = (item) => api.get(`${P}/forecast/${encodeURIComponent(item)}`);
export const getReorderSuggestions = () => api.get(`${P}/reorder-suggestions`);
export const getPurchaseRequests = (params = {}) => api.get(`${P}/purchase-requests`, { params });
export const getPurchaseRequest = (prId) => api.get(`${P}/purchase-requests/${encodeURIComponent(prId)}`);
export const createPurchaseRequest = (data) => api.post(`${P}/purchase-requests`, data);
export const approvePurchaseRequest = (prId, by) => api.post(`${P}/purchase-requests/${prId}/approve`, { by });
export const rejectPurchaseRequest = (prId, by, reason) => api.post(`${P}/purchase-requests/${prId}/reject`, { by, reason });
export const receivePurchaseRequest = (prId, lotId, by) => api.post(`${P}/purchase-requests/${prId}/receive`, { lotId, by });
export const getInventoryConfig = () => api.get(`${P}/config`);
export const updateInventoryConfig = (patch) => api.patch(`${P}/config`, patch);
