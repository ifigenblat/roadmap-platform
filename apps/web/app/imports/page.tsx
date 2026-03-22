import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { ImportsClient } from "./imports-client";

type ImportBatchRow = {
  id: string;
  sourceFileName: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  roadmapId?: string | null;
  roadmap?: { id: string; name: string; status: string } | null;
  _count?: { rowResults: number };
  summaryJson?: Record<string, unknown> | null;
};

export default async function Page() {
  const res = await loadJson<ImportBatchRow[]>("/api/imports");
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Imports</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      <ImportsClient initial={res.ok ? res.data : []} />
    </AppLayout>
  );
}
