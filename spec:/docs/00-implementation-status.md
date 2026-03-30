# Implementation status (snapshot)

This document captures the **current** state of the repo as of the last spec refresh. Use it together with the other `docs/*.md` files; older sections in those files may still describe future or aspirational behavior.

## Monorepo and tooling

- **Package manager:** npm workspaces (`client`, `services/*`, `services/shared/postgres`, `packages/*`).
- **Task runner:** Turborepo (`turbo.json`) for `dev`, `build`, `typecheck`, and `lint` across packages.
- **Shared contracts:** `@roadmap/types` (Zod schemas and TypeScript types) consumed by services and the web app.

## Backend services (implemented)

| Service | Stack | Port (default) | Role |
|--------|--------|----------------|------|
| `gateway` (`services/gateway`) | Express (CommonJS), proxies to upstreams | 4010 | BFF: `/api/*`, OpenAPI static file, multipart import forward, AI `executive-summary` merges workspace runtime |
| `portfolio-service` | Express, Prisma, Postgres | 4110 | Roadmaps, items, phases, initiatives, themes, teams, sponsors, imports, workspace AI settings |
| `template-service` | Express, Prisma, Postgres | 4210 | Templates; creates roadmaps in portfolio via internal API |
| `integration-service` | Express (CommonJS), **Sequelize** + Prisma `db push` only for DDL | 4410 | Integration connections, external links; **Jira Cloud** uses REST API v3 over HTTPS |
| `ai-service` | Express | 4310 | Objective, summarize, classify, quality-check, executive-summary; optional OpenAI / Gemini |

**Note:** Architecture docs originally mentioned NestJS; **implemented** services use **Express** unless migrated later.

## Data storage

- One Postgres database with **schema-per-service** Prisma apps (`portfolio`, `template`, `integration` — see `04-data-model.md` and root `.env.example`).
- **Integration** runtime data access uses **Sequelize** in `@roadmap/shared-postgres` (Prisma retained only for `prisma db push` DDL in integration-service).
- Not all originally sketched infrastructure (Redis, BullMQ worker, object storage) is required for the current happy path; imports run **synchronously** in portfolio-service.

## Domain additions (vs early spec)

- **`PhaseDefinition`:** Workspace-wide named phases (sort order); `PhaseSegment` optionally links to a definition; import creates/uses definitions by phase name.
- **`BusinessSponsor`:** Structured sponsors; initiatives reference `businessSponsorId` (legacy string `businessSponsor` still exists for imports).
- **`StrategicTheme.colorToken`:** UI/theming for themes, timeline, and grid accents.
- **`WorkspaceAiSettings`:** Per-workspace AI provider (OpenAI / Gemini), models, and optional API key overrides (gateway loads internal runtime for gated AI calls).

## Web client (Vite + React, JavaScript)

SPA under **`client/`** (port **3001**): React Router, Axios, Tailwind; `/api` proxied to the gateway (`CURSOR_NEW_PROJECT_ARCHITECTURE.md` layout). Screens include sidebar navigation (Dashboard, Roadmaps, Initiatives, Themes, Teams, Phases, sponsors, Imports, Templates, Settings), roadmap grid / timeline / executive views, theme colors, modals, etc.

## Integrations

- **Jira Cloud:** `POST /integrations/jira/connect` stores `config`: `siteUrl`, `email`, `apiToken` (validated in `@roadmap/types`). `POST /integrations/:id/sync` for Jira connections calls **GET `/rest/api/3/myself`** to verify credentials and returns a small user summary (no third-party npm Jira SDK — direct REST).
- **Confluence / Cursor:** Connections stored; Confluence and Cursor sync behavior remains minimal vs Jira verify path.
- **Gateway:** Also exposes `POST /api/integrations/cursor/connect`.

## API surface

Authoritative routing list: **`services/gateway/src/index.js`**. OpenAPI file `spec:/openapi/openapi.yaml` may lag; contracts doc `05-api-contracts.md` is updated to list major resources.

## Product requirements vs code

Many **MVP** items in `02-product-requirements.md` are still **goals** (global search, collaboration, exports, full permission model). The **snapshot** above reflects what is **implemented in code**, not a full MVP sign-off.
