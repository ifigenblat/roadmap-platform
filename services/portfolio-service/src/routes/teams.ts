import { Router } from "express";
import { createTeamSchema, patchTeamSchema } from "@roadmap/types";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import { workspaceIdFromQuery } from "../workspace-guards.js";

export const teamsRouter = Router();

teamsRouter.get("/teams", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  res.json(
    await prisma.team.findMany({
      where: ws ? { workspaceId: ws } : undefined,
      orderBy: { name: "asc" },
    })
  );
});

teamsRouter.post("/teams", async (req, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  res.status(201).json(
    await prisma.team.create({
      data: { ...parsed.data, workspaceId },
    })
  );
});

teamsRouter.get("/teams/:id", async (req, res) => {
  const row = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: {
      roadmapItems: {
        include: {
          roadmapItem: {
            include: { roadmap: true, initiative: true },
          },
        },
      },
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

teamsRouter.patch("/teams/:id", async (req, res) => {
  const parsed = patchTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  res.json(
    await prisma.team.update({
      where: { id: req.params.id },
      data: parsed.data,
    })
  );
});

teamsRouter.delete("/teams/:id", async (req, res) => {
  const linkCount = await prisma.roadmapItemTeam.count({
    where: { teamId: req.params.id },
  });
  if (linkCount > 0) {
    return res.status(409).json({
      message: "Team is assigned to roadmap items; remove assignments first.",
      roadmapItemTeamCount: linkCount,
    });
  }
  const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await prisma.team.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
