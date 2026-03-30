---
name: coordinator-startup
description: Initialization sequence for the code-review-coordinator. Handles CLI availability check, scope auto-detection, outputDir slug computation, and working directory setup. Use when the coordinator is starting a new review session and needs to establish runtime configuration before any agents are spawned.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "coordinator-startup"
---

# Coordinator Startup

Encapsulates all initialization steps the coordinator must perform before any agents are spawned. Covers CLI probing, scope detection, output directory computation, and working directory creation.

## When to Use

At the start of every coordinator session, before the review process skill runs. All steps in this skill must complete successfully before the coordinator advances to the process phase.

## Steps

### Step 1: Check CLI Availability (orchestration=cli only)

If `orchestration=cli`, probe for the Cursor CLI binary:

```bash
bash {packageRoot}/skills/coordinator-startup/scripts/check-cli.sh {outputDir}
```

- On success: writes `{outputDir}/.working/orchestration/cli-cmd.txt`, prints `CLI_CMD=<name>` to stdout
- On failure: prints `CLI_NOT_FOUND` diagnostic block and exits 1

If `CLI_NOT_FOUND` is returned, inform the user and halt. Do not proceed with `orchestration=cli` — suggest switching to `orchestration=native` (no CLI required).

### Step 2: Scope Auto-Detection

If `diffRef` is not provided, auto-detect scope:

| Condition | Detected Scope |
|-----------|----------------|
| `mode=local` | All uncommitted local changes (`git diff HEAD`) |
| `mode=staged` | Staged changes only (`git diff --cached`) |
| PR/MR link provided | Committed changes on the branch (`git diff main...HEAD`) |
| None of the above | Default to committed changes on current branch |

Record the detected scope and any discovered `prIID` or `diffRef` for use in Step 3.

### Step 3: Compute outputDir

If `outputDir` was not passed as a parameter, compute it:

```bash
python3 {packageRoot}/skills/coordinator-startup/scripts/compute-output-dir.py \
  [--pr-iid <IID>] [--diff-ref <ref>] [--mode <local|staged|committed>]
```

Captures stdout as `outputDir`. The output format is `.ai/code-review/{YYYYMMDD-HHMM}-{ref-slug}`.

Log the computed path to the user before proceeding:

```
Output directory: .ai/code-review/20260311-1430-feature-add-retry
```

### Step 4: Create Working Directories

Create the base working directory structure:

```
{outputDir}/
  .working/
    orchestration/
```

Additional subdirectories (`domain-*/`, `verification/`, `requirements/`) are created by the process skill as needed.

## Scripts

### `check-cli.sh`

```
Usage: bash check-cli.sh <outputDir>

Arguments:
  outputDir   review output root

Outputs:
  stdout:  CLI_CMD=<cursor-agent|agent>   on success
           CLI_NOT_FOUND diagnostic block  on failure
  file:    {outputDir}/.working/orchestration/cli-cmd.txt  (success only)

Exit codes:
  0  CLI found and recorded
  1  CLI not found
```

### `compute-output-dir.py`

```
Usage: python3 compute-output-dir.py [--pr-iid <IID>] [--diff-ref <ref>] [--mode <local|staged|committed>]

Arguments:
  --pr-iid    GitLab merge request IID (integer)
  --diff-ref  git ref or branch name to derive slug from
  --mode      local | staged | committed (defaults to committed)

Outputs:
  stdout:  .ai/code-review/{YYYYMMDD-HHMM}-{ref-slug}

Slug derivation precedence:
  1. --pr-iid  → mr-{IID}
  2. --diff-ref → sanitized ref (lowercase, /._space→hyphens, truncated to 40 chars)
  3. --mode=local → local
  4. --mode=staged → staged
  5. (none)     → main

Sanitization: lowercase, [/._space] → hyphens, collapse consecutive hyphens,
strip leading/trailing hyphens, truncate to 40 chars.
```
