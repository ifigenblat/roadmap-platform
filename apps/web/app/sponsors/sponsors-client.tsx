"use client";

import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type SponsorRow = {
  id: string;
  displayName: string;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  notes?: string | null;
};

export function SponsorsClient({ initial }: { initial: SponsorRow[] }) {
  const [rows, setRows] = useState(initial);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [r.displayName, r.email, r.notes].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await sendJson<SponsorRow>("/api/business-sponsors", "POST", {
        displayName,
        email: email || undefined,
        workspaceId: workspaceId || undefined,
      });
      setRows((prev) => [created, ...prev]);
      setDisplayName("");
      setEmail("");
      setCreateOpen(false);
      push("Business sponsor created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onPatchNotes(id: string, notes: string) {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, notes } : r)));
    try {
      const updated = await sendJson<SponsorRow>(`/api/business-sponsors/${id}`, "PATCH", {
        notes: notes || null,
      });
      setRows((p) => p.map((r) => (r.id === id ? { ...r, notes: updated.notes } : r)));
      push("Sponsor updated.");
    } catch (err) {
      setRows(prev);
      push(`Update failed: ${String(err)}`, "error");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this sponsor? They must not be linked to any initiative.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/business-sponsors/${id}`, "DELETE");
      push("Sponsor deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search sponsors by name, email, notes…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="sponsors-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreateOpen(true)}
          >
            New sponsor
          </button>
        }
      />

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New business sponsor"
        subtitle="Used when linking initiatives to a sponsor record."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Display name</span>
            <input
              className={modalFieldClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Email (optional)</span>
            <input
              type="email"
              className={modalFieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {busy ? "Creating…" : "Create sponsor"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th>Email</th>
              <th>Notes</th>
              <th className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((s) => (
              <tr key={s.id} className="border-t border-slate-800 align-top">
                <td className="p-4">{s.displayName}</td>
                <td>{s.email || "—"}</td>
                <td className="py-3 pr-2">
                  <PatchNotesCell value={s.notes || ""} onSave={(v) => onPatchNotes(s.id, v)} />
                </td>
                <td className="pr-4 py-3">
                  <button
                    type="button"
                    className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40"
                    onClick={() => onDelete(s.id)}
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
                    ? "No business sponsors yet. Use New sponsor to assign on the Initiatives page."
                    : "No sponsors match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PatchNotesCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-1 max-w-[220px]">
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Notes"
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
        Save
      </button>
    </div>
  );
}
