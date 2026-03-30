"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { MultiSelectDropdown } from "../../components/multi-select-dropdown";
import { PageToolbar } from "../../components/page-toolbar";
import { SortableTh } from "../../components/sortable-th";
import { fetchJson, sendJson } from "../../lib/api";
import { INITIATIVE_TYPE_OPTIONS, mergeOptionList } from "../../lib/grid-dropdowns";
import { ToastViewport, useToasts } from "../../lib/toast";
import { WorkspaceSelectField } from "../../components/workspace-select-field";

const NO_SPONSOR_FILTER = "__none__";
const NO_ROADMAP_FILTER = "__no_roadmap__";

type ThemeLink = { strategicTheme: { id: string; name: string; colorToken?: string | null } };

type InitiativeRow = {
  id: string;
  canonicalName: string;
  shortObjective?: string | null;
  detailedObjective?: string | null;
  notes?: string | null;
  type?: string | null;
  sourceReference?: string | null;
  businessSponsor?: string | null;
  businessSponsorId?: string | null;
  sponsor?: { id: string; displayName: string } | null;
  themes?: ThemeLink[];
  roadmapItems?: Array<{
    roadmap: { id: string; name: string; planningYear: number };
  }>;
};

type ThemeOption = { id: string; name: string; colorToken?: string | null };
type SponsorOption = { id: string; displayName: string };
type RoadmapOption = { id: string; name: string; planningYear: number };
type WorkspaceOption = { id: string; name: string; slug: string };

const thCell = "border-b border-slate-800 px-3 py-2.5 text-left align-bottom text-xs font-medium uppercase tracking-wide text-slate-500";
const tdCell = "align-top px-3 py-2.5 text-sm";

type InitSortKey = "name" | "objective" | "sponsor" | "themes" | "notes";

function sortInitiatives(
  list: InitiativeRow[],
  key: InitSortKey,
  dir: "asc" | "desc",
): InitiativeRow[] {
  const m = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === "name") return m * a.canonicalName.localeCompare(b.canonicalName);
    if (key === "objective")
      return m * (a.shortObjective || "").localeCompare(b.shortObjective || "");
    const sa = a.sponsor?.displayName || a.businessSponsor || "";
    const sb = b.sponsor?.displayName || b.businessSponsor || "";
    if (key === "sponsor") return m * sa.localeCompare(sb);
    const ta = (a.themes ?? []).map((t) => t.strategicTheme.name).join(", ");
    const tb = (b.themes ?? []).map((t) => t.strategicTheme.name).join(", ");
    if (key === "themes") return m * ta.localeCompare(tb);
    return m * (a.notes || "").localeCompare(b.notes || "");
  });
}

function initiativeSponsorKey(r: InitiativeRow): string {
  return r.businessSponsorId ?? r.sponsor?.id ?? "";
}

function matchesSponsorFilter(r: InitiativeRow, filterIds: string[]): boolean {
  if (filterIds.length === 0) return true;
  const sid = initiativeSponsorKey(r);
  return filterIds.some((id) => {
    if (id === NO_SPONSOR_FILTER) return sid === "";
    return sid !== "" && sid === id;
  });
}

function matchesRoadmapFilter(r: InitiativeRow, filterIds: string[]): boolean {
  if (filterIds.length === 0) return true;
  const onRoadmaps = new Set((r.roadmapItems ?? []).map((ri) => ri.roadmap.id));
  return filterIds.some((id) => {
    if (id === NO_ROADMAP_FILTER) return onRoadmaps.size === 0;
    return onRoadmaps.has(id);
  });
}

