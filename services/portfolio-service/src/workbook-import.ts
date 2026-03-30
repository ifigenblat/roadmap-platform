import { createRequire } from "node:module";
import { basename } from "node:path";
import { ItemStatus, PrismaClient, RoadmapStatus } from "./generated/prisma/index.js";
import {
  buildInitiativeDescriptionIndex,
  INITIATIVE_DESCRIPTION_ALIASES_CET,
  InitiativeDescriptionEntry,
  keyedRowsFromAoA,
  normalizeHeaderKey,
  pickBusinessSponsorFromRow,
  resolveInitiativeDescription,
} from "./xlsxColumnPickers.js";
import {
  integrationCreateExternalLink,
  integrationHasExternalLink,
} from "./integrationClient.js";
import { ensurePhaseDefinitionByName } from "./phase-definition-helpers.js";

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

function keyedSheetRows(ws: import("xlsx").WorkSheet): {
  rows: RowObj[];
  headerRow0Based: number;
  headerScore: number;
} {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return keyedRowsFromAoA(aoa);
}

function get(row: RowObj, ...keys: string[]): string {
  for (const key of keys) {
    const want = normalizeHeaderKey(key);
    const match = Object.keys(row).find((rk) => normalizeHeaderKey(rk) === want);
    if (match) {
      const v = str(row[match]);
      if (v !== "") return v;
    }
  }
  return "";
}

