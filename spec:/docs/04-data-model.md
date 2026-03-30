# Data Model

## Physical storage (Postgres)

All services share one database (`roadmap_platform` by default) but use **separate PostgreSQL schemas** so each Prisma app’s `db push` only manages its own tables:

| Schema        | Service              | Notes |
|---------------|----------------------|--------|
| `portfolio`   | portfolio-service    | Roadmaps, initiatives, themes, imports, etc. |
| `template`    | template-service     | `svc_template_templates` |
| `integration` | integration-service  | `svc_integration_*` |

Connection strings set the schema via `?schema=<name>` in `PORTFOLIO_DATABASE_URL`, `TEMPLATE_DATABASE_URL`, `INTEGRATION_DATABASE_URL` (see root `.env.example`).

## Spreadsheet-to-platform mapping

## Observed source sheets
The uploaded workbooks show these patterns:

### Workbook A
- Data
- Roadmap
- Deck

### Workbook B
- Data
- Roadmap
- Initiative Descriptions
- Strategic Themes

The richer workbook should be treated as the canonical import model.

## Canonical entities

### phase_definition
- id
- workspace_id
- name (unique per workspace)
- sort_order
- created_at
- updated_at

Segments (`phase_segment`) may reference `phase_definition_id`; display name on the segment is denormalized and kept in sync when the definition is renamed.

### workspace_ai_settings
- workspace_id (PK)
- ai_provider (e.g. openai | gemini)
- openai_model, gemini_model, max_tokens, temperature
- optional per-workspace API key fields (treat as secrets in production)
- created_at, updated_at

### roadmap
- id
- workspace_id
- template_id nullable
- name
- slug
- description
- planning_year
- start_date
- end_date
- owner_user_id nullable
- status
- created_at
- updated_at
- archived_at nullable

### strategic_theme
- id
- workspace_id
- roadmap_id nullable
- name
- objective
- order_index
- **color_token** (nullable; UI palette key for theme chips, timeline, grid accents)
- created_at
- updated_at

### business_sponsor
- id
- workspace_id
- display_name
- email, title, department, notes (optional)
- created_at
- updated_at

### initiative
- id
- workspace_id
- canonical_name
- short_objective
- detailed_objective
- **business_sponsor** (legacy free-text label, e.g. from import)
- **business_sponsor_id** nullable (FK to `business_sponsor`)
- owner_user_id nullable
- type
- notes
- source_system
- source_reference nullable
- created_at
- updated_at

### initiative_theme
- initiative_id
- strategic_theme_id

### roadmap_item
- id
- roadmap_id
- initiative_id
- title_override nullable
- status
- priority
- confidence
- risk_level
- target_outcome
- start_date
- end_date
- lane_key nullable
- sort_order
- created_at
- updated_at

### phase_segment
- id
- roadmap_item_id
- **phase_definition_id** nullable (FK to `phase_definition`)
- phase_name (display string; aligned with definition when linked)
- start_date
- end_date
- capacity_allocation_estimate nullable
- sprint_estimate nullable
- team_summary nullable
- status nullable
- jira_key nullable
- notes nullable

### team
- id
- workspace_id
- name
- kind
- active

### roadmap_item_team
- roadmap_item_id
- team_id

### template
- id
- workspace_id
- name
- description
- config_json
- created_at
- updated_at

### integration_connection
- id
- workspace_id
- provider (e.g. jira, confluence, cursor)
- connection_name
- config_encrypted (JSON string; **Jira Cloud** expects `siteUrl`, `email`, `apiToken` — see types package)
- status
- last_sync_at nullable

### external_link
- id
- workspace_id
- entity_type
- entity_id
- provider
- external_id
- external_url
- sync_state
- metadata_json

### import_batch
- id
- workspace_id
- roadmap_id nullable
- source_file_name
- importer_type
- status
- started_at
- completed_at nullable
- summary_json

### import_row_result
- id
- import_batch_id
- sheet_name
- row_number
- entity_type
- entity_key
- status
- message
- raw_payload_json

## Key design decisions

### 1. Initiative is reusable
An initiative is not owned by one roadmap forever.

### 2. Roadmap item is contextual
The roadmap item is the planning representation of an initiative inside a roadmap.

### 3. Phase segments preserve spreadsheet semantics
Your spreadsheets often split one initiative into multiple phases with separate timing windows.
That should be preserved.

### 4. Themes can be global or roadmap-specific
Useful for enterprise portfolios vs line-of-business roadmaps.

## Import mapping

### Data sheet
Map columns such as:
- initiative name / project
- teams
- phase
- start date / quarter
- end date / quarter
- theme
- sponsor
- type
- status
- notes
- Jira key

Into:
- initiative
- strategic_theme
- roadmap_item
- phase_segment
- team links

### Initiative Descriptions
Map:
- initiative
- strategic pillar
- succinct objective
- detailed objective

Into:
- initiative.short_objective
- initiative.detailed_objective
- theme association

### Strategic Themes
Map:
- strategic pillar
- initiatives included
- pillar objective

Into:
- strategic_theme
- optional helper links / inferred associations
