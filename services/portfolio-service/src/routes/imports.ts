import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import { getImportQueue } from "../importQueue.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const importsRouter = Router();

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

importsRouter.post("/imports/workbook", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ message: "multipart field 'file' is required" });
  }
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();

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
      },
    },
  });

  const queue = getImportQueue();
  if (queue) {
    try {
      await withTimeout(
        queue.add(
          "process",
          { importBatchId: batch.id, filePath },
          { removeOnComplete: 100, removeOnFail: 50 }
        ),
        3000
      );
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: "queued" },
      });
    } catch (error) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "received",
          summaryJson: {
            size: file.size,
            mimeType: file.mimetype,
            receivedAt: new Date().toISOString(),
            filePath,
            queueError: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }

  const updated = await prisma.importBatch.findUnique({ where: { id: batch.id } });

  res.status(202).json({
    importId: batch.id,
    status: updated?.status ?? batch.status,
    sourceFileName: batch.sourceFileName,
    queued: Boolean(queue),
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
