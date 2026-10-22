import api from "./api";

// Cost Intelligence — proxied through the Node backend at /api/v2/cost.
export const getPrices = () => api.get("/cost/prices");

export const updatePrices = (updates) => api.patch("/cost/prices", updates);

export const estimateCost = (payload) => api.post("/cost/estimate", payload);
// payload: { grade, batchWeightKg, recommendedAdditions: {element: kg}, basePricePerKg? }

export const getCostHistory = (limit = 50, grade) =>
  api.get(`/cost/history?limit=${limit}${grade ? `&grade=${grade}` : ""}`);
