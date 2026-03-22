import Link from "next/link";
import { ApiWarning } from "../../../../components/api-warning";
import { AppLayout } from "../../../../components/layout";
import { loadJson } from "../../../../lib/api";
import { ExecutiveClient } from "./executive-client";

type ExecApi = {
  roadmap: { id: string; name: string; planningYear: number; status: string };
  generatedAt: string;
  themes: Array<{
    strategicTheme: { id: string; name: string; objective: string | null; orderIndex: number };
    initiatives: Array<{
      initiativeId: string;
      canonicalName: string;
      shortObjective: string | null;
      detailedObjective: string | null;
      phaseHealth: { totalPhases: number; byStatus: Record<string, number> };
    }>;
  }>;
  ungroupedInitiatives: Array<{
    initiativeId: string;
    canonicalName: string;
    shortObjective: string | null;
    detailedObjective: string | null;
    phaseHealth: { totalPhases: number; byStatus: Record<string, number> };
  }>;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadJson<ExecApi>(`/api/roadmaps/${id}/executive-summary`);
  const warning = !res.ok ? res.message : "";

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Executive summary</h1>
          <p className="mt-1 text-sm text-slate-400">
            Theme-grouped initiatives with phase health for decks. Export JSON or generate an AI narrative.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/roadmaps/${id}`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Roadmap grid
          </Link>
          <Link
            href="/roadmaps"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            All roadmaps
          </Link>
        </div>
      </div>

      {!!warning && <ApiWarning message={warning} />}
      {res.ok && <ExecutiveClient initial={res.data} />}
    </AppLayout>
  );
}
