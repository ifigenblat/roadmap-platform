import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AppLayout } from "../../components/layout";

const settingsTabs = [
  {
    label: "Workspaces",
    href: "/settings/workspaces",
    description: "Portfolios and data boundaries",
  },
  {
    label: "Integrations",
    href: "/settings/integrations",
    description: "Jira, Confluence, and sync",
  },
  {
    label: "AI",
    href: "/settings/ai",
    description: "OpenAI / Gemini and workspace keys",
  },
] as const;

function IconWorkspaces({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 10.5V18a1 1 0 0 0 1 1h5M4 10.5 12 9l8-4 8 4M4 10.5 8 9l8-4 8 4v8a1 1 0 0 1-1 1h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconIntegrations({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
    </svg>
  );
}

function IconAi({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.5" strokeOpacity="0.4" />
      <path d="M9 4v2M12 4v2M15 4v2M9 18v2M12 18v2M15 18v2M4 9h2M4 12h2M4 15h2M18 9h2M18 12h2M18 15h2" />
    </svg>
  );
}

const TAB_ICONS = [IconWorkspaces, IconIntegrations, IconAi] as const;

export default function SettingsLayout() {
  const pathname = useLocation().pathname;

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-1 sm:px-2">
        <header className="mb-6 w-full text-center">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Workspace configuration and external system connections. Profile and Jira are under{" "}
            <NavLink to="/account" className="text-indigo-400 hover:text-indigo-300">
              Account
            </NavLink>{" "}
            in the sidebar.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-8 flex w-full max-w-2xl flex-wrap justify-center gap-1 border-b border-slate-800"
        >
          {settingsTabs.map(({ label, href, description }, i) => {
            const Icon = TAB_ICONS[i];
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <NavLink
                key={href}
                to={href}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                title={description}
                className={({ isActive }) =>
                  `-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-indigo-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`
                }
              >
                <Icon className="shrink-0 opacity-90" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="w-full min-w-0">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}
