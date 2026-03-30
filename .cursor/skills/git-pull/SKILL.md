---
name: git-pull
description: Pull latest remote changes using a stash-based rebase workflow that safely preserves local work-in-progress. Use when the user wants to pull changes, sync with remote, update their branch, or fetch latest code.
promp:
  package: "git"
  version: "1.5.1"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "git-pull"
---

# Pull with Rebase

Pull the latest remote changes using a stash-based rebase workflow that safely preserves local work.

## Overview

This skill automates a safe git pull workflow that:
1. Stages all local changes with `git add -A`
2. Stashes them to create a clean working tree
3. Pulls remote changes with `--rebase` for linear history
4. Restores stashed changes with `git stash pop`
5. Resolves any merge conflicts that arise from the stash pop

This approach ensures local work-in-progress is never lost and remote changes are integrated cleanly.

## Critical Error Handling Requirements

**IMPORTANT**: When any error occurs during the pull workflow, you must **IMMEDIATELY STOP** execution and return a structured JSON error response. Do not attempt to continue with partial operations.

**ABSOLUTELY FORBIDDEN**: Never run `git reset --hard`, `git reset HEAD --hard`, `git checkout -- .`, `git clean -fd`, or any other command that irreversibly destroys uncommitted work. Preserving the user's local changes is the highest priority of this workflow. When recovery is needed, use safe operations like `git rebase --abort` or `git stash pop` instead.

### Error Response Format

All errors must be returned as JSON objects matching one of these specific schemas:

1. **StashError** - When git stash fails
2. **PullError** - When git pull --rebase fails
3. **StashPopConflictError** - When stash pop conflicts are too complex to auto-resolve
4. **NetworkError** - When network connectivity issues prevent pull
5. **AuthenticationError** - When authentication fails for remote repository
6. **RebaseError** - When pull --rebase fails due to corrupted repository state

### Error Response Examples

**Stash Error:**
```json
{
  "code": "STASH_FAILED",
  "message": "Failed to stash local changes",
  "stashOutput": "Full output from the failed stash command"
}
```

**Pull Error:**
```json
{
  "code": "PULL_FAILED",
  "message": "git pull --rebase failed",
  "pullOutput": "Full output from the failed pull command",
  "recoverySteps": [
    "Run 'git rebase --abort' to cancel the rebase",
    "Manually resolve conflicts and run 'git rebase --continue'"
  ]
}
```

**Stash Pop Conflict (Complex):**
```json
{
  "code": "STASH_POP_CONFLICT",
  "message": "Stash pop produced merge conflicts that require user input to resolve",
  "conflictedFiles": ["src/auth.ts", "src/api/login.ts"],
  "localChanges": "Description of stashed local changes",
  "remoteChanges": "Description of newly pulled remote changes",
  "clarificationNeeded": "Specific questions that need user input to resolve"
}
```

**Network Error:**
```json
{
  "code": "NETWORK_ERROR",
  "message": "Failed to pull from remote due to network connectivity issues"
}
```

**Authentication Error:**
```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Authentication to remote repository failed",
  "remote": "git@gitlab.com:group/project.git"
}
```

**Rebase Error:**
```json
{
  "code": "REBASE_FAILED",
  "message": "Rebase operation failed during pull",
  "rebaseOutput": "Full output from the failed rebase operation",
  "recoverySteps": [
    "Run 'git rebase --abort' to cancel the rebase",
    "Run 'git stash pop' to restore your local changes",
    "Try manual merge with 'git pull --no-rebase'"
  ]
}
```

**DO NOT** return the normal success JSON structure when errors occur. **ONLY** return the appropriate error JSON.

## Workflow

### Step 1: Stage All Local Changes

#### Inputs
- Current working directory state (tracked + untracked files)

#### Actions
- [ ] Run `git status --porcelain` to capture the current state of the working tree
- [ ] Record whether there are any local changes (tracked or untracked)
- [ ] Run `git add -A` to stage all changes (tracked modifications, deletions, and untracked files)
- [ ] Verify staging succeeded by running `git status --porcelain` again

#### Outputs
- **had_local_changes**: Boolean indicating if there were local changes to stash
- **staged_files**: List of files that were staged
- **add_error**: String containing any errors (null if successful)

#### Validation
- [ ] `git add -A` exited with code 0
- [ ] `add_error` is null

**Note**: If there are no local changes, skip Steps 2 and 5 (stash and stash pop) and proceed directly to Step 3 (pull).

### Step 2: Stash Local Changes

#### Inputs
- **had_local_changes** (from Step 1, required)

