import { Router } from "express";
import {
  createWorkspaceSchema,
  patchWorkspaceAiSettingsSchema,
  patchWorkspaceSchema,
} from "@roadmap/types";
import { prisma } from "../db.js";
import { requireAdminForWorkspaceCreate } from "../gatewayAuth.js";

export const workspacesRouter = Router();

function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 80) : "workspace";
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base.slice(0, 80);
  let n = 0;
  for (;;) {
    const trySlug = n === 0 ? candidate : `${candidate}-${n}`.slice(0, 100);
    const exists = await prisma.workspace.findUnique({ where: { slug: trySlug } });
    if (!exists) return trySlug;
    n++;
  }
}

workspacesRouter.get("/workspaces", async (_req, res) => {
  const rows = await prisma.workspace.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

workspacesRouter.post("/workspaces", requireAdminForWorkspaceCreate, async (req, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { name, slug: slugIn } = parsed.data;
  let slug: string;
  if (slugIn) {
    const taken = await prisma.workspace.findUnique({ where: { slug: slugIn } });
    if (taken) return res.status(409).json({ message: `Slug "${slugIn}" is already in use.` });
    slug = slugIn;
  } else {
    slug = await uniqueSlug(slugifyName(name));
  }
  const row = await prisma.workspace.create({
    data: { name: name.trim(), slug },
  });
  res.status(201).json(row);
});

workspacesRouter.get("/workspaces/:id/ai-settings", async (req, res) => {
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });
  const row = await prisma.workspaceAiSettings.findUnique({
    where: { workspaceId: req.params.id },
  });
  const aiProv = row?.aiProvider?.trim().toLowerCase();
  const aiProvider = aiProv === "gemini" ? "gemini" : "openai";
  const kind = row?.localOpenAiKind?.trim();
  const allowedKind = ["ollama", "lmstudio", "localai", "llamacpp", "custom"].includes(kind ?? "")
    ? kind
    : null;
  res.json({
    workspaceId: req.params.id,
    aiProvider,
    openaiModel: row?.openaiModel ?? "",
    geminiModel: row?.geminiModel ?? "",
    maxTokens: row?.maxTokens ?? null,
    temperature: row?.temperature ?? null,
    hasApiKeyOverride: Boolean(row?.openaiApiKey?.trim()),
    hasGeminiApiKeyOverride: Boolean(row?.geminiApiKey?.trim()),
    openaiCompatibleBaseUrl: row?.openaiCompatibleBaseUrl?.trim() ?? "",
    localOpenAiKind: allowedKind,
  });
});

