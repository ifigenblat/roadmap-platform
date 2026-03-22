import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { TemplatesClient } from "./templates-client";

export default async function Page() {
  const res = await loadJson<any[]>("/api/templates");
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Templates</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      <TemplatesClient initial={res.ok ? res.data : []} />
    </AppLayout>
  );
}
