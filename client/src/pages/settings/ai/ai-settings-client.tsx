import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadJson, sendJson } from "../../../lib/api";
import { ToastViewport, useToasts } from "../../../lib/toast";
import { WorkspaceSelectField } from "../../../components/workspace-select-field";

type LocalOpenAiKind = "ollama" | "lmstudio" | "localai" | "llamacpp" | "custom";

const LOCAL_DEFAULT_BASE: Record<LocalOpenAiKind, string> = {
  ollama: "http://127.0.0.1:11434/v1",
  lmstudio: "http://127.0.0.1:1234/v1",
  localai: "http://127.0.0.1:8080/v1",
  llamacpp: "http://127.0.0.1:8081/v1",
  custom: "",
};

/** Install & run hints (OpenAI-compatible `/v1` on localhost). */
const LOCAL_INSTALL: Record<
  LocalOpenAiKind,
  { title: string; macLinux: string; notes?: string }
> = {
  ollama: {
    title: "Ollama",
    macLinux: `# macOS (Homebrew)
brew install ollama
ollama serve

# In another terminal — pull a model, then it runs on OpenAI-compatible :11434/v1
ollama pull llama3.2`,
    notes: "Default API: http://127.0.0.1:11434/v1 — use a model name you have pulled (e.g. llama3.2).",
  },
  lmstudio: {
    title: "LM Studio",
    macLinux: `# Install from https://lmstudio.ai — then Local Server → Start server
# Typical OpenAI-compatible base: http://127.0.0.1:1234/v1`,
    notes: "Pick a loaded model in LM Studio; match the model id in “OpenAI model id” below.",
  },
  localai: {
    title: "LocalAI",
    macLinux: `# See https://localai.io — Docker example:
docker run -p 8080:8080 -ti localai/localai:latest

# Or use your install; set the base URL to where /v1 is served.`,
  },
  llamacpp: {
    title: "llama.cpp (server)",
    macLinux: `# Build llama.cpp, then run the server with OpenAI-compatible API, e.g.:
# ./llama-server -m ./models/your.gguf --port 8080 --api-prefix /v1

# Point “Base URL” at http://127.0.0.1:8080/v1 (adjust port to match).`,
  },
  custom: {
    title: "Custom",
    macLinux: `# Any server that implements POST /v1/chat/completions
# Set “Base URL” to the root that includes /v1 (e.g. http://host:port/v1).`,
  },
};

const OLLAMA_INSTALL_STEPS: { label: string; code: string }[] = [
  {
    label: "Install (from project root: services/)",
    code: "cd services && chmod +x scripts/local-ai/install-ollama.sh && ./scripts/local-ai/install-ollama.sh",
  },
  { label: "Or install manually: macOS", code: "brew install ollama" },
  { label: "Or: Linux", code: "curl -fsSL https://ollama.com/install.sh | sh" },
  { label: "Start the server", code: "ollama serve" },
  {
    label: "Pull a model (one-time, in another terminal)",
    code: "ollama pull llama3.2",
  },
];

const LOCAL_ACCORDION: Record<
  LocalOpenAiKind,
  { title: string; port: string }
> = {
  ollama: { title: "Ollama (recommended for Mac/Linux)", port: "port 11434" },
  localai: { title: "LocalAI (Docker)", port: "port 8080" },
  llamacpp: { title: "llama.cpp (Docker)", port: "port 8081" },
  lmstudio: { title: "LM Studio (desktop app)", port: "port 1234" },
  custom: { title: "Custom OpenAI-compatible URL", port: "—" },
};

const INSTALL_ACCORDION_ORDER: LocalOpenAiKind[] = [
  "ollama",
  "localai",
  "llamacpp",
  "lmstudio",
  "custom",
];

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinejoin="round" />
      <path d="M17 21v-8H7v8M7 3v5h8" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CodeCopyRow({
  label,
  code,
  onCopy,
}: {
  label: string;
  code: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex min-h-[2.75rem] items-stretch gap-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950/90">
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-slate-300 sm:text-xs">
          {code}
        </pre>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => onCopy());
          }}
          className="flex shrink-0 items-center justify-center border-l border-slate-700 px-3 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          title="Copy"
        >
          <IconCopy />
        </button>
      </div>
    </div>
  );
}

type WorkspaceOption = { id: string; name: string; slug: string };

type AiSettingsRow = {
  workspaceId: string;
  aiProvider: "openai" | "gemini";
  openaiModel: string;
  geminiModel: string;
  maxTokens: number | null;
  temperature: number | null;
  hasApiKeyOverride: boolean;
  hasGeminiApiKeyOverride: boolean;
  openaiCompatibleBaseUrl: string;
  localOpenAiKind: LocalOpenAiKind | null;
};

