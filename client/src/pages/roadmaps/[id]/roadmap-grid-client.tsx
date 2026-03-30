import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { DatePickerField } from "../../../components/date-picker-field";
import { MultiSelectDropdown } from "../../../components/multi-select-dropdown";
import { themeColorHex, themeInitiativeHeaderAccentClass } from "../../../lib/strategic-theme-color";
import { ToastViewport, useToasts } from "../../../lib/toast";
import { JiraGridCell } from "../../../components/jira-grid-cell";
import { GridRowEditModal, type GridRowEditShape } from "./grid-row-edit-modal";

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
    themes?: Array<{ strategicTheme: { id: string; name: string; colorToken?: string | null } }>;
  };
  phases: Array<{
    id: string;
    phaseName: string;
    phaseDefinitionId?: string | null;
    phaseDefinition?: { id: string; name: string } | null;
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

type ThemeOption = { id: string; name: string; colorToken?: string | null };
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
  phaseDefinitionId: string | null;
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
  firstThemeColorToken: string | null;
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
    const firstThemeColorToken =
      item.initiative.themes?.[0]?.strategicTheme.colorToken ?? null;
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
        phaseDefinitionId: null,
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
        firstThemeColorToken,
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
        phase: phase.phaseDefinition?.name ?? phase.phaseName,
        phaseDefinitionId: phase.phaseDefinitionId ?? null,
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
        firstThemeColorToken,
      });
    }
  }
  return out;
}

function pctFromFraction(f: number | null): string {
  if (f == null || Number.isNaN(f)) return "";
  return String(Math.round(f * 100));
}

