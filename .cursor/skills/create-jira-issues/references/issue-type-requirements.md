# Issue Type Requirements

Required and optional fields for each Jira issue type, with working creation examples.

## Field Requirements Matrix

| Field | Story | Task | Bug | Sub-task |
|-------|-------|------|-----|----------|
| Summary | **Required** | **Required** | **Required** | **Required** |
| Description | Recommended | Recommended | **Required** | Recommended |
| Channel (`{{channelFieldId}}`) | **Required** | **Required** | **Required** | **Required** |
| Work-Stream (`{{workStreamFieldId}}`) | **Required** | **Required** | **Required** | **Required** |
| Teams (`{{teamsFieldId}}`) | **Required** | **Required** | **Required** | **Required** |
| Acceptance Criteria (`{{acceptanceCriteriaFieldId}}`) | Recommended | Optional | **Not available** | Optional |
| Labels | Optional | Optional | Optional | **Required** (tracking label) |
| Parent | N/A | N/A | N/A | **Required** |
| Environment (`{{bugEnvironmentFieldId}}`) | N/A | N/A | **Required** | N/A |
| Severity (`{{bugSeverityFieldId}}`) | N/A | N/A | **Required** | N/A |
| Test Phase (`{{bugTestPhaseFieldId}}`) | N/A | N/A | **Required** | N/A |
| Responsible Dev Team (`{{bugResponsibleTeamFieldId}}`) | N/A | N/A | **Required** | N/A |

## Story Creation

Stories represent user-facing features or capabilities.

### Required Fields
- `summary` -- Concise title
- `description` -- Feature description (markdown)
- Channel, Work-Stream, Teams -- Organizational custom fields

### Recommended Fields
- Acceptance Criteria (`{{acceptanceCriteriaFieldId}}`) -- In ADF format (see `adf-format-guide.md`)
- Labels -- Relevant categorization tags

### Working Example
```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "issueTypeName": "Story",
  "summary": "Implement user notification preferences",
  "description": "As a user, I want to configure my notification preferences so that I only receive relevant alerts.\n\n## Context\nUsers currently receive all notifications with no way to filter them.\n\n## Scope\n- Email notification toggle\n- Push notification toggle\n- Per-category preferences",
  "additional_fields": {
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["notifications", "user-preferences"]
  }
}
```

### Post-Creation: Set Acceptance Criteria
Update in a **separate API call** using ADF format:
```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "CREATED-KEY",
  "additional_fields": {
    "{{acceptanceCriteriaFieldId}}": {
      "type": "doc",
      "version": 1,
      "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "I know this is done when:"}]},
        {"type": "bulletList", "content": [
          {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "User can toggle email notifications on/off"}]}]},
          {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "User can toggle push notifications on/off"}]}]},
          {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Preferences persist across sessions"}]}]}
        ]}
      ]
    }
  }
}
```

## Task Creation

Tasks represent technical work, maintenance, or non-feature work.

### Required Fields
- `summary` -- Concise title
- Channel, Work-Stream, Teams -- Organizational custom fields

### Recommended Fields
- `description` -- Task details (markdown)
- Labels -- Relevant categorization tags

### Working Example
```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "issueTypeName": "Task",
  "summary": "Upgrade database driver to v3.2",
  "description": "Upgrade the PostgreSQL driver from v2.8 to v3.2 to resolve connection pooling issues and support new TLS requirements.",
  "additional_fields": {
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["tech-debt", "database"]
  }
}
```

## Bug Creation

Bugs represent defects, regressions, or unexpected behavior. Bugs have the most required fields.

### Required Fields
- `summary` -- Concise bug title
- `description` -- Bug details including repro steps (**include AC here** since the AC field is not available for bugs)
- Channel, Work-Stream, Teams -- Organizational custom fields
- Environment (`{{bugEnvironmentFieldId}}`) -- Where the bug was found
- Severity (`{{bugSeverityFieldId}}`) -- Impact level
- Test Phase (`{{bugTestPhaseFieldId}}`) -- Testing stage where discovered
- Responsible Dev Team (`{{bugResponsibleTeamFieldId}}`) -- Team responsible for the fix

