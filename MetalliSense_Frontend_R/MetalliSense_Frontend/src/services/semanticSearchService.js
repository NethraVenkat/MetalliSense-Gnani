import axios from "axios";

// Separate axios instance for the Semantic Search service (Actian VectorAI DB)
const vectorSearchApi = axios.create({
  baseURL: import.meta.env.VITE_VECTORSEARCH_BASE_URL || "http://localhost:8002",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const getSemanticSearchHealth = () => vectorSearchApi.get("/health");

/**
 * @param {string} query - free-text search, e.g. "high carbon reading out of spec"
 * @param {"training_data"|"grades"} collection
 * @param {number} limit
 */
export const semanticSearch = (query, collection = "training_data", limit = 5) =>
  vectorSearchApi.post("/semantic-search", { query, collection, limit });

export const reindex = () => vectorSearchApi.post("/reindex");
