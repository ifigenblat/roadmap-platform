import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { SponsorsClient } from "./sponsors-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const [res, workspacesRes] = await Promise.all([
    loadJson<
    {
      id: string;
      displayName: string;
      email?: string | null;
      title?: string | null;
      department?: string | null;
      notes?: string | null;
    }[]
    >("/api/business-sponsors"),
    loadJson<WorkspaceRow[]>("/api/workspaces"),
  ]);
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Business sponsors</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      {!workspacesRes.ok && <ApiWarning message={workspacesRes.message} />}
      <SponsorsClient
        initial={res.ok ? res.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
      />
    </AppLayout>
  );
}
