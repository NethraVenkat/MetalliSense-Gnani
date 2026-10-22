// Login has been removed for this build (no-auth backend) — every route is
// open, so this just renders its children directly.
export default function ProtectedRoute({ children }) {
  return children;
}
