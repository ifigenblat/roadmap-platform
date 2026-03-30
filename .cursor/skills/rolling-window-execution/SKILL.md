---
name: rolling-window-execution
description: Rolling-window orchestration layer for orchestration=rolling mode. Manages the task queue, tracks running agents, detects completions via done-signal files, and logs timing. Use when the coordinator is running in orchestration=rolling mode and needs to poll for completed agents, pop ready tasks from the dependency queue, and log spawns before issuing background Task calls.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "rolling-window-execution"
---

# Rolling Window Execution

Scripted rolling-window layer for `orchestration=rolling` mode. Provides queue management utilities (`pop.sh`), completion detection (`poll.sh`), and spawn logging (`spawn-log.sh`) that the coordinator uses to maintain a bounded window of concurrently running background Task calls.

## When to Use

Only when `orchestration=rolling` is active (requires Cursor MAX mode for background Task calls). The coordinator uses these scripts inside its rolling-window control loop in place of native batching or CLI fan-out.

## Control Loop Pattern

The coordinator's rolling-window loop follows this pattern:

```
1. spawn-log.sh  — log task names + timestamps before spawning
2. Task(run_in_background: true) x N  — launch batch of agents
3. [wait for at least one agent to complete]
4. poll.sh  — detect done agents, update running.txt + done.txt, report freed slots
5. pop.sh N  — pop N ready tasks from queue (respecting dependencies)
6. [repeat from 1 with newly popped tasks]
```

## Scripts

### `poll.sh`

Detects completed tasks by checking for done-signal files. Updates `running.txt` and `done.txt`. Reports freed slot count.

```
Usage: bash poll.sh <scopeDir>

Arguments:
  scopeDir   coordinator scope directory (e.g. {outputDir}/.working/orchestration/)

Files read:
  {scopeDir}/running.txt   — currently running task names (one per line)
  {scopeDir}/queue.txt     — all queued tasks (for count reporting)
  {scopeDir}/{task}.txt    — done-signal files written by completed agents

Files written:
  {scopeDir}/running.txt   — removes completed tasks
  {scopeDir}/done.txt      — appends completed task names
  {scopeDir}/timing.log    — appends [DONE] timestamps

Stdout:
  FREED: {task-name}       — one line per newly completed task
  RUNNING: N QUEUE: M FREED: K  — final summary line

Exit code:
  0  always
```

### `pop.sh`

Scans the queue for tasks whose dependencies are all satisfied (present in `done.txt`). Pops up to N ready tasks, removing them from the queue. Blocked tasks remain.

```
Usage: bash pop.sh <N> <scopeDir>

Arguments:
  N          maximum number of tasks to pop
  scopeDir   coordinator scope directory

Queue format (queue.txt):
  task-name:deps:agent-type:result-file
  deps is comma-separated list of task names (empty = no dependencies)

Stdout:
  SPAWN_NEXT: {task-name} {agent-type}   — one line per popped task

Files written:
  {scopeDir}/queue.txt   — rewritten with remaining (non-popped) tasks

Exit code:
  0  always
```

### `spawn-log.sh`

Logs spawn events with timestamps and appends task names to `running.txt`. Call immediately before issuing the corresponding Task calls so timing is accurate.

```
Usage: bash spawn-log.sh <scopeDir> <task1> [task2] ...

Arguments:
  scopeDir   coordinator scope directory
  task1...   task names being spawned

Files written:
  {scopeDir}/running.txt   — appends each task name
  {scopeDir}/timing.log    — appends [SPAWN] timestamp per task

Exit code:
  0  always
```

## Queue File Format

```
task-name:dep1,dep2:agent-type:result-file
```

| Field | Description |
|-------|-------------|
| `task-name` | Unique task identifier (e.g. `domain-security-01`) |
| `deps` | Comma-separated dependencies (empty string if none) |
| `agent-type` | Cursor subagent type (e.g. `generalPurpose`) |
| `result-file` | Expected output file path (used for dependency tracking) |

## Done-Signal Convention

An agent signals completion by writing a file at `{scopeDir}/{task-name}.txt`. The coordinator (or `cursor-agent-fanout.sh`) detects this file and marks the task done.

## Test Coverage

`poll.sh`, `pop.sh`, and `spawn-log.sh` are exercised end-to-end by the `test-fanout.sh` bash harness in `skills/cli-fanout-execution/scripts/test-fanout.sh`. There are no separate pytest tests for these scripts because their correctness is validated through the fanout integration scenarios. Standalone unit tests would be appropriate additions for edge cases (empty queue, malformed entries, concurrent writes).
