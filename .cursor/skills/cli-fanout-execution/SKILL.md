---
name: cli-fanout-execution
description: Fan-out orchestration layer that dispatches leaf review agents as parallel Cursor CLI sessions. Handles the control loop, queue management, retry logic, adaptive concurrency reduction, and completion detection for orchestration=cli mode. Use when the coordinator is running in orchestration=cli mode and needs to launch Phase 2b or Phase 3b agents in parallel via the Cursor CLI.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "cli-fanout-execution"
---

# CLI Fan-out Execution

Scripted fan-out layer for `orchestration=cli` mode. Reads a task queue, spawns agents as parallel CLI processes, tracks completion via done-signal files, retries failures with backoff, and reduces concurrency automatically when spawn failures are detected.

## When to Use

Only when `orchestration=cli` is active and `check-cli.sh` has already confirmed the CLI is available. This skill's scripts must not be called in `native` or `rolling` modes.

## Prerequisites

- `check-cli.sh` has run successfully and written `cli-cmd.txt` to the orchestration directory
- The task queue (`queue.txt`) has been written by `generate-domain-task-specs.py` or `generate-finding-task-specs.py`
- Task-spec files exist at the paths the queue references

## Invocation

```bash
bash {packageRoot}/skills/cli-fanout-execution/scripts/cursor-agent-fanout.sh \
  {outputDir}/.working/orchestration/ \
  {outputDir} \
  12 \
  {packageRoot}
```

The script runs until all queued tasks are complete or a deadlock is detected.

## Scripts

### `cursor-agent-fanout.sh`

Fan-out controller. Reads queue, spawns agents as background CLI processes, monitors done-signal files, retries on failure, and reduces `MAX_PARALLEL` adaptively on consecutive spawn failures.

```
Usage: cursor-agent-fanout.sh <scopeDir> <outputDir> <maxParallel> <packageRoot>

Arguments:
  scopeDir     coordinator scope directory (e.g. {outputDir}/.working/orchestration/)
  outputDir    review output root
  maxParallel  maximum concurrent CLI sessions (default: 12)
  packageRoot  root of the code-review package

Environment (optional):
  FANOUT_POLL_INTERVAL   seconds between control loop polls (default: 5)
  FANOUT_BACKOFF_INITIAL seconds to wait before retrying a failed task (default: 5)
  FANOUT_BACKOFF_RATE_LIMIT  seconds to wait after a 429 / rate-limit error (default: 60)

Files read:
  {scopeDir}/cli-cmd.txt   — CLI binary name (written by check-cli.sh)
  {scopeDir}/queue.txt     — tasks to process (format: task-name:deps:agent-type:result-file)

Files written:
  {scopeDir}/done.txt      — one task name per line as they complete
  {scopeDir}/.fanout-running/{pid} — per-process tracking (name:agent:retry)
  {outputDir}/.working/orchestration/timing.log — spawn/done timestamps

Exit codes:
  0  all tasks completed
  1  deadlock detected (queue non-empty, no running tasks, no progress)
```

**Adaptive concurrency:** When a task exhausts all retries (`EXHAUSTED` event), a `CONSECUTIVE_SPAWN_FAILURES` counter increments. When the counter reaches 3, `MAX_PARALLEL` is halved (floor division, minimum 1), a `[CONCURRENCY-REDUCED]` message is logged, and the counter resets to 0.

**Retry logic:** Each task is retried up to 3 times (configurable via `MAX_RETRIES`). Rate-limit responses (HTTP 429) trigger a longer backoff.

**Completion detection:** An agent signals completion by writing `{scopeDir}/{task-name}.txt`. The control loop detects this file and marks the task done.

### `mock-cursor-agent.sh`

Test stub that simulates a Cursor CLI agent process for use in integration tests. Writes the done-signal file after a configurable delay. Not for production use.

```
Usage: mock-cursor-agent.sh [options] -- <prompt>

Environment:
  MOCK_DELAY_MS   milliseconds to sleep before writing done signal (default: 100)
```

### `test-fanout.sh`

Integration test harness for `check-cli.sh` and `cursor-agent-fanout.sh`. Runs multiple scenarios and reports PASS/FAIL per test. Exit 0 if all pass, 1 if any fail.

```
Run from: packages/code-review/skills/cli-fanout-execution/scripts/
Usage: bash test-fanout.sh
```
