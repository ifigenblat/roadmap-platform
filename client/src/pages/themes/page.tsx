import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import type { ThemeRow } from "./themes-client";
import { ThemesClient } from "./themes-client";

type Workspace = { id: string; name: string; slug: string };
type RoadmapList = { id: string; name: string; planningYear: number; workspaceId: string };

export default function ThemesPage() {
  const [searchParams] = useSearchParams();
  const sp = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const rawWorkspace = typeof sp.workspace === "string" ? sp.workspace.trim() : "";

  const [state, setState] = useState<{
    workspaceId: string;
    workspaces: Workspace[];
    themes: ThemeRow[];
    themesOk: boolean;
    themesMsg: string;
    roadmaps: RoadmapList[];
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
      const [res, roadmapsRes] = await Promise.all([
        loadJson<unknown[]>(`/api/themes${wsQ}`),
        loadJson<RoadmapList[]>(`/api/roadmaps${wsQ}`),
      ]);
      if (cancelled) return;
      setState({
        workspaceId,
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
        themes: res.ok ? (res.data as ThemeRow[]) : [],
        themesOk: res.ok,
        themesMsg: res.ok ? "" : res.message,
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
        <p className="text-sm text-slate-400">Loading themes…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Strategic Themes</h1>
      {!state.themesOk && <ApiWarning message={state.themesMsg} />}
      {!state.roadmapsOk && <ApiWarning message={state.roadmapsMsg} />}
      <ThemesClient
        key={state.workspaceId || "__all__"}
        initial={state.themes}
        roadmaps={state.roadmaps}
        workspaces={state.workspaces}
        initialWorkspaceId={state.workspaceId}
      />
    </AppLayout>
  );
}
