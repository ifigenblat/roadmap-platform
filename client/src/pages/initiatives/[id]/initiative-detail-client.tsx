import { Link } from "react-router-dom";
import { JiraGridCell } from "../../../components/jira-grid-cell";
import { useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../../components/form-modal";
import { MultiSelectDropdown } from "../../../components/multi-select-dropdown";
import { sendJson } from "../../../lib/api";
import { ToastViewport, useToasts } from "../../../lib/toast";
import { INITIATIVE_TYPE_OPTIONS, mergeOptionList } from "../../../lib/grid-dropdowns";

export type InitiativePhaseRow = {
  id: string;
  phaseName: string;
  status?: string | null;
  phaseDefinition?: { id: string; name: string } | null;
};

export type InitiativeDetailModel = {
  id: string;
  workspaceId: string;
  canonicalName: string;
  shortObjective?: string | null;
  detailedObjective?: string | null;
  notes?: string | null;
  type?: string | null;
  sourceReference?: string | null;
  sourceSystem?: string | null;
  businessSponsorId?: string | null;
  sponsor?: { id: string; displayName: string; title?: string | null } | null;
  themes?: Array<{
    strategicTheme: {
      id: string;
      name: string;
      objective?: string | null;
      colorToken?: string | null;
    };
  }>;
  roadmapItems?: Array<{
    id: string;
    status: string;
    roadmap: { id: string; name: string; planningYear: number };
    phases: InitiativePhaseRow[];
  }>;
};

type ThemeOption = { id: string; name: string };
type SponsorOption = { id: string; displayName: string };

/** Read-only page panels: no edit affordances on the body. */
const sectionPanel = "rounded-2xl border border-slate-800 bg-slate-900 p-6";

function phaseLabel(p: InitiativePhaseRow): string {
  return p.phaseDefinition?.name ?? p.phaseName;
}

export function InitiativeDetailClient({
  initial,
  themeOptions,
  sponsorOptions,
  workspaceLabel,
}: {
  initial: InitiativeDetailModel;
  themeOptions: ThemeOption[];
  sponsorOptions: SponsorOption[];
  workspaceLabel: string;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const [initiativeName, setInitiativeName] = useState("");
  const [type, setType] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [shortObjective, setShortObjective] = useState("");
  const [businessObjective, setBusinessObjective] = useState("");
  const [initiativeNotes, setInitiativeNotes] = useState("");
  const [jira, setJira] = useState("");

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useLayoutEffect(() => {
    if (!editOpen) return;
    setInitiativeName(data.canonicalName ?? "");
    setType(data.type ?? "");
    setSponsorId(data.businessSponsorId ?? data.sponsor?.id ?? "");
    setThemeIds((data.themes ?? []).map((t) => t.strategicTheme.id));
    setShortObjective(data.shortObjective ?? "");
    setBusinessObjective(data.detailedObjective ?? "");
    setInitiativeNotes(data.notes ?? "");
    setJira(data.sourceReference ?? "");
  }, [editOpen, data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendJson(`/api/initiatives/${data.id}`, "PATCH", {
        canonicalName: initiativeName.trim(),
        shortObjective: shortObjective.trim() || null,
        detailedObjective: businessObjective.trim() || null,
        notes: initiativeNotes.trim() || null,
        type: type.trim() || null,
        businessSponsorId: sponsorId.trim() ? sponsorId.trim() : null,
        sourceReference: jira.trim() || null,
        sourceSystem: jira.trim() ? "jira" : null,
      });
      await sendJson(`/api/initiatives/${data.id}/theme-links`, "PUT", {
        strategicThemeIds: themeIds,
      });
      push("Initiative saved.");
      setEditOpen(false);
      window.location.reload();
    } catch (err) {
      push(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = mergeOptionList(INITIATIVE_TYPE_OPTIONS, type);

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{data.canonicalName}</h1>
          {data.type?.trim() ? (
            <p className="mt-1 text-sm text-slate-500">{data.type.trim()}</p>
          ) : null}
          {data.sourceReference?.trim() ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
              <span className="text-slate-500">Jira</span>
              <JiraGridCell value={data.sourceReference} />
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-400">
            Workspace: <span className="text-slate-200">{workspaceLabel}</span>. Editing is only in the popup. Roadmap
            placement and teams are managed on each roadmap grid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setEditOpen(true)}
          >
            Edit initiative
          </button>
          <Link
            to="/initiatives"
            className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Back to initiatives
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        <section className={sectionPanel}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Short objective</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-200">
            {data.shortObjective?.trim() || "—"}
          </p>
        </section>

        <section className={sectionPanel}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Detailed objective</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-300 leading-relaxed">
            {data.detailedObjective?.trim() || "—"}
          </p>
        </section>

        <section className={sectionPanel}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Pillar / theme linkage</h2>
          {(data.themes ?? []).length === 0 ? (
            <p className="mt-3 text-slate-500">No strategic themes linked yet.</p>
          ) : (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-200">
              {(data.themes ?? []).map((lt) => (
                <li key={lt.strategicTheme.id}>
                  <Link to={`/themes/${lt.strategicTheme.id}`} className="text-indigo-300 hover:text-indigo-200">
                    {lt.strategicTheme.name}
                  </Link>
                  {lt.strategicTheme.objective?.trim() ? (
                    <span className="mt-1 block text-sm text-slate-400 whitespace-pre-wrap">
                      {lt.strategicTheme.objective}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-slate-300">{data.notes?.trim() || "—"}</p>
        </section>

        <section className={sectionPanel}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Roadmaps & phase health</h2>
          <p className="mt-2 text-sm text-slate-500">
            Open a roadmap and use the grid to edit teams, dates, and phase rows for this initiative.
          </p>
          {(data.roadmapItems ?? []).length === 0 ? (
            <p className="mt-3 text-slate-500">Not placed on any roadmap yet.</p>
          ) : (
            <ul className="mt-4 space-y-4 text-slate-200">
              {(data.roadmapItems ?? []).map((ri) => (
                <li key={ri.id} className="border-b border-slate-800/80 pb-4 last:border-b-0 last:pb-0">
                  <div>
                    <Link to={`/roadmaps/${ri.roadmap.id}`} className="text-indigo-300 hover:text-indigo-200">
                      {ri.roadmap.name}
                    </Link>
                    <span className="text-slate-500"> · {ri.roadmap.planningYear}</span>
                    <span className="text-slate-500"> · item status: {ri.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {ri.phases.length === 0
                      ? "No phase segments."
                      : `${ri.phases.length} phase(s): ${ri.phases.map((p) => phaseLabel(p)).join(", ")}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={sectionPanel}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Sponsor</h2>
          {data.sponsor ? (
            <>
              <p className="mt-2 text-slate-200">{data.sponsor.displayName}</p>
              {data.sponsor.title ? <p className="text-sm text-slate-500">{data.sponsor.title}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-slate-500">No business sponsor assigned.</p>
          )}
        </section>
      </div>

      <FormModal
        open={editOpen}
        onClose={() => !busy && setEditOpen(false)}
        title="Edit initiative"
        subtitle={data.canonicalName}
        titleId="initiative-detail-edit-title"
        maxWidthClass="max-w-5xl"
        maxHeightClass="max-h-[min(92vh,52rem)]"
      >
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <fieldset className="space-y-3 rounded-lg border border-slate-800 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Initiative</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative/Project</span>
              <input
                className={modalFieldClass}
                value={initiativeName}
                onChange={(e) => setInitiativeName(e.target.value)}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Type</span>
                <select
                  className={modalFieldClass}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
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
                  value={sponsorId}
                  onChange={(e) => setSponsorId(e.target.value)}
                >
                  <option value="">—</option>
                  {sponsorOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-slate-400">Themes</span>
                <MultiSelectDropdown
                  options={themeOptions.map((t) => ({ value: t.id, label: t.name }))}
                  value={themeIds}
                  onChange={setThemeIds}
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
                value={businessObjective}
                onChange={(e) => setBusinessObjective(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Initiative notes</span>
              <textarea
                rows={2}
                className={modalFieldClass}
                value={initiativeNotes}
                onChange={(e) => setInitiativeNotes(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Jira key</span>
              <input className={modalFieldClass} value={jira} onChange={(e) => setJira(e.target.value)} />
              {jira.trim() ? (
                <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Hover for live Jira details
                  </span>
                  <div className="mt-1">
                    <JiraGridCell value={jira} />
                  </div>
                </div>
              ) : null}
            </label>
          </fieldset>

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
              type="submit"
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </ModalActions>
        </form>
      </FormModal>
    </>
  );
}
