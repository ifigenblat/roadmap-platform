import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiWarning } from "../../../components/api-warning";
import { AppLayout } from "../../../components/layout";
import { loadJson } from "../../../lib/api";
import { RoadmapGridClient } from "./roadmap-grid-client";

type RoadmapDetails = {
  id: string;
  name: string;
  status: string;
  planningYear: number;
  workspaceId: string;
};

export type GridRoadmapItem = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  initiative: {
    id: string;
    canonicalName: string;
    type?: string | null;
    shortObjective?: string | null;
    detailedObjective?: string | null;
    notes?: string | null;
    sourceSystem?: string | null;
    sourceReference?: string | null;
    themes?: Array<{ strategicTheme: { id: string; name: string; colorToken?: string | null } }>;
  };
  phases: Array<{
    id: string;
    phaseName: string;
    phaseDefinitionId?: string | null;
    phaseDefinition?: { id: string; name: string } | null;
    capacityAllocationEstimate?: number | null;
    sprintEstimate?: number | null;
    startDate: string;
    endDate: string;
    status?: string | null;
    jiraKey?: string | null;
    notes?: string | null;
  }>;
  teams: Array<{ team: { id: string; name: string } }>;
};

type TeamRow = { id: string; name: string };
type ThemeRow = { id: string; name: string; colorToken?: string | null };
type PhaseDefRow = { id: string; name: string };

export default function RoadmapDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [model, setModel] = useState<{
    warning: string;
    roadmap: RoadmapDetails | null;
    items: GridRoadmapItem[];
    workspaceTeams: TeamRow[];
    workspacePhases: PhaseDefRow[];
    roadmapThemes: ThemeRow[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [roadmapRes, itemsRes, teamsRes, themesRes] = await Promise.all([
        loadJson<RoadmapDetails>(`/api/roadmaps/${id}`),
        loadJson<GridRoadmapItem[]>(`/api/roadmaps/${id}/items`),
        loadJson<TeamRow[]>(`/api/teams`),
        loadJson<ThemeRow[]>(`/api/roadmaps/${id}/themes`),
      ]);

      const workspaceId = roadmapRes.ok ? roadmapRes.data.workspaceId : "";
      const phasesRes = roadmapRes.ok
        ? await loadJson<PhaseDefRow[]>(
            `/api/phase-definitions?workspaceId=${encodeURIComponent(workspaceId)}`
          )
        : { ok: true as const, data: [] as PhaseDefRow[] };

      if (cancelled) return;

      const warning = !roadmapRes.ok
        ? roadmapRes.message
        : !itemsRes.ok
          ? itemsRes.message
          : !teamsRes.ok
            ? teamsRes.message
            : !themesRes.ok
              ? themesRes.message
              : !phasesRes.ok
                ? phasesRes.message
                : "";

      const workspaceTeams = roadmapRes.ok && teamsRes.ok ? teamsRes.data : [];
      const workspacePhases = phasesRes.ok ? phasesRes.data : [];

      setModel({
        warning,
        roadmap: roadmapRes.ok ? roadmapRes.data : null,
        items: itemsRes.ok ? itemsRes.data : [],
        workspaceTeams,
        workspacePhases,
        roadmapThemes: themesRes.ok ? themesRes.data : [],
      });
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
        <p className="text-sm text-slate-400">Loading roadmap…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{model.roadmap?.name ?? "Roadmap grid"}</h1>
          <p className="text-sm text-slate-400">
            Phase-level planning view aligned to spreadsheet columns. All columns are editable; lists use dropdowns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/roadmaps/${id}/timeline`}
            className="rounded-md border border-cyan-800/60 bg-cyan-950/25 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-950/45"
          >
            Timeline
          </Link>
          <Link
            to={`/roadmaps/${id}/executive`}
            className="rounded-md border border-indigo-700/60 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-950/50"
          >
            Executive summary
          </Link>
          <Link to="/roadmaps" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Back to roadmaps
          </Link>
        </div>
      </div>
      {!!model.warning && <ApiWarning message={model.warning} />}
      <RoadmapGridClient
        roadmapId={id}
        roadmapName={model.roadmap?.name ?? "Roadmap"}
        initial={model.items}
        workspaceTeams={model.workspaceTeams}
        workspacePhases={model.workspacePhases}
        roadmapThemes={model.roadmapThemes}
      />
    </AppLayout>
  );
}
