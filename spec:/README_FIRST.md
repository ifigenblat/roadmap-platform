# Roadmap Platform

This package is a production-oriented starting point for **Roadmap Platform**, based on the uploaded spreadsheet workflow.

It includes:
- **`docs/00-implementation-status.md`** — what is built in the repo today (read this for current truth)
- product and architecture documents
- a phased implementation plan
- AI feature design
- integration strategy for Jira / Confluence / SDLC tools
- a starter monorepo scaffold with Docker and service boundaries (Vite React `client/`, CommonJS `services/gateway`, shared Sequelize `services/shared/postgres`)
- Cursor-ready prompts and build sequence

## Your current spreadsheet model, translated
The uploaded workbooks imply four planning domains:
1. **Data**: the operational source of truth for roadmap items
2. **Roadmap**: a visual timeline generated from source data
3. **Initiative Descriptions**: narrative business context for initiatives
4. **Strategic Themes**: portfolio-level strategic grouping and objectives

The platform in this package treats the timeline as a **derived view**, while preserving the narrative and portfolio planning layers.

## Recommended build principle
Start as a **modular microservice-ready monorepo**, not a massive distributed system on day one.
That gives you:
- clean domain boundaries
- independent containers
- a realistic local developer experience
- room to split services later without re-platforming
