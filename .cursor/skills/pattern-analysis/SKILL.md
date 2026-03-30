---
name: pattern-analysis
description: Methodology for extracting and cataloging established repo patterns.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "pattern-analysis"
---

# Pattern Analysis

This skill defines how to extract and catalog established conventions and patterns from a codebase. The pattern-analyzer agent references this methodology.

## When to Use

Use this skill when scanning a codebase to establish a pattern baseline before a code review. The baseline enables reviewers to distinguish intentional design decisions from accidental inconsistencies.

## Methodology

### Sampling Strategy

Do not read every file. Use targeted sampling:

1. **Priority 1 -- Same location:** 3-5 files in the same package/directory as the changed files
2. **Priority 2 -- Adjacent locations:** 2-3 files in neighboring packages/directories
3. **Priority 3 -- Repo-wide:** 1-2 files from other parts of the repo for cross-check

For each domain, select files that are likely to exhibit the pattern:
- Error handling: Service files, handlers, clients
- Security: Middleware files, auth modules, validation code
- Architecture: Entry points, service classes, repository classes
- Quality: Any representative files for naming and organization
- Testing: Test files corresponding to the changed code's tests
- Performance: Data access code, external call code, hot-path code
- Observability: Files with logging, metrics, or tracing code
- API design: Route definitions, controllers, request/response models

### Evidence-Based Patterns

Every cataloged pattern must include evidence:

| Evidence Count | Classification |
|---------------|---------------|
| 3+ files | **Established** -- consistent pattern across multiple files |
| 2 files | **Emerging** -- pattern present but limited evidence |
| 1 file | **Isolated** -- single occurrence, not a pattern |
| Conflicting | **Mixed** -- multiple patterns in use |

Only **Established** patterns should be used to flag deviations. **Emerging** patterns can be noted but should not generate findings. **Isolated** patterns are informational only.

### Domain Extraction Guide

For each domain, use these search strategies:

**Error Handling:**
- Grep for `class.*Error`, `extends Error`, `throw new`, `catch`, `Result<`, `.err(`
- Read 3-5 error handling blocks to identify the dominant pattern
- Note: custom error classes vs generic errors, throw vs return

**Security:**
- Grep for `auth`, `middleware`, `validate`, `sanitize`, `secret`, `encrypt`
- Read auth middleware and validation code
- Note: where validation happens, what library, how secrets are accessed

**Architecture:**
- Examine the directory structure for layering conventions
- Read imports in handler/controller files to trace the dependency chain
- Note: handler -> service -> repository pattern, DI approach, barrel exports

**Testing:**
- Read 2-3 test files to identify framework, mocking style, and naming
- Grep for `mock`, `jest.mock`, `patch`, `fixture`, `factory`
- Note: test file location, naming convention, assertion style

**Observability:**
- Grep for `logger`, `log.`, `metric`, `span`, `trace`, `correlationId`
- Read logger initialization and usage patterns
- Note: library, format (structured vs free-text), correlation approach

### Conflict Resolution

When the repo uses conflicting patterns for the same concern:

1. Count files using each pattern
2. Check recency: `git log --format=%aI -1 {file}` for each file
3. Document both patterns with file references
4. Designate the pattern with more files AND more recent usage as the **majority**
5. Note the minority pattern for awareness

### Recency Weighting

More recently modified files carry more weight:
- Files modified in the last 30 days: highest weight
- Files modified in the last 90 days: medium weight
- Files not modified in 90+ days: lowest weight

If a newer pattern is emerging (2+ recent files) while an older pattern exists in many older files, note both and flag the transition.

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Reading every file in the repo | Sample 3-5 files per domain |
| Cataloging single-occurrence patterns as established | Require 2+ file references |
| Ignoring conflicting patterns | Document both and note the majority |
| Treating old patterns equally with new ones | Weight by recency |
| Making quality judgments about patterns | Just catalog what exists, don't judge |
