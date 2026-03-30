import { useEffect, useState } from "react";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { workspaceOptionLabel } from "../../lib/workspace-display";
import { PhasesClient, type PhaseRow } from "./phases-client";

type WorkspaceRow = { id: string; name: string; slug: string };

export default function PhasesPage() {
  const [model, setModel] = useState<{
    workspacesOk: boolean;
    workspacesMsg: string;
    workspace: WorkspaceRow | null;
    phases: PhaseRow[];
    phasesOk: boolean;
    phasesMsg: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

      if (cancelled) return;

      const warning = !workspacesRes.ok
        ? workspacesRes.message
        : !phasesRes.ok
          ? phasesRes.message
          : "";

      setModel({
        workspacesOk: workspacesRes.ok,
        workspacesMsg: workspacesRes.ok ? "" : workspacesRes.message,
        workspace,
        phases: phasesRes.ok ? phasesRes.data : [],
        phasesOk: phasesRes.ok,
        phasesMsg: warning,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!model) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading phases…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Phases</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        Workspace-wide phase names (Discovery, Build, Launch, …) used as dropdown options when editing phase rows on any
        roadmap in that workspace. Imports and workbook uploads auto-create missing names.
      </p>
      {!model.workspacesOk && <ApiWarning message={model.workspacesMsg} />}
      {model.workspacesOk && !model.workspace && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          No workspaces found. Create a workspace first.
        </p>
      )}
      {!!model.phasesMsg && model.workspace && <ApiWarning message={model.phasesMsg} />}
      {model.workspace && (
        <PhasesClient
          initial={model.phases}
          workspaceId={model.workspace.id}
          workspaceLabel={workspaceOptionLabel(model.workspace)}
        />
      )}
    </AppLayout>
  );
}
