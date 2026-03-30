---
name: get-confluence-page
description: Retrieves a specific Confluence page by page ID or title using the Atlassian MCP server. Returns page content in markdown format with metadata. Use when fetching a single Confluence page.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "get-confluence-page"
---

# Get Confluence Page

Retrieves a specific Confluence page and returns its content in markdown format.

## When to Use

Use this skill when you need to fetch a single Confluence page, either by its numeric page ID or by searching for it by title.

## Prerequisites

- Atlassian MCP connection validated (use `validate-mcp-connection` skill first)
- Valid cloud ID obtained from connection validation

## Instructions

### Step 1: Determine Identifier Type

Check whether the provided identifier is:
- **Numeric:** Treat as a page ID -- fetch directly
- **Non-numeric:** Treat as a page title -- search first, then fetch

### Step 2A: Fetch by Page ID

If the identifier is numeric, call `mcp_atlassian_getConfluencePage` with:
- `cloudId` -- From the validated connection
- `pageId` -- The numeric page ID

### Step 2B: Search by Title

If the identifier is non-numeric, call `mcp_atlassian_searchConfluenceUsingCql` with:
- `cloudId` -- From the validated connection
- `cql` -- `title = "{pageIdentifier}"` (exact match first)

If no exact match, try a contains search:
- `cql` -- `title ~ "{pageIdentifier}"`

From the search results, take the first matching page and fetch its full content using `mcp_atlassian_getConfluencePage`.

### Step 3: Extract Page Data

From the API response, extract:
- **Page ID:** Numeric identifier
- **Title:** Page title
- **Space:** Space key and name
- **Author:** Creator display name
- **Created:** Creation date
- **Last Modified:** Last modification date
- **Version:** Current version number
- **Body:** Page content (the API returns this in markdown format)
- **Labels:** Array of page labels
- **Ancestors:** Parent page hierarchy

### Step 4: Format as Markdown

Structure the output as:

```markdown
# {Title}

**Space:** {Space Name} ({Space Key})
**Author:** {Author} | **Last Modified:** {Last Modified}
**Version:** {Version} | **Labels:** {Labels}

---

{Page body content}
```

### Step 5: Validate Response

- Confirm the page content is not empty
- Verify the title and page ID are present
- If the page is not found, report a `PAGE_NOT_FOUND` error

## Error Handling

- **Page not found:** Return structured error with the provided identifier
- **Multiple matches (title search):** Use the most recently modified match and note alternatives
- **Permission denied:** User lacks access to the space -- report with space key
- **API timeout:** Retry up to 2 times with brief delay
