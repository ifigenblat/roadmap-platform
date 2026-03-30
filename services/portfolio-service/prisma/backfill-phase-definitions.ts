/**
 * One-off: create PhaseDefinition rows for existing PhaseSegment.phaseName values
 * and link segments. Safe to run multiple times (skips already-linked segments).
 *
 *   npx tsx prisma/backfill-phase-definitions.ts
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { ensurePhaseDefinitionByName } from "../src/phase-definition-helpers.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const prisma = new PrismaClient();

async function main() {
  const segments = await prisma.phaseSegment.findMany({
    where: { phaseDefinitionId: null },
    include: { roadmapItem: { include: { roadmap: true } } },
  });
  let linked = 0;
  for (const seg of segments) {
    const ws = seg.roadmapItem.roadmap.workspaceId;
    const def = await ensurePhaseDefinitionByName(prisma, ws, seg.phaseName);
    await prisma.phaseSegment.update({
      where: { id: seg.id },
      data: { phaseDefinitionId: def.id, phaseName: def.name },
    });
    linked++;
  }
  console.log(`Backfill complete: linked ${linked} segment(s) to workspace phase definitions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
