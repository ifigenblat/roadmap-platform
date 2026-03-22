"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormModal, ModalActions } from "../../../../components/form-modal";
import { sendJson } from "../../../../lib/api";
import { ToastViewport, useToasts } from "../../../../lib/toast";
import { assignLanes, laneCountFromMap, type SegmentForLane } from "./timeline-lanes";
import {
  buildTicks,
  buildYearSpans,
  formatDateRangePretty,
  formatMonthLabel,
  formatQuarterLabel,
  isValidYmd,
  oneDayWidthPercent,
  type TimelineZoom,
  ymdToMs,
} from "./timeline-utils";

export type TimelineItem = {
  id: string;
  status: string;
  titleOverride?: string | null;
  priority?: string;
  startDate: string;
  endDate: string;
  riskLevel?: string | null;
  laneKey?: string | null;
  sortOrder?: number;
  initiative: {
    id: string;
    canonicalName: string;
    themes?: Array<{ strategicTheme: { id: string; name: string } }>;
  };
  phases: Array<{
    id: string;
    phaseName: string;
    startDate: string;
    endDate: string;
    status?: string | null;
    capacityAllocationEstimate?: number | null;
    sprintEstimate?: number | null;
    teamSummary?: string | null;
    jiraKey?: string | null;
    notes?: string | null;
  }>;
  teams: Array<{ team: { id: string; name: string } }>;
};

/** String form state for PATCH /roadmap-items/:id */
export type ItemEditForm = {
  titleOverride: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  riskLevel: string;
  laneKey: string;
  sortOrder: string;
};

/** String form state for PATCH /phase-segments/:id */
export type PhaseEditForm = {
  phaseName: string;
  startDate: string;
  endDate: string;
  status: string;
  capacityAllocationEstimate: string;
  sprintEstimate: string;
  teamSummary: string;
  jiraKey: string;
  notes: string;
};

export type TimelineSegment = {
  key: string;
  itemId: string;
  /** When set, editing targets this phase; otherwise the roadmap item. */
  phaseSegmentId: string | null;
  initiativeId: string;
  initiativeName: string;
  /** Full row label (initiative — phase or initiative only) */
  label: string;
  /** Phase name when applicable, for bar title line */
  phaseName: string | null;
  start: string;
  end: string;
  status: string;
  groupTheme: string;
  groupTeam: string;
  /** Form defaults when opening the editor (item row vs phase row). */
  itemForm?: ItemEditForm;
  phaseForm?: PhaseEditForm;
};

const LABEL_COL_CLASS = "min-w-[280px] max-w-[320px] w-[min(30vw,320px)] shrink-0";
const LANE_HEIGHT_PX = 52;
const CHART_MIN = 720;

