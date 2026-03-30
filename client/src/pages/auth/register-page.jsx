import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth-context.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate("/", { replace: true });
    } catch (e) {
      let msg = "Registration failed.";
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        msg = "Email already registered.";
      } else if (axios.isAxiosError(e) && e.response?.data?.error) {
        msg = String(e.response.data.error);
      }
      setErr(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
        <p className="mt-2 text-sm text-slate-400">New users receive the &quot;user&quot; role by default.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {err ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="text-slate-400">Name</span>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
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
            <span className="text-slate-400">Password (min 8)</span>
            <input
              type="password"
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
            Already have an account?
          </Link>
        </p>
      </div>
    </div>
  );
}
