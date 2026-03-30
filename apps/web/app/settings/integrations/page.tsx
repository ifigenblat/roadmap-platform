import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { IntegrationsClient } from "./integrations-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const [res, workspacesRes] = await Promise.all([
    loadJson<any[]>("/api/integrations"),
    loadJson<WorkspaceRow[]>("/api/workspaces"),
  ]);
  return (
    <>
      {!res.ok && <ApiWarning message={res.message} />}
      {!workspacesRes.ok && <ApiWarning message={workspacesRes.message} />}
      <IntegrationsClient
        initial={res.ok ? res.data : []}
        workspaces={workspacesRes.ok ? workspacesRes.data : []}
      />
    </>
  );
}
