# Integration Strategy

## Principles
- integrations are adapters, not core logic
- sync should be idempotent and observable
- mapping rules should be explicit and editable
- external outages must not break the core product

## Jira integration
- link roadmap items to epics / initiatives / projects
- pull status, assignee, dates, labels
- optionally create Jira epics from roadmap items
- track sync history and divergence

## Confluence integration
- link initiative to page or space
- show embedded reference links
- export roadmap summaries to Confluence pages later
- associate PRD / decision records with roadmap items

## Recommended rollout
1. reference links first
2. scheduled read sync
3. write-back for selected entities
4. webhook-driven near-real-time sync
