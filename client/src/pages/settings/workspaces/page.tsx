import { useEffect, useState } from "react";
import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { WorkspacesClient } from "./workspaces-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default function WorkspacesSettingsPage() {
  const [state, setState] = useState<{ ok: boolean; message: string; rows: WorkspaceRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadJson<WorkspaceRow[]>("/api/workspaces");
      if (cancelled) return;
      setState({
        ok: res.ok,
        message: res.ok ? "" : res.message,
        rows: res.ok ? res.data : [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return <p className="text-sm text-slate-400">Loading workspaces…</p>;
  }

  return (
    <>
      {!state.ok && <ApiWarning message={state.message} />}
      <WorkspacesClient initial={state.rows} />
    </>
  );
}
