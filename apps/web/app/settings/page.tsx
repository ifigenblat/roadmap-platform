import Link from "next/link";

export default function SettingsHomePage() {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-white">Overview</h2>
      <p className="mb-6 max-w-xl text-sm text-slate-400">
        Use the sections on the left to manage how this workspace talks to external tools.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings/workspaces"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-indigo-500/50 hover:bg-slate-800"
        >
          Workspaces
          <span aria-hidden className="text-slate-500">
            →
          </span>
        </Link>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-indigo-500/50 hover:bg-slate-800"
        >
          Integrations
          <span aria-hidden className="text-slate-500">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
