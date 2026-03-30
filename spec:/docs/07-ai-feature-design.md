# AI Feature Design

## Positioning
AI should make planning artifacts easier to create and maintain.
It should not silently change planning commitments.

## AI use cases
- initiative drafting
- classification
- quality checks
- summaries

## AI architecture

**Current implementation notes:**
- **`ai-service`** exposes task endpoints (objective, summarize, classify, quality-check, executive-summary).
- **`portfolio-service`** stores **`WorkspaceAiSettings`** (provider, models, optional API key overrides).
- **`api-gateway`** may attach an internal **`_aiRuntime`** payload (from `GET /internal/workspaces/:id/ai-runtime`) when calling **`POST /api/ai/executive-summary`**, so narratives can use workspace-specific keys/models.
- **`GET /api/ai/status`** merges environment configuration with workspace public settings for the UI.

**Design intent (still applies):**
- prompts stored in versioned templates (not all flows are template-driven yet)
- retrieval pulls only relevant entities for context
- human must accept generated content before persistence

## Guardrails
- no autonomous writes without approval
- prompt / response logging
- sensitive fields excluded by policy
- deterministic validation for structured outputs
