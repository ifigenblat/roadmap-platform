import { useEffect, useState } from "react";
import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { IntegrationsClient } from "./integrations-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default function IntegrationsSettingsPage() {
  const [state, setState] = useState<{
    integrations: any[];
    intOk: boolean;
    intMsg: string;
    workspaces: WorkspaceRow[];
    wsOk: boolean;
    wsMsg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, workspacesRes] = await Promise.all([
        loadJson<any[]>("/api/integrations"),
        loadJson<WorkspaceRow[]>("/api/workspaces"),
      ]);
      if (cancelled) return;
      setState({
        integrations: res.ok ? res.data : [],
        intOk: res.ok,
        intMsg: res.ok ? "" : res.message,
        workspaces: workspacesRes.ok ? workspacesRes.data : [],
        wsOk: workspacesRes.ok,
        wsMsg: workspacesRes.ok ? "" : workspacesRes.message,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return <p className="text-sm text-slate-400">Loading integrations…</p>;
  }

  return (
    <>
      {!state.intOk && <ApiWarning message={state.intMsg} />}
      {!state.wsOk && <ApiWarning message={state.wsMsg} />}
      <IntegrationsClient initial={state.integrations} workspaces={state.workspaces} />
    </>
  );
}
