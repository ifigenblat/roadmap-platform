import { useEffect, useState } from "react";
import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { TeamsClient } from "./teams-client";

export default function TeamsPage() {
  const [state, setState] = useState<{
    ok: boolean;
    message: string;
    rows: { id: string; name: string; kind?: string | null; active: boolean }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadJson<{ id: string; name: string; kind?: string | null; active: boolean }[]>(
        "/api/teams"
      );
      if (cancelled) return;
      setState({
        ok: res.ok,
        message: res.ok ? "" : res.message,
        rows: res.ok ? res.data : [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-400">Loading teams…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold">Teams</h1>
      {!state.ok && <ApiWarning message={state.message} />}
      <TeamsClient initial={state.rows} />
    </AppLayout>
  );
}
