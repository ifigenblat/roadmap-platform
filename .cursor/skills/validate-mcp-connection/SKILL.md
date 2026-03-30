---
name: validate-mcp-connection
description: Validates the Atlassian MCP server connection by retrieving accessible resources and verifying user access. Use before any Jira or Confluence operation to confirm connectivity and obtain the cloud ID.
promp:
  package: "jira"
  version: "1.1.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "validate-mcp-connection"
---

# Validate MCP Connection

Validates that the Atlassian MCP server is connected and the current user has appropriate access to Jira and Confluence resources.

## When to Use

Use this skill as the first step before any Jira or Confluence operation. It confirms:
- The Atlassian MCP server is reachable
- The user is authenticated
- The cloud ID is available for subsequent API calls

## Instructions

### Step 1: Get Accessible Resources

Call `mcp_atlassian_getAccessibleAtlassianResources` to retrieve the list of Atlassian cloud instances the user can access.

**Expected output:** An array of resources, each containing:
- `id` (cloud ID) -- UUID format
- `name` (site name)
- `url` (site URL)
- `scopes` (available permissions)

### Step 2: Validate Cloud ID

From the resources returned, extract the `id` field as the `cloud_id`.

**Validation:**
- Verify the cloud ID is a valid UUID format
- If multiple resources are returned, use the first one (or let the user specify)
- If no resources are returned, the connection has failed

### Step 3: Verify User Access

Call `mcp_atlassian_atlassianUserInfo` to confirm the current user's identity and permissions.

**Expected output:**
- `account_id` -- User's Atlassian account ID
- `name` -- Display name
- `email` -- User email

### Step 4: Return Connection Status

Provide the validated connection details:
- `cloud_id` -- The Atlassian cloud instance ID
- `user_info` -- Current user details
- `access_validated` -- Boolean confirmation

## Error Handling

If `getAccessibleAtlassianResources` returns empty or errors:
1. Verify the MCP server is configured in the IDE
2. Check that the user has completed OAuth authentication
3. Retry up to 2 times before reporting failure

**Common failure causes:**
- MCP server not configured or not running
- OAuth token expired (re-authenticate via browser)
- Network connectivity issues