export function InitiativesClient({
  initial,
  themes,
  sponsors,
  roadmaps,
  workspaces,
  initialWorkspaceId = "",
}: {
  initial: InitiativeRow[];
  themes: ThemeOption[];
  sponsors: SponsorOption[];
  roadmaps: RoadmapOption[];
  workspaces: WorkspaceOption[];
  initialWorkspaceId?: string;
}) {
  const [rows, setRows] = useState(initial);
  const [canonicalName, setCanonicalName] = useState("");
  const [shortObjective, setShortObjective] = useState("");
  const [createDetailed, setCreateDetailed] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createType, setCreateType] = useState("");
  const [createSponsorId, setCreateSponsorId] = useState("");
  const [createThemeIds, setCreateThemeIds] = useState<string[]>([]);
  const [createJira, setCreateJira] = useState("");
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roadmapFilterIds, setRoadmapFilterIds] = useState<string[]>([]);
  const [sponsorFilterIds, setSponsorFilterIds] = useState<string[]>([]);
  const [themeFilterIds, setThemeFilterIds] = useState<string[]>([]);
  const [typeFilterValues, setTypeFilterValues] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<InitSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<InitiativeRow | null>(null);
  const [editLoadBusy, setEditLoadBusy] = useState(false);
  const [editSaveBusy, setEditSaveBusy] = useState(false);
  const editFetchGen = useRef(0);
  const { toasts, push, dismiss } = useToasts();

  const [eName, setEName] = useState("");
  const [eShort, setEShort] = useState("");
  const [eDetailed, setEDetailed] = useState("");
  const [eNotes, setENotes] = useState("");
  const [eType, setEType] = useState("");
  const [eSponsorId, setESponsorId] = useState("");
  const [eThemeIds, setEThemeIds] = useState<string[]>([]);
  const [eJira, setEJira] = useState("");

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    if (!createOpen) return;
    setCanonicalName("");
    setShortObjective("");
    setCreateDetailed("");
    setCreateNotes("");
    setCreateType("");
    setCreateSponsorId("");
    setCreateThemeIds([]);
    setCreateJira("");
    setWorkspaceId(initialWorkspaceId);
  }, [createOpen, initialWorkspaceId]);

  useLayoutEffect(() => {
    if (!editRow) return;
    setEName(editRow.canonicalName ?? "");
    setEShort(editRow.shortObjective ?? "");
    setEDetailed(editRow.detailedObjective ?? "");
    setENotes(editRow.notes ?? "");
    setEType(editRow.type ?? "");
    setESponsorId(editRow.businessSponsorId ?? editRow.sponsor?.id ?? "");
    setEThemeIds((editRow.themes ?? []).map((t) => t.strategicTheme.id));
    setEJira(editRow.sourceReference ?? "");
  }, [editRow]);

  async function openEdit(id: string) {
    const gen = ++editFetchGen.current;
    setEditRow(null);
    setEditLoadBusy(true);
    try {
      const full = await fetchJson<InitiativeRow>(`/api/initiatives/${id}`);
      if (gen !== editFetchGen.current) return;
      setEditRow(full);
    } catch (err) {
      if (gen === editFetchGen.current) {
        push(`Could not load initiative: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    } finally {
      if (gen === editFetchGen.current) {
        setEditLoadBusy(false);
      }
    }
  }

  function closeEditModal() {
    if (editSaveBusy) return;
    editFetchGen.current += 1;
    setEditLoadBusy(false);
    setEditRow(null);
  }

  const handleSort = useCallback(
    (k: InitSortKey) => {
      if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(k);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const roadmapSelectOptions = useMemo(
    () => [
      { value: NO_ROADMAP_FILTER, label: "Not on any roadmap" },
      ...roadmaps.map((rm) => ({
        value: rm.id,
        label: `${rm.name} (${rm.planningYear})`,
      })),
    ],
    [roadmaps],
  );

  const sponsorSelectOptions = useMemo(
    () => [
      { value: NO_SPONSOR_FILTER, label: "No sponsor" },
      ...sponsors.map((s) => ({ value: s.id, label: s.displayName })),
    ],
    [sponsors],
  );

  const themeSelectOptions = useMemo(
    () => themes.map((t) => ({ value: t.id, label: t.name })),
    [themes],
  );

  const typeFilterOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const opt of INITIATIVE_TYPE_OPTIONS) {
      labels.set(opt, opt === "" ? "No type" : opt);
    }
    for (const r of rows) {
      const t = (r.type ?? "").trim();
      if (!labels.has(t)) labels.set(t, t === "" ? "No type" : t);
    }
    return Array.from(labels.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => {
        if (a.value === "") return -1;
        if (b.value === "") return 1;
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (!matchesRoadmapFilter(r, roadmapFilterIds)) return false;
      if (!matchesSponsorFilter(r, sponsorFilterIds)) return false;
      if (
        themeFilterIds.length > 0 &&
        !themeFilterIds.some((id) => (r.themes ?? []).some((lt) => lt.strategicTheme.id === id))
      ) {
        return false;
      }
      const typeNorm = (r.type ?? "").trim();
      if (typeFilterValues.length > 0 && !typeFilterValues.includes(typeNorm)) return false;
      if (!q) return true;
      const themeNames = (r.themes ?? []).map((t) => t.strategicTheme.name).join(" ");
      const roadmapNames = (r.roadmapItems ?? [])
        .map((ri) => `${ri.roadmap.name} ${ri.roadmap.planningYear}`)
        .join(" ");
      const blob = [
        r.canonicalName,
        r.shortObjective,
        r.detailedObjective,
        r.sponsor?.displayName,
        r.businessSponsor,
        themeNames,
        roadmapNames,
        r.notes,
        r.type,
        r.sourceReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
    return sortInitiatives(base, sortKey, sortDir);
  }, [
    rows,
    searchQuery,
    roadmapFilterIds,
    sponsorFilterIds,
    themeFilterIds,
    typeFilterValues,
    sortKey,
    sortDir,
  ]);

  const typeOptions = mergeOptionList(INITIATIVE_TYPE_OPTIONS, eType);
  const createTypeOptions = mergeOptionList(INITIATIVE_TYPE_OPTIONS, createType);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await sendJson<InitiativeRow>("/api/initiatives", "POST", {
        canonicalName: canonicalName.trim(),
        shortObjective: shortObjective.trim() || undefined,
        detailedObjective: createDetailed.trim() || undefined,
        notes: createNotes.trim() || undefined,
        type: createType.trim() || undefined,
        businessSponsorId: createSponsorId.trim() ? createSponsorId.trim() : undefined,
        sourceReference: createJira.trim() || undefined,
        sourceSystem: createJira.trim() ? "jira" : undefined,
        workspaceId: workspaceId.trim() || undefined,
      });
      if (createThemeIds.length > 0) {
        await sendJson(`/api/initiatives/${created.id}/theme-links`, "PUT", {
          strategicThemeIds: createThemeIds,
        });
      }
      const full = await fetchJson<InitiativeRow>(`/api/initiatives/${created.id}`);
      setRows((prev) => [full, ...prev]);
      setCreateOpen(false);
      push("Initiative created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setEditSaveBusy(true);
    try {
      await sendJson(`/api/initiatives/${editRow.id}`, "PATCH", {
        canonicalName: eName.trim(),
        shortObjective: eShort.trim() || null,
        detailedObjective: eDetailed.trim() || null,
        notes: eNotes.trim() || null,
        type: eType.trim() || null,
        businessSponsorId: eSponsorId.trim() ? eSponsorId.trim() : null,
        sourceReference: eJira.trim() || null,
        sourceSystem: eJira.trim() ? "jira" : null,
      });
      await sendJson(`/api/initiatives/${editRow.id}/theme-links`, "PUT", {
        strategicThemeIds: eThemeIds,
      });
      const fresh = await fetchJson<InitiativeRow>(`/api/initiatives/${editRow.id}`);
      setRows((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
      push("Initiative saved.");
      setEditRow(null);
    } catch (err) {
      push(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setEditSaveBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this initiative? It must have no roadmap items.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/initiatives/${id}`, "DELETE");
      push("Initiative deleted.");
      if (editRow?.id === id) setEditRow(null);
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  function legacySponsorHint(i: InitiativeRow) {
    if (i.sponsor) return null;
    if (i.businessSponsor?.trim()) {
      return (
        <p className="mt-1 text-xs leading-snug text-slate-500">Legacy label: {i.businessSponsor}</p>
      );
    }
    return null;
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search initiative/project, objectives, roadmaps, sponsor, themes, initiative notes…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="initiatives-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => {
              const wid =
                initialWorkspaceId && workspaces.some((w) => w.id === initialWorkspaceId)
                  ? initialWorkspaceId
                  : "";
              setWorkspaceId(wid);
              setCreateOpen(true);
            }}
          >
            New initiative
          </button>
        }
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Roadmaps
          </span>
          <MultiSelectDropdown
            options={roadmapSelectOptions}
            value={roadmapFilterIds}
            onChange={setRoadmapFilterIds}
            placeholder="All roadmaps"
            emptyText="No roadmaps in scope."
            searchable
            searchPlaceholder="Search roadmaps…"
          />
        </label>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Business sponsor
          </span>
          <MultiSelectDropdown
            options={sponsorSelectOptions}
            value={sponsorFilterIds}
            onChange={setSponsorFilterIds}
            placeholder="All business sponsors"
            emptyText="No sponsor options."
            searchable
            searchPlaceholder="Search sponsors…"
          />
        </label>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Themes
          </span>
          <MultiSelectDropdown
            options={themeSelectOptions}
            value={themeFilterIds}
            onChange={setThemeFilterIds}
            placeholder="All themes"
            emptyText="No themes in this workspace."
            searchable
            searchPlaceholder="Search themes…"
          />
        </label>
        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Type
          </span>
          <MultiSelectDropdown
            options={typeFilterOptions}
            value={typeFilterValues}
            onChange={setTypeFilterValues}
            placeholder="All types"
            emptyText="No types."
            searchable
            searchPlaceholder="Search types…"
          />
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Showing {filteredRows.length} initiative{filteredRows.length === 1 ? "" : "s"}
        {rows.length !== filteredRows.length ? ` (of ${rows.length})` : ""}. Column headers sort this view only
        (not saved to the server). Use Edit to update type, sponsor, themes, objectives, initiative notes, and Jira
        key.
      </p>

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New initiative"
        subtitle="Pick a workspace or leave unset for the server default. Type, sponsor, themes, and objectives are set here."
        maxWidthClass="max-w-5xl"
        maxHeightClass="max-h-[min(92vh,52rem)]"
      >
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Initiative</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative/Project</span>
              <input
                className={modalFieldClass}
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Type</span>
                <select
                  className={modalFieldClass}
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                >
                  {createTypeOptions.map((opt) => (
                    <option key={opt || "__empty"} value={opt}>
                      {opt || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Sponsor</span>
                <select
                  className={modalFieldClass}
                  value={createSponsorId}
                  onChange={(e) => setCreateSponsorId(e.target.value)}
                >
                  <option value="">—</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Themes</span>
                <MultiSelectDropdown
                  options={themes.map((t) => ({ value: t.id, label: t.name }))}
                  value={createThemeIds}
                  onChange={setCreateThemeIds}
                  disabled={busy}
                  placeholder="Choose themes…"
                  emptyText="No themes in this workspace."
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Short objective</span>
              <textarea
                rows={2}
                className={modalFieldClass}
                value={shortObjective}
                onChange={(e) => setShortObjective(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Business objective</span>
              <textarea
                rows={3}
                className={modalFieldClass}
                value={createDetailed}
                onChange={(e) => setCreateDetailed(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative notes</span>
              <textarea
                rows={2}
                className={modalFieldClass}
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Jira key</span>
              <input className={modalFieldClass} value={createJira} onChange={(e) => setCreateJira(e.target.value)} />
            </label>
            <WorkspaceSelectField
              label="Workspace (optional)"
              value={workspaceId}
              onChange={setWorkspaceId}
              workspaces={workspaces}
              optional
              disabled={busy}
            />
          </fieldset>
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
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Creating…" : "Create initiative"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <FormModal
        open={editLoadBusy || editRow != null}
        onClose={closeEditModal}
        title="Edit initiative"
        subtitle={editLoadBusy && !editRow ? "Loading…" : editRow?.canonicalName}
        titleId="initiatives-list-edit-title"
        maxWidthClass="max-w-5xl"
        maxHeightClass="max-h-[min(92vh,52rem)]"
      >
        {editLoadBusy && !editRow ? (
          <p className="mt-6 text-sm text-slate-400">Loading initiative…</p>
        ) : (
        <form key={editRow?.id ?? "edit"} onSubmit={onEditSubmit} className="mt-4 space-y-4">
          <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Initiative</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative/Project</span>
              <input className={modalFieldClass} value={eName} onChange={(e) => setEName(e.target.value)} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Type</span>
                <select className={modalFieldClass} value={eType} onChange={(e) => setEType(e.target.value)}>
                  {typeOptions.map((opt) => (
                    <option key={opt || "__empty"} value={opt}>
                      {opt || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Sponsor</span>
                <select
                  className={modalFieldClass}
                  value={eSponsorId}
                  onChange={(e) => setESponsorId(e.target.value)}
                >
                  <option value="">—</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Themes</span>
                <MultiSelectDropdown
                  options={themes.map((t) => ({ value: t.id, label: t.name }))}
                  value={eThemeIds}
                  onChange={setEThemeIds}
                  disabled={editSaveBusy}
                  placeholder="Choose themes…"
                  emptyText="No themes in this workspace."
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Short objective</span>
              <textarea rows={2} className={modalFieldClass} value={eShort} onChange={(e) => setEShort(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Business objective</span>
              <textarea
                rows={3}
                className={modalFieldClass}
                value={eDetailed}
                onChange={(e) => setEDetailed(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative notes</span>
              <textarea rows={2} className={modalFieldClass} value={eNotes} onChange={(e) => setENotes(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Jira key</span>
              <input className={modalFieldClass} value={eJira} onChange={(e) => setEJira(e.target.value)} />
            </label>
          </fieldset>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={editSaveBusy}
              onClick={closeEditModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaveBusy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {editSaveBusy ? "Saving…" : "Save"}
            </button>
          </ModalActions>
        </form>
        )}
      </FormModal>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-inner">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "17%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-950 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              <SortableTh
                className={thCell}
                label="Initiative/Project"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className={thCell}
                label="Short objective"
                sortKey="objective"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className={thCell}
                label="Business sponsor"
                sortKey="sponsor"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className={thCell}
                label="Strategic themes"
                sortKey="themes"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className={thCell}
                label="Initiative notes"
                sortKey="notes"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <th className={`${thCell} text-right normal-case`} aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {filteredRows.map((i) => (
              <tr key={i.id} className="border-b border-slate-800/90 odd:bg-slate-900/25">
                <td className={`${tdCell} font-medium text-slate-100`}>
                  <Link
                    href={`/initiatives/${i.id}`}
                    className="line-clamp-4 break-words text-indigo-300 hover:text-indigo-200"
                  >
                    {i.canonicalName}
                  </Link>
                </td>
                <td className={`${tdCell} text-slate-300`}>
                  <span className="line-clamp-6 break-words text-sm leading-relaxed">
                    {i.shortObjective?.trim() || "—"}
                  </span>
                </td>
                <td className={tdCell}>
                  <span className="line-clamp-4 break-words text-sm">
                    {i.sponsor?.displayName?.trim() || "—"}
                  </span>
                  {legacySponsorHint(i)}
                </td>
                <td className={`${tdCell} text-slate-300`}>
                  <span className="line-clamp-6 break-words text-sm leading-relaxed">
                    {(i.themes ?? []).length === 0
                      ? "—"
                      : (i.themes ?? []).map((t) => t.strategicTheme.name).join(", ")}
                  </span>
                </td>
                <td className={`${tdCell} text-slate-400`}>
                  <span className="line-clamp-6 break-words text-sm leading-relaxed whitespace-pre-wrap">
                    {i.notes?.trim() || "—"}
                  </span>
                </td>
                <td className={`${tdCell} text-right`}>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                      onClick={() => void openEdit(i.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-rose-900/50 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/50"
                      onClick={() => onDelete(i.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-6 text-slate-400" colSpan={6}>
                  {rows.length === 0
                    ? "No initiatives yet. Use New initiative or start api-gateway + portfolio-service."
                    : "No initiatives match your search or filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
