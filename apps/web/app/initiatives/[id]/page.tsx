import Link from "next/link";
import { ApiWarning } from "../../../components/api-warning";
import { AppLayout } from "../../../components/layout";
import { loadJson } from "../../../lib/api";

type InitiativeDetail = {
  id: string;
  canonicalName: string;
  shortObjective?: string | null;
  detailedObjective?: string | null;
  notes?: string | null;
  type?: string | null;
  sponsor?: { id: string; displayName: string; title?: string | null } | null;
  themes?: Array<{
    strategicTheme: {
      id: string;
      name: string;
      objective?: string | null;
    };
  }>;
  roadmapItems?: Array<{
    id: string;
    status: string;
    roadmap: { id: string; name: string; planningYear: number };
    phases: Array<{ id: string; phaseName: string; status?: string | null }>;
  }>;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadJson<InitiativeDetail>(`/api/initiatives/${id}`);
  const warning = !res.ok ? res.message : "";

  const data = res.ok ? res.data : null;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {data?.canonicalName ?? "Initiative"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Strategic narrative: objectives and pillar alignment. Edit fields on the initiatives list.
          </p>
        </div>
        <Link
          href="/initiatives"
          className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Back to initiatives
        </Link>
      </div>

      {!!warning && <ApiWarning message={warning} />}

      {data && (
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Short objective</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-200">
              {data.shortObjective?.trim() || "—"}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Detailed objective</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-300 leading-relaxed">
              {data.detailedObjective?.trim() || "—"}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Pillar / theme linkage</h2>
            <ul className="mt-3 space-y-4">
              {(data.themes ?? []).length === 0 && (
                <li className="text-slate-500">No strategic themes linked yet.</li>
              )}
              {(data.themes ?? []).map((lt) => (
                <li
                  key={lt.strategicTheme.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
                >
                  <Link
                    href={`/themes/${lt.strategicTheme.id}`}
                    className="font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    {lt.strategicTheme.name}
                  </Link>
                  {lt.strategicTheme.objective?.trim() ? (
                    <p className="mt-2 text-sm text-slate-400 whitespace-pre-wrap">
                      Pillar objective: {lt.strategicTheme.objective}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Roadmaps & phase health</h2>
            <ul className="mt-3 space-y-3">
              {(data.roadmapItems ?? []).length === 0 && (
                <li className="text-slate-500">Not placed on any roadmap yet.</li>
              )}
              {(data.roadmapItems ?? []).map((ri) => (
                <li
                  key={ri.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/roadmaps/${ri.roadmap.id}`}
                      className="font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      {ri.roadmap.name}
                    </Link>
                    <span className="text-slate-500"> · {ri.roadmap.planningYear}</span>
                    <span className="ml-2 rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                      item {ri.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">
                    {ri.phases.length === 0
                      ? "No phase segments"
                      : `${ri.phases.length} phase(s): ${ri.phases.map((p) => p.phaseName).join(", ")}`}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {data.sponsor && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Sponsor</h2>
              <p className="mt-2 text-slate-200">{data.sponsor.displayName}</p>
              {data.sponsor.title ? (
                <p className="text-sm text-slate-500">{data.sponsor.title}</p>
              ) : null}
            </section>
          )}
        </div>
      )}
    </AppLayout>
  );
}
