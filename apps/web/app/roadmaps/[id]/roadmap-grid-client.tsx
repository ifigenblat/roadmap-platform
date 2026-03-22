"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { sendJson } from "../../../lib/api";
import { ToastViewport, useToasts } from "../../../lib/toast";
import {
  INITIATIVE_TYPE_OPTIONS,
  ITEM_STATUS_VALUES,
  PHASE_STATUS_OPTIONS,
  mergeOptionList,
} from "./grid-dropdowns";

type RoadmapItem = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  initiative: {
    id: string;
    canonicalName: string;
    type?: string | null;
    shortObjective?: string | null;
    detailedObjective?: string | null;
    notes?: string | null;
    sourceSystem?: string | null;
    sourceReference?: string | null;
    themes?: Array<{ strategicTheme: { id: string; name: string } }>;
  };
  phases: Array<{
    id: string;
    phaseName: string;
    capacityAllocationEstimate?: number | null;
    sprintEstimate?: number | null;
    startDate: string;
    endDate: string;
    status?: string | null;
    jiraKey?: string | null;
    notes?: string | null;
  }>;
  teams: Array<{ team: { id: string; name: string } }>;
};

type ThemeOption = { id: string; name: string };
type TeamOption = { id: string; name: string };

type GridRow = {
  itemId: string;
  initiativeId: string;
  phaseId: string;
  kind: "phase" | "item_only";
  initiativeName: string;
  teamIds: string[];
  teamsLabel: string;
  phase: string;
  capacityFraction: number | null;
  sprintNum: number | null;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  notes: string;
  jira: string;
  themeIds: string[];
  themeLabel: string;
  businessObjective: string;
  initiativeNotes: string;
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  at_risk: "At risk",
  done: "Done",
};

function d(v: string): string {
  return String(v).slice(0, 10);
}

function windowOverlaps(
  rowStart: string,
  rowEnd: string,
  winStart: string,
  winEnd: string
): boolean {
  if (!winStart.trim() || !winEnd.trim()) return true;
  const a = rowStart.slice(0, 10);
  const b = rowEnd.slice(0, 10);
  const w0 = winStart.slice(0, 10);
  const w1 = winEnd.slice(0, 10);
  return a <= w1 && b >= w0;
}

function toGridRows(items: RoadmapItem[]): GridRow[] {
  const out: GridRow[] = [];
  for (const item of items) {
    const teamIds = item.teams.map((t) => t.team.id);
    const teamsLabel = item.teams.map((t) => t.team.name).join(", ");
    const themeIds = (item.initiative.themes ?? []).map((t) => t.strategicTheme.id);
    const themeLabel = (item.initiative.themes ?? [])
      .map((t) => t.strategicTheme.name)
      .join(", ");
    const objective =
      item.initiative.detailedObjective || item.initiative.shortObjective || "";
    const initiativeNotes = item.initiative.notes || "";

    if (item.phases.length === 0) {
      out.push({
        itemId: item.id,
        initiativeId: item.initiative.id,
        phaseId: item.id,
        kind: "item_only",
        initiativeName: item.initiative.canonicalName,
        teamIds,
        teamsLabel,
        phase: "—",
        capacityFraction: null,
        sprintNum: null,
        startDate: d(item.startDate),
        endDate: d(item.endDate),
        type: item.initiative.type || "",
        status: item.status,
        notes: initiativeNotes,
        jira: item.initiative.sourceReference || "",
        themeIds,
        themeLabel,
        businessObjective: objective,
        initiativeNotes,
      });
      continue;
    }
    for (const phase of item.phases) {
      out.push({
        itemId: item.id,
        initiativeId: item.initiative.id,
        phaseId: phase.id,
        kind: "phase",
        initiativeName: item.initiative.canonicalName,
        teamIds,
        teamsLabel,
        phase: phase.phaseName,
        capacityFraction:
          phase.capacityAllocationEstimate != null ? phase.capacityAllocationEstimate : null,
        sprintNum: phase.sprintEstimate != null ? phase.sprintEstimate : null,
        startDate: d(phase.startDate),
        endDate: d(phase.endDate),
        type: item.initiative.type || "",
        status: phase.status || item.status,
        notes: phase.notes || "",
        jira: phase.jiraKey || "",
        themeIds,
        themeLabel,
        businessObjective: objective,
        initiativeNotes,
      });
    }
  }
  return out;
}

function pctFromFraction(f: number | null): string {
  if (f == null || Number.isNaN(f)) return "";
  return String(Math.round(f * 100));
}

function parseCapacityInput(raw: string): number | null {
  const t = raw.trim().replace(/%/g, "");
  if (t === "") return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n >= 0 && n <= 1) return n;
  return n / 100;
}

