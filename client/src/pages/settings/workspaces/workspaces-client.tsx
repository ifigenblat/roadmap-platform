import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../../components/form-modal";
import { PageToolbar } from "../../../components/page-toolbar";
import { sendJson } from "../../../lib/api";
import { ToastViewport, useToasts } from "../../../lib/toast";

type WorkspaceRow = { id: string; name: string; slug: string };

export function WorkspacesClient({ initial }: { initial: WorkspaceRow[] }) {
  const [rows, setRows] = useState(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.slug].join(" ").toLowerCase().includes(q));
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: { name: string; slug?: string } = { name: name.trim() };
      if (slug.trim()) body.slug = slug.trim().toLowerCase();
      const created = await sendJson<WorkspaceRow>("/api/workspaces", "POST", body);
      setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setSlug("");
      setCreateOpen(false);
      push("Workspace created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editId) return;
    setBusy(true);
    try {
      const updated = await sendJson<WorkspaceRow>(`/api/workspaces/${editId}`, "PATCH", {
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
      });
      setRows((prev) => prev.map((r) => (r.id === editId ? updated : r)));
      setEditId(null);
      push("Workspace updated.");
    } catch (err) {
      push(`Update failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: WorkspaceRow) {
    setEditId(r.id);
    setEditName(r.name);
    setEditSlug(r.slug);
  }

  async function onDelete(id: string, slugLabel: string) {
    if (!confirm(`Delete workspace "${slugLabel}"? This only works if it has no roadmaps, initiatives, or other data.`)) {
      return;
    }
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/workspaces/${id}`, "DELETE");
      push("Workspace deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  const countLabel =
    filteredRows.length === rows.length
      ? `${rows.length} workspace${rows.length === 1 ? "" : "s"}`
      : `${filteredRows.length} of ${rows.length}`;

  return (
    <div className="grid gap-6">
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-slate-100">Workspaces</h2>
          <p className="mt-1 text-sm text-slate-400">
            Create isolated spaces for portfolios. Roadmaps, initiatives, and themes belong to a workspace.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setCreateOpen(true)}
        >
          New workspace
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 [&>div]:mb-0">
        <PageToolbar
          searchPlaceholder="Search by name or slug…"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchId="workspaces-search"
        />
      </div>

      <div className="text-sm text-slate-500">{countLabel}</div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/70 text-xs font-medium uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="p-4 font-medium">{r.name}</td>
                <td className="p-4 font-mono text-xs text-slate-400">{r.slug}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-rose-300 hover:bg-slate-800"
                      onClick={() => onDelete(r.id, r.slug)}
                      disabled={r.slug === "default"}
                      title={r.slug === "default" ? "Cannot delete the default workspace" : undefined}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={3}>
                  {rows.length === 0 ? "No workspaces yet." : "No matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New workspace"
        subtitle="Slug is optional — we derive one from the name if you leave it blank."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input className={modalFieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Slug (optional)</span>
            <input
              className={modalFieldClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. product-2026"
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
        open={editId != null}
        onClose={() => !busy && setEditId(null)}
        title="Edit workspace"
      >
        <form onSubmit={onSaveEdit} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input className={modalFieldClass} value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Slug</span>
            <input className={modalFieldClass} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} required />
          </label>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setEditId(null)}
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
    </div>
  );
}
