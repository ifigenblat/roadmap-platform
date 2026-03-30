# Integration Strategy

## Principles
- integrations are adapters, not core logic
- sync should be idempotent and observable
- mapping rules should be explicit and editable
- external outages must not break the core product

## Jira integration

**Current implementation:** users register a **Jira Cloud** connection with `siteUrl` (site base URL), Atlassian account **email**, and **API token**. The app stores JSON in `integration_connection` and verifies the connection by calling the **official Jira Cloud REST API v3** (`GET /rest/api/3/myself`) over HTTPS with Basic auth — no separate vendor SDK.

**Roadmap (product):**
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
