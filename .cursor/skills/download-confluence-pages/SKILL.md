---
name: download-confluence-pages
description: Downloads multiple Confluence pages and saves each as a markdown file. Supports batch retrieval from search results, explicit page IDs, or CQL queries. Use when exporting Confluence content for offline reference or analysis.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "download-confluence-pages"
---

# Download Confluence Pages

Downloads multiple Confluence pages and saves each as an individual markdown file.

## When to Use

Use this skill when you need to:
- Download a batch of Confluence pages from search results
- Save specific pages by ID as local markdown files
- Export Confluence content for offline analysis or summarization

## Prerequisites

- Atlassian MCP connection validated (use `validate-mcp-connection` skill first)
- Valid cloud ID obtained from connection validation

## Instructions

### Step 1: Determine Input Type

The input can be:
- **Array of page IDs:** Download specific pages
- **CQL query:** Search and download matching pages
- **Page list from prior search:** Process a pre-fetched list of page references

### Step 2: Retrieve Pages

**For page IDs:**
Call `mcp_atlassian_getConfluencePage` for each page ID sequentially.

**For CQL queries:**
Call `mcp_atlassian_searchConfluenceUsingCql` with:
- `cloudId` -- From the validated connection
- `cql` -- The CQL query string (e.g., `text ~ 'topic' ORDER BY lastModified DESC`)
- Paginate through results if needed

### Step 3: Process Each Page Sequentially

For each page, one at a time:

1. Retrieve full page content using `mcp_atlassian_getConfluencePage`
2. Extract metadata: title, author, dates, labels, space
3. Convert content to markdown (API provides markdown format)
4. Generate a safe filename: `{page_id}_{sanitized_title}.md`
   - Replace spaces with hyphens
   - Remove invalid filename characters
   - Lowercase the title portion
   - Truncate to reasonable length (max 80 chars total)
5. Save the file to the `confluence/` output directory
6. Confirm the file was written successfully before proceeding

### Step 4: Optionally Gather Additional Context

For each page, optionally collect:
- `mcp_atlassian_getConfluencePageAncestors` -- Parent page hierarchy
- `mcp_atlassian_getConfluencePageFooterComments` -- Discussion comments
- `mcp_atlassian_getConfluencePageInlineComments` -- Inline feedback

Append this context to the page markdown file if available.

### Step 5: Create Manifest

After all pages are processed, create a `confluence/MANIFEST.md` file:

```markdown
# Downloaded Confluence Pages

**Downloaded:** {timestamp}
**Total Pages:** {count}

| Page ID | Title | Space | Last Modified | File |
|---------|-------|-------|---------------|------|
| 123456 | Page Title | ENG | 2025-01-15 | 123456_page-title.md |
```

### Step 6: Report Results

Return:
- Total pages found
- Total pages downloaded successfully
- Any failures with reasons
- Output directory path
- List of created files

## Error Handling

- **Individual page failure:** Log the error, continue with remaining pages
- **CQL syntax error:** Report the invalid query and suggest corrections
- **File write failure:** Report the path and error, continue with remaining pages
- **Empty results:** Return a clear message that no pages matched the criteria
- **Rate limiting:** Add brief delays between requests if rate-limited
