"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type RoadmapRow = {
  id: string;
  name: string;
  planningYear: number;
  status: string;
  startDate: string;
  endDate: string;
};

type WorkspaceOption = { id: string; name: string; slug: string };

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 80) : "roadmap";
}

export function RoadmapsClient({
  initial,
  workspaces,
}: {
  initial: RoadmapRow[];
  workspaces: WorkspaceOption[];
}) {
  const [rows, setRows] = useState(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [planningYear, setPlanningYear] = useState(() => new Date().getFullYear());
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [workspaceId, setWorkspaceId] = useState("");
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, String(r.planningYear), r.status, String(r.startDate), String(r.endDate)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, searchQuery]);

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
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim() || undefined,
        planningYear,
        startDate,
        endDate,
        status: "draft",
      };
      if (workspaceId) body.workspaceId = workspaceId;
      const created = await sendJson<RoadmapRow>("/api/roadmaps", "POST", body);
      setRows((prev) => [created, ...prev]);
      setName("");
      setSlug("");
      setDescription("");
      setPlanningYear(new Date().getFullYear());
      setStartDate(`${new Date().getFullYear()}-01-01`);
      setEndDate(`${new Date().getFullYear()}-12-31`);
      setWorkspaceId("");
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
            onClick={() => setCreateOpen(true)}
          >
            New roadmap
          </button>
        }
      />

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New roadmap"
        subtitle="Define name, URL slug, planning window, and optional workspace."
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Workspace</span>
            <select
              className={modalFieldClass}
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              <option value="">Default workspace</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.slug})
                </option>
              ))}
            </select>
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
            <span className="text-slate-400">Description (optional)</span>
            <textarea
              rows={2}
              className={modalFieldClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Planning year</span>
            <input
              type="number"
              className={modalFieldClass}
              value={planningYear}
              onChange={(e) => setPlanningYear(Number(e.target.value))}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Start date</span>
              <input
                type="date"
                className={modalFieldClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">End date</span>
              <input
                type="date"
                className={modalFieldClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
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
              {busy ? "Creating…" : "Create roadmap"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th>Year</th>
              <th>Status</th>
              <th>Range</th>
              <th>Actions</th>
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
                <td className="flex gap-2 py-3">
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
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={5}>
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
