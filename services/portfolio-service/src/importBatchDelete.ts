import type { PrismaClient } from "./generated/prisma/index.js";

/** Row counts that will be removed by `deleteImportBatchAndCreatedData` (no double-counting). */
export type ImportBatchDeleteImpact = {
  importBatchId: string;
  sourceFileName: string;
  totalRecords: number;
  breakdown: {
    importRowResults: number;
    importBatches: number;
    roadmaps: number;
    roadmapItems: number;
    phaseSegments: number;
    roadmapItemTeams: number;
    teamsOrphanImported: number;
    strategicThemes: number;
    initiativeThemeViaRoadmapThemes: number;
    initiativeThemeViaOrphanInitiatives: number;
    initiativesOrphan: number;
  };
};

export async function getImportBatchDeleteImpact(
  prisma: PrismaClient,
  batchId: string
): Promise<ImportBatchDeleteImpact | null> {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, sourceFileName: true, roadmapId: true },
  });
  if (!batch) return null;

  const importRowResults = await prisma.importRowResult.count({
    where: { importBatchId: batchId },
  });

  const breakdown: ImportBatchDeleteImpact["breakdown"] = {
    importRowResults,
    importBatches: 1,
    roadmaps: 0,
    roadmapItems: 0,
    phaseSegments: 0,
    roadmapItemTeams: 0,
    teamsOrphanImported: 0,
    strategicThemes: 0,
    initiativeThemeViaRoadmapThemes: 0,
    initiativeThemeViaOrphanInitiatives: 0,
    initiativesOrphan: 0,
  };

  if (!batch.roadmapId) {
    return {
      importBatchId: batch.id,
      sourceFileName: batch.sourceFileName,
      totalRecords: importRowResults + 1,
      breakdown,
    };
  }

  const roadmapId = batch.roadmapId;
  breakdown.roadmaps = 1;

  const items = await prisma.roadmapItem.findMany({
    where: { roadmapId },
    select: { id: true, initiativeId: true },
  });
  const itemIds = items.map((i) => i.id);
  breakdown.roadmapItems = items.length;

  if (itemIds.length > 0) {
    breakdown.phaseSegments = await prisma.phaseSegment.count({
      where: { roadmapItemId: { in: itemIds } },
    });
    const itemTeamLinks = await prisma.roadmapItemTeam.findMany({
      where: { roadmapItemId: { in: itemIds } },
      select: { teamId: true },
    });
    breakdown.roadmapItemTeams = itemTeamLinks.length;
    const candidateTeamIds = [...new Set(itemTeamLinks.map((x) => x.teamId))];
    if (candidateTeamIds.length > 0) {
      const importedTeams = await prisma.team.findMany({
        where: {
          id: { in: candidateTeamIds },
          kind: "imported",
        },
        select: { id: true },
      });
      let orphanImported = 0;
      for (const t of importedTeams) {
        const stillLinked = await prisma.roadmapItemTeam.count({
          where: { teamId: t.id, roadmapItemId: { notIn: itemIds } },
        });
        if (stillLinked === 0) orphanImported += 1;
      }
      breakdown.teamsOrphanImported = orphanImported;
    }
  }

  const themes = await prisma.strategicTheme.findMany({
    where: { roadmapId },
    select: { id: true },
  });
  const themeIds = themes.map((t) => t.id);
  breakdown.strategicThemes = themeIds.length;

  if (themeIds.length > 0) {
    breakdown.initiativeThemeViaRoadmapThemes = await prisma.initiativeTheme.count({
      where: { strategicThemeId: { in: themeIds } },
    });
  }

  const initiativeIds = [...new Set(items.map((i) => i.initiativeId))];
  const orphanIds: string[] = [];
  for (const iid of initiativeIds) {
    const onOtherRoadmaps = await prisma.roadmapItem.count({
      where: { initiativeId: iid, roadmapId: { not: roadmapId } },
    });
    if (onOtherRoadmaps === 0) orphanIds.push(iid);
  }
  breakdown.initiativesOrphan = orphanIds.length;

  const themeFilter =
    themeIds.length > 0 ? ({ strategicThemeId: { notIn: themeIds } } as const) : {};
  for (const oid of orphanIds) {
    breakdown.initiativeThemeViaOrphanInitiatives += await prisma.initiativeTheme.count({
      where: { initiativeId: oid, ...themeFilter },
    });
  }

  const totalRecords =
    breakdown.importRowResults +
    breakdown.importBatches +
    breakdown.roadmaps +
    breakdown.roadmapItems +
    breakdown.phaseSegments +
    breakdown.roadmapItemTeams +
    breakdown.teamsOrphanImported +
    breakdown.strategicThemes +
    breakdown.initiativeThemeViaRoadmapThemes +
    breakdown.initiativeThemeViaOrphanInitiatives +
    breakdown.initiativesOrphan;

  return {
    importBatchId: batch.id,
    sourceFileName: batch.sourceFileName,
    totalRecords,
    breakdown,
  };
}

