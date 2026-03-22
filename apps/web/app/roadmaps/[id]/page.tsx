import Link from "next/link";
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
    themes?: Array<{ strategicTheme: { id: string; name: string } }>;
  };
  phases: Array<{
    id: string;
    phaseName: string;
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

type TeamRow = { id: string; name: string; workspaceId: string };
type ThemeRow = { id: string; name: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [roadmapRes, itemsRes, teamsRes, themesRes] = await Promise.all([
    loadJson<RoadmapDetails>(`/api/roadmaps/${id}`),
    loadJson<GridRoadmapItem[]>(`/api/roadmaps/${id}/items`),
    loadJson<TeamRow[]>(`/api/teams`),
    loadJson<ThemeRow[]>(`/api/roadmaps/${id}/themes`),
  ]);

  const warning = !roadmapRes.ok
    ? roadmapRes.message
    : !itemsRes.ok
      ? itemsRes.message
      : !teamsRes.ok
        ? teamsRes.message
        : !themesRes.ok
          ? themesRes.message
          : "";

  const workspaceId = roadmapRes.ok ? roadmapRes.data.workspaceId : "";
  const workspaceTeams =
    roadmapRes.ok && teamsRes.ok
      ? teamsRes.data.filter((t) => t.workspaceId === workspaceId)
      : [];

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {roadmapRes.ok ? roadmapRes.data.name : "Roadmap grid"}
          </h1>
          <p className="text-sm text-slate-400">
            Phase-level planning view aligned to spreadsheet columns. All columns are editable; lists use
            dropdowns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/roadmaps/${id}/timeline`}
            className="rounded-md border border-cyan-800/60 bg-cyan-950/25 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-950/45"
          >
            Timeline
          </Link>
          <Link
            href={`/roadmaps/${id}/executive`}
            className="rounded-md border border-indigo-700/60 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-950/50"
          >
            Executive summary
          </Link>
          <Link href="/roadmaps" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Back to roadmaps
          </Link>
        </div>
      </div>
      {!!warning && <ApiWarning message={warning} />}
      <RoadmapGridClient
        roadmapId={id}
        roadmapName={roadmapRes.ok ? roadmapRes.data.name : "Roadmap"}
        initial={itemsRes.ok ? itemsRes.data : []}
        workspaceTeams={workspaceTeams}
        roadmapThemes={themesRes.ok ? themesRes.data : []}
      />
    </AppLayout>
  );
}
