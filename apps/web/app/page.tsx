import { ApiWarning } from "../components/api-warning";
import { AppLayout } from "../components/layout";
import { loadJson } from "../lib/api";
import {
  formatDashboardPeriodCaption,
  getRoadmapItemFilterRange,
  normalizeDashboardPeriod,
  roadmapItemOverlapsRange,
} from "../lib/dashboard-period";
import { ExecutiveDashboardClient } from "./executive-dashboard-client";

type Workspace = { id: string; name: string; slug: string };
type Roadmap = { id: string; status: string; workspaceId?: string | null };
type RoadmapItemRow = {
  id: string;
  roadmapId: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const rawWorkspace = typeof sp.workspace === "string" ? sp.workspace.trim() : "";
  const rawPeriod = typeof sp.period === "string" ? sp.period : undefined;
  const periodFrom = typeof sp.periodFrom === "string" ? sp.periodFrom : undefined;
  const periodTo = typeof sp.periodTo === "string" ? sp.periodTo : undefined;

  const period = normalizeDashboardPeriod(rawPeriod);
  const now = new Date();
  const filterRange = getRoadmapItemFilterRange(period, now, periodFrom, periodTo);
  const periodCaption = formatDashboardPeriodCaption(period, filterRange);

  const workspacesRes = await loadJson<Workspace[]>("/api/workspaces");
  const workspaceSet = new Set(workspacesRes.ok ? workspacesRes.data.map((w) => w.id) : []);
  const workspaceId =
    rawWorkspace && workspaceSet.has(rawWorkspace) ? rawWorkspace : "";
  const wsQ = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";

  const [roadmapsRes, itemsRes, initiativesRes, themesRes, teamsRes, sponsorsRes] =
    await Promise.all([
      loadJson<Roadmap[]>(`/api/roadmaps${wsQ}`),
      loadJson<RoadmapItemRow[]>("/api/roadmap-items"),
      loadJson<unknown[]>(`/api/initiatives${wsQ}`),
      loadJson<unknown[]>(`/api/themes${wsQ}`),
      loadJson<unknown[]>("/api/teams"),
      loadJson<unknown[]>(`/api/business-sponsors${wsQ}`),
    ]);

  const roadmaps = roadmapsRes.ok ? roadmapsRes.data : [];
  const roadmapById = new Map(roadmaps.map((r) => [r.id, r]));

  const itemsAll = itemsRes.ok ? itemsRes.data : [];
  const itemsInScope = workspaceId
    ? itemsAll.filter((item) => roadmapById.get(item.roadmapId)?.workspaceId === workspaceId)
    : itemsAll;

  const filteredRoadmapItems =
    !filterRange
      ? []
      : itemsInScope.filter((item) => {
          const start = item.startDate ? new Date(item.startDate) : null;
          const end = item.endDate ? new Date(item.endDate) : null;
          if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return false;
          }
          return roadmapItemOverlapsRange(start, end, filterRange);
        });

  const totalRoadmaps = roadmaps.length;
  const activeRoadmaps = roadmaps.filter((r) => r.status === "active").length;
  const initiatives = initiativesRes.ok ? initiativesRes.data.length : 0;
  const themes = themesRes.ok ? themesRes.data.length : 0;
  const teams = teamsRes.ok ? teamsRes.data.length : 0;
  const sponsors = sponsorsRes.ok ? sponsorsRes.data.length : 0;
  const roadmapItems = filteredRoadmapItems.length;

  const itemStatus: Record<string, number> = {};
  for (const item of filteredRoadmapItems) {
    const k = item.status;
    itemStatus[k] = (itemStatus[k] ?? 0) + 1;
  }

  const warning = !workspacesRes.ok
    ? workspacesRes.message
    : !roadmapsRes.ok
      ? roadmapsRes.message
      : !itemsRes.ok
        ? itemsRes.message
        : !initiativesRes.ok
          ? initiativesRes.message
          : !themesRes.ok
            ? themesRes.message
            : !teamsRes.ok
              ? teamsRes.message
              : !sponsorsRes.ok
                ? sponsorsRes.message
                : workspacesRes.data.length === 0
                  ? "No workspaces returned from /api/workspaces — check API_BASE_URL and auth."
                  : "";

  return (
    <AppLayout>
      {!!warning && <ApiWarning message={warning} />}
      <ExecutiveDashboardClient
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
        stats={{
          activeRoadmaps,
          totalRoadmaps,
          initiatives,
          themes,
          teams,
          sponsors,
          roadmapItems,
          itemStatus,
        }}
        initialWorkspaceId={workspaceId}
        initialPeriod={period}
        initialPeriodFrom={periodFrom ?? ""}
        initialPeriodTo={periodTo ?? ""}
        periodCaption={periodCaption}
      />
    </AppLayout>
  );
}
