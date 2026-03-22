# Cursor Master Instructions

Use this package as the source of truth.

## Your mission
Generate a production-oriented monorepo for a roadmap platform with:
- Next.js frontend
- NestJS backend services
- PostgreSQL
- Redis
- Docker Compose
- npm workspaces
- OpenAPI-first contracts
- Prisma schemas
- clean architecture inside each service
- RBAC
- import pipeline for spreadsheet roadmaps
- timeline-centric UI

## Product rules
- roadmap timeline is a derived view from roadmap item + phase segments
- initiative is reusable across multiple roadmaps
- templates can seed roadmaps, phases, themes, and statuses
- AI suggestions require explicit human acceptance
- integrations are adapters