function rowVal(row: RowObj, ...aliases: string[]): unknown {
  for (const a of aliases) {
    const want = normalizeHeaderKey(a);
    const k = Object.keys(row).find((rk) => normalizeHeaderKey(rk) === want);
    if (k !== undefined) return row[k];
  }
  return undefined;
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
    businessSponsor?: string | null;
    businessSponsorId?: string | null;
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
        businessSponsor:
          extra.businessSponsor !== undefined ? extra.businessSponsor : found.businessSponsor,
        businessSponsorId:
          extra.businessSponsorId !== undefined
            ? extra.businessSponsorId
            : found.businessSponsorId,
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
      businessSponsor: extra.businessSponsor ?? null,
      businessSponsorId: extra.businessSponsorId ?? null,
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

/** Reuse or create a BusinessSponsor row so initiatives link for the sponsors UI. */
async function ensureBusinessSponsor(
  prisma: PrismaClient,
  workspaceId: string,
  displayName: string
): Promise<string> {
  const name = displayName.trim();
  if (!name) throw new Error("ensureBusinessSponsor: empty displayName");

  const candidates = await prisma.businessSponsor.findMany({
    where: { workspaceId },
    select: { id: true, displayName: true },
  });
  const lower = name.toLowerCase();
  const hit = candidates.find((c) => c.displayName.trim().toLowerCase() === lower);
  if (hit) return hit.id;

  const row = await prisma.businessSponsor.create({
    data: { workspaceId, displayName: name },
  });
  return row.id;
}

async function ensureTeams(prisma: PrismaClient, raw: string) {
  const parts = raw
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const teamIds: string[] = [];
  for (const name of parts) {
    let team = await prisma.team.findFirst({ where: { name } });
    if (!team) {
      team = await prisma.team.create({
        data: { name, kind: "imported" },
      });
    }
    teamIds.push(team.id);
  }
  return teamIds;
}

export async function processWorkbookImport(
  prisma: PrismaClient,
  importBatchId: string,
  filePath: string,
  options?: {
    roadmapId?: string;
    roadmapName?: string;
  }
) {
  const batch = await prisma.importBatch.findUnique({ where: { id: importBatchId } });
  if (!batch) throw new Error("Import batch not found");

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "running" },
  });

  const wb = XLSX.readFile(filePath);
  const dataSheetName = Object.keys(wb.Sheets).find(
    (n) => normalizeHeaderKey(n) === "data"
  );
  if (!dataSheetName) {
    const names = Object.keys(wb.Sheets).join(", ");
    throw new Error(
      `Workbook is missing a 'Data' sheet (case-insensitive). Found sheets: ${names || "(none)"}`
    );
  }
  const dataWs = wb.Sheets[dataSheetName]!;

  const descEntries: InitiativeDescriptionEntry[] = [];
  const descSheetName = Object.keys(wb.Sheets).find(
    (n) => normalizeHeaderKey(n) === normalizeHeaderKey("Initiative Descriptions")
  );
  const descWs = descSheetName ? wb.Sheets[descSheetName] : undefined;
  if (descWs) {
    for (const row of keyedSheetRows(descWs).rows) {
      const name = get(row, "Initiative");
      if (!name) continue;
      descEntries.push({
        name,
        short: get(row, "Succinct Business Objective (For Tracking Sheets)") || undefined,
        long: get(row, "Detailed Business Objective (For Slides)") || undefined,
        pillar: get(row, "Strategic Pillar") || undefined,
      });
    }
  }
  const descIndex = buildInitiativeDescriptionIndex(descEntries);

  const fileNorm = normalizeHeaderKey(basename(batch.sourceFileName));
  const useCetDescAliases =
    fileNorm.includes("cet") && !fileNorm.includes("dcx");
  const descriptionAliases = useCetDescAliases ? INITIATIVE_DESCRIPTION_ALIASES_CET : {};

  const themeObjectives = new Map<string, string>();
  const themeSheetName = Object.keys(wb.Sheets).find(
    (n) => normalizeHeaderKey(n) === normalizeHeaderKey("Strategic Themes")
  );
  const themeWs = themeSheetName ? wb.Sheets[themeSheetName] : undefined;
  if (themeWs) {
    for (const row of keyedSheetRows(themeWs).rows) {
      const name = get(row, "Strategic Pillar");
      const objective = get(row, "Pillar Objective");
      const included = get(row, "Initiatives Included");
      if (name) {
        const parts: string[] = [];
        if (objective) parts.push(objective);
        if (included) parts.push(`Initiatives included: ${included}`);
        themeObjectives.set(name, parts.join("\n\n"));
      }
    }
  }

  const dataKeyed = keyedSheetRows(dataWs);
  const rows = dataKeyed.rows;
  const dataHeaderRow0 = dataKeyed.headerRow0Based;
  const dataHeaderScore = dataKeyed.headerScore;
  if (rows.length === 0) {
    throw new Error(
      "The Data sheet has no rows after the header. Check that row 1 is column headers and data starts on row 2, or remove blank rows above the table."
    );
  }

  const summaryObj =
    typeof batch.summaryJson === "object" && batch.summaryJson !== null
      ? (batch.summaryJson as Record<string, unknown>)
      : {};
  const targetRoadmapId =
    options?.roadmapId ??
    (typeof summaryObj.targetRoadmapId === "string" ? summaryObj.targetRoadmapId : undefined);
  const targetRoadmapName =
    options?.roadmapName ??
    (typeof summaryObj.targetRoadmapName === "string" ? summaryObj.targetRoadmapName : undefined);

  const roadmap =
    targetRoadmapId && targetRoadmapId.trim()
      ? await prisma.roadmap.findFirst({
          where: { id: targetRoadmapId.trim(), workspaceId: batch.workspaceId },
        })
      : null;
  if (targetRoadmapId && !roadmap) {
    throw new Error("Selected roadmap was not found in this workspace.");
  }

  const nowSlug = `${slugify((targetRoadmapName || basename(batch.sourceFileName, ".xlsx")).trim())}-${Date.now()
    .toString(36)
    .slice(-6)}`;
  const yearFromFile = (() => {
    const m = basename(batch.sourceFileName).match(/(20\d{2})/);
    if (!m) return null;
    const y = Number(m[1]);
    return Number.isFinite(y) ? y : null;
  })();
  const planningYear = yearFromFile ?? new Date().getUTCFullYear();

  const createdRoadmap =
    roadmap ??
    (targetRoadmapName && targetRoadmapName.trim()
      ? await prisma.roadmap.create({
          data: {
            workspaceId: batch.workspaceId,
            name: targetRoadmapName.trim(),
            slug: nowSlug,
            description: `Imported from ${batch.sourceFileName}`,
            planningYear,
            startDate: new Date(`${planningYear}-01-01T00:00:00Z`),
            endDate: new Date(`${planningYear}-12-31T00:00:00Z`),
            status: RoadmapStatus.draft,
          },
        })
      : null);
  if (!createdRoadmap) {
    throw new Error("Import requires a roadmap selection or a new roadmap name.");
  }

  let sortOrder = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { roadmapId: createdRoadmap.id },
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = dataHeaderRow0 + i + 2;
    try {
      const initiativeName = get(
        row,
        "Initiative/Project",
        "Initiative / Project",
        "Initiative Name",
        "Initiative",
        "Project",
        "Project Name"
      );
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
      const sponsorLabel = pickBusinessSponsorFromRow(row);
      const start = toDate(rowVal(row, "Start Date", "Start Quarter 2026"));
      const end = toDate(rowVal(row, "End Date", "End Quarter 2026"));
      const capEstimate = parsePercent(rowVal(row, "Capacity Allocation Estimate"));
      const sprintEstimate = parseNumber(rowVal(row, "# of Sprints Estimate"));
      const desc = resolveInitiativeDescription(
        initiativeName,
        themeName || undefined,
        descIndex,
        descriptionAliases
      );

      const sponsorExtra =
        sponsorLabel.length > 0
          ? {
              businessSponsor: sponsorLabel,
              businessSponsorId: await ensureBusinessSponsor(
                prisma,
                batch.workspaceId,
                sponsorLabel
              ),
            }
          : {};

      const initiative = await upsertInitiative(prisma, batch.workspaceId, initiativeName, {
        ...sponsorExtra,
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
          createdRoadmap.id,
          themeName,
          themeObjectives.get(themeName)
        );
        themeId = theme.id;
        await linkInitiativeTheme(prisma, initiative.id, theme.id);
      }

      if (jira) {
        const exists = await integrationHasExternalLink(batch.workspaceId, {
          entityType: "initiative",
          entityId: initiative.id,
          provider: "jira",
          externalId: jira,
        });
        if (!exists) {
          try {
            await integrationCreateExternalLink({
              workspaceId: batch.workspaceId,
              entityType: "initiative",
              entityId: initiative.id,
              provider: "jira",
              externalId: jira,
              externalUrl: jira.includes("://") ? jira : `jira:${jira}`,
              syncState: "linked",
              metadataJson: { source: "workbook-upload" },
            });
          } catch (error) {
            console.warn("integrationCreateExternalLink:", error);
          }
        }
      }

      const item = await prisma.roadmapItem.create({
        data: {
          roadmapId: createdRoadmap.id,
          initiativeId: initiative.id,
          titleOverride: phaseName ? `${initiativeName} - ${phaseName}` : null,
          status: mapStatus(status),
          startDate: start,
          endDate: end,
          laneKey: teamsRaw || themeName || null,
          sortOrder: sortOrder++,
        },
      });

      const phaseLabel = phaseName || "Execution";
      const phaseDef = await ensurePhaseDefinitionByName(prisma, batch.workspaceId, phaseLabel);
      await prisma.phaseSegment.create({
        data: {
          roadmapItemId: item.id,
          phaseName: phaseDef.name,
          phaseDefinitionId: phaseDef.id,
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

      const teamIds = await ensureTeams(prisma, teamsRaw);
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
          entityKey: get(
            row,
            "Initiative/Project",
            "Initiative / Project",
            "Initiative Name",
            "Initiative",
            "Project",
            "Project Name"
          ),
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          rawPayloadJson: rowPayloadJson(row),
        },
      });
    }
  }

  if (imported === 0 && failed === 0 && rows.length > 0) {
    const sampleKeys = Object.keys(rows[0] ?? {})
      .filter((k) => str((rows[0] as RowObj)[k]) !== "")
      .slice(0, 20)
      .join(", ");
    const allKeys = Object.keys(rows[0] ?? {}).join(", ");
    throw new Error(
      `No rows imported (${rows.length} data rows; all skipped). Put the initiative name in a column such as "Initiative Name" or "Initiative/Project". ` +
        `Non-empty columns in row 1: ${sampleKeys || "(none)"}. All header cells: ${allKeys || "(none)"}`
    );
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
        createdRoadmapId: createdRoadmap.id,
        selectedRoadmapId: targetRoadmapId ?? null,
        selectedRoadmapName: targetRoadmapName ?? null,
        dataSheetHeaderRow0Based: dataHeaderRow0,
        dataSheetHeaderScore: dataHeaderScore,
      },
    },
  });

  return { roadmapId: createdRoadmap.id, rows: rows.length, imported, skipped, failed };
}
