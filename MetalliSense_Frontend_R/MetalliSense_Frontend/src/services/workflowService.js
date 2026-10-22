import api from "./api";

// The Connected Full Analysis workflow — one call chains:
// Anomaly Detection -> Alloy Recommendation -> RL Optimization ->
// Cost + Carbon + Trust annotation -> Root Cause Hint, all for the same
// composition/grade input. Proxied through the backend to the Agent
// service (anomaly/alloy/RL) plus the backend's own cost/carbon/rootcause
// logic — no data needs to be copied between separate pages.
export const runFullAnalysis = ({ metalGrade, composition, batchWeightKg = 1000, topK = 3 }) =>
  api.post("/workflow/full-analysis", { metalGrade, composition, batchWeightKg, topK });