### Bug Description Strategy

Since the acceptance criteria field is **not available** for Bugs, include AC at the end of the description:

```markdown
## Summary
Brief description of the bug.

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Acceptance Criteria
I know this is done when:
- Criterion 1
- Criterion 2
```

### Working Example
```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "issueTypeName": "Bug",
  "summary": "Login redirect loop on expired session",
  "description": "## Summary\nUsers with expired sessions encounter an infinite redirect loop between /login and /dashboard.\n\n## Steps to Reproduce\n1. Log in and wait for session to expire (30 min)\n2. Navigate to /dashboard\n3. Observe redirect loop\n\n## Expected Behavior\nUser is redirected to /login once and can re-authenticate.\n\n## Actual Behavior\nBrowser enters redirect loop until timeout.\n\n## Acceptance Criteria\nI know this is done when:\n- Expired sessions redirect to /login exactly once\n- User can re-authenticate successfully\n- No redirect loops under any session state",
  "additional_fields": {
    "{{bugEnvironmentFieldId}}": {"value": "PRD"},
    "{{bugSeverityFieldId}}": {"value": "Sev 2"},
    "{{bugTestPhaseFieldId}}": {"value": "Production"},
    "{{bugResponsibleTeamFieldId}}": {"value": "Pennymac"},
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["bug", "authentication"]
  }
}
```

### Common Bug Field Combinations

**Production issue:**
```json
"{{bugEnvironmentFieldId}}": {"value": "PRD"},
"{{bugSeverityFieldId}}": {"value": "Sev 2"},
"{{bugTestPhaseFieldId}}": {"value": "Production"},
"{{bugResponsibleTeamFieldId}}": {"value": "Pennymac"}
```

**QA-found issue:**
```json
"{{bugEnvironmentFieldId}}": {"value": "QA"},
"{{bugSeverityFieldId}}": {"value": "Sev 2"},
"{{bugTestPhaseFieldId}}": {"value": "QA"},
"{{bugResponsibleTeamFieldId}}": {"value": "Pennymac"}
```

**Development issue:**
```json
"{{bugEnvironmentFieldId}}": {"value": "DEV"},
"{{bugSeverityFieldId}}": {"value": "Sev 3"},
"{{bugTestPhaseFieldId}}": {"value": "QA"},
"{{bugResponsibleTeamFieldId}}": {"value": "Pennymac"}
```

## Sub-task Creation

Sub-tasks break a parent story or task into implementable units.

### Required Fields
- `summary` -- Concise sub-task title
- `parent` -- Parent issue key in object format
- Channel, Work-Stream, Teams -- Organizational custom fields
- Labels -- Must include tracking label `{{subtaskTrackingLabel}}`

### Critical Rules
- Parent field **MUST** use object format: `{"key": "PARENT-KEY"}` (not a plain string)
- All sub-tasks **MUST** include the `{{subtaskTrackingLabel}}` label
- Sub-tasks do not require sizing/story points
- After creation, transition sub-tasks to "To Do" status

### Working Example
```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "summary": "Implement email notification toggle API endpoint",
  "issueTypeName": "Sub-task",
  "description": "Create the REST endpoint for toggling email notification preferences.\n\n- POST /api/v1/users/{id}/preferences/notifications/email\n- Request body: { enabled: boolean }\n- Returns updated preference state",
  "additional_fields": {
    "parent": {"key": "{{projectKey}}-1234"},
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["{{subtaskTrackingLabel}}"]
  }
}
```

### Post-Creation: Transition to "To Do"

After creating sub-tasks, transition them so they appear in the backlog:

1. Call `getTransitionsForJiraIssue` on the first sub-task to find available transitions
2. Find the transition ID for "To Do"
3. Call `transitionJiraIssue` for each sub-task with that transition ID
