# Solution Blueprint

## 1. Product vision

Build a multi-roadmap application that lets product, strategy, and delivery teams:
- create and manage **N roadmaps**
- define **strategic themes**, **initiatives**, and **timeline phases**
- reuse **templates** for new business units or product lines
- import from spreadsheets and later integrate with Jira, Confluence, and SDLC systems
- use AI to generate context, summarize initiatives, and improve planning hygiene
- publish roadmap views for executives, PMs, and delivery teams

## 2. Design goals

- **Sophisticated, but simple**: rich platform design with a clear UX and low operational complexity
- **Microservice-ready**: bounded contexts and containers from the start, with selective decomposition over time
- **Timeline is not the source of truth**: timeline views are generated from normalized data
- **Portfolio-first**: one application supports many roadmaps
- **Template-driven**: create a new roadmap from reusable metadata, views, defaults, phases, and field mappings
- **AI-assisted**: AI drafts and enriches content; humans approve
- **Integration-friendly**: external systems become adapters, not core domain dependencies

## 3. Users and jobs to be done

### Portfolio / product leadership
- compare roadmaps across business areas
- track initiatives by theme, status, sponsor, team, risk, and target window
- generate executive summaries and board-ready views

### Product managers / strategy managers
- define initiatives and phases
- manage business objectives and strategic alignment
- create and maintain roadmap templates

### Engineering / delivery managers
- connect roadmap items to Jira epics / projects
- validate feasibility windows, capacity assumptions, and dependencies
- sync progress states from delivery tools

### Operations / PMO / business stakeholders
- review priorities
- comment and collaborate
- export views for presentations and steering committees

## 4. Core object model

### Workspace
Top-level tenant or operating space.

### Roadmap
A container for a specific product line, org, or planning cycle.

### StrategicTheme
A strategic bucket or pillar with objective text and optional ordering.

### Initiative
A reusable business initiative with descriptive context and ownership.

### RoadmapItem
A roadmap-specific expression of an initiative on a timeline.
This supports the same initiative appearing on multiple roadmaps or planning cycles.

### PhaseSegment
A time-bounded segment of a roadmap item such as Planning, Discovery, Implementation, Launch. Segments may reference a workspace **`PhaseDefinition`** for consistent naming and imports.

### PhaseDefinition
Workspace-scoped catalog of phase names (with sort order) used when creating or importing phase segments.

### Team
Delivery or functional team metadata.

### Template
Saved structure for creating future roadmaps.

### IntegrationLink
Binding between internal objects and external systems such as Jira or Confluence.

## 5. Product shape

### Primary screens (as implemented in the web app)
- Dashboard (`/`)
- Roadmap list and **roadmap workspace** (`/roadmaps`, `/roadmaps/[id]` with grid, timeline, and executive views)
- Initiatives list and detail
- **Global themes** (`/themes`, `/themes/[id]`) with color tokens
- **Workspace phase labels** (`/phases`) for dropdowns and segment linkage
- Teams, **business sponsors**, imports, templates
- Settings (workspaces, integrations, AI-related options as wired)

### Primary views inside a roadmap
- **Grid** (initiative / item table with phase and theme context)
- **Timeline** (lane-based timeline with search and theme coloring)
- **Executive** summary (aggregated narrative-oriented view)
- Future / partial: kanban, dependency map, richer collaboration — see `00-implementation-status.md`

## 6. Recommended architecture principle

Use a **monorepo with independently deployable services**:
- fewer moving parts than full independent repos
- easier schema evolution and shared contracts
- supports containers and eventual service extraction

## 7. Non-functional priorities

- strong auditability
- soft deletes and version history
- import traceability
- role-based access control
- observability from day one
- idempotent integrations
- AI guardrails and human approval
