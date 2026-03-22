"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type ThemeRow = {
  id: string;
  name: string;
  objective?: string | null;
  roadmapId?: string | null;
};

export function ThemesClient({ initial }: { initial: ThemeRow[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [roadmapId, setRoadmapId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [r.name, r.objective, r.roadmapId].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await sendJson<ThemeRow>("/api/themes", "POST", {
        name,
        objective: objective || undefined,
        roadmapId: roadmapId || undefined,
        workspaceId: workspaceId || undefined,
        orderIndex: 0,
      });
      setRows((prev) => [created, ...prev]);
      setName("");
      setObjective("");
      setRoadmapId("");
      setCreateOpen(false);
      push("Theme created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onPatchName(id: string, nextName: string) {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, name: nextName } : r)));
    try {
      const updated = await sendJson<ThemeRow>(`/api/themes/${id}`, "PATCH", {
        name: nextName,
      });
      setRows((p) => p.map((r) => (r.id === id ? { ...r, name: updated.name } : r)));
      push("Theme name saved.");
    } catch (err) {
      setRows(prev);
      push(`Update failed: ${String(err)}`, "error");
    }
  }

  async function onPatchObjective(id: string, nextObjective: string) {
    const prev = rows;
    setRows((curr) =>
      curr.map((r) => (r.id === id ? { ...r, objective: nextObjective } : r))
    );
    try {
      const updated = await sendJson<ThemeRow>(`/api/themes/${id}`, "PATCH", {
        objective: nextObjective || null,
      });
      setRows((p) =>
        p.map((r) => (r.id === id ? { ...r, objective: updated.objective } : r))
      );
      push("Theme updated.");
    } catch (err) {
      setRows(prev);
      push(`Update failed: ${String(err)}`, "error");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this strategic theme? Initiative links will be removed.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/themes/${id}`, "DELETE");
      push("Theme deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search themes by name, objective, roadmap…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="themes-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreateOpen(true)}
          >
            New theme
          </button>
        }
      />

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New strategic theme"
        subtitle="Workspace defaults apply when workspace ID is omitted."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-slate-400">Name</span>
              <input
                className={modalFieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-slate-400">Objective (optional)</span>
              <input
                className={modalFieldClass}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Roadmap ID (optional)</span>
              <input
                className={modalFieldClass}
                value={roadmapId}
                onChange={(e) => setRoadmapId(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Workspace ID (optional)</span>
              <input
                className={modalFieldClass}
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              />
            </label>
          </div>
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
              {busy ? "Creating…" : "Create theme"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th>Objective</th>
              <th>Roadmap</th>
              <th>Detail</th>
              <th className="pr-4" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id} className="border-t border-slate-800 align-top">
                <td className="p-4">
                  <PatchNameCell value={t.name} onSave={(v) => onPatchName(t.id, v)} />
                </td>
                <td>
                  <PatchObjectiveCell
                    value={t.objective || ""}
                    onSave={(v) => onPatchObjective(t.id, v)}
                  />
                </td>
                <td>{t.roadmapId || "Global"}</td>
                <td className="pr-4 py-3">
                  <Link
                    href={`/themes/${t.id}`}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    View narrative
                  </Link>
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
                <td className="p-4 text-slate-400" colSpan={5}>
                  {rows.length === 0
                    ? "No themes yet. Use New theme or start api-gateway + portfolio-service."
                    : "No themes match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PatchNameCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Name"
      />
      <button
        type="button"
        disabled={busy || !draft.trim()}
        className="self-start rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          await onSave(draft.trim());
          setBusy(false);
        }}
      >
        Save name
      </button>
    </div>
  );
}

function PatchObjectiveCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-1 max-w-xs">
      <textarea
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm min-h-[60px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Objective"
      />
      <button
        type="button"
        disabled={busy}
        className="self-start rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          await onSave(draft);
          setBusy(false);
        }}
      >
        Save objective
      </button>
    </div>
  );
}
