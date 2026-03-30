"use client";

import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

export type PhaseRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export function PhasesClient({
  initial,
  workspaceId,
  workspaceLabel,
}: {
  initial: PhaseRow[];
  workspaceId: string;
  workspaceLabel: string;
}) {
  const [rows, setRows] = useState(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<PhaseRow | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      push("No workspace selected.", "error");
      return;
    }
    setBusy(true);
    try {
      const so = Number.parseInt(sortOrder, 10);
      const created = await sendJson<PhaseRow>("/api/phase-definitions", "POST", {
        name: name.trim(),
        sortOrder: Number.isFinite(so) ? so : 0,
        workspaceId,
      });
      setRows((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setName("");
      setSortOrder("0");
      setCreateOpen(false);
      push("Phase created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setBusy(true);
    try {
      const so = Number.parseInt(sortOrder, 10);
      const updated = await sendJson<PhaseRow>(`/api/phase-definitions/${editRow.id}`, "PATCH", {
        name: name.trim(),
        sortOrder: Number.isFinite(so) ? so : editRow.sortOrder,
      });
      setRows((prev) =>
        prev
          .map((r) => (r.id === updated.id ? updated : r))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
      setEditRow(null);
      push("Phase updated.");
    } catch (err) {
      push(`Update failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this phase? It must not be assigned to any roadmap segment.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/phase-definitions/${id}`, "DELETE");
      push("Phase deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  function openEdit(r: PhaseRow) {
    setEditRow(r);
    setName(r.name);
    setSortOrder(String(r.sortOrder));
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <p className="mb-4 text-sm text-slate-400">
        Workspace: <span className="text-slate-200">{workspaceLabel || "—"}</span>. These
        labels appear in the roadmap grid and timeline when editing phase rows.
      </p>
      <PageToolbar
        searchPlaceholder="Search phases by name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="phases-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={!workspaceId}
            onClick={() => setCreateOpen(true)}
          >
            New phase
          </button>
        }
      />

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New phase"
        subtitle="Shared across all roadmaps in this workspace."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input
              className={modalFieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Sort order</span>
            <input
              type="number"
              className={modalFieldClass}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <FormModal
        open={!!editRow}
        onClose={() => !busy && setEditRow(null)}
        title="Edit phase"
        subtitle="Renaming updates all linked roadmap segments."
      >
        <form onSubmit={onEditSave} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input
              className={modalFieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Sort order</span>
            <input
              type="number"
              className={modalFieldClass}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setEditRow(null)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-sm text-slate-400">
            <tr>
              <th className="p-4">Name</th>
              <th className="w-28">Order</th>
              <th className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 align-top">
                <td className="p-4 text-slate-100">{r.name}</td>
                <td className="py-3 tabular-nums text-slate-300">{r.sortOrder}</td>
                <td className="flex flex-wrap gap-2 py-3 pr-4">
                  <button
                    type="button"
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    onClick={() => openEdit(r)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40"
                    onClick={() => onDelete(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={3}>
                  {rows.length === 0
                    ? "No phases yet. Create phases here so roadmap grids use a shared dropdown."
                    : "No phases match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
