"use client";

import { useState } from "react";
import { sendJson } from "../../../../lib/api";
import { ToastViewport, useToasts } from "../../../../lib/toast";

type ExecApi = {
  roadmap: { id: string; name: string; planningYear: number; status: string };
  generatedAt: string;
  themes: Array<{
    strategicTheme: { id: string; name: string; objective: string | null; orderIndex: number };
    initiatives: Array<{
      initiativeId: string;
      canonicalName: string;
      shortObjective: string | null;
      detailedObjective: string | null;
      phaseHealth: { totalPhases: number; byStatus: Record<string, number> };
    }>;
  }>;
  ungroupedInitiatives: Array<{
    initiativeId: string;
    canonicalName: string;
    shortObjective: string | null;
    detailedObjective: string | null;
    phaseHealth: { totalPhases: number; byStatus: Record<string, number> };
  }>;
};

function toAiBundle(data: ExecApi) {
  return {
    roadmapName: data.roadmap.name,
    planningYear: data.roadmap.planningYear,
    themes: data.themes.map((t) => ({
      name: t.strategicTheme.name,
      pillarObjective: t.strategicTheme.objective,
      orderIndex: t.strategicTheme.orderIndex,
      initiatives: t.initiatives.map((i) => ({
        name: i.canonicalName,
        shortObjective: i.shortObjective,
        detailedObjective: i.detailedObjective,
        phaseHealth: i.phaseHealth,
      })),
    })),
    ungroupedInitiatives: data.ungroupedInitiatives.map((i) => ({
      name: i.canonicalName,
      shortObjective: i.shortObjective,
      detailedObjective: i.detailedObjective,
      phaseHealth: i.phaseHealth,
    })),
  };
}

export function ExecutiveClient({ initial }: { initial: ExecApi }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  async function generateNarrative() {
    setBusy(true);
    try {
      const bundle = toAiBundle(initial);
      const out = await sendJson<{ narrative: string; source?: string }>("/api/ai/executive-summary", "POST", {
        bundle,
      });
      setNarrative(out.narrative);
      push(out.source === "openai" ? "Narrative generated." : "Narrative generated (stub — set OPENAI_API_KEY for live AI).");
    } catch (e) {
      push(`Failed: ${String(e)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      push(`${label} copied.`);
    } catch {
      push("Clipboard failed.", "error");
    }
  }

  function download(filename: string, body: string) {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const jsonExport = JSON.stringify(initial, null, 2);

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void generateNarrative()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate AI narrative"}
        </button>
        <button
          type="button"
          onClick={() => void copyText("JSON", jsonExport)}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          Copy data (JSON)
        </button>
        {narrative ? (
          <>
            <button
              type="button"
              onClick={() => void copyText("Narrative", narrative)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Copy narrative
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  `executive-${initial.roadmap.name.replace(/\s+/g, "-")}-${initial.roadmap.planningYear}.txt`,
                  narrative
                )
              }
              className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Download narrative (.txt)
            </button>
          </>
        ) : null}
      </div>

      {narrative && (
        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">AI narrative</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">{narrative}</pre>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Structured summary</h2>
        <p className="mt-1 text-xs text-slate-500">Generated {new Date(initial.generatedAt).toLocaleString()}</p>

        <div className="mt-6 space-y-8">
          {initial.themes.map((block) => (
            <div key={block.strategicTheme.id}>
              <h3 className="text-lg font-medium text-slate-100">{block.strategicTheme.name}</h3>
              {block.strategicTheme.objective ? (
                <p className="mt-1 text-sm text-slate-400 whitespace-pre-wrap">{block.strategicTheme.objective}</p>
              ) : null}
              <ul className="mt-4 space-y-4">
                {block.initiatives.map((i) => (
                  <li key={i.initiativeId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                    <p className="font-medium text-slate-200">{i.canonicalName}</p>
                    {i.shortObjective ? (
                      <p className="mt-1 text-sm text-slate-400">{i.shortObjective}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Phases tracked: {i.phaseHealth.totalPhases} ·{" "}
                      {Object.entries(i.phaseHealth.byStatus)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {initial.ungroupedInitiatives.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-amber-200/90">Ungrouped initiatives</h3>
              <p className="mt-1 text-sm text-slate-500">Not linked to a strategic theme on this roadmap.</p>
              <ul className="mt-4 space-y-3">
                {initial.ungroupedInitiatives.map((i) => (
                  <li key={i.initiativeId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                    <p className="font-medium text-slate-200">{i.canonicalName}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Phases: {i.phaseHealth.totalPhases} ·{" "}
                      {Object.entries(i.phaseHealth.byStatus)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
