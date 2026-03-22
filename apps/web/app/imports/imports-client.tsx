"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { API_BASE, fetchJson } from "../../lib/api";
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

export function ImportsClient({ initial }: { initial: ImportBatchRow[] }) {
  const [rows, setRows] = useState(initial);
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedErrorsFor, setSelectedErrorsFor] = useState<string | null>(null);
  const [errorsById, setErrorsById] = useState<Record<string, ImportErrors>>({});
  const [errorSheetFilter, setErrorSheetFilter] = useState<string>("__all__");
  const [errorQuery, setErrorQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

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
    setBusy(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      if (workspaceId.trim()) payload.append("workspaceId", workspaceId.trim());
      const res = await fetch(`${API_BASE}/api/imports/workbook`, {
        method: "POST",
        body: payload,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);
      push(`Upload accepted: ${body.importId}`);
      form.reset();
      setUploadOpen(false);
      await refresh();
    } catch (err) {
      push(`Upload failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
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
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            name="workbook"
            type="file"
            accept=".xlsx"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Workspace ID (optional)"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          />
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
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    onClick={() => onViewErrors(r.id)}
                  >
                    View errors
                  </button>
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
