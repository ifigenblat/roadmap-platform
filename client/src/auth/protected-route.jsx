import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context.jsx";

/** Strict login when `VITE_AUTH_OPTIONAL=false`; default allows anonymous SPA (pair with gateway). */
const authOptional = import.meta.env.VITE_AUTH_OPTIONAL !== "false";

/** When `VITE_AUTH_OPTIONAL` is not true, require a logged-in user (LocalKnowledge JWT flow). */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (authOptional) {
    return children;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
