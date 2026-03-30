---
name: git-push
description: Push the current branch to the remote origin with configurable hook verification. Use when the user wants to push commits, upload changes, or sync their branch to the remote.
promp:
  package: "git"
  version: "1.5.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "git-push"
---

# Push

Push the current branch to the remote origin.

## Overview

This skill automates the git push process by:
1. Determining the current branch and latest commit
2. Pushing to the remote origin with configurable hook verification
3. Detecting when the remote has diverged and instructing the user to pull first

The push process does **not** attempt to rebase or resolve merge conflicts. If the remote has commits that are not present locally, the push is rejected and the process returns a `RemoteChangesError` directing the user to run the `pull` command first to integrate those changes.

This skill is designed to be used standalone or as part of larger workflows like `commitAndPush`. It assumes a commit has already been made — it does not perform any commit operations.

## Parameters

- **{{verificationMode}}** (string, optional): Controls git hook verification behavior for the push
  - Default value: `"full"`
  - Allowed values: `"full"`, `"no-verify"`, `"no-verify-push"`
  - `"full"`: Run all push hooks normally
  - `"no-verify"`: Use `--no-verify` flag to skip push hooks
  - `"no-verify-push"`: Use `--no-verify` flag to skip push hooks

## Instructions

Push the current branch to the remote origin:

### Step 1: Determine Current State

#### Inputs
- Current git repository state

#### Actions
- [ ] Run `git branch --show-current` to get the current branch name
- [ ] Run `git rev-parse HEAD` to get the current commit hash
- [ ] Run `git log --oneline -1` to confirm the latest commit details

#### Outputs
- **branch**: The current branch name
- **commit_hash**: The SHA of the current HEAD commit
- **commit_message**: The message of the latest commit

#### Validation
- [ ] **branch** is not empty (not in detached HEAD state)
- [ ] **commit_hash** is a valid git SHA

### Step 2: Attempt Push

#### Inputs
- **branch** (from Step 1, required)
- **commit_hash** (from Step 1, required)
- **verificationMode** (from parameters, optional)

#### Actions
- [ ] Determine the appropriate push flags based on `{{verificationMode}}`:
  - **Scenario A** (`"full"`): Run `git push origin <branch>` with no extra flags
  - **Scenario B** (`"no-verify"` or `"no-verify-push"`): Run `git push --no-verify origin <branch>`
- [ ] Execute the push command
- [ ] Capture the exit code and output
- [ ] Analyze the output to determine the failure type (if any)

#### Outputs
- **push_success**: Boolean indicating if the push succeeded
- **push_output**: Full output from the push command
- **rejection_type**: One of: `null` (success), `"remote_changes"`, `"hook_failure"`, `"auth_failure"`, `"protected_branch"`, `"network_error"`

#### Validation
- [ ] If **push_success** is true, proceed to Step 3 (Return Success)
- [ ] If **rejection_type** is any error type, return the appropriate error JSON

**CRITICAL STOP CONDITION - Remote Has Diverged**: If push is rejected because the remote has commits not present locally (e.g., "rejected - non-fast-forward", "Updates were rejected because the remote contains work that you do not have locally"), **IMMEDIATELY RETURN** a `RemoteChangesError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "REMOTE_CHANGES_EXIST",
  "message": "Push rejected: the remote branch has commits that are not present locally. Run the 'pull' command first to integrate remote changes, then retry the push.",
  "branch": "the branch name",
  "commitHash": "the_commit_hash",
  "pushOutput": "Full output from the rejected push command"
}
```

**CRITICAL STOP CONDITION - Push Hook Failure**: If push fails due to a push hook, **IMMEDIATELY RETURN** a `PushHookError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "PUSH_HOOK_FAILED",
  "message": "Push hook failed. Manual intervention required.",
  "hookOutput": "Full output from the failed push hook",
  "commitHash": "the_commit_hash"
}
```

**CRITICAL STOP CONDITION - Authentication Failure**: If push fails due to authentication, **IMMEDIATELY RETURN** an `AuthenticationError` JSON response:
```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Authentication to remote repository failed",
  "remote": "the remote URL"
}
```

**CRITICAL STOP CONDITION - Protected Branch**: If push fails due to branch protection, **IMMEDIATELY RETURN** a `ProtectedBranchError` JSON response:
```json
{
  "code": "PROTECTED_BRANCH",
  "message": "Cannot push to protected branch without required permissions",
  "branch": "the branch name",
  "requiredPermissions": ["push", "bypass-branch-protection"]
}
```

**CRITICAL STOP CONDITION - Network Error**: If push fails due to network issues, **IMMEDIATELY RETURN** a `NetworkError` JSON response:
```json
{
  "code": "NETWORK_ERROR",
  "message": "Failed to push to remote due to network connectivity issues",
  "commitHash": "the_commit_hash"
}
```

### Step 3: Return Success

#### Inputs
- **branch** (from Step 1)
- **commit_hash** (from Step 1)

#### Actions
- [ ] Format and return the success JSON response

#### Outputs
- Return the success JSON matching the Response Format schema

#### Validation
- [ ] **success** is true
- [ ] **branch** is not empty
- [ ] **commitHash** is a valid git SHA
- [ ] Output matches the returns schema exactly

