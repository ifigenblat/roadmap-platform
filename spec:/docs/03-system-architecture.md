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

### Frontend
- Next.js app router
- TypeScript
- Tailwind
- shadcn/ui
- TanStack Query
- Zustand for local UI state
- react-hook-form + zod
- visx or dnd-kit based timeline interaction layer

### Backend
- NestJS services in TypeScript
- REST externally, events internally
- Prisma ORM for fast delivery
- BullMQ for background jobs
- Redis
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
- roadmap views
- roadmap items
- phase segments
- milestones
- dependencies

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
- api-gateway
- portfolio-service
- template-service
- integration-service
- ai-service
- worker

That is enough separation to honor microservice principles while keeping operations sane.

## Event-driven flows

### Example: spreadsheet import
1. user uploads workbook
2. api-gateway stores file and creates import job
3. worker parses workbook
4. portfolio-service upserts themes, initiatives, roadmap items, phase segments
5. import result is persisted
6. UI shows batch summary and row issues

### Example: Jira sync
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