export function RoadmapGridClient({
  roadmapId: _roadmapId,
  roadmapName,
  initial,
  workspaceTeams,
  workspacePhases,
  roadmapThemes,
}: {
  roadmapId: string;
  roadmapName: string;
  initial: RoadmapItem[];
  workspaceTeams: TeamOption[];
  workspacePhases: { id: string; name: string }[];
  roadmapThemes: ThemeOption[];
}) {
  void _roadmapId;
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [teamFilterIds, setTeamFilterIds] = useState<string[]>([]);
  const [themeFilterIds, setThemeFilterIds] = useState<string[]>([]);
  const [statusFilterValues, setStatusFilterValues] = useState<string[]>([]);
  const [phaseWindowStart, setPhaseWindowStart] = useState("");
  const [phaseWindowEnd, setPhaseWindowEnd] = useState("");
  const [editRow, setEditRow] = useState<GridRow | null>(null);

  const rows = useMemo(() => toGridRows(initial), [initial]);

  const statusFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const r of rows) {
      const s = (r.status ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      opts.push({ value: s, label: ITEM_STATUS_LABEL[s] ?? s });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return opts;
  }, [rows]);

  const teamSelectOptions = useMemo(
    () => workspaceTeams.map((t) => ({ value: t.id, label: t.name })),
    [workspaceTeams],
  );
  const themeSelectOptions = useMemo(
    () => roadmapThemes.map((t) => ({ value: t.id, label: t.name })),
    [roadmapThemes],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const teamOk =
        teamFilterIds.length === 0 || teamFilterIds.some((id) => r.teamIds.includes(id));
      const themeOk =
        themeFilterIds.length === 0 || themeFilterIds.some((id) => r.themeIds.includes(id));
      const statusOk =
        statusFilterValues.length === 0 || statusFilterValues.includes(r.status);
      const winOk = windowOverlaps(r.startDate, r.endDate, phaseWindowStart, phaseWindowEnd);
      return teamOk && themeOk && statusOk && winOk;
    });
  }, [rows, teamFilterIds, themeFilterIds, statusFilterValues, phaseWindowStart, phaseWindowEnd]);

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

  function rowToEditShape(r: GridRow): GridRowEditShape {
    return {
      itemId: r.itemId,
      initiativeId: r.initiativeId,
      phaseId: r.phaseId,
      kind: r.kind,
      initiativeName: r.initiativeName,
      teamIds: r.teamIds,
      phase: r.phase,
      phaseDefinitionId: r.phaseDefinitionId,
      capacityFraction: r.capacityFraction,
      sprintNum: r.sprintNum,
      startDate: r.startDate,
      endDate: r.endDate,
      type: r.type,
      status: r.status,
      notes: r.notes,
      jira: r.jira,
      themeIds: r.themeIds,
      businessObjective: r.businessObjective,
      initiativeNotes: r.initiativeNotes,
    };
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm sm:col-span-2 xl:col-span-3">
          <span className="text-slate-400">Roadmap: </span>
          {roadmapName}
        </div>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Team
          </span>
          <MultiSelectDropdown
            options={teamSelectOptions}
            value={teamFilterIds}
            onChange={setTeamFilterIds}
            placeholder="All teams"
            emptyText="No teams defined."
            searchable
            searchPlaceholder="Search teams…"
          />
        </label>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Theme
          </span>
          <MultiSelectDropdown
            options={themeSelectOptions}
            value={themeFilterIds}
            onChange={setThemeFilterIds}
            placeholder="All themes"
            emptyText="No themes on this roadmap."
            searchable
            searchPlaceholder="Search themes…"
          />
        </label>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </span>
          <MultiSelectDropdown
            options={statusFilterOptions}
            value={statusFilterValues}
            onChange={setStatusFilterValues}
            placeholder="All statuses"
            emptyText="No status values in grid."
            searchable
            searchPlaceholder="Search status…"
          />
        </label>
        <DatePickerField
          className="min-w-0 sm:col-span-2 xl:col-span-6"
          label="Phase window — from"
          value={phaseWindowStart}
          onChange={setPhaseWindowStart}
        />
        <DatePickerField
          className="min-w-0 sm:col-span-2 xl:col-span-6"
          label="Phase window — to"
          value={phaseWindowEnd}
          onChange={setPhaseWindowEnd}
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
      {roadmapThemes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="font-medium uppercase tracking-wide text-slate-500">Theme colors</span>
          {roadmapThemes.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-slate-600"
                style={{ backgroundColor: themeColorHex(t.colorToken) ?? "transparent" }}
              />
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-x-auto shadow-inner">
        <table className="w-full min-w-[1920px] table-fixed border-collapse text-left text-xs">
          <colgroup>
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
            <col style={{ width: "4.5rem" }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
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
              <th className="border-b border-slate-800 px-2 py-2.5 text-left align-bottom font-medium">
                Business Objective
              </th>
              <th className="border-b border-slate-800 px-2 py-2.5 pr-3 text-left align-bottom font-medium">
                Edit
              </th>
            </tr>
          </thead>
          {groups.map((g) => {
            return (
              <tbody key={g.itemId}>
                <tr className="border-b border-slate-800 bg-slate-950/70">
                  <td
                    colSpan={14}
                    className={`align-middle px-2 py-2 pr-3 ${themeInitiativeHeaderAccentClass(g.rows[0]?.firstThemeColorToken ?? null)}`}
                  >
                    <span className="font-semibold text-slate-200">{g.initiativeName}</span>
                    <Link
                      to={`/initiatives/${g.rows[0]?.initiativeId}`}
                      className="ml-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Narrative
                    </Link>
                    <span className="ml-2 text-slate-500">
                      {g.rows.length} row{g.rows.length === 1 ? "" : "s"}
                    </span>
                  </td>
                </tr>
                {g.rows.map((r) => {
                    const rowKey = r.kind === "item_only" ? `${r.itemId}-item` : r.phaseId;
                    const rowSyncKey = `${rowKey}-${r.initiativeName}-${r.teamIds.join(",")}-${r.themeIds.join(",")}-${r.phase}-${r.startDate}-${r.endDate}-${r.status}-${r.notes}-${r.jira}-${r.capacityFraction}-${r.sprintNum}-${r.type}-${r.businessObjective}`;
                    const notesDisplay = r.kind === "phase" ? r.notes : r.initiativeNotes;
                    const statusLabel =
                      r.kind === "item_only"
                        ? ITEM_STATUS_LABEL[r.status] ?? r.status
                        : r.status || "—";

                    const rowLabel =
                      r.kind === "phase"
                        ? `${r.initiativeName} — ${r.phase || "phase"}`
                        : `${r.initiativeName} — timeline`;

                    const openThisRow = () => setEditRow(r);

                    return (
                      <tr
                        key={rowSyncKey}
                        tabIndex={0}
                        className="cursor-pointer border-b border-slate-800/80 align-top odd:bg-slate-900/20 outline-none hover:bg-slate-800/35 focus-visible:bg-slate-800/35 focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-inset"
                        title="Click or press Enter to edit"
                        aria-label={`Edit row: ${rowLabel}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditRow(r);
                          }
                        }}
                      >
                        <td onClick={openThisRow} className="max-w-[9rem] align-top px-2 py-2 text-xs text-slate-200">
                          <span className="line-clamp-4 break-words">{r.initiativeName}</span>
                        </td>
                        <td onClick={openThisRow} className="max-w-[8rem] align-top px-2 py-2 text-xs text-slate-300">
                          <span className="line-clamp-6 break-words">{r.teamsLabel || "—"}</span>
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs text-slate-300">
                          {r.kind === "phase" ? r.phase : "—"}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs tabular-nums text-slate-300">
                          {r.kind === "phase" ? pctFromFraction(r.capacityFraction) || "—" : "—"}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs tabular-nums text-slate-300">
                          {r.kind === "phase" && r.sprintNum != null ? r.sprintNum : "—"}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs tabular-nums text-slate-300">
                          {r.startDate}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs tabular-nums text-slate-300">
                          {r.endDate}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs text-slate-300">
                          {r.type || "—"}
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs text-slate-300">
                          {statusLabel}
                        </td>
                        <td onClick={openThisRow} className="max-w-[10rem] align-top px-2 py-2 text-xs text-slate-400">
                          <span className="line-clamp-4 whitespace-pre-wrap break-words">
                            {notesDisplay?.trim() || "—"}
                          </span>
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 text-xs text-slate-300">
                          <JiraGridCell value={r.jira} />
                        </td>
                        <td onClick={openThisRow} className="max-w-[9rem] align-top px-2 py-2 text-xs text-slate-300">
                          <span className="line-clamp-4 break-words">{r.themeLabel || "—"}</span>
                        </td>
                        <td onClick={openThisRow} className="max-w-[12rem] align-top px-2 py-2 text-xs text-slate-400">
                          <span className="line-clamp-5 whitespace-pre-wrap break-words">
                            {r.businessObjective?.trim() || "—"}
                          </span>
                        </td>
                        <td onClick={openThisRow} className="align-top px-2 py-2 pr-3">
                          <span
                            tabIndex={-1}
                            aria-hidden="true"
                            className="inline-block rounded-md border border-indigo-700/60 px-2 py-1 text-xs text-indigo-200"
                          >
                            Edit
                          </span>
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

      <GridRowEditModal
        row={editRow ? rowToEditShape(editRow) : null}
        open={!!editRow}
        onClose={() => setEditRow(null)}
        workspaceTeams={workspaceTeams}
        workspacePhases={workspacePhases}
        roadmapThemes={roadmapThemes}
        onSaved={() => {
          push("Saved.", "success");
          window.location.reload();
        }}
        onError={(m) => push(m, "error")}
      />
    </>
  );
}
