---
name: code-review-methodology
description: General methodology for conducting effective code reviews.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "code-review-methodology"
---

# Code Review Methodology

This skill defines how to conduct effective code reviews. All domain reviewers reference this methodology.

## When to Use

Use this skill when performing any code review activity. It provides the approach and principles that ensure review quality across all domains.

## Methodology

### Prioritization

Review in this order:

1. **Critical paths first:** Authentication, authorization, data mutations, financial calculations, external integrations
2. **New code:** Entirely new files and functions (higher risk than modifications)
3. **Modified code:** Changes to existing functions
4. **Supporting code:** Configuration, documentation, build files

### Layered Analysis

Read the change top-down:

1. **Entry point:** Understand how the code is invoked (HTTP handler, event handler, CLI command)
2. **Business logic:** Trace the core logic flow and data transformations
3. **Data layer:** Review data access, external calls, and side effects
4. **Tests:** Verify that tests cover the critical paths identified above
5. **Infrastructure:** Review IaC and configuration changes last

Understand the intent before judging the implementation.

### Finding Quality

Every finding must be:

- **Actionable:** Include a specific recommendation. Show a code example of the recommended approach when possible, making sure to use patterns in the codebase. e.g. logger library instead of console.log
- **Justified:** Explain the impact of not addressing the finding.
- **Accurate:** Verify the issue exists by reading the actual code, not assuming from patterns.
- **Scoped:** Reference specific files and line numbers.

"This could be better" is not a finding. "This function catches all exceptions on line 45, which swallows timeout errors -- narrow the catch to DatabaseError" is a finding.

### False Positive Avoidance

Before flagging an issue:

1. **Check the pattern baseline.** If the repo consistently uses this pattern, the new code should follow it -- but don't flag the pattern itself.
2. **Check the requirements context.** If a deviation is documented as intentional, don't flag it.
3. **Check surrounding code.** The changed code may be following the conventions of the file it's in.

### Severity Calibration

- Default to the **lowest appropriate severity**
- Escalate only when impact is **clear and specific**
- When uncertain, classify as **Low** with a note
- Security findings default to **higher** severity than other domains
- Pattern deviations are **Medium** by default
- Requirements mismatches are **High** by default

### Context-Aware Review

When requirements context is available:

1. Read the acceptance criteria before reviewing code
2. For each criterion, verify the code addresses it
3. Flag unaddressed criteria as `requirements-mismatch`
4. If no requirements context is available, review against standards and patterns only

### Scope Discipline

- **Only review what changed.** Existing issues in unchanged files belong in separate tickets.
- **Reference existing code** only for pattern comparison.
- **Do not expand scope** beyond the changeset unless a changed file directly calls into problematic existing code.

### Systematic Checklist Coverage

Domain reviewers must work through their checklist systematically rather than reviewing by impression. Use the three-layer review structure to ensure exhaustive, consistent coverage across every run.

#### Layer 1: Group Comprehension

Before any checklist work, read all files in the file group and build a group comprehension map:

- What is each file's role? (handler, service, validation, test, config)
- What is the data flow between files? (handler calls service, service calls repository)
- Where are the entry points? Where do external calls go out?
- Where does error handling happen relative to where errors originate?
- What shared types, interfaces, or contracts connect the files?
- Map the call chain: which functions call which, across file boundaries

Write a brief Group Context note (a few lines per file, plus cross-file relationships). This mental model stays active throughout the review.

#### Layer 2: Section Inventory

For each file, enumerate every logical section with line ranges:

- Functions, methods, classes, event handlers, route definitions, config blocks
- Note the purpose of each section in one line
- Note which sections call or are called by other sections in the group

Example: `processPayment() [lines 15-45] -- calls validateAmount() from validation.ts, calls paymentService.charge()`

Every section must be explicitly listed. This is the review surface. Nothing can be skipped because nothing is hidden.

##### Section Classification for Domain-Specific Reviewers

When a domain reviewer's checklist targets a specific mechanism, classify each section to scope checklist application:

1. **Self-identification test:** Does your checklist apply to ALL code in a file group, or only to sections that directly exercise a specific mechanism? If your checklist has both all-code items and mechanism-specific items, apply classification only to the mechanism-specific items.

2. **Three classification classes:**
   - `[CALL SITE]` — sections that directly invoke the domain mechanism
   - `[DOMAIN REFERENCE]` — sections that hold or import the domain client/library without invoking it
   - `[UNRELATED]` — sections with no connection to the domain

3. **Reasoning test for ambiguous cases:** If the domain client were replaced with a mock, would this section's core logic need to change? Yes → `[CALL SITE]`. No → `[DOMAIN REFERENCE]`.

4. **Thin wrapper clarification:** A method that directly delegates to a domain verb — e.g., forwards to `httpClient.post()` — is a `[CALL SITE]`. A method that calls an abstraction whose name hides the mechanism — e.g., `this.deps.flush()` — is a `[DOMAIN REFERENCE]`.

5. **Constraint:** Only generate TODO checklist items for `[CALL SITE]` sections.

6. **Fallback:** If a file group passes the domain early-exit gate but after classification has zero `[CALL SITE]` sections, write `# No Findings` noting that domain references exist but no direct invocations were found.

7. **How to apply:** Consult the **Call-Site Patterns** section of your agent definition for the specific invocation patterns for your domain.

#### Layer 3: Review TODO with Call-Chain Verification

Cross applicable checklist items with sections. Determine which Universal checklist sections apply to these files and which Technology-Specific sections apply from the detected tech stack. For each section, list every applicable checklist item as a TODO entry.

Work through each TODO item in order. For each checklist item on each section:

1. Read the specific code section
2. Evaluate the checklist item
3. **Call-chain verification gate**: Before producing a finding, check whether the concern is addressed elsewhere in the group's call chain:
   - Error handling missing here? Check if the caller handles it.
   - Input not validated here? Check if validation happens at the boundary.
   - Resource not cleaned up here? Check if cleanup is in the caller's finally block.
   - If the concern IS handled at another level in the group, it is **not** a finding.
   - If the concern is NOT handled anywhere in the group's call chain, it IS a finding.
4. Either produce a finding (with full call-chain context in the description) or mark "no issue"
5. Move to next item

The call-chain gate prevents false positives from section-level tunnel vision. The systematic TODO prevents missed issues from attention gaps in large files. Together they ensure comprehensive, consistent, accurate coverage.

## Anti-Patterns

| Anti-Pattern                                         | Correct Approach                                           |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Flagging established repo patterns as issues         | Check the pattern baseline first                           |
| "This could be better" without a recommendation      | Provide specific, actionable advice                        |
| Reviewing unchanged files                            | Limit scope to the changeset                               |
| Enforcing personal preferences                       | Only flag standards, patterns, and requirements violations |
| Over-escalating severity                             | Default to lowest appropriate severity                     |
| Flagging intentional deviations documented in the PR | Read the requirements context first                        |
