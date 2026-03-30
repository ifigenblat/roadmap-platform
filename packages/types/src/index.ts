import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  /** Lowercase letters, numbers, hyphens. Omit to derive from name. */
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
});

export const patchWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
});

export const aiWorkspaceProviderSchema = z.enum(["openai", "gemini"]);

export const localOpenAiKindSchema = z.enum(["ollama", "lmstudio", "localai", "llamacpp", "custom"]);

/** Public GET /workspaces/:id/ai-settings — safe for browser */
export const workspaceAiSettingsPublicSchema = z.object({
  workspaceId: z.string(),
  aiProvider: aiWorkspaceProviderSchema,
  openaiModel: z.string(),
  geminiModel: z.string(),
  maxTokens: z.number().int().nullable(),
  temperature: z.number().nullable(),
  hasApiKeyOverride: z.boolean(),
  hasGeminiApiKeyOverride: z.boolean(),
  openaiCompatibleBaseUrl: z.string(),
  localOpenAiKind: localOpenAiKindSchema.nullable(),
});

/** PATCH /workspaces/:id/ai-settings */
export const patchWorkspaceAiSettingsSchema = z.object({
  aiProvider: aiWorkspaceProviderSchema.optional(),
  /** Empty string clears override (use env / default). */
  openaiModel: z.string().max(200).optional(),
  geminiModel: z.string().max(200).optional(),
  maxTokens: z.union([z.number().int().min(1).max(128000), z.null()]).optional(),
  temperature: z.union([z.number().min(0).max(2), z.null()]).optional(),
  /** Empty string removes stored key; omit to leave unchanged. */
  openaiApiKey: z.string().max(2048).optional(),
  geminiApiKey: z.string().max(2048).optional(),
  /** e.g. http://127.0.0.1:11434/v1 — empty string clears (use hosted OpenAI only). */
  openaiCompatibleBaseUrl: z.string().max(500).optional(),
  /** Which local stack (for UI / docs only). */
  localOpenAiKind: localOpenAiKindSchema.nullable().optional(),
});

/** Injected by gateway (never send from browser directly). */
export const aiRuntimeSchema = z.object({
  provider: aiWorkspaceProviderSchema.optional(),
  model: z.string().optional(),
  geminiModel: z.string().optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  openaiApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  /** OpenAI-compatible HTTP API (Ollama, LM Studio, etc.) */
  openaiCompatibleBaseUrl: z.string().optional(),
  localOpenAiKind: z.string().optional(),
});

export const roadmapStatusSchema = z.enum(["draft", "active", "archived"]);
export const itemStatusSchema = z.enum(["not_started", "in_progress", "at_risk", "done"]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const providerSchema = z.enum(["jira", "confluence", "cursor", "azure_devops", "manual"]);

export const roadmapSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string(),
  description: z.string().nullable().optional(),
  planningYear: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  status: roadmapStatusSchema,
  ownerUserId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional()
});

export const initiativeSchema = z.object({
  id: z.string(),
  canonicalName: z.string().min(1),
  shortObjective: z.string().nullable().optional(),
  detailedObjective: z.string().nullable().optional(),
  businessSponsor: z.string().nullable().optional(),
  businessSponsorId: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sourceSystem: z.string().nullable().optional(),
  sourceReference: z.string().nullable().optional()
});

export const strategicThemeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  objective: z.string().nullable().optional(),
  colorToken: z.string().nullable().optional(),
  roadmapId: z.string().nullable().optional(),
  orderIndex: z.number().int().optional()
});

export const teamSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: z.string().nullable().optional(),
  active: z.boolean().optional()
});

export const businessSponsorSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  displayName: z.string().min(1),
  email: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const linkInitiativeToThemeBodySchema = z.object({
  strategicThemeId: z.string().min(1)
});

