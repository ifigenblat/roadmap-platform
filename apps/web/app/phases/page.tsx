import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { workspaceOptionLabel } from "../../lib/workspace-display";
import { PhasesClient, type PhaseRow } from "./phases-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page() {
  const workspacesRes = await loadJson<WorkspaceRow[]>("/api/workspaces");
  const workspace =
    workspacesRes.ok && workspacesRes.data.length > 0
      ? workspacesRes.data.find((w) => w.slug === "default") ?? workspacesRes.data[0]
      : null;

  const phasesRes = workspace
    ? await loadJson<PhaseRow[]>(
        `/api/phase-definitions?workspaceId=${encodeURIComponent(workspace.id)}`
      )
    : { ok: true as const, data: [] as PhaseRow[] };

  const warning = !workspacesRes.ok
    ? workspacesRes.message
    : !phasesRes.ok
      ? phasesRes.message
      : "";

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Phases</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        Workspace-wide phase names (Discovery, Build, Launch, …) used as dropdown options when editing
        phase rows on any roadmap in that workspace. Imports and workbook uploads auto-create missing
        names.
      </p>
      {!workspacesRes.ok && <ApiWarning message={workspacesRes.message} />}
      {workspacesRes.ok && !workspace && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          No workspaces found. Create a workspace first.
        </p>
      )}
      {!!warning && workspace && <ApiWarning message={warning} />}
      {workspace && (
        <PhasesClient
          initial={phasesRes.ok ? phasesRes.data : []}
          workspaceId={workspace.id}
          workspaceLabel={workspaceOptionLabel(workspace)}
        />
      )}
    </AppLayout>
  );
}
