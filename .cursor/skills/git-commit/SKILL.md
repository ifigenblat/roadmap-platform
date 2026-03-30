---
name: git-commit
description: Commit staged changes with an AI-generated message and automatic pre-commit hook failure handling. Use when the user wants to commit changes, create a commit, or save their work to git.
promp:
  package: "git"
  version: "1.5.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "git-commit"
---

# Commit

Commit staged changes with an AI-generated commit message, with automatic pre-commit hook failure handling.

## Overview

This skill automates the git commit process by:
1. Analyzing currently staged changes to understand what is being committed
2. Generating a clear, conventional commit message based on the diff
3. Performing the commit with configurable hook verification
4. Automatically fixing and retrying when pre-commit hooks fail

The process only operates on already-staged changes — it does not auto-stage files. If no changes are staged, it immediately returns an error. When pre-commit hooks (linting, formatting, type checks) fail, the process analyzes the hook output, applies fixes, re-stages, regenerates the commit message to reflect the fixes, and retries. This cycle continues until the commit succeeds or the errors are determined to be unfixable.

## Parameters

- **{{verificationMode}}** (string, optional): Controls git hook verification behavior for the commit
  - Default value: `"full"`
  - Allowed values: `"full"`, `"no-verify"`, `"no-verify-commit"`
  - `"full"`: Run all commit hooks normally
  - `"no-verify"`: Use `--no-verify` flag to skip commit hooks
  - `"no-verify-commit"`: Use `--no-verify` flag to skip commit hooks

## Instructions

Commit the currently staged changes with an AI-generated message, handling pre-commit hook failures automatically:

### Step 1: Analyze Staged Changes

#### Inputs
- Current git staging area (index)

#### Actions
- [ ] Run `git diff --cached --name-only` to get the list of all staged files
- [ ] Run `git diff --cached` to review the actual changes in those files
- [ ] Understand the high-level concepts and patterns of what's being committed
- [ ] Categorize the changes (new feature, bug fix, refactor, chore, docs, etc.)

#### Outputs
- **staged_files**: Array of file paths that are staged
- **staged_diff**: The full diff of staged changes
- **change_category**: The type of change (feat, fix, chore, refactor, docs, etc.)
- **has_staged_changes**: Boolean indicating if there are any staged files

#### Validation
- [ ] **has_staged_changes** is true
- [ ] **staged_files** is not empty
- [ ] **staged_diff** is not empty

**CRITICAL STOP CONDITION**: If no staged files are found, **IMMEDIATELY RETURN** a `NoStagedChangesError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "NO_STAGED_CHANGES",
  "message": "No staged changes found to commit. Use 'git add' to stage files before committing."
}
```

### Step 2: Generate Commit Message

#### Inputs
- **staged_files** (from Step 1, required)
- **staged_diff** (from Step 1, required)
- **change_category** (from Step 1, required)

#### Actions
- [ ] Analyze the diff to understand the purpose and scope of the changes
- [ ] Write a clear, descriptive commit message that:
  - Summarizes the high-level purpose of the changes
  - Follows conventional commit format (feat:, fix:, chore:, refactor:, docs:, etc.)
  - Groups related changes together
  - Is concise but informative
- [ ] Use imperative mood (e.g., "Add feature" not "Added feature")
- [ ] Keep the subject line under 72 characters
- [ ] Add a body if the changes are complex enough to warrant further explanation

#### Outputs
- **commit_message**: The generated commit message string
- **generation_error**: String containing any errors (null if successful)

#### Validation
- [ ] **commit_message** is not empty
- [ ] **commit_message** follows conventional commit format
- [ ] Subject line is under 72 characters
- [ ] **generation_error** is null

**CRITICAL STOP CONDITION**: If unable to generate a suitable commit message, **IMMEDIATELY RETURN** a `CommitMessageGenerationError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "COMMIT_MESSAGE_GENERATION_FAILED",
  "message": "Failed to generate commit message from staged changes",
  "reason": "Specific reason why generation failed"
}
```

### Step 3: Attempt Commit

#### Inputs
- **commit_message** (from Step 2, required)
- **verificationMode** (from parameters, optional)

#### Actions
- [ ] Determine the appropriate commit flags based on `{{verificationMode}}`:
  - **Scenario A** (`"full"`): Run `git commit -m "<message>"` with no extra flags
  - **Scenario B** (`"no-verify"` or `"no-verify-commit"`): Run `git commit --no-verify -m "<message>"`
- [ ] Execute the commit command
- [ ] Capture the exit code and output

