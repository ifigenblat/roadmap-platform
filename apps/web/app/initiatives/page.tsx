import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { InitiativesClient } from "./initiatives-client";

type Workspace = { id: string; name: string; slug: string };

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
  const [initiatives, themes, sponsors, roadmapsRes] = await Promise.all([
    loadJson<any[]>(`/api/initiatives${wsQ}`),
    loadJson<{ id: string; name: string }[]>(`/api/themes${wsQ}`),
    loadJson<{ id: string; displayName: string }[]>(`/api/business-sponsors${wsQ}`),
    loadJson<{ id: string; name: string; planningYear: number }[]>(`/api/roadmaps${wsQ}`),
  ]);
  const apiOk = initiatives.ok && themes.ok && sponsors.ok && roadmapsRes.ok;
  const warn =
    !initiatives.ok
      ? initiatives.message
      : !themes.ok
        ? themes.message
        : !sponsors.ok
          ? sponsors.message
          : !roadmapsRes.ok
            ? roadmapsRes.message
            : "";

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Initiatives</h1>
      {!apiOk && <ApiWarning message={warn} />}
      <InitiativesClient
        key={workspaceId || "__all__"}
        initial={initiatives.ok ? initiatives.data : []}
        themes={themes.ok ? themes.data : []}
        sponsors={sponsors.ok ? sponsors.data : []}
        roadmaps={roadmapsRes.ok ? roadmapsRes.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
        initialWorkspaceId={workspaceId}
      />
    </AppLayout>
  );
}