#### Actions
- [ ] Skip this step if `had_local_changes` is false
- [ ] Run `git stash push -m "promp-pull-autostash"` to stash all staged changes with a recognizable message
- [ ] Verify the stash was created by running `git stash list` and checking the top entry

#### Outputs
- **stash_created**: Boolean indicating if a stash entry was created
- **stash_ref**: The stash reference (e.g., `stash@{0}`)
- **stash_error**: String containing any errors (null if successful)

#### Validation
- [ ] `stash_created` is true (if `had_local_changes` was true)
- [ ] `stash_error` is null

**CRITICAL STOP CONDITION**: If stash fails, **IMMEDIATELY RETURN** a `StashError` JSON response and **STOP ALL OPERATIONS**:
```json
{
  "code": "STASH_FAILED",
  "message": "Failed to stash local changes",
  "stashOutput": "Full output from the failed stash command"
}
```

### Step 3: Pull with Rebase

#### Inputs
- Clean working tree (changes are stashed)

#### Actions
- [ ] Run `git branch --show-current` to get the current branch name
- [ ] Run `git pull --rebase` to fetch and rebase onto remote changes
- [ ] Capture the pull output for success/failure analysis

#### Outputs
- **pull_success**: Boolean indicating if pull succeeded
- **branch**: Current branch name
- **pull_output**: Full output from the pull command
- **new_commits_pulled**: Boolean indicating if new commits were fetched
- **pull_error**: String containing any errors (null if successful)

#### Validation
- [ ] `pull_success` is true
- [ ] `pull_error` is null

**CRITICAL STOP CONDITION - Network Error**: If pull fails due to network issues, restore stashed changes first (`git stash pop` if stash was created), then **IMMEDIATELY RETURN** a `NetworkError` JSON response:
```json
{
  "code": "NETWORK_ERROR",
  "message": "Failed to pull from remote due to network connectivity issues"
}
```

**CRITICAL STOP CONDITION - Authentication Error**: If pull fails due to authentication, restore stashed changes first (`git stash pop` if stash was created), then **IMMEDIATELY RETURN** an `AuthenticationError` JSON response:
```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Authentication to remote repository failed",
  "remote": "the remote URL"
}
```

**CRITICAL STOP CONDITION - Rebase Conflict During Pull**: If `git pull --rebase` encounters conflicts:
- [ ] Get the list of conflicted files using `git status --porcelain` (look for "UU" status)
- [ ] For each conflicted file:
  - Read the current state with conflict markers
  - Analyze the incoming changes using `git log origin/<branch> --not HEAD`
  - Review commit messages to understand the intent of remote changes
  - Compare our changes vs their changes
  - Attempt to resolve conflicts intelligently by:
    - Keeping both changes if they don't overlap
    - Preferring remote changes for obvious fixes (typos, formatting)
    - Integrating both logical changes when compatible
- [ ] If able to resolve: stage resolved files with `git add` and continue rebase with `git rebase --continue`
- [ ] If conflicts are too complex:
  - Run `git rebase --abort` to restore pre-pull state
  - Run `git stash pop` if stash was created
  - **IMMEDIATELY RETURN** a `PullError` JSON response

**CRITICAL STOP CONDITION - Rebase Failure**: If rebase fails due to corrupted state, run `git rebase --abort`, restore stashed changes (`git stash pop` if stash was created), then **IMMEDIATELY RETURN** a `RebaseError` JSON response:
```json
{
  "code": "REBASE_FAILED",
  "message": "Rebase operation failed during pull",
  "rebaseOutput": "Full output from the failed rebase operation",
  "recoverySteps": [
    "Run 'git rebase --abort' to cancel the rebase",
    "Run 'git stash pop' to restore your local changes",
    "Try manual merge with 'git pull --no-rebase'"
  ]
}
```

### Step 4: Verify Pull Success

#### Inputs
- **pull_success** (from Step 3)
- **branch** (from Step 3)

#### Actions
- [ ] Run `git log --oneline -5` to see the latest commits on the branch
- [ ] Confirm the branch is up to date with remote

#### Outputs
- **up_to_date**: Boolean indicating if branch is now up to date with remote
- **latest_commits**: Array of recent commit messages

#### Validation
- [ ] `up_to_date` is true
- [ ] Branch is not in a rebase or merge state

### Step 5: Restore Stashed Changes

#### Inputs
- **stash_created** (from Step 2)
- **stash_ref** (from Step 2)

#### Actions
- [ ] Skip this step if `stash_created` is false
- [ ] Run `git stash pop` to restore the stashed local changes
- [ ] Check the exit code and output for conflicts

