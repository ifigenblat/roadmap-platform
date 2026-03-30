# MCP Tool Usage for Jira Issue Management

Patterns for calling Atlassian MCP server tools to create, read, update, and transition Jira issues.

## MCP Server

- **Server:** `atlassian` (configured as `atlassian-remote` in some installations)
- **URL:** `https://mcp.atlassian.com/v1/mcp`
- **Transport:** HTTP

## Available Tools

| Tool | Purpose |
|------|---------|
| `getAccessibleAtlassianResources` | Get cloud ID and verify connection |
| `atlassianUserInfo` | Get current user identity |
| `getJiraIssue` | Read a single issue by key |
| `createJiraIssue` | Create a new issue |
| `editJiraIssue` | Update fields on an existing issue |
| `getTransitionsForJiraIssue` | List available status transitions |
| `transitionJiraIssue` | Change issue status |

## Creating Issues

### createJiraIssue

**Parameters:**
- `cloudId` (string, required) -- Atlassian cloud instance ID
- `projectKey` (string, required) -- Project key (e.g., "PROJ")
- `issueTypeName` (string, required) -- "Story", "Task", "Bug", or "Sub-task"
- `summary` (string, required) -- Issue title
- `description` (string, optional) -- Markdown description
- `additional_fields` (object, optional) -- Custom fields, parent, labels

### Story/Task Creation Pattern

```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "issueTypeName": "Story",
  "summary": "Issue title here",
  "description": "Markdown description here",
  "additional_fields": {
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["relevant-label"]
  }
}
```

### Sub-task Creation Pattern

```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "summary": "Sub-task title",
  "issueTypeName": "Sub-task",
  "description": "Sub-task details",
  "additional_fields": {
    "parent": {"key": "PARENT-KEY"},
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["{{subtaskTrackingLabel}}"]
  }
}
```

### Bug Creation Pattern

```json
{
  "cloudId": "{{cloudId}}",
  "projectKey": "{{projectKey}}",
  "issueTypeName": "Bug",
  "summary": "Bug title",
  "description": "Bug description with AC section at bottom",
  "additional_fields": {
    "{{bugEnvironmentFieldId}}": {"value": "PRD"},
    "{{bugSeverityFieldId}}": {"value": "Sev 2"},
    "{{bugTestPhaseFieldId}}": {"value": "QA"},
    "{{bugResponsibleTeamFieldId}}": {"value": "Pennymac"},
    "{{channelFieldId}}": [{"value": "{{channel}}"}],
    "{{workStreamFieldId}}": {"value": "{{workStream}}"},
    "{{teamsFieldId}}": [{"value": "{{team}}"}],
    "labels": ["bug"]
  }
}
```

## Updating Issues

### editJiraIssue

**Parameters:**
- `cloudId` (string, required)
- `issueIdOrKey` (string, required) -- Issue key (e.g., "PROJ-123")
- `summary` (string, optional) -- Updated title
- `description` (string, optional) -- Updated description (markdown)
- `additional_fields` (object, optional) -- Custom fields to update

### Multi-Field Update Strategy

**CRITICAL:** Update different field types in **separate API calls**. Combining markdown fields with ADF fields in a single call causes "Failed to convert markdown to adf" errors.

**Recommended workflow:**

1. **Call 1 -- Summary + simple fields** (if needed):
```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123",
  "summary": "Updated title",
  "additional_fields": {
    "labels": ["updated-label"]
  }
}
```

2. **Call 2 -- Acceptance criteria** (ADF format, separate call):
```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123",
  "additional_fields": {
    "{{acceptanceCriteriaFieldId}}": {
      "type": "doc",
      "version": 1,
      "content": [...]
    }
  }
}
```

3. **Call 3 -- Description** (markdown, separate call):
```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123",
  "description": "Updated markdown description"
}
```

### What Works Together vs. What Doesn't

| Combination | Result |
|-------------|--------|
| `summary` + `labels` + simple fields | Works in one call |
| `{{acceptanceCriteriaFieldId}}` (ADF) alone | Works as separate call |
| `description` (markdown) alone | Works as separate call |
| `description` + `{{acceptanceCriteriaFieldId}}` | **FAILS** -- "Failed to convert markdown to adf" |

## Reading Issues

### getJiraIssue

```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123"
}
```

Returns full issue data including all fields, comments, and metadata.

## Transitioning Issues

### Step 1: Get Available Transitions

```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123"
}
```

Returns an array of available transitions with `id` and `name` fields.

### Step 2: Apply Transition

```json
{
  "cloudId": "{{cloudId}}",
  "issueIdOrKey": "PROJ-123",
  "transitionId": "21"
}
```

Common transitions:
- "To Do" -- Move newly created issues to the backlog
- "In Progress" -- Start work on an issue
- "Done" -- Mark issue as complete

## Jira Comment Best Practices

When adding comments via MCP:
- Keep comments under 2 paragraphs
- Use bullet points instead of paragraphs
- Create multiple focused comments rather than one long comment
- Never put acceptance criteria or description content in comments

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| "Field cannot be set" | Missing required field or wrong format | Check `issue-type-requirements.md` for required fields |
| "Bad Request" | Field value not in allowedValues | Check `jira-field-mappings.md` for valid options |
| "Failed to convert markdown to adf" | Mixed markdown + ADF in one call | Split into separate API calls |
| MCP timeout | Large payload or connectivity | Retry up to 2 times with delay |
| "Issue does not exist" | Wrong issue key | Verify key format and project |
| Permission denied | User lacks project access | Check user permissions via `atlassianUserInfo` |
