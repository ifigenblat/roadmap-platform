import { Router } from "express";
import {
  createPhaseSegmentBodySchema,
  moveRoadmapItemSchema,
  createRoadmapItemSchema,
  patchRoadmapItemSchema,
  patchPhaseSegmentSchema,
  replaceRoadmapItemTeamsSchema,
} from "@roadmap/types";
import { prisma } from "../db.js";
import {
  assertEndAfterStart,
  assertRoadmapInitiativeSameWorkspace,
} from "../workspace-guards.js";

export const roadmapItemsRouter = Router();

roadmapItemsRouter.get("/roadmap-items/:id", async (req, res) => {
  const row = await prisma.roadmapItem.findUnique({
    where: { id: req.params.id },
    include: {
      initiative: true,
      roadmap: true,
      phases: true,
      teams: { include: { team: true } },
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

roadmapItemsRouter.put("/roadmap-items/:id/teams", async (req, res) => {
  const id = String(req.params.id);
  const parsed = replaceRoadmapItemTeamsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.roadmapItem.findUnique({
    where: { id },
    include: { roadmap: true },
  });
  if (!item) return res.status(404).json({ message: "Not found" });
  const wsId = item.roadmap.workspaceId;
  const teamIds = [...new Set(parsed.data.teamIds)];
  for (const teamId of teamIds) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.workspaceId !== wsId) {
      return res.status(400).json({ message: `Invalid team id: ${teamId}` });
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.roadmapItemTeam.deleteMany({ where: { roadmapItemId: id } });
    for (const teamId of teamIds) {
      await tx.roadmapItemTeam.create({
        data: { roadmapItemId: id, teamId },
      });
    }
  });
  const full = await prisma.roadmapItem.findUnique({
    where: { id },
    include: { teams: { include: { team: true } } },
  });
  res.json(full);
});

roadmapItemsRouter.patch("/roadmap-items/:id", async (req, res) => {
  const parsed = patchRoadmapItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.roadmapItem.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  const { startDate, endDate, initiativeId, ...rest } = parsed.data;
  if (initiativeId !== undefined) {
    const guard = await assertRoadmapInitiativeSameWorkspace(existing.roadmapId, initiativeId);
    if (!guard.ok) return res.status(guard.status).json({ message: guard.message });
  }
  const startStr =
    startDate !== undefined ? startDate : existing.startDate.toISOString();
  const endStr = endDate !== undefined ? endDate : existing.endDate.toISOString();
  if (!assertEndAfterStart(startStr, endStr)) {
    return res.status(400).json({ message: "endDate must be on or after startDate" });
  }
  const data: Record<string, unknown> = { ...rest };
  if (initiativeId !== undefined) data.initiativeId = initiativeId;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  const updated = await prisma.roadmapItem.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

roadmapItemsRouter.post("/roadmap-items/:id/move", async (req, res) => {
  const parsed = moveRoadmapItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.roadmapItem.findUnique({
    where: { id: req.params.id },
    include: { roadmap: true },
  });
  if (!item) return res.status(404).json({ message: "Not found" });
  if (parsed.data.roadmapId) {
    const target = await prisma.roadmap.findUnique({
      where: { id: parsed.data.roadmapId },
    });
    if (!target || target.workspaceId !== item.roadmap.workspaceId) {
      return res.status(400).json({ message: "Invalid target roadmap" });
    }
  }
  const updated = await prisma.roadmapItem.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.roadmapId !== undefined && { roadmapId: parsed.data.roadmapId }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
      ...(parsed.data.laneKey !== undefined && { laneKey: parsed.data.laneKey }),
    },
  });
  res.json(updated);
});

roadmapItemsRouter.post("/roadmap-items/:id/phases", async (req, res) => {
  const parsed = createPhaseSegmentBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.roadmapItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ message: "Not found" });
  const { startDate, endDate, ...rest } = parsed.data;
  const phase = await prisma.phaseSegment.create({
    data: {
      ...rest,
      roadmapItemId: item.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
  res.status(201).json(phase);
});

roadmapItemsRouter.patch("/phase-segments/:id", async (req, res) => {
  const id = String(req.params.id);
  const parsed = patchPhaseSegmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.phaseSegment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  const d = parsed.data;
  const nextStart = d.startDate !== undefined ? d.startDate : existing.startDate.toISOString();
  const nextEnd = d.endDate !== undefined ? d.endDate : existing.endDate.toISOString();
  if (!assertEndAfterStart(nextStart, nextEnd)) {
    return res.status(400).json({ message: "endDate must be on or after startDate" });
  }
  const data: Record<string, unknown> = {};
  if (d.phaseName !== undefined) data.phaseName = d.phaseName;
  if (d.startDate !== undefined) data.startDate = new Date(d.startDate);
  if (d.endDate !== undefined) data.endDate = new Date(d.endDate);
  if (d.capacityAllocationEstimate !== undefined) {
    data.capacityAllocationEstimate = d.capacityAllocationEstimate;
  }
  if (d.sprintEstimate !== undefined) data.sprintEstimate = d.sprintEstimate;
  if (d.teamSummary !== undefined) data.teamSummary = d.teamSummary;
  if (d.status !== undefined) data.status = d.status;
  if (d.jiraKey !== undefined) data.jiraKey = d.jiraKey;
  if (d.notes !== undefined) data.notes = d.notes;
  const updated = await prisma.phaseSegment.update({
    where: { id },
    data,
  });
  res.json(updated);
});

/** Legacy: list all items (not in public API contract). */
roadmapItemsRouter.get("/roadmap-items", async (_req, res) => {
  const rows = await prisma.roadmapItem.findMany({
    include: { initiative: true, roadmap: true, phases: true },
  });
  res.json(rows);
});

roadmapItemsRouter.post("/roadmap-items", async (req, res) => {
  const parsed = createRoadmapItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  if (!assertEndAfterStart(parsed.data.startDate, parsed.data.endDate)) {
    return res.status(400).json({ message: "endDate must be on or after startDate" });
  }
  const guard = await assertRoadmapInitiativeSameWorkspace(
    parsed.data.roadmapId,
    parsed.data.initiativeId
  );
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });
  const { startDate, endDate, ...rest } = parsed.data;
  res.status(201).json(
    await prisma.roadmapItem.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    })
  );
});
