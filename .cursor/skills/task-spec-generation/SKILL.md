---
name: task-spec-generation
description: Generates and processes task-spec files for domain reviewer agents, finding verifier agents, and domain synthesizer agents. Handles domain task-spec generation from file-groups.json, finding task-spec generation from domain output JSON, verdict compilation into verified-findings.json, and findings merging across reviewer tasks. Use when the coordinator or domain-review-orchestrator needs to produce task-spec files before spawning agents, or when the domain-synthesizer needs to merge reviewer outputs, or when finding verdicts need to be compiled.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "task-spec-generation"
---

# Task-Spec Generation

Scripts that generate structured task-spec files for spawned agents, merge reviewer findings across tasks, and compile verified verdicts. These are the coordinator's primary tools for building the per-agent work packages that define scope, context, and output paths.

## When to Use

- Before spawning domain reviewer agents: run `generate-domain-task-specs.py`
- Before spawning finding verifier agents: run `generate-finding-task-specs.py`
- After finding verifiers complete: run `compile-verdicts.py` to produce `verified-findings.json`
- After domain reviewers complete (domain-synthesizer): run `merge-findings.py` to merge per-task outputs

## Scripts

### `generate-domain-task-specs.py`

Reads `file-groups.json` and generates per-task task-spec files for domain reviewer agents and the domain synthesizer agent. Also writes `task-manifest.txt` listing all generated tasks.

```
Usage: python3 generate-domain-task-specs.py \
  <domain> <outputDir> <scopeDir> <coordinatorScopeDir> <taskPrefix> <severityThreshold>

Arguments:
  domain              domain name (e.g. security, logic, performance)
  outputDir           review output root
  scopeDir            domain working directory (e.g. {outputDir}/.working/domain-security/)
  coordinatorScopeDir orchestration directory (e.g. {outputDir}/.working/orchestration/)
  taskPrefix          prefix for task names (e.g. domain-security-)
  severityThreshold   minimum severity to report (e.g. medium)

Reads:
  {outputDir}/.working/file-groups.json       — domain group assignments
  {outputDir}/.working/change-summary.md      — diff context (required)
  {outputDir}/.working/patterns/{domain}.md   — domain patterns (optional)
  {outputDir}/.working/acceptance-criteria.md — ACs (optional)
  {outputDir}/.working/tool-findings.md       — security tool output (security domain only)

Writes:
  {scopeDir}/task-specs/{taskPrefix}{n:02d}.md     — reviewer task-spec per file group
  {scopeDir}/task-specs/{taskPrefix}synth.md       — synthesizer task-spec
  {scopeDir}/task-manifest.txt                     — list of generated task names

Injected into each task-spec:
  validateScriptsDir: {packageRoot}/skills/validate-outputs/scripts

Task-spec outputPath format:
  {scopeDir}/task-{n:02d}-findings.json
```

### `generate-finding-task-specs.py`

Reads all domain output JSON files from `.working/` and generates per-finding task-spec files for finding verifier agents. Also writes `task-manifest.txt`.

```
Usage: python3 generate-finding-task-specs.py \
  <outputDir> <scopeDir> <coordinatorScopeDir> <taskPrefix>

Arguments:
  outputDir           review output root
  scopeDir            verification working directory (e.g. {outputDir}/.working/verification/)
  coordinatorScopeDir orchestration directory (e.g. {outputDir}/.working/orchestration/)
  taskPrefix          prefix for task names (e.g. verify-)

Reads:
  {outputDir}/.working/domain-*/domain-*.json   — primary: per-domain subdirectories
  {outputDir}/.working/domain-*.json            — flat fallback
  {outputDir}/.working/*/domain-*.json          — component layout fallback

Writes:
  {scopeDir}/task-specs/{taskPrefix}{n:02d}.md   — one task-spec per finding
  {scopeDir}/task-manifest.txt                   — list of generated task names

Injected into each task-spec:
  validateScriptsDir: {packageRoot}/skills/validate-outputs/scripts
```

### `compile-verdicts.py`

Reads `task-*-verdict.json` files from a scope directory and compiles them into a single `verified-findings.json` output. Filters to verified verdicts only.

```
Usage: python3 compile-verdicts.py <scopeDir> <outputFile>

Arguments:
  scopeDir    directory containing task-*-verdict.json files
  outputFile  path to write verified-findings.json

Reads:
  {scopeDir}/task-*-verdict.json   — verdict JSON files from finding-verifier agents

Writes:
  outputFile (verified-findings.json) with schema:
    {
      "verifiedFindings": [{verdict, severity, type, domain, file, lines, title, description,
                            impact, recommendation, evidence, findingMarkdown,
                            optionally: threatModel, source, reference, dismissalReason}],
      "dismissedCount": N,
      "totalProcessed": N
    }

Exit codes:
  0  success (writes empty findings array if no verified verdicts)
  1  error reading input files
```

### `merge-findings.py`

Reads per-task `task-{n}-findings.json` files from a domain scope directory and merges them into a single `merged-{domain}.json` output. Tags each finding with its source task ID.

```
Usage: python3 merge-findings.py <scopeDir> <outputFile>

Arguments:
  scopeDir    domain working directory containing task-*-findings.json
  outputFile  path to write merged-{domain}.json

Reads:
  {scopeDir}/task-*-findings.json   — JSON findings from domain reviewer agents

Writes:
  outputFile (merged-{domain}.json) with schema:
    {
      "mergedFindings": [{...finding fields..., "sourceTaskId": "task-01"}],
      "notAssessed": ["task-N", ...],
      "clean": ["task-M", ...]
    }

Exit codes:
  0  success
  1  error reading input files
```
