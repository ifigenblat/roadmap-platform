import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { WorkspacesClient } from "./workspaces-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const res = await loadJson<WorkspaceRow[]>("/api/workspaces");
  return (
    <>
      {!res.ok && <ApiWarning message={res.message} />}
      <WorkspacesClient initial={res.ok ? res.data : []} />
    </>
  );
}
