import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import type { Prisma } from "./generated/prisma/index.js";
import {
  confluenceConnectSchema,
  jiraConnectSchema,
} from "@roadmap/types";
import { prisma } from "./db.js";
import { requireInternalKey } from "./internalAuth.js";
import { fetchDefaultWorkspaceId } from "./portfolioClient.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "integration-service" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/integrations", async (req, res) => {
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
  const rows = await prisma.integrationConnection.findMany({
    where: { workspaceId },
    orderBy: { connectionName: "asc" },
  });
  res.json(rows);
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
  const row = await prisma.integrationConnection.create({
    data: {
      workspaceId,
      provider: "jira",
      connectionName: parsed.data.connectionName,
      configEncrypted: JSON.stringify(parsed.data.config),
      status: "connected",
    },
  });
  res.status(201).json(row);
});

app.post("/integrations/confluence/connect", async (req, res) => {
  const parsed = confluenceConnectSchema.safeParse(req.body);
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
  const row = await prisma.integrationConnection.create({
    data: {
      workspaceId,
      provider: "confluence",
      connectionName: parsed.data.connectionName,
      configEncrypted: JSON.stringify(parsed.data.config),
      status: "connected",
    },
  });
  res.status(201).json(row);
});

app.post("/integrations/:id/sync", async (req, res) => {
  const conn = await prisma.integrationConnection.findUnique({
    where: { id: req.params.id },
  });
  if (!conn) return res.status(404).json({ message: "Not found" });
  const updated = await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: {
      lastSyncAt: new Date(),
      status: "synced",
    },
  });
  res.json({
    ok: true,
    connectionId: updated.id,
    lastSyncAt: updated.lastSyncAt,
    message: "Sync recorded (stub — extend with provider APIs + worker)",
  });
});

app.get("/external-links", async (req, res) => {
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
  const rows = await prisma.externalLink.findMany({
    where: { workspaceId },
    orderBy: { provider: "asc" },
  });
  res.json(rows);
});

/* ——— Internal (portfolio import script, worker, seed) ——— */

app.post(
  "/internal/external-links",
  requireInternalKey,
  async (req, res) => {
    const b = req.body as {
      workspaceId: string;
      entityType: string;
      entityId: string;
      provider: string;
      externalId: string;
      externalUrl: string;
      syncState: string;
      metadataJson?: unknown;
    };
    if (
      !b.workspaceId ||
      !b.entityType ||
      !b.entityId ||
      !b.provider ||
      !b.externalId
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const row = await prisma.externalLink.create({
      data: {
        workspaceId: b.workspaceId,
        entityType: b.entityType,
        entityId: b.entityId,
        provider: b.provider,
        externalId: b.externalId,
        externalUrl: b.externalUrl || "",
        syncState: b.syncState || "linked",
        metadataJson: b.metadataJson as Prisma.InputJsonValue | undefined,
      },
    });
    res.status(201).json(row);
  }
);

app.delete(
  "/internal/workspaces/:workspaceId/external-links",
  requireInternalKey,
  async (req, res) => {
    const ws = String(req.params.workspaceId);
    const r = await prisma.externalLink.deleteMany({
      where: { workspaceId: ws },
    });
    res.json({ deleted: r.count });
  }
);

app.get("/", (_req, res) =>
  res.json({
    service: "integration-service",
    db: "Postgres (svc_integration_* tables via Prisma)",
  })
);

const port = Number(process.env.PORT || 4400);
app.listen(port, () => console.log(`integration-service listening on ${port}`));
