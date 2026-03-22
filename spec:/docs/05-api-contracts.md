# API Contracts

## External API style
REST with JSON.
Use OpenAPI from day one.

**Implementation:** the API gateway exposes the contract under the `/api` prefix (e.g. `GET /api/roadmaps`). OpenAPI document: `GET /api/openapi.yaml` when the gateway is running, or the static file at `spec:/openapi/openapi.yaml`.

| Concern | Service |
|--------|---------|
| Roadmaps, items, initiatives, themes, imports (batch rows) | `portfolio-service` (Prisma / Postgres, `public` tables) |
| Templates | `template-service` (Prisma / Postgres, `svc_template_templates`) |
| Integrations + external links | `integration-service` (Prisma / Postgres, `svc_integration_*`) |
| Import job queue | Redis + `worker` (BullMQ); portfolio enqueues after upload |
| AI endpoints | `ai-service` |
| Routing / BFF | `api-gateway` |

## Resource sketch

### Roadmaps
- GET /roadmaps
- POST /roadmaps
- GET /roadmaps/:id
- PATCH /roadmaps/:id
- POST /roadmaps/:id/clone
- POST /roadmaps/:id/archive

### Roadmap items
- GET /roadmaps/:id/items
- POST /roadmaps/:id/items
- GET /roadmap-items/:id
- PATCH /roadmap-items/:id
- POST /roadmap-items/:id/move
- POST /roadmap-items/:id/phases

### Initiatives
- GET /initiatives
- POST /initiatives
- GET /initiatives/:id
- PATCH /initiatives/:id

### Themes
- GET /roadmaps/:id/themes
- POST /roadmaps/:id/themes
- PATCH /themes/:id

### Templates
- GET /templates
- POST /templates
- GET /templates/:id
- POST /templates/:id/create-roadmap

### Imports
- POST /imports/workbook
- GET /imports/:id
- GET /imports/:id/errors

### AI
- POST /ai/generate-initiative-objective
- POST /ai/summarize-roadmap
- POST /ai/classify-theme
- POST /ai/quality-check

### Integrations
- GET /integrations
- POST /integrations/jira/connect
- POST /integrations/confluence/connect
- POST /integrations/:id/sync
- GET /external-links
