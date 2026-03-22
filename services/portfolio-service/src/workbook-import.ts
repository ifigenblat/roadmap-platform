import { createRequire } from "node:module";
import { basename } from "node:path";
import { ItemStatus, PrismaClient, RoadmapStatus } from "./generated/prisma/index.js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

type RowObj = Record<string, unknown>;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return base || "roadmap";
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(str(v));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseNumber(v: unknown): number | null {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : null;
}

function parsePercent(v: unknown): number | null {
  const raw = str(v);
  if (!raw) return null;
  if (raw.includes("%")) {
    const n = Number(raw.replace("%", "").trim());
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function mapStatus(raw: string): ItemStatus {
  const s = raw.toLowerCase();
  if (s.includes("done") || s.includes("complete")) return ItemStatus.done;
  if (s.includes("progress")) return ItemStatus.in_progress;
  if (s.includes("risk") || s.includes("block")) return ItemStatus.at_risk;
  return ItemStatus.not_started;
}

function sheetRows(ws: import("xlsx").WorkSheet): RowObj[] {
  return XLSX.utils.sheet_to_json<RowObj>(ws, { defval: "", raw: false });
}

function get(row: RowObj, ...keys: string[]): string {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === key.trim().toLowerCase()
    );
    if (match) return str(row[match]);
  }
  return "";
}

function rowPayloadJson(row: RowObj): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) out[k] = str(row[k]);
  return out;
}

async function upsertInitiative(
  prisma: PrismaClient,
  workspaceId: string,
  canonicalName: string,
  extra: {
    shortObjective?: string | null;
    detailedObjective?: string | null;
    type?: string | null;
    notes?: string | null;
    sourceSystem?: string | null;
    sourceReference?: string | null;
  }
) {
  const found = await prisma.initiative.findFirst({
    where: { workspaceId, canonicalName },
  });
  if (found) {
    return prisma.initiative.update({
      where: { id: found.id },
      data: {
        shortObjective: extra.shortObjective ?? found.shortObjective,
        detailedObjective: extra.detailedObjective ?? found.detailedObjective,
        type: extra.type ?? found.type,
        notes: extra.notes ?? found.notes,
        sourceSystem: extra.sourceSystem ?? found.sourceSystem,
        sourceReference: extra.sourceReference ?? found.sourceReference,
      },
    });
  }
  return prisma.initiative.create({
    data: {
      workspaceId,
      canonicalName,
      shortObjective: extra.shortObjective ?? null,
      detailedObjective: extra.detailedObjective ?? null,
      type: extra.type ?? null,
      notes: extra.notes ?? null,
      sourceSystem: extra.sourceSystem ?? null,
      sourceReference: extra.sourceReference ?? null,
    },
  });
}

async function upsertTheme(
  prisma: PrismaClient,
  workspaceId: string,
  roadmapId: string,
  name: string,
  objective?: string
) {
  const existing = await prisma.strategicTheme.findFirst({
    where: { workspaceId, roadmapId, name },
  });
  if (existing) {
    if (objective && !existing.objective) {
      return prisma.strategicTheme.update({
        where: { id: existing.id },
        data: { objective },
      });
    }
    return existing;
  }
  return prisma.strategicTheme.create({
    data: {
      workspaceId,
      roadmapId,
      name,
      objective: objective || null,
      orderIndex: 0,
    },
  });
}

async function linkInitiativeTheme(
  prisma: PrismaClient,
  initiativeId: string,
  strategicThemeId: string
) {
  const existing = await prisma.initiativeTheme.findUnique({
    where: { initiativeId_strategicThemeId: { initiativeId, strategicThemeId } },
  });
  if (!existing) {
    await prisma.initiativeTheme.create({
      data: { initiativeId, strategicThemeId },
    });
  }
}

async function ensureTeams(prisma: PrismaClient, workspaceId: string, raw: string) {
  const parts = raw
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const teamIds: string[] = [];
  for (const name of parts) {
    let team = await prisma.team.findFirst({ where: { workspaceId, name } });
    if (!team) {
      team = await prisma.team.create({
        data: { workspaceId, name, kind: "imported" },
      });
    }
    teamIds.push(team.id);
  }
  return teamIds;
}

