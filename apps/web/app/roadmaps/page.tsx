import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { RoadmapsClient } from "./roadmaps-client";

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

  const roadmapsRes = await loadJson<any[]>(`/api/roadmaps${wsQ}`);

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Roadmaps</h1>
      <p className="mb-4 text-sm text-slate-400 max-w-2xl">
        Create and manage roadmaps here — no spreadsheet required. New roadmaps pick a workspace from your list (the
        URL filter is pre-selected when you use the workspace switcher); if no workspaces exist yet, the server assigns
        the default workspace on create.
      </p>
      {!roadmapsRes.ok && <ApiWarning message={roadmapsRes.message} />}
      <RoadmapsClient
        key={workspaceId || "__all__"}
        initial={roadmapsRes.ok ? roadmapsRes.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
        initialWorkspaceId={workspaceId}
      />
    </AppLayout>
  );
}