export type DeleteImportBatchResult = {
  deletedBatchId: string;
  deletedRoadmapId: string | null;
  deletedImportedTeams: number;
  deletedStrategicThemes: number;
  deletedOrphanInitiatives: number;
};

/**
 * Removes an import batch and data produced by that import:
 * roadmap (if any), items, phase segments, item–team links, roadmap-scoped strategic themes,
 * then initiatives that no longer appear on any roadmap. Import row results cascade with the batch.
 */
export async function deleteImportBatchAndCreatedData(
  prisma: PrismaClient,
  batchId: string
): Promise<DeleteImportBatchResult | null> {
  const existing = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Import batch not found");

    let deletedRoadmapId: string | null = null;
    let deletedImportedTeams = 0;
    let deletedStrategicThemes = 0;
    let deletedOrphanInitiatives = 0;

    const roadmapId = batch.roadmapId;
    if (roadmapId) {
      deletedRoadmapId = roadmapId;

      const items = await tx.roadmapItem.findMany({
        where: { roadmapId },
        select: { id: true, initiativeId: true },
      });
      const itemIds = items.map((i) => i.id);
      const initiativeIds = [...new Set(items.map((i) => i.initiativeId))];
      let candidateTeamIds: string[] = [];

      if (itemIds.length > 0) {
        const itemTeamLinks = await tx.roadmapItemTeam.findMany({
          where: { roadmapItemId: { in: itemIds } },
          select: { teamId: true },
        });
        candidateTeamIds = [...new Set(itemTeamLinks.map((x) => x.teamId))];
        await tx.phaseSegment.deleteMany({ where: { roadmapItemId: { in: itemIds } } });
        await tx.roadmapItemTeam.deleteMany({ where: { roadmapItemId: { in: itemIds } } });
      }
      await tx.roadmapItem.deleteMany({ where: { roadmapId } });

      if (candidateTeamIds.length > 0) {
        const importedCandidateTeams = await tx.team.findMany({
          where: {
            id: { in: candidateTeamIds },
            kind: "imported",
          },
          select: { id: true },
        });
        const orphanTeamIds: string[] = [];
        for (const t of importedCandidateTeams) {
          const remainingLinks = await tx.roadmapItemTeam.count({ where: { teamId: t.id } });
          if (remainingLinks === 0) orphanTeamIds.push(t.id);
        }
        if (orphanTeamIds.length > 0) {
          const del = await tx.team.deleteMany({ where: { id: { in: orphanTeamIds } } });
          deletedImportedTeams = del.count;
        }
      }

      const themes = await tx.strategicTheme.findMany({
        where: { roadmapId },
        select: { id: true },
      });
      const themeIds = themes.map((t) => t.id);
      deletedStrategicThemes = themeIds.length;
      if (themeIds.length > 0) {
        await tx.initiativeTheme.deleteMany({ where: { strategicThemeId: { in: themeIds } } });
        await tx.strategicTheme.deleteMany({ where: { id: { in: themeIds } } });
      }

      await tx.roadmap.delete({ where: { id: roadmapId } });

      for (const initiativeId of initiativeIds) {
        const remaining = await tx.roadmapItem.count({ where: { initiativeId } });
        if (remaining === 0) {
          await tx.initiativeTheme.deleteMany({ where: { initiativeId } });
          await tx.initiative.delete({ where: { id: initiativeId } });
          deletedOrphanInitiatives += 1;
        }
      }
    }

    await tx.importBatch.delete({ where: { id: batchId } });

    return {
      deletedBatchId: batchId,
      deletedRoadmapId,
      deletedImportedTeams,
      deletedStrategicThemes,
      deletedOrphanInitiatives,
    };
  });
}