#### Outputs
- **pop_success**: Boolean indicating if stash pop succeeded cleanly
- **conflicts_detected**: Boolean indicating if merge conflicts occurred
- **conflicted_files**: Array of files with conflicts (empty if none)
- **pop_error**: String containing any errors (null if successful)

#### Validation
- [ ] If `pop_success` is true and `conflicts_detected` is false, proceed to Step 7 (Return Success)
- [ ] If `conflicts_detected` is true, proceed to Step 6 (Resolve Conflicts)

### Step 6: Resolve Stash Pop Merge Conflicts

#### Inputs
- **conflicted_files** (from Step 5)
- **branch** (from Step 3)

#### Actions
- [ ] Get the list of conflicted files using `git status --porcelain` (look for "UU" status)
- [ ] For each conflicted file:
  - Read the file contents with conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
  - Extract the "ours" version (local stashed changes, between `<<<<<<< Updated upstream` and `=======`)
  - Extract the "theirs" version (current working tree after pull, between `=======` and `>>>>>>> Stashed changes`)
  - Analyze both versions to understand intent
  - Attempt to resolve conflicts intelligently by:
    - Keeping both changes if they don't overlap
    - Merging additions from both sides (new imports, new functions, new code blocks)
    - Preferring remote changes for formatting or style-only differences
    - Integrating both logical changes when they are complementary
    - **STOP and ask clarifying questions** if:
      - Changes overlap in complex ways
      - Logic conflicts exist between versions
      - Intent of either change is unclear
      - Risk of breaking functionality exists
- [ ] Write the resolved file contents (removing all conflict markers)
- [ ] Stage resolved files with `git add <file>`

#### Outputs
- **all_resolved**: Boolean indicating if all conflicts were resolved
- **resolved_files**: Array of files that were successfully resolved
- **unresolved_files**: Array of files that could not be auto-resolved

#### Validation
- [ ] All conflict markers are removed from resolved files
- [ ] `all_resolved` is true

**CRITICAL STOP CONDITION**: If any conflicts are too complex to auto-resolve, **IMMEDIATELY RETURN** a `StashPopConflictError` JSON response:
```json
{
  "code": "STASH_POP_CONFLICT",
  "message": "Stash pop produced merge conflicts that require user input to resolve",
  "conflictedFiles": ["list", "of", "conflicted", "files"],
  "localChanges": "Description of stashed local changes",
  "remoteChanges": "Description of newly pulled remote changes",
  "clarificationNeeded": "Specific question about which approach to use or how to integrate both changes"
}
```

## Merge Conflict Resolution Strategy

### When to Resolve Automatically

**Safe to Auto-Resolve:**
- Changes in different functions/methods within the same file
- Non-overlapping additions (new imports, new functions)
- Formatting or whitespace-only differences vs. logical changes
- Documentation updates vs. code changes
- Adding new code blocks that don't interfere with each other

**Example: Auto-resolvable**
```
Stashed (local): Added new import for `AuthService` and a helper function `validateToken()`
Pulled (remote): Added new import for `LogService` and a utility function `formatLog()`
Resolution: Keep both sets of imports and both functions
```

### When to Ask for Clarification

**Must Ask User:**
- Same function/method modified differently in local vs. remote
- Different logic for the same operation
- Conflicting configuration or constant values
- Different approaches to the same problem
- Removal vs. modification of the same code
- Breaking changes vs. additive changes

**Example: Needs Clarification**
```
Stashed (local): Changed MAX_RETRIES from 3 to 5
Pulled (remote): Changed MAX_RETRIES from 3 to 10
Question: "MAX_RETRIES was changed to 5 in your local changes and to 10 in the remote. Which value should be used?"
```

### Clarifying Questions Format

When asking for user input on conflicts:
1. **Show the conflict location** (file, function, line numbers)
2. **Show your local version** (stashed changes) with explanation
3. **Show the remote version** (pulled changes) with explanation
4. **Ask a specific question** about which approach to use
5. **Suggest a resolution** if one approach seems preferable

## Error Handling

### Fixable Errors (Retry / Auto-resolve)
- Simple stash pop conflicts (non-overlapping changes, complementary additions)
- Rebase conflicts during pull where changes don't logically conflict

### Non-Fixable Errors (Stop and Ask User)
- Complex stash pop conflicts with overlapping logic
- Ambiguous changes where intent is unclear
- Conflicts in critical functionality that require business decisions

### Non-Fixable Errors (Stop and Report)
- Network errors
- Authentication failures
- Stash failures
- Rebase failures due to corrupted repository state