#### Outputs
- **commit_success**: Boolean indicating if the commit succeeded
- **commit_hash**: The SHA of the created commit (null if failed)
- **commit_output**: Full output from the commit command
- **hook_failure**: Boolean indicating if failure was due to a pre-commit hook
- **hook_output**: Output from the failed hook (null if no hook failure)

#### Validation
- [ ] If **commit_success** is true, proceed to Step 5 (Return Success)
- [ ] If **hook_failure** is true, proceed to Step 4 (Handle Pre-Commit Hook Failures)
- [ ] If commit failed for non-hook reasons, analyze the error and return appropriate error JSON

### Step 4: Handle Pre-Commit Hook Failures

#### Inputs
- **hook_output** (from Step 3, required)
- **staged_files** (from Step 1, required)
- **staged_diff** (from Step 1, required)
- **commit_message** (from Step 2, required)
- **verificationMode** (from parameters, optional)

#### Actions
- [ ] Analyze the hook error output to identify specific failures (linting, formatting, type errors, etc.)
- [ ] For each identified issue:
  - Determine if the issue is automatically fixable
  - Apply the appropriate fix:
    - Linting errors: run linter fix commands or manually fix the code
    - Formatting errors: run formatter or manually apply formatting
    - Type errors: identify and fix TypeScript/type issues
  - Verify the fix was successful
- [ ] Stage all fixed files with `git add`
- [ ] Re-analyze the full set of changes (original + fixes) by running `git diff --cached`
- [ ] Generate a NEW commit message that reflects both the original changes and the applied fixes
- [ ] Retry the commit with the same verification flags as Step 3

#### Outputs
- **fixes_applied**: Array of strings describing each fix that was applied
- **retry_commit_success**: Boolean indicating if the retry commit succeeded
- **retry_commit_hash**: The SHA of the created commit (null if retry failed)
- **retry_hook_failure**: Boolean indicating if the retry also failed due to hooks
- **unfixable_errors**: Array of errors that could not be automatically fixed

#### Validation
- [ ] If **retry_commit_success** is true, proceed to Step 5 with the retry results
- [ ] If **retry_hook_failure** is true, repeat Step 4 actions for remaining issues

**Retry Logic**: Continue the fix-stage-recommit cycle up to 3 times. Each retry should address remaining hook failures from the previous attempt.

**CRITICAL STOP CONDITION**: If pre-commit hook failures cannot be automatically fixed after reasonable attempts, **IMMEDIATELY RETURN** a `PreCommitHookError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "PRE_COMMIT_HOOK_FAILED",
  "message": "Pre-commit hook failed with unfixable errors",
  "hookOutput": "Full output from the failed pre-commit hook",
  "failedChecks": ["list", "of", "failed", "checks"]
}
```

### Step 5: Return Success

#### Inputs
- **commit_hash** (from Step 3 or Step 4)
- **commit_message** (from Step 2 or regenerated in Step 4)
- **staged_files** (from Step 1)
- **fixes_applied** (from Step 4, optional — empty array if no fixes needed)

#### Actions
- [ ] Run `git branch --show-current` to get the current branch name
- [ ] Count the number of files changed
- [ ] Determine if pre-commit fixes were applied
- [ ] Format and return the success JSON response

#### Outputs
- Return the success JSON matching the Response Format schema

#### Validation
- [ ] **success** is true
- [ ] **commitHash** is a valid git SHA
- [ ] **branch** is not empty
- [ ] **filesChanged** matches the count of staged files
- [ ] Output matches the returns schema exactly

## Response Format

This process returns structured JSON output.

### Success Response

```json
{
  "success": true,
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "commitMessage": "feat: add user authentication with JWT tokens",
  "branch": "feature/auth",
  "filesChanged": 5,
  "preCommitFixesApplied": false,
  "fixesApplied": []
}
```

**Field Descriptions:**
- `success`: Always `true` for successful commits
- `commitHash`: The full Git commit SHA of the created commit
- `commitMessage`: The AI-generated (or regenerated) commit message that was used
- `branch`: The current branch name where the commit was made
- `filesChanged`: Number of files included in the commit
- `preCommitFixesApplied`: Whether any pre-commit hook failures were encountered and fixed
- `fixesApplied`: Array of human-readable descriptions of each fix applied (empty if none)

## Error Handling

This process may return the following structured errors. When any error occurs, execution **IMMEDIATELY STOPS** and only the error JSON is returned.

### NoStagedChangesError

Returned when there are no staged changes to commit.

```json
{
  "code": "NO_STAGED_CHANGES",
  "message": "No staged changes found to commit. Use 'git add' to stage files before committing."
}
```

