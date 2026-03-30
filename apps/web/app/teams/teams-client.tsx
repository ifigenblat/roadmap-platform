"use client";

import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type TeamRow = {
  id: string;
  name: string;
  kind?: string | null;
  active: boolean;
};

export function TeamsClient({ initial }: { initial: TeamRow[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [r.name, r.kind, r.active ? "active" : "inactive"].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await sendJson<TeamRow>("/api/teams", "POST", {
        name,
        kind: kind || undefined,
      });
      setRows((prev) => [created, ...prev]);
      setName("");
      setKind("");
      setCreateOpen(false);
      push("Team created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onPatchActive(id: string, active: boolean) {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, active } : r)));
    try {
      const updated = await sendJson<TeamRow>(`/api/teams/${id}`, "PATCH", { active });
      setRows((p) => p.map((r) => (r.id === id ? { ...r, active: updated.active } : r)));
      push("Team updated.");
    } catch (err) {
      setRows(prev);
      push(`Update failed: ${String(err)}`, "error");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this team? It must not be assigned to roadmap items.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/teams/${id}`, "DELETE");
      push("Team deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search teams by name or kind…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="teams-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreateOpen(true)}
          >
            New team
          </button>
        }
      />
      <p className="mb-3 text-sm text-slate-400">
        Teams are shared across all workspaces and can be assigned on any roadmap grid.
      </p>

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New team"
        subtitle="Creates a global team you can assign to initiatives on any roadmap."
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
            <span className="text-slate-400">Kind (optional)</span>
            <input
              className={modalFieldClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="e.g. squad"
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
              {busy ? "Creating…" : "Create team"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th>Kind</th>
              <th>Active</th>
              <th className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id} className="border-t border-slate-800 align-top">
                <td className="p-4">{t.name}</td>
                <td>{t.kind || "—"}</td>
                <td className="py-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.active}
                      onChange={(e) => onPatchActive(t.id, e.target.checked)}
                    />
                    Active
                  </label>
                </td>
                <td className="pr-4 py-3">
                  <button
                    type="button"
                    className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40"
                    onClick={() => onDelete(t.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={4}>
                  {rows.length === 0
                    ? "No teams yet. Use New team or seed the portfolio database."
                    : "No teams match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
