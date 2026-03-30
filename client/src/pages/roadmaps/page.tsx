import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { RoadmapsClient } from "./roadmaps-client";

type Workspace = { id: string; name: string; slug: string };

export default function RoadmapsPage() {
  const [searchParams] = useSearchParams();
  const sp = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const rawWorkspace = typeof sp.workspace === "string" ? sp.workspace.trim() : "";

  const [state, setState] = useState<{
    workspaceId: string;
    workspaces: Workspace[];
    roadmaps: any[];
    roadmapsOk: boolean;
    roadmapsMsg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const workspacesRes = await loadJson<Workspace[]>("/api/workspaces");
      const workspaceSet = new Set(workspacesRes.ok ? workspacesRes.data.map((w) => w.id) : []);
      const workspaceId = rawWorkspace && workspaceSet.has(rawWorkspace) ? rawWorkspace : "";
      const wsQ = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      const roadmapsRes = await loadJson<any[]>(`/api/roadmaps${wsQ}`);
      if (cancelled) return;
      setState({
        workspaceId,
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
        roadmaps: roadmapsRes.ok ? roadmapsRes.data : [],
        roadmapsOk: roadmapsRes.ok,
        roadmapsMsg: roadmapsRes.ok ? "" : roadmapsRes.message,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rawWorkspace]);

  if (!state) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading roadmaps…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Roadmaps</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        Create and manage roadmaps here — no spreadsheet required. New roadmaps pick a workspace from your list (the URL
        filter is pre-selected when you use the workspace switcher); if no workspaces exist yet, the server assigns the
        default workspace on create.
      </p>
      {!state.roadmapsOk && <ApiWarning message={state.roadmapsMsg} />}
      <RoadmapsClient
        key={state.workspaceId || "__all__"}
        initial={state.roadmaps}
        workspaces={state.workspaces}
        initialWorkspaceId={state.workspaceId}
      />
    </AppLayout>
  );
}
