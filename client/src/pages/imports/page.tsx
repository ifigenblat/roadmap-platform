import { useEffect, useState } from "react";
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

export default function ImportsPage() {
  const [model, setModel] = useState<{
    warning: string;
    imports: ImportBatchRow[];
    roadmaps: RoadmapOption[];
    workspaces: WorkspaceRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [importsRes, roadmapsRes, workspacesRes] = await Promise.all([
        loadJson<ImportBatchRow[]>("/api/imports"),
        loadJson<RoadmapOption[]>("/api/roadmaps"),
        loadJson<WorkspaceRow[]>("/api/workspaces"),
      ]);
      if (cancelled) return;
      const warning = !importsRes.ok
        ? importsRes.message
        : !roadmapsRes.ok
          ? roadmapsRes.message
          : !workspacesRes.ok
            ? workspacesRes.message
            : "";
      setModel({
        warning,
        imports: importsRes.ok ? importsRes.data : [],
        roadmaps: roadmapsRes.ok ? roadmapsRes.data : [],
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!model) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading imports…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Imports</h1>
      {!!model.warning && <ApiWarning message={model.warning} />}
      <ImportsClient initial={model.imports} roadmaps={model.roadmaps} workspaces={model.workspaces} />
    </AppLayout>
  );
}
