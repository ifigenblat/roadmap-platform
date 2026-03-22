import type { Request } from "express";
import { prisma } from "./db.js";

/** Optional `?workspaceId=` on list endpoints for tenant-scoped reads. */
export function workspaceIdFromQuery(req: Request): string | undefined {
  const q = req.query.workspaceId;
  return typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;
}

export async function assertRoadmapInitiativeSameWorkspace(
  roadmapId: string,
  initiativeId: string
): Promise<
  | { ok: true; roadmapWorkspaceId: string }
  | { ok: false; status: 400 | 404; message: string }
> {
  const [roadmap, initiative] = await Promise.all([
    prisma.roadmap.findUnique({ where: { id: roadmapId } }),
    prisma.initiative.findUnique({ where: { id: initiativeId } }),
  ]);
  if (!roadmap) return { ok: false, status: 404, message: "Roadmap not found" };
  if (!initiative) return { ok: false, status: 404, message: "Initiative not found" };
  if (roadmap.workspaceId !== initiative.workspaceId) {
    return {
      ok: false,
      status: 400,
      message: "Initiative and roadmap must belong to the same workspace",
    };
  }
  return { ok: true, roadmapWorkspaceId: roadmap.workspaceId };
}

/** When a theme is scoped to a roadmap, the roadmap must belong to the same workspace as the theme. */
export async function assertThemeRoadmapWorkspace(
  themeWorkspaceId: string,
  roadmapId: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: 400 | 404; message: string }> {
  if (roadmapId == null || roadmapId === "") return { ok: true };
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) return { ok: false, status: 404, message: "Roadmap not found" };
  if (roadmap.workspaceId !== themeWorkspaceId) {
    return {
      ok: false,
      status: 400,
      message: "roadmapId must reference a roadmap in the same workspace as the theme",
    };
  }
  return { ok: true };
}

export async function assertBusinessSponsorInWorkspace(
  sponsorId: string,
  workspaceId: string
): Promise<{ ok: true } | { ok: false; status: 400 | 404; message: string }> {
  const sponsor = await prisma.businessSponsor.findUnique({ where: { id: sponsorId } });
  if (!sponsor) return { ok: false, status: 404, message: "Business sponsor not found" };
  if (sponsor.workspaceId !== workspaceId) {
    return {
      ok: false,
      status: 400,
      message: "businessSponsorId must belong to the same workspace as the initiative",
    };
  }
  return { ok: true };
}

export function assertEndAfterStart(startIso: string, endIso: string): boolean {
  return new Date(endIso) >= new Date(startIso);
}
