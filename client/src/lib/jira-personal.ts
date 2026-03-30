/**
 * Per-device Jira Cloud credentials (localStorage). Each user creates their own API token at
 * https://id.atlassian.com/manage-profile/security/api-tokens — Jira attributes API actions to that account.
 *
 * Tokens are not sent to our Postgres integration_connection table; stateless API routes accept
 * `config` in the JSON body per request (see integration-service `/integrations/jira/stateless/*`).
 */
const STORAGE_KEY = "roadmap.jiraPersonalConfig.v1";

export type JiraPersonalConfig = {
  siteUrl: string;
  email: string;
  apiToken: string;
};

export function loadJiraPersonalConfig(): JiraPersonalConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const c = o as Record<string, unknown>;
    const siteUrl = typeof c.siteUrl === "string" ? c.siteUrl.trim() : "";
    const email = typeof c.email === "string" ? c.email.trim() : "";
    const apiToken = typeof c.apiToken === "string" ? c.apiToken : "";
    if (!siteUrl || !email || !apiToken) return null;
    return { siteUrl, email, apiToken };
  } catch {
    return null;
  }
}

export function saveJiraPersonalConfig(config: JiraPersonalConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearJiraPersonalConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
