# Cursor Master Instructions

Use this package as the source of truth.

## Your mission
Generate a production-oriented monorepo for **Roadmap Platform** with:
- **Vite + React** SPA (`client/`), React Router
- **Express** backend services (portfolio, template, integration, AI, **gateway**) — not NestJS in the current codebase
- PostgreSQL (schema-per-service Prisma apps)
- Redis — optional / future for queues (imports are synchronous today)
- Docker Compose
- npm workspaces + **Turborepo** for task orchestration
- OpenAPI-first contracts (gateway also serves static OpenAPI; see `05-api-contracts.md`)
- Prisma schemas
- clean architecture inside each service
- RBAC — target; not fully implemented in the current app shell
- import pipeline for spreadsheet roadmaps
- timeline-centric UI (grid + timeline + executive views)

## Product rules
- roadmap timeline is a derived view from roadmap item + phase segments
- initiative is reusable across multiple roadmaps
- templates can seed roadmaps, phases, themes, and statuses
- AI suggestions require explicit human acceptance
- integrations are adapters
