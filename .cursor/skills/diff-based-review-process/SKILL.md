---
name: diff-based-review-process
description: Orchestration process for comprehensive diff-based code review across all 12 domains with pattern analysis, requirements verification, and full-repo finding verification. Use when reviewing committed, local, or staged changes against a git ref and full domain coverage is required.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "diff-based-review-process"
---

# Diff-Based Review Process

Process skill for the code-review-coordinator. Defines the full diff-based code review flow.

**Execution mode:** The coordinator's `orchestration` parameter controls how tasks are dispatched. `orchestration=native` (default): coordinator manages batching natively using foreground Task calls in parallel — no shell scripts required. `orchestration=rolling`: coordinator uses the scripted rolling window (poll.sh/pop.sh) with background Task spawning — requires MAX mode. `orchestration=cli`: coordinator fans out Phase 2b/3b agents via `cursor-agent-fanout.sh` using the Cursor CLI — requires Cursor CLI (`cursor-agent`) installed. Phase Reset for `cli` mode: clear `done.txt` only (same as `native`).

## Directory Structure

Create these directories under `{outputDir}/.working/`:
- `orchestration/` (coordinator's scope directory)
- `patterns/`

## TODO Template

Generate this TODO list and work through it in order:

1. [COMPILE]   Initialize directories and write Phase 1 queue
   READS: none
   WRITES: orchestration/ directory, orchestration/queue.txt

2. [DELEGATE]  Launch Phase 1 agents — change-analyzer, pattern-analyzer, context-gatherer, security-tools-scanner
   READS: none
   WRITES: none (agents write to their output paths directly)

3. [COMPILE]   Build routing matrix
   READS: .working/change-report.md, .working/acceptance-criteria.md
   WRITES: .working/routing-matrix.md

4. [COMPILE]   Python loop — generate domain task-specs via generate-domain-task-specs.py. If ACs present: [DELEGATE] requirements-verification-orchestrator (mode=plan)
   READS: {outputDir}/.working/file-groups.json (domainGroups keys)
   COMMAND: for each domain in file-groups.json domainGroups:
     python3 {packageRoot}/skills/task-spec-generation/scripts/generate-domain-task-specs.py {domain} {outputDir} {outputDir}/.working/domain-{domain}/ {outputDir}/.working/orchestration/ domain-{domain}- {severityThreshold}

5. [COMPILE]   Consolidate planner manifests, apply Phase Reset #1, write Phase 2b queue
   READS: .working/domain-{name}/task-manifest.txt (per domain), .working/requirements/task-manifest.txt (if ACs)
   WRITES: orchestration/queue.txt

6. [DELEGATE]  Launch Phase 2b leaf agents via rolling window — reviewers, synthesizers, requirements-verifiers
   READS: none (coordinator reads task-spec files at spawn time and injects inline)
   WRITES: none (agents write to their output paths directly)

7. [COMPILE]   If ACs ran: call requirements-verification-orchestrator (mode=compile). Apply Phase Reset #2 (always — not conditional on ACs).
   READS: none (RVO reads verdict files from its scopeDir directly)
   WRITES: .working/requirements/requirements-verification.md (only if ACs ran)

8. [COMPILE]   Generate finding verification task-specs via generate-finding-task-specs.py
   READS: {outputDir}/.working/domain-*.json
   WRITES: {outputDir}/.working/verification/ (task-specs + task-manifest.txt)
   COMMAND: python3 {packageRoot}/skills/task-spec-generation/scripts/generate-finding-task-specs.py {outputDir} {outputDir}/.working/verification/ {outputDir}/.working/orchestration/ verify-

9. [COMPILE]   Write Phase 3b queue from verification task-manifest.txt
   READS: .working/verification/task-manifest.txt
   WRITES: orchestration/queue.txt

10. [DELEGATE]  Launch Phase 3b finding-verifiers via rolling window
    READS: none (coordinator reads task-spec files at spawn time and injects inline)
    WRITES: none (agents write to their output paths directly)

11. [COMPILE]  Run compile-verdicts.py to produce verified-findings.json
    READS: {outputDir}/.working/verification/task-*-verdict.json
    WRITES: {outputDir}/.working/verification/verified-findings.json
    COMMAND: python3 {packageRoot}/skills/task-spec-generation/scripts/compile-verdicts.py {outputDir}/.working/verification/ {outputDir}/.working/verification/verified-findings.json

12. [COMPILE]  Compile report from output files
    READS: .working/verification/verified-findings.json,
           .working/requirements/requirements-verification.md (only if ACs ran — file may not exist),
           .working/change-report.md, .working/change-summary.md,
           .working/pattern-baseline.md, .working/requirements-context.md,
           .working/tool-findings.md
    WRITES: {outputDir}/report.md

13. [COMPILE]  Report results to user
    READS: none
    WRITES: none

## Phase 1 Queue Entries

Write to `{outputDir}/.working/orchestration/queue.txt` before the rolling window loop:

```
task-01::change-analyzer:task-01.txt
task-02::pattern-analyzer:task-02.txt
task-03::context-gatherer:task-03.txt
task-04::security-tools-scanner:task-04.txt
```

Pass to each agent at spawn time:
- `task-01` (change-analyzer): targetPath, diffRef, mode, outputDir, validateScriptsDir. Writes `change-report.md`, `change-summary.md`, and `file-groups.json` to `.working/`. outputPath=`{scopeDir}/task-01.md`, doneSignal=`{scopeDir}/task-01.txt`. Pass `validateScriptsDir: {packageRoot}/skills/validate-outputs/scripts`
- `task-02` (pattern-analyzer): targetPath, changed file list, outputDir. Writes `pattern-baseline.md` and domain slices to `.working/patterns/`. outputPath=`{scopeDir}/task-02.md`, doneSignal=`{scopeDir}/task-02.txt`
- `task-03` (context-gatherer): branch name, commit messages, MR metadata (if available), specPath, context, outputDir. Writes `requirements-context.md` and `acceptance-criteria.md` to `.working/`. outputPath=`{scopeDir}/task-03.md`, doneSignal=`{scopeDir}/task-03.txt`
- `task-04` (security-tools-scanner): changed file list, outputDir. Writes `tool-findings.md` to `.working/`. outputPath=`{scopeDir}/task-04.md`, doneSignal=`{scopeDir}/task-04.txt`

Each agent must create its doneSignal file as its final act to signal completion.

Poll interval: 10 seconds.

## Phase Boundary Compile Step (Between Phase 1 and Phase 2a)

After Phase 1 drains (RUNNING=0 QUEUE=0):

1. Read `.working/change-report.md` (written by change-analyzer)
2. Build routing matrix: map each file group to relevant domains per domain relevance hints
3. Filter to the `domains` parameter (all 12 by default)
4. Adjust domain relevance per file group based on tech stack profile
5. Write routing matrix to `.working/routing-matrix.md`
6. Check `.working/acceptance-criteria.md` — determine if structured ACs exist
7. Create scoped directories for each domain planner and verification/requirements:
   ```
   mkdir -p {outputDir}/.working/domain-{domain-kebab}/
   mkdir -p {outputDir}/.working/requirements/   (if ACs exist)
   mkdir -p {outputDir}/.working/verification/
   ```

## Phase 2a: Domain Task-Spec Generation

Generate domain task-specs via Python script (reads file-groups.json, writes task-specs and task-manifest per domain):

```bash
for domain in $(jq -r '.domainGroups | keys[]' {outputDir}/.working/file-groups.json); do
  python3 {packageRoot}/skills/task-spec-generation/scripts/generate-domain-task-specs.py "$domain" {outputDir} \
    {outputDir}/.working/domain-$domain/ {outputDir}/.working/orchestration/ \
    domain-$domain- {severityThreshold}
done
```

If structured ACs exist, spawn `requirements-verification-orchestrator` foreground:

```
Task(
  subagent_type: "requirements-verification-orchestrator",
  run_in_background: false,
  readonly: false,
  prompt: |
    mode: plan
    scopeDir: {outputDir}/.working/requirements/
    taskPrefix: req-
    coordinatorScopeDir: {outputDir}/.working/orchestration/
    outputDir: {outputDir}
)
```

Run the domain script loop, then (if ACs) RVO. Wait for both before the manifest compile step.

## Phase 2a Compile: Manifest Consolidation

After all planners return:

1. Apply Phase Reset #1 (see coordinator Phase Reset section — clears both files when `orchestration=rolling`; clears `done.txt` only when `orchestration=native` or `orchestration=cli`)
2. Read `{outputDir}/.working/domain-{domain-kebab}/task-manifest.txt` for each domain planner
3. If ACs ran, read `{outputDir}/.working/requirements/task-manifest.txt`
4. Concatenate all manifest lines into `{outputDir}/.working/orchestration/queue.txt`

Example Phase 2b queue after concatenation:

```
domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt
domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt
domain-logic-synth:domain-logic-01,domain-logic-02:domain-synthesizer:domain-logic-synth.txt
domain-security-01::security-reviewer:domain-security-01.txt
domain-security-synth:domain-security-01:domain-synthesizer:domain-security-synth.txt
req-ac-01::requirements-verifier:req-ac-01.txt
req-ac-02::requirements-verifier:req-ac-02.txt
```

## Phase 2b: Leaf Agent Rolling Window

Execute rolling window over the Phase 2b queue. For each task popped:

1. Determine planner scopeDir from task name prefix (`domain-{name}-*` → `.working/domain-{name}/task-specs/`, `req-*` → `.working/requirements/task-specs/`)
2. Read `{planner-scopeDir}/task-specs/{task-name}.md`
3. Spawn leaf agent with task-spec content as the full prompt (readonly: false)

Poll interval: 10 seconds.

## Phase 2b Compile Step

After Phase 2b rolling window drains:

1. If ACs ran: call `requirements-verification-orchestrator` foreground (mode=compile, scopeDir=`.working/requirements/`). This writes `.working/requirements/requirements-verification.md`.
2. Apply Phase Reset #2 (see coordinator Phase Reset section — mode-conditional).

## Phase 3a: Finding Verification Task-Spec Generation

Generate finding verification task-specs via Python script:

```bash
python3 {packageRoot}/skills/task-spec-generation/scripts/generate-finding-task-specs.py {outputDir} \
  {outputDir}/.working/verification/ {outputDir}/.working/orchestration/ verify-
```

- READS: `{outputDir}/.working/domain-*.json`
- WRITES: `{outputDir}/.working/verification/` (task-specs + task-manifest.txt)

After the script returns, execute TODO Step 9 `[COMPILE]`: read `{outputDir}/.working/verification/task-manifest.txt` and write it as the Phase 3b queue (`orchestration/queue.txt`). (Phase Reset #2 was already applied above — no additional reset needed.)

Example Phase 3b queue:

```
verify-01::finding-verifier:verify-01.txt
verify-02::finding-verifier:verify-02.txt
verify-03::finding-verifier:verify-03.txt
```

## Phase 3b: Finding-Verifier Rolling Window

Execute rolling window over the Phase 3b queue. For each task popped:

1. Read `{outputDir}/.working/verification/task-specs/{task-name}.md`
2. Spawn finding-verifier with task-spec content as the full prompt (readonly: false)

Poll interval: 10 seconds.

## Phase 3 Compile Step

After Phase 3b drains, run compile-verdicts.py via Shell tool:

```
python3 {packageRoot}/skills/task-spec-generation/scripts/compile-verdicts.py {outputDir}/.working/verification/ {outputDir}/.working/verification/verified-findings.json
```

- READS: `{outputDir}/.working/verification/task-*-verdict.json`
- WRITES: `{outputDir}/.working/verification/verified-findings.json`

## Report Compilation

Invoke the `report-compilation` skill (read `skills/report-compilation/SKILL.md`):

```bash
python3 {packageRoot}/skills/report-compilation/scripts/report-compiler.py {outputDir}
```

The script reads `verified-findings.json`, `change-summary.md`, and `acceptance-criteria.md` (optional) and writes `{outputDir}/report.md` with full detail for every verified finding — no truncation, no summarization.