export const roadmapItemSchema = z.object({
  id: z.string(),
  roadmapId: z.string(),
  initiativeId: z.string(),
  titleOverride: z.string().nullable().optional(),
  status: itemStatusSchema,
  priority: prioritySchema,
  startDate: z.string(),
  endDate: z.string(),
  riskLevel: z.string().nullable().optional(),
  laneKey: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0)
});

export const phaseDefinitionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  sortOrder: z.number().int().default(0),
});

export const createPhaseDefinitionSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
  workspaceId: z.string().optional(),
});

export const patchPhaseDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const phaseSegmentSchema = z.object({
  id: z.string(),
  roadmapItemId: z.string(),
  phaseName: z.string(),
  phaseDefinitionId: z.string().nullable().optional(),
  phaseDefinition: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  startDate: z.string(),
  endDate: z.string(),
  capacityAllocationEstimate: z.number().nullable().optional(),
  sprintEstimate: z.number().nullable().optional(),
  teamSummary: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  jiraKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createRoadmapFieldsSchema = roadmapSchema.omit({ id: true });
export const createRoadmapSchema = createRoadmapFieldsSchema.refine(
  (d) => new Date(d.endDate) >= new Date(d.startDate),
  {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  }
);
export const createInitiativeSchema = initiativeSchema.omit({ id: true });
export const createStrategicThemeSchema = strategicThemeSchema.omit({ id: true });
export const createTeamSchema = teamSchema.omit({ id: true });
export const createBusinessSponsorSchema = businessSponsorSchema.omit({
  id: true,
  workspaceId: true
});
export const createRoadmapItemSchema = roadmapItemSchema.omit({ id: true });

/** Body for POST /roadmaps/:roadmapId/items (roadmapId from URL) */
const createRoadmapItemBodyFieldsSchema = roadmapItemSchema.omit({
  id: true,
  roadmapId: true,
});
export const createRoadmapItemBodySchema = createRoadmapItemBodyFieldsSchema.refine(
  (d) => new Date(d.endDate) >= new Date(d.startDate),
  {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  }
);
export const patchRoadmapSchema = createRoadmapFieldsSchema.partial();
export const patchInitiativeSchema = createInitiativeSchema
  .partial()
  .extend({
    businessSponsorId: z.union([z.string().min(1), z.null()]).optional(),
  });
export const patchStrategicThemeSchema = createStrategicThemeSchema.partial();
export const patchTeamSchema = createTeamSchema.partial();
export const patchBusinessSponsorSchema = createBusinessSponsorSchema.partial();
export const patchRoadmapItemSchema = createRoadmapItemSchema
  .omit({ roadmapId: true })
  .partial();

export const moveRoadmapItemSchema = z
  .object({
    sortOrder: z.number().int().optional(),
    roadmapId: z.string().optional(),
    laneKey: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.sortOrder !== undefined ||
      d.roadmapId !== undefined ||
      d.laneKey !== undefined,
    { message: "Provide sortOrder, roadmapId, and/or laneKey" }
  );

const createPhaseSegmentBodyFieldsSchema = z.object({
  phaseDefinitionId: z.string().min(1).optional(),
  phaseName: z.string().min(1).optional(),
  startDate: z.string(),
  endDate: z.string(),
  capacityAllocationEstimate: z.number().nullable().optional(),
  sprintEstimate: z.number().nullable().optional(),
  teamSummary: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  jiraKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createPhaseSegmentBodySchema = createPhaseSegmentBodyFieldsSchema
  .refine((d) => !!(d.phaseDefinitionId?.trim()) || !!(d.phaseName?.trim()), {
    message: "Select a workspace phase or provide a phase name.",
    path: ["phaseDefinitionId"],
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

/** PATCH /phase-segments/:id */
export const patchPhaseSegmentSchema = createPhaseSegmentBodyFieldsSchema
  .extend({
    phaseDefinitionId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .partial();

/** PUT /roadmap-items/:id/teams — replace team assignments */
export const replaceRoadmapItemTeamsSchema = z.object({
  teamIds: z.array(z.string()),
});

/** PUT /initiatives/:id/theme-links — replace strategic theme links */
export const replaceInitiativeThemeLinksSchema = z.object({
  strategicThemeIds: z.array(z.string()),
});

export const templateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  configJson: z.record(z.unknown()).nullable().optional(),
});

export const createTemplateSchema = templateSchema.omit({ id: true });

export const createRoadmapFromTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  planningYear: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  status: roadmapStatusSchema.optional(),
  ownerUserId: z.string().nullable().optional(),
});

/**
 * Jira Cloud: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 * Auth: Basic with account email + API token (https://id.atlassian.com/manage-profile/security/api-tokens)
 */
export const jiraCloudConnectionConfigSchema = z.object({
  /** Site base URL, e.g. https://your-domain.atlassian.net (no trailing slash) */
  siteUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
});

export const jiraConnectSchema = z.object({
  connectionName: z.string().min(1),
  config: jiraCloudConnectionConfigSchema,
});

/** Opaque config until Confluence shape is defined. */
export const confluenceConnectSchema = z.object({
  connectionName: z.string().min(1),
  config: z.record(z.unknown()),
});

/** Cursor team / Cloud Agents API — store apiKey in config. See https://cursor.com/docs/api */
export const cursorConnectSchema = z.object({
  connectionName: z.string().min(1),
  config: z.record(z.unknown()),
});

export const aiGenerateObjectiveSchema = z.object({
  initiativeName: z.string().min(1),
  context: z.string().optional(),
});

export const aiSummarizeRoadmapSchema = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        status: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  rawText: z.string().optional(),
});

export const aiClassifyThemeSchema = z.object({
  text: z.string().min(1),
  candidateThemes: z.array(z.string()).optional(),
});

export const aiQualityCheckSchema = z.object({
  text: z.string().min(1),
  criteria: z.array(z.string()).optional(),
});

/** Body for POST /ai/executive-summary — client sends bundle from GET /roadmaps/:id/executive-summary */
export const aiExecutiveSummaryBundleSchema = z.object({
  roadmapName: z.string(),
  planningYear: z.number(),
  themes: z.array(
    z.object({
      name: z.string(),
      pillarObjective: z.string().nullable().optional(),
      orderIndex: z.number().optional(),
      initiatives: z.array(
        z.object({
          name: z.string(),
          shortObjective: z.string().nullable().optional(),
          detailedObjective: z.string().nullable().optional(),
          phaseHealth: z.object({
            totalPhases: z.number(),
            byStatus: z.record(z.string(), z.number()),
          }),
        })
      ),
    })
  ),
  ungroupedInitiatives: z.array(
    z.object({
      name: z.string(),
      shortObjective: z.string().nullable().optional(),
      detailedObjective: z.string().nullable().optional(),
      phaseHealth: z.object({
        totalPhases: z.number(),
        byStatus: z.record(z.string(), z.number()),
      }),
    })
  ),
});

export const aiExecutiveSummarySchema = z.object({
  bundle: aiExecutiveSummaryBundleSchema,
  _aiRuntime: aiRuntimeSchema.optional(),
});

export type Workspace = z.infer<typeof workspaceSchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;
export type Initiative = z.infer<typeof initiativeSchema>;
export type StrategicTheme = z.infer<typeof strategicThemeSchema>;
export type Team = z.infer<typeof teamSchema>;
export type BusinessSponsor = z.infer<typeof businessSponsorSchema>;
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;
export type PhaseSegment = z.infer<typeof phaseSegmentSchema>;
export type PhaseDefinition = z.infer<typeof phaseDefinitionSchema>;
export type CreateRoadmapInput = z.infer<typeof createRoadmapSchema>;
export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;
export type CreateStrategicThemeInput = z.infer<typeof createStrategicThemeSchema>;
export type CreateRoadmapItemInput = z.infer<typeof createRoadmapItemSchema>;
export type JiraCloudConnectionConfig = z.infer<
  typeof jiraCloudConnectionConfigSchema
>;
