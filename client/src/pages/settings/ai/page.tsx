import { useEffect, useState } from "react";
import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { AiSettingsClient } from "./ai-settings-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default function AiSettingsPage() {
  const [state, setState] = useState<{
    workspaces: WorkspaceRow[];
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadJson<WorkspaceRow[]>("/api/workspaces");
      if (cancelled) return;
      setState({
        workspaces: res.ok ? res.data : [],
        ok: res.ok,
        message: res.ok ? "" : res.message,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  return (
    <>
      {!state.ok && <ApiWarning message={state.message} />}
      <AiSettingsClient workspaces={state.workspaces} />
    </>
  );
}