## Response Format

This process returns structured JSON output.

### Success Response

```json
{
  "success": true,
  "branch": "feature/auth",
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
}
```

**Field Descriptions:**
- `success`: Always `true` for successful pushes
- `branch`: The branch name that was pushed to
- `commitHash`: The commit SHA that was pushed

## Error Handling

This process may return the following structured errors. When any error occurs, execution **IMMEDIATELY STOPS** and only the error JSON is returned.

### RemoteChangesError

Returned when the remote branch has commits that are not present locally. The push is rejected and the user must run `pull` first.

```json
{
  "code": "REMOTE_CHANGES_EXIST",
  "message": "Push rejected: the remote branch has commits that are not present locally. Run the 'pull' command first to integrate remote changes, then retry the push.",
  "branch": "feature/auth",
  "commitHash": "a1b2c3d4",
  "pushOutput": "To gitlab.com:group/project.git\n ! [rejected] feature/auth -> feature/auth (non-fast-forward)"
}
```

**When it occurs:**
- Remote branch has commits that are not in the local branch
- Push is rejected with "non-fast-forward" or similar rejection message
- Another developer has pushed changes since the last pull

### PushHookError

Returned when a push hook fails. Push hooks are never retried.

```json
{
  "code": "PUSH_HOOK_FAILED",
  "message": "Push hook failed. Manual intervention required.",
  "hookOutput": "Full output from the failed push hook",
  "commitHash": "a1b2c3d4"
}
```

**When it occurs:**
- A pre-push or push hook script exits with a non-zero code
- The hook output indicates a policy violation or check failure

### NetworkError

Returned when network connectivity issues prevent push.

```json
{
  "code": "NETWORK_ERROR",
  "message": "Failed to push to remote due to network connectivity issues",
  "commitHash": "a1b2c3d4"
}
```

**When it occurs:**
- Cannot reach the remote host
- Connection times out during push
- DNS resolution fails

### AuthenticationError

Returned when authentication fails for the remote repository.

```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Authentication to remote repository failed",
  "remote": "git@gitlab.com:group/project.git"
}
```

**When it occurs:**
- SSH key is not configured or has been revoked
- Personal access token has expired
- Credentials are invalid or missing

### ProtectedBranchError

Returned when pushing to a protected branch without required permissions.

```json
{
  "code": "PROTECTED_BRANCH",
  "message": "Cannot push to protected branch without required permissions",
  "branch": "main",
  "requiredPermissions": ["push", "bypass-branch-protection"]
}
```

**When it occurs:**
- Pushing directly to a branch that requires pull requests
- Branch protection rules prevent force pushes or direct commits
- User lacks the required permissions

## Examples

### Example 1: Clean Push

**Scenario:** Push succeeds on the first attempt with no remote changes

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
  "branch": "feature/auth",
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
}
```

### Example 2: Push with Skipped Hooks

**Scenario:** Push without running push hooks

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
  "branch": "develop",
  "commitHash": "i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4e5f6g7h8"
}
```

### Example 3: Error Case - Remote Has Diverged

**Scenario:** Push rejected because the remote has newer commits

**Error Output:**
```json
{
  "code": "REMOTE_CHANGES_EXIST",
  "message": "Push rejected: the remote branch has commits that are not present locally. Run the 'pull' command first to integrate remote changes, then retry the push.",
  "branch": "feature/auth",
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "pushOutput": "To gitlab.com:group/project.git\n ! [rejected] feature/auth -> feature/auth (non-fast-forward)\nerror: failed to push some refs"
}
```

### Example 4: Error Case - Push Hook Failure

**Scenario:** Push hook rejects the push

**Error Output:**
```json
{
  "code": "PUSH_HOOK_FAILED",
  "message": "Push hook failed. Manual intervention required.",
  "hookOutput": "pre-push hook: CI pipeline status check failed - pipeline #1234 is still running",
  "commitHash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
}
```

### Example 5: Error Case - Authentication Failure

**Scenario:** Push fails due to expired credentials

**Error Output:**
```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Authentication to remote repository failed",
  "remote": "git@gitlab.com:group/project.git"
}
```

## Notes

**Important Considerations:**
- This process assumes a commit has already been made — it only handles the push step
- Push hook failures are **never retried** — they always return an error immediately
- This process does **not** attempt to rebase or resolve merge conflicts — if the remote has diverged, it returns a `RemoteChangesError` instructing the user to run `pull` first
- The separation of push and pull keeps each process focused on a single responsibility

**Best Practices:**
- Run the `pull` command before pushing to ensure your branch is up to date
- Use `"full"` verification mode (default) to ensure push hooks run
- Only use `"no-verify"` when you have a specific reason to skip push hooks
- Combine with the `commit` prompt for a full commit-and-push workflow

**Limitations:**
- Does not perform any commit operations — use the `commit` prompt first
- Does not integrate remote changes — use the `pull` prompt to sync before pushing
- Push hooks are never retried, even if the failure might be transient

**Git Commands Used:**
- `git branch --show-current` to get the current branch name
- `git rev-parse HEAD` to get the current commit hash
- `git push origin <branch>` with appropriate flags based on `{{verificationMode}}`
