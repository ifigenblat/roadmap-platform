"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormModal, ModalActions } from "../../components/form-modal";
import { WorkspaceSelectField } from "../../components/workspace-select-field";
import { API_BASE, fetchJson, sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type ImportBatchRow = {
  id: string;
  sourceFileName: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  roadmapId?: string | null;
  roadmap?: { id: string; name: string; status: string } | null;
  _count?: { rowResults: number };
  summaryJson?: Record<string, unknown> | null;
};

type DeleteImpact = {
  importBatchId: string;
  sourceFileName: string;
  totalRecords: number;
  breakdown: {
    importRowResults: number;
    importBatches: number;
    roadmaps: number;
    roadmapItems: number;
    phaseSegments: number;
    roadmapItemTeams: number;
    teamsOrphanImported: number;
    strategicThemes: number;
    initiativeThemeViaRoadmapThemes: number;
    initiativeThemeViaOrphanInitiatives: number;
    initiativesOrphan: number;
  };
};

type ImportErrors = {
  count: number;
  rows: Array<{
    id: string;
    sheetName: string;
    rowNumber: number;
    status: string;
    message?: string | null;
    entityKey: string;
    entityType?: string;
  }>;
};

type WorkspaceOption = { id: string; name: string; slug: string };

export function ImportsClient({
  initial,
  roadmaps,
  workspaces,
}: {
  initial: ImportBatchRow[];
  roadmaps: { id: string; name: string }[];
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [roadmapOptions, setRoadmapOptions] = useState(roadmaps);
  const [workspaceId, setWorkspaceId] = useState("");
  const [importInto, setImportInto] = useState<"existing" | "new">("existing");
  const [roadmapId, setRoadmapId] = useState("");
  const [roadmapName, setRoadmapName] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedErrorsFor, setSelectedErrorsFor] = useState<string | null>(null);
  const [errorsById, setErrorsById] = useState<Record<string, ImportErrors>>({});
  const [errorSheetFilter, setErrorSheetFilter] = useState<string>("__all__");
  const [errorQuery, setErrorQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [removeForId, setRemoveForId] = useState<string | null>(null);
  const [removeImpact, setRemoveImpact] = useState<DeleteImpact | null>(null);
  const [removeImpactLoading, setRemoveImpactLoading] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  useEffect(() => {
    setRoadmapOptions(roadmaps);
  }, [roadmaps]);

  useEffect(() => {
    if (roadmapId && !roadmapOptions.some((r) => r.id === roadmapId)) {
      setRoadmapId("");
    }
  }, [roadmapOptions, roadmapId]);

  const filteredListRows = useMemo(() => {
    const q = listSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const roadmap = r.roadmap?.name ?? "";
      const hay = `${r.sourceFileName} ${r.id} ${r.status} ${String(r.startedAt)} ${roadmap}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, listSearchQuery]);

  const selectedErrors = useMemo(
    () => (selectedErrorsFor ? errorsById[selectedErrorsFor] : undefined),
    [errorsById, selectedErrorsFor]
  );

  const errorSheets = useMemo(() => {
    const rows = selectedErrors?.rows ?? [];
    const set = new Set(rows.map((r) => r.sheetName).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [selectedErrors?.rows]);

  const filteredErrorRows = useMemo(() => {
    const rows = selectedErrors?.rows ?? [];
    const q = errorQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (errorSheetFilter !== "__all__" && r.sheetName !== errorSheetFilter) return false;
      if (!q) return true;
      const hay = `${r.sheetName} ${r.rowNumber} ${r.status} ${r.entityKey} ${r.message ?? ""} ${r.entityType ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [selectedErrors?.rows, errorSheetFilter, errorQuery]);

  function downloadErrorsCsv(importId: string) {
    const rows = filteredErrorRows;
    const header = ["sheetName", "rowNumber", "status", "entityType", "entityKey", "message"];
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.sheetName, r.rowNumber, r.status, r.entityType ?? "", r.entityKey, r.message ?? ""]
          .map((c) => esc(String(c)))
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${importId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refresh() {
    try {
      const data = await fetchJson<ImportBatchRow[]>("/api/imports");
      setRows(data);
    } catch (err) {
      push(`Refresh failed: ${String(err)}`, "error");
    }
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("workbook") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      push("Please select an .xlsx file.", "error");
      return;
    }
    if (importInto === "existing") {
      if (!roadmapId.trim()) {
        push("Select an existing roadmap to import into, or choose “Create new roadmap”.", "error");
        return;
      }
    } else if (!roadmapName.trim()) {
      push("Enter a name for the new roadmap (or pick an existing roadmap).", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      if (workspaceId.trim()) payload.append("workspaceId", workspaceId.trim());
      if (importInto === "existing") {
        payload.append("roadmapId", roadmapId.trim());
      } else {
        payload.append("roadmapName", roadmapName.trim());
      }
      const res = await fetch(`${API_BASE}/api/imports/workbook`, {
        method: "POST",
        body: payload,
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        importId?: string;
        status?: string;
        imported?: number;
        failed?: number;
        skipped?: number;
      };
      if (!res.ok) {
        const detail = [body.message, body.error].filter(Boolean).join(" — ");
        push(`Upload failed: ${detail || `HTTP ${res.status}`}`, "error");
        return;
      }
      if (body.status === "failed" && body.error) {
        push(`Import failed: ${body.error}`, "error");
      } else {
        const parts = [`Import ${body.importId ?? "done"}`];
        if (typeof body.imported === "number") parts.push(`${body.imported} imported`);
        if (typeof body.skipped === "number" && body.skipped > 0) parts.push(`${body.skipped} skipped`);
        if (typeof body.failed === "number" && body.failed > 0) parts.push(`${body.failed} row errors`);
        push(parts.join(" · "));
      }
      form.reset();
      await refresh();
      await router.refresh();
    } catch (err) {
      push(`Upload failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function onWorkbookFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || importInto !== "new") return;
    if (roadmapName.trim()) return;
    const base = f.name.replace(/\.xlsx$/i, "").replace(/_/g, " ").trim();
    if (base) setRoadmapName(base);
  }

  function impactSummaryLines(b: DeleteImpact["breakdown"]): string[] {
    const lines: string[] = [];
    const add = (n: number, label: string) => {
      if (n > 0) lines.push(`${n} ${label}`);
    };
    add(b.importRowResults, "import log row(s)");
    add(b.importBatches, "import batch record(s)");
    add(b.roadmaps, "roadmap(s) (full roadmap removed when linked)");
    add(b.roadmapItems, "roadmap item row(s)");
    add(b.phaseSegments, "phase segment(s)");
    add(b.roadmapItemTeams, "item–team link(s)");
    add(b.teamsOrphanImported, "imported-only team(s)");
    add(b.strategicThemes, "roadmap-scoped theme(s)");
    add(b.initiativeThemeViaRoadmapThemes, "initiative–theme link(s) via those themes");
    add(b.initiativeThemeViaOrphanInitiatives, "other initiative–theme link(s) for removed initiatives");
    add(b.initiativesOrphan, "initiative(s) removed (only appeared on this roadmap)");
    return lines;
  }

  async function openRemoveImport(importId: string) {
    setRemoveForId(importId);
    setRemoveImpact(null);
    setRemoveImpactLoading(true);
    try {
      const impact = await fetchJson<DeleteImpact>(`/api/imports/${importId}/delete-impact`);
      setRemoveImpact(impact);
    } catch (err) {
      push(`Could not load delete preview: ${String(err)}`, "error");
      setRemoveForId(null);
    } finally {
      setRemoveImpactLoading(false);
    }
  }

  function closeRemoveImport() {
    if (removeBusy) return;
    setRemoveForId(null);
    setRemoveImpact(null);
  }

  async function confirmRemoveImport() {
    if (!removeForId) return;
    setRemoveBusy(true);
    try {
      await sendJson(`/api/imports/${removeForId}`, "DELETE");
      push("Import removed and linked data deleted.");
      closeRemoveImport();
      await refresh();
      await router.refresh();
    } catch (err) {
      push(`Remove failed: ${String(err)}`, "error");
    } finally {
      setRemoveBusy(false);
    }
  }

  async function onViewErrors(importId: string) {
    try {
      const payload = await fetchJson<ImportErrors>(`/api/imports/${importId}/errors`);
      setErrorsById((curr) => ({ ...curr, [importId]: payload }));
      setSelectedErrorsFor(importId);
      setErrorSheetFilter("__all__");
      setErrorQuery("");
    } catch (err) {
      push(`Cannot load errors: ${String(err)}`, "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      <form onSubmit={onUpload} className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-3 text-sm text-slate-400">
          The API requires a target roadmap: either an existing one or a new name (draft roadmap is created).
        </p>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="importInto"
              checked={importInto === "existing"}
              onChange={() => setImportInto("existing")}
            />
            <span>Existing roadmap</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="importInto"
              checked={importInto === "new"}
              onChange={() => setImportInto("new")}
            />
            <span>Create new roadmap</span>
          </label>
        </div>
        {importInto === "existing" ? (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Roadmap</span>
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={roadmapId}
              onChange={(e) => setRoadmapId(e.target.value)}
              required={importInto === "existing"}
            >
              <option value="">Select roadmap…</option>
              {roadmapOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {roadmapOptions.length === 0 && (
              <span className="text-xs text-amber-200/90">
                No roadmaps loaded. Create one under Roadmaps first, or use “Create new roadmap”.
              </span>
            )}
          </label>
        ) : (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="text-slate-400">New roadmap name</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="e.g. 2026 CET Sales & Marketing"
              value={roadmapName}
              onChange={(e) => setRoadmapName(e.target.value)}
            />
          </label>
        )}
        <div className="grid gap-3 md:grid-cols-[1fr_minmax(12rem,1fr)_auto]">
          <input
            name="workbook"
            type="file"
            accept=".xlsx"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
            onChange={onWorkbookFileChange}
          />
          <div className="min-w-0 self-end">
            <WorkspaceSelectField
              label="Workspace (optional)"
              value={workspaceId}
              onChange={setWorkspaceId}
              workspaces={workspaces}
              optional
              disabled={busy}
            />
          </div>
          <button
            disabled={busy}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium disabled:opacity-60"
            type="submit"
          >
            {busy ? "Uploading..." : "Upload workbook"}
          </button>
        </div>
      </form>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          onClick={refresh}
        >
          Refresh imports
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/70 text-slate-400">
            <tr>
              <th className="p-4">File</th>
              <th>Status</th>
              <th>Started</th>
              <th>Roadmap</th>
              <th>Rows</th>
              <th className="pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredListRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="p-4">
                  <div className="font-medium">{r.sourceFileName}</div>
                  <div className="text-xs text-slate-500">{r.id}</div>
                </td>
                <td>{r.status}</td>
                <td>{String(r.startedAt).slice(0, 19).replace("T", " ")}</td>
                <td>
                  {r.roadmap ? (
                    <Link
                      href={`/roadmaps/${r.roadmap.id}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      {r.roadmap.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{r._count?.rowResults ?? "—"}</td>
                <td className="pr-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      onClick={() => onViewErrors(r.id)}
                    >
                      View errors
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950/40"
                      onClick={() => openRemoveImport(r.id)}
                    >
                      Remove…
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredListRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={6}>
                  {rows.length === 0 ? "No imports yet." : "No imports match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={!!removeForId}
        onClose={closeRemoveImport}
        title="Remove import"
        subtitle={removeImpact?.sourceFileName ?? removeForId ?? ""}
        maxWidthClass="max-w-lg"
      >
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          {removeImpactLoading && <p className="text-slate-400">Loading what will be deleted…</p>}
          {!removeImpactLoading && removeImpact && (
            <>
              <p>
                About <span className="font-semibold text-slate-100">{removeImpact.totalRecords}</span>{" "}
                database record(s) will be removed (counts may overlap conceptually; the operation runs in
                one transaction).
              </p>
              {removeImpact.breakdown.roadmaps > 0 && (
                <div className="rounded-lg border border-amber-800/60 bg-amber-950/25 px-3 py-2 text-amber-100/95">
                  <strong className="font-medium">Roadmap scope:</strong> the linked roadmap is deleted
                  entirely, including all grid rows on it. If you imported into a roadmap that already had
                  other work, that work is removed too. Prefer a dedicated roadmap per import when you
                  need a clean undo.
                </div>
              )}
              <ul className="list-inside list-disc space-y-1 text-slate-400">
                {impactSummaryLines(removeImpact.breakdown).map((line, i) => (
                  <li key={`${i}-${line}`}>{line}</li>
                ))}
              </ul>
              {impactSummaryLines(removeImpact.breakdown).length === 0 && (
                <p className="text-slate-400">Only the import batch and its log rows (no roadmap yet).</p>
              )}
            </>
          )}
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              disabled={removeBusy || removeImpactLoading}
              onClick={closeRemoveImport}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
              disabled={removeBusy || removeImpactLoading || !removeImpact}
              onClick={() => void confirmRemoveImport()}
            >
              {removeBusy ? "Removing…" : "Remove import and data"}
            </button>
          </ModalActions>
        </div>
      </FormModal>

      <FormModal
        open={!!selectedErrorsFor}
        onClose={() => setSelectedErrorsFor(null)}
        title="Import errors"
        subtitle={selectedErrorsFor ?? ""}
        maxWidthClass="max-w-4xl"
      >
          <div className="mb-3 mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>
              {selectedErrors?.count ?? 0} row(s) not marked imported · showing{" "}
              <span className="text-slate-200">{filteredErrorRows.length}</span> after filters
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Sheet
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                value={errorSheetFilter}
                onChange={(e) => setErrorSheetFilter(e.target.value)}
              >
                <option value="__all__">All sheets</option>
                {errorSheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[12rem] flex-1 flex flex-col gap-1 text-xs text-slate-400">
              Search
              <input
                type="search"
                placeholder="Filter by text…"
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                value={errorQuery}
                onChange={(e) => setErrorQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => selectedErrorsFor && downloadErrorsCsv(selectedErrorsFor)}
            >
              Download CSV (filtered)
            </button>
          </div>
          <div className="max-h-80 overflow-auto rounded border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="p-2">Sheet</th>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th className="pr-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredErrorRows.map((er) => (
                  <tr key={er.id} className="border-t border-slate-800">
                    <td className="p-2">{er.sheetName}</td>
                    <td>{er.rowNumber}</td>
                    <td>{er.status}</td>
                    <td>{er.entityType || "—"}</td>
                    <td className="max-w-[10rem] break-words">{er.entityKey || "—"}</td>
                    <td className="pr-2">{er.message || "—"}</td>
                  </tr>
                ))}
                {filteredErrorRows.length === 0 && (
                  <tr>
                    <td className="p-2 text-slate-400" colSpan={6}>
                      {(selectedErrors?.rows ?? []).length === 0
                        ? "No errors for this import."
                        : "No rows match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </FormModal>
    </>
  );
}