type AiStatus = {
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  model?: string;
  geminiModel?: string;
  effectiveModel?: string;
  aiProvider?: string;
  workspaceId?: string;
  workspaceHasApiKeyOverride?: boolean;
  workspaceHasGeminiApiKeyOverride?: boolean;
  workspaceOpenAiCompatibleBaseUrl?: string;
  localOpenAiKind?: LocalOpenAiKind | null;
  openaiCompatibleBaseUrlEnv?: string;
};

export function AiSettingsClient({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const { toasts, push, dismiss } = useToasts();
  const [workspaceId, setWorkspaceId] = useState("");
  /** serverEnv = host .env; workspaceKeys = stored API keys; localCompatible = Ollama / LM Studio / … */
  const [runMode, setRunMode] = useState<"serverEnv" | "workspaceKeys" | "localCompatible">(
    "workspaceKeys"
  );

  const [settings, setSettings] = useState<AiSettingsRow | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localOpenAiKind, setLocalOpenAiKind] = useState<LocalOpenAiKind>("ollama");
  const [openaiCompatibleBaseUrl, setOpenaiCompatibleBaseUrl] = useState("");
  /** Which install accordion is open in “Install & run local AI”. */
  const [openInstallKind, setOpenInstallKind] = useState<LocalOpenAiKind | null>("ollama");

  const refresh = useCallback(async () => {
    const ws = workspaceId.trim();
    if (!ws) {
      setSettings(null);
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [setRes, stRes] = await Promise.all([
        loadJson<AiSettingsRow>(`/api/workspaces/${encodeURIComponent(ws)}/ai-settings`),
        loadJson<AiStatus>(`/api/ai/status?workspaceId=${encodeURIComponent(ws)}`),
      ]);
      if (setRes.ok) {
        const s = setRes.data;
        setSettings(s);
        setAiProvider(s.aiProvider === "gemini" ? "gemini" : "openai");
        setOpenaiModel(s.openaiModel ?? "");
        setGeminiModel(s.geminiModel ?? "");
        setMaxTokens(s.maxTokens != null ? String(s.maxTokens) : "");
        setTemperature(s.temperature != null ? String(s.temperature) : "");
        setOpenaiApiKey("");
        setGeminiApiKey("");
        setOpenaiCompatibleBaseUrl(s.openaiCompatibleBaseUrl ?? "");
        const k = s.localOpenAiKind;
        setLocalOpenAiKind(
          k === "ollama" || k === "lmstudio" || k === "localai" || k === "llamacpp" || k === "custom"
            ? k
            : "ollama"
        );
        if (s.openaiCompatibleBaseUrl?.trim()) setRunMode("localCompatible");
      } else {
        setSettings(null);
        push(`Could not load AI settings: ${setRes.message}`, "error");
      }
      if (stRes.ok) setStatus(stRes.data);
      else setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, push]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!workspaceId && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaceId, workspaces]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const ws = workspaceId.trim();
    if (!ws) {
      push("Select a workspace.", "error");
      return;
    }
    if (runMode === "serverEnv") {
      push(
        "Switch to “Workspace API keys” or “Local OpenAI-compatible” to save provider settings, or use Clear buttons to remove stored keys."
      );
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> =
        runMode === "localCompatible"
          ? {
              aiProvider: "openai" as const,
              openaiModel: openaiModel.trim(),
              geminiModel: geminiModel.trim(),
              openaiCompatibleBaseUrl: openaiCompatibleBaseUrl.trim(),
              localOpenAiKind: localOpenAiKind,
            }
          : {
              aiProvider,
              openaiModel: openaiModel.trim(),
              geminiModel: geminiModel.trim(),
            };
      if (maxTokens.trim() === "") body.maxTokens = null;
      else {
        const n = Number(maxTokens);
        if (!Number.isFinite(n)) {
          push("Max tokens must be a number.", "error");
          setSaving(false);
          return;
        }
        body.maxTokens = n;
      }
      if (temperature.trim() === "") body.temperature = null;
      else {
        const t = Number(temperature);
        if (!Number.isFinite(t)) {
          push("Temperature must be a number.", "error");
          setSaving(false);
          return;
        }
        body.temperature = t;
      }
      if (openaiApiKey.trim()) body.openaiApiKey = openaiApiKey.trim();
      if (geminiApiKey.trim()) body.geminiApiKey = geminiApiKey.trim();

      const out = await sendJson<AiSettingsRow>(`/api/workspaces/${encodeURIComponent(ws)}/ai-settings`, "PATCH", body);
      setSettings(out);
      setOpenaiApiKey("");
      setGeminiApiKey("");
      push("AI settings saved.");
      const st = await loadJson<AiStatus>(`/api/ai/status?workspaceId=${encodeURIComponent(ws)}`);
      if (st.ok) setStatus(st.data);
    } catch (err) {
      push(`Save failed: ${String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function clearLocalEndpoint() {
    const ws = workspaceId.trim();
    if (!ws) return;
    setSaving(true);
    try {
      await sendJson(`/api/workspaces/${encodeURIComponent(ws)}/ai-settings`, "PATCH", {
        openaiCompatibleBaseUrl: "",
        localOpenAiKind: null,
      });
      push("Local OpenAI-compatible endpoint cleared.");
      setOpenaiCompatibleBaseUrl("");
      await refresh();
    } catch (err) {
      push(`Clear failed: ${String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(kind: "openai" | "gemini") {
    const ws = workspaceId.trim();
    if (!ws) return;
    setSaving(true);
    try {
      await sendJson(`/api/workspaces/${encodeURIComponent(ws)}/ai-settings`, "PATCH", {
        [kind === "openai" ? "openaiApiKey" : "geminiApiKey"]: "",
      });
      push(`${kind === "openai" ? "OpenAI" : "Gemini"} workspace key removed.`);
      await refresh();
    } catch (err) {
      push(`Clear failed: ${String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const fieldSelectClass =
    "mt-1 w-full max-w-2xl rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  return (
    <div className="mx-auto max-w-4xl">
      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      <div className="relative mb-8 pr-12">
        <Link
          to="/settings"
          className="absolute right-0 top-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Back to settings"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-slate-100">AI Provider Settings</h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Choose which AI to use when &quot;Use AI to create cards&quot; is enabled on the Upload page. Applies to
          this workspace; the gateway and AI service use the same settings for executive narrative and other AI
          routes.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-inner">
        <WorkspaceSelectField
          label="Workspace"
          value={workspaceId}
          onChange={setWorkspaceId}
          workspaces={workspaces}
          optional={false}
          disabled={saving}
        />

        <div className="mt-6 space-y-5">
          <label className="block text-sm">
            <span className="font-medium text-slate-300">Where does the AI run?</span>
            <select
              className={fieldSelectClass}
              value={runMode}
              disabled={saving}
              onChange={(e) => {
                const v = e.target.value as "serverEnv" | "workspaceKeys" | "localCompatible";
                setRunMode(v);
              }}
            >
              <option value="localCompatible">Locally (on this machine) — no cloud API keys</option>
              <option value="workspaceKeys">Workspace API keys — OpenAI / Gemini (cloud)</option>
              <option value="serverEnv">Server environment — keys from host .env only</option>
            </select>
          </label>

          {runMode === "localCompatible" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-300">Local service</span>
              <select
                className={fieldSelectClass}
                value={localOpenAiKind}
                disabled={saving}
                onChange={(e) => {
                  const v = e.target.value as LocalOpenAiKind;
                  setLocalOpenAiKind(v);
                  if (v !== "custom") setOpenaiCompatibleBaseUrl(LOCAL_DEFAULT_BASE[v]);
                }}
              >
                <option value="ollama">Ollama (recommended)</option>
                <option value="lmstudio">LM Studio</option>
                <option value="localai">LocalAI (Docker)</option>
                <option value="llamacpp">llama.cpp (server)</option>
                <option value="custom">Custom URL</option>
              </select>
            </label>
          ) : null}

          {runMode === "localCompatible" ? (
            <div className="rounded-lg border border-slate-700/80 bg-slate-800/35 p-4 text-sm leading-relaxed text-slate-400">
              {localOpenAiKind === "ollama" ? (
                <p>
                  <span className="font-medium text-slate-300">Free (local).</span> Install Ollama from{" "}
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300"
                  >
                    ollama.com
                  </a>
                  , run <code className="rounded bg-slate-950 px-1 font-mono text-xs">ollama pull llama3.2</code>{" "}
                  (or another model), then <code className="rounded bg-slate-950 px-1 font-mono text-xs">ollama serve</code>
                  . Set <code className="rounded bg-slate-950 px-1 font-mono text-xs">OLLAMA_ENABLED=true</code> in
                  ai-service when applicable. No API key.
                </p>
              ) : (
                <p>
                  {LOCAL_INSTALL[localOpenAiKind].notes ??
                    `Configure ${LOCAL_ACCORDION[localOpenAiKind].title} and set Base URL below to match your local OpenAI-compatible endpoint.`}
                </p>
              )}
            </div>
          ) : null}

          {loading && workspaceId ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : null}

          {runMode === "serverEnv" && workspaceId && !loading && (
            <div className="border-l-4 border-aiLocal bg-aiLocal/5 p-4 dark:bg-aiLocal/10">
            <h3 className="text-sm font-semibold text-aiLocal">Server-side configuration</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>No third-party keys in the browser; the gateway and AI service read the deployment environment.</li>
              <li>Workspace rows below can still override models when you switch to “Workspace API keys”.</li>
            </ul>
            {status ? (
              <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Env OpenAI</dt>
                  <dd>{status.openaiConfigured ? "Configured" : "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Env Gemini</dt>
                  <dd>{status.geminiConfigured ? "Configured" : "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Effective model</dt>
                  <dd className="font-mono text-xs">{status.effectiveModel ?? status.model ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Workspace overrides</dt>
                  <dd>
                    {status.workspaceHasApiKeyOverride || status.workspaceHasGeminiApiKeyOverride
                      ? "Keys stored for this workspace"
                      : "None"}
                  </dd>
                </div>
                {status.workspaceOpenAiCompatibleBaseUrl ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Workspace local OpenAI base
                    </dt>
                    <dd className="font-mono text-xs">{status.workspaceOpenAiCompatibleBaseUrl}</dd>
                  </div>
                ) : null}
                {status.localOpenAiKind ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Local stack (workspace)</dt>
                    <dd className="capitalize">{status.localOpenAiKind}</dd>
                  </div>
                ) : null}
                {status.openaiCompatibleBaseUrlEnv ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Env OPENAI_COMPATIBLE_BASE_URL (ai-service)
                    </dt>
                    <dd className="font-mono text-xs">{status.openaiCompatibleBaseUrlEnv}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Status unavailable (is ai-service running?).</p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              To stop using database keys, switch to “Workspace API keys” and use Clear on each provider, or set
              empty keys when saving.
            </p>
            </div>
          )}

          {runMode === "workspaceKeys" && workspaceId && !loading && settings && (
          <form onSubmit={onSave} className="mt-2 space-y-4">
            <div className="border-l-4 border-aiCloud bg-indigo-950/10 p-4 ring-1 ring-aiCloud/20 dark:bg-indigo-950/20">
              <p className="text-xs font-medium uppercase tracking-wide text-aiCloud">Remote API</p>
              <p className="mt-1 text-sm text-slate-400">
                Keys are stored encrypted at rest in the portfolio database; only this backend calls OpenAI /
                Google. Never echoed back on GET.
              </p>

              <label className="mt-4 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Provider</span>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as "openai" | "gemini")}
                  className="max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-aiCloud/60"
                >
                  <option value="openai">OpenAI API</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>

              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">OpenAI model id</span>
                <input
                  className="max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-aiCloud/60"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                />
              </label>

              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Gemini model id</span>
                <input
                  className="max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-aiCloud/60"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  placeholder="e.g. gemini-2.0-flash"
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">OpenAI API key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-aiCloud/60"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder={settings.hasApiKeyOverride ? "Leave blank to keep saved key" : "sk-…"}
                  />
                  {settings.hasApiKeyOverride ? (
                    <span className="text-xs text-slate-500">A workspace key is on file.</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Gemini API key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-aiCloud/60"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={settings.hasGeminiApiKeyOverride ? "Leave blank to keep saved key" : "…"}
                  />
                  {settings.hasGeminiApiKeyOverride ? (
                    <span className="text-xs text-slate-500">A workspace key is on file.</span>
                  ) : null}
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !settings.hasApiKeyOverride}
                  onClick={() => void clearKey("openai")}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Clear OpenAI workspace key
                </button>
                <button
                  type="button"
                  disabled={saving || !settings.hasGeminiApiKeyOverride}
                  onClick={() => void clearKey("gemini")}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Clear Gemini workspace key
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-left transition hover:bg-slate-900"
            >
              <div>
                <div className="text-sm font-medium text-slate-200">Processing limits (chunking &amp; memory)</div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Defaults and max values. Lower values reduce memory use; higher allow larger requests.
                </p>
              </div>
              <svg
                className={`h-5 w-5 shrink-0 text-slate-500 transition ${advancedOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {advancedOpen ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Max tokens</span>
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    placeholder="Empty = service default"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Temperature (0–2)</span>
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="Empty = service default"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                <IconSave />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {runMode === "localCompatible" && workspaceId && !loading && settings && (
          <form onSubmit={onSave} className="mt-2 space-y-4">
            <div className="border-l-4 border-emerald-500/70 bg-emerald-950/15 p-4 ring-1 ring-emerald-500/20">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">
                Local LLM (OpenAI-compatible)
              </p>
              <p className="mt-1 text-sm text-slate-400">
                The AI service calls <code className="rounded bg-slate-950 px-1">POST /v1/chat/completions</code> on
                your base URL. Optional: set{" "}
                <code className="rounded bg-slate-950 px-1">OPENAI_COMPATIBLE_BASE_URL</code> on the host for a
                global default.
              </p>

              <label className="mt-4 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Base URL (must include /v1)</span>
                <input
                  className="max-w-xl rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={openaiCompatibleBaseUrl}
                  onChange={(e) => setOpenaiCompatibleBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434/v1"
                />
              </label>

              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">OpenAI model id (sent to the local server)</span>
                <input
                  className="max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="e.g. llama3.2, gpt-4o-mini (LM Studio id)"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !settings.openaiCompatibleBaseUrl?.trim()}
                  onClick={() => void clearLocalEndpoint()}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Clear local endpoint
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-left transition hover:bg-slate-900"
            >
              <div>
                <div className="text-sm font-medium text-slate-200">Processing limits (chunking &amp; memory)</div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Defaults and max values. Lower values reduce memory use; higher allow larger requests.
                </p>
              </div>
              <svg
                className={`h-5 w-5 shrink-0 text-slate-500 transition ${advancedOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {advancedOpen ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Max tokens</span>
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    placeholder="Empty = service default"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Temperature (0–2)</span>
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="Empty = service default"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                <IconSave />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        </div>
      </div>

      {runMode === "localCompatible" ? (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-inner">
          <h3 className="text-lg font-semibold text-slate-100">Install &amp; run local AI</h3>
          <p className="mt-1 text-sm text-slate-400">
            Run these steps on the machine where the app runs. Then select the provider above and Save.
          </p>

          <div className="mt-5 space-y-2">
            {INSTALL_ACCORDION_ORDER.map((kind) => {
              const meta = LOCAL_ACCORDION[kind];
              const expanded = openInstallKind === kind;
              return (
                <div
                  key={kind}
                  className={`overflow-hidden rounded-lg border ${
                    expanded ? "border-indigo-500/50 ring-1 ring-indigo-500/20" : "border-slate-700/90"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenInstallKind(expanded ? null : kind)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                      expanded ? "bg-indigo-950/25 text-slate-100" : "bg-slate-900/50 text-slate-300 hover:bg-slate-800/70"
                    }`}
                  >
                    <span className="font-medium">{meta.title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-slate-500">{meta.port}</span>
                      <svg
                        className={`h-5 w-5 text-slate-500 transition ${expanded ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {expanded ? (
                    <div className="space-y-4 border-t border-slate-800 bg-slate-950/40 p-4">
                      {kind === "ollama" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(OLLAMA_INSTALL_STEPS[0].code);
                              push("Install command copied.");
                            }}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                          >
                            Run install
                          </button>
                          <div className="space-y-3">
                            {OLLAMA_INSTALL_STEPS.map((step) => (
                              <CodeCopyRow
                                key={step.label}
                                label={step.label}
                                code={step.code}
                                onCopy={() => push("Copied to clipboard.")}
                              />
                            ))}
                          </div>
                          <p className="text-sm leading-relaxed text-slate-400">
                            In this app: select <strong className="text-slate-300">Where does the AI run: Locally</strong>
                            , <strong className="text-slate-300">Local service: Ollama</strong>, then Save. Set{" "}
                            <code className="rounded bg-slate-900 px-1 font-mono text-xs">OLLAMA_ENABLED=true</code> and{" "}
                            <code className="rounded bg-slate-900 px-1 font-mono text-xs">OLLAMA_MODEL=llama3.2</code>{" "}
                            (or your model) when starting the AI service (e.g. in start-all.sh or .env).
                          </p>
                        </>
                      ) : (
                        <>
                          <CodeCopyRow
                            label="Commands"
                            code={LOCAL_INSTALL[kind].macLinux.trim()}
                            onCopy={() => push("Copied to clipboard.")}
                          />
                          {LOCAL_INSTALL[kind].notes ? (
                            <p className="text-sm text-slate-500">{LOCAL_INSTALL[kind].notes}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Full guide:{" "}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-slate-400">services/LOCAL_AI_SETUP.md</code>{" "}
            in the project.
          </p>
        </div>
      ) : null}

      {workspaceId && !loading && status ? (
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h3 className="text-sm font-medium text-slate-400">Merged status (gateway)</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-400">
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
