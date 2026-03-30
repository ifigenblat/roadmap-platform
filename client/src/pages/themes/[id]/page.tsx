import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiWarning } from "../../../components/api-warning";
import { AppLayout } from "../../../components/layout";
import { loadJson } from "../../../lib/api";
import { themeDetailObjectiveSectionClass } from "../../../lib/strategic-theme-color";

type ThemeDetail = {
  id: string;
  name: string;
  objective?: string | null;
  orderIndex?: number;
  colorToken?: string | null;
  roadmapId?: string | null;
  roadmap?: { id: string; name: string; planningYear: number } | null;
  initiatives?: Array<{
    initiative: {
      id: string;
      canonicalName: string;
      shortObjective?: string | null;
      detailedObjective?: string | null;
    };
  }>;
};

export default function ThemeDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [model, setModel] = useState<{ warning: string; theme: ThemeDetail | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await loadJson<ThemeDetail>(`/api/themes/${id}`);
      if (cancelled) return;
      const warning = !res.ok ? res.message : "";
      const t = res.ok ? res.data : null;
      setModel({ warning, theme: t });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Missing theme id.</p>
      </AppLayout>
    );
  }

  if (!model) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading theme…</p>
      </AppLayout>
    );
  }

  const t = model.theme;
  const links = t?.initiatives ?? [];
  const sorted = [...links].sort((a, b) =>
    a.initiative.canonicalName.localeCompare(b.initiative.canonicalName)
  );

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t?.name ?? "Strategic theme"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pillar narrative and linked initiatives. Edit the theme on the themes list.
          </p>
        </div>
        <Link
          to="/themes"
          className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Back to themes
        </Link>
      </div>

      {!!model.warning && <ApiWarning message={model.warning} />}

      {t && (
        <div className="space-y-8">
          <section className={themeDetailObjectiveSectionClass(t.colorToken ?? null)}>
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Pillar objective</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-200">
              {t.objective?.trim() || "—"}
            </p>
            {t.roadmap ? (
              <p className="mt-4 text-sm text-slate-500">
                Scoped to roadmap{" "}
                <Link to={`/roadmaps/${t.roadmap.id}`} className="text-indigo-300 hover:text-indigo-200">
                  {t.roadmap.name}
                </Link>{" "}
                ({t.roadmap.planningYear})
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Workspace-global theme (not tied to a single roadmap).</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Linked initiatives</h2>
            <ul className="mt-4 divide-y divide-slate-800">
              {sorted.length === 0 && <li className="py-2 text-slate-500">No initiatives linked yet.</li>}
              {sorted.map((row) => (
                <li key={row.initiative.id} className="py-4 first:pt-0">
                  <Link
                    to={`/initiatives/${row.initiative.id}`}
                    className="font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    {row.initiative.canonicalName}
                  </Link>
                  {row.initiative.shortObjective?.trim() ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-slate-400">
                      {row.initiative.shortObjective}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppLayout>
  );
}
