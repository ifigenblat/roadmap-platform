import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { TemplatesClient } from "./templates-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const [res, workspacesRes] = await Promise.all([
    loadJson<any[]>("/api/templates"),
    loadJson<WorkspaceRow[]>("/api/workspaces"),
  ]);
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Templates</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      {!workspacesRes.ok && <ApiWarning message={workspacesRes.message} />}
      <TemplatesClient
        initial={res.ok ? res.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
      />
    </AppLayout>
  );
}
