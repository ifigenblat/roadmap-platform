import { useCallback, useRef, useState } from "react";
import { JiraIssueDetailPanel } from "./jira-issue-detail-panel";
import { fetchJiraIssueCached, type JiraIssueApi } from "../lib/jira-issue-fetch";
import { firstJiraIssueKey } from "../lib/jira-issue-key";
import { loadJiraPersonalConfig, type JiraPersonalConfig } from "../lib/jira-personal";

export function JiraGridCell({ value }: { value: string }) {
  const trimmed = value.trim();
  const primaryKey = firstJiraIssueKey(trimmed);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issue, setIssue] = useState<JiraIssueApi | null>(null);
  const [browseBase, setBrowseBase] = useState<string>("");
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShow = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const runFetch = useCallback(async (issueKey: string, config: JiraPersonalConfig) => {
    setLoading(true);
    setErr(null);
    try {
      const { issue: data, browseBase: base } = await fetchJiraIssueCached(config, issueKey);
      setIssue(data);
      setBrowseBase(base);
    } catch (e) {
      setIssue(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const openPanel = useCallback(() => {
    clearHide();
    clearShow();
    showTimer.current = setTimeout(() => {
      setOpen(true);
      if (!trimmed || !primaryKey) {
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
      void runFetch(primaryKey, config);
    }, 180);
  }, [trimmed, primaryKey, clearHide, clearShow, runFetch]);

  const scheduleClose = useCallback(() => {
    clearShow();
    clearHide();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setLoading(false);
    }, 200);
  }, [clearShow, clearHide]);

  const cancelClose = useCallback(() => {
    clearHide();
  }, [clearHide]);

  const hasConfig = !!loadJiraPersonalConfig();

  return (
    <div
      className="relative inline-block max-w-full align-top"
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <span
        className={`line-clamp-3 break-all text-xs ${
          trimmed
            ? "cursor-help text-slate-300 underline decoration-slate-600 decoration-dotted underline-offset-2"
            : "text-slate-500"
        }`}
      >
        {trimmed || "—"}
      </span>
      {open && (
        <div
          className="pointer-events-auto absolute left-0 top-full z-[200] w-[min(22rem,calc(100vw-2rem))] text-left"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-2 w-full shrink-0" aria-hidden />
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs shadow-xl ring-1 ring-black/40">
            <JiraIssueDetailPanel
              value={value}
              loading={loading}
              err={err}
              issue={issue}
              browseBase={browseBase}
              hasConfig={hasConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
}
