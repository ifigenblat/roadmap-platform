"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DatePickerField } from "../../components/date-picker-field";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { SortableTh } from "../../components/sortable-th";
import { sendJson } from "../../lib/api";
import { resolveDefaultWorkspaceId } from "../../lib/workspace-display";
import { ToastViewport, useToasts } from "../../lib/toast";

type RoadmapRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  planningYear: number;
  status: string;
  startDate: string;
  endDate: string;
};

type WorkspaceOption = { id: string; name: string; slug: string };

type SortKey = "name" | "year" | "status" | "range";

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 80) : "roadmap";
}

function sortRoadmaps(rows: RoadmapRow[], key: SortKey, dir: "asc" | "desc"): RoadmapRow[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return m * a.name.localeCompare(b.name);
    if (key === "year") return m * (a.planningYear - b.planningYear);
    if (key === "status") return m * a.status.localeCompare(b.status);
    const ra = `${String(a.startDate).slice(0, 10)} ${String(a.endDate).slice(0, 10)}`;
    const rb = `${String(b.startDate).slice(0, 10)} ${String(b.endDate).slice(0, 10)}`;
    return m * ra.localeCompare(rb);
  });
}

export function RoadmapsClient({
  initial,
  workspaces,
  initialWorkspaceId = "",
}: {
  initial: RoadmapRow[];
  workspaces: WorkspaceOption[];
  initialWorkspaceId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [planningYear, setPlanningYear] = useState(() => new Date().getFullYear());
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [workspaceId, setWorkspaceId] = useState(() =>
    resolveDefaultWorkspaceId(workspaces, initialWorkspaceId),
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editYear, setEditYear] = useState(0);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const { toasts, push, dismiss } = useToasts();

  const handleSort = useCallback(
    (k: SortKey) => {
      if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(k);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      !q
        ? rows
        : rows.filter((r) =>
            [r.name, r.slug, String(r.planningYear), r.status, String(r.startDate), String(r.endDate)]
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
    return sortRoadmaps(base, sortKey, sortDir);
  }, [rows, searchQuery, sortKey, sortDir]);

  function openEdit(r: RoadmapRow) {
    setEditId(r.id);
    setEditName(r.name);
    setEditSlug(r.slug);
    setEditDescription(r.description ?? "");
    setEditYear(r.planningYear);
    setEditStart(String(r.startDate).slice(0, 10));
    setEditEnd(String(r.endDate).slice(0, 10));
    setEditOpen(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditBusy(true);
    try {
      const updated = await sendJson<RoadmapRow>(`/api/roadmaps/${editId}`, "PATCH", {
        name: editName.trim(),
        slug: editSlug.trim(),
        description: editDescription.trim() || null,
        planningYear: editYear,
        startDate: editStart.slice(0, 10),
        endDate: editEnd.slice(0, 10),
      });
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, ...updated } : r)));
      setEditOpen(false);
      push("Roadmap updated.");
      router.refresh();
    } catch (err) {
      push(`Update failed: ${String(err)}`, "error");
    } finally {
      setEditBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this roadmap and all related items? This cannot be undone.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/roadmaps/${id}`, "DELETE");
      push("Roadmap deleted.");
      router.refresh();
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  async function setStatus(id: string, status: "active" | "archived") {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      if (status === "archived") {
        await sendJson(`/api/roadmaps/${id}/archive`, "POST", {});
      } else {
        await sendJson(`/api/roadmaps/${id}`, "PATCH", { status: "active" });
      }
      push(status === "archived" ? "Roadmap archived." : "Roadmap set active.");
    } catch (err) {
      setRows(prev);
      push(`Action failed: ${String(err)}`, "error");
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const effectiveWorkspaceId =
        workspaces.length > 0
          ? workspaces.some((w) => w.id === workspaceId)
            ? workspaceId
            : resolveDefaultWorkspaceId(workspaces, initialWorkspaceId)
          : "";
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim() || undefined,
        planningYear,
        startDate,
        endDate,
        status: "draft",
      };
      if (effectiveWorkspaceId) body.workspaceId = effectiveWorkspaceId;
      const created = await sendJson<RoadmapRow>("/api/roadmaps", "POST", body);
      setRows((prev) => [created, ...prev]);
      setName("");
      setSlug("");
      setDescription("");
      setPlanningYear(new Date().getFullYear());
      setStartDate(`${new Date().getFullYear()}-01-01`);
      setEndDate(`${new Date().getFullYear()}-12-31`);
      setWorkspaceId(resolveDefaultWorkspaceId(workspaces, initialWorkspaceId));
      setCreateOpen(false);
      push("Roadmap created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search roadmaps by name, year, status, dates…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="roadmaps-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => {
              setWorkspaceId(resolveDefaultWorkspaceId(workspaces, initialWorkspaceId));
              setCreateOpen(true);
            }}
          >
            New roadmap
          </button>
        }
      />
      <p className="mb-3 text-xs text-slate-500">
        Column headers sort this view only (not saved to the server).
      </p>

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New roadmap"
        subtitle="Choose a workspace when you have any; name, slug, and planning window are required."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Workspace</span>
            {workspaces.length > 0 ? (
              <select
                className={modalFieldClass}
                value={workspaces.some((w) => w.id === workspaceId) ? workspaceId : resolveDefaultWorkspaceId(workspaces, initialWorkspaceId)}
                onChange={(e) => setWorkspaceId(e.target.value)}
                required
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.slug})
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                No workspaces loaded. The roadmap will use the server default workspace (created automatically if needed).
                Add named workspaces under Settings when you want an explicit choice here.
              </p>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input
              className={modalFieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!slug.trim() && name.trim()) setSlug(slugify(name));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Slug (unique)</span>
            <input
              className={modalFieldClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="letters, numbers, hyphens"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Description</span>
            <textarea
              rows={2}
              className={modalFieldClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Year</span>
            <input
              type="number"
              className={modalFieldClass}
              value={planningYear}
              onChange={(e) => setPlanningYear(Number(e.target.value))}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Range — start"
              value={startDate}
              onChange={setStartDate}
              disabled={busy}
              required
            />
            <DatePickerField
              label="Range — end"
              value={endDate}
              onChange={setEndDate}
              disabled={busy}
              required
            />
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
              {busy ? "Creating…" : "Create roadmap"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <FormModal
        open={editOpen}
        onClose={() => !editBusy && setEditOpen(false)}
        title="Edit roadmap"
        subtitle={editName}
      >
        <form onSubmit={onSaveEdit} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Name</span>
            <input
              className={modalFieldClass}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Slug</span>
            <input
              className={modalFieldClass}
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Description</span>
            <textarea
              rows={2}
              className={modalFieldClass}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Year</span>
            <input
              type="number"
              className={modalFieldClass}
              value={editYear}
              onChange={(e) => setEditYear(Number(e.target.value))}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Range — start"
              value={editStart}
              onChange={setEditStart}
              disabled={editBusy}
              required
            />
            <DatePickerField
              label="Range — end"
              value={editEnd}
              onChange={setEditEnd}
              disabled={editBusy}
              required
            />
          </div>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={editBusy}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editBusy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {editBusy ? "Saving…" : "Save"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-sm text-slate-400">
            <tr>
              <SortableTh
                className="p-4"
                label="Name"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh label="Year" sortKey="year" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableTh
                label="Status"
                sortKey="status"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Range"
                sortKey="range"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <th className="border-l border-slate-800">Views</th>
              <th className="pr-4">Manage</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="p-4">{r.name}</td>
                <td>{r.planningYear}</td>
                <td>{r.status}</td>
                <td>
                  {String(r.startDate).slice(0, 10)} → {String(r.endDate).slice(0, 10)}
                </td>
                <td className="border-l border-slate-800 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/roadmaps/${r.id}`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Open grid
                    </Link>
                    <Link
                      href={`/roadmaps/${r.id}/timeline`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Timeline
                    </Link>
                    <Link
                      href={`/roadmaps/${r.id}/executive`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Executive
                    </Link>
                  </div>
                </td>
                <td className="pr-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded-md border border-indigo-700/60 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-950/40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(r.id)}
                      className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "active")}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Set active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "archived")}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={6}>
                  {rows.length === 0
                    ? "No roadmaps yet. Use “New roadmap” to create one in the app."
                    : "No roadmaps match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
