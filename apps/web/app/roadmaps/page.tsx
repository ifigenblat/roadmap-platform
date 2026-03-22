import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { RoadmapsClient } from "./roadmaps-client";

type Workspace = { id: string; name: string; slug: string };

export default async function Page() {
  const [roadmapsRes, workspacesRes] = await Promise.all([
    loadJson<any[]>("/api/roadmaps"),
    loadJson<Workspace[]>("/api/workspaces"),
  ]);
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Roadmaps</h1>
      <p className="mb-4 text-sm text-slate-400 max-w-2xl">
        Create and manage roadmaps here — no spreadsheet required. Pick a workspace when creating a roadmap; otherwise the default workspace is used.
      </p>
      {!roadmapsRes.ok && <ApiWarning message={roadmapsRes.message} />}
      <RoadmapsClient
        initial={roadmapsRes.ok ? roadmapsRes.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
      />
    </AppLayout>
  );
}
