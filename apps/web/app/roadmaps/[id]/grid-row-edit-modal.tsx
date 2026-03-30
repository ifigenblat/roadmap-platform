"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DatePickerField } from "../../../components/date-picker-field";
import { FormModal, ModalActions, modalFieldClass } from "../../../components/form-modal";
import { MultiSelectDropdown } from "../../../components/multi-select-dropdown";
import { sendJson } from "../../../lib/api";
import {
  INITIATIVE_TYPE_OPTIONS,
  ITEM_STATUS_VALUES,
  PHASE_STATUS_OPTIONS,
  mergeOptionList,
} from "../../../lib/grid-dropdowns";

export type GridRowEditShape = {
  itemId: string;
  initiativeId: string;
  phaseId: string;
  kind: "phase" | "item_only";
  initiativeName: string;
  teamIds: string[];
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
  businessObjective: string;
  initiativeNotes: string;
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  at_risk: "At risk",
  done: "Done",
};

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

type TeamOption = { id: string; name: string };
type ThemeOption = { id: string; name: string };
type PhaseOption = { id: string; name: string };

const CUSTOM_PHASE_VALUE = "__custom_phase__";

export function GridRowEditModal({
  row,
  open,
  onClose,
  workspaceTeams,
  workspacePhases,
  roadmapThemes,
  onSaved,
  onError,
}: {
  row: GridRowEditShape | null;
  open: boolean;
  onClose: () => void;
  workspaceTeams: TeamOption[];
  workspacePhases: PhaseOption[];
  roadmapThemes: ThemeOption[];
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [initiativeName, setInitiativeName] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [phaseName, setPhaseName] = useState("");
  const [phaseDefinitionId, setPhaseDefinitionId] = useState("");
  const [capacityPct, setCapacityPct] = useState("");
  const [sprintNum, setSprintNum] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [phaseNotes, setPhaseNotes] = useState("");
  const [initiativeNotes, setInitiativeNotes] = useState("");
  const [jira, setJira] = useState("");
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [businessObjective, setBusinessObjective] = useState("");

  useEffect(() => {
    if (!row || !open) return;
    setInitiativeName(row.initiativeName);
    setTeamIds([...row.teamIds]);
    if (row.kind === "phase") {
      const byId = row.phaseDefinitionId?.trim();
      const resolvedId =
        byId && workspacePhases.some((p) => p.id === byId)
          ? byId
          : workspacePhases.find((p) => p.name === row.phase)?.id ?? "";
      setPhaseDefinitionId(resolvedId);
      setPhaseName(row.phase);
    } else {
      setPhaseDefinitionId("");
      setPhaseName("");
    }
    setCapacityPct(row.kind === "phase" ? pctFromFraction(row.capacityFraction) : "");
    setSprintNum(
      row.kind === "phase" && row.sprintNum != null ? String(row.sprintNum) : "",
    );
    setStartDate(row.startDate.slice(0, 10));
    setEndDate(row.endDate.slice(0, 10));
    setType(row.type);
    setStatus(row.status);
    setPhaseNotes(row.kind === "phase" ? row.notes : "");
    setInitiativeNotes(row.initiativeNotes);
    setJira(row.jira);
    setThemeIds([...row.themeIds]);
    setBusinessObjective(row.businessObjective);
  }, [row, open, workspacePhases]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setBusy(true);
    try {
      if (row.kind === "phase") {
        await sendJson(`/api/initiatives/${row.initiativeId}`, "PATCH", {
          canonicalName: initiativeName.trim(),
          type: type.trim() || null,
          detailedObjective: businessObjective.trim() || null,
          notes: initiativeNotes.trim() || null,
        });
      } else {
        await sendJson(`/api/initiatives/${row.initiativeId}`, "PATCH", {
          canonicalName: initiativeName.trim(),
          type: type.trim() || null,
          detailedObjective: businessObjective.trim() || null,
          notes: initiativeNotes.trim() || null,
          sourceReference: jira.trim() || null,
          sourceSystem: jira.trim() ? "jira" : null,
        });
      }

      await sendJson(`/api/roadmap-items/${row.itemId}/teams`, "PUT", {
        teamIds,
      });

      await sendJson(`/api/initiatives/${row.initiativeId}/theme-links`, "PUT", {
        strategicThemeIds: themeIds,
      });

      if (row.kind === "phase") {
        const cap = parseCapacityInput(capacityPct);
        const sprint = sprintNum.trim() === "" ? null : Number(sprintNum);
        const phasePayload: Record<string, unknown> = {
          capacityAllocationEstimate: cap,
          sprintEstimate: sprint !== null && Number.isFinite(sprint) ? sprint : null,
          startDate: startDate.slice(0, 10),
          endDate: endDate.slice(0, 10),
          status: status.trim() || null,
          notes: phaseNotes.trim() || null,
          jiraKey: jira.trim() || null,
        };
        if (workspacePhases.length > 0) {
          if (phaseDefinitionId.trim()) {
            phasePayload.phaseDefinitionId = phaseDefinitionId.trim();
          } else {
            const nm = phaseName.trim();
            if (!nm) {
              onError("Select a workspace phase or enter a custom name.");
              setBusy(false);
              return;
            }
            phasePayload.phaseName = nm;
          }
        } else {
          phasePayload.phaseName = phaseName.trim();
        }
        await sendJson(`/api/phase-segments/${row.phaseId}`, "PATCH", phasePayload);
      } else {
        await sendJson(`/api/roadmap-items/${row.itemId}`, "PATCH", {
          startDate: startDate.slice(0, 10),
          endDate: endDate.slice(0, 10),
          status,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !row) return null;

  const typeOptions = mergeOptionList(INITIATIVE_TYPE_OPTIONS, type);
  const phaseStatusOptions = mergeOptionList(PHASE_STATUS_OPTIONS, status);

  return (
    <FormModal
      open={open}
      onClose={() => !busy && onClose()}
      title={row.kind === "phase" ? "Edit phase row" : "Edit roadmap item"}
      subtitle={row.initiativeName}
      maxWidthClass="max-w-5xl"
      maxHeightClass="max-h-[min(92vh,52rem)]"
    >
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Initiative
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Initiative/Project</span>
            <input
              className={modalFieldClass}
              value={initiativeName}
              onChange={(e) => setInitiativeName(e.target.value)}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-slate-400">Type</span>
              <select
                className={modalFieldClass}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {typeOptions.map((opt) => (
                  <option key={opt || "__empty"} value={opt}>
                    {opt || "—"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-slate-400">Teams</span>
              <MultiSelectDropdown
                options={workspaceTeams.map((t) => ({ value: t.id, label: t.name }))}
                value={teamIds}
                onChange={setTeamIds}
                disabled={busy}
                placeholder="Choose teams…"
                emptyText="No teams defined."
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-slate-400">Themes</span>
              <MultiSelectDropdown
                options={roadmapThemes.map((t) => ({ value: t.id, label: t.name }))}
                value={themeIds}
                onChange={setThemeIds}
                disabled={busy}
                placeholder="Choose themes…"
                emptyText="No themes on this roadmap."
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Business objective</span>
            <textarea
              rows={3}
              className={modalFieldClass}
              value={businessObjective}
              onChange={(e) => setBusinessObjective(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Initiative notes</span>
            <textarea
              rows={2}
              className={modalFieldClass}
              value={initiativeNotes}
              onChange={(e) => setInitiativeNotes(e.target.value)}
            />
          </label>
        </fieldset>

        {row.kind === "phase" ? (
          <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Phase
            </legend>
            {workspacePhases.length > 0 ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Phase</span>
                  <select
                    className={modalFieldClass}
                    value={phaseDefinitionId || CUSTOM_PHASE_VALUE}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CUSTOM_PHASE_VALUE) {
                        setPhaseDefinitionId("");
                      } else {
                        setPhaseDefinitionId(v);
                        const p = workspacePhases.find((x) => x.id === v);
                        if (p) setPhaseName(p.name);
                      }
                    }}
                    disabled={busy}
                  >
                    {workspacePhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value={CUSTOM_PHASE_VALUE}>Custom name…</option>
                  </select>
                </label>
                {!phaseDefinitionId.trim() && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-400">Custom phase name</span>
                    <input
                      className={modalFieldClass}
                      value={phaseName}
                      onChange={(e) => setPhaseName(e.target.value)}
                      placeholder="One-off label (not linked to catalog)"
                    />
                  </label>
                )}
                <p className="text-xs text-slate-500">
                  Manage shared phases in{" "}
                  <Link href="/phases" className="text-indigo-400 hover:text-indigo-300">
                    Phases
                  </Link>
                  .
                </p>
              </>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Phase name</span>
                <input
                  className={modalFieldClass}
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  required
                />
                <span className="text-xs text-slate-500">
                  Add reusable phases under{" "}
                  <Link href="/phases" className="text-indigo-400 hover:text-indigo-300">
                    Phases
                  </Link>{" "}
                  to use a dropdown here.
                </span>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePickerField
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                disabled={busy}
                required
              />
              <DatePickerField
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                disabled={busy}
                required
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Status</span>
              <select
                className={modalFieldClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {phaseStatusOptions.map((opt) => (
                  <option key={opt || "__empty"} value={opt}>
                    {opt || "—"}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Capacity Allocation Estimate</span>
                <input
                  className={modalFieldClass}
                  value={capacityPct}
                  onChange={(e) => setCapacityPct(e.target.value)}
                  placeholder="%"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400"># of Sprints Estimate</span>
                <input
                  type="number"
                  step="any"
                  className={modalFieldClass}
                  value={sprintNum}
                  onChange={(e) => setSprintNum(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Jira key</span>
              <input
                className={modalFieldClass}
                value={jira}
                onChange={(e) => setJira(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Notes</span>
              <textarea
                rows={2}
                className={modalFieldClass}
                value={phaseNotes}
                onChange={(e) => setPhaseNotes(e.target.value)}
              />
            </label>
          </fieldset>
        ) : (
          <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Timeline
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePickerField
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                disabled={busy}
                required
              />
              <DatePickerField
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                disabled={busy}
                required
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Status</span>
              <select
                className={modalFieldClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ITEM_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {ITEM_STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Jira key</span>
              <input
                className={modalFieldClass}
                value={jira}
                onChange={(e) => setJira(e.target.value)}
              />
            </label>
          </fieldset>
        )}

        <ModalActions>
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </ModalActions>
      </form>
    </FormModal>
  );
}
