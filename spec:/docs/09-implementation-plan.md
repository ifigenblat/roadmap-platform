# Implementation Plan

## Phase 0: foundation
- finalize domain model
- lock UI IA
- generate monorepo scaffold
- set up Docker, CI, linting, test runners
- define OpenAPI and event contracts

## Phase 1: MVP
- auth + roles
- roadmap CRUD
- initiative CRUD
- strategic themes CRUD
- timeline view
- template CRUD
- spreadsheet import
- CSV / PDF exports
- activity log

## Phase 2: AI
- initiative drafting
- theme classification
- quality checks
- executive summaries
- AI usage analytics and guardrails

## Phase 3: integrations
- Jira connect + read sync
- Confluence link management
- external link panel
- sync job monitoring

## Build order recommendation
1. schema and contracts
2. web shell
3. portfolio-service
4. timeline interaction layer
5. import pipeline
6. templates
7. AI
8. integrations
