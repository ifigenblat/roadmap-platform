import { Prisma } from "./generated/prisma/index.js";
import type { PrismaClient } from "./generated/prisma/index.js";

export async function ensurePhaseDefinitionByName(
  prisma: PrismaClient,
  workspaceId: string,
  rawName: string
): Promise<{ id: string; name: string }> {
  const name = rawName.trim();
  if (!name) throw new Error("Phase name is empty");

  const existing = await prisma.phaseDefinition.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) return { id: existing.id, name: existing.name };

  const agg = await prisma.phaseDefinition.aggregate({
    where: { workspaceId },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? 0) + 1;
  try {
    const created = await prisma.phaseDefinition.create({
      data: { workspaceId, name, sortOrder },
    });
    return { id: created.id, name: created.name };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.phaseDefinition.findUnique({
        where: { workspaceId_name: { workspaceId, name } },
      });
      if (again) return { id: again.id, name: again.name };
    }
    throw e;
  }
}

export type ResolvedPhaseFields =
  | { ok: true; phaseName: string; phaseDefinitionId: string | null }
  | { ok: false; message: string; status: number };

/** Resolve phaseDefinitionId and/or phaseName for a segment in the given workspace. */
export async function resolvePhaseFieldsForWorkspace(
  prisma: PrismaClient,
  workspaceId: string,
  input: { phaseDefinitionId?: string | undefined; phaseName?: string | undefined }
): Promise<ResolvedPhaseFields> {
  const defId = input.phaseDefinitionId?.trim();
  const rawName = input.phaseName?.trim();

  if (defId) {
    const def = await prisma.phaseDefinition.findUnique({ where: { id: defId } });
    if (!def || def.workspaceId !== workspaceId) {
      return { ok: false, message: "Invalid phase definition for this workspace.", status: 400 };
    }
    return { ok: true, phaseName: def.name, phaseDefinitionId: def.id };
  }

  if (rawName) {
    return { ok: true, phaseName: rawName, phaseDefinitionId: null };
  }

  return {
    ok: false,
    message: "Select a workspace phase or provide a phase name.",
    status: 400,
  };
}
