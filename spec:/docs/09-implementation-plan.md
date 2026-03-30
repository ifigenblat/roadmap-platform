# Implementation Plan

## Phase 0: foundation
- finalize domain model
- lock UI IA
- generate monorepo scaffold
- set up Docker, CI, linting, test runners
- define OpenAPI and event contracts

## Phase 1: MVP
- auth + roles — **not done** (dev-style access)
- roadmap CRUD — **in progress** (clone, archive, themes scoped to roadmap)
- initiative CRUD — **in progress** (themes, sponsors, API surface)
- strategic themes CRUD — **in progress** (global themes, color tokens, detail pages)
- timeline view — **in progress** (timeline + grid + executive routes)
- workspace **phase definitions** + segment linkage — **in progress**
- template CRUD — **in progress** (template-service + create roadmap from template)
- spreadsheet import — **in progress** (workbook upload, batch rows, delete impact)
- CSV / PDF exports — **not done**
- activity log — **not done**

See **`00-implementation-status.md`** for a precise snapshot.

## Phase 2: AI
- initiative drafting — **API + gateway** (UI integration varies)
- theme classification — **API**
- quality checks — **API**
- executive summaries — **API** + workspace AI settings / gateway runtime merge
- AI usage analytics and guardrails — **future**

## Phase 3: integrations
- Jira connect + **verify** (REST v3 `/myself`) — **done**; read sync / entity mapping — **future**
- Confluence link management — **partial** (store connection only)
- external link panel — **future**
- sync job monitoring — **future**

## Build order recommendation
1. schema and contracts
2. web shell
3. portfolio-service
4. timeline interaction layer
5. import pipeline
6. templates
7. AI
8. integrations
