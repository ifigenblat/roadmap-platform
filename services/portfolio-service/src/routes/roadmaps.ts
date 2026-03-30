import { Router } from "express";
import { RoadmapStatus } from "../generated/prisma/index.js";
import {
  createRoadmapItemBodySchema,
  createRoadmapSchema,
  createStrategicThemeSchema,
  patchRoadmapSchema,
} from "@roadmap/types";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import {
  assertEndAfterStart,
  assertRoadmapInitiativeSameWorkspace,
  workspaceIdFromQuery,
} from "../workspace-guards.js";

export const roadmapsRouter = Router();

roadmapsRouter.get("/roadmaps", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  const data = await prisma.roadmap.findMany({
    where: ws ? { workspaceId: ws } : undefined,
    orderBy: { planningYear: "desc" },
  });
  res.json(data);
});

roadmapsRouter.post("/roadmaps", async (req, res) => {
  const parsed = createRoadmapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  const { startDate, endDate, archivedAt, ...rest } = parsed.data;
  const data = await prisma.roadmap.create({
    data: {
      ...rest,
      workspaceId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      archivedAt:
        archivedAt != null && archivedAt !== ""
          ? new Date(archivedAt)
          : null,
    },
  });
  res.status(201).json(data);
});

roadmapsRouter.get("/roadmaps/:id/items", async (req, res) => {
  const items = await prisma.roadmapItem.findMany({
    where: { roadmapId: req.params.id },
    include: {
      initiative: {
        include: {
          sponsor: true,
          themes: {
            include: {
              strategicTheme: { select: { id: true, name: true, colorToken: true } },
            },
          },
        },
      },
      phases: { include: { phaseDefinition: { select: { id: true, name: true } } } },
      teams: { include: { team: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  res.json(items);
});

roadmapsRouter.post("/roadmaps/:id/items", async (req, res) => {
  const parsed = createRoadmapItemBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const roadmap = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  if (!roadmap) return res.status(404).json({ message: "Roadmap not found" });
  const guard = await assertRoadmapInitiativeSameWorkspace(roadmap.id, parsed.data.initiativeId);
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });
  const { startDate, endDate, ...rest } = parsed.data;
  const row = await prisma.roadmapItem.create({
    data: {
      ...rest,
      roadmapId: roadmap.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
  res.status(201).json(row);
});

roadmapsRouter.get("/roadmaps/:id/themes", async (req, res) => {
  const roadmap = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  if (!roadmap) return res.status(404).json({ message: "Roadmap not found" });
  const themes = await prisma.strategicTheme.findMany({
    where: { roadmapId: roadmap.id },
    orderBy: { orderIndex: "asc" },
  });
  res.json(themes);
});

roadmapsRouter.post("/roadmaps/:id/themes", async (req, res) => {
  const parsed = createStrategicThemeSchema.omit({ roadmapId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const roadmap = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  if (!roadmap) return res.status(404).json({ message: "Roadmap not found" });
  const { orderIndex, ...themeRest } = parsed.data;
  const row = await prisma.strategicTheme.create({
    data: {
      ...themeRest,
      orderIndex: orderIndex ?? 0,
      workspaceId: roadmap.workspaceId,
      roadmapId: roadmap.id,
    },
  });
  res.status(201).json(row);
});

/**
 * Removes roadmap rows, phases, item–team links, roadmap-scoped strategic themes,
 * then the roadmap. Initiatives with no remaining roadmap items are removed.
 * Imported teams with no remaining item links are removed. Import batches keep
 * their row but `roadmapId` is set null (FK on delete).
 */
roadmapsRouter.delete("/roadmaps/:id", async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.roadmap.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Roadmap not found" });

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.roadmapItem.findMany({
      where: { roadmapId: id },
      select: { id: true, initiativeId: true },
    });
    const itemIds = items.map((i) => i.id);
    const initiativeIds = [...new Set(items.map((i) => i.initiativeId))];
    let candidateTeamIds: string[] = [];
    let deletedImportedTeams = 0;

    if (itemIds.length > 0) {
      const links = await tx.roadmapItemTeam.findMany({
        where: { roadmapItemId: { in: itemIds } },
        select: { teamId: true },
      });
      candidateTeamIds = [...new Set(links.map((l) => l.teamId))];
      await tx.phaseSegment.deleteMany({ where: { roadmapItemId: { in: itemIds } } });
      await tx.roadmapItemTeam.deleteMany({ where: { roadmapItemId: { in: itemIds } } });
    }
    await tx.roadmapItem.deleteMany({ where: { roadmapId: id } });

    if (candidateTeamIds.length > 0) {
      const importedTeams = await tx.team.findMany({
        where: {
          id: { in: candidateTeamIds },
          kind: "imported",
        },
        select: { id: true },
      });
      const orphanTeamIds: string[] = [];
      for (const t of importedTeams) {
        const remaining = await tx.roadmapItemTeam.count({ where: { teamId: t.id } });
        if (remaining === 0) orphanTeamIds.push(t.id);
      }
      if (orphanTeamIds.length > 0) {
        const del = await tx.team.deleteMany({ where: { id: { in: orphanTeamIds } } });
        deletedImportedTeams = del.count;
      }
    }

    const themes = await tx.strategicTheme.findMany({
      where: { roadmapId: id },
      select: { id: true },
    });
    const themeIds = themes.map((t) => t.id);
    const deletedStrategicThemes = themeIds.length;
    if (themeIds.length > 0) {
      await tx.initiativeTheme.deleteMany({ where: { strategicThemeId: { in: themeIds } } });
      await tx.strategicTheme.deleteMany({ where: { id: { in: themeIds } } });
    }

    await tx.roadmap.delete({ where: { id } });

    let deletedOrphanInitiatives = 0;
    for (const initiativeId of initiativeIds) {
      const remaining = await tx.roadmapItem.count({ where: { initiativeId } });
      if (remaining === 0) {
        await tx.initiativeTheme.deleteMany({ where: { initiativeId } });
        await tx.initiative.delete({ where: { id: initiativeId } });
        deletedOrphanInitiatives += 1;
      }
    }

    return {
      deletedRoadmapId: id,
      deletedStrategicThemes,
      deletedImportedTeams,
      deletedOrphanInitiatives,
    };
  });

  res.json({ ok: true, ...result });
});

roadmapsRouter.patch("/roadmaps/:id", async (req, res) => {
  const parsed = patchRoadmapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Roadmap not found" });
  const { startDate, endDate, archivedAt, ...rest } = parsed.data;
  const nextStart = startDate !== undefined ? startDate : existing.startDate.toISOString();
  const nextEnd = endDate !== undefined ? endDate : existing.endDate.toISOString();
  if (!assertEndAfterStart(nextStart, nextEnd)) {
    return res.status(400).json({ message: "endDate must be on or after startDate" });
  }
  const data: Record<string, unknown> = { ...rest };
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (archivedAt !== undefined) {
    data.archivedAt =
      archivedAt != null && archivedAt !== "" ? new Date(archivedAt) : null;
  }
  const updated = await prisma.roadmap.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

roadmapsRouter.post("/roadmaps/:id/clone", async (req, res) => {
  const source = await prisma.roadmap.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: {
          phases: { include: { phaseDefinition: { select: { id: true, name: true } } } },
          teams: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!source) return res.status(404).json({ message: "Roadmap not found" });

  const suffix = `${Date.now().toString(36)}`;
  const newSlug = `${source.slug}-clone-${suffix}`.slice(0, 120);

  const clone = await prisma.$transaction(async (tx) => {
    const nr = await tx.roadmap.create({
      data: {
        workspaceId: source.workspaceId,
        templateId: source.templateId,
        name: `${source.name} (copy)`,
        slug: newSlug,
        description: source.description,
        planningYear: source.planningYear,
        startDate: source.startDate,
        endDate: source.endDate,
        status: RoadmapStatus.draft,
        ownerUserId: source.ownerUserId,
        archivedAt: null,
      },
    });
    for (const it of source.items) {
      const nit = await tx.roadmapItem.create({
        data: {
          roadmapId: nr.id,
          initiativeId: it.initiativeId,
          titleOverride: it.titleOverride,
          status: it.status,
          priority: it.priority,
          confidence: it.confidence,
          riskLevel: it.riskLevel,
          targetOutcome: it.targetOutcome,
          startDate: it.startDate,
          endDate: it.endDate,
          laneKey: it.laneKey,
          sortOrder: it.sortOrder,
        },
      });
      for (const ph of it.phases) {
        await tx.phaseSegment.create({
          data: {
            roadmapItemId: nit.id,
            phaseName: ph.phaseName,
            phaseDefinitionId: ph.phaseDefinitionId ?? null,
            startDate: ph.startDate,
            endDate: ph.endDate,
            capacityAllocationEstimate: ph.capacityAllocationEstimate,
            sprintEstimate: ph.sprintEstimate,
            teamSummary: ph.teamSummary,
            status: ph.status,
            jiraKey: ph.jiraKey,
            notes: ph.notes,
          },
        });
      }
      for (const rim of it.teams) {
        await tx.roadmapItemTeam.create({
          data: { roadmapItemId: nit.id, teamId: rim.teamId },
        });
      }
    }
    return nr;
  });

  const full = await prisma.roadmap.findUnique({
    where: { id: clone.id },
    include: {
      items: {
        include: {
          initiative: true,
          phases: { include: { phaseDefinition: { select: { id: true, name: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  res.status(201).json(full);
});

roadmapsRouter.post("/roadmaps/:id/archive", async (req, res) => {
  const updated = await prisma.roadmap.updateMany({
    where: { id: req.params.id },
    data: {
      status: RoadmapStatus.archived,
      archivedAt: new Date(),
    },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Roadmap not found" });
  const row = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  res.json(row);
});

function bucketItemStatus(s: string): string {
  switch (s) {
    case "done":
      return "done";
    case "in_progress":
      return "in_progress";
    case "at_risk":
      return "at_risk";
    default:
      return "not_started";
  }
}

function bucketPhaseStatus(raw: string | null | undefined): string {
  const t = (raw ?? "").toLowerCase();
  if (!t.trim()) return "not_stated";
  if (t.includes("done") || t.includes("complete")) return "done";
  if (t.includes("progress")) return "in_progress";
  if (t.includes("risk") || t.includes("block")) return "at_risk";
  if (t.includes("backlog")) return "backlog";
  return "other";
}

/** Theme → initiatives with aggregated phase health for deck / narrative export */
roadmapsRouter.get("/roadmaps/:id/executive-summary", async (req, res) => {
  const roadmap = await prisma.roadmap.findUnique({ where: { id: req.params.id } });
  if (!roadmap) return res.status(404).json({ message: "Roadmap not found" });

  const items = await prisma.roadmapItem.findMany({
    where: { roadmapId: roadmap.id },
    include: {
      initiative: {
        include: {
          themes: { include: { strategicTheme: true } },
        },
      },
      phases: { include: { phaseDefinition: { select: { id: true, name: true } } } },
    },
    orderBy: { sortOrder: "asc" },
  });

  type Agg = {
    initiative: (typeof items)[0]["initiative"];
    phaseBuckets: Record<string, number>;
    totalPhases: number;
  };

  const byInitiative = new Map<string, Agg>();

  for (const item of items) {
    const iid = item.initiativeId;
    let entry = byInitiative.get(iid);
    if (!entry) {
      entry = {
        initiative: item.initiative,
        phaseBuckets: {},
        totalPhases: 0,
      };
      byInitiative.set(iid, entry);
    }
    if (item.phases.length === 0) {
      entry.totalPhases += 1;
      const b = bucketItemStatus(String(item.status));
      entry.phaseBuckets[b] = (entry.phaseBuckets[b] ?? 0) + 1;
    } else {
      for (const ph of item.phases) {
        entry.totalPhases += 1;
        const b = bucketPhaseStatus(ph.status);
        entry.phaseBuckets[b] = (entry.phaseBuckets[b] ?? 0) + 1;
      }
    }
  }

  function summaryFromAgg(a: Agg) {
    return {
      initiativeId: a.initiative.id,
      canonicalName: a.initiative.canonicalName,
      shortObjective: a.initiative.shortObjective,
      detailedObjective: a.initiative.detailedObjective,
      phaseHealth: { totalPhases: a.totalPhases, byStatus: a.phaseBuckets },
    };
  }

  const themeGroups = new Map<
    string,
    {
      strategicTheme: {
        id: string;
        name: string;
        objective: string | null;
        orderIndex: number;
        colorToken: string | null;
      };
      initiatives: ReturnType<typeof summaryFromAgg>[];
    }
  >();
  const seenInTheme = new Map<string, Set<string>>();
  const ungrouped: ReturnType<typeof summaryFromAgg>[] = [];

  for (const [iid, agg] of byInitiative) {
    const s = summaryFromAgg(agg);
    const links = agg.initiative.themes ?? [];
    if (links.length === 0) {
      ungrouped.push(s);
      continue;
    }
    for (const lt of links) {
      const st = lt.strategicTheme;
      const tid = st.id;
      if (!themeGroups.has(tid)) {
        themeGroups.set(tid, {
          strategicTheme: {
            id: st.id,
            name: st.name,
            objective: st.objective ?? null,
            orderIndex: st.orderIndex ?? 0,
            colorToken: st.colorToken ?? null,
          },
          initiatives: [],
        });
      }
      let seen = seenInTheme.get(tid);
      if (!seen) {
        seen = new Set();
        seenInTheme.set(tid, seen);
      }
      if (!seen.has(iid)) {
        seen.add(iid);
        themeGroups.get(tid)!.initiatives.push(s);
      }
    }
  }

  const themesOut = [...themeGroups.values()].sort(
    (a, b) =>
      a.strategicTheme.orderIndex - b.strategicTheme.orderIndex ||
      a.strategicTheme.name.localeCompare(b.strategicTheme.name)
  );
  ungrouped.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

  res.json({
    roadmap: {
      id: roadmap.id,
      name: roadmap.name,
      planningYear: roadmap.planningYear,
      status: roadmap.status,
      workspaceId: roadmap.workspaceId,
    },
    generatedAt: new Date().toISOString(),
    themes: themesOut,
    ungroupedInitiatives: ungrouped,
  });
});

roadmapsRouter.get("/roadmaps/:id", async (req, res) => {
  const roadmap = await prisma.roadmap.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: {
          initiative: true,
          phases: { include: { phaseDefinition: { select: { id: true, name: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!roadmap) return res.status(404).json({ message: "Not found" });
  res.json(roadmap);
});
