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
- AI service exposes task-based endpoints
- prompts stored in versioned templates
- retrieval pulls only relevant entities for context
- human must accept generated content before persistence

## Guardrails
- no autonomous writes without approval
- prompt / response logging
- sensitive fields excluded by policy
- deterministic validation for structured outputs
