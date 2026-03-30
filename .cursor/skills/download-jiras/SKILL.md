---
name: download-jiras
description: Downloads multiple Jira tickets matching a JQL query or list of issue keys and saves each as a markdown file. Use when batch-downloading Jira issues for offline reference or analysis.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "download-jiras"
---

# Download Jiras

Downloads multiple Jira tickets and saves each as an individual markdown file.

## When to Use

Use this skill when you need to:
- Download a batch of Jira tickets matching search criteria
- Save one or more Jira issues as local markdown files
- Export Jira content for offline analysis

## Prerequisites

- Atlassian MCP connection validated (use `validate-mcp-connection` skill first)
- Valid cloud ID obtained from connection validation

## Instructions

### Step 1: Determine Input Type

The input can be:
- **Single issue key:** Download one ticket (e.g., "CET-123")
- **Array of issue keys:** Download specific tickets (e.g., ["CET-123", "CET-456"])
- **JQL query:** Search and download matching tickets (e.g., "project = CET AND status = 'In Progress'")

### Step 2: Retrieve Issues

**For issue keys:**
Call `mcp_atlassian_getJiraIssue` for each key sequentially:
- Process one issue at a time
- Log success/failure for each before moving to the next

**For JQL queries:**
Call `mcp_atlassian_searchJiraUsingJql` with:
- `cloudId` -- From the validated connection
- `jql` -- The JQL query string
- Paginate through results if needed

### Step 3: Process Each Issue

For each retrieved issue, sequentially:

1. Extract issue data using the `retrieve-jira` skill methodology
2. Generate a safe filename: `{issue_key}_{sanitized_summary}.md`
   - Replace spaces with hyphens
   - Remove invalid filename characters
   - Lowercase the summary portion
   - Truncate to reasonable length (max 80 chars total)
3. Format the issue content as markdown (see `retrieve-jira` skill for format)
4. Save the file to the `jira/` output directory
5. Confirm the file was written before proceeding to the next issue

### Step 4: Create Manifest

After all issues are processed, create a `jira/MANIFEST.md` file listing:

```markdown
# Downloaded Jira Issues

**Downloaded:** {timestamp}
**Total Issues:** {count}

| Key | Summary | Status | File |
|-----|---------|--------|------|
| CET-123 | Issue summary | In Progress | CET-123_issue-summary.md |
```

### Step 5: Report Results

Return:
- Total issues found
- Total issues downloaded successfully
- Any failures with reasons
- Output directory path
- List of created files

## Error Handling

- **Individual issue failure:** Log the error, continue with remaining issues
- **JQL syntax error:** Report the invalid query and suggest corrections
- **File write failure:** Report the path and error, continue with remaining issues
- **Empty results:** Return a clear message that no issues matched the criteria
