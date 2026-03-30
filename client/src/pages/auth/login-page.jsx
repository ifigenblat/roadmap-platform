import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth-context.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setPending(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch {
      setErr("Invalid email or password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Use your Roadmap Platform account. JWT is stored in{" "}
          <code className="rounded bg-slate-950 px-1 text-xs">localStorage</code> as{" "}
          <code className="rounded bg-slate-950 px-1 text-xs">token</code>.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {err ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="text-slate-400">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
          {" · "}
          <Link to="/reset-password" className="text-indigo-400 hover:text-indigo-300">
            Forgot password
          </Link>
        </p>
      </div>
    </div>
  );
}
