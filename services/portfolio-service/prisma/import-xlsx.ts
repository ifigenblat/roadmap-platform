/**
 * Import roadmap rows from spec:/Data/*.xlsx into Postgres (Prisma).
 * Run from repo root: npm run import:xlsx -w @roadmap/portfolio-service
 */
import { config } from "dotenv";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });
import * as fs from "node:fs";
import * as path from "node:path";

const require = createRequire(import.meta.url);
// xlsx is CJS; namespace import breaks under tsx/esbuild
const XLSX = require("xlsx") as typeof import("xlsx");
type XlsxWorkBook = import("xlsx").WorkBook;
type XlsxWorkSheet = import("xlsx").WorkSheet;
import {
  ItemStatus,
  PrismaClient,
  RoadmapStatus,
} from "../src/generated/prisma/index.js";
import {
  integrationCreateExternalLink,
  integrationDeleteExternalLinksForWorkspace,
  integrationHasExternalLink,
} from "../src/integrationClient.js";
import { ensurePhaseDefinitionByName } from "../src/phase-definition-helpers.js";
import { deleteTemplatesForWorkspace } from "../src/templateClient.js";
import {
  buildInitiativeDescriptionIndex,
  INITIATIVE_DESCRIPTION_ALIASES_CET,
  InitiativeDescriptionEntry,
  keyedRowsFromAoA,
  normalizeHeaderKey,
  pickBusinessSponsorFromRow,
  resolveInitiativeDescription,
} from "../src/xlsxColumnPickers.js";

const prisma = new PrismaClient();

const WORKSPACE_SLUG = "excel-import";
const ROADMAP_SLUGS = {
  dcx: "2026-roadmap-platform-dcx",
  cet: "2026-roadmap-platform-cet-sales-marketing",
} as const;

function repoDataDir(): string {
  const root = path.resolve(process.cwd(), "../..");
  return path.join(root, "spec:/Data");
}

/** First matching filename wins (Roadmap Platform naming preferred; legacy workbook titles still work). */
function resolveDataFile(dataDir: string, candidates: string[]): string {
  for (const name of candidates) {
    const p = path.join(dataDir, name);
    if (fs.existsSync(p)) return p;
  }
  const msg = `Missing file in ${dataDir}; tried: ${candidates.join(", ")}`;
  console.error(msg);
  throw new Error(msg);
}

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "item";
}

