import api from "./api";

// Actian VectorAI DB integration (PEC Hacks 4.0)
const vectorSearchService = {
  getStatus: () => api.get("/vector/status"),
  search: (query, topK = 5) => api.post("/vector/search", { query, top_k: topK }),
  reindex: () => api.post("/vector/reindex"),
  addMemory: (text, metadata) => api.post("/vector/memory/add", { text, metadata }),
  recallMemory: (query, topK = 3) => api.post("/vector/memory/recall", { query, top_k: topK }),
};

export default vectorSearchService;
