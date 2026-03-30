import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { ImportsClient } from "./imports-client";

type ImportBatchRow = {
  id: string;
  sourceFileName: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  roadmapId?: string | null;
  roadmap?: { id: string; name: string; status: string } | null;
  _count?: { rowResults: number };
  summaryJson?: Record<string, unknown> | null;
};

type RoadmapOption = { id: string; name: string };
type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const [importsRes, roadmapsRes, workspacesRes] = await Promise.all([
    loadJson<ImportBatchRow[]>("/api/imports"),
    loadJson<RoadmapOption[]>("/api/roadmaps"),
    loadJson<WorkspaceRow[]>("/api/workspaces"),
  ]);

  const warning = !importsRes.ok
    ? importsRes.message
    : !roadmapsRes.ok
      ? roadmapsRes.message
      : !workspacesRes.ok
        ? workspacesRes.message
        : "";

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Imports</h1>
      {!!warning && <ApiWarning message={warning} />}
      <ImportsClient
        initial={importsRes.ok ? importsRes.data : []}
        roadmaps={roadmapsRes.ok ? roadmapsRes.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
      />
    </AppLayout>
  );
}
