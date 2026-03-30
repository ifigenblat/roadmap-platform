# API Contracts

## External API style
REST with JSON.
Use OpenAPI from day one.

**Implementation:** the API gateway exposes routes under the `/api` prefix (e.g. `GET /api/roadmaps`). Static OpenAPI: `GET /api/openapi.yaml` when the gateway is running, or the file at `spec:/openapi/openapi.yaml`. **Note:** the YAML file may not list every gateway route yet; **`services/api-gateway/src/index.ts`** is the live routing table.

| Concern | Service |
|--------|---------|
| Workspaces, roadmaps, items, phases, initiatives, themes, teams, sponsors, imports | `portfolio-service` (Prisma / Postgres, **`portfolio`** schema) |
| Templates | `template-service` (Prisma / Postgres, **`template`** schema) |
| Integrations + external links | `integration-service` (Prisma / Postgres, **`integration`** schema) |
| AI endpoints | `ai-service` (OpenAI / Gemini via env or injected workspace runtime) |
| Routing / BFF | `gateway` (`services/gateway`) — multipart workbook upload, AI runtime merge for executive narrative |

## Resource sketch (gateway `/api`)

### Workspaces
- GET, POST `/workspaces`
- GET, PATCH, DELETE `/workspaces/:id`
- GET, PATCH `/workspaces/:id/ai-settings` (public-safe fields for UI)

### Roadmaps
- GET `/roadmaps` — optional `?workspaceId=`
- POST `/roadmaps`
- GET, PATCH, DELETE `/roadmaps/:id`
- GET `/roadmaps/:id/items`
- POST `/roadmaps/:id/items`
- GET, POST `/roadmaps/:id/themes`
- GET `/roadmaps/:id/executive-summary` (aggregated theme / initiative / phase health JSON)
- POST `/roadmaps/:id/clone`, `/roadmaps/:id/archive`

### Roadmap items & phases
- GET `/roadmap-items` — optional `?workspaceId=`
- POST `/roadmap-items`
- GET, PATCH `/roadmap-items/:id`
- POST `/roadmap-items/:id/move`
- POST `/roadmap-items/:id/phases`
- PUT `/roadmap-items/:id/teams`
- PATCH `/phase-segments/:id`

### Phase definitions (workspace catalog)
- GET, POST `/phase-definitions` — optional `?workspaceId=`
- PATCH, DELETE `/phase-definitions/:id`

### Initiatives
- GET `/initiatives` — optional `?workspaceId=`
- POST `/initiatives`
- GET, PATCH, DELETE `/initiatives/:id`
- POST `/initiatives/:id/themes`
- DELETE `/initiatives/:id/themes/:themeId`
- PUT `/initiatives/:id/theme-links`

### Themes (global workspace themes)
- GET `/themes` — optional `?workspaceId=`
- POST `/themes`
- GET, PATCH, DELETE `/themes/:id`

### Teams & business sponsors
- GET, POST `/teams`; GET, PATCH, DELETE `/teams/:id`
- GET, POST `/business-sponsors`; GET, PATCH, DELETE `/business-sponsors/:id`

### Templates
- GET, POST `/templates`
- GET `/templates/:id`
- POST `/templates/:id/create-roadmap`

### Imports
- POST `/imports/workbook` (multipart: `file`, optional `workspaceId`, `roadmapId`, `roadmapName`)
- GET `/imports` — optional `?workspaceId=`
- GET `/imports/:id`, `/imports/:id/errors`, `/imports/:id/delete-impact`
- DELETE `/imports/:id`

### Integrations
- GET `/integrations` — optional `?workspaceId=`
- POST `/integrations/jira/connect` — body includes `connectionName` and `config` (`siteUrl`, `email`, `apiToken` for Jira Cloud)
- POST `/integrations/confluence/connect`, `/integrations/cursor/connect` — opaque `config` per provider
- POST `/integrations/:id/sync` — for **Jira**, verifies via Jira Cloud REST v3 `GET /myself`
- GET `/external-links` — optional `?workspaceId=`

### AI
- GET `/ai/status` — optional `?workspaceId=` (merges workspace key hints with env)
- POST `/ai/generate-initiative-objective`, `/ai/summarize-roadmap`, `/ai/classify-theme`, `/ai/quality-check`, `/ai/executive-summary`
