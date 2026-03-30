"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DatePickerField } from "../../components/date-picker-field";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";
import { WorkspaceSelectField } from "../../components/workspace-select-field";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
};

function slugify(s: string): string {
  const t = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.length > 0 ? t : "roadmap";
}

type CreatedRoadmap = { id: string; name?: string };

type WorkspaceOption = { id: string; name: string; slug: string };

export function TemplatesClient({
  initial,
  workspaces,
}: {
  initial: TemplateRow[];
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [configJsonText, setConfigJsonText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const [createFor, setCreateFor] = useState<TemplateRow | null>(null);
  const [crName, setCrName] = useState("");
  const [crSlug, setCrSlug] = useState("");
  const [crPlanningYear, setCrPlanningYear] = useState(() => new Date().getFullYear());
  const [crStart, setCrStart] = useState("");
  const [crEnd, setCrEnd] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => [t.name, t.description ?? ""].join(" ").toLowerCase().includes(q));
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let configJson: Record<string, unknown> = {};
    if (configJsonText.trim()) {
      try {
        const parsed = JSON.parse(configJsonText) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          push("configJson must be a JSON object (e.g. phases, view defaults).", "error");
          return;
        }
        configJson = parsed as Record<string, unknown>;
      } catch {
        push("configJson is not valid JSON.", "error");
        return;
      }
    }
    setBusy(true);
    try {
      const created = await sendJson<TemplateRow>("/api/templates", "POST", {
        name,
        description: description || undefined,
        configJson,
        workspaceId: workspaceId || undefined,
      });
      setRows((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setWorkspaceId("");
      setConfigJsonText("{}");
      setCreateTemplateOpen(false);
      push("Template created.");
    } catch (err) {
      push(`Create failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function openCreateFromTemplate(t: TemplateRow) {
    const y = new Date().getFullYear();
    setCreateFor(t);
    setCrName(`${t.name} roadmap`);
    setCrSlug(slugify(`${t.name}-roadmap`));
    setCrPlanningYear(y);
    setCrStart(`${y}-01-01`);
    setCrEnd(`${y}-12-31`);
  }

  async function onCreateRoadmap(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createFor) return;
    setCreateBusy(true);
    try {
      const roadmap = await sendJson<CreatedRoadmap>(
        `/api/templates/${createFor.id}/create-roadmap`,
        "POST",
        {
          name: crName.trim(),
          slug: crSlug.trim(),
          description: createFor.description ?? undefined,
          planningYear: crPlanningYear,
          startDate: crStart,
          endDate: crEnd,
          status: "draft",
        }
      );
      push("Roadmap created from template.");
      setCreateFor(null);
      router.push(`/roadmaps/${roadmap.id}`);
    } catch (err) {
      push(`Create roadmap failed: ${String(err)}`, "error");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search templates by name or description…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="templates-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreateTemplateOpen(true)}
          >
            New template
          </button>
        }
      />

      <FormModal
        open={createTemplateOpen}
        onClose={() => !busy && setCreateTemplateOpen(false)}
        title="New template"
        subtitle="Stored in template-service; optional JSON for future defaults."
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
              <span className="text-slate-400">Description (optional)</span>
              <input
                className={modalFieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <WorkspaceSelectField
                label="Workspace (optional)"
                value={workspaceId}
                onChange={setWorkspaceId}
                workspaces={workspaces}
                optional
                disabled={busy}
              />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            <span>Optional config JSON</span>
            <textarea
              rows={4}
              className={`${modalFieldClass} font-mono text-xs`}
              value={configJsonText}
              onChange={(e) => setConfigJsonText(e.target.value)}
              spellCheck={false}
            />
          </label>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setCreateTemplateOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Creating…" : "Create template"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <FormModal
        open={!!createFor}
        onClose={() => !createBusy && setCreateFor(null)}
        title="Create roadmap from template"
        subtitle={
          createFor ? (
            <>
              Template <span className="text-slate-200">{createFor.name}</span> ·{" "}
              <code className="text-xs text-slate-500">POST /api/templates/:id/create-roadmap</code>
            </>
          ) : null
        }
      >
        <form onSubmit={onCreateRoadmap} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Roadmap name</span>
              <input className={modalFieldClass} value={crName} onChange={(e) => setCrName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Slug (URL key)</span>
              <input className={modalFieldClass} value={crSlug} onChange={(e) => setCrSlug(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Planning year</span>
              <input
                type="number"
                className={modalFieldClass}
                value={crPlanningYear}
                onChange={(e) => setCrPlanningYear(Number(e.target.value))}
                required
              />
            </label>
            <DatePickerField
              label="Start date"
              value={crStart}
              onChange={setCrStart}
              disabled={createBusy}
              required
            />
            <DatePickerField
              label="End date"
              value={crEnd}
              onChange={setCrEnd}
              disabled={createBusy}
              required
            />
          </div>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={createBusy}
              onClick={() => setCreateFor(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBusy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {createBusy ? "Creating…" : "Create roadmap"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/70 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th>Description</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id} className="border-t border-slate-800">
                <td className="p-4">{t.name}</td>
                <td>{t.description || "—"}</td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-indigo-600/50 bg-indigo-950/30 px-3 py-1.5 text-sm text-indigo-200 hover:bg-indigo-950/50"
                    onClick={() => openCreateFromTemplate(t)}
                  >
                    Create roadmap…
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={3}>
                  {rows.length === 0
                    ? "No templates yet. Start api-gateway + template-service and create one."
                    : "No templates match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        After creation you land on the new roadmap’s{" "}
        <Link href="/roadmaps" className="text-indigo-400 hover:text-indigo-300">
          grid
        </Link>
        . Template <code className="text-xs">configJson</code> is stored for future expansion (phases,
        presets).
      </p>
    </>
  );
}
