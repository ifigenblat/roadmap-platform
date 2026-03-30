import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiWarning } from "../../../../components/api-warning";
import { AppLayout } from "../../../../components/layout";
import { loadJson } from "../../../../lib/api";
import { type TimelineItem, TimelineClient } from "./timeline-client";

type RoadmapDetails = {
  id: string;
  name: string;
  status: string;
  planningYear: number;
  workspaceId: string;
  startDate: string;
  endDate: string;
};

type PhaseDefRow = { id: string; name: string };

export default function RoadmapTimelinePage() {
  const { id = "" } = useParams<{ id: string }>();
  const [model, setModel] = useState<{
    warning: string;
    roadmap: RoadmapDetails | null;
    items: TimelineItem[];
    itemsOk: boolean;
    workspacePhases: PhaseDefRow[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [roadmapRes, itemsRes] = await Promise.all([
        loadJson<RoadmapDetails>(`/api/roadmaps/${id}`),
        loadJson<TimelineItem[]>(`/api/roadmaps/${id}/items`),
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
          : !phasesRes.ok
            ? phasesRes.message
            : "";

      setModel({
        warning,
        roadmap: roadmapRes.ok ? roadmapRes.data : null,
        items: itemsRes.ok ? itemsRes.data : [],
        itemsOk: itemsRes.ok,
        workspacePhases: phasesRes.ok ? phasesRes.data : [],
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
        <p className="text-sm text-slate-400">Loading timeline…</p>
      </AppLayout>
    );
  }

  const roadmap = model.roadmap;
  const items = model.items;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {roadmap ? roadmap.name : "Roadmap timeline"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Horizontal timeline by phase (or item dates). Switch quarter vs month columns; group by theme or team.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/roadmaps/${id}`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Grid view
          </Link>
          <Link
            to={`/roadmaps/${id}/executive`}
            className="rounded-md border border-indigo-700/60 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-950/50"
          >
            Executive summary
          </Link>
          <Link to="/roadmaps" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            All roadmaps
          </Link>
        </div>
      </div>

      {!!model.warning && <ApiWarning message={model.warning} />}
      {roadmap && model.itemsOk ? (
        <TimelineClient
          roadmapId={id}
          roadmapName={roadmap.name}
          roadmapStart={roadmap.startDate}
          roadmapEnd={roadmap.endDate}
          items={items}
          workspacePhases={model.workspacePhases}
        />
      ) : roadmap && !model.itemsOk ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Timeline needs roadmap items from the API. Fix the error above (usually start{" "}
          <strong className="font-medium">api-gateway</strong> on port 4010 so{" "}
          <code className="text-amber-100/90">/api/roadmaps/{id}/items</code> succeeds).
        </p>
      ) : null}
    </AppLayout>
  );
}
