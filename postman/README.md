# Postman — Roadmap Platform API

Contracts: [spec:/docs/05-api-contracts.md](../spec:/docs/05-api-contracts.md).

## One collection

Import **`postman/Roadmap-Platform.postman_collection.json`** (single file).

| Folder | Purpose |
|--------|---------|
| **A · API Gateway** | **`http://localhost:4010`** — `/api/*`, `/health`, `/api/openapi.yaml`. This matches what the **Vite** SPA calls via proxy. |
| **B · Direct services & internal** | Same REST shapes on portfolio `4110`, template `4210`, integration `4410`, ai `4310`, worker `4510`, plus internal routes (`x-internal-key`). |

Request URLs are **literal** (no `{{baseUrl}}`), so they work without selecting an environment.

### Vite dev client (same API, different origin)

With **`npm run dev`**, the SPA defaults to **`http://localhost:3001`** and proxies **`/api`** → gateway **`4010`**. In Postman you can either keep calling **`http://localhost:4010/api/...`** (recommended for API testing) or use **`http://localhost:3001/api/...`** to match the browser. If you set **`VITE_DEV_PORT`**, use that port instead of the default **3001**.

If the gateway enforces JWT (**`JWT_ENFORCE_GATEWAY=1`** and **`JWT_SECRET`** in root `.env`), add **`Authorization: Bearer <token>`** to `/api/*` requests (not required for typical local dev).

## Prerequisites

1. Postgres + `prisma db push` for portfolio, template, and integration services (see root `README.md`).
2. Services running (e.g. `npm run dev`): gateway `4010`, portfolio `4110`, template `4210`, ai `4310`, integration `4410`, worker `4510`, Vite `3001` (default), Redis for the worker/queues.
3. Optional: **`npm run verify:stack`** from the repo root checks **`/health`** on each service after startup.

## Optional environment

Import **`postman/environment/Local.postman_environment.json`** if you want the same ID variables in an **environment** as well as on the collection. Collection variables are already defined on **Roadmap Platform**; you only need the environment if you prefer that workflow.

## Collection variables

Set these on the collection (or mirror them in the environment):

| Variable | Use |
|----------|-----|
| `roadmapId`, `itemId`, `initiativeId`, `themeId`, `templateId`, `importBatchId`, `integrationId`, `workspaceId`, `teamId`, `businessSponsorId`, `phaseSegmentId` | Paste from API responses |
| `internalApiKey` | Must match root `INTERNAL_API_KEY` when internal routes require `x-internal-key` |

Newer routes in the collection include **`PUT`** `…/roadmap-items/:id/teams`, **`PATCH`** `…/phase-segments/:id`, and **`PUT`** `…/initiatives/:id/theme-links` (gateway + direct portfolio `4110`).

**Note:** `POST …/create-roadmap` and `POST …/roadmaps` need **unique** `slug` values if you repeat calls.

## Regenerating the collection

The repo ships the merged JSON. To rebuild from scratch (e.g. after splitting sources again), you would need to re-run a merge script; today the source of truth is **`Roadmap-Platform.postman_collection.json`** itself.