const ITEM_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "at_risk", label: "At risk" },
  { value: "done", label: "Done" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

function sliceYmd(s: string): string {
  return String(s).slice(0, 10);
}

function safeYmd(s: string, fallback: string): string {
  const t = sliceYmd(s);
  return isValidYmd(t) ? t : fallback;
}

function toSegments(items: TimelineItem[]): TimelineSegment[] {
  const out: TimelineSegment[] = [];
  for (const item of items) {
    const theme =
      (item.initiative.themes ?? []).map((t) => t.strategicTheme.name).join(", ") || "Ungrouped";
    const team =
      item.teams.map((t) => t.team.name).join(", ") || "Unassigned";

    if (item.phases.length === 0) {
      let start = safeYmd(item.startDate, "1970-01-01");
      let end = safeYmd(item.endDate, start);
      if (!isValidYmd(start) || !isValidYmd(end)) continue;
      if (ymdToMs(start) > ymdToMs(end)) {
        const t = start;
        start = end;
        end = t;
      }
      out.push({
        key: `${item.id}-item`,
        itemId: item.id,
        phaseSegmentId: null,
        initiativeId: item.initiative.id,
        initiativeName: item.initiative.canonicalName,
        label: item.initiative.canonicalName,
        phaseName: null,
        start,
        end,
        status: item.status,
        groupTheme: theme,
        groupTeam: team,
        itemForm: {
          titleOverride: item.titleOverride ?? "",
          status: item.status,
          priority: item.priority ?? "medium",
          startDate: start,
          endDate: end,
          riskLevel: item.riskLevel ?? "",
          laneKey: item.laneKey ?? "",
          sortOrder: String(item.sortOrder ?? 0),
        },
      });
      continue;
    }
    for (const ph of item.phases) {
      let start = safeYmd(ph.startDate, "1970-01-01");
      let end = safeYmd(ph.endDate, start);
      if (!isValidYmd(start) || !isValidYmd(end)) continue;
      if (ymdToMs(start) > ymdToMs(end)) {
        const t = start;
        start = end;
        end = t;
      }
      out.push({
        key: `${item.id}-${ph.id}`,
        itemId: item.id,
        phaseSegmentId: ph.id,
        initiativeId: item.initiative.id,
        initiativeName: item.initiative.canonicalName,
        label: `${item.initiative.canonicalName} — ${ph.phaseName}`,
        phaseName: ph.phaseName,
        start,
        end,
        status: ph.status || item.status,
        groupTheme: theme,
        groupTeam: team,
        phaseForm: {
          phaseName: ph.phaseName,
          startDate: start,
          endDate: end,
          status: ph.status ?? "",
          capacityAllocationEstimate:
            ph.capacityAllocationEstimate != null && ph.capacityAllocationEstimate !== undefined
              ? String(ph.capacityAllocationEstimate)
              : "",
          sprintEstimate:
            ph.sprintEstimate != null && ph.sprintEstimate !== undefined ? String(ph.sprintEstimate) : "",
          teamSummary: ph.teamSummary ?? "",
          jiraKey: ph.jiraKey ?? "",
          notes: ph.notes ?? "",
        },
      });
    }
  }
  return out.sort((a, b) =>
    a.initiativeName === b.initiativeName
      ? a.label.localeCompare(b.label)
      : a.initiativeName.localeCompare(b.initiativeName)
  );
}

/** Pastel Gantt-style fills (reference: blue / green / yellow / pink families). */
function barVisual(status: string): { bar: string; text: string } {
  switch (status) {
    case "done":
      return {
        bar: "bg-emerald-200/95 shadow-sm",
        text: "text-emerald-950",
      };
    case "in_progress":
      return {
        bar: "bg-sky-200/95 shadow-sm",
        text: "text-sky-950",
      };
    case "at_risk":
      return {
        bar: "bg-rose-200/95 shadow-sm",
        text: "text-rose-950",
      };
    default:
      return {
        bar: "bg-amber-100/95 shadow-sm",
        text: "text-amber-950",
      };
  }
}

function barTitle(seg: TimelineSegment): string {
  if (seg.phaseName) {
    return `${seg.initiativeName} — ${seg.phaseName}`;
  }
  return seg.initiativeName;
}

function statusLabel(raw: string): string {
  return raw.replace(/_/g, " ");
}

type HoverTipState = {
  row: TimelineSegment;
  anchor: { left: number; top: number; width: number; height: number };
};

function statusOnDarkTooltip(status: string): string {
  switch (status) {
    case "done":
      return "text-emerald-300";
    case "in_progress":
      return "text-sky-300";
    case "at_risk":
      return "text-rose-300";
    default:
      return "text-amber-200";
  }
}

function TimelineBarTooltip({ row }: { row: TimelineSegment }) {
  return (
    <div
      className="w-max max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-left shadow-2xl ring-1 ring-slate-700/90"
      role="tooltip"
    >
      <p className="text-[13px] font-semibold leading-snug text-slate-50">{row.initiativeName}</p>
      {row.phaseName ? (
        <p className="mt-1 text-xs leading-snug text-slate-300">
          <span className="text-slate-500">Phase</span> · {row.phaseName}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-300">
        <span className="text-slate-500">Dates</span> · {formatDateRangePretty(row.start, row.end)}
        <span className="text-slate-600"> ({row.start} → {row.end})</span>
      </p>
      <p className="mt-1.5 text-xs">
        <span className="text-slate-500">Status</span> ·{" "}
        <span className={`font-medium ${statusOnDarkTooltip(row.status)}`}>
          {statusLabel(row.status)}
        </span>
      </p>
      <p className="mt-1.5 text-xs text-slate-400">
        <span className="text-slate-500">Themes</span> · {row.groupTheme}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        <span className="text-slate-500">Teams</span> · {row.groupTeam}
      </p>
      <p className="mt-2 border-t border-slate-700/80 pt-2 text-[11px] text-slate-500">
        Full label: {row.label}
      </p>
    </div>
  );
}

export type GroupMode = "theme" | "team" | "flat";

export type TimelineDomainMode = "data" | "roadmap";

export function TimelineClient({
  roadmapId,
  roadmapName,
  roadmapStart,
  roadmapEnd,
  items,
}: {
  roadmapId: string;
  roadmapName: string;
  roadmapStart: string;
  roadmapEnd: string;
  items: TimelineItem[];
}) {
  const [zoom, setZoom] = useState<TimelineZoom>("quarter");
  const [groupBy, setGroupBy] = useState<GroupMode>("theme");
  const [domainMode, setDomainMode] = useState<TimelineDomainMode>("data");
  const [hoverTip, setHoverTip] = useState<HoverTipState | null>(null);
  const [editRow, setEditRow] = useState<TimelineSegment | null>(null);
  const [itemForm, setItemForm] = useState<ItemEditForm | null>(null);
  const [phaseForm, setPhaseForm] = useState<PhaseEditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const todayLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clear = () => setHoverTip(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, []);

  const segments = useMemo(() => toSegments(items), [items]);

  const roadmapWindow = useMemo(() => {
    const rs = sliceYmd(roadmapStart);
    const re = sliceYmd(roadmapEnd);
    if (!isValidYmd(rs) || !isValidYmd(re)) return null;
    let lo = ymdToMs(rs);
    let hi = ymdToMs(re);
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    const pad = 86400000 * 14;
    const d0 = lo - pad;
    const d1 = hi + pad;
    const span = d1 - d0;
    return {
      domainStart: d0,
      domainEnd: d1,
      domainMs: span > 0 ? span : 86400000,
    };
  }, [roadmapStart, roadmapEnd]);

  const dataDomain = useMemo(() => {
    const rs = sliceYmd(roadmapStart);
    const re = sliceYmd(roadmapEnd);
    let lo = isValidYmd(rs) ? ymdToMs(rs) : Number.POSITIVE_INFINITY;
    let hi = isValidYmd(re) ? ymdToMs(re) : Number.NEGATIVE_INFINITY;

    for (const s of segments) {
      const a = ymdToMs(s.start);
      const b = ymdToMs(s.end);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a <= b) {
        lo = Math.min(lo, a);
        hi = Math.max(hi, b);
      }
    }

    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
      const now = new Date();
      const y = now.getUTCFullYear();
      lo = Date.UTC(y, 0, 1);
      hi = Date.UTC(y, 11, 31);
    }

    const pad = 86400000 * 14;
    const d0 = lo - pad;
    const d1 = hi + pad;
    const span = d1 - d0;
    return {
      domainStart: d0,
      domainEnd: d1,
      domainMs: span > 0 ? span : 86400000,
    };
  }, [roadmapStart, roadmapEnd, segments]);

  const { domainStart, domainEnd, domainMs } =
    domainMode === "roadmap" && roadmapWindow ? roadmapWindow : dataDomain;

  const ticks = useMemo(
    () => buildTicks(domainStart, domainEnd, zoom),
    [domainStart, domainEnd, zoom]
  );

  const yearSpans = useMemo(
    () => buildYearSpans(domainStart, domainEnd, domainMs),
    [domainStart, domainEnd, domainMs]
  );

  const pxPerTick = zoom === "quarter" ? 128 : 64;
  const chartMinWidth = Math.max(CHART_MIN, ticks.length * pxPerTick);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineSegment[]>();
    for (const s of segments) {
      const key =
        groupBy === "theme"
          ? s.groupTheme
          : groupBy === "team"
            ? s.groupTeam
            : "__all__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const keys = [...map.keys()].filter((k) => k !== "__all__").sort((a, b) => a.localeCompare(b));
    if (map.has("__all__")) keys.unshift("__all__");
    return keys.map((k) => {
      const rows = (map.get(k) ?? []).sort((a, b) => a.label.localeCompare(b.label));
      const lanes = assignLanes(rows as SegmentForLane[]);
      const lanesN = laneCountFromMap(lanes);
      return {
        title: k === "__all__" ? "Roadmap" : k,
        rows,
        lanes,
        lanesN,
        heightPx: Math.max(LANE_HEIGHT_PX, lanesN * LANE_HEIGHT_PX + 8),
      };
    });
  }, [segments, groupBy]);

  function barStyle(startIso: string, endIso: string): { left: string; width: string } {
    let a = ymdToMs(startIso);
    let b = ymdToMs(endIso);
    if (!Number.isFinite(a) || !Number.isFinite(b) || domainMs <= 0) {
      return { left: "0%", width: `${oneDayWidthPercent(domainMs)}%` };
    }
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    const left = ((a - domainStart) / domainMs) * 100;
    let w = ((b - a) / domainMs) * 100;
    if (w < 0.001) {
      w = oneDayWidthPercent(domainMs);
    }
    return {
      left: `${Math.max(0, Math.min(100, left))}%`,
      width: `${Math.max(0.35, Math.min(100 - Math.max(0, left), w))}%`,
    };
  }

  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayLeft =
    todayUtcMs >= domainStart && todayUtcMs <= domainEnd
      ? `${((todayUtcMs - domainStart) / domainMs) * 100}%`
      : null;

  const chartAreaStyle = { minWidth: Math.max(400, chartMinWidth) };

  function openBarEdit(row: TimelineSegment) {
    setEditRow(row);
    setItemForm(row.itemForm ? { ...row.itemForm } : null);
    setPhaseForm(row.phaseForm ? { ...row.phaseForm } : null);
  }

  function closeBarEdit() {
    setEditRow(null);
    setItemForm(null);
    setPhaseForm(null);
  }

  function parseOptNumber(raw: string): number | null {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function saveBarEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;

    if (editRow.phaseSegmentId && phaseForm) {
      const start = phaseForm.startDate.slice(0, 10);
      const end = phaseForm.endDate.slice(0, 10);
      if (!isValidYmd(start) || !isValidYmd(end) || ymdToMs(start) > ymdToMs(end)) {
        push("Use valid dates with end on or after start.", "error");
        return;
      }
      const cap = parseOptNumber(phaseForm.capacityAllocationEstimate);
      const spr = parseOptNumber(phaseForm.sprintEstimate);
      if (phaseForm.capacityAllocationEstimate.trim() !== "" && cap === null) {
        push("Capacity estimate must be a number or empty.", "error");
        return;
      }
      if (phaseForm.sprintEstimate.trim() !== "" && spr === null) {
        push("Sprint estimate must be a number or empty.", "error");
        return;
      }
      setEditSaving(true);
      try {
        await sendJson(`/api/phase-segments/${editRow.phaseSegmentId}`, "PATCH", {
          phaseName: phaseForm.phaseName.trim(),
          startDate: start,
          endDate: end,
          status: phaseForm.status.trim() || null,
          capacityAllocationEstimate: cap,
          sprintEstimate: spr,
          teamSummary: phaseForm.teamSummary.trim() || null,
          jiraKey: phaseForm.jiraKey.trim() || null,
          notes: phaseForm.notes.trim() || null,
        });
        push("Phase updated.");
        closeBarEdit();
        router.refresh();
      } catch (err) {
        push(`Save failed: ${String(err)}`, "error");
      } finally {
        setEditSaving(false);
      }
      return;
    }

    if (!editRow.phaseSegmentId && itemForm) {
      const start = itemForm.startDate.slice(0, 10);
      const end = itemForm.endDate.slice(0, 10);
      if (!isValidYmd(start) || !isValidYmd(end) || ymdToMs(start) > ymdToMs(end)) {
        push("Use valid dates with end on or after start.", "error");
        return;
      }
      const sortOrder = Number.parseInt(itemForm.sortOrder, 10);
      if (!Number.isFinite(sortOrder)) {
        push("Sort order must be an integer.", "error");
        return;
      }
      setEditSaving(true);
      try {
        await sendJson(`/api/roadmap-items/${editRow.itemId}`, "PATCH", {
          titleOverride: itemForm.titleOverride.trim() || null,
          status: itemForm.status,
          priority: itemForm.priority,
          startDate: start,
          endDate: end,
          riskLevel: itemForm.riskLevel.trim() || null,
          laneKey: itemForm.laneKey.trim() || null,
          sortOrder,
        });
        push("Roadmap item updated.");
        closeBarEdit();
        router.refresh();
      } catch (err) {
        push(`Save failed: ${String(err)}`, "error");
      } finally {
        setEditSaving(false);
      }
    }
  }

  function GridLines({ className }: { className?: string }) {
    return (
      <>
        {ticks.map((t, i) => {
          const left = ((t - domainStart) / domainMs) * 100;
          return (
            <div
              key={`grid-${t}-${i}`}
              className={`pointer-events-none absolute top-0 bottom-0 border-l border-slate-600/35 ${className ?? ""}`}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Zoom</span>
          <div className="flex rounded-lg border border-slate-700 p-0.5">
            {(["quarter", "month"] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  zoom === z ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {z === "quarter" ? "Quarter" : "Month"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Group</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupMode)}
          >
            <option value="theme">By theme (pillar)</option>
            <option value="team">By team</option>
            <option value="flat">Single swimlane</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Window</span>
          <div className="flex rounded-lg border border-slate-700 p-0.5">
            {(
              [
                ["data", "Fit data"],
                ["roadmap", "Roadmap dates"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={id === "roadmap" && !roadmapWindow}
                title={
                  id === "roadmap" && !roadmapWindow
                    ? "Set valid roadmap start/end on the roadmap record"
                    : undefined
                }
                onClick={() => setDomainMode(id)}
                className={`rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  domainMode === id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          disabled={todayLeft == null}
          onClick={() =>
            todayLineRef.current?.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest",
            })
          }
        >
          Scroll to today
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 shadow-inner">
        <div className="min-w-0" style={{ minWidth: chartMinWidth + 300 }}>
          {segments.length === 0 && (
            <div className="border-b border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              <p>No timeline rows yet. Add initiatives to this roadmap (and phases if you use them) in the</p>
              <Link href={`/roadmaps/${roadmapId}`} className="text-indigo-400 hover:text-indigo-300">
                {" "}
                grid view
              </Link>
              .
            </div>
          )}

          {/* Two-row time header: years + quarters/months */}
          <div className="flex border-b border-slate-700 bg-slate-950">
            <div
              className={`${LABEL_COL_CLASS} sticky left-0 z-30 border-r border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}
            >
              Theme / group
            </div>
            <div className="relative min-w-0 flex-1" style={chartAreaStyle}>
              {/* Year band row */}
              <div className="relative h-8 border-b border-slate-700/80 bg-slate-900/50">
                {yearSpans.map((ys) => (
                  <div
                    key={ys.year}
                    className="absolute top-0 flex h-full items-center justify-center border-r border-slate-700/60 text-sm font-semibold text-slate-300"
                    style={{
                      left: `${ys.leftPct}%`,
                      width: `${ys.widthPct}%`,
                    }}
                  >
                    {ys.year}
                  </div>
                ))}
              </div>
              {/* Quarter / month row */}
              <div className="relative h-10 bg-slate-900/80">
                <GridLines />
                {ticks.map((t, i) => {
                  const left = ((t - domainStart) / domainMs) * 100;
                  const label = zoom === "quarter" ? formatQuarterLabel(t) : formatMonthLabel(t);
                  return (
                    <div
                      key={`hk-${t}-${i}`}
                      className="absolute top-0 flex h-full items-end pb-1.5 pl-1"
                      style={{ left: `${left}%` }}
                    >
                      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Category rows: left = theme name, right = stacked Gantt bars */}
          {groups.map((g, groupIdx) => (
            <div key={g.title} className="flex border-b border-slate-700 last:border-b-0">
              <div
                className={`${LABEL_COL_CLASS} sticky left-0 z-20 flex items-start border-r border-slate-700 bg-slate-950 px-3 py-3 text-sm font-semibold leading-snug text-slate-100`}
                style={{ minHeight: g.heightPx }}
              >
                {groupBy !== "flat" ? (
                  <span className="line-clamp-6">{g.title}</span>
                ) : (
                  <span className="line-clamp-6 text-slate-200">{roadmapName}</span>
                )}
              </div>
              <div
                className="relative min-w-0 flex-1 bg-slate-900/30"
                style={{ ...chartAreaStyle, minHeight: g.heightPx }}
              >
                <div className="relative h-full w-full">
                  <GridLines />
                  {todayLeft != null && (
                    <div
                      ref={groupIdx === 0 ? todayLineRef : undefined}
                      className="pointer-events-none absolute top-0 z-10 h-full w-px bg-rose-500/80"
                      style={{ left: todayLeft }}
                      title="Today"
                    />
                  )}
                  {g.rows.map((row) => {
                    const lane = g.lanes.get(row.key) ?? 0;
                    const top = 4 + lane * LANE_HEIGHT_PX;
                    const vis = barVisual(row.status);
                    const st = barStyle(row.start, row.end);
                    return (
                      <div
                        key={row.key}
                        className="absolute z-[5] flex min-w-0 items-stretch gap-0"
                        style={{
                          ...st,
                          top,
                          height: LANE_HEIGHT_PX - 6,
                          minWidth: "2.5rem",
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverTip({
                            row,
                            anchor: {
                              left: rect.left,
                              top: rect.top,
                              width: rect.width,
                              height: rect.height,
                            },
                          });
                        }}
                        onMouseLeave={() => setHoverTip(null)}
                      >
                        <Link
                          href={`/initiatives/${row.initiativeId}`}
                          className={`flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-l-md border border-slate-600/25 px-2 py-1 transition hover:brightness-105 hover:ring-2 hover:ring-indigo-500/40 ${vis.bar}`}
                          aria-label={`${barTitle(row)}, ${formatDateRangePretty(row.start, row.end)}`}
                        >
                          <span className={`line-clamp-2 text-[11px] font-semibold leading-tight ${vis.text}`}>
                            {barTitle(row)}
                          </span>
                          <span className={`truncate text-[10px] leading-tight opacity-90 ${vis.text}`}>
                            {formatDateRangePretty(row.start, row.end)}
                          </span>
                        </Link>
                        <button
                          type="button"
                          title="Edit row"
                          className={`flex h-full w-[22px] min-w-[22px] max-w-[22px] shrink-0 items-center justify-center rounded-r-md border-l border-slate-600/40 px-0.5 transition hover:brightness-110 ${vis.bar}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openBarEdit(row);
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={vis.text}
                            aria-hidden
                          >
                            <path d="M12 20h9" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Gantt-style timeline for <span className="text-slate-400">{roadmapName}</span>. Overlapping work in
        the same group stacks vertically. <strong className="font-medium text-slate-400">Window</strong>{" "}
        chooses whether the axis spans item dates (with padding) or the roadmap’s planned start/end. Use the
        edit control on the right of each bar to change fields here, or edit in the{" "}
        <Link href={`/roadmaps/${roadmapId}`} className="text-indigo-400 hover:text-indigo-300">
          grid view
        </Link>
        .
      </p>

      <FormModal
        open={!!editRow && !!(itemForm || phaseForm)}
        onClose={() => {
          if (!editSaving) closeBarEdit();
        }}
        title={editRow?.phaseSegmentId ? "Edit phase" : "Edit roadmap item"}
        subtitle={editRow?.label}
        titleId="timeline-edit-title"
      >
        <form onSubmit={saveBarEdit}>
            {phaseForm && editRow?.phaseSegmentId ? (
              <div className="mt-4 space-y-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Phase name</span>
                  <input
                    required
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={phaseForm.phaseName}
                    onChange={(e) => setPhaseForm((f) => (f ? { ...f, phaseName: e.target.value } : f))}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Start</span>
                    <input
                      type="date"
                      required
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={phaseForm.startDate.slice(0, 10)}
                      onChange={(e) => setPhaseForm((f) => (f ? { ...f, startDate: e.target.value } : f))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">End</span>
                    <input
                      type="date"
                      required
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={phaseForm.endDate.slice(0, 10)}
                      onChange={(e) => setPhaseForm((f) => (f ? { ...f, endDate: e.target.value } : f))}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Status (optional)</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={phaseForm.status}
                    onChange={(e) => setPhaseForm((f) => (f ? { ...f, status: e.target.value } : f))}
                    placeholder="e.g. in_progress"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Capacity estimate</span>
                    <input
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={phaseForm.capacityAllocationEstimate}
                      onChange={(e) =>
                        setPhaseForm((f) => (f ? { ...f, capacityAllocationEstimate: e.target.value } : f))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Sprint estimate</span>
                    <input
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={phaseForm.sprintEstimate}
                      onChange={(e) =>
                        setPhaseForm((f) => (f ? { ...f, sprintEstimate: e.target.value } : f))
                      }
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Team summary</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={phaseForm.teamSummary}
                    onChange={(e) => setPhaseForm((f) => (f ? { ...f, teamSummary: e.target.value } : f))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Jira key</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={phaseForm.jiraKey}
                    onChange={(e) => setPhaseForm((f) => (f ? { ...f, jiraKey: e.target.value } : f))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Notes</span>
                  <textarea
                    rows={3}
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    value={phaseForm.notes}
                    onChange={(e) => setPhaseForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                  />
                </label>
              </div>
            ) : null}

            {itemForm && editRow && !editRow.phaseSegmentId ? (
              <div className="mt-4 space-y-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Title override</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={itemForm.titleOverride}
                    onChange={(e) => setItemForm((f) => (f ? { ...f, titleOverride: e.target.value } : f))}
                    placeholder="Optional display title on the roadmap"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Status</span>
                    <select
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.status}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, status: e.target.value } : f))}
                    >
                      {ITEM_STATUSES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Priority</span>
                    <select
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.priority}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, priority: e.target.value } : f))}
                    >
                      {PRIORITIES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Start</span>
                    <input
                      type="date"
                      required
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.startDate.slice(0, 10)}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, startDate: e.target.value } : f))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">End</span>
                    <input
                      type="date"
                      required
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.endDate.slice(0, 10)}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, endDate: e.target.value } : f))}
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Risk level</span>
                    <input
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.riskLevel}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, riskLevel: e.target.value } : f))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Lane key</span>
                    <input
                      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                      value={itemForm.laneKey}
                      onChange={(e) => setItemForm((f) => (f ? { ...f, laneKey: e.target.value } : f))}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Sort order</span>
                  <input
                    type="number"
                    className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                    value={itemForm.sortOrder}
                    onChange={(e) => setItemForm((f) => (f ? { ...f, sortOrder: e.target.value } : f))}
                  />
                </label>
              </div>
            ) : null}

            <ModalActions>
              <button
                type="button"
                className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                disabled={editSaving}
                onClick={closeBarEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </ModalActions>
          </form>
      </FormModal>

      {hoverTip ? (
        <div
          className="pointer-events-none fixed z-[300]"
          style={{
            left: hoverTip.anchor.left + hoverTip.anchor.width / 2,
            top: hoverTip.anchor.top - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <TimelineBarTooltip row={hoverTip.row} />
        </div>
      ) : null}
    </div>
  );
}
