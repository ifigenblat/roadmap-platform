import { useEffect, useState } from "react";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { TemplatesClient } from "./templates-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default function TemplatesPage() {
  const [state, setState] = useState<{
    templates: any[];
    templatesOk: boolean;
    templatesMsg: string;
    workspaces: WorkspaceRow[];
    workspacesOk: boolean;
    workspacesMsg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, workspacesRes] = await Promise.all([
        loadJson<any[]>("/api/templates"),
        loadJson<WorkspaceRow[]>("/api/workspaces"),
      ]);
      if (cancelled) return;
      setState({
        templates: res.ok ? res.data : [],
        templatesOk: res.ok,
        templatesMsg: res.ok ? "" : res.message,
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
        workspacesOk: workspacesRes.ok,
        workspacesMsg: workspacesRes.ok ? "" : workspacesRes.message,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading templates…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Templates</h1>
      {!state.templatesOk && <ApiWarning message={state.templatesMsg} />}
      {!state.workspacesOk && <ApiWarning message={state.workspacesMsg} />}
      <TemplatesClient initial={state.templates} workspaces={state.workspaces} />
    </AppLayout>
  );
}
