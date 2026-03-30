import Link from "next/link";
import { ApiWarning } from "../../../components/api-warning";
import { AppLayout } from "../../../components/layout";
import { loadJson } from "../../../lib/api";
import { workspaceLabelById } from "../../../lib/workspace-display";
import { InitiativeDetailClient, type InitiativeDetailModel } from "./initiative-detail-client";

type ThemeOption = { id: string; name: string };
type SponsorOption = { id: string; displayName: string };
type WorkspaceRow = { id: string; name: string; slug: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadJson<InitiativeDetailModel>(`/api/initiatives/${id}`);
  const warning = !res.ok ? res.message : "";

  let themesWarn = "";
  let sponsorsWarn = "";
  let themeOptions: ThemeOption[] = [];
  let sponsorOptions: SponsorOption[] = [];
  let workspaces: WorkspaceRow[] = [];

  if (res.ok) {
    const ws = encodeURIComponent(res.data.workspaceId);
    const [themesRes, sponsorsRes, workspacesRes] = await Promise.all([
      loadJson<ThemeOption[]>(`/api/themes?workspaceId=${ws}`),
      loadJson<SponsorOption[]>(`/api/business-sponsors?workspaceId=${ws}`),
      loadJson<WorkspaceRow[]>("/api/workspaces"),
    ]);
    if (themesRes.ok) {
      themeOptions = themesRes.data;
    } else {
      themesWarn = themesRes.message;
    }
    if (sponsorsRes.ok) {
      sponsorOptions = sponsorsRes.data;
    } else {
      sponsorsWarn = sponsorsRes.message;
    }
    if (workspacesRes.ok) workspaces = workspacesRes.data;
  }

  const workspaceLabel = res.ok ? workspaceLabelById(res.data.workspaceId, workspaces) : "";

  return (
    <AppLayout>
      {!!warning && <ApiWarning message={warning} />}
      {!!themesWarn && <ApiWarning message={`Themes: ${themesWarn}`} />}
      {!!sponsorsWarn && <ApiWarning message={`Sponsors: ${sponsorsWarn}`} />}

      {res.ok ? (
        <InitiativeDetailClient
          initial={res.data}
          themeOptions={themeOptions}
          sponsorOptions={sponsorOptions}
          workspaceLabel={workspaceLabel}
        />
      ) : (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100">Initiative</h1>
          <Link
            href="/initiatives"
            className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Back to initiatives
          </Link>
        </div>
      )}
    </AppLayout>
  );
}
