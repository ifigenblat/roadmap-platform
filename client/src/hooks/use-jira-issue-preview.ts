import { useEffect, useState } from "react";
import { fetchJiraIssueCached, type JiraIssueApi } from "../lib/jira-issue-fetch";
import { firstJiraIssueKey } from "../lib/jira-issue-key";
import { loadJiraPersonalConfig } from "../lib/jira-personal";

/**
 * Loads Jira issue JSON when `raw` contains a parseable key and `enabled` is true (e.g. tooltip visible).
 */
export function useJiraIssuePreview(raw: string, enabled: boolean) {
  const trimmed = raw.trim();
  const primaryKey = firstJiraIssueKey(trimmed);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issue, setIssue] = useState<JiraIssueApi | null>(null);
  const [browseBase, setBrowseBase] = useState("");
  const hasConfig = !!loadJiraPersonalConfig();

  useEffect(() => {
    if (!enabled || !primaryKey) {
      setIssue(null);
      setErr(null);
      setLoading(false);
      return;
    }
    const config = loadJiraPersonalConfig();
    if (!config) {
      setIssue(null);
      setErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchJiraIssueCached(config, primaryKey)
      .then(({ issue: data, browseBase: base }) => {
        if (!cancelled) {
          setIssue(data);
          setBrowseBase(base);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setIssue(null);
          setErr(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, primaryKey, trimmed]);

  return {
    trimmed,
    primaryKey,
    loading,
    err,
    issue,
    browseBase,
    hasConfig,
  };
}
