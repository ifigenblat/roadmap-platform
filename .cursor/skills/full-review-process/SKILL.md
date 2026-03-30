---
name: full-review-process
description: Orchestration process for full codebase review using file-scanner with component segmentation and component-parallel domain orchestration. Use when reviewing an entire codebase or folder without a git diff — segments by component and runs parallel reviews per component across all domains.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "full-review-process"
---

# Full Review Process

Process skill for the code-review-coordinator. Defines the full codebase review flow (no git diff required).

**Execution mode:** The coordinator's `orchestration` parameter controls how tasks are dispatched. `orchestration=native` (default): coordinator manages batching natively using foreground Task calls in parallel — no shell scripts required. `orchestration=rolling`: coordinator uses the scripted rolling window (poll.sh/pop.sh) with background Task spawning — requires MAX mode. `orchestration=cli`: coordinator fans out Phase 2b/3b agents via `cursor-agent-fanout.sh` using the Cursor CLI — requires Cursor CLI (`cursor-agent`) installed. Phase Reset for `cli` mode: clear `done.txt` only (same as `native`).

## Directory Structure

Create these directories under `{outputDir}/.working/`:
- `orchestration/` (coordinator's scope directory)
- `patterns/`
- `components/`

## TODO Template

Generate this TODO list and work through it in order:

1. [COMPILE]   Initialize directories and write Phase 1 queue
   READS: none
   WRITES: orchestration/ directory, orchestration/queue.txt

2. [DELEGATE]  Launch Phase 1 agents — file-scanner, pattern-analyzer, context-gatherer, security-tools-scanner
   READS: none
   WRITES: none

3. [COMPILE]   Read file-scanner output, create component review plan, build routing matrix
   READS: .working/change-report.md, .working/components/*.md, .working/acceptance-criteria.md
   WRITES: .working/routing-matrix.md

4. [DELEGATE]  Run Phase 2a foreground planners — domain-review-orchestrators (mode=plan) per component-domain, and requirements-verification-orchestrator (mode=plan, if ACs present)
   READS: none
   WRITES: none (each planner writes its own task-specs/ and task-manifest.txt to its scopeDir — coordinator MUST NOT write these)

5. [COMPILE]   Consolidate planner manifests, apply Phase Reset #1, write Phase 2b queue
   READS: .working/{component-domain-kebab}/task-manifest.txt (per component-domain), .working/requirements/task-manifest.txt (if ACs)
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

12. [COMPILE]  Merge and compile report from output files
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

Write to `{outputDir}/.working/orchestration/queue.txt` before the rolling window loop. Uses file-scanner instead of change-analyzer.

```
task-01::file-scanner:task-01.txt
task-02::pattern-analyzer:task-02.txt
task-03::context-gatherer:task-03.txt
task-04::security-tools-scanner:task-04.txt
```

Pass to each agent at spawn time:
- `task-01` (file-scanner): targetPath, outputDir. Writes summary to `.working/change-report.md`, overview to `.working/change-summary.md`, and per-component scope reports to `.working/components/{component-name}.md`. outputPath=`{scopeDir}/task-01.md`, doneSignal=`{scopeDir}/task-01.txt`
- `task-02` (pattern-analyzer): targetPath, outputDir. Writes `pattern-baseline.md` and domain slices to `.working/patterns/`. outputPath=`{scopeDir}/task-02.md`, doneSignal=`{scopeDir}/task-02.txt`
- `task-03` (context-gatherer): specPath, context, outputDir. Writes `requirements-context.md` and `acceptance-criteria.md` to `.working/`. outputPath=`{scopeDir}/task-03.md`, doneSignal=`{scopeDir}/task-03.txt`
- `task-04` (security-tools-scanner): full file list, outputDir. Writes `tool-findings.md` to `.working/`. outputPath=`{scopeDir}/task-04.md`, doneSignal=`{scopeDir}/task-04.txt`

Each agent must create its doneSignal file as its final act to signal completion.

Poll interval: 10 seconds.

## Phase Boundary Compile Step (Between Phase 1 and Phase 2a)

After Phase 1 drains:

1. Read `.working/change-report.md` (file-scanner summary) and `.working/components/*.md`
2. Note file count, tech stack, and scope per component
3. Filter to `domains` parameter (all 12 by default)
4. Order components largest-first for parallelism
5. Build routing matrix per component: `Map<component, Map<domain, fileGroup[]>>`
6. Write routing matrix to `.working/routing-matrix.md`
7. Check `.working/acceptance-criteria.md` — determine if structured ACs exist
8. Create scoped directories for each component-domain planner:
   ```
   mkdir -p {outputDir}/.working/{component-domain-kebab}/
   mkdir -p {outputDir}/.working/requirements/   (if ACs exist)
   mkdir -p {outputDir}/.working/verification/
   ```

**Component name sanitization**: Component names from file-scanner may contain spaces, slashes, or special characters. When constructing `taskPrefix` and `scopeDir`, sanitize to kebab-case: replace spaces, slashes, and non-alphanumeric characters with hyphens; lowercase. Example: "API Services" → `api-services`, "auth/core" → `auth-core`.

## Phase 2a: Foreground Planners

For each component-domain combination from the routing matrix, spawn `domain-review-orchestrator` as a **foreground** Task (run_in_background: false, readonly: false):

```
Task(
  subagent_type: "domain-review-orchestrator",
  run_in_background: false,
  readonly: false,
  prompt: |
    domain: {domain}
    scopeDir: {outputDir}/.working/{component-kebab}-{domain-kebab}/
    taskPrefix: {component-kebab}-{domain-kebab}-
    coordinatorScopeDir: {outputDir}/.working/orchestration/
    outputDir: {outputDir}
    severityThreshold: {severityThreshold}

    ## File Groups and Diffs
    {file groups from this component for this domain}
)
```

The `scopeDir` includes both component and domain to prevent write collisions when the same domain applies to multiple components (e.g., `api-security/` and `service-security/` are distinct).

If structured ACs exist, also spawn `requirements-verification-orchestrator` foreground:

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

Launch all planners in parallel (do not wait between spawns). Wait for all to return before the manifest compile step.

## Phase 2a Compile: Manifest Consolidation

After all planners return:

1. Apply Phase Reset #1 (see coordinator Phase Reset section — mode-conditional)
2. Read `{outputDir}/.working/{component-domain-kebab}/task-manifest.txt` for each component-domain planner
3. If ACs ran, read `{outputDir}/.working/requirements/task-manifest.txt`
4. Concatenate all manifest lines into `{outputDir}/.working/orchestration/queue.txt`

## Phase 2b: Leaf Agent Rolling Window

Execute rolling window over the Phase 2b queue. For each task popped:

1. Determine planner scopeDir from task name prefix
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

- READS: `{outputDir}/.working/*/domain-*.json` (component-domain subdirectory layout used by full-review)
- WRITES: `{outputDir}/.working/verification/` (task-specs + task-manifest.txt)

After the script returns, execute TODO Step 9 `[COMPILE]`: read `{outputDir}/.working/verification/task-manifest.txt` and write it as the Phase 3b queue (`orchestration/queue.txt`).

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
