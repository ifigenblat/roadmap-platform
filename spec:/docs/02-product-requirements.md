# Product Requirements

## MVP outcomes
The MVP should let you stop managing roadmaps primarily in spreadsheets.

## MVP features

### A. Multi-roadmap management
- create unlimited roadmaps
- assign roadmaps to portfolio / business area / planning cycle
- archive and clone roadmaps
- filter roadmaps by year, org, owner, and status

### B. Initiative management
- create and edit initiatives
- define objective, summary, business sponsor, owner, type, status, notes
- link an initiative to one or more strategic themes
- attach one or more teams
- support lifecycle stages and phase segments

### C. Timeline roadmap view
- quarter, month, and custom date views
- grouped by theme, team, sponsor, type, or status
- drag to update phase dates
- color by phase, theme, status, or risk
- milestones, dependencies, and swimlanes

### D. Strategic themes
- create and manage themes
- define theme objective
- rank / order themes
- see all initiatives mapped to a theme
- roll-up counts by status, roadmap, and time window

### E. Template system
- save a roadmap as template
- define default phases, fields, theme taxonomy, view presets, and statuses
- create new roadmaps from template
- support business-unit-specific templates

### F. Spreadsheet import
- upload current workbook format
- map Data sheet rows into Initiative + RoadmapItem + PhaseSegment
- map Initiative Descriptions into initiative narrative fields
- map Strategic Themes into StrategicTheme entities
- preserve import batch history and row-level errors

### G. Search / filtering
- global search
- filter by roadmap, initiative, theme, team, sponsor, status, date window, type
- saved filters and views

### H. Collaboration
- comments on initiatives and roadmap items
- activity log
- change history
- assignments / owners

### I. Export / share
- export timeline as PNG / PDF
- export initiative tables to CSV
- view-only shared links for selected audiences

## AI features for Phase 2
- generate succinct business objective from raw notes
- generate detailed business objective for decks
- summarize a roadmap by theme or quarter
- propose theme classification for new initiatives
- normalize initiative names and deduplicate candidates
- detect missing dates / missing sponsors / inconsistent statuses
- propose milestone language for executive consumption

## Integration features for Phase 3
- Jira epic / initiative synchronization
- Confluence page linking / embed
- webhook framework for future tools
- import progress / status from delivery systems
- create roadmap items from Jira filters or projects

## Permissions
- admin
- portfolio manager
- roadmap editor
- contributor
- viewer

## Reporting
- roadmap health summary
- initiatives by theme
- initiatives by team
- upcoming starts / launches
- slipped items
- items without theme / owner / sponsor
- cross-roadmap overlap

## Acceptance criteria for MVP
- user can create a roadmap from scratch or template
- user can import an existing spreadsheet workbook
- user can manage themes, initiatives, and timeline data in-app
- user can publish a timeline view that replaces the spreadsheet roadmap tab
