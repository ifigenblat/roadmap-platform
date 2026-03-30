import type { ReactNode } from "react";

function IconSearch() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

/** Top bar: search (primary) + optional actions (e.g. Create button that opens a modal). */
export function PageToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  searchId = "page-search",
  actions,
}: {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchId?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="relative min-w-[min(100%,12rem)] flex-1" htmlFor={searchId}>
        <span className="sr-only">Search</span>
        <IconSearch />
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>
      {actions != null ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
