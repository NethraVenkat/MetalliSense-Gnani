import axios from "axios";

// Local JWT auth: the token lives in an httpOnly cookie set by the backend
// (see localAuthController.js), so we just need the browser to send cookies
// on every request — no manual Authorization header needed.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v2",
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
  // No login/cookies in this build — credentials aren't needed, and
  // leaving withCredentials on trips CORS ("Network Error") against a
  // backend that doesn't send Access-Control-Allow-Credentials.
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized - token expired or invalid
      if (error.response.status === 401) {
        const currentPath = window.location.pathname;
        // Only redirect if not already on auth pages
        if (
          !currentPath.includes("/login") &&
          !currentPath.includes("/signup")
        ) {
          window.location.href = "/login";
        }
      }
      // Server responded with error
      console.error("API Error:", error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error("Network Error:", error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
