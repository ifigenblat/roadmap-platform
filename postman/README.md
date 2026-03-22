# Postman — Roadmap Platform API

Contracts: [spec:/docs/05-api-contracts.md](../spec:/docs/05-api-contracts.md).

## One collection

Import **`postman/Roadmap-Platform.postman_collection.json`** (single file).

| Folder | Purpose |
|--------|---------|
| **A · API Gateway** | Normal path: `http://localhost:4000` with `/api/*` (and `/health`, OpenAPI). |
| **B · Direct services & internal** | Same REST shapes on portfolio `4100`, template `4200`, integration `4400`, ai `4300`, worker `4500`, plus internal routes (`x-internal-key`). |

Request URLs are **literal** (no `{{baseUrl}}`), so they work without selecting an environment.

## Prerequisites

1. Postgres + `prisma db push` for portfolio, template, and integration services (see root `README.md`).
2. Services running (e.g. `npm run dev`): gateway `4000`, portfolio `4100`, template `4200`, ai `4300`, integration `4400`, worker `4500`, Redis if you use imports.

## Optional environment

Import **`postman/environment/Local.postman_environment.json`** if you want the same ID variables in an **environment** as well as on the collection. Collection variables are already defined on **Roadmap Platform**; you only need the environment if you prefer that workflow.

## Collection variables

Set these on the collection (or mirror them in the environment):

| Variable | Use |
|----------|-----|
| `roadmapId`, `itemId`, `initiativeId`, `themeId`, `templateId`, `importBatchId`, `integrationId`, `workspaceId`, `teamId`, `businessSponsorId`, `phaseSegmentId` | Paste from API responses |
| `internalApiKey` | Must match root `INTERNAL_API_KEY` when internal routes require `x-internal-key` |

Newer routes in the collection include **`PUT`** `…/roadmap-items/:id/teams`, **`PATCH`** `…/phase-segments/:id`, and **`PUT`** `…/initiatives/:id/theme-links` (gateway + direct portfolio `4100`).

**Note:** `POST …/create-roadmap` and `POST …/roadmaps` need **unique** `slug` values if you repeat calls.

## Regenerating the collection

The repo ships the merged JSON. To rebuild from scratch (e.g. after splitting sources again), you would need to re-run a merge script; today the source of truth is **`Roadmap-Platform.postman_collection.json`** itself.
