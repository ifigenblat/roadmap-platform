# System Architecture

## Architecture style
A pragmatic **microservice-ready platform** using:
- a web frontend
- an API gateway / BFF
- domain services by bounded context
- an event bus for cross-service workflows
- a single Postgres cluster with schema-per-service in early stages
- Redis for caching and async coordination
- object storage for imports / exports

## Recommended stack

### Frontend (as implemented)
- **Vite** + React (`client/`), **Axios**, React Router, Tailwind; screens under `client/src/pages/` (add react-hook-form + zod when you need schema-driven forms)
- Shared **`@roadmap/types`** (Zod) for API shapes where wired; HTTP via **Axios** instance + `loadJson` / `sendJson` helpers
- Timeline and grid views implemented in-app (see `00-implementation-status.md` for UI scope)

### Backend (as implemented)
- **Express** services: TypeScript (portfolio, template, AI, worker) + **CommonJS** gateway and integration-service; client is Vite React (JavaScript)
- REST externally; internal routes use shared keys where needed (e.g. portfolio internal APIs)
- Prisma ORM per service with **Postgres schema-per-service**
- **BullMQ / Redis / worker:** reserved for future async jobs; workbook import is currently **synchronous** in portfolio-service
- PostgreSQL

### Integrations
- adapter-based service
- provider modules for Jira, Confluence, Azure DevOps, etc.
- outbound webhooks
- inbound sync jobs

### AI
- isolated AI service
- prompt templates and action policies
- retrieval over platform entities, not arbitrary free-form memory
- approval-first UX for generated content

### Infrastructure
- Docker Compose for local development
- Kubernetes later for production
- Traefik or NGINX ingress
- OpenTelemetry
- Grafana / Prometheus / Loki or hosted equivalent
- S3-compatible object store

## Bounded contexts

### 1. Identity & Access
- users
- roles
- workspace membership
- audit policies

### 2. Portfolio / Roadmaps
- roadmap
- roadmap views (grid, timeline, executive)
- roadmap items
- phase segments and **phase definitions** (workspace catalog)
- milestones / dependencies (future emphasis in UI)

### 3. Initiatives & Themes
- initiative
- strategic theme
- initiative descriptions
- theme mapping

### 4. Templates
- roadmap templates
- field presets
- status / phase taxonomies
- import schemas

### 5. Imports / Exports
- spreadsheet ingestion
- validation
- error reports
- export rendering

### 6. Integrations
- external provider credentials
- sync cursors
- entity mapping
- event-driven sync

### 7. AI Assistance
- summarization
- drafting
- classification
- quality checks

## Why this is the right level of microservices
Do not start with 12 network hops for one timeline load.
Start with these deployable services:
- web
- gateway (`services/gateway`)
- portfolio-service
- template-service
- integration-service
- ai-service
- worker

That is enough separation to honor microservice principles while keeping operations sane.

## Event-driven flows

### Example: spreadsheet import (current)
1. user uploads workbook via gateway to portfolio-service
2. portfolio-service saves the file (temp path in batch metadata) and runs import synchronously
3. portfolio-service upserts themes, initiatives, roadmap items, phase segments
4. import result is persisted on the batch
5. UI shows batch summary and row issues  
   (Optional later: enqueue on Redis + **worker** for very large files.)

### Example: Jira (current vs future)
**Today:** integration-service stores Jira Cloud credentials and can **verify** the connection (`GET /rest/api/3/myself` via Jira Cloud REST API v3). **Future:** scheduled sync, entity mapping, and portfolio updates follow the steps below.

1. scheduled sync job runs
2. integration-service fetches Jira updates
3. mapping rules translate Jira entities
4. portfolio-service receives update commands
5. audit records and sync cursors are updated

## Production deployment recommendation
- begin with one Kubernetes namespace or one ECS cluster per environment
- one Postgres instance with separate schemas
- one Redis
- one object storage bucket per environment
- one managed secrets store
- one observability stack