export function RoadmapGridClient({
  roadmapId: _roadmapId,
  roadmapName,
  initial,
  workspaceTeams,
  roadmapThemes,
}: {
  roadmapId: string;
  roadmapName: string;
  initial: RoadmapItem[];
  workspaceTeams: TeamOption[];
  roadmapThemes: ThemeOption[];
}) {
  void _roadmapId;
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const [teamFilter, setTeamFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseWindowStart, setPhaseWindowStart] = useState("");
  const [phaseWindowEnd, setPhaseWindowEnd] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const rows = useMemo(() => toGridRows(initial), [initial]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const teamOk = !teamFilter || r.teamsLabel.toLowerCase().includes(teamFilter.toLowerCase());
      const themeOk = !themeFilter || r.themeLabel.toLowerCase().includes(themeFilter.toLowerCase());
      const statusOk = !statusFilter || r.status.toLowerCase().includes(statusFilter.toLowerCase());
      const winOk = windowOverlaps(r.startDate, r.endDate, phaseWindowStart, phaseWindowEnd);
      return teamOk && themeOk && statusOk && winOk;
    });
  }, [rows, teamFilter, themeFilter, statusFilter, phaseWindowStart, phaseWindowEnd]);

  const groups = useMemo(() => {
    const map = new Map<string, { initiativeName: string; rows: GridRow[] }>();
    const order: string[] = [];
    for (const r of filtered) {
      if (!map.has(r.itemId)) {
        map.set(r.itemId, { initiativeName: r.initiativeName, rows: [] });
        order.push(r.itemId);
      }
      map.get(r.itemId)!.rows.push(r);
    }
    return order.map((itemId) => ({
      itemId,
      initiativeName: map.get(itemId)!.initiativeName,
      rows: map.get(itemId)!.rows,
    }));
  }, [filtered]);

  const toggleGroup = useCallback((itemId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const runSave = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setSavingKey(key);
      try {
        await fn();
        push("Saved", "success");
        router.refresh();
      } catch (e) {
        push(e instanceof Error ? e.message : "Save failed", "error");
      } finally {
        setSavingKey(null);
      }
    },
    [push, router]
  );

  /** Shared control styles — box-border + min-w-0 keeps cells from spilling into neighbors. */
  const controlBase =
    "box-border w-full min-w-0 max-w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500";
  const inputCls = `${controlBase} h-9 shrink-0`;
  const selectCls = `${controlBase} h-9 shrink-0`;
  const multiSelectCls = `${controlBase} block h-28 shrink-0 overflow-y-auto overscroll-contain`;
  const textareaSmCls = `${controlBase} min-h-[3.25rem] max-h-40 resize-y`;
  const textareaLgCls = `${controlBase} min-h-[4.5rem] max-h-52 resize-y`;

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <div className="mb-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm xl:col-span-2">
          <span className="text-slate-400">Roadmap: </span>
          {roadmapName}
        </div>
        <input
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Filter by team"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        />
        <input
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Filter by theme"
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
        />
        <input
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <input
          type="date"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          title="Phase window — from"
          value={phaseWindowStart}
          onChange={(e) => setPhaseWindowStart(e.target.value)}
        />
        <input
          type="date"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          title="Phase window — to"
          value={phaseWindowEnd}
          onChange={(e) => setPhaseWindowEnd(e.target.value)}
        />
      </div>
      <div className="mb-3 text-sm text-slate-400">
        Showing {filtered.length} phase row{filtered.length === 1 ? "" : "s"} in {groups.length}{" "}
        initiative{groups.length === 1 ? "" : "s"}
        {phaseWindowStart && phaseWindowEnd
          ? ` (overlap ${phaseWindowStart}…${phaseWindowEnd})`
          : ""}
        .
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-x-auto shadow-inner">
        <table className="w-full min-w-[1980px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col style={{ width: "9.25rem" }} />
            <col style={{ width: "8.25rem" }} />
            <col style={{ width: "6.5rem" }} />
            <col style={{ width: "6rem" }} />
            <col style={{ width: "5rem" }} />
            <col style={{ width: "7.25rem" }} />
            <col style={{ width: "7.25rem" }} />
            <col style={{ width: "8.5rem" }} />
            <col style={{ width: "8rem" }} />
            <col style={{ width: "10.5rem" }} />
            <col style={{ width: "6.25rem" }} />
            <col style={{ width: "9.25rem" }} />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom" aria-label="Expand" />
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">
                Initiative/Project
              </th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Teams</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Phase</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">
                Capacity Allocation Estimate
              </th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">
                # of Sprints Estimate
              </th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">
                Start Date
              </th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">End Date</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Type</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Status</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Notes</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Jira</th>
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">Theme</th>
              <th className="border-b border-slate-800 px-2 py-2.5 pr-3 text-left align-bottom font-medium">
                Business Objective
              </th>
            </tr>
          </thead>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.itemId);
            return (
              <tbody key={g.itemId}>
                <tr className="border-b border-slate-800 bg-slate-950/70">
                  <td className="align-middle px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.itemId)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? "Expand phases" : "Collapse phases"}
                    >
                      {isCollapsed ? "▶" : "▼"}
                    </button>
                  </td>
                  <td colSpan={13} className="align-middle px-2 py-2 pr-3">
                    <span className="font-semibold text-slate-200">{g.initiativeName}</span>
                    <Link
                      href={`/initiatives/${g.rows[0]?.initiativeId}`}
                      className="ml-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Narrative
                    </Link>
                    <span className="ml-2 text-slate-500">
                      {g.rows.length} row{g.rows.length === 1 ? "" : "s"}
                    </span>
                  </td>
                </tr>
                {!isCollapsed &&
                  g.rows.map((r) => {
                    const rowKey = r.kind === "item_only" ? `${r.itemId}-item` : r.phaseId;
                    const busy = savingKey === rowKey;
                    const rowSyncKey = `${rowKey}-${r.initiativeName}-${r.teamIds.join(",")}-${r.themeIds.join(",")}-${r.phase}-${r.startDate}-${r.endDate}-${r.status}-${r.notes}-${r.jira}-${r.capacityFraction}-${r.sprintNum}-${r.type}-${r.businessObjective}`;
                    const typeOptions = mergeOptionList(INITIATIVE_TYPE_OPTIONS, r.type);
                    const phaseStatusOptions = mergeOptionList(PHASE_STATUS_OPTIONS, r.status);

                    return (
                      <tr key={rowSyncKey} className="border-b border-slate-800/80 align-top odd:bg-slate-900/20">
                        <td className="align-top px-2 py-2" aria-hidden />
                        <td className="align-top px-2 py-2">
                          <input
                            disabled={busy}
                            className={inputCls}
                            defaultValue={r.initiativeName}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (!v || v === r.initiativeName) return;
                              void runSave(rowKey, () =>
                                sendJson(`/api/initiatives/${r.initiativeId}`, "PATCH", {
                                  canonicalName: v,
                                })
                              );
                            }}
                          />
                        </td>
                        <td className="align-top px-2 py-2">
                          <select
                            key={`teams-${r.itemId}-${r.teamIds.slice().sort().join(",")}`}
                            multiple
                            size={5}
                            disabled={busy}
                            title="Hold Ctrl (Windows) or ⌘ (Mac) to select multiple teams"
                            className={multiSelectCls}
                            defaultValue={r.teamIds}
                            onChange={(e) => {
                              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                              void runSave(rowKey, () =>
                                sendJson(`/api/roadmap-items/${r.itemId}/teams`, "PUT", { teamIds: ids })
                              );
                            }}
                          >
                            {workspaceTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="align-top px-2 py-2">
                          {r.kind === "phase" ? (
                            <input
                              disabled={busy}
                              className={inputCls}
                              defaultValue={r.phase}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v === r.phase) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    phaseName: v,
                                  })
                                );
                              }}
                            />
                          ) : (
                            <span className="block py-2 text-slate-500">—</span>
                          )}
                        </td>
                        <td className="align-top px-2 py-2">
                          {r.kind === "phase" ? (
                            <input
                              disabled={busy}
                              className={inputCls}
                              defaultValue={pctFromFraction(r.capacityFraction)}
                              placeholder="%"
                              onBlur={(e) => {
                                const parsed = parseCapacityInput(e.target.value);
                                const prev = r.capacityFraction;
                                const same =
                                  (parsed == null && prev == null) ||
                                  (parsed != null &&
                                    prev != null &&
                                    Math.abs(parsed - prev) < 0.0001);
                                if (same) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    capacityAllocationEstimate: parsed,
                                  })
                                );
                              }}
                            />
                          ) : (
                            <span className="block py-2 text-slate-500">—</span>
                          )}
                        </td>
                        <td className="align-top px-2 py-2">
                          {r.kind === "phase" ? (
                            <input
                              type="number"
                              step="any"
                              disabled={busy}
                              className={inputCls}
                              defaultValue={r.sprintNum ?? ""}
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                const n = raw === "" ? null : Number(raw);
                                if (raw !== "" && Number.isNaN(n!)) return;
                                const same =
                                  (n == null && r.sprintNum == null) ||
                                  (n != null && r.sprintNum != null && n === r.sprintNum);
                                if (same) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    sprintEstimate: n,
                                  })
                                );
                              }}
                            />
                          ) : (
                            <span className="block py-2 text-slate-500">—</span>
                          )}
                        </td>
                        <td className="align-top px-2 py-2">
                          <input
                            type="date"
                            disabled={busy}
                            className={inputCls}
                            defaultValue={r.startDate}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (!v || v === r.startDate) return;
                              if (r.kind === "phase") {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    startDate: v,
                                  })
                                );
                              } else {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/roadmap-items/${r.itemId}`, "PATCH", {
                                    startDate: v,
                                  })
                                );
                              }
                            }}
                          />
                        </td>
                        <td className="align-top px-2 py-2">
                          <input
                            type="date"
                            disabled={busy}
                            className={inputCls}
                            defaultValue={r.endDate}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (!v || v === r.endDate) return;
                              if (r.kind === "phase") {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    endDate: v,
                                  })
                                );
                              } else {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/roadmap-items/${r.itemId}`, "PATCH", {
                                    endDate: v,
                                  })
                                );
                              }
                            }}
                          />
                        </td>
                        <td className="align-top px-2 py-2">
                          <select
                            disabled={busy}
                            className={selectCls}
                            defaultValue={r.type}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === r.type) return;
                              void runSave(rowKey, () =>
                                sendJson(`/api/initiatives/${r.initiativeId}`, "PATCH", {
                                  type: v || null,
                                })
                              );
                            }}
                          >
                            {typeOptions.map((opt) => (
                              <option key={opt || "__empty"} value={opt}>
                                {opt || "—"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="align-top px-2 py-2">
                          {r.kind === "item_only" ? (
                            <select
                              disabled={busy}
                              className={selectCls}
                              defaultValue={r.status}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === r.status) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/roadmap-items/${r.itemId}`, "PATCH", {
                                    status: v,
                                  })
                                );
                              }}
                            >
                              {ITEM_STATUS_VALUES.map((s) => (
                                <option key={s} value={s}>
                                  {ITEM_STATUS_LABEL[s] ?? s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              disabled={busy}
                              className={selectCls}
                              defaultValue={r.status || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === (r.status || "")) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    status: v || null,
                                  })
                                );
                              }}
                            >
                              {phaseStatusOptions.map((opt) => (
                                <option key={opt || "__empty"} value={opt}>
                                  {opt || "—"}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="align-top px-2 py-2">
                          {r.kind === "phase" ? (
                            <textarea
                              disabled={busy}
                              rows={2}
                              className={textareaSmCls}
                              defaultValue={r.notes}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v === r.notes) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    notes: v || null,
                                  })
                                );
                              }}
                            />
                          ) : (
                            <textarea
                              disabled={busy}
                              rows={2}
                              className={textareaSmCls}
                              defaultValue={r.initiativeNotes}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v === r.initiativeNotes) return;
                                void runSave(rowKey, () =>
                                  sendJson(`/api/initiatives/${r.initiativeId}`, "PATCH", {
                                    notes: v || null,
                                  })
                                );
                              }}
                            />
                          )}
                        </td>
                        <td className="align-top px-2 py-2">
                          <input
                            disabled={busy}
                            className={inputCls}
                            defaultValue={r.jira}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v === r.jira) return;
                              if (r.kind === "phase") {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/phase-segments/${r.phaseId}`, "PATCH", {
                                    jiraKey: v || null,
                                  })
                                );
                              } else {
                                void runSave(rowKey, () =>
                                  sendJson(`/api/initiatives/${r.initiativeId}`, "PATCH", {
                                    sourceReference: v || null,
                                    sourceSystem: v ? "jira" : null,
                                  })
                                );
                              }
                            }}
                          />
                        </td>
                        <td className="align-top px-2 py-2">
                          <select
                            key={`th-${r.initiativeId}-${r.themeIds.slice().sort().join(",")}`}
                            multiple
                            size={5}
                            disabled={busy}
                            title="Hold Ctrl or ⌘ to select multiple themes"
                            className={multiSelectCls}
                            defaultValue={r.themeIds}
                            onChange={(e) => {
                              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                              void runSave(rowKey, () =>
                                sendJson(`/api/initiatives/${r.initiativeId}/theme-links`, "PUT", {
                                  strategicThemeIds: ids,
                                })
                              );
                            }}
                          >
                            {roadmapThemes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="align-top px-2 py-2 pr-3">
                          <textarea
                            disabled={busy}
                            rows={3}
                            className={textareaLgCls}
                            defaultValue={r.businessObjective}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v === r.businessObjective) return;
                              void runSave(rowKey, () =>
                                sendJson(`/api/initiatives/${r.initiativeId}`, "PATCH", {
                                  detailedObjective: v || null,
                                })
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}
          {filtered.length === 0 && (
            <tbody>
              <tr>
                <td className="p-3 text-slate-400" colSpan={14}>
                  No rows match current filters.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </>
  );
}
