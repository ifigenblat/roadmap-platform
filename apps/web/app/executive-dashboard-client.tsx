"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Period = "mtd" | "last_month" | "qtd" | "last_q" | "ytd" | "last_year" | "custom";

const PERIODS: { id: Period; label: string }[] = [
  { id: "mtd", label: "MTD" },
  { id: "last_month", label: "Last month" },
  { id: "qtd", label: "QTD" },
  { id: "last_q", label: "Last quarter" },
  { id: "ytd", label: "YTD" },
  { id: "last_year", label: "Last year" },
  { id: "custom", label: "Custom" },
];

/** Stable pseudo-trend for sparkline (visual only; not historical data). */
function sparklinePath(seed: number, w: number, h: number): string {
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const wave = Math.sin(seed * 0.13 + t * 4.2) * 0.22 + Math.cos(seed * 0.07 + t * 2.1) * 0.12;
    const y = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * Math.PI)) + wave;
    pts.push([(t * w) | 0, h - Math.max(2, Math.min(h - 2, y * h))]);
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
        const pct = Math.round((v / m) * 100);
        return (
          <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-[3rem] rounded-t-md bg-gradient-to-t from-indigo-700 to-sky-500/90 shadow-inner"
                style={{ height: `${Math.max(8, pct)}%` }}
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

export function ExecutiveDashboardClient({ stats }: { stats: DashboardStats }) {
  const [period, setPeriod] = useState<Period>("ytd");

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

  return (
    <div className="space-y-6">
      {/* Title row + filters (look & feel — period is UI state only for now) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Executive dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Portfolio snapshot — same data as your workspace; charts summarize live counts.
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
              defaultValue="all"
            >
              <option value="all">All workspaces</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-900/80 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  period === p.id
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            <span className="hidden sm:inline">View: </span>
            <span className="text-slate-400">{PERIODS.find((x) => x.id === period)?.label}</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active roadmaps"
          subtitle="Plans in motion"
          value={String(stats.activeRoadmaps)}
          footer={`${stats.totalRoadmaps} total roadmaps in workspace`}
          badge={{
            label: stats.activeRoadmaps > 0 ? "Live" : "Idle",
            className:
              stats.activeRoadmaps > 0
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-600/40 text-slate-400",
          }}
          sparkSeed={stats.activeRoadmaps * 7 + 13}
          sparkClass="stroke-emerald-400/90"
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
          sparkClass="stroke-sky-400/90"
        />
        <KpiCard
          title="Roadmap items"
          subtitle="Placements on timelines"
          value={String(stats.roadmapItems)}
          footer="Rows across all roadmaps"
          badge={{
            label: stats.roadmapItems > 20 ? "Dense" : "Lean",
            className: "bg-amber-500/15 text-amber-200",
          }}
          sparkSeed={stats.roadmapItems + 55}
          sparkClass="stroke-amber-400/85"
        />
        <KpiCard
          title="Strategic themes"
          subtitle="Pillars & groupings"
          value={String(stats.themes)}
          footer="Workspace + roadmap-scoped"
          badge={{
            label: stats.themes > 0 ? "Mapped" : "Add themes",
            className:
              stats.themes > 0 ? "bg-violet-500/20 text-violet-200" : "bg-slate-600/40 text-slate-400",
          }}
          sparkSeed={stats.themes * 11 + 3}
          sparkClass="stroke-violet-400/90"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-inner lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Portfolio footprint</h2>
              <p className="text-xs text-slate-500">Relative volume by entity type (live counts)</p>
            </div>
          </div>
          <PortfolioBars labels={barLabels} values={barValues} max={barMax} />
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-inner lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-100">Item status mix</h2>
            <p className="text-xs text-slate-500">All roadmap items — delivery state</p>
          </div>
          {stats.roadmapItems === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No roadmap items yet.</p>
          ) : (
            <StatusDonut entries={donutEntries} />
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/roadmaps"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Open roadmaps
            </Link>
            <Link href="/initiatives" className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
              Initiatives
            </Link>
            <Link href="/themes" className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
              Themes
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace pulse</h3>
          <p className="mt-2 text-sm text-slate-400">
            Combined initiative + item count: <span className="font-semibold text-slate-200">{s}</span> entities in
            motion. Sparklines are illustrative curves tied to your totals (not stored history).
          </p>
        </div>
      </div>
    </div>
  );
}
