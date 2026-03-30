import { sendJson } from "./api";
import type { JiraPersonalConfig } from "./jira-personal";

export type JiraIssueApi = {
  key?: string;
  self?: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    issuetype?: { name?: string };
    priority?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string } | null;
    reporter?: { displayName?: string } | null;
    updated?: string;
    created?: string;
    labels?: string[];
    description?: unknown;
  };
};

type CacheEntry = { at: number; issue: JiraIssueApi };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function jiraCacheKey(config: JiraPersonalConfig, issueKey: string): string {
  return `${config.siteUrl}|${config.email}|${issueKey}`;
}

export function formatJiraDt(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** Returns cached issue when fresh; otherwise fetches and updates cache. */
export async function fetchJiraIssueCached(
  config: JiraPersonalConfig,
  issueKey: string
): Promise<{ issue: JiraIssueApi; browseBase: string }> {
  const ck = jiraCacheKey(config, issueKey);
  const hit = cache.get(ck);
  const browseBase = config.siteUrl.replace(/\/+$/, "");
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { issue: hit.issue, browseBase };
  }
  const data = await sendJson<JiraIssueApi>("/api/integrations/jira/stateless/issue/get", "POST", {
    config,
    issueKey,
    fields:
      "summary,status,assignee,description,priority,issuetype,updated,created,labels,reporter",
  });
  cache.set(ck, { at: Date.now(), issue: data });
  return { issue: data, browseBase };
}
