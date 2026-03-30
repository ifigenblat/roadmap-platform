import { Link, NavLink, useLocation } from "react-router-dom";
import { ReactNode, Suspense, useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/auth-context.jsx";
import { WorkspaceHeaderBadge } from "./workspace-header-badge";

function IconPerson() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 19.5v-.5a6 6 0 0 1 12 0v.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { user, logout, loading } = useAuth();
  const pathname = useLocation().pathname;
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");

  const doLogout = () => {
    logout();
    window.location.assign("/login");
  };

  const logoutRowClass =
    "flex w-full items-center gap-2 rounded-lg border border-slate-700/80 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200";

  if (loading) {
    return (
      <div className={`text-xs text-slate-500 ${collapsed ? "flex justify-center" : ""}`}>…</div>
    );
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className={`flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 ${
          collapsed ? "h-10 w-10 px-0" : "w-full"
        }`}
        title={collapsed ? "Sign in" : undefined}
      >
        {!collapsed && "Sign in"}
        {collapsed && <span className="text-lg font-medium text-slate-400">+</span>}
      </Link>
    );
  }

  const iconShellClass = (active: boolean) =>
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${
      active
        ? "bg-indigo-500/20 text-indigo-100 ring-indigo-400/40"
        : "bg-slate-800/90 text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-slate-100"
    }`;

  if (collapsed) {
    return (
      <div className="flex w-full flex-col items-stretch gap-2">
        <NavLink
          to="/account"
          title={`${user.name} — ${user.email}`}
          aria-current={accountActive ? "page" : undefined}
          className={`${iconShellClass(accountActive)} mx-auto`}
        >
          <IconPerson />
        </NavLink>
        <button type="button" onClick={doLogout} className={`${logoutRowClass} justify-center text-xs`}>
          <IconLogout />
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2">
      <NavLink
        to="/account"
        className={({ isActive }) =>
          `flex min-w-0 items-center gap-3 rounded-lg p-2 transition-colors ${
            isActive ? "bg-slate-800/80" : "hover:bg-slate-800/50"
          }`
        }
      >
        <span className={iconShellClass(accountActive)} aria-hidden>
          <IconPerson />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-100">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{user.email}</div>
        </div>
      </NavLink>
      <button type="button" onClick={doLogout} className={logoutRowClass}>
        <IconLogout />
        <span>Logout</span>
      </button>
    </div>
  );
}

function IconDashboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconRoadmaps() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 19V5M4 19h16M4 19H2M4 5h16M4 5H2M8 12h8M8 12V9m8 3v6M20 19h2M20 5h2" strokeLinecap="round" />
    </svg>
  );
}

function IconInitiatives() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconThemes() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3a6 6 0 0 0 6 6 6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6Z" />
      <path d="M12 9v6" strokeLinecap="round" />
    </svg>
  );
}

function IconTeams() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h2M21 20v-1a4 4 0 0 0-4-4h-1" strokeLinecap="round" />
    </svg>
  );
}

function IconPhases() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7h10M4 12h16M4 17h7" strokeLinecap="round" />
    </svg>
  );
}

function IconSponsors() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M12 11v4M10 13h4" strokeLinecap="round" />
    </svg>
  );
}

function IconImports() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 4v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function IconTemplates() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconBurger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const nav = [
  { label: "Dashboard", href: "/", Icon: IconDashboard },
  { label: "Roadmaps", href: "/roadmaps", Icon: IconRoadmaps },
  { label: "Initiatives", href: "/initiatives", Icon: IconInitiatives },
  { label: "Themes", href: "/themes", Icon: IconThemes },
  { label: "Teams", href: "/teams", Icon: IconTeams },
  { label: "Phases", href: "/phases", Icon: IconPhases },
  { label: "Business sponsors", href: "/sponsors", Icon: IconSponsors },
  { label: "Imports", href: "/imports", Icon: IconImports },
  { label: "Templates", href: "/templates", Icon: IconTemplates },
  { label: "Settings", href: "/settings", Icon: IconSettings },
] as const;

function navItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useLocation().pathname;
  const [collapsed, setCollapsed] = useState(false);

  const activeHref = useMemo(() => {
    for (const item of nav) {
      if (navItemActive(pathname, item.href)) return item.href;
    }
    return null;
  }, [pathname]);

  const toggle = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  return (
    <div
      className={`min-h-screen grid bg-slate-950 text-slate-100 transition-[grid-template-columns] duration-200 ease-out ${
        collapsed ? "grid-cols-[4rem_1fr]" : "grid-cols-[minmax(0,15rem)_1fr] md:grid-cols-[minmax(0,17rem)_1fr]"
      }`}
    >
      <aside
        className={`sticky top-0 z-20 flex h-screen max-h-screen flex-col self-start overflow-hidden border-r border-slate-800 ${
          collapsed ? "items-center px-2 py-4" : "p-5"
        }`}
      >
        <div className={`mb-4 flex w-full shrink-0 items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed && (
            <div className="min-w-0 text-lg font-semibold leading-tight tracking-tight">Roadmap Platform</div>
          )}
          <button
            type="button"
            onClick={toggle}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/60 ${
              collapsed ? "" : ""
            }`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation menu" : "Collapse navigation menu"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className={collapsed ? "opacity-100" : "opacity-90"}>
              {collapsed ? <IconBurger /> : <IconChevronLeft />}
            </span>
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pb-2">
          {nav.map(({ label, href, Icon }) => {
            const active = activeHref === href;
            return (
              <Link
                key={href}
                to={href}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-slate-900 text-white ring-1 ring-indigo-500/35"
                    : "text-slate-200 hover:bg-slate-900 hover:text-white"
                } ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}`}
              >
                <span
                  className={`flex shrink-0 text-slate-400 [&>svg]:text-indigo-300 ${
                    collapsed ? "scale-110" : ""
                  }`}
                >
                  <Icon />
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`mt-auto shrink-0 border-t border-slate-800 pt-3 ${collapsed ? "w-full" : ""}`}>
          <SidebarAccount collapsed={collapsed} />
        </div>
      </aside>

      <main className="min-w-0">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-slate-400">Portfolio planning</div>
            <div className="truncate text-lg font-semibold">Executive roadmap workspace</div>
          </div>
          <div className="flex min-w-0 shrink-0 justify-end">
            <Suspense
              fallback={
                <div className="hidden max-w-[min(18rem,50vw)] truncate rounded-full bg-indigo-600 px-3 py-1 text-sm text-white sm:block">
                  Workspace: …
                </div>
              }
            >
              <WorkspaceHeaderBadge />
            </Suspense>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
