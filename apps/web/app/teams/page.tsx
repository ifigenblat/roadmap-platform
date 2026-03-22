import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { TeamsClient } from "./teams-client";

export default async function Page() {
  const res = await loadJson<
    { id: string; name: string; kind?: string | null; active: boolean }[]
  >("/api/teams");
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Teams</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      <TeamsClient initial={res.ok ? res.data : []} />
    </AppLayout>
  );
}
