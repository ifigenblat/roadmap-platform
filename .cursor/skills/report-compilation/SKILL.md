---
name: report-compilation
description: Assembles the final report.md from pipeline artifacts using a Python script. Reads verified-findings.json and change-summary.md to produce a complete, fully-detailed report with every verified finding at full fidelity. Use when the coordinator has completed Phase 3 (finding verification) and needs to generate the final output report without LLM summarization.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "report-compilation"
---

# Report Compilation

Assembles `report.md` from pipeline JSON artifacts via a script invocation. All content comes directly from verified findings — no LLM summarization, no omissions.

## When to Use

After `compile-verdicts.py` has produced `{outputDir}/.working/verification/verified-findings.json`. The coordinator delegates report generation to this skill by invoking the script via Shell tool.

## Step 1: Invoke the Report Compiler Script

```bash
python3 {packageRoot}/skills/report-compilation/scripts/report-compiler.py {outputDir}
```

The script reads:
- `{outputDir}/.working/verification/verified-findings.json` — all verified findings with `findingMarkdown` fields
- `{outputDir}/.working/change-summary.md` — scope and project context
- `{outputDir}/.working/acceptance-criteria.md` — optional acceptance criteria appendix

Writes:
- `{outputDir}/report.md` — final report

## Step 2: Log Result to User

Print the script's stdout to the user:
```
Report written to .ai/code-review/{slug}/report.md
Verdict: changes-requested | Findings: 5 | Dismissed: 2
```

## Report Structure

The generated `report.md` contains:

1. **Header** — title, date, verdict, finding counts, total reviewed
2. **Summary table** — counts per severity (critical, high, medium, low)
3. **Findings** — verbatim `findingMarkdown` block for every verified finding, sorted critical→high→medium→low
4. **Change Summary** appendix — full change-summary.md content
5. **Acceptance Criteria** appendix — full acceptance-criteria.md content (if present)

## Scripts

### `report-compiler.py`

```
Usage: python3 report-compiler.py <outputDir>

Arguments:
  outputDir   review output root (contains .working/ subdirectory)

Reads:
  {outputDir}/.working/verification/verified-findings.json
  {outputDir}/.working/change-summary.md
  {outputDir}/.working/acceptance-criteria.md  (optional)

Writes:
  {outputDir}/report.md

Exit codes:
  0   report written successfully
  1   verified-findings.json not found or unreadable
```
