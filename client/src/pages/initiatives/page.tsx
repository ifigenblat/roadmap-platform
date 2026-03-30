import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { InitiativesClient } from "./initiatives-client";

type Workspace = { id: string; name: string; slug: string };

export default function InitiativesPage() {
  const [searchParams] = useSearchParams();
  const sp = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const rawWorkspace = typeof sp.workspace === "string" ? sp.workspace.trim() : "";

  const [state, setState] = useState<{
    workspaceId: string;
    workspaces: Workspace[];
    initiatives: any[];
    themes: { id: string; name: string }[];
    sponsors: { id: string; displayName: string }[];
    roadmaps: { id: string; name: string; planningYear: number }[];
    apiOk: boolean;
    warn: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      if (cancelled) return;
      const apiOk = initiatives.ok && themes.ok && sponsors.ok && roadmapsRes.ok;
      const warn = !initiatives.ok
        ? initiatives.message
        : !themes.ok
          ? themes.message
          : !sponsors.ok
            ? sponsors.message
            : !roadmapsRes.ok
              ? roadmapsRes.message
              : "";
      setState({
        workspaceId,
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
        initiatives: initiatives.ok ? initiatives.data : [],
        themes: themes.ok ? themes.data : [],
        sponsors: sponsors.ok ? sponsors.data : [],
        roadmaps: roadmapsRes.ok ? roadmapsRes.data : [],
        apiOk,
        warn,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rawWorkspace]);

  if (!state) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading initiatives…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Initiatives</h1>
      {!state.apiOk && <ApiWarning message={state.warn} />}
      <InitiativesClient
        key={state.workspaceId || "__all__"}
        initial={state.initiatives}
        themes={state.themes}
        sponsors={state.sponsors}
        roadmaps={state.roadmaps}
        workspaces={state.workspaces}
        initialWorkspaceId={state.workspaceId}
      />
    </AppLayout>
  );
}
