import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import type { Prisma } from "./generated/prisma/index.js";
import {
  createRoadmapFromTemplateSchema,
  createTemplateSchema,
} from "@roadmap/types";
import { prisma } from "./db.js";
import { createRoadmapInPortfolio, fetchDefaultWorkspaceId } from "./portfolioClient.js";
import { requireInternalKey } from "./internalAuth.js";

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
    res.json({ ok: true, service: "template-service" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/templates", async (req, res) => {
  const ws =
    typeof req.query.workspaceId === "string" && req.query.workspaceId.length > 0
      ? req.query.workspaceId
      : undefined;
  const rows = await prisma.template.findMany({
    where: ws ? { workspaceId: ws } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(rows);
});

app.post("/templates", async (req, res) => {
  const parsed = createTemplateSchema.safeParse(req.body);
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
        message: "Could not resolve default workspace (is portfolio-service up?)",
        error: String(e),
      });
    }
  }
  const row = await prisma.template.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      configJson: parsed.data.configJson as Prisma.InputJsonValue | undefined,
      workspaceId,
    },
  });
  res.status(201).json(row);
});

app.get("/templates/:id", async (req, res) => {
  const row = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

app.delete(
  "/internal/workspaces/:workspaceId/templates",
  requireInternalKey,
  async (req, res) => {
    const ws = String(req.params.workspaceId);
    const r = await prisma.template.deleteMany({
      where: { workspaceId: ws },
    });
    res.json({ deleted: r.count });
  }
);

app.post("/templates/:id/create-roadmap", async (req, res) => {
  const parsed = createRoadmapFromTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const template = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ message: "Template not found" });
  const { startDate, endDate, status, ...rest } = parsed.data;
  try {
    const roadmap = await createRoadmapInPortfolio({
      ...rest,
      workspaceId: template.workspaceId,
      templateId: template.id,
      startDate,
      endDate,
      status: status ?? "draft",
    });
    res.status(201).json(roadmap);
  } catch (e) {
    res.status(502).json({ message: String(e) });
  }
});

const port = Number(process.env.PORT || 4210);
app.listen(port, () => console.log(`template-service listening on ${port}`));
