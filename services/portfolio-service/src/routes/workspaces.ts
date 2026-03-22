import { Router } from "express";
import { createWorkspaceSchema, patchWorkspaceSchema } from "@roadmap/types";
import { prisma } from "../db.js";

export const workspacesRouter = Router();

function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 80) : "workspace";
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base.slice(0, 80);
  let n = 0;
  for (;;) {
    const trySlug = n === 0 ? candidate : `${candidate}-${n}`.slice(0, 100);
    const exists = await prisma.workspace.findUnique({ where: { slug: trySlug } });
    if (!exists) return trySlug;
    n++;
  }
}

workspacesRouter.get("/workspaces", async (_req, res) => {
  const rows = await prisma.workspace.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

workspacesRouter.post("/workspaces", async (req, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { name, slug: slugIn } = parsed.data;
  let slug: string;
  if (slugIn) {
    const taken = await prisma.workspace.findUnique({ where: { slug: slugIn } });
    if (taken) return res.status(409).json({ message: `Slug "${slugIn}" is already in use.` });
    slug = slugIn;
  } else {
    slug = await uniqueSlug(slugifyName(name));
  }
  const row = await prisma.workspace.create({
    data: { name: name.trim(), slug },
  });
  res.status(201).json(row);
});

workspacesRouter.patch("/workspaces/:id", async (req, res) => {
  const parsed = patchWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });
  if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
    const taken = await prisma.workspace.findUnique({ where: { slug: parsed.data.slug } });
    if (taken) return res.status(409).json({ message: `Slug "${parsed.data.slug}" is already in use.` });
  }
  const updated = await prisma.workspace.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
    },
  });
  res.json(updated);
});

workspacesRouter.delete("/workspaces/:id", async (req, res) => {
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });
  if (existing.slug === "default") {
    return res.status(400).json({ message: "The default workspace cannot be deleted." });
  }
  const [roadmaps, initiatives, themes, teams, sponsors, imports] = await Promise.all([
    prisma.roadmap.count({ where: { workspaceId: req.params.id } }),
    prisma.initiative.count({ where: { workspaceId: req.params.id } }),
    prisma.strategicTheme.count({ where: { workspaceId: req.params.id } }),
    prisma.team.count({ where: { workspaceId: req.params.id } }),
    prisma.businessSponsor.count({ where: { workspaceId: req.params.id } }),
    prisma.importBatch.count({ where: { workspaceId: req.params.id } }),
  ]);
  const total = roadmaps + initiatives + themes + teams + sponsors + imports;
  if (total > 0) {
    return res.status(409).json({
      message:
        "Workspace still has data (roadmaps, initiatives, themes, teams, sponsors, or imports). Remove or reassign them first.",
      counts: { roadmaps, initiatives, themes, teams, sponsors, imports },
    });
  }
  await prisma.workspace.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
