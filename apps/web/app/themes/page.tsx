import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { ThemesClient } from "./themes-client";

type Workspace = { id: string; name: string; slug: string };
type RoadmapList = { id: string; name: string; planningYear: number; workspaceId: string };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const rawWorkspace = typeof sp.workspace === "string" ? sp.workspace.trim() : "";

  const workspacesRes = await loadJson<Workspace[]>("/api/workspaces");
  const workspaceSet = new Set(workspacesRes.ok ? workspacesRes.data.map((w) => w.id) : []);
  const workspaceId = rawWorkspace && workspaceSet.has(rawWorkspace) ? rawWorkspace : "";
  const wsQ = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";

  const [res, roadmapsRes] = await Promise.all([
    loadJson<unknown[]>(`/api/themes${wsQ}`),
    loadJson<RoadmapList[]>(`/api/roadmaps${wsQ}`),
  ]);
  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Strategic Themes</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      {!roadmapsRes.ok && <ApiWarning message={roadmapsRes.message} />}
      <ThemesClient
        key={workspaceId || "__all__"}
        initial={res.ok ? (res.data as import("./themes-client").ThemeRow[]) : []}
        roadmaps={roadmapsRes.ok ? roadmapsRes.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
        initialWorkspaceId={workspaceId}
      />
    </AppLayout>
  );
}
