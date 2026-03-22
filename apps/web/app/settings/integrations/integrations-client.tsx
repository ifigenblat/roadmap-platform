"use client";

import { useMemo, useState } from "react";
import { FormModal, ModalActions, modalFieldClass } from "../../../components/form-modal";
import { PageToolbar } from "../../../components/page-toolbar";
import { sendJson } from "../../../lib/api";
import { ToastViewport, useToasts } from "../../../lib/toast";

type IntegrationRow = {
  id: string;
  connectionName: string;
  provider: string;
  status: string;
  lastSyncAt?: string | null;
};

export function IntegrationsClient({ initial }: { initial: IntegrationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [provider, setProvider] = useState<"jira" | "confluence">("jira");
  const [connectionName, setConnectionName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [configRaw, setConfigRaw] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.connectionName, r.provider, r.status, r.lastSyncAt ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  async function onConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const config = JSON.parse(configRaw || "{}");
      const created = await sendJson<IntegrationRow>(
        `/api/integrations/${provider}/connect`,
        "POST",
        { connectionName, config, workspaceId: workspaceId || undefined }
      );
      setRows((prev) => [created, ...prev]);
      setConnectionName("");
      setConnectOpen(false);
      push("Integration connection created.");
    } catch (err) {
      push(`Connect failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSync(id: string) {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, status: "syncing" } : r)));
    try {
      const updated = await sendJson<{ connectionId: string; lastSyncAt: string }>(
        `/api/integrations/${id}/sync`,
        "POST",
        {}
      );
      setRows((prev) =>
        prev.map((r) =>
          r.id === updated.connectionId
            ? { ...r, status: "synced", lastSyncAt: updated.lastSyncAt }
            : r
        )
      );
      push("Integration sync recorded.");
    } catch (err) {
      setRows(prev);
      push(`Sync failed: ${String(err)}`, "error");
    }
  }

  const countLabel =
    filteredRows.length === rows.length
      ? `${rows.length} connection${rows.length === 1 ? "" : "s"}`
      : `${filteredRows.length} of ${rows.length} connections`;

  return (
    <div className="grid gap-6">
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      {/* Row 1: title block | primary action (dashboard-style header) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-slate-100">Integrations</h2>
          <p className="mt-1 text-sm text-slate-400">
            Connect Jira or Confluence and trigger syncs. Requires api-gateway and integration-service.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setConnectOpen(true)}
        >
          New connection
        </button>
      </div>

      {/* Row 2: filters — search only inside a contained strip */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 [&>div]:mb-0">
        <PageToolbar
          searchPlaceholder="Search connections by name, provider, status…"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchId="integrations-search"
        />
      </div>

      {/* Row 3: result count / pagination hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>{countLabel}</span>
      </div>

      {/* Row 4: data grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="min-w-0" />
            <col className="w-[8rem]" />
            <col className="w-[7rem]" />
            <col className="w-[8rem]" />
            <col className="w-[6rem]" />
          </colgroup>
          <thead className="border-b border-slate-800 bg-slate-950/70 text-xs font-medium uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-4">Connection</th>
              <th className="p-4">Provider</th>
              <th className="p-4">Status</th>
              <th className="p-4">Last sync</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {filteredRows.map((i) => (
              <tr key={i.id} className="border-t border-slate-800">
                <td className="p-4 font-medium">{i.connectionName}</td>
                <td className="p-4 capitalize">{i.provider}</td>
                <td className="p-4">{i.status}</td>
                <td className="p-4 tabular-nums text-slate-300">
                  {i.lastSyncAt ? String(i.lastSyncAt).slice(0, 10) : "—"}
                </td>
                <td className="p-4">
                  <button
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    onClick={() => onSync(i.id)}
                    type="button"
                  >
                    Sync
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={5}>
                  {rows.length === 0
                    ? "No integrations yet. Start api-gateway + integration-service and connect one."
                    : "No connections match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={connectOpen}
        onClose={() => !busy && setConnectOpen(false)}
        title="New integration connection"
        subtitle="Jira or Confluence — config is opaque JSON (e.g. baseUrl)."
      >
        <form onSubmit={onConnect} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "jira" | "confluence")}
              className={modalFieldClass}
            >
              <option value="jira">Jira</option>
              <option value="confluence">Confluence</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Connection name</span>
            <input
              className={modalFieldClass}
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Workspace ID (optional)</span>
            <input
              className={modalFieldClass}
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Config JSON</span>
            <textarea
              rows={4}
              className={`${modalFieldClass} font-mono text-xs`}
              value={configRaw}
              onChange={(e) => setConfigRaw(e.target.value)}
              spellCheck={false}
            />
          </label>
          <ModalActions>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              disabled={busy}
              onClick={() => setConnectOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              type="submit"
            >
              {busy ? "Connecting…" : "Create connection"}
            </button>
          </ModalActions>
        </form>
      </FormModal>
    </div>
  );
}
