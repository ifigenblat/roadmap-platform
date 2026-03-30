import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import {
  deleteImportBatchAndCreatedData,
  getImportBatchDeleteImpact,
} from "../importBatchDelete.js";
import { processWorkbookImport } from "../workbook-import.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const importsRouter = Router();

importsRouter.post("/imports/workbook", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ message: "multipart field 'file' is required" });
  }
  const requestedWorkspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  const requestedRoadmapId =
    typeof req.body.roadmapId === "string" && req.body.roadmapId.trim().length > 0
      ? req.body.roadmapId.trim()
      : "";
  const requestedRoadmapName =
    typeof req.body.roadmapName === "string" && req.body.roadmapName.trim().length > 0
      ? req.body.roadmapName.trim()
      : "";
  if (!requestedRoadmapId && !requestedRoadmapName) {
    return res.status(400).json({
      message: "Provide roadmapId to import into an existing roadmap, or roadmapName to create one.",
    });
  }
  if (requestedRoadmapId && requestedRoadmapName) {
    return res
      .status(400)
      .json({ message: "Provide only one of roadmapId or roadmapName, not both." });
  }

  let workspaceId = requestedWorkspaceId;
  if (requestedRoadmapId) {
    const existingRoadmap = await prisma.roadmap.findUnique({
      where: { id: requestedRoadmapId },
      select: { id: true, workspaceId: true, name: true },
    });
    if (!existingRoadmap) {
      return res.status(404).json({ message: "Selected roadmap not found." });
    }
    if (requestedWorkspaceId && existingRoadmap.workspaceId !== requestedWorkspaceId) {
      return res.status(400).json({
        message: "Selected roadmap belongs to a different workspace than workspaceId.",
      });
    }
    workspaceId = existingRoadmap.workspaceId;
  }

  const batch = await prisma.importBatch.create({
    data: {
      workspaceId,
      sourceFileName: file.originalname || "workbook",
      importerType: "workbook-upload",
      status: "received",
      summaryJson: {
        size: file.size,
        mimeType: file.mimetype,
        receivedAt: new Date().toISOString(),
        targetRoadmapId: requestedRoadmapId || null,
        targetRoadmapName: requestedRoadmapName || null,
      },
    },
  });

  const dir = join(tmpdir(), "roadmap-imports");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${batch.id}-${randomUUID()}.xlsx`);
  await writeFile(filePath, file.buffer);

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      summaryJson: {
        size: file.size,
        mimeType: file.mimetype,
        receivedAt: new Date().toISOString(),
        filePath,
        targetRoadmapId: requestedRoadmapId || null,
        targetRoadmapName: requestedRoadmapName || null,
      },
    },
  });

  let processError: string | undefined;
  try {
    await processWorkbookImport(prisma, batch.id, filePath, {
      roadmapId: requestedRoadmapId || undefined,
      roadmapName: requestedRoadmapName || undefined,
    });
  } catch (error) {
    processError = error instanceof Error ? error.message : String(error);
    const prev = await prisma.importBatch.findUnique({
      where: { id: batch.id },
      select: { summaryJson: true },
    });
    const prevObj =
      typeof prev?.summaryJson === "object" && prev.summaryJson !== null
        ? (prev.summaryJson as Record<string, unknown>)
        : {};
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        summaryJson: {
          ...prevObj,
          error: processError,
        },
      },
    });
  }

  const updated = await prisma.importBatch.findUnique({ where: { id: batch.id } });
  const summary =
    typeof updated?.summaryJson === "object" && updated.summaryJson !== null
      ? (updated.summaryJson as Record<string, unknown>)
      : {};

  const imported = typeof summary.imported === "number" ? summary.imported : undefined;
  const skipped = typeof summary.skipped === "number" ? summary.skipped : undefined;
  const failed = typeof summary.failed === "number" ? summary.failed : undefined;
  const roadmapId =
    (typeof summary.createdRoadmapId === "string" ? summary.createdRoadmapId : null) ??
    updated?.roadmapId ??
    null;

  const status = updated?.status ?? batch.status;
  const httpStatus = status === "failed" ? 422 : 200;

  res.status(httpStatus).json({
    importId: batch.id,
    status,
    sourceFileName: batch.sourceFileName,
    roadmapId,
    imported,
    skipped,
    failed,
    error: processError ?? (typeof summary.error === "string" ? summary.error : undefined),
  });
});

importsRouter.get("/imports", async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 25);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 25;
  const rows = await prisma.importBatch.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      roadmap: {
        select: { id: true, name: true, status: true },
      },
      _count: {
        select: { rowResults: true },
      },
    },
  });
  res.json(rows);
});

importsRouter.get("/imports/:id/delete-impact", async (req, res) => {
  const impact = await getImportBatchDeleteImpact(prisma, req.params.id);
  if (!impact) return res.status(404).json({ message: "Not found" });
  res.json(impact);
});

importsRouter.get("/imports/:id", async (req, res) => {
  const batch = await prisma.importBatch.findUnique({
    where: { id: req.params.id },
    include: {
      rowResults: { orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }] },
      roadmap: true,
    },
  });
  if (!batch) return res.status(404).json({ message: "Not found" });
  res.json(batch);
});

importsRouter.get("/imports/:id/errors", async (req, res) => {
  const batch = await prisma.importBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ message: "Not found" });
  const errors = await prisma.importRowResult.findMany({
    where: {
      importBatchId: req.params.id,
      NOT: { status: "imported" },
    },
    orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }],
  });
  res.json({ importId: req.params.id, count: errors.length, rows: errors });
});

importsRouter.delete("/imports/:id", async (req, res) => {
  try {
    const result = await deleteImportBatchAndCreatedData(prisma, req.params.id);
    if (!result) return res.status(404).json({ message: "Import batch not found" });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
