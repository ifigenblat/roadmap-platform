"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../components/form-modal";
import { PageToolbar } from "../../components/page-toolbar";
import { sendJson } from "../../lib/api";
import { ToastViewport, useToasts } from "../../lib/toast";

type ThemeLink = { strategicTheme: { id: string; name: string } };

type InitiativeRow = {
  id: string;
  canonicalName: string;
  shortObjective?: string | null;
  businessSponsor?: string | null;
  businessSponsorId?: string | null;
  notes?: string | null;
  sponsor?: { id: string; displayName: string } | null;
  themes?: ThemeLink[];
};

type ThemeOption = { id: string; name: string };
type SponsorOption = { id: string; displayName: string };

const thCell = "border-b border-slate-800 px-3 py-2.5 text-left align-bottom text-xs font-medium uppercase tracking-wide text-slate-500";
const tdCell = "align-top px-3 py-2.5 text-sm";
const control =
  "box-border w-full min-w-0 max-w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100";

export function InitiativesClient({
  initial,
  themes,
  sponsors,
}: {
  initial: InitiativeRow[];
  themes: ThemeOption[];
  sponsors: SponsorOption[];
}) {
  const [rows, setRows] = useState(initial);
  const [canonicalName, setCanonicalName] = useState("");
  const [shortObjective, setShortObjective] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const themes = (r.themes ?? []).map((t) => t.strategicTheme.name).join(" ");
      const blob = [
        r.canonicalName,
        r.shortObjective,
        r.sponsor?.displayName,
        r.businessSponsor,
        themes,
        r.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchQuery]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await sendJson<InitiativeRow>("/api/initiatives", "POST", {
        canonicalName,
        shortObjective: shortObjective || undefined,
        workspaceId: workspaceId || undefined,
      });
      setRows((prev) => [created, ...prev]);
      setCanonicalName("");
      setShortObjective("");
      setCreateOpen(false);
      push("Initiative created.");
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
      const updated = await sendJson<InitiativeRow>(`/api/initiatives/${id}`, "PATCH", {
        notes: notes || null,
      });
      setRows((p) => p.map((r) => (r.id === id ? { ...r, notes: updated.notes } : r)));
      push("Initiative updated.");
    } catch (err) {
      setRows(prev);
      push(`Update failed: ${String(err)}`, "error");
    }
  }

  async function onPatchSponsor(id: string, businessSponsorId: string | null) {
    const prev = rows;
    setRows((curr) =>
      curr.map((r) =>
        r.id === id
          ? {
              ...r,
              businessSponsorId,
              sponsor: businessSponsorId
                ? sponsors.find((s) => s.id === businessSponsorId) ?? null
                : null,
            }
          : r
      )
    );
    try {
      const updated = await sendJson<InitiativeRow>(`/api/initiatives/${id}`, "PATCH", {
        businessSponsorId,
      });
      setRows((p) =>
        p.map((r) =>
          r.id === id
            ? {
                ...r,
                sponsor: updated.sponsor ?? null,
                businessSponsorId: updated.businessSponsorId,
              }
            : r
        )
      );
      push("Sponsor updated.");
    } catch (err) {
      setRows(prev);
      push(`Sponsor update failed: ${String(err)}`, "error");
    }
  }

  async function onLinkTheme(initiativeId: string, strategicThemeId: string) {
    if (!strategicThemeId) return;
    try {
      await sendJson(`/api/initiatives/${initiativeId}/themes`, "POST", { strategicThemeId });
      const t = themes.find((x) => x.id === strategicThemeId);
      setRows((curr) =>
        curr.map((r) =>
          r.id === initiativeId
            ? {
                ...r,
                themes: [
                  ...(r.themes ?? []),
                  { strategicTheme: { id: strategicThemeId, name: t?.name ?? strategicThemeId } },
                ],
              }
            : r
        )
      );
      push("Theme linked.");
    } catch (err) {
      push(`Link theme failed: ${String(err)}`, "error");
    }
  }

  async function onUnlinkTheme(initiativeId: string, themeId: string) {
    try {
      await sendJson(`/api/initiatives/${initiativeId}/themes/${themeId}`, "DELETE");
      setRows((curr) =>
        curr.map((r) =>
          r.id === initiativeId
            ? {
                ...r,
                themes: (r.themes ?? []).filter((x) => x.strategicTheme.id !== themeId),
              }
            : r
        )
      );
      push("Theme unlinked.");
    } catch (err) {
      push(`Unlink failed: ${String(err)}`, "error");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this initiative? It must have no roadmap items.")) return;
    const prev = rows;
    setRows((curr) => curr.filter((r) => r.id !== id));
    try {
      await sendJson(`/api/initiatives/${id}`, "DELETE");
      push("Initiative deleted.");
    } catch (err) {
      setRows(prev);
      push(`Delete failed: ${String(err)}`, "error");
    }
  }

  function legacySponsorHint(i: InitiativeRow) {
    if (i.sponsor) return null;
    if (i.businessSponsor?.trim()) {
      return (
        <p className="mt-1.5 text-xs leading-snug text-slate-500">
          Legacy label: {i.businessSponsor}
        </p>
      );
    }
    return null;
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <PageToolbar
        searchPlaceholder="Search initiatives, themes, sponsors, notes…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchId="initiatives-search"
        actions={
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreateOpen(true)}
          >
            New initiative
          </button>
        }
      />

      <FormModal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="New initiative"
        subtitle="Creates an initiative in the portfolio workspace."
      >
        <form
          onSubmit={onCreate}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-1">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Canonical name</span>
              <input
                className={modalFieldClass}
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Short objective (optional)</span>
              <input
                className={modalFieldClass}
                value={shortObjective}
                onChange={(e) => setShortObjective(e.target.value)}
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
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Creating…" : "Create initiative"}
            </button>
          </ModalActions>
        </form>
      </FormModal>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-inner">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-950 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              <th className={thCell}>Canonical name</th>
              <th className={thCell}>Objective</th>
              <th className={thCell}>Sponsor</th>
              <th className={thCell}>Themes</th>
              <th className={thCell}>Notes</th>
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
                    {i.shortObjective || "—"}
                  </span>
                </td>
                <td className={tdCell}>
                  <select
                    className={`${control} h-9`}
                    value={i.businessSponsorId ?? ""}
                    onChange={(e) => onPatchSponsor(i.id, e.target.value ? e.target.value : null)}
                  >
                    <option value="">None</option>
                    {sponsors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                  {legacySponsorHint(i)}
                </td>
                <td className={tdCell}>
                  <div className="flex min-h-[2rem] flex-wrap gap-1.5">
                    {(i.themes ?? []).map((lt) => (
                      <span
                        key={lt.strategicTheme.id}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200"
                      >
                        <Link
                          href={`/themes/${lt.strategicTheme.id}`}
                          className="truncate text-indigo-300 hover:text-indigo-200"
                        >
                          {lt.strategicTheme.name}
                        </Link>
                        <button
                          type="button"
                          className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                          onClick={() => onUnlinkTheme(i.id, lt.strategicTheme.id)}
                          aria-label={`Unlink ${lt.strategicTheme.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <ThemeLinkSelect
                      themes={themes}
                      linkedIds={new Set((i.themes ?? []).map((x) => x.strategicTheme.id))}
                      onLink={(tid) => onLinkTheme(i.id, tid)}
                    />
                  </div>
                </td>
                <td className={tdCell}>
                  <PatchNotesCell value={i.notes || ""} onSave={(v) => onPatchNotes(i.id, v)} />
                </td>
                <td className={`${tdCell} text-right`}>
                  <button
                    type="button"
                    className="inline-flex rounded-md border border-rose-900/50 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/50"
                    onClick={() => onDelete(i.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-6 text-slate-400" colSpan={6}>
                  {rows.length === 0
                    ? "No initiatives yet. Use New initiative or start api-gateway + portfolio-service."
                    : "No initiatives match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ThemeLinkSelect({
  themes,
  linkedIds,
  onLink,
}: {
  themes: ThemeOption[];
  linkedIds: Set<string>;
  onLink: (themeId: string) => void;
}) {
  const [value, setValue] = useState("");
  const available = themes.filter((t) => !linkedIds.has(t.id));
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <select
        className={`${control} h-9 flex-1 text-xs sm:min-w-0`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">Link a theme…</option>
        {available.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!value}
        className="h-9 shrink-0 rounded-md border border-slate-600 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => {
          onLink(value);
          setValue("");
        }}
      >
        Link
      </button>
    </div>
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

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={`${control} min-h-[4.5rem] max-h-40 resize-y text-xs leading-relaxed`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Notes"
        rows={3}
      />
      <button
        type="button"
        disabled={busy}
        className="self-start rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          await onSave(draft);
          setBusy(false);
        }}
      >
        Save notes
      </button>
    </div>
  );
}
