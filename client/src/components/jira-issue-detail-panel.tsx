import { jiraDescriptionPlain } from "../lib/jira-adf-plain";
import type { JiraIssueApi } from "../lib/jira-issue-fetch";
import { formatJiraDt } from "../lib/jira-issue-fetch";
import { extractJiraIssueKeys, firstJiraIssueKey } from "../lib/jira-issue-key";

export function JiraIssueDetailPanel({
  value,
  loading,
  err,
  issue,
  browseBase,
  hasConfig,
  compact,
}: {
  value: string;
  loading: boolean;
  err: string | null;
  issue: JiraIssueApi | null;
  browseBase: string;
  hasConfig: boolean;
  /** Slightly tighter typography (e.g. timeline tooltip). */
  compact?: boolean;
}) {
  const trimmed = value.trim();
  const keys = extractJiraIssueKeys(trimmed);
  const primaryKey = firstJiraIssueKey(trimmed);
  const fields = issue?.fields;
  const descPlain = fields?.description ? jiraDescriptionPlain(fields.description) : "";
  const descPreview =
    descPlain.length > 500 ? `${descPlain.slice(0, 500).trim()}…` : descPlain;
  const dlClass = compact
    ? "grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 text-[10px]"
    : "grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[11px]";

  return (
    <>
      {!trimmed && <p className="text-slate-400">No Jira key in this cell.</p>}
      {trimmed && !primaryKey && (
        <p className="text-slate-400">
          Could not parse a Jira issue key (expected format like{" "}
          <span className="font-mono">PROJ-123</span>).
        </p>
      )}
      {primaryKey && !hasConfig && (
        <p className="text-slate-300">
          Add your Jira API token under{" "}
          <span className="font-medium text-slate-200">Settings → Integrations</span> to load live issue
          details.
        </p>
      )}
      {primaryKey && hasConfig && loading && (
        <p className="text-slate-400">Loading {primaryKey}…</p>
      )}
      {primaryKey && hasConfig && err && !loading && (
        <p className="text-amber-200/90">Could not load issue: {err}</p>
      )}
      {primaryKey && fields && !loading && !err && (
        <div className="space-y-2 text-slate-200">
          <div className={`font-semibold text-slate-100 ${compact ? "text-xs" : ""}`}>
            {issue?.key ?? primaryKey}
            {fields.summary ? ` — ${fields.summary}` : ""}
          </div>
          <dl className={`${dlClass} text-slate-200`}>
            <dt className="text-slate-500">Status</dt>
            <dd>{fields.status?.name ?? "—"}</dd>
            <dt className="text-slate-500">Type</dt>
            <dd>{fields.issuetype?.name ?? "—"}</dd>
            <dt className="text-slate-500">Priority</dt>
            <dd>{fields.priority?.name ?? "—"}</dd>
            <dt className="text-slate-500">Assignee</dt>
            <dd>{fields.assignee?.displayName ?? "Unassigned"}</dd>
            <dt className="text-slate-500">Reporter</dt>
            <dd>{fields.reporter?.displayName ?? "—"}</dd>
            <dt className="text-slate-500">Updated</dt>
            <dd>{formatJiraDt(fields.updated)}</dd>
            <dt className="text-slate-500">Created</dt>
            <dd>{formatJiraDt(fields.created)}</dd>
            {fields.labels && fields.labels.length > 0 && (
              <>
                <dt className="text-slate-500">Labels</dt>
                <dd className="break-words">{fields.labels.join(", ")}</dd>
              </>
            )}
          </dl>
          {descPreview && (
            <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
              <div className="mb-0.5 font-medium text-slate-500">Description</div>
              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{descPreview}</div>
            </div>
          )}
          {browseBase && (
            <a
              href={`${browseBase}/browse/${encodeURIComponent(issue?.key ?? primaryKey)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block pt-1 text-indigo-400 hover:text-indigo-300"
            >
              Open in Jira →
            </a>
          )}
        </div>
      )}
      {keys.length > 1 && primaryKey && (
        <p className="mt-2 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
          Multiple keys; showing {primaryKey}. Others: {keys.slice(1).join(", ")}
        </p>
      )}
    </>
  );
}