function coerceDate(val: unknown): Date {
  if (val == null || val === "") return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const utc = Math.round((val - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? new Date() : d;
}

function str(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function mapItemStatus(raw: string): ItemStatus {
  const s = raw.toLowerCase();
  if (s.includes("done") || s === "complete") return ItemStatus.done;
  if (s.includes("progress")) return ItemStatus.in_progress;
  if (s.includes("risk")) return ItemStatus.at_risk;
  return ItemStatus.not_started;
}

function parsePercent(val: unknown): number | null {
  const s = str(val);
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*%/);
  if (m) return Number(m[1]) / 100;
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : null;
}

function parseSprintEstimate(val: unknown): number | null {
  const s = str(val);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type RowObj = Record<string, unknown>;

function sheetRows(ws: XLSX.WorkSheet): RowObj[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return keyedRowsFromAoA(aoa).rows;
}

function sheetRowsWithHeader(ws: XLSX.WorkSheet): {
  rows: RowObj[];
  headerRow0Based: number;
} {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  const k = keyedRowsFromAoA(aoa);
  return { rows: k.rows, headerRow0Based: k.headerRow0Based };
}

function sheetByNameCI(wb: XlsxWorkBook, name: string): XlsxWorkSheet | undefined {
  const want = normalizeHeaderKey(name);
  const key = Object.keys(wb.Sheets).find((n) => normalizeHeaderKey(n) === want);
  return key ? wb.Sheets[key] : undefined;
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

/** Bracket-style access with normalized header names (handles casing / spacing). */
function rowVal(row: RowObj, ...aliases: string[]): unknown {
  for (const a of aliases) {
    const want = normalizeHeaderKey(a);
    const k = Object.keys(row).find((rk) => normalizeHeaderKey(rk) === want);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

async function ensureWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Excel import" },
    create: { name: "Excel import", slug: WORKSPACE_SLUG },
  });
}

/** Remove prior import data for this workspace (roadmaps + related). */
async function wipeImportWorkspace(workspaceId: string) {
  try {
    await integrationDeleteExternalLinksForWorkspace(workspaceId);
  } catch (e) {
    console.warn("Could not wipe integration external links:", e);
  }
  try {
    await deleteTemplatesForWorkspace(workspaceId);
  } catch (e) {
    console.warn("Could not wipe template-service rows:", e);
  }

  await prisma.importBatch.deleteMany({ where: { workspaceId } });

  const roadmaps = await prisma.roadmap.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const roadmapIds = roadmaps.map((r) => r.id);

  let candidateTeamIds: string[] = [];
  if (roadmapIds.length > 0) {
    const links = await prisma.roadmapItemTeam.findMany({
      where: { roadmapItem: { roadmapId: { in: roadmapIds } } },
      select: { teamId: true },
    });
    candidateTeamIds = [...new Set(links.map((l) => l.teamId))];
    await prisma.phaseSegment.deleteMany({
      where: { roadmapItem: { roadmapId: { in: roadmapIds } } },
    });
    await prisma.roadmapItemTeam.deleteMany({
      where: { roadmapItem: { roadmapId: { in: roadmapIds } } },
    });
    await prisma.roadmapItem.deleteMany({
      where: { roadmapId: { in: roadmapIds } },
    });
    await prisma.roadmap.deleteMany({ where: { id: { in: roadmapIds } } });
  }

  await prisma.initiativeTheme.deleteMany({
    where: { initiative: { workspaceId } },
  });
  await prisma.initiative.deleteMany({ where: { workspaceId } });
  await prisma.strategicTheme.deleteMany({ where: { workspaceId } });

  if (candidateTeamIds.length > 0) {
    const imported = await prisma.team.findMany({
      where: { id: { in: candidateTeamIds }, kind: "imported" },
      select: { id: true },
    });
    const orphanIds: string[] = [];
    for (const t of imported) {
      const remaining = await prisma.roadmapItemTeam.count({ where: { teamId: t.id } });
      if (remaining === 0) orphanIds.push(t.id);
    }
    if (orphanIds.length > 0) {
      await prisma.team.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }
}

function rowPayloadJson(row: RowObj): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    out[k] = str(row[k]);
  }
  return out;
}

async function upsertTheme(
  workspaceId: string,
  name: string,
  objective: string | undefined,
  orderIndex: number,
  roadmapId: string | null
) {
  const n = name.trim();
  if (!n) return null;
  const scope = roadmapId ?? null;
  const existing = await prisma.strategicTheme.findFirst({
    where: { workspaceId, name: n, roadmapId: scope },
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
      roadmapId: scope,
      name: n,
      objective: objective || null,
      orderIndex,
    },
  });
}

async function ensureBusinessSponsor(workspaceId: string, displayName: string): Promise<string> {
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

async function upsertInitiative(
  workspaceId: string,
  canonicalName: string,
  extra: {
    shortObjective?: string | null;
    detailedObjective?: string | null;
    businessSponsor?: string | null;
    businessSponsorId?: string | null;
    type?: string | null;
    notes?: string | null;
    sourceSystem?: string | null;
    sourceReference?: string | null;
  }
) {
  const name = canonicalName.trim();
  if (!name) throw new Error("Empty initiative name");
  const found = await prisma.initiative.findFirst({
    where: { workspaceId, canonicalName: name },
  });
  if (found) {
    return prisma.initiative.update({
      where: { id: found.id },
      data: {
        shortObjective: extra.shortObjective ?? found.shortObjective,
        detailedObjective: extra.detailedObjective ?? found.detailedObjective,
        businessSponsor:
          extra.businessSponsor !== undefined ? extra.businessSponsor : found.businessSponsor,
        businessSponsorId:
          extra.businessSponsorId !== undefined ? extra.businessSponsorId : found.businessSponsorId,
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
      canonicalName: name,
      shortObjective: extra.shortObjective ?? null,
      detailedObjective: extra.detailedObjective ?? null,
      businessSponsor: extra.businessSponsor ?? null,
      businessSponsorId: extra.businessSponsorId ?? null,
      type: extra.type ?? null,
      notes: extra.notes ?? null,
      sourceSystem: extra.sourceSystem ?? null,
      sourceReference: extra.sourceReference ?? null,
    },
  });
}

async function linkInitiativeTheme(initiativeId: string, themeId: string) {
  const existing = await prisma.initiativeTheme.findUnique({
    where: {
      initiativeId_strategicThemeId: { initiativeId, strategicThemeId: themeId },
    },
  });
  if (!existing) {
    await prisma.initiativeTheme.create({
      data: { initiativeId, strategicThemeId: themeId },
    });
  }
}

async function ensureTeams(teamCsv: string): Promise<string[]> {
  const teamIds: string[] = [];
  const parts = teamCsv
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const name of parts) {
    let team = await prisma.team.findFirst({
      where: { name },
    });
    if (!team) {
      team = await prisma.team.create({
        data: { name, kind: "imported" },
      });
    }
    teamIds.push(team.id);
  }
  return teamIds;
}

async function importDcx(
  workspaceId: string,
  filePath: string,
  themeOrder: { counter: number }
) {
  const wb = XLSX.readFile(filePath);
  const ws = sheetByNameCI(wb, "Data");
  if (!ws) throw new Error("DCX: missing 'Data' sheet");

  const { rows, headerRow0Based } = sheetRowsWithHeader(ws);
  const roadmap = await prisma.roadmap.create({
    data: {
      workspaceId,
      name: "2026 Roadmap Platform — DCX",
      slug: ROADMAP_SLUGS.dcx,
      description: "Imported from 2026 Roadmap Platform - DCX.xlsx",
      planningYear: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: RoadmapStatus.active,
    },
  });

  const importBatch = await prisma.importBatch.create({
    data: {
      workspaceId,
      roadmapId: roadmap.id,
      sourceFileName: path.basename(filePath),
      importerType: "xlsx-dcx",
      status: "running",
    },
  });

  let sort = 0;
  let imported = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = headerRow0Based + i + 2;
    const initName = get(
      row,
      "Initiative Name",
      "Initiative/Project",
      "Initiative / Project",
      "Initiative",
      "Project",
      "Project Name"
    );
    if (!initName) {
      skipped++;
      await prisma.importRowResult.create({
        data: {
          importBatchId: importBatch.id,
          sheetName: "Data",
          rowNumber,
          entityType: "none",
          entityKey: "",
          status: "skipped",
          message: "Empty initiative name",
          rawPayloadJson: rowPayloadJson(row),
        },
      });
      continue;
    }

    const phase = get(row, "Phase");
    const themeName = get(row, "Theme", "Theme ");
    const sponsor = pickBusinessSponsorFromRow(row);
    const teamsRaw = get(row, "Team(s)", "Teams");
    const start = coerceDate(rowVal(row, "Start Quarter 2026", "Start Date"));
    const end = coerceDate(rowVal(row, "End Quarter 2026", "End Date"));

    const sponsorExtra = sponsor
      ? {
          businessSponsor: sponsor,
          businessSponsorId: await ensureBusinessSponsor(workspaceId, sponsor),
        }
      : {};

    const theme =
      themeName &&
      (await upsertTheme(
        workspaceId,
        themeName,
        undefined,
        themeOrder.counter++,
        roadmap.id
      ));

    const initiative = await upsertInitiative(workspaceId, initName, {
      ...sponsorExtra,
      type: phase || null,
    });
    if (theme) await linkInitiativeTheme(initiative.id, theme.id);

    const item = await prisma.roadmapItem.create({
      data: {
        roadmapId: roadmap.id,
        initiativeId: initiative.id,
        titleOverride: phase ? `${initName} — ${phase}` : null,
        status: ItemStatus.not_started,
        startDate: start,
        endDate: end,
        laneKey: teamsRaw || phase || null,
        sortOrder: sort++,
      },
    });

    if (phase) {
      await prisma.phaseSegment.create({
        data: {
          roadmapItemId: item.id,
          phaseName: phase,
          startDate: start,
          endDate: end,
        },
      });
    }

    const teamIds = await ensureTeams(teamsRaw);
    for (const teamId of teamIds) {
      await prisma.roadmapItemTeam.create({
        data: { roadmapItemId: item.id, teamId },
      });
    }

    imported++;
    await prisma.importRowResult.create({
      data: {
        importBatchId: importBatch.id,
        sheetName: "Data",
        rowNumber,
        entityType: "roadmap_item",
        entityKey: initName,
        status: "imported",
        rawPayloadJson: rowPayloadJson(row),
      },
    });
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      summaryJson: { rows: rows.length, imported, skipped },
    },
  });

  return roadmap.id;
}

