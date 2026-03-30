import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { MultiSelectDropdown } from "../../components/multi-select-dropdown";
import { PageToolbar } from "../../components/page-toolbar";
import { WorkspaceSelectField } from "../../components/workspace-select-field";
import { SortableTh } from "../../components/sortable-th";
import { sendJson } from "../../lib/api";
import { resolveDefaultWorkspaceId } from "../../lib/workspace-display";
import {
  themeColorHex,
  themeColorTokenLabel,
  themeColorTokenSelectOptions,
} from "../../lib/strategic-theme-color";
import { ToastViewport, useToasts } from "../../lib/toast";

const WORKSPACE_WIDE_ROADMAP_FILTER = "__workspace_wide__";

function matchesRoadmapScopeFilter(t: ThemeRow, filterIds: string[]): boolean {
  if (filterIds.length === 0) return true;
  const rid = (t.roadmapId ?? "").trim();
  return filterIds.some((id) => {
    if (id === WORKSPACE_WIDE_ROADMAP_FILTER) return rid === "";
    return rid !== "" && rid === id;
  });
}

function matchesThemeRowFilter(t: ThemeRow, selectedIds: string[]): boolean {
  if (selectedIds.length === 0) return true;
  return selectedIds.includes(t.id);
}

export type ThemeRow = {
  id: string;
  name: string;
  objective?: string | null;
  roadmapId?: string | null;
  orderIndex?: number | null;
  colorToken?: string | null;
  roadmap?: { id: string; name: string; planningYear: number } | null;
};

type RoadmapOption = { id: string; name: string; planningYear: number; workspaceId: string };
type WorkspaceOption = { id: string; name: string; slug: string };

type SortKey = "name" | "objective" | "roadmap" | "order" | "color" | "detail";

function roadmapDisplayLabel(t: ThemeRow): string {
  return t.roadmap ? `${t.roadmap.name} (${t.roadmap.planningYear})` : "Workspace-wide";
}

