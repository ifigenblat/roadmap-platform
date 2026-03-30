#!/usr/bin/env python3
"""
Compile the final report.md from review pipeline artifacts.

Usage: python3 report-compiler.py <outputDir>

Reads:
  {outputDir}/.working/verification/verified-findings.json
  {outputDir}/.working/change-summary.md
  {outputDir}/.working/acceptance-criteria.md  (optional)

Writes:
  {outputDir}/report.md

The report contains:
  - Review header (title, date, scope from change-summary)
  - Verdict summary (based on highest severity found)
  - Finding counts by severity
  - Full verbatim finding blocks for all verified findings
  - Section for dismissed count
  - Footer
"""

import json
import os
import sys
from datetime import datetime


SEVERITY_ORDER = ["critical", "high", "medium", "low"]


def _verdict_from_findings(findings: list[dict]) -> str:
    """Derive overall verdict from the highest severity finding present."""
    severities = {f.get("severity", "").lower() for f in findings}
    if "critical" in severities:
        return "block"
    if "high" in severities:
        return "changes-requested"
    if "medium" in severities:
        return "pass-with-comments"
    return "pass"


def _count_by_severity(findings: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {s: 0 for s in SEVERITY_ORDER}
    for f in findings:
        sev = f.get("severity", "").lower()
        if sev in counts:
            counts[sev] += 1
    return counts


def _read_text(path: str, default: str = "") -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return default


def _extract_project_name(change_summary: str) -> str:
    """Try to extract project/service name from change-summary header."""
    for line in change_summary.splitlines():
        if "project" in line.lower() or "service" in line.lower() or "repo" in line.lower():
            # e.g. "- **Project:** my-service"
            parts = line.split(":", 1)
            if len(parts) == 2:
                candidate = parts[1].strip().strip("*").strip()
                if candidate:
                    return candidate
    return "Code Review"


def _sort_findings(findings: list[dict]) -> list[dict]:
    """Sort findings by severity (critical first)."""
    def key(f: dict) -> int:
        sev = f.get("severity", "").lower()
        try:
            return SEVERITY_ORDER.index(sev)
        except ValueError:
            return len(SEVERITY_ORDER)
    return sorted(findings, key=key)


def main() -> None:
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: python3 report-compiler.py <outputDir>\n")
        sys.exit(1)

    output_dir = sys.argv[1]
    working_dir = os.path.join(output_dir, ".working")
    verification_dir = os.path.join(working_dir, "verification")

    verified_findings_path = os.path.join(verification_dir, "verified-findings.json")
    change_summary_path = os.path.join(working_dir, "change-summary.md")
    acceptance_criteria_path = os.path.join(working_dir, "acceptance-criteria.md")
    report_path = os.path.join(output_dir, "report.md")

    if not os.path.isfile(verified_findings_path):
        sys.stderr.write(f"Error: verified-findings.json not found at {verified_findings_path}\n")
        sys.exit(1)

    try:
        with open(verified_findings_path, "r", encoding="utf-8") as f:
            pipeline_data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        sys.stderr.write(f"Error reading verified-findings.json: {e}\n")
        sys.exit(1)

    verified_findings: list[dict] = pipeline_data.get("verifiedFindings", [])
    dismissed_count: int = pipeline_data.get("dismissedCount", 0)
    total_processed: int = pipeline_data.get("totalProcessed", 0)

    change_summary = _read_text(change_summary_path)
    project_name = _extract_project_name(change_summary)
    sorted_findings = _sort_findings(verified_findings)
    verdict = _verdict_from_findings(sorted_findings)
    counts = _count_by_severity(sorted_findings)
    today = datetime.now().strftime("%Y-%m-%d")

    lines: list[str] = []

    # Header
    lines.append(f"# Code Review: {project_name}\n")
    lines.append(f"\n**Date:** {today}  \n")
    lines.append(f"**Verdict:** `{verdict}`  \n")
    lines.append(f"**Findings:** {len(sorted_findings)} verified")
    if dismissed_count:
        lines.append(f" ({dismissed_count} dismissed)")
    lines.append("  \n")
    lines.append(f"**Total reviewed:** {total_processed} findings\n")

    # Finding count table
    lines.append("\n## Summary\n")
    lines.append("\n| Severity | Count |\n")
    lines.append("|----------|-------|\n")
    for sev in SEVERITY_ORDER:
        if counts[sev] > 0:
            lines.append(f"| {sev.title()} | {counts[sev]} |\n")

    # Findings
    if sorted_findings:
        lines.append("\n## Findings\n")
        for finding in sorted_findings:
            finding_md = finding.get("findingMarkdown", "")
            if finding_md:
                lines.append(f"\n{finding_md.rstrip()}\n")
            else:
                sev = (finding.get("severity") or "unknown").title()
                title = finding.get("title", "Untitled")
                type_val = finding.get("type", "")
                domain = finding.get("domain", "")
                file_val = finding.get("file", "")
                lines_val = finding.get("lines", "")
                description = finding.get("description", "")
                impact = finding.get("impact", "")
                recommendation = finding.get("recommendation", "")
                lines.append(
                    f"\n### [{sev}] {title}\n"
                    f"- **Type:** {type_val}\n"
                    f"- **Domain:** {domain}\n"
                    f"- **File:** {file_val}\n"
                    f"- **Lines:** {lines_val}\n"
                    f"- **Description:** {description}\n"
                    f"- **Impact:** {impact}\n"
                    f"- **Recommendation:** {recommendation}\n"
                )
    else:
        lines.append("\n## Findings\n\nNo findings — clean review.\n")

    # Change summary appendix
    if change_summary.strip():
        lines.append("\n## Change Summary\n")
        lines.append(f"\n{change_summary.rstrip()}\n")

    # Acceptance criteria appendix
    acceptance_criteria = _read_text(acceptance_criteria_path)
    if acceptance_criteria.strip():
        lines.append("\n## Acceptance Criteria\n")
        lines.append(f"\n{acceptance_criteria.rstrip()}\n")

    os.makedirs(output_dir, exist_ok=True)
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("".join(lines))
    except OSError as e:
        sys.stderr.write(f"Error writing report: {e}\n")
        sys.exit(1)

    print(f"Report written to {report_path}")
    print(f"Verdict: {verdict} | Findings: {len(sorted_findings)} | Dismissed: {dismissed_count}")


if __name__ == "__main__":
    main()
