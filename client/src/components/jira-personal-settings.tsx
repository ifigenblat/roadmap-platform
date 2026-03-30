import { useEffect, useState, type FormEvent } from "react";
import { sendJson } from "../lib/api";
import { modalFieldClass } from "./form-modal";
import {
  clearJiraPersonalConfig,
  loadJiraPersonalConfig,
  saveJiraPersonalConfig,
  type JiraPersonalConfig,
} from "../lib/jira-personal";
import type { ToastTone } from "../lib/toast";

/** Known Jira Cloud sites — first entry is the default for new setups. */
const JIRA_SITE_PRESETS = [
  { id: "pennymac", label: "PennyMac", url: "https://pennymac.atlassian.net" },
] as const;

function normalizeJiraSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function presetIdForUrl(url: string): string {
  const n = normalizeJiraSiteUrl(url);
  const hit = JIRA_SITE_PRESETS.find((p) => p.url === n);
  return hit ? `preset:${hit.id}` : "__custom__";
}

export function JiraPersonalSettings({
  push,
  idPrefix = "account",
}: {
  push: (message: string, tone?: ToastTone) => void;
  /** Prefix for input ids when multiple instances could exist on one page. */
  idPrefix?: string;
}) {
  const [jiraPersonal, setJiraPersonal] = useState<JiraPersonalConfig | null>(null);
  const [jiraSite, setJiraSite] = useState(JIRA_SITE_PRESETS[0].url);
  const [jiraSiteChoice, setJiraSiteChoice] = useState(`preset:${JIRA_SITE_PRESETS[0].id}`);
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraVerifyName, setJiraVerifyName] = useState<string | null>(null);
  const [jiraIssueKeyTry, setJiraIssueKeyTry] = useState("");
  const [jiraBusy, setJiraBusy] = useState(false);

  useEffect(() => {
    const saved = loadJiraPersonalConfig();
    if (saved) {
      setJiraPersonal(saved);
      const site = normalizeJiraSiteUrl(saved.siteUrl);
      setJiraSite(site);
      setJiraSiteChoice(presetIdForUrl(site));
      setJiraEmail(saved.email);
      setJiraToken(saved.apiToken);
    }
  }, []);

  function jiraConfigFromForm(): JiraPersonalConfig | null {
    const siteUrl = normalizeJiraSiteUrl(jiraSite);
    const email = jiraEmail.trim();
    const apiToken = jiraToken.trim();
    if (!siteUrl || !email || !apiToken) return null;
    return { siteUrl, email, apiToken };
  }

  async function onJiraSaveLocal(e: FormEvent) {
    e.preventDefault();
    const c = jiraConfigFromForm();
    if (!c) {
      push("Fill site URL, email, and API token.", "error");
      return;
    }
    saveJiraPersonalConfig(c);
    setJiraPersonal(c);
    push("Saved Jira credentials on this device only.");
  }

  async function onJiraVerify() {
    const c = jiraConfigFromForm();
    if (!c) {
      push("Fill site URL, email, and API token.", "error");
      return;
    }
    setJiraBusy(true);
    try {
      const me = await sendJson<{
        displayName: string | null;
        emailAddress: string | null;
      }>("/api/integrations/jira/stateless/me", "POST", { config: c });
      setJiraVerifyName(me.displayName ?? me.emailAddress ?? "connected");
      push(`Jira verified as ${me.displayName ?? me.emailAddress ?? "your account"}.`);
    } catch (err) {
      setJiraVerifyName(null);
      push(`Verify failed: ${String(err)}`, "error");
    } finally {
      setJiraBusy(false);
    }
  }

  async function onJiraTryReadIssue(e?: FormEvent) {
    e?.preventDefault();
    const c = jiraConfigFromForm();
    if (!c) {
      push("Fill site URL, email, and API token.", "error");
      return;
    }
    const issueKey = jiraIssueKeyTry.trim();
    if (!issueKey) {
      push(
        "Type a Jira issue key first (for example PMAC-123), then click Read issue or press Enter.",
        "error"
      );
      return;
    }
    setJiraBusy(true);
    try {
      await sendJson<unknown>("/api/integrations/jira/stateless/issue/get", "POST", {
        config: c,
        issueKey,
        fields: "summary,status,assignee",
      });
      push(`Read issue ${issueKey} OK (check Jira for your user’s permissions).`);
    } catch (err) {
      push(`Read failed: ${String(err)}`, "error");
    } finally {
      setJiraBusy(false);
    }
  }

  function onJiraSiteSelect(value: string) {
    setJiraSiteChoice(value);
    if (value.startsWith("preset:")) {
      const id = value.slice("preset:".length);
      const preset = JIRA_SITE_PRESETS.find((p) => p.id === id);
      if (preset) setJiraSite(preset.url);
    }
  }

  function onJiraClear() {
    clearJiraPersonalConfig();
    setJiraPersonal(null);
    setJiraSite(JIRA_SITE_PRESETS[0].url);
    setJiraSiteChoice(`preset:${JIRA_SITE_PRESETS[0].id}`);
    setJiraEmail("");
    setJiraToken("");
    setJiraVerifyName(null);
    push("Removed Jira credentials from this device.");
  }

  const issueKeyId = `${idPrefix}-jira-issue-key`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5" id="jira">
      <h3 className="text-lg font-medium text-slate-100">Jira (this device)</h3>
      <p className="mt-1 text-sm text-slate-400">
        Personal Atlassian API token for Jira Cloud — stored only in this browser. Actions in Jira use your
        permissions. Configure the same flow here as in workspace integrations, kept under your account for
        clarity.
      </p>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-sm font-medium text-slate-200">How to get your API token</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>
            Open{" "}
            <a
              className="text-indigo-400 underline hover:text-indigo-300"
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noreferrer"
            >
              Atlassian account → Security → Create and manage API tokens
            </a>
            .
          </li>
          <li>
            Select <strong className="font-medium text-slate-300">Create API token</strong>, name it (e.g.
            “Roadmap”), then create it.
          </li>
          <li>
            <strong className="font-medium text-slate-300">Copy the token immediately</strong> — it is only
            shown once.
          </li>
          <li>
            Paste it below with the <strong className="font-medium text-slate-300">same email</strong> as your
            Atlassian profile.
          </li>
        </ol>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onJiraSaveLocal}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-400">Jira site</span>
          <select
            className={modalFieldClass}
            value={jiraSiteChoice}
            onChange={(e) => onJiraSiteSelect(e.target.value)}
          >
            {JIRA_SITE_PRESETS.map((p) => (
              <option key={p.id} value={`preset:${p.id}`}>
                {p.label} ({p.url.replace(/^https:\/\//, "")})
              </option>
            ))}
            <option value="__custom__">Other… (custom URL)</option>
          </select>
          {jiraSiteChoice !== "__custom__" && (
            <p className="mt-1 text-xs text-slate-500">
              API calls use <code className="text-slate-400">{normalizeJiraSiteUrl(jiraSite)}</code>
            </p>
          )}
        </label>
        {jiraSiteChoice === "__custom__" && (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-400">Custom site URL</span>
            <input
              className={modalFieldClass}
              placeholder="https://your-domain.atlassian.net"
              value={jiraSite}
              onChange={(e) => setJiraSite(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Atlassian account email</span>
          <input
            className={modalFieldClass}
            type="email"
            value={jiraEmail}
            onChange={(e) => setJiraEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">API token</span>
          <input
            className={modalFieldClass}
            type="password"
            value={jiraToken}
            onChange={(e) => setJiraToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={jiraBusy}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Save locally
          </button>
          <button
            type="button"
            disabled={jiraBusy}
            onClick={() => void onJiraVerify()}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            Verify connection
          </button>
          <button
            type="button"
            disabled={jiraBusy}
            onClick={onJiraClear}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-60"
          >
            Remove from this device
          </button>
        </div>
      </form>
      {(jiraPersonal || jiraVerifyName) && (
        <p className="mt-3 text-sm text-slate-300">
          {jiraVerifyName
            ? `Last verified Jira identity: ${jiraVerifyName}.`
            : jiraPersonal
              ? "Credentials saved on this device."
              : null}
        </p>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-4"
        onSubmit={(e) => void onJiraTryReadIssue(e)}
      >
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm" htmlFor={issueKeyId}>
          <span className="text-slate-400">Try read — Jira issue key</span>
          <input
            id={issueKeyId}
            name="jiraIssueKey"
            className={modalFieldClass}
            placeholder="e.g. PMAC-123"
            value={jiraIssueKeyTry}
            onChange={(e) => setJiraIssueKeyTry(e.target.value)}
            autoComplete="off"
            disabled={jiraBusy}
          />
        </label>
        <button
          type="submit"
          disabled={jiraBusy || !jiraIssueKeyTry.trim()}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
        >
          Read issue
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-500">
        Server routes:{" "}
        <code className="rounded bg-slate-950 px-1 py-0.5 text-slate-400">
          /api/integrations/jira/stateless/*
        </code>{" "}
        with <code className="rounded bg-slate-950 px-1">config</code> in the JSON body.
      </p>
    </div>
  );
}