### Recovery Guarantees
- If pull fails, stashed changes are restored before returning an error
- If stash pop fails with conflicts, conflict markers are left in files for manual resolution
- The workflow never drops or loses local changes
- **`git reset --hard` is strictly forbidden** - never use hard resets, `git checkout -- .`, `git clean -fd`, or any command that irreversibly discards uncommitted work; always prefer `git rebase --abort` or returning an error to the user over destroying data

## Important Notes

- **NEVER run `git reset --hard` or any destructive reset** - under no circumstances should a hard reset be performed; this workflow must never discard or lose local work
- **Stages all changes before stashing** - uses `git add -A` to capture tracked, modified, and untracked files
- **Uses a labeled stash** - the stash message `promp-pull-autostash` makes it identifiable if manual recovery is needed
- **Skips stash/pop when no local changes exist** - goes straight to pull if the working tree is clean
- **Uses rebase strategy** - keeps linear history by rebasing local commits onto remote changes
- **Restores stashed changes after pull** - always attempts `git stash pop` even if new commits were pulled
- **Resolves stash pop conflicts** - attempts intelligent auto-resolution of conflicts between local WIP and newly pulled code
- **Always returns structured JSON** - either success JSON with operation details or error JSON with specific error information
- **Never loses local work** - stashed changes are preserved and restored even on failure paths; if a step fails, prefer aborting and returning an error over any action that could destroy uncommitted changes

## Usage Examples

### Clean pull (no local changes)
```
1. git status shows clean working tree
2. Skip stash (no changes)
3. git pull --rebase succeeds
4. Skip stash pop (nothing stashed)
5. Return success
```

### Pull with local changes, no conflicts
```
1. git add -A stages 3 modified files
2. git stash push -m "promp-pull-autostash"
3. git pull --rebase brings in 2 new commits
4. git stash pop restores local changes cleanly
5. Return success with mergeConflictsResolved: false
```

### Pull with local changes and stash pop conflicts
```
1. git add -A stages local changes
2. git stash push -m "promp-pull-autostash"
3. git pull --rebase brings in changes to same files
4. git stash pop detects conflicts in src/config.ts
5. Analyze conflict: local added new config key, remote renamed existing key
6. Auto-resolve: keep both changes (non-overlapping)
7. Return success with mergeConflictsResolved: true
```

### Pull with complex conflicts requiring user input
```
1. git add -A stages local changes
2. git stash push -m "promp-pull-autostash"
3. git pull --rebase succeeds
4. git stash pop conflicts in src/auth.ts
5. Analyze: both local and remote changed the same function body
6. Cannot auto-resolve
7. Return StashPopConflictError with clarifying questions
```

## Expected JSON Response Schema (Success)

**IMPORTANT**: This schema is **ONLY** used when the pull operation completes successfully. If any critical errors occur, return the appropriate error JSON instead.

```json
{
  "success": true,
  "branch": "string - the current branch name",
  "newCommitsPulled": "boolean - whether new commits were fetched from remote",
  "stashUsed": "boolean - whether local changes were stashed and restored",
  "mergeConflictsResolved": "boolean - whether stash pop conflicts were encountered and resolved",
  "resolvedFiles": ["array of files where conflicts were resolved"]
}
```

### Success Response Examples

**No local changes, up to date:**
```json
{
  "success": true,
  "branch": "feature/auth",
  "newCommitsPulled": false,
  "stashUsed": false,
  "mergeConflictsResolved": false,
  "resolvedFiles": []
}
```

**Clean pull with local changes:**
```json
{
  "success": true,
  "branch": "main",
  "newCommitsPulled": true,
  "stashUsed": true,
  "mergeConflictsResolved": false,
  "resolvedFiles": []
}
```

**Pull with auto-resolved stash pop conflicts:**
```json
{
  "success": true,
  "branch": "feature/auth",
  "newCommitsPulled": true,
  "stashUsed": true,
  "mergeConflictsResolved": true,
  "resolvedFiles": ["src/config.ts", "src/utils/helpers.ts"]
}
```

## Implementation Notes

### Git Commands
- Use `git status --porcelain` to check working tree state
- Use `git add -A` to stage all changes (tracked + untracked)
- Use `git stash push -m "promp-pull-autostash"` to stash with a label
- Use `git stash list` to verify stash creation
- Use `git branch --show-current` for current branch name
- Use `git pull --rebase` to fetch and rebase onto remote
- Use `git stash pop` to restore stashed changes
- Use `git status --porcelain` to identify conflicted files (look for "UU" status)
- Use `git log origin/<branch> --not HEAD --oneline` to see incoming commits
- Use `git rebase --continue` after resolving rebase conflicts
- Use `git rebase --abort` if rebase resolution fails
