const { config } = require("dotenv");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const cors = require("cors");
const express = require("express");
const { z } = require("zod");
const cuid = require("cuid");
const {
  initPostgres,
  getIntegrationModels,
  getIntegrationSequelize,
} = require("@roadmap/shared-postgres");
const { fetchDefaultWorkspaceId } = require("./portfolioClient.js");
const { requireInternalKey } = require("./internalAuth.js");
const {
  createJiraCloudRestClient,
  JiraRestError,
  parseJiraCloudConfig,
} = require("./jira-cloud-rest.js");

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

/** Keep in sync with @roadmap/types jiraConnectSchema / jiraCloudConnectionConfigSchema */
const jiraConnectSchema = z.object({
  connectionName: z.string().min(1),
  config: z.object({
    siteUrl: z.string().url(),
    email: z.string().email(),
    apiToken: z.string().min(1),
  }),
});

const opaqueConnectSchema = z.object({
  connectionName: z.string().min(1),
  config: z.record(z.unknown()),
});

/** Jira config in request body — used for stateless routes; credentials are not persisted. */
const jiraConfigInBody = z.object({
  siteUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await getIntegrationSequelize().query("SELECT 1");
    res.json({ ok: true, service: "integration-service" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/integrations", async (req, res) => {
  const { IntegrationConnection } = getIntegrationModels();
  let workspaceId =
    typeof req.query.workspaceId === "string" && req.query.workspaceId.length > 0
      ? req.query.workspaceId
      : "";
  if (!workspaceId) {
    try {
      workspaceId = await fetchDefaultWorkspaceId();
    } catch (e) {
      return res.status(503).json({
        message: "Could not resolve default workspace",
        error: String(e),
      });
    }
  }
  const rows = await IntegrationConnection.findAll({
    where: { workspaceId },
    order: [["connectionName", "ASC"]],
  });
  res.json(rows.map((r) => r.toJSON()));
});

/**
 * Per-user Jira (device): caller sends API token + email on each request; integration-service
 * does not store them. Jira attributes reads/writes to the Atlassian account that owns the token.
 */
app.post("/integrations/jira/stateless/me", async (req, res) => {
  const parsed = z.object({ config: jiraConfigInBody }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const cfg = parseJiraCloudConfig(parsed.data.config);
  if (!cfg.success) {
    return res.status(400).json({ message: "Invalid Jira Cloud config", issues: cfg.error.flatten() });
  }
  try {
    const client = createJiraCloudRestClient(cfg.data);
    const myself = await client.getMyself();
    return res.json({
      accountId: myself.accountId,
      displayName: myself.displayName ?? null,
      emailAddress: myself.emailAddress ?? null,
    });
  } catch (e) {
    if (e instanceof JiraRestError) {
      return res.status(502).json({ message: "Jira Cloud REST request failed", status: e.status });
    }
    throw e;
  }
});

app.post("/integrations/jira/stateless/issue/get", async (req, res) => {
  const parsed = z
    .object({
      config: jiraConfigInBody,
      issueKey: z.string().min(1),
      fields: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const cfg = parseJiraCloudConfig(parsed.data.config);
  if (!cfg.success) {
    return res.status(400).json({ message: "Invalid Jira Cloud config", issues: cfg.error.flatten() });
  }
  try {
    const client = createJiraCloudRestClient(cfg.data);
    const issue = await client.getIssue(parsed.data.issueKey, parsed.data.fields);
    return res.json(issue);
  } catch (e) {
    if (e instanceof JiraRestError) {
      return res.status(502).json({ message: "Jira Cloud REST request failed", status: e.status });
    }
    throw e;
  }
});

app.put("/integrations/jira/stateless/issue", async (req, res) => {
  const parsed = z
    .object({
      config: jiraConfigInBody,
      issueKey: z.string().min(1),
      /** Jira PUT /issue body, e.g. `{ fields: { summary: "..." } }` */
      payload: z.record(z.unknown()),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const cfg = parseJiraCloudConfig(parsed.data.config);
  if (!cfg.success) {
    return res.status(400).json({ message: "Invalid Jira Cloud config", issues: cfg.error.flatten() });
  }
  try {
    const client = createJiraCloudRestClient(cfg.data);
    await client.updateIssue(parsed.data.issueKey, parsed.data.payload);
    return res.json({ ok: true, issueKey: parsed.data.issueKey });
  } catch (e) {
    if (e instanceof JiraRestError) {
      return res.status(502).json({ message: "Jira Cloud REST request failed", status: e.status });
    }
    throw e;
  }
});

app.post("/integrations/jira/stateless/issue/create", async (req, res) => {
  const parsed = z
    .object({
      config: jiraConfigInBody,
      /** Full Jira create issue JSON (`fields` required by Jira). */
      body: z.record(z.unknown()),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const cfg = parseJiraCloudConfig(parsed.data.config);
  if (!cfg.success) {
    return res.status(400).json({ message: "Invalid Jira Cloud config", issues: cfg.error.flatten() });
  }
  try {
    const client = createJiraCloudRestClient(cfg.data);
    const created = await client.createIssue(parsed.data.body);
    return res.status(201).json(created);
  } catch (e) {
    if (e instanceof JiraRestError) {
      return res.status(502).json({ message: "Jira Cloud REST request failed", status: e.status });
    }
    throw e;
  }
});

app.post("/integrations/jira/stateless/search", async (req, res) => {
  const parsed = z
    .object({
      config: jiraConfigInBody,
      jql: z.string().min(1),
      maxResults: z.number().int().min(1).max(100).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const cfg = parseJiraCloudConfig(parsed.data.config);
  if (!cfg.success) {
    return res.status(400).json({ message: "Invalid Jira Cloud config", issues: cfg.error.flatten() });
  }
  try {
    const client = createJiraCloudRestClient(cfg.data);
    const result = await client.search(parsed.data.jql, parsed.data.maxResults ?? 50);
    return res.json(result);
  } catch (e) {
    if (e instanceof JiraRestError) {
      return res.status(502).json({ message: "Jira Cloud REST request failed", status: e.status });
    }
    throw e;
  }
});

app.post("/integrations/jira/connect", async (req, res) => {
  const parsed = jiraConnectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  let workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : "";
  if (!workspaceId) {
    try {
      workspaceId = await fetchDefaultWorkspaceId();
    } catch (e) {
      return res.status(503).json({
        message: "Could not resolve default workspace (portfolio up + INTERNAL_API_KEY?)",
        error: String(e),
      });
    }
  }
  const { IntegrationConnection } = getIntegrationModels();
  const row = await IntegrationConnection.create({
    id: cuid(),
    workspaceId,
    provider: "jira",
    connectionName: parsed.data.connectionName,
    configEncrypted: JSON.stringify(parsed.data.config),
    status: "connected",
  });
  res.status(201).json(row.toJSON());
});

app.post("/integrations/cursor/connect", async (req, res) => {
  const parsed = opaqueConnectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  let workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : "";
  if (!workspaceId) {
    try {
      workspaceId = await fetchDefaultWorkspaceId();
    } catch (e) {
      return res.status(503).json({
        message: "Could not resolve default workspace (portfolio up + INTERNAL_API_KEY?)",
        error: String(e),
      });
    }
  }
  const { IntegrationConnection } = getIntegrationModels();
  const row = await IntegrationConnection.create({
    id: cuid(),
    workspaceId,
    provider: "cursor",
    connectionName: parsed.data.connectionName,
    configEncrypted: JSON.stringify(parsed.data.config),
    status: "connected",
  });
  res.status(201).json(row.toJSON());
});

app.post("/integrations/confluence/connect", async (req, res) => {
  const parsed = opaqueConnectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  let workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : "";
  if (!workspaceId) {
    try {
      workspaceId = await fetchDefaultWorkspaceId();
    } catch (e) {
      return res.status(503).json({
        message: "Could not resolve default workspace",
        error: String(e),
      });
    }
  }
  const { IntegrationConnection } = getIntegrationModels();
  const row = await IntegrationConnection.create({
    id: cuid(),
    workspaceId,
    provider: "confluence",
    connectionName: parsed.data.connectionName,
    configEncrypted: JSON.stringify(parsed.data.config),
    status: "connected",
  });
  res.status(201).json(row.toJSON());
});

app.post("/integrations/:id/sync", async (req, res) => {
  const { IntegrationConnection } = getIntegrationModels();
  const conn = await IntegrationConnection.findByPk(req.params.id);
  if (!conn) return res.status(404).json({ message: "Not found" });

  if (conn.provider === "jira") {
    let stored;
    try {
      stored = JSON.parse(conn.configEncrypted);
    } catch {
      return res.status(400).json({ message: "Stored Jira config is not valid JSON" });
    }
    const parsed = parseJiraCloudConfig(stored);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid Jira Cloud config",
        issues: parsed.error.flatten(),
      });
    }
    try {
      const client = createJiraCloudRestClient(parsed.data);
      const myself = await client.getMyself();
      await conn.update({ lastSyncAt: new Date(), status: "synced" });
      await conn.reload();
      return res.json({
        ok: true,
        connectionId: conn.id,
        lastSyncAt: conn.lastSyncAt,
        jira: {
          accountId: myself.accountId,
          displayName: myself.displayName ?? null,
          emailAddress: myself.emailAddress ?? null,
        },
      });
    } catch (e) {
      if (e instanceof JiraRestError) {
        return res.status(502).json({
          message: "Jira Cloud REST request failed",
          status: e.status,
        });
      }
      throw e;
    }
  }

  await conn.update({
    lastSyncAt: new Date(),
    status: "synced",
  });
  await conn.reload();
  res.json({
    ok: true,
    connectionId: conn.id,
    lastSyncAt: conn.lastSyncAt,
    message: "Sync recorded (stub — extend with provider APIs + worker)",
  });
});

app.get("/external-links", async (req, res) => {
  const { ExternalLink } = getIntegrationModels();
  let workspaceId =
    typeof req.query.workspaceId === "string" && req.query.workspaceId.length > 0
      ? req.query.workspaceId
      : "";
  if (!workspaceId) {
    try {
      workspaceId = await fetchDefaultWorkspaceId();
    } catch (e) {
      return res.status(503).json({
        message: "Could not resolve default workspace",
        error: String(e),
      });
    }
  }
  const rows = await ExternalLink.findAll({
    where: { workspaceId },
    order: [["provider", "ASC"]],
  });
  res.json(rows.map((r) => r.toJSON()));
});

app.post("/internal/external-links", requireInternalKey, async (req, res) => {
  const b = req.body;
  if (
    !b.workspaceId ||
    !b.entityType ||
    !b.entityId ||
    !b.provider ||
    !b.externalId
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  const { ExternalLink } = getIntegrationModels();
  const row = await ExternalLink.create({
    id: cuid(),
    workspaceId: b.workspaceId,
    entityType: b.entityType,
    entityId: b.entityId,
    provider: b.provider,
    externalId: b.externalId,
    externalUrl: b.externalUrl || "",
    syncState: b.syncState || "linked",
    metadataJson: b.metadataJson ?? null,
  });
  res.status(201).json(row.toJSON());
});

app.delete(
  "/internal/workspaces/:workspaceId/external-links",
  requireInternalKey,
  async (req, res) => {
    const { ExternalLink } = getIntegrationModels();
    const ws = String(req.params.workspaceId);
    const r = await ExternalLink.destroy({ where: { workspaceId: ws } });
    res.json({ deleted: r });
  }
);

app.get("/", (_req, res) =>
  res.json({
    service: "integration-service",
    db: "Postgres integration schema via Sequelize (@roadmap/shared-postgres)",
  })
);

const port = Number(process.env.PORT || 4410);

initPostgres()
  .then(() => {
    app.listen(port, () => console.log(`integration-service listening on ${port}`));
  })
  .catch((err) => {
    console.error("Failed to init database:", err);
    process.exit(1);
  });