export async function processWorkbookImport(
  prisma: PrismaClient,
  importBatchId: string,
  filePath: string
) {
  const batch = await prisma.importBatch.findUnique({ where: { id: importBatchId } });
  if (!batch) throw new Error("Import batch not found");

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "running" },
  });

  const wb = XLSX.readFile(filePath);
  const dataWs = wb.Sheets["Data"];
  if (!dataWs) {
    throw new Error("Workbook is missing required 'Data' sheet");
  }

  const descriptions = new Map<string, { short?: string; long?: string }>();
  const descWs = wb.Sheets["Initiative Descriptions"];
  if (descWs) {
    for (const row of sheetRows(descWs)) {
      const name = get(row, "Initiative");
      if (!name) continue;
      descriptions.set(name, {
        short: get(row, "Succinct Business Objective (For Tracking Sheets)") || undefined,
        long: get(row, "Detailed Business Objective (For Slides)") || undefined,
      });
    }
  }

  const themeObjectives = new Map<string, string>();
  const themeWs = wb.Sheets["Strategic Themes"];
  if (themeWs) {
    for (const row of sheetRows(themeWs)) {
      const name = get(row, "Strategic Pillar");
      const objective = get(row, "Pillar Objective");
      if (name) themeObjectives.set(name, objective);
    }
  }

  const nowSlug = `${slugify(basename(batch.sourceFileName, ".xlsx"))}-${Date.now()
    .toString(36)
    .slice(-6)}`;

  const roadmap = await prisma.roadmap.create({
    data: {
      workspaceId: batch.workspaceId,
      name: basename(batch.sourceFileName, ".xlsx"),
      slug: nowSlug,
      description: `Imported from ${batch.sourceFileName}`,
      planningYear: new Date().getUTCFullYear(),
      startDate: new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00Z`),
      endDate: new Date(`${new Date().getUTCFullYear()}-12-31T00:00:00Z`),
      status: RoadmapStatus.draft,
    },
  });

  const rows = sheetRows(dataWs);
  let sortOrder = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { roadmapId: roadmap.id },
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    try {
      const initiativeName = get(row, "Initiative/Project", "Initiative Name");
      if (!initiativeName) {
        skipped++;
        await prisma.importRowResult.create({
          data: {
            importBatchId: batch.id,
            sheetName: "Data",
            rowNumber,
            entityType: "none",
            entityKey: "",
            status: "skipped",
            message: "Missing initiative/project name",
            rawPayloadJson: rowPayloadJson(row),
          },
        });
        continue;
      }

      const phaseName = get(row, "Phase");
      const teamsRaw = get(row, "Teams", "Team(s)");
      const type = get(row, "Type");
      const status = get(row, "Status");
      const notes = get(row, "Notes");
      const jira = get(row, "Jira");
      const themeName = get(row, "Theme");
      const businessObjective = get(row, "Business Objective");
      const start = toDate(row["Start Date"]);
      const end = toDate(row["End Date"]);
      const capEstimate = parsePercent(row["Capacity Allocation Estimate"]);
      const sprintEstimate = parseNumber(row["# of Sprints Estimate"]);
      const desc = descriptions.get(initiativeName);

      const initiative = await upsertInitiative(prisma, batch.workspaceId, initiativeName, {
        shortObjective:
          desc?.short ?? (businessObjective ? businessObjective.slice(0, 500) : null),
        detailedObjective: desc?.long ?? (businessObjective || null),
        type: type || null,
        notes: notes || null,
        sourceSystem: jira ? "jira" : null,
        sourceReference: jira || null,
      });

      let themeId: string | null = null;
      if (themeName) {
        const theme = await upsertTheme(
          prisma,
          batch.workspaceId,
          roadmap.id,
          themeName,
          themeObjectives.get(themeName)
        );
        themeId = theme.id;
        await linkInitiativeTheme(prisma, initiative.id, theme.id);
      }

      const item = await prisma.roadmapItem.create({
        data: {
          roadmapId: roadmap.id,
          initiativeId: initiative.id,
          titleOverride: phaseName ? `${initiativeName} - ${phaseName}` : null,
          status: mapStatus(status),
          startDate: start,
          endDate: end,
          laneKey: teamsRaw || themeName || null,
          sortOrder: sortOrder++,
        },
      });

      await prisma.phaseSegment.create({
        data: {
          roadmapItemId: item.id,
          phaseName: phaseName || "Execution",
          startDate: start,
          endDate: end,
          capacityAllocationEstimate: capEstimate ?? undefined,
          sprintEstimate: sprintEstimate ?? undefined,
          status: status || null,
          jiraKey: jira || null,
          notes: notes || null,
          teamSummary: teamsRaw || null,
        },
      });

      const teamIds = await ensureTeams(prisma, batch.workspaceId, teamsRaw);
      for (const teamId of teamIds) {
        const existing = await prisma.roadmapItemTeam.findUnique({
          where: { roadmapItemId_teamId: { roadmapItemId: item.id, teamId } },
        });
        if (!existing) {
          await prisma.roadmapItemTeam.create({
            data: { roadmapItemId: item.id, teamId },
          });
        }
      }

      imported++;
      await prisma.importRowResult.create({
        data: {
          importBatchId: batch.id,
          sheetName: "Data",
          rowNumber,
          entityType: "roadmap_item",
          entityKey: initiativeName,
          status: "imported",
          message: themeId ? `Linked theme ${themeName}` : undefined,
          rawPayloadJson: rowPayloadJson(row),
        },
      });
    } catch (error) {
      failed++;
      await prisma.importRowResult.create({
        data: {
          importBatchId: batch.id,
          sheetName: "Data",
          rowNumber,
          entityType: "row",
          entityKey: get(row, "Initiative/Project", "Initiative Name"),
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          rawPayloadJson: rowPayloadJson(row),
        },
      });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: failed > 0 ? "completed_with_errors" : "completed",
      completedAt: new Date(),
      summaryJson: {
        rows: rows.length,
        imported,
        skipped,
        failed,
        createdRoadmapId: roadmap.id,
      },
    },
  });

  return { roadmapId: roadmap.id, rows: rows.length, imported, skipped, failed };
}
