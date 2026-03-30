const { z } = require("zod");

const jiraCloudConnectionConfigSchema = z.object({
  siteUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
});

const API_V3 = "/rest/api/3";

class JiraRestError extends Error {
  /**
   * @param {number} status
   * @param {string} bodyText
   */
  constructor(status, bodyText) {
    super(`Jira REST ${status}: ${bodyText.slice(0, 200)}`);
    this.name = "JiraRestError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

function normalizeSiteUrl(siteUrl) {
  return siteUrl.replace(/\/+$/, "");
}

/**
 * Thin client for Jira Cloud REST API v3 (Basic auth).
 * @param {z.infer<typeof jiraCloudConnectionConfigSchema>} cfg
 */
function createJiraCloudRestClient(cfg) {
  const base = normalizeSiteUrl(cfg.siteUrl);
  const basic = Buffer.from(`${cfg.email}:${cfg.apiToken}`, "utf8").toString("base64");

  /**
   * @param {string} path
   * @param {RequestInit} [init]
   */
  async function jiraFetch(path, init) {
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const method = (init && init.method) || "GET";
    const hasBody = init && init.body != null;
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basic}`,
        ...(method !== "GET" && method !== "HEAD" && (hasBody || method === "POST" || method === "PUT" || method === "PATCH")
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init && init.headers),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new JiraRestError(res.status, text);
    }
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  return {
    getMyself: () => jiraFetch(`${API_V3}/myself`),
    getIssue: (issueKey, fieldsParam) => {
      const q =
        fieldsParam != null
          ? `?${new URLSearchParams({ fields: fieldsParam }).toString()}`
          : "";
      return jiraFetch(`${API_V3}/issue/${encodeURIComponent(issueKey)}${q}`);
    },
    /** @param {Record<string, unknown>} body — e.g. `{ fields: { summary: "..." } }` */
    updateIssue: (issueKey, body) =>
      jiraFetch(`${API_V3}/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    /** @param {Record<string, unknown>} body — Jira create issue payload */
    createIssue: (body) =>
      jiraFetch(`${API_V3}/issue`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    /** @param {string} jql */
    search: (jql, maxResults = 50) => {
      const q = new URLSearchParams({
        jql,
        maxResults: String(maxResults),
      });
      return jiraFetch(`${API_V3}/search?${q.toString()}`);
    },
  };
}

function parseJiraCloudConfig(raw) {
  return jiraCloudConnectionConfigSchema.safeParse(raw);
}

module.exports = {
  createJiraCloudRestClient,
  JiraRestError,
  parseJiraCloudConfig,
};
