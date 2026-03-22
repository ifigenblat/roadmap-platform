import { ApiWarning } from "../../../components/api-warning";
import { loadJson } from "../../../lib/api";
import { IntegrationsClient } from "./integrations-client";

export default async function Page() {
  const res = await loadJson<any[]>("/api/integrations");
  return (
    <>
      {!res.ok && <ApiWarning message={res.message} />}
      <IntegrationsClient initial={res.ok ? res.data : []} />
    </>
  );
}
