---
name: quick-review-process
description: Orchestration process for lightweight code review covering quality and observability domains only, without pattern analysis or finding verification. Use when fast feedback is needed on small changes — bypasses the domain-review-orchestrator tier and spawns reviewers directly for lower latency.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "quick-review-process"
---

# Quick Review Process

Process skill for the code-review-coordinator. Defines the minimal quick review flow.

**Execution mode:** The coordinator's `orchestration` parameter controls how tasks are dispatched. `orchestration=native` (default): coordinator manages batching natively using foreground Task calls in parallel — no shell scripts required. `orchestration=rolling`: coordinator uses the scripted rolling window (poll.sh/pop.sh) with background Task spawning — requires MAX mode. `orchestration=cli`: coordinator fans out Phase 2b/3b agents via `cursor-agent-fanout.sh` using the Cursor CLI — requires Cursor CLI (`cursor-agent`) installed. Phase Reset for `cli` mode: clear `done.txt` only (same as `native`).

## Directory Structure

Create these directories under `{outputDir}/.working/`:
- `orchestration/` (coordinator's scope directory)

## TODO Template

Generate this TODO list and work through it in order:

1. [COMPILE]   Initialize directories and write Phase 1 queue
   READS: none
   WRITES: orchestration/ directory, orchestration/queue.txt

2. [DELEGATE]  Launch change-analyzer, context-gatherer
   READS: none
   WRITES: none

3. [COMPILE]   Phase Reset + write Phase 2 queue from change report
   READS: .working/change-report.md
   WRITES: orchestration/done.txt (cleared), orchestration/queue.txt

4. [DELEGATE]  Launch quality-maintainability-reviewer, observability-reviewer
   READS: none
   WRITES: none

5. [COMPILE]   Synthesize verified-findings.json and compile report
   READS: {outputDir}/.working/domain-quality/group-findings.json,
          {outputDir}/.working/domain-observability/group-findings.json,
          .working/change-summary.md, .working/acceptance-criteria.md
   WRITES: {outputDir}/.working/verification/verified-findings.json,
           {outputDir}/report.md

6. [COMPILE]   Report results to user
   READS: none
   WRITES: none

## Phase 1 Queue Entries

Write to `{outputDir}/.working/orchestration/queue.txt` before the rolling window loop. No pattern-analyzer, no security-tools-scanner.

```
task-01::change-analyzer:task-01.txt
task-02::context-gatherer:task-02.txt
```

Pass to each agent at spawn time:
- `task-01` (change-analyzer): targetPath, diffRef, mode, outputDir, validateScriptsDir. Writes `change-report.md`, `change-summary.md`, and `file-groups.json` to `.working/`. outputPath=`{scopeDir}/task-01.md`, doneSignal=`{scopeDir}/task-01.txt`. Pass `validateScriptsDir: {packageRoot}/skills/validate-outputs/scripts`
- `task-02` (context-gatherer): branch name, commit messages, MR metadata (if available), outputDir. Writes `requirements-context.md` to `.working/`. outputPath=`{scopeDir}/task-02.md`, doneSignal=`{scopeDir}/task-02.txt`

Each agent must create its doneSignal file as its final act to signal completion.

Poll interval: 10 seconds.

No requirements verification. No finding verification phase.

## Phase Boundary Compile Step (Between Phase 1 and Phase 2)

After Phase 1 drains:

1. **Phase Reset:** Clear orchestration state to prevent Phase 1 task IDs from blocking Phase 2 spawns:
   ```bash
   > {outputDir}/.working/orchestration/done.txt
   > {outputDir}/.working/orchestration/running.txt
   ```
   (For `orchestration=native` and `orchestration=cli`, `running.txt` is always empty — clearing it is harmless. For `orchestration=rolling`, both files must be cleared.)
2. Read `.working/change-report.md` for file groups
3. Create scoped directories:
   - `mkdir -p {outputDir}/.working/domain-quality/`
   - `mkdir -p {outputDir}/.working/domain-observability/`
   - `mkdir -p {outputDir}/.working/verification/`
4. Write Phase 2 queue

## Phase 2 Queue Entries

Direct domain reviewer launch — no orchestrator intermediary. Phase Reset has cleared done.txt; no deps needed.

```
task-01::quality-maintainability-reviewer:task-01.txt
task-02::observability-reviewer:task-02.txt
```

Pass to each reviewer at spawn time:
- `quality-maintainability-reviewer`: file groups from change report, outputDir, severity threshold. outputPath=`{outputDir}/.working/domain-quality/group-findings.json`, doneSignal=`{outputDir}/.working/orchestration/task-01.txt`
- `observability-reviewer`: file groups from change report, outputDir, severity threshold. outputPath=`{outputDir}/.working/domain-observability/group-findings.json`, doneSignal=`{outputDir}/.working/orchestration/task-02.txt`

Note: doneSignal paths point to the coordinator's orchestration/ directory, not the domain-scoped directories. The coordinator checks `{coordinatorScopeDir}/{task-name}.txt` which resolves to `.working/orchestration/task-0N.txt`.

Poll interval: 10 seconds.

No Phase 3 finding verification.

## Report Compilation

Quick-review has no Phase 3 finding-verifier step, so `verified-findings.json` must be synthesized directly from the domain reviewer outputs before invoking the report compiler.

### Step 1: Synthesize verified-findings.json

Run via Shell tool. **Before issuing this Shell call, substitute `{outputDir}` with the actual resolved path** (e.g., `.ai/code-review/20260311-1430-main`) — the single-quoted `'EOF'` delimiter prevents shell variable expansion, so the coordinator must perform the substitution in the prompt text it sends to the Shell tool:

```bash
python3 - <<'EOF'
import json, os, sys

output_dir = "{outputDir}"
domain_files = [
    os.path.join(output_dir, ".working", "domain-quality", "group-findings.json"),
    os.path.join(output_dir, ".working", "domain-observability", "group-findings.json"),
]
all_findings = []
for path in domain_files:
    if not os.path.isfile(path):
        continue
    with open(path) as f:
        data = json.load(f)
    for finding in data.get("findings", []):
        entry = dict(finding)
        entry["verdict"] = "verified"
        all_findings.append(entry)

out = {
    "verifiedFindings": all_findings,
    "dismissedCount": 0,
    "totalProcessed": len(all_findings),
}
dest = os.path.join(output_dir, ".working", "verification", "verified-findings.json")
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, "w") as f:
    json.dump(out, f, indent=2)
    f.write("\n")
print(f"Synthesized {len(all_findings)} finding(s) → {dest}")
EOF
```

### Step 2: Compile report

Invoke the `report-compilation` skill (read `skills/report-compilation/SKILL.md`):

```bash
python3 {packageRoot}/skills/report-compilation/scripts/report-compiler.py {outputDir}
```

The script reads `verified-findings.json`, `change-summary.md`, and `acceptance-criteria.md` (optional) and writes `{outputDir}/report.md` with full detail for every verified finding — no truncation, no summarization.
