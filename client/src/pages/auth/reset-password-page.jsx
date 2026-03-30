import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../utils/api.js";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState("request");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);

  async function requestReset(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setPending(true);
    try {
      await api.post("/api/auth/forgot-password", { email: email.trim() });
      setMsg("If an account exists, a reset token was issued. Use it below with a new password.");
      setMode("complete");
    } catch {
      setErr("Request failed.");
    } finally {
      setPending(false);
    }
  }

  async function completeReset(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await api.post("/api/auth/reset-password", { token: token.trim(), newPassword });
      setMsg("Password updated. You can sign in.");
    } catch {
      setErr("Invalid or expired token.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Password reset</h1>
        <p className="mt-2 text-sm text-slate-400">
          Request a reset token, then paste the token from your email (dev: check server logs if email is not
          wired).
        </p>

        {mode === "request" ? (
          <form onSubmit={requestReset} className="mt-6 space-y-4">
            {err ? (
              <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="text-slate-400">Email</span>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Request reset"}
            </button>
          </form>
        ) : (
          <form onSubmit={completeReset} className="mt-6 space-y-4">
            {msg ? (
              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
                {msg}
              </div>
            ) : null}
            {err ? (
              <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="text-slate-400">Reset token</span>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Updating…" : "Set new password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
