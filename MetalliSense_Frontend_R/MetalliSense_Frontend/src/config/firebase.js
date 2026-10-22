import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate config up front instead of letting initializeApp throw a raw
// SDK error later. `firebaseConfigError` is null when everything required
// is present, or a human-readable string naming exactly which VITE_FIREBASE_*
// values are missing/placeholders — consumers (e.g. AuthContext) can check
// this to show a clear message instead of a blank crash screen.
const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"];
const PLACEHOLDER_VALUES = ["your_actual_key", "your-project-id", "changeme", ""];

const missing = REQUIRED_KEYS.filter(
  (key) => !firebaseConfig[key] || PLACEHOLDER_VALUES.includes(firebaseConfig[key]),
);

export const firebaseConfigError =
  missing.length > 0
    ? `Firebase is not configured. Missing or placeholder env values: ${missing.join(", ")}. ` +
      `Set VITE_FIREBASE_* in MetalliSense_Frontend/.env with real values from ` +
      `Firebase Console → Project Settings → General → Your apps, then restart the dev server.`
    : null;

let app = null;
let auth = null;

if (!firebaseConfigError) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    // initializeApp/getAuth can still throw on a malformed (but present)
    // value, e.g. an authDomain with a typo. Surface it the same way.
    console.error("Firebase initialization failed:", err);
  }
} else {
  console.error(firebaseConfigError);
}

export { auth };

// Google OAuth Provider — safe to construct even if `app`/`auth` failed to
// initialize; it just won't work until the config above is fixed.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;