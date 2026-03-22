import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { SponsorsClient } from "./sponsors-client";

export default async function Page() {
  const res = await loadJson<
    {
      id: string;
      displayName: string;
      email?: string | null;
      title?: string | null;
      department?: string | null;
      notes?: string | null;
    }[]
  >("/api/business-sponsors");
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Business sponsors</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      <SponsorsClient initial={res.ok ? res.data : []} />
    </AppLayout>
  );
}
