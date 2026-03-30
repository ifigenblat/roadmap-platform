---
name: security-review-process
description: Orchestration process for security-focused code review using the domain-review-orchestrator with tool finding reconciliation. Use when a security-only review is required — runs change-analyzer, security-tools-scanner, and domain-review-orchestrator for the security domain only, then finding verification.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "security-review-process"
---

# Security Review Process

Process skill for the code-review-coordinator. Defines the security-only review flow.

**Execution mode:** The coordinator's `orchestration` parameter controls how tasks are dispatched. `orchestration=native` (default): coordinator manages batching natively using foreground Task calls in parallel — no shell scripts required. `orchestration=rolling`: coordinator uses the scripted rolling window (poll.sh/pop.sh) with background Task spawning — requires MAX mode. `orchestration=cli`: coordinator fans out Phase 2b/3b agents via `cursor-agent-fanout.sh` using the Cursor CLI — requires Cursor CLI (`cursor-agent`) installed. Phase Reset for `cli` mode: clear `done.txt` only (same as `native`).

## Directory Structure

Create these directories under `{outputDir}/.working/`:
- `orchestration/` (coordinator's scope directory)

## TODO Template

Generate this TODO list and work through it in order:

1. [COMPILE]   Initialize directories and write Phase 1 queue
   READS: none
   WRITES: orchestration/ directory, orchestration/queue.txt

2. [DELEGATE]  Launch Phase 1 agents — change-analyzer, context-gatherer, security-tools-scanner
   READS: none
   WRITES: none

3. [COMPILE]   Build routing matrix (security domain only)
   READS: .working/change-report.md
   WRITES: .working/routing-matrix.md

4. [COMPILE]   Python loop — generate domain task-specs via generate-domain-task-specs.py
   READS: {outputDir}/.working/file-groups.json (domainGroups keys)
   COMMAND: for each domain in file-groups.json domainGroups:
     python3 {packageRoot}/skills/task-spec-generation/scripts/generate-domain-task-specs.py {domain} {outputDir} {outputDir}/.working/domain-{domain}/ {outputDir}/.working/orchestration/ domain-{domain}- {severityThreshold}

5. [COMPILE]   Consolidate planner manifest, apply Phase Reset #1, write Phase 2b queue
   READS: .working/domain-security/task-manifest.txt
   WRITES: orchestration/queue.txt

6. [DELEGATE]  Launch Phase 2b leaf agents via rolling window — security reviewer(s), synthesizer
   READS: none (coordinator reads task-spec files at spawn time and injects inline)
   WRITES: none (agents write to their output paths directly)

7. [COMPILE]   Apply Phase Reset #2 (see coordinator AGENT.md — mode-conditional)
   READS: none
   WRITES: none (coordinator clears orchestration state per mode)

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

12. [COMPILE]  Compile security report
    READS: .working/verification/verified-findings.json, .working/change-summary.md,
           .working/change-report.md, .working/requirements-context.md,
           .working/tool-findings.md
    WRITES: {outputDir}/report.md

13. [COMPILE]  Report results to user
    READS: none
    WRITES: none

## Phase 1 Queue Entries

Write to `{outputDir}/.working/orchestration/queue.txt` before the rolling window loop. No pattern-analyzer in this flow.

```
task-01::change-analyzer:task-01.txt
task-02::context-gatherer:task-02.txt
task-03::security-tools-scanner:task-03.txt
```

Pass to each agent at spawn time:
- `task-01` (change-analyzer): targetPath, diffRef, mode, outputDir, validateScriptsDir. Writes `change-report.md`, `change-summary.md`, and `file-groups.json` to `.working/`. outputPath=`{scopeDir}/task-01.md`, doneSignal=`{scopeDir}/task-01.txt`. Pass `validateScriptsDir: {packageRoot}/skills/validate-outputs/scripts`
- `task-02` (context-gatherer): branch name, commit messages, MR metadata (if available), context, outputDir. Writes `requirements-context.md` to `.working/`. Note: no specPath and no acceptance-criteria.md in this flow — this flow does not run requirements verification. outputPath=`{scopeDir}/task-02.md`, doneSignal=`{scopeDir}/task-02.txt`
- `task-03` (security-tools-scanner): changed file list, outputDir. Writes `tool-findings.md` to `.working/`. outputPath=`{scopeDir}/task-03.md`, doneSignal=`{scopeDir}/task-03.txt`

Each agent must create its doneSignal file as its final act to signal completion.

Poll interval: 10 seconds.

No requirements verification in this flow.

## Phase Boundary Compile Step (Between Phase 1 and Phase 2a)

After Phase 1 drains:

1. Read `.working/change-report.md`
2. Extract file groups for all changed source files
3. Create scoped directories:
   ```
   mkdir -p {outputDir}/.working/domain-security/
   mkdir -p {outputDir}/.working/verification/
   ```

## Phase 2a: Domain Task-Spec Generation

Generate domain task-specs via Python script (reads file-groups.json, writes task-specs and task-manifest for security domain):

```bash
for domain in $(jq -r '.domainGroups | keys[]' {outputDir}/.working/file-groups.json); do
  python3 {packageRoot}/skills/task-spec-generation/scripts/generate-domain-task-specs.py "$domain" {outputDir} \
    {outputDir}/.working/domain-$domain/ {outputDir}/.working/orchestration/ \
    domain-$domain- {severityThreshold}
done
```

Then proceed to manifest consolidation.

## Phase 2a Compile: Manifest Consolidation

After the planner returns:

1. Apply Phase Reset #1 (see coordinator Phase Reset section — mode-conditional)
2. Read `{outputDir}/.working/domain-security/task-manifest.txt`
3. Write the manifest as `{outputDir}/.working/orchestration/queue.txt`

Example Phase 2b queue for security domain with 2 file groups:

```
domain-security-01::security-reviewer:domain-security-01.txt
domain-security-02::security-reviewer:domain-security-02.txt
domain-security-synth:domain-security-01,domain-security-02:domain-synthesizer:domain-security-synth.txt
```

## Phase 2b: Leaf Agent Rolling Window

Execute rolling window over the Phase 2b queue. For each task popped:

1. Read `{outputDir}/.working/domain-security/task-specs/{task-name}.md`
2. Spawn leaf agent with task-spec content as the full prompt (readonly: false)

Poll interval: 10 seconds.

## Phase 3a: Finding Verification Task-Spec Generation

After Phase 2b drains:

1. Apply Phase Reset #2 (see coordinator Phase Reset section — mode-conditional)
2. Generate finding verification task-specs via Python script:

```bash
python3 {packageRoot}/skills/task-spec-generation/scripts/generate-finding-task-specs.py {outputDir} \
  {outputDir}/.working/verification/ {outputDir}/.working/orchestration/ verify-
```

- READS: `{outputDir}/.working/domain-*.json`
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