**When it occurs:**
- `git diff --cached --name-only` returns empty output
- No files have been added to the staging area with `git add`

### PreCommitHookError

Returned when pre-commit hook fails and cannot be automatically fixed.

```json
{
  "code": "PRE_COMMIT_HOOK_FAILED",
  "message": "Pre-commit hook failed with unfixable errors",
  "hookOutput": "Full output from the failed pre-commit hook",
  "failedChecks": ["eslint", "type-check"]
}
```

**When it occurs:**
- Pre-commit hook reports errors that cannot be auto-fixed (e.g., complex logic errors, test failures)
- Automatic fix attempts have been exhausted (up to 3 retries)
- Hook failures persist after applying all possible fixes

### CommitMessageGenerationError

Returned when the AI fails to generate a suitable commit message.

```json
{
  "code": "COMMIT_MESSAGE_GENERATION_FAILED",
  "message": "Failed to generate commit message from staged changes",
  "reason": "Unable to analyze diff output or changes are too complex to summarize"
}
```

**When it occurs:**
- Staged changes are too complex or incoherent to summarize
- Diff output cannot be analyzed meaningfully
- Changes span unrelated concerns with no unifying theme

## Examples

### Example 1: Simple Feature Commit

**Scenario:** Commit a new feature with clean hooks

**Input:**
```json
{
  "verificationMode": "full"
}
```

**Output:**
```json
{
  "success": true,
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "commitMessage": "feat: add user authentication with JWT tokens",
  "branch": "feature/auth",
  "filesChanged": 5,
  "preCommitFixesApplied": false,
  "fixesApplied": []
}
```

### Example 2: Commit with Pre-Commit Fixes

**Scenario:** Commit where pre-commit hooks fail and fixes are applied automatically

**Input:**
```json
{
  "verificationMode": "full"
}
```

**Output:**
```json
{
  "success": true,
  "commitHash": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1",
  "commitMessage": "fix: resolve validation errors and apply linting fixes",
  "branch": "main",
  "filesChanged": 3,
  "preCommitFixesApplied": true,
  "fixesApplied": [
    "Fixed ESLint errors in src/auth.ts",
    "Applied Prettier formatting to src/components/Login.tsx",
    "Fixed TypeScript type errors in src/utils/validation.ts"
  ]
}
```

### Example 3: Commit with Skipped Hooks

**Scenario:** Commit without running any hooks

**Input:**
```json
{
  "verificationMode": "no-verify"
}
```

**Output:**
```json
{
  "success": true,
  "commitHash": "i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4e5f6g7h8",
  "commitMessage": "chore: update dependencies",
  "branch": "develop",
  "filesChanged": 2,
  "preCommitFixesApplied": false,
  "fixesApplied": []
}
```

### Example 4: Error Case - No Staged Changes

**Scenario:** Attempting to commit when nothing is staged

**Error Output:**
```json
{
  "code": "NO_STAGED_CHANGES",
  "message": "No staged changes found to commit. Use 'git add' to stage files before committing."
}
```

### Example 5: Error Case - Unfixable Pre-Commit Hook

**Scenario:** Pre-commit hook fails with errors that cannot be automatically resolved

**Error Output:**
```json
{
  "code": "PRE_COMMIT_HOOK_FAILED",
  "message": "Pre-commit hook failed with unfixable errors",
  "hookOutput": "Running tests...\nFAILED: src/auth.test.ts - Expected 200 but received 401\n1 test suite failed",
  "failedChecks": ["jest"]
}
```

## Notes

**Important Considerations:**
- This process only commits what is currently staged — it does not run `git add` or auto-stage files
- The commit message is regenerated after hook fixes to accurately reflect all changes being committed
- Pre-commit hook fix retries are limited to 3 attempts to avoid infinite loops

**Best Practices:**
- Stage your intended changes with `git add` before running this process
- Use `"full"` verification mode (default) to catch issues early
- Only use `"no-verify"` when you have a specific reason to skip hooks

**Limitations:**
- Cannot fix all types of pre-commit hook failures (e.g., failing tests require manual intervention)
- Does not push to remote — use `commitAndPush` or `commitPullPush` for combined workflows
- Does not resolve merge conflicts — this process only handles the commit step

**Git Commands Used:**
- `git status --porcelain` to check staged files
- `git diff --cached` to review staged changes
- `git diff --cached --name-only` to list staged file paths
- `git branch --show-current` to get the current branch name
- `git commit` with appropriate flags based on `{{verificationMode}}`
