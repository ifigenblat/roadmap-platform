# Cursor Prompts

## Prompt 1: bootstrap monorepo
Create an npm workspaces monorepo called `roadmap-platform-starter` with:
- apps/web (Next.js)
- services/api-gateway
- services/portfolio-service
- services/template-service
- services/integration-service
- services/ai-service
- services/worker
- packages/shared
- packages/events
- packages/config
- packages/ui

Add Docker Compose for Postgres, Redis, and MinIO.
Use TypeScript everywhere.

## Prompt 2: implement portfolio domain
Implement the core portfolio domain with Prisma models and REST routes for:
- roadmaps
- initiatives
- strategic themes
- roadmap items
- phase segments

## Prompt 3: timeline UI
Build a timeline view in the Next.js app that:
- groups by theme or team
- shows phase segments as bars
- supports quarter and month zoom
- opens initiative detail in a right-side panel

## Prompt 4: workbook import
Build a workbook import pipeline that can parse sheets named:
- Data
- Initiative Descriptions
- Strategic Themes

Map rows into the canonical data model and store import batch results.
