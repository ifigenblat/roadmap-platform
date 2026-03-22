import { ApiWarning } from "../components/api-warning";
import { AppLayout } from "../components/layout";
import { loadJson } from "../lib/api";
import { ExecutiveDashboardClient } from "./executive-dashboard-client";

type Roadmap = { status: "draft" | "active" | "archived" };
type RoadmapItemRow = { status: string };

export default async function HomePage() {
  const [roadmapsRes, initiativesRes, themesRes, teamsRes, sponsorsRes, itemsRes] =
    await Promise.all([
      loadJson<Roadmap[]>("/api/roadmaps"),
      loadJson<unknown[]>("/api/initiatives"),
      loadJson<unknown[]>("/api/themes"),
      loadJson<unknown[]>("/api/teams"),
      loadJson<unknown[]>("/api/business-sponsors"),
      loadJson<RoadmapItemRow[]>("/api/roadmap-items"),
    ]);

  const totalRoadmaps = roadmapsRes.ok ? roadmapsRes.data.length : 0;
  const activeRoadmaps = roadmapsRes.ok
    ? roadmapsRes.data.filter((r) => r.status === "active").length
    : 0;
  const initiatives = initiativesRes.ok ? initiativesRes.data.length : 0;
  const themes = themesRes.ok ? themesRes.data.length : 0;
  const teams = teamsRes.ok ? teamsRes.data.length : 0;
  const sponsors = sponsorsRes.ok ? sponsorsRes.data.length : 0;
  const roadmapItems = itemsRes.ok ? itemsRes.data.length : 0;

  const itemStatus: Record<string, number> = {};
  if (itemsRes.ok) {
    for (const item of itemsRes.data) {
      const k = item.status;
      itemStatus[k] = (itemStatus[k] ?? 0) + 1;
    }
  }

  const warning = !roadmapsRes.ok
    ? roadmapsRes.message
    : !initiativesRes.ok
      ? initiativesRes.message
      : !themesRes.ok
        ? themesRes.message
        : !teamsRes.ok
          ? teamsRes.message
          : !sponsorsRes.ok
            ? sponsorsRes.message
            : !itemsRes.ok
              ? itemsRes.message
              : "";

  return (
    <AppLayout>
      {!!warning && <ApiWarning message={warning} />}
      <ExecutiveDashboardClient
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
      />
    </AppLayout>
  );
}
