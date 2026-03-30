import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiWarning } from "../../../components/api-warning";
import { AppLayout } from "../../../components/layout";
import { loadJson } from "../../../lib/api";
import { workspaceLabelById } from "../../../lib/workspace-display";
import { InitiativeDetailClient, type InitiativeDetailModel } from "./initiative-detail-client";

type ThemeOption = { id: string; name: string };
type SponsorOption = { id: string; displayName: string };
type WorkspaceRow = { id: string; name: string; slug: string };

export default function InitiativeDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [model, setModel] = useState<{
    warning: string;
    themesWarn: string;
    sponsorsWarn: string;
    detail: InitiativeDetailModel | null;
    themeOptions: ThemeOption[];
    sponsorOptions: SponsorOption[];
    workspaces: WorkspaceRow[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await loadJson<InitiativeDetailModel>(`/api/initiatives/${id}`);
      if (cancelled) return;
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
        if (cancelled) return;
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

      setModel({
        warning,
        themesWarn,
        sponsorsWarn,
        detail: res.ok ? res.data : null,
        themeOptions,
        sponsorOptions,
        workspaces,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Missing initiative id.</p>
      </AppLayout>
    );
  }

  if (!model) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading initiative…</p>
      </AppLayout>
    );
  }

  const workspaceLabel = model.detail
    ? workspaceLabelById(model.detail.workspaceId, model.workspaces)
    : "";

  return (
    <AppLayout>
      {!!model.warning && <ApiWarning message={model.warning} />}
      {!!model.themesWarn && <ApiWarning message={`Themes: ${model.themesWarn}`} />}
      {!!model.sponsorsWarn && <ApiWarning message={`Sponsors: ${model.sponsorsWarn}`} />}

      {model.detail ? (
        <InitiativeDetailClient
          initial={model.detail}
          themeOptions={model.themeOptions}
          sponsorOptions={model.sponsorOptions}
          workspaceLabel={workspaceLabel}
        />
      ) : (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100">Initiative</h1>
          <Link
            to="/initiatives"
            className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Back to initiatives
          </Link>
        </div>
      )}
    </AppLayout>
  );
}
