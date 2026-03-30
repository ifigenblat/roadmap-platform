import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiWarning } from "../../../../components/api-warning";
import { AppLayout } from "../../../../components/layout";
import { loadJson } from "../../../../lib/api";
import { ExecutiveClient } from "./executive-client";

type ExecApi = {
  roadmap: { id: string; name: string; planningYear: number; status: string };
  generatedAt: string;
  themes: Array<{
    strategicTheme: {
      id: string;
      name: string;
      objective: string | null;
      orderIndex: number;
      colorToken?: string | null;
    };
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

export default function RoadmapExecutivePage() {
  const { id = "" } = useParams<{ id: string }>();
  const [model, setModel] = useState<{ warning: string; data: ExecApi | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await loadJson<ExecApi>(`/api/roadmaps/${id}/executive-summary`);
      if (cancelled) return;
      const warning = !res.ok ? res.message : "";
      setModel({ warning, data: res.ok ? res.data : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Missing roadmap id.</p>
      </AppLayout>
    );
  }

  if (!model) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading executive summary…</p>
      </AppLayout>
    );
  }

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
            to={`/roadmaps/${id}`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Roadmap grid
          </Link>
          <Link to="/roadmaps" className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            All roadmaps
          </Link>
        </div>
      </div>

      {!!model.warning && <ApiWarning message={model.warning} />}
      {model.data && <ExecutiveClient initial={model.data} />}
    </AppLayout>
  );
}
