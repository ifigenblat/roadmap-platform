import { Router } from "express";
import {
  createPhaseDefinitionSchema,
  patchPhaseDefinitionSchema,
} from "@roadmap/types";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import { workspaceIdFromQuery } from "../workspace-guards.js";

export const phaseDefinitionsRouter = Router();

phaseDefinitionsRouter.get("/phase-definitions", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  if (!ws) {
    return res.status(400).json({ message: "workspaceId query parameter is required" });
  }
  const rows = await prisma.phaseDefinition.findMany({
    where: { workspaceId: ws },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json(rows);
});

phaseDefinitionsRouter.post("/phase-definitions", async (req, res) => {
  const parsed = createPhaseDefinitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  const { name, sortOrder } = parsed.data;
  try {
    const row = await prisma.phaseDefinition.create({
      data: {
        workspaceId,
        name: name.trim(),
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return res.status(409).json({ message: `A phase named "${name.trim()}" already exists in this workspace.` });
    }
    throw e;
  }
});

phaseDefinitionsRouter.patch("/phase-definitions/:id", async (req, res) => {
  const parsed = patchPhaseDefinitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.phaseDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  const data: { name?: string; sortOrder?: number } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.phaseDefinition.update({
        where: { id: req.params.id },
        data,
      });
      if (data.name !== undefined) {
        await tx.phaseSegment.updateMany({
          where: { phaseDefinitionId: row.id },
          data: { phaseName: data.name },
        });
      }
      return row;
    });
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return res.status(409).json({ message: "That phase name already exists in this workspace." });
    }
    throw e;
  }
});

phaseDefinitionsRouter.delete("/phase-definitions/:id", async (req, res) => {
  const id = req.params.id;
  const n = await prisma.phaseSegment.count({ where: { phaseDefinitionId: id } });
  if (n > 0) {
    return res.status(409).json({
      message: "This phase is used on roadmap items; reassign those segments first or remove them.",
      phaseSegmentCount: n,
    });
  }
  const existing = await prisma.phaseDefinition.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await prisma.phaseDefinition.delete({ where: { id } });
  res.status(204).send();
});
