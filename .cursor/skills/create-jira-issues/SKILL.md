---
name: create-jira-issues
description: >-
  Creates Jira stories, bugs, tasks, and sub-tasks using the Atlassian MCP
  server with correct field mappings, ADF formatting, and API patterns. Use when
  creating any Jira issue type, building tickets from requirements, or when the
  user asks to create a story, bug, task, or sub-task in Jira.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "create-jira-issues"
---

# Create Jira Issues

Create stories, bugs, tasks, and sub-tasks in Jira via the Atlassian MCP server with correct field formats and required custom fields.

## When to Use

- Creating a new Jira story, bug, task, or sub-task
- Building tickets from requirements, specs, or conversation context
- Batch-creating multiple related issues (e.g., sub-tasks from a plan)
- Updating existing issue fields (description, acceptance criteria, status)

## Prerequisites

- Atlassian MCP connection validated (use `validate-mcp-connection` skill first)
- Cloud ID obtained from connection validation
- Project key and custom field IDs configured (see {{file:references/jira-field-mappings.md}})

## Issue Creation Workflow

### Step 1: Determine Issue Type

| Type | When to Use |
|------|------------|
| **Story** | New feature or user-facing capability |
| **Bug** | Defect, regression, or unexpected behavior |
| **Task** | Technical work, maintenance, or non-feature work |
| **Sub-task** | Breakdown of a parent story/task into implementable units |

Each type has different required fields. See {{file:references/issue-type-requirements.md}} for the complete field matrix.

### Step 2: Ask Permission

**CRITICAL**: Always propose the issue details and wait for user approval before creating anything in Jira. Reading/viewing is allowed without asking.

### Step 3: Prepare Fields

1. Gather required fields for the issue type (see {{file:references/issue-type-requirements.md}})
2. Format acceptance criteria in ADF JSON (see {{file:references/adf-format-guide.md}})
3. Set custom fields with correct format types (single-select vs multi-select)

### Step 4: Create the Issue

Use the `createJiraIssue` MCP tool. See {{file:references/mcp-tool-usage.md}} for working API formats and examples.

**Key rules:**
- Update description and acceptance criteria in **separate API calls** (never combine markdown + ADF in one call)
- Sub-tasks require parent in object format: `{"key": "PARENT-KEY"}`
- Multi-select fields use array format; single-select use object format
- Bug issues have additional mandatory fields beyond standard requirements

### Step 5: Post-Creation

- Verify the issue was created by retrieving it with `getJiraIssue`
- If creating sub-tasks, transition them to the appropriate status (e.g., "To Do")
- Report the created issue key(s) back to the user

## Quick Reference: Field Format Types

| Format | Syntax | Used By |
|--------|--------|---------|
| Single-select | `{"value": "Option"}` | Work-Stream, Environment, Severity |
| Multi-select | `[{"value": "Option"}]` | Channel, Teams |
| Plain text | `"text content"` | Summary, Description |
| ADF JSON | `{"type": "doc", ...}` | Acceptance Criteria |
| Array of strings | `["label1", "label2"]` | Labels |
| Object with key | `{"key": "PROJ-123"}` | Parent (sub-tasks) |

## Error Recovery

| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to convert markdown to adf" | Mixed markdown + ADF in one call | Separate into individual API calls |
| "Field cannot be set" | Missing required field | Check {{file:references/issue-type-requirements.md}} |
| "Bad Request" | Invalid field value | Verify value against allowed options |
| MCP timeout | Large payload or connection issue | Retry with smaller payload |

## Reference Documents

- {{file:references/jira-field-mappings.md}} -- Complete field ID reference with custom field mappings and format types
- {{file:references/issue-type-requirements.md}} -- Required and optional fields per issue type with working examples
- {{file:references/adf-format-guide.md}} -- Atlassian Document Format patterns for acceptance criteria and rich text
- {{file:references/mcp-tool-usage.md}} -- MCP tool calling patterns, working examples, and known quirks
