import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PrismaClient,
  Priority,
  RoadmapStatus,
  ItemStatus,
} from "../src/generated/prisma/index.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Workspace", slug: "default" }
  });

  const tplBase = process.env.TEMPLATE_SERVICE_URL || "http://localhost:4200";
  const tplRes = await fetch(`${tplBase}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: workspace.id,
      name: "Standard Product Roadmap",
      description: "Quarterly planning template",
    }),
  });
  if (!tplRes.ok) {
    throw new Error(
      `template-service (${tplBase}): ${tplRes.status} ${await tplRes.text()} — start template-service before seed`
    );
  }
  const template = (await tplRes.json()) as { id: string };

  const roadmap = await prisma.roadmap.create({
    data: {
      workspaceId: workspace.id,
      templateId: template.id,
      name: "2026 Product Roadmap",
      slug: "2026-product-roadmap",
      description: "Imported starter roadmap",
      planningYear: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: RoadmapStatus.active,
      ownerUserId: null,
      archivedAt: null
    }
  });

  const theme = await prisma.strategicTheme.create({
    data: {
      workspaceId: workspace.id,
      roadmapId: roadmap.id,
      name: "Customer Experience",
      objective: "Reduce friction across customer journeys",
      colorToken: "indigo"
    }
  });

  const initiative = await prisma.initiative.create({
    data: {
      workspaceId: workspace.id,
      canonicalName: "Unified Customer Portal",
      shortObjective: "Consolidate account and service workflows",
      detailedObjective: "Create a single front door for account management, service discovery, and self-service.",
      businessSponsor: "Chief Product Officer",
      type: "platform"
    }
  });

  await prisma.initiativeTheme.create({
    data: { initiativeId: initiative.id, strategicThemeId: theme.id }
  });

  const item = await prisma.roadmapItem.create({
    data: {
      roadmapId: roadmap.id,
      initiativeId: initiative.id,
      status: ItemStatus.in_progress,
      priority: Priority.high,
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-08-30"),
      laneKey: "platform",
      sortOrder: 1,
      targetOutcome: "20% faster customer task completion"
    }
  });

  await prisma.phaseSegment.createMany({
    data: [
      { roadmapItemId: item.id, phaseName: "Discovery", startDate: new Date("2026-01-15"), endDate: new Date("2026-03-01") },
      { roadmapItemId: item.id, phaseName: "Build", startDate: new Date("2026-03-02"), endDate: new Date("2026-06-15") },
      { roadmapItemId: item.id, phaseName: "Launch", startDate: new Date("2026-06-16"), endDate: new Date("2026-08-30") }
    ]
  });
}

main().finally(async () => prisma.$disconnect());
