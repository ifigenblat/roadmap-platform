"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLayout } from "../../components/layout";

const settingsNav = [
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
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Workspace configuration and external system connections.
          </p>
        </header>
        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <nav className="flex shrink-0 flex-col gap-1 md:w-52" aria-label="Settings sections">
            {settingsNav.map(({ label, href, description }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-slate-900 text-white ring-1 ring-indigo-500/40"
                      : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{description}</div>
                </Link>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AppLayout>
  );
}
