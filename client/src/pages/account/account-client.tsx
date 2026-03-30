import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth-context.jsx";
import { api } from "../../utils/api.js";
import { JiraPersonalSettings } from "../../components/jira-personal-settings";
import { ToastViewport, useToasts } from "../../lib/toast";

type AccountTab = "profile" | "jira" | "password";

function IconTabProfile({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 19.5v-.5a6 6 0 0 1 12 0v.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTabJira({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"
      />
    </svg>
  );
}

function IconTabLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

const TABS: { id: AccountTab; label: string; Icon: typeof IconTabProfile }[] = [
  { id: "profile", label: "Profile", Icon: IconTabProfile },
  { id: "jira", label: "Jira", Icon: IconTabJira },
  { id: "password", label: "Password", Icon: IconTabLock },
];

function tabFromHash(hash: string): AccountTab {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "jira") return "jira";
  if (h === "password") return "password";
  if (h === "profile") return "profile";
  return "profile";
}

export function AccountSettingsClient() {
  const { user, loadUser } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => tabFromHash(location.hash), [location.hash]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const goTab = useCallback(
    (tab: AccountTab) => {
      if (tab === "profile") {
        navigate("/account", { replace: true });
      } else {
        navigate(`/account#${tab}`, { replace: true });
      }
    },
    [navigate]
  );

  const onSaveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setProfileSaving(true);
      try {
        await api.put("/api/auth/profile", {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        });
        await loadUser();
        push("Profile updated.");
      } catch {
        push("Could not update profile (email may be taken).", "error");
      } finally {
        setProfileSaving(false);
      }
    },
    [name, email, loadUser, push]
  );

  const onChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 8) {
        push("New password must be at least 8 characters.", "error");
        return;
      }
      if (newPassword !== confirmPassword) {
        push("New passwords do not match.", "error");
        return;
      }
      setPasswordSaving(true);
      try {
        await api.put("/api/auth/password", {
          currentPassword,
          newPassword,
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await loadUser();
        push("Password updated.");
      } catch {
        push("Current password incorrect or request failed.", "error");
      } finally {
        setPasswordSaving(false);
      }
    },
    [currentPassword, newPassword, confirmPassword, loadUser, push]
  );

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        Sign in to manage your account.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      <header>
        <h2 className="text-xl font-semibold text-white">Account</h2>
        <p className="mt-1 text-sm text-slate-400">
          Profile, Jira API token, and password — switch tabs below.
        </p>
      </header>

      <div role="tablist" aria-label="Account sections" className="flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.map(({ id, label, Icon }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`account-tab-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => goTab(id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="shrink-0 opacity-90" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`account-panel-${activeTab}`}
        aria-labelledby={`account-tab-${activeTab}`}
        className="min-h-[12rem]"
      >
        {activeTab === "profile" && (
          <section className="max-w-md">
            <p className="text-sm text-slate-400">
              Your name and email are stored in the auth service and sent on API requests as identity headers.
            </p>
            <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-slate-400">Display name</span>
                <input
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
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-800 px-2 py-0.5 capitalize text-slate-300">Role: {user.role?.name ?? "—"}</span>
                <span>User id: {user.id}</span>
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "jira" && (
          <section>
            <JiraPersonalSettings push={push} idPrefix="account" />
          </section>
        )}

        {activeTab === "password" && (
          <section className="max-w-md">
            <p className="text-sm text-slate-400">Change your password. You will stay signed in.</p>
            <form onSubmit={onChangePassword} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-slate-400">Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Confirm new password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              >
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
