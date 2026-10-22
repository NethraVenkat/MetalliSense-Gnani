import api from "./api";

// Closed-loop RL alloy optimization — proxied through the Node backend
// at /api/v2/rl, which forwards to the Agent service's /rl/* routes.

export const rlOptimize = (grade, composition, topK = 3, batchWeightKg) =>
  api.post("/rl/optimize", { grade, composition, topK, ...(batchWeightKg ? { batchWeightKg } : {}) });

export const rlSubmitFeedback = (payload) =>
  api.post("/rl/feedback", payload);

export const rlPolicyStatus = () => api.get("/rl/policy/status");

export const rlFeedbackHistory = (limit = 50) =>
  api.get(`/rl/feedback?limit=${limit}`);
