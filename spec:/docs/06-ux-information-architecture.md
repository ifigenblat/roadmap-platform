# UX / Information Architecture

## Product navigation (implemented shell)

Primary sidebar: **Dashboard**, **Roadmaps**, **Initiatives**, **Themes**, **Teams**, **Phases**, **Business sponsors**, **Imports**, **Templates**, **Settings** (workspaces, integrations, and related options).

Integrations are reachable under **Settings** (and/or dedicated routes as wired); there is no separate top-level “Integrations” item in the default nav.

## Roadmap workspace

For a selected roadmap (`/roadmaps/[id]`):

- **Grid** — tabular roadmap items with editing, theme/color cues, and phase context
- **Timeline** — time-based lanes, search, theme-based coloring
- **Executive** — summary-oriented view fed by `/roadmaps/:id/executive-summary`

Future / partial: saved views, persistent filters, comments panel, Jira link panel — see `00-implementation-status.md`.

## Design principles
- table + timeline duality
- detail without modal overload
- always-visible filters
- fast edit from side panel
- consistent color system
- executive mode vs editor mode
