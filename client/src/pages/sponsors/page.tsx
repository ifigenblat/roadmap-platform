import { useEffect, useState } from "react";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { SponsorsClient } from "./sponsors-client";

type WorkspaceRow = { id: string; name: string; slug: string };
type SponsorRow = {
  id: string;
  displayName: string;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  notes?: string | null;
};

export default function SponsorsPage() {
  const [state, setState] = useState<{
    sponsors: SponsorRow[];
    sponsorsOk: boolean;
    sponsorsMsg: string;
    workspaces: WorkspaceRow[];
    workspacesOk: boolean;
    workspacesMsg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, workspacesRes] = await Promise.all([
        loadJson<SponsorRow[]>("/api/business-sponsors"),
        loadJson<WorkspaceRow[]>("/api/workspaces"),
      ]);
      if (cancelled) return;
      setState({
        sponsors: res.ok ? res.data : [],
        sponsorsOk: res.ok,
        sponsorsMsg: res.ok ? "" : res.message,
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
        <p className="text-sm text-slate-400">Loading sponsors…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Business sponsors</h1>
      {!state.sponsorsOk && <ApiWarning message={state.sponsorsMsg} />}
      {!state.workspacesOk && <ApiWarning message={state.workspacesMsg} />}
      <SponsorsClient initial={state.sponsors} workspaces={state.workspaces} />
    </AppLayout>
  );
}
