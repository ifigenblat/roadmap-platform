---
name: retrieve-jira
description: Retrieves a specific Jira ticket by issue key using the Atlassian MCP server. Returns structured ticket data including summary, description, status, assignee, priority, and comments. Use when fetching details for a single Jira issue.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "retrieve-jira"
---

# Retrieve Jira Ticket

Retrieves a specific Jira issue by its key and returns structured data.

## When to Use

Use this skill when you need to fetch the details of a single Jira ticket by its issue key (e.g., "PROJ-123").

## Prerequisites

- Atlassian MCP connection validated (use `validate-mcp-connection` skill first)
- Valid cloud ID obtained from connection validation

## Instructions

### Step 1: Fetch the Issue

Call `mcp_atlassian_getJiraIssue` with:
- `cloudId` -- From the validated connection
- `issueIdOrKey` -- The issue key provided by the user (e.g., "CET-123")

### Step 2: Extract Issue Data

From the API response, extract and structure:
- **Key:** Issue key (e.g., "CET-123")
- **Summary:** Issue title
- **Status:** Current status name (e.g., "In Progress", "Done")
- **Priority:** Priority level (e.g., "High", "Medium")
- **Assignee:** Display name of the assignee
- **Reporter:** Display name of the reporter
- **Type:** Issue type (e.g., "Story", "Bug", "Task")
- **Description:** Full description in markdown format
- **Labels:** Array of labels
- **Sprint:** Current sprint name (if applicable)
- **Created:** Creation date
- **Updated:** Last update date
- **Comments:** Recent comments with author and date

### Step 3: Format as Markdown

Structure the output as a readable markdown document:

```markdown
# {KEY}: {Summary}

**Status:** {Status} | **Priority:** {Priority} | **Type:** {Type}
**Assignee:** {Assignee} | **Reporter:** {Reporter}
**Created:** {Created} | **Updated:** {Updated}
**Labels:** {Labels}
**Sprint:** {Sprint}

## Description

{Description content}

## Comments

### {Author} - {Date}
{Comment body}
```

### Step 4: Validate Response

- Confirm the issue key in the response matches the requested key
- Verify required fields (summary, status) are present
- If the issue is not found, report an `ISSUE_NOT_FOUND` error

## Error Handling

- **Issue not found:** Return structured error with the requested key
- **Permission denied:** User lacks access to the project -- report with project key
- **API timeout:** Retry up to 2 times with brief delay
