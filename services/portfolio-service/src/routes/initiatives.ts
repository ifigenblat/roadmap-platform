import { Router } from "express";
import {
  createInitiativeSchema,
  linkInitiativeToThemeBodySchema,
  patchInitiativeSchema,
  replaceInitiativeThemeLinksSchema,
} from "@roadmap/types";
import { Prisma } from "../generated/prisma/index.js";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import {
  assertBusinessSponsorInWorkspace,
  workspaceIdFromQuery,
} from "../workspace-guards.js";

export const initiativesRouter = Router();

initiativesRouter.get("/initiatives", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  res.json(
    await prisma.initiative.findMany({
      where: ws ? { workspaceId: ws } : undefined,
      orderBy: { canonicalName: "asc" },
      include: {
        sponsor: true,
        themes: {
          include: {
            strategicTheme: { select: { id: true, name: true } },
          },
        },
      },
    })
  );
});

initiativesRouter.post("/initiatives", async (req, res) => {
  const parsed = createInitiativeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  if (parsed.data.businessSponsorId) {
    const g = await assertBusinessSponsorInWorkspace(parsed.data.businessSponsorId, workspaceId);
    if (!g.ok) return res.status(g.status).json({ message: g.message });
  }
  res.status(201).json(
    await prisma.initiative.create({
      data: { ...parsed.data, workspaceId },
      include: { sponsor: true },
    })
  );
});

initiativesRouter.get("/initiatives/:id", async (req, res) => {
  const row = await prisma.initiative.findUnique({
    where: { id: req.params.id },
    include: {
      sponsor: true,
      themes: { include: { strategicTheme: true } },
      roadmapItems: { include: { roadmap: true, phases: true } },
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

initiativesRouter.put("/initiatives/:id/theme-links", async (req, res) => {
  const id = String(req.params.id);
  const parsed = replaceInitiativeThemeLinksSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const initiative = await prisma.initiative.findUnique({ where: { id } });
  if (!initiative) return res.status(404).json({ message: "Not found" });
  const wsId = initiative.workspaceId;
  const strategicThemeIds = [...new Set(parsed.data.strategicThemeIds)];
  for (const themeId of strategicThemeIds) {
    const theme = await prisma.strategicTheme.findUnique({ where: { id: themeId } });
    if (!theme || theme.workspaceId !== wsId) {
      return res.status(400).json({ message: `Invalid theme id: ${themeId}` });
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.initiativeTheme.deleteMany({ where: { initiativeId: id } });
    for (const strategicThemeId of strategicThemeIds) {
      await tx.initiativeTheme.create({
        data: { initiativeId: id, strategicThemeId },
      });
    }
  });
  const full = await prisma.initiative.findUnique({
    where: { id },
    include: {
      themes: { include: { strategicTheme: { select: { id: true, name: true } } } },
    },
  });
  res.json(full);
});

initiativesRouter.patch("/initiatives/:id", async (req, res) => {
  const parsed = patchInitiativeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.initiative.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  if (parsed.data.businessSponsorId !== undefined && parsed.data.businessSponsorId !== null) {
    const g = await assertBusinessSponsorInWorkspace(
      parsed.data.businessSponsorId,
      existing.workspaceId
    );
    if (!g.ok) return res.status(g.status).json({ message: g.message });
  }
  const updated = await prisma.initiative.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { sponsor: true },
  });
  res.json(updated);
});

initiativesRouter.delete("/initiatives/:id", async (req, res) => {
  const itemCount = await prisma.roadmapItem.count({
    where: { initiativeId: req.params.id },
  });
  if (itemCount > 0) {
    return res.status(409).json({
      message: "Initiative has roadmap items; remove or reassign them first.",
      roadmapItemCount: itemCount,
    });
  }
  const existing = await prisma.initiative.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await prisma.initiativeTheme.deleteMany({ where: { initiativeId: req.params.id } });
  await prisma.initiative.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

initiativesRouter.post("/initiatives/:id/themes", async (req, res) => {
  const parsed = linkInitiativeToThemeBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const initiative = await prisma.initiative.findUnique({ where: { id: req.params.id } });
  if (!initiative) return res.status(404).json({ message: "Initiative not found" });
  const theme = await prisma.strategicTheme.findUnique({
    where: { id: parsed.data.strategicThemeId },
  });
  if (!theme) return res.status(404).json({ message: "Theme not found" });
  if (theme.workspaceId !== initiative.workspaceId) {
    return res.status(400).json({
      message: "Theme must belong to the same workspace as the initiative",
    });
  }
  try {
    await prisma.initiativeTheme.create({
      data: {
        initiativeId: req.params.id,
        strategicThemeId: parsed.data.strategicThemeId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ message: "Initiative already linked to this theme" });
    }
    throw e;
  }
  res.status(201).json({ ok: true });
});

initiativesRouter.delete("/initiatives/:id/themes/:themeId", async (req, res) => {
  const result = await prisma.initiativeTheme.deleteMany({
    where: {
      initiativeId: req.params.id,
      strategicThemeId: req.params.themeId,
    },
  });
  if (result.count === 0) {
    return res.status(404).json({ message: "Link not found" });
  }
  res.status(204).send();
});
