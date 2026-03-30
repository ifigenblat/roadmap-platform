import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useMemo, useRef, useState } from "react";
import { DateRangeCalendar } from "../components/date-range-calendar";
import type { DashboardPeriod } from "../lib/dashboard-period";
import { workspaceOptionLabel } from "../lib/workspace-display";

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "mtd", label: "MTD" },
  { id: "last_month", label: "Last month" },
  { id: "qtd", label: "QTD" },
  { id: "last_q", label: "Last quarter" },
  { id: "ytd", label: "YTD" },
  { id: "last_year", label: "Last year" },
  { id: "custom", label: "Custom" },
];

/** Quantize sparkline points so SSR/CSR paths match (avoids hydration mismatch). */
function q(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sparklinePath(seed: number, w: number, h: number): string {
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const wave = Math.sin(seed * 0.13 + t * 4.2) * 0.22 + Math.cos(seed * 0.07 + t * 2.1) * 0.12;
    const y = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * Math.PI)) + wave;
    pts.push([q(t * w), q(h - Math.max(2, Math.min(h - 2, y * h)))]);
  }
  return pts.map((p) => p.join(",")).join(" ");
}

function Sparkline({ seed, className }: { seed: number; className?: string }) {
  const w = 112;
  const h = 36;
  const points = sparklinePath(seed, w, h);
  return (
    <svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function KpiCard({
  title,
  subtitle,
  value,
  footer,
  badge,
  sparkSeed,
  sparkClass,
}: {
  title: string;
  subtitle: string;
  value: string;
  footer: string;
  badge: { label: string; className: string };
  sparkSeed: number;
  sparkClass: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-800/80 to-slate-900/90 p-4 shadow-lg shadow-black/20">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-50">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <Sparkline seed={sparkSeed} className={sparkClass} />
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mt-2 border-t border-slate-700/60 pt-2 text-[11px] text-slate-500">{footer}</div>
    </div>
  );
}

const BAR_AREA_PX = 208;

function PortfolioBars({
  labels,
  values,
  max,
}: {
  labels: string[];
  values: number[];
  max: number;
}) {
  const m = Math.max(max, 1);
  return (
    <div className="flex h-52 items-end justify-between gap-2 px-1">
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        const hPx = Math.max(8, Math.round((v / m) * BAR_AREA_PX));
        return (
          <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="flex w-full flex-1 items-end justify-center"
              style={{ minHeight: BAR_AREA_PX }}
            >
              <div
                className="w-full max-w-[3rem] rounded-t-md bg-gradient-to-t from-indigo-700 to-sky-500/90 shadow-inner transition-[height]"
                style={{ height: hPx }}
                title={`${label}: ${v}`}
              />
            </div>
            <span className="max-w-full truncate text-center text-[10px] font-medium text-slate-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#38bdf8",
  at_risk: "#fb923c",
  done: "#34d399",
};

function StatusDonut({
  entries,
}: {
  entries: { key: string; count: number; pct: number }[];
}) {
  let acc = 0;
  const slices = entries.map((e) => {
    const start = acc;
    acc += e.pct;
    const color = STATUS_COLORS[e.key] ?? "#64748b";
    return `${color} ${start}% ${acc}%`;
  });
  const gradient =
    slices.length > 0 ? `conic-gradient(${slices.join(", ")})` : "conic-gradient(#334155 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full p-3 shadow-inner ring-1 ring-slate-700/80"
        style={{ background: gradient }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-center text-lg font-semibold text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          {entries.reduce((s, e) => s + e.count, 0)}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[e.key] ?? "#64748b" }}
            />
            <span className="text-slate-300 capitalize">{e.key.replace(/_/g, " ")}</span>
            <span className="ml-auto tabular-nums text-slate-500">
              {e.count} ({e.pct.toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type DashboardStats = {
  activeRoadmaps: number;
  totalRoadmaps: number;
  initiatives: number;
  themes: number;
  teams: number;
  sponsors: number;
  roadmapItems: number;
  itemStatus: Record<string, number>;
};

type WorkspaceOption = { id: string; name: string; slug?: string };

export function ExecutiveDashboardClient({
  workspaces,
  stats,
  initialWorkspaceId,
  initialPeriod,
  initialPeriodFrom,
  initialPeriodTo,
  periodCaption,
}: {
  workspaces: WorkspaceOption[];
  stats: DashboardStats;
  initialWorkspaceId: string;
  initialPeriod: DashboardPeriod;
  initialPeriodFrom: string;
  initialPeriodTo: string;
  periodCaption: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customAnchorRef = useRef<HTMLButtonElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const pushFilters = useCallback(
    (opts: {
      workspaceId?: string;
      period?: DashboardPeriod;
      periodFrom?: string;
      periodTo?: string;
      clearPeriodFrom?: boolean;
      clearPeriodTo?: boolean;
    }) => {
      const p = new URLSearchParams(searchParams?.toString() ?? "");
      if (opts.workspaceId !== undefined) {
        if (opts.workspaceId) p.set("workspace", opts.workspaceId);
        else p.delete("workspace");
      }
      if (opts.period !== undefined) {
        p.set("period", opts.period);
      }
      if (opts.clearPeriodFrom) p.delete("periodFrom");
      else if (opts.periodFrom !== undefined) {
        if (opts.periodFrom) p.set("periodFrom", opts.periodFrom);
        else p.delete("periodFrom");
      }
      if (opts.clearPeriodTo) p.delete("periodTo");
      else if (opts.periodTo !== undefined) {
        if (opts.periodTo) p.set("periodTo", opts.periodTo);
        else p.delete("periodTo");
      }
      const qs = p.toString();
      navigate(qs ? `/?${qs}` : "/");
    },
    [navigate, searchParams],
  );

  const donutEntries = useMemo(() => {
    const total = stats.roadmapItems || 1;
    const keys = Object.keys(stats.itemStatus).sort();
    if (keys.length === 0) {
      return [{ key: "none", count: 0, pct: 100 }];
    }
    return keys.map((key) => ({
      key,
      count: stats.itemStatus[key],
      pct: (stats.itemStatus[key] / total) * 100,
    }));
  }, [stats.itemStatus, stats.roadmapItems]);

  const barLabels = ["Roadmaps", "Initiatives", "Themes", "Teams", "Sponsors"];
  const barValues = [
    stats.totalRoadmaps,
    stats.initiatives,
    stats.themes,
    stats.teams,
    stats.sponsors,
  ];
  const barMax = Math.max(...barValues, 1);

  const s = stats.initiatives + stats.roadmapItems;

  const workspaceQs = initialWorkspaceId
    ? `?workspace=${encodeURIComponent(initialWorkspaceId)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Executive dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Portfolio snapshot — filters scope counts and the item status mix to the selected period (roadmap items with
            valid start/end dates that overlap the range).
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="ws-filter">
              Workspace
            </label>
            <select
              id="ws-filter"
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              value={initialWorkspaceId || ""}
              onChange={(e) => pushFilters({ workspaceId: e.target.value })}
            >
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {workspaceOptionLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-900/80 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                ref={p.id === "custom" ? customAnchorRef : undefined}
                type="button"
                onClick={() => {
                  if (p.id === "custom") {
                    pushFilters({ period: "custom" });
                    setCalendarOpen((o) => !o);
                    return;
                  }
                  setCalendarOpen(false);
                  pushFilters({ period: p.id, clearPeriodFrom: true, clearPeriodTo: true });
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  initialPeriod === p.id
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {calendarOpen && initialPeriod === "custom" && (
            <DateRangeCalendar
              anchorRef={customAnchorRef}
              from={initialPeriodFrom}
              to={initialPeriodTo}
              onChange={(from, to) => pushFilters({ period: "custom", periodFrom: from, periodTo: to })}
              onClose={() => setCalendarOpen(false)}
            />
          )}
          <div className="text-xs text-slate-500">
            <span className="hidden sm:inline">Range: </span>
            <span className="text-slate-400">{periodCaption || PERIODS.find((x) => x.id === initialPeriod)?.label}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active roadmaps"
          subtitle="Plans in motion"
          value={String(stats.activeRoadmaps)}
          footer={`${stats.totalRoadmaps} total roadmaps in scope`}
          badge={{
            label: stats.activeRoadmaps > 0 ? "Live" : "Idle",
            className:
              stats.activeRoadmaps > 0
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-600/40 text-slate-400",
          }}
          sparkSeed={stats.activeRoadmaps * 7 + 13}
          sparkClass="text-emerald-400/90"
        />
        <KpiCard
          title="Initiatives"
          subtitle="Canonical portfolio items"
          value={String(stats.initiatives)}
          footer="Linked to themes & roadmaps"
          badge={{
            label: stats.initiatives > 5 ? "Scale" : "Growing",
            className: "bg-sky-500/20 text-sky-300",
          }}
          sparkSeed={stats.initiatives * 3 + 101}
          sparkClass="text-sky-400/90"
        />
        <KpiCard
          title="Roadmap items"
          subtitle="Overlapping selected period"
          value={String(stats.roadmapItems)}
          footer="Items with start/end overlapping the range"
          badge={{
            label: stats.roadmapItems > 20 ? "Dense" : "Lean",
            className: "bg-amber-500/15 text-amber-200",
          }}
          sparkSeed={stats.roadmapItems + 55}
          sparkClass="text-amber-400/85"
        />
        <KpiCard
          title="Strategic themes"
          subtitle="Pillars & groupings"
          value={String(stats.themes)}
          footer="In selected workspace(s)"
          badge={{
            label: stats.themes > 0 ? "Mapped" : "Add themes",
            className:
              stats.themes > 0 ? "bg-violet-500/20 text-violet-200" : "bg-slate-600/40 text-slate-400",
          }}
          sparkSeed={stats.themes * 11 + 3}
          sparkClass="text-violet-400/90"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-inner lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Portfolio footprint</h2>
              <p className="text-xs text-slate-500">
                Volume by entity type. Team count is portfolio-wide; other bars use the workspace filter.
              </p>
            </div>
          </div>
          <PortfolioBars labels={barLabels} values={barValues} max={barMax} />
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-inner lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-100">Item status mix</h2>
            <p className="text-xs text-slate-500">Roadmap items overlapping the selected period</p>
          </div>
          {stats.roadmapItems === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No roadmap items in this period{initialPeriod === "custom" ? " (choose valid start/end dates)" : ""}.
            </p>
          ) : (
            <StatusDonut entries={donutEntries} />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/roadmaps${workspaceQs}`}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Open roadmaps
            </Link>
            <Link
              to={`/initiatives${workspaceQs}`}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Initiatives
            </Link>
            <Link
              to={`/themes${workspaceQs}`}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Themes
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace pulse</h3>
          <p className="mt-2 text-sm text-slate-400">
            Combined initiative + period-scoped item count:{" "}
            <span className="font-semibold text-slate-200">{s}</span>. Sparklines are illustrative (not stored history).
          </p>
        </div>
      </div>
    </div>
  );
}