function sortThemes(rows: ThemeRow[], key: SortKey, dir: "asc" | "desc"): ThemeRow[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    } else if (key === "objective") {
      cmp = (a.objective ?? "").localeCompare(b.objective ?? "", undefined, { sensitivity: "base" });
    } else if (key === "roadmap") {
      cmp = roadmapDisplayLabel(a).localeCompare(roadmapDisplayLabel(b), undefined, { sensitivity: "base" });
    } else if (key === "order") {
      cmp = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    } else if (key === "color") {
      cmp = themeColorTokenLabel(a.colorToken).localeCompare(
        themeColorTokenLabel(b.colorToken),
        undefined,
        { sensitivity: "base" },
      );
    } else {
      cmp = a.id.localeCompare(b.id);
    }
    if (cmp !== 0) return m * cmp;
    return m * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function ThemesClient({
  initial,
  roadmaps,
  workspaces,
  initialWorkspaceId = "",
}: {
  initial: ThemeRow[];
  roadmaps: RoadmapOption[];
  workspaces: WorkspaceOption[];
  initialWorkspaceId?: string;
}) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [roadmapId, setRoadmapId] = useState("");
  const [workspaceId, setWorkspaceId] = useState(() =>
    resolveDefaultWorkspaceId(workspaces, initialWorkspaceId),
  );
  const [createColorToken, setCreateColorToken] = useState("");
  const [createOrderIndex, setCreateOrderIndex] = useState("0");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roadmapFilterIds, setRoadmapFilterIds] = useState<string[]>([]);
  const [themeRowFilterIds, setThemeRowFilterIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editRoadmapId, setEditRoadmapId] = useState("");
  const [editColorToken, setEditColorToken] = useState("");
  const [editOrderIndex, setEditOrderIndex] = useState("0");
  const { toasts, push, dismiss } = useToasts();

  const colorOptions = useMemo(() => themeColorTokenSelectOptions(), []);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    if (!createOpen || !roadmapId.trim()) return;
    const rm = roadmaps.find((r) => r.id === roadmapId);
    if (rm?.workspaceId && workspaces.some((w) => w.id === rm.workspaceId)) {
      setWorkspaceId(rm.workspaceId);
    }
  }, [createOpen, roadmapId, roadmaps, workspaces]);

  const roadmapFilterOptions = useMemo(
    () => [
      { value: WORKSPACE_WIDE_ROADMAP_FILTER, label: "Workspace-wide" },
      ...roadmaps.map((rm) => ({
        value: rm.id,
        label: `${rm.name} (${rm.planningYear})`,
      })),
    ],
    [roadmaps],
  );

  const themeRowFilterOptions = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        .map((r) => ({
          value: r.id,
          label: r.name,
          swatchColor: themeColorHex(r.colorToken),
          searchText: themeColorTokenLabel(r.colorToken),
        })),
    [rows],
  );

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
    const base = rows.filter((r) => {
      if (!matchesRoadmapScopeFilter(r, roadmapFilterIds)) return false;
      if (!matchesThemeRowFilter(r, themeRowFilterIds)) return false;
      if (!q) return true;
      const blob = [
        r.name,
        r.objective,
        r.roadmap?.name,
        r.roadmapId,
        String(r.orderIndex ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
    return sortThemes(base, sortKey, sortDir);
  }, [rows, searchQuery, roadmapFilterIds, themeRowFilterIds, sortKey, sortDir]);

  function openEdit(t: ThemeRow) {
    setEditing(t);
    setEditName(t.name);
    setEditObjective(t.objective ?? "");
    setEditRoadmapId(t.roadmapId ?? "");
    setEditColorToken(t.colorToken && t.colorToken !== "none" ? t.colorToken : "");
    setEditOrderIndex(String(t.orderIndex ?? 0));
    setEditOpen(true);
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const effectiveWorkspaceId = workspaces.some((w) => w.id === workspaceId)
      ? workspaceId
      : resolveDefaultWorkspaceId(workspaces, initialWorkspaceId);
    if (!effectiveWorkspaceId) {
      push("Choose a workspace (create one under Settings if none appear).", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await sendJson<ThemeRow>("/api/themes", "POST", {
        name,
        objective: objective || undefined,
        roadmapId: roadmapId || undefined,
        workspaceId: effectiveWorkspaceId,
        orderIndex: Number.parseInt(createOrderIndex, 10) || 0,
        colorToken: createColorToken || null,
      });
      setRows((prev) => [created, ...prev]);
      setName("");
      setObjective("");
      setRoadmapId("");
      setCreateColorToken("");
      setCreateOrderIndex("0");
      setWorkspaceId(resolveDefaultWorkspaceId(workspaces, initialWorkspaceId));
      setCreateOpen(false);
      push("Theme created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const updated = await sendJson<ThemeRow>(`/api/themes/${editing.id}`, "PATCH", {
        name: editName.trim(),
        objective: editObjective.trim() || null,
        roadmapId: editRoadmapId.trim() || null,
        colorToken: editColorToken.trim() || null,
        orderIndex: Number.parseInt(editOrderIndex, 10) || 0,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setEditOpen(false);
      setEditing(null);
      push("Theme saved.");
    } catch (err) {
      push(`Update failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
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
        searchPlaceholder="Search themes by name, objective, roadmap, sort order…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="themes-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => {
              setRoadmapId("");
              setWorkspaceId(resolveDefaultWorkspaceId(workspaces, initialWorkspaceId));
              setCreateOpen(true);
            }}
          >
            New theme
          </button>
        }
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label className="min-w-0 xl:col-span-6">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Roadmaps
          </span>
          <MultiSelectDropdown
            options={roadmapFilterOptions}
            value={roadmapFilterIds}
            onChange={setRoadmapFilterIds}
            placeholder="All scopes"
            emptyText="No roadmap options."
            searchable
            searchPlaceholder="Search roadmaps…"
          />
        </label>
        <label className="min-w-0 xl:col-span-6">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Themes
          </span>
          <MultiSelectDropdown
            options={themeRowFilterOptions}
            value={themeRowFilterIds}
            onChange={setThemeRowFilterIds}
            placeholder="All themes"
            emptyText="No themes yet."
            searchable
            searchPlaceholder="Search themes…"
          />
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Showing {filteredRows.length} strategic theme{filteredRows.length === 1 ? "" : "s"}
        {rows.length !== filteredRows.length ? ` (of ${rows.length})` : ""}.
      </p>
      <p className="mb-3 text-xs text-slate-500">
        Column headers sort this view only (not saved to the server).
      </p>

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New strategic theme"
        subtitle="Workspace is required. Picking a roadmap sets workspace to the one that roadmap belongs to."
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
              <span className="text-slate-400">Objective</span>
              <textarea
                className={modalFieldClass}
                rows={3}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Roadmap</span>
              <select
                className={modalFieldClass}
                value={roadmapId}
                onChange={(e) => setRoadmapId(e.target.value)}
              >
                <option value="">Workspace-wide (global)</option>
                {roadmaps.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name} ({rm.planningYear})
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <WorkspaceSelectField
                label="Workspace"
                value={workspaceId}
                onChange={setWorkspaceId}
                workspaces={workspaces}
                disabled={busy}
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Color token</span>
              <select
                className={modalFieldClass}
                value={createColorToken}
                onChange={(e) => setCreateColorToken(e.target.value)}
              >
                {colorOptions.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Sort order</span>
              <input
                type="number"
                className={modalFieldClass}
                value={createOrderIndex}
                onChange={(e) => setCreateOrderIndex(e.target.value)}
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
              disabled={busy || workspaces.length === 0}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Creating…" : "Create theme"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <FormModal
        open={editOpen && !!editing}
        onClose={() => !busy && setEditOpen(false)}
        title="Edit strategic theme"
        subtitle={editing?.name}
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
            <span className="text-slate-400">Objective</span>
            <textarea
              className={modalFieldClass}
              rows={4}
              value={editObjective}
              onChange={(e) => setEditObjective(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Roadmap</span>
            <select
              className={modalFieldClass}
              value={editRoadmapId}
              onChange={(e) => setEditRoadmapId(e.target.value)}
            >
              <option value="">Workspace-wide (global)</option>
              {roadmaps.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.name} ({rm.planningYear})
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Color token</span>
              <select
                className={modalFieldClass}
                value={editColorToken}
                onChange={(e) => setEditColorToken(e.target.value)}
              >
                {colorOptions.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Sort order</span>
              <input
                type="number"
                className={modalFieldClass}
                value={editOrderIndex}
                onChange={(e) => setEditOrderIndex(e.target.value)}
              />
            </label>
          </div>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setEditOpen(false)}
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
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/70 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <SortableTh
                label="Name"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="p-4"
              />
              <SortableTh
                label="Objective"
                sortKey="objective"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="min-w-[12rem]"
              />
              <SortableTh
                label="Roadmap"
                sortKey="roadmap"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className=""
              />
              <SortableTh
                label="Order"
                sortKey="order"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden text-center lg:table-cell"
              />
              <SortableTh
                label="Color"
                sortKey="color"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden lg:table-cell"
              />
              <SortableTh
                label="Detail"
                sortKey="detail"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className=""
              />
              <th className="pr-4 text-left" colSpan={2}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id} className="border-t border-slate-800 align-top">
                <td className="p-4 font-medium text-slate-100">{t.name}</td>
                <td className="max-w-md whitespace-pre-wrap break-words py-3 text-slate-300">
                  {t.objective?.trim() || "—"}
                </td>
                <td className="py-3 text-slate-400">
                  {t.roadmap ? `${t.roadmap.name} (${t.roadmap.planningYear})` : "Workspace-wide"}
                </td>
                <td className="hidden py-3 text-center tabular-nums text-slate-400 lg:table-cell">
                  {t.orderIndex ?? 0}
                </td>
                <td className="hidden py-3 lg:table-cell">
                  <span className="inline-flex items-center gap-2 text-slate-300">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-600"
                      style={{
                        backgroundColor: themeColorHex(t.colorToken) ?? "transparent",
                      }}
                    />
                    {themeColorTokenLabel(t.colorToken)}
                  </span>
                </td>
                <td className="py-3">
                  <Link
                    to={`/themes/${t.id}`}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    View narrative
                  </Link>
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    onClick={() => openEdit(t)}
                  >
                    Edit
                  </button>
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
                <td className="p-4 text-slate-400" colSpan={8}>
                  {rows.length === 0
                    ? "No themes yet. Use New theme or start api-gateway + portfolio-service."
                    : "No themes match your search or filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
