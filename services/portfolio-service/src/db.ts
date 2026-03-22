import { PrismaClient } from "./generated/prisma/index.js";

export const prisma = new PrismaClient();

/** Ensures API creates always have a workspace (matches seed slug `default`). */
export async function getDefaultWorkspaceId(): Promise<string> {
  const ws = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Workspace", slug: "default" },
  });
  return ws.id;
}
