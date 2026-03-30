import { Router } from "express";
import { createStrategicThemeSchema, patchStrategicThemeSchema } from "@roadmap/types";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import { assertThemeRoadmapWorkspace, workspaceIdFromQuery } from "../workspace-guards.js";

export const themesRouter = Router();

themesRouter.get("/themes", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  res.json(
    await prisma.strategicTheme.findMany({
      where: ws ? { workspaceId: ws } : undefined,
      orderBy: { orderIndex: "asc" },
      include: {
        roadmap: { select: { id: true, name: true, planningYear: true } },
      },
    })
  );
});

themesRouter.post("/themes", async (req, res) => {
  const parsed = createStrategicThemeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  const { orderIndex, roadmapId, ...themeRest } = parsed.data;
  const roadmapCheck = await assertThemeRoadmapWorkspace(workspaceId, roadmapId ?? null);
  if (!roadmapCheck.ok) return res.status(roadmapCheck.status).json({ message: roadmapCheck.message });
  const created = await prisma.strategicTheme.create({
    data: {
      ...themeRest,
      orderIndex: orderIndex ?? 0,
      workspaceId,
      roadmapId: roadmapId ?? null,
    },
    include: {
      roadmap: { select: { id: true, name: true, planningYear: true } },
    },
  });
  res.status(201).json(created);
});

themesRouter.get("/themes/:id", async (req, res) => {
  const row = await prisma.strategicTheme.findUnique({
    where: { id: req.params.id },
    include: {
      roadmap: { select: { id: true, name: true, planningYear: true } },
      initiatives: {
        include: { initiative: true },
      },
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

themesRouter.patch("/themes/:id", async (req, res) => {
  const parsed = patchStrategicThemeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.strategicTheme.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  const nextRoadmapId =
    parsed.data.roadmapId !== undefined ? parsed.data.roadmapId : existing.roadmapId;
  const roadmapCheck = await assertThemeRoadmapWorkspace(existing.workspaceId, nextRoadmapId);
  if (!roadmapCheck.ok) return res.status(roadmapCheck.status).json({ message: roadmapCheck.message });
  const updated = await prisma.strategicTheme.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: {
      roadmap: { select: { id: true, name: true, planningYear: true } },
    },
  });
  res.json(updated);
});

themesRouter.delete("/themes/:id", async (req, res) => {
  const existing = await prisma.strategicTheme.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await prisma.initiativeTheme.deleteMany({ where: { strategicThemeId: req.params.id } });
  await prisma.strategicTheme.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