async function importCet(
  workspaceId: string,
  filePath: string,
  themeOrder: { counter: number }
) {
  const wb = XLSX.readFile(filePath);

  const descEntries: InitiativeDescriptionEntry[] = [];
  const descWs = sheetByNameCI(wb, "Initiative Descriptions");
  if (descWs) {
    for (const row of sheetRows(descWs)) {
      const init = get(row, "Initiative");
      if (!init) continue;
      descEntries.push({
        name: init,
        short: get(row, "Succinct Business Objective (For Tracking Sheets)") || undefined,
        long: get(row, "Detailed Business Objective (For Slides)") || undefined,
        pillar: get(row, "Strategic Pillar") || undefined,
      });
    }
  }
  const descIndex = buildInitiativeDescriptionIndex(descEntries);

  const cetThemeObjectives = new Map<string, string>();
  const themesWs = sheetByNameCI(wb, "Strategic Themes");
  if (themesWs) {
    for (const row of sheetRows(themesWs)) {
      const pillar = get(row, "Strategic Pillar");
      const obj = get(row, "Pillar Objective");
      const included = get(row, "Initiatives Included");
      if (pillar) {
        const parts: string[] = [];
        if (obj) parts.push(obj);
        if (included) parts.push(`Initiatives included: ${included}`);
        const combined = parts.length ? parts.join("\n\n") : "";
        if (combined) cetThemeObjectives.set(pillar, combined);
        await upsertTheme(
          workspaceId,
          pillar,
          combined || undefined,
          themeOrder.counter++,
          null
        );
      }
    }
  }

  const dataWs = sheetByNameCI(wb, "Data");
  if (!dataWs) throw new Error("CET: missing 'Data' sheet");
  const { rows, headerRow0Based } = sheetRowsWithHeader(dataWs);

  const roadmap = await prisma.roadmap.create({
    data: {
      workspaceId,
      name: "2026 Roadmap Platform — CET Sales & Marketing (DRAFT)",
      slug: ROADMAP_SLUGS.cet,
      description:
        "Imported from 2026 Roadmap Platform (DRAFT) - CET Sales and Marketing.xlsx",
      planningYear: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: RoadmapStatus.draft,
    },
  });

  const importBatch = await prisma.importBatch.create({
    data: {
      workspaceId,
      roadmapId: roadmap.id,
      sourceFileName: path.basename(filePath),
      importerType: "xlsx-cet",
      status: "running",
    },
  });

  let sort = 0;
  let imported = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = headerRow0Based + i + 2;
    const initName = get(
      row,
      "Initiative/Project",
      "Initiative / Project",
      "Initiative Name",
      "Initiative",
      "Project",
      "Project Name"
    );
    if (!initName) {
      skipped++;
      await prisma.importRowResult.create({
        data: {
          importBatchId: importBatch.id,
          sheetName: "Data",
          rowNumber,
          entityType: "none",
          entityKey: "",
          status: "skipped",
          message: "Empty initiative/project",
          rawPayloadJson: rowPayloadJson(row),
        },
      });
      continue;
    }

    const phase = get(row, "Phase");
    const teamsRaw = get(row, "Teams", "Team(s)");
    const start = coerceDate(rowVal(row, "Start Date"));
    const end = coerceDate(rowVal(row, "End Date"));
    const typ = get(row, "Type");
    const statusRaw = get(row, "Status");
    const notes = get(row, "Notes");
    const jira = get(row, "Jira");
    const themeName = get(row, "Theme");
    const businessObjective = get(row, "Business Objective");
    const sponsor = pickBusinessSponsorFromRow(row);
    const cap = parsePercent(rowVal(row, "Capacity Allocation Estimate"));
    const sprints = parseSprintEstimate(rowVal(row, "# of Sprints Estimate"));

    const desc = resolveInitiativeDescription(
      initName,
      themeName || undefined,
      descIndex,
      INITIATIVE_DESCRIPTION_ALIASES_CET
    );
    const sponsorExtra = sponsor
      ? {
          businessSponsor: sponsor,
          businessSponsorId: await ensureBusinessSponsor(workspaceId, sponsor),
        }
      : {};

    const theme =
      themeName &&
      (await upsertTheme(
        workspaceId,
        themeName,
        cetThemeObjectives.get(themeName) || undefined,
        themeOrder.counter++,
        roadmap.id
      ));

    const initiative = await upsertInitiative(workspaceId, initName, {
      ...sponsorExtra,
      shortObjective:
        desc?.short ??
        (businessObjective ? businessObjective.slice(0, 500) : null),
      detailedObjective: desc?.long ?? (businessObjective || null),
      type: typ || null,
      notes: notes || null,
      sourceSystem: jira ? "jira" : null,
      sourceReference: jira || null,
    });
    if (theme) await linkInitiativeTheme(initiative.id, theme.id);

    if (jira) {
      const exists = await integrationHasExternalLink(workspaceId, {
        entityType: "initiative",
        entityId: initiative.id,
        provider: "jira",
        externalId: jira,
      });
      if (!exists) {
        try {
          await integrationCreateExternalLink({
            workspaceId,
            entityType: "initiative",
            entityId: initiative.id,
            provider: "jira",
            externalId: jira,
            externalUrl: jira.includes("://") ? jira : `jira:${jira}`,
            syncState: "linked",
            metadataJson: { source: "xlsx-cet" },
          });
        } catch (e) {
          console.warn("integrationCreateExternalLink:", e);
        }
      }
    }

    const item = await prisma.roadmapItem.create({
      data: {
        roadmapId: roadmap.id,
        initiativeId: initiative.id,
        titleOverride: phase ? `${initName} — ${phase}` : null,
        status: mapItemStatus(statusRaw),
        startDate: start,
        endDate: end,
        laneKey: teamsRaw || phase || null,
        sortOrder: sort++,
      },
    });

    if (phase) {
      const def = await ensurePhaseDefinitionByName(prisma, workspaceId, phase);
      await prisma.phaseSegment.create({
        data: {
          roadmapItemId: item.id,
          phaseName: def.name,
          phaseDefinitionId: def.id,
          startDate: start,
          endDate: end,
          capacityAllocationEstimate: cap ?? undefined,
          sprintEstimate: sprints ?? undefined,
          jiraKey: jira || null,
          notes: notes || null,
        },
      });
    }

    const teamIds = await ensureTeams(teamsRaw);
    for (const teamId of teamIds) {
      await prisma.roadmapItemTeam.create({
        data: { roadmapItemId: item.id, teamId },
      });
    }

    imported++;
    await prisma.importRowResult.create({
      data: {
        importBatchId: importBatch.id,
        sheetName: "Data",
        rowNumber,
        entityType: "roadmap_item",
        entityKey: initName,
        status: "imported",
        rawPayloadJson: rowPayloadJson(row),
      },
    });
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      summaryJson: { rows: rows.length, imported, skipped },
    },
  });

  return roadmap.id;
}

