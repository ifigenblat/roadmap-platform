/**
 * Extract Jira issue keys from free text or browse URLs (e.g. PROJ-123, …/browse/ABC-42).
 */
const KEY_RE = /\b([A-Za-z][A-Za-z0-9]{1,15}-\d+)\b/g;

export function extractJiraIssueKeys(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(KEY_RE.source, "g");
  while ((m = re.exec(s)) !== null) {
    const k = m[1].toUpperCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function firstJiraIssueKey(raw: string): string | null {
  const keys = extractJiraIssueKeys(raw);
  return keys[0] ?? null;
}
