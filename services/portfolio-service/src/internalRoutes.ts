import { Router } from "express";
import { requireInternalKey } from "./internalAuth.js";
import { getDefaultWorkspaceId, prisma } from "./db.js";
import { processWorkbookImport } from "./workbook-import.js";

export const internalRouter = Router();

internalRouter.get(
  "/internal/default-workspace-id",
  requireInternalKey,
  async (_req, res) => {
    const id = await getDefaultWorkspaceId();
    res.json({ id });
  }
);

/** Worker callback after handling an import job (stub completion). */
internalRouter.post(
  "/internal/imports/:id/process-workbook",
  requireInternalKey,
  async (req, res) => {
    const id = String(req.params.id);
    const batch = await prisma.importBatch.findUnique({ where: { id } });
    if (!batch) return res.status(404).json({ message: "Not found" });
    const summary =
      typeof batch.summaryJson === "object" && batch.summaryJson !== null
        ? (batch.summaryJson as Record<string, unknown>)
        : {};
    const body = req.body as { filePath?: string } | undefined;
    const bodyFilePath = typeof body?.filePath === "string" ? body.filePath : "";
    const filePath =
      bodyFilePath.length > 0
        ? bodyFilePath
        : typeof summary.filePath === "string"
          ? summary.filePath
          : "";
    if (!filePath) {
      return res.status(400).json({ message: "Missing filePath in body or summaryJson.filePath" });
    }
    try {
      const result = await processWorkbookImport(prisma, id, filePath);
      return res.json({ ok: true, importBatchId: id, ...result });
    } catch (error) {
      await prisma.importBatch.update({
        where: { id },
        data: {
          status: "failed",
          completedAt: new Date(),
          summaryJson: {
            ...summary,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
      return res.status(500).json({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

internalRouter.post(
  "/internal/imports/:id/worker-complete",
  requireInternalKey,
  async (req, res) => {
    const id = String(req.params.id);
    const batch = await prisma.importBatch.findUnique({
      where: { id },
    });
    if (!batch) return res.status(404).json({ message: "Not found" });
    const note =
      (req.body as { message?: string })?.message ||
      "Worker acknowledged import batch";
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "worker_processed",
        completedAt: new Date(),
        summaryJson: {
          ...(typeof batch.summaryJson === "object" && batch.summaryJson !== null
            ? (batch.summaryJson as object)
            : {}),
          workerNote: note,
        },
      },
    });
    res.json({ ok: true, importBatchId: batch.id });
  }
);