async function main() {
  const dataDir = repoDataDir();
  if (!fs.existsSync(dataDir)) {
    console.error("Data directory not found:", dataDir);
    process.exit(1);
  }

  const dcxPath = resolveDataFile(dataDir, [
    "2026 Roadmap Platform - DCX.xlsx",
    "2026 Project Roadmap - DCX.xlsx",
    "2026 Product Roadmap - DCX.xlsx",
  ]);
  const cetPath = resolveDataFile(dataDir, [
    "2026 Roadmap Platform (DRAFT) - CET Sales and Marketing.xlsx",
    "2026 Project Roadmap (DRAFT) - CET Sales and Marketing.xlsx",
    "2026 Product Roadmap (DRAFT) - CET Sales and Marketing.xlsx",
  ]);

  const workspace = await ensureWorkspace();
  console.log("Workspace:", workspace.slug, workspace.id);

  await wipeImportWorkspace(workspace.id);
  console.log("Cleared previous excel-import workspace data.");

  const themeOrder = { counter: 0 };
  await importDcx(workspace.id, dcxPath, themeOrder);
  console.log("Imported DCX workbook.");
  await importCet(workspace.id, cetPath, themeOrder);
  console.log("Imported CET workbook.");

  console.log("Done. Roadmap slugs:", ROADMAP_SLUGS);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