workspacesRouter.patch("/workspaces/:id/ai-settings", async (req, res) => {
  const parsed = patchWorkspaceAiSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });

  const {
    aiProvider,
    openaiModel,
    geminiModel,
    maxTokens,
    temperature,
    openaiApiKey,
    geminiApiKey,
    openaiCompatibleBaseUrl,
    localOpenAiKind,
  } = parsed.data;
  const hasAnyField =
    aiProvider !== undefined ||
    openaiModel !== undefined ||
    geminiModel !== undefined ||
    maxTokens !== undefined ||
    temperature !== undefined ||
    openaiApiKey !== undefined ||
    geminiApiKey !== undefined ||
    openaiCompatibleBaseUrl !== undefined ||
    localOpenAiKind !== undefined;
  if (!hasAnyField) {
    const row = await prisma.workspaceAiSettings.findUnique({
      where: { workspaceId: req.params.id },
    });
    const ap = row?.aiProvider?.trim().toLowerCase() === "gemini" ? "gemini" : "openai";
    const k0 = row?.localOpenAiKind?.trim();
    const allowed0 = ["ollama", "lmstudio", "localai", "llamacpp", "custom"].includes(k0 ?? "")
      ? k0
      : null;
    return res.json({
      workspaceId: req.params.id,
      aiProvider: ap,
      openaiModel: row?.openaiModel ?? "",
      geminiModel: row?.geminiModel ?? "",
      maxTokens: row?.maxTokens ?? null,
      temperature: row?.temperature ?? null,
      hasApiKeyOverride: Boolean(row?.openaiApiKey?.trim()),
      hasGeminiApiKeyOverride: Boolean(row?.geminiApiKey?.trim()),
      openaiCompatibleBaseUrl: row?.openaiCompatibleBaseUrl?.trim() ?? "",
      localOpenAiKind: allowed0,
    });
  }

  const data: {
    aiProvider?: string | null;
    openaiModel?: string | null;
    geminiModel?: string | null;
    maxTokens?: number | null;
    temperature?: number | null;
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
    openaiCompatibleBaseUrl?: string | null;
    localOpenAiKind?: string | null;
  } = {};

  if (aiProvider !== undefined) {
    data.aiProvider = aiProvider;
  }
  if (openaiModel !== undefined) {
    const t = openaiModel.trim();
    data.openaiModel = t.length > 0 ? t : null;
  }
  if (geminiModel !== undefined) {
    const t = geminiModel.trim();
    data.geminiModel = t.length > 0 ? t : null;
  }
  if (maxTokens !== undefined) {
    data.maxTokens = maxTokens;
  }
  if (temperature !== undefined) {
    data.temperature = temperature;
  }
  if (openaiApiKey !== undefined) {
    const t = openaiApiKey.trim();
    data.openaiApiKey = t.length > 0 ? t : null;
  }
  if (geminiApiKey !== undefined) {
    const t = geminiApiKey.trim();
    data.geminiApiKey = t.length > 0 ? t : null;
  }
  if (openaiCompatibleBaseUrl !== undefined) {
    const t = openaiCompatibleBaseUrl.trim();
    data.openaiCompatibleBaseUrl = t.length > 0 ? t : null;
  }
  if (localOpenAiKind !== undefined) {
    data.localOpenAiKind = localOpenAiKind;
  }

  const row = await prisma.workspaceAiSettings.upsert({
    where: { workspaceId: req.params.id },
    create: {
      workspaceId: req.params.id,
      aiProvider: data.aiProvider !== undefined ? data.aiProvider : null,
      openaiModel: data.openaiModel !== undefined ? data.openaiModel : null,
      geminiModel: data.geminiModel !== undefined ? data.geminiModel : null,
      maxTokens: data.maxTokens !== undefined ? data.maxTokens : null,
      temperature: data.temperature !== undefined ? data.temperature : null,
      openaiApiKey: data.openaiApiKey !== undefined ? data.openaiApiKey : null,
      geminiApiKey: data.geminiApiKey !== undefined ? data.geminiApiKey : null,
      openaiCompatibleBaseUrl:
        data.openaiCompatibleBaseUrl !== undefined ? data.openaiCompatibleBaseUrl : null,
      localOpenAiKind: data.localOpenAiKind !== undefined ? data.localOpenAiKind : null,
    },
    update: {
      ...(data.aiProvider !== undefined ? { aiProvider: data.aiProvider } : {}),
      ...(data.openaiModel !== undefined ? { openaiModel: data.openaiModel } : {}),
      ...(data.geminiModel !== undefined ? { geminiModel: data.geminiModel } : {}),
      ...(data.maxTokens !== undefined ? { maxTokens: data.maxTokens } : {}),
      ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
      ...(data.openaiApiKey !== undefined ? { openaiApiKey: data.openaiApiKey } : {}),
      ...(data.geminiApiKey !== undefined ? { geminiApiKey: data.geminiApiKey } : {}),
      ...(data.openaiCompatibleBaseUrl !== undefined
        ? { openaiCompatibleBaseUrl: data.openaiCompatibleBaseUrl }
        : {}),
      ...(data.localOpenAiKind !== undefined ? { localOpenAiKind: data.localOpenAiKind } : {}),
    },
  });

  const apOut = row.aiProvider?.trim().toLowerCase() === "gemini" ? "gemini" : "openai";
  const kOut = row.localOpenAiKind?.trim();
  const allowedOut = ["ollama", "lmstudio", "localai", "llamacpp", "custom"].includes(kOut ?? "")
    ? kOut
    : null;
  res.json({
    workspaceId: req.params.id,
    aiProvider: apOut,
    openaiModel: row.openaiModel ?? "",
    geminiModel: row.geminiModel ?? "",
    maxTokens: row.maxTokens ?? null,
    temperature: row.temperature ?? null,
    hasApiKeyOverride: Boolean(row.openaiApiKey?.trim()),
    hasGeminiApiKeyOverride: Boolean(row.geminiApiKey?.trim()),
    openaiCompatibleBaseUrl: row.openaiCompatibleBaseUrl?.trim() ?? "",
    localOpenAiKind: allowedOut,
  });
});

workspacesRouter.patch("/workspaces/:id", async (req, res) => {
  const parsed = patchWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });
  if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
    const taken = await prisma.workspace.findUnique({ where: { slug: parsed.data.slug } });
    if (taken) return res.status(409).json({ message: `Slug "${parsed.data.slug}" is already in use.` });
  }
  const updated = await prisma.workspace.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
    },
  });
  res.json(updated);
});

workspacesRouter.delete("/workspaces/:id", async (req, res) => {
  const existing = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Workspace not found" });
  if (existing.slug === "default") {
    return res.status(400).json({ message: "The default workspace cannot be deleted." });
  }
  const [roadmaps, initiatives, themes, phaseDefinitions, sponsors, imports] = await Promise.all([
    prisma.roadmap.count({ where: { workspaceId: req.params.id } }),
    prisma.initiative.count({ where: { workspaceId: req.params.id } }),
    prisma.strategicTheme.count({ where: { workspaceId: req.params.id } }),
    prisma.phaseDefinition.count({ where: { workspaceId: req.params.id } }),
    prisma.businessSponsor.count({ where: { workspaceId: req.params.id } }),
    prisma.importBatch.count({ where: { workspaceId: req.params.id } }),
  ]);
  const total = roadmaps + initiatives + themes + phaseDefinitions + sponsors + imports;
  if (total > 0) {
    return res.status(409).json({
      message:
        "Workspace still has data (roadmaps, initiatives, themes, phases, sponsors, or imports). Remove or reassign them first.",
      counts: {
        roadmaps,
        initiatives,
        themes,
        phaseDefinitions,
        sponsors,
        imports,
      },
    });
  }
  await prisma.workspace.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
