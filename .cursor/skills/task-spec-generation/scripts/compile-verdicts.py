#!/usr/bin/env python3
"""
Compile verified verdict findings from task-*-verdict.json files.

Usage: python3 compile-verdicts.py <scopeDir> <outputFile>

Reads task-*-verdict.json from scopeDir (sorted by task number).
Falls back to parsing task-*-verdict.md for any tasks without a .json file.

Output JSON schema (verified-findings):
{
  "verifiedFindings": [
    {
      "verdict": "verified",
      "severity": "...",
      "type": "...",
      "domain": "...",
      "file": "...",
      "lines": "...",
      "title": "...",
      "description": "...",
      "impact": "...",
      "recommendation": "...",
      "evidence": "...",
      "findingMarkdown": "..."
    }
  ],
  "dismissedCount": <int>,
  "totalProcessed": <int>
}
"""

import glob
import json
import os
import re
import sys
from typing import Optional


def _extract_task_number(path: str) -> Optional[str]:
    """Extract task number from path like task-05-verdict.{md,json} -> 05."""
    base = os.path.basename(path)
    match = re.match(r"^task-(\d+)-verdict\.(md|json)$", base)
    return match.group(1) if match else None


def _reconstruct_finding_from_json(data: dict) -> str:
    """Reconstruct minimal finding markdown from JSON verdict fields."""
    severity = (data.get("severity") or "unknown").title()
    title = data.get("title", "Untitled")
    type_val = data.get("type", "")
    domain = data.get("domain", "")
    file_val = data.get("file", "")
    lines = data.get("lines", "")
    description = data.get("description", "")
    impact = data.get("impact", "")
    recommendation = data.get("recommendation", "")
    return (
        f"### [{severity}] {title}\n"
        f"- **Type:** {type_val}\n"
        f"- **Domain:** {domain}\n"
        f"- **File:** {file_val}\n"
        f"- **Lines:** {lines}\n"
        f"- **Description:** {description}\n"
        f"- **Impact:** {impact}\n"
        f"- **Recommendation:** {recommendation}\n"
    )


def _load_verdict_from_json(json_path: str) -> Optional[dict]:
    """Load and return verdict data from a .json verdict file, or None on error."""
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        sys.stderr.write(f"Error reading {json_path}: {e}\n")
        return None


def _is_verified_md(content: str) -> bool:
    return bool(re.search(r"^## Verdict: verified\s*$", content, re.MULTILINE))


def _extract_section_md(content: str, heading: str) -> Optional[str]:
    """Extract content of a ### section from markdown, fenced-code-block aware."""
    pattern = rf"^### {re.escape(heading)}\s*$"
    match = re.search(pattern, content, re.MULTILINE)
    if not match:
        return None
    start = match.end()
    rest = content[start:]
    lines = rest.split("\n")
    in_code_block = False
    result_lines = []
    for line in lines:
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
            result_lines.append(line)
            continue
        if not in_code_block:
            if re.match(r"^## ", line) or re.match(r"^### (?!\[)", line):
                break
        result_lines.append(line)
    extracted = "\n".join(result_lines).rstrip()
    return extracted if extracted else None


def _verdict_from_md_fallback(md_path: str, task_num: str) -> Optional[dict]:
    """
    Parse a .md verdict file and return a verdict dict if verified.
    Used when no .json companion exists.
    """
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError as e:
        sys.stderr.write(f"Error reading {md_path}: {e}\n")
        return None

    if not _is_verified_md(content):
        return {"verdict": "dismissed"}

    finding_md = _extract_section_md(content, "Enhanced Finding")
    if finding_md is None:
        finding_md = _extract_section_md(content, "Finding")

    return {
        "verdict": "verified",
        "title": f"Finding from task-{task_num}",
        "findingMarkdown": finding_md or "",
    }


def main() -> None:
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python3 compile-verdicts.py <scopeDir> <outputFile>\n")
        sys.exit(1)

    scope_dir = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.isdir(scope_dir):
        sys.stderr.write(f"Error: scopeDir is not a directory: {scope_dir}\n")
        sys.exit(1)

    # Collect all task numbers: prefer .json over .md
    json_files = {
        _extract_task_number(p): p
        for p in glob.glob(os.path.join(scope_dir, "task-*-verdict.json"))
        if _extract_task_number(p)
    }
    md_files = {
        _extract_task_number(p): p
        for p in glob.glob(os.path.join(scope_dir, "task-*-verdict.md"))
        if _extract_task_number(p)
    }
    all_task_nums = sorted(set(list(json_files.keys()) + list(md_files.keys())), key=int)

    verified_findings: list[dict] = []
    dismissed_count = 0
    total_processed = 0

    for task_num in all_task_nums:
        total_processed += 1

        if task_num in json_files:
            data = _load_verdict_from_json(json_files[task_num])
            if data is None:
                continue
        else:
            data = _verdict_from_md_fallback(md_files[task_num], task_num)
            if data is None:
                continue

        if data.get("verdict") != "verified":
            dismissed_count += 1
            continue

        # Ensure findingMarkdown is present
        if not data.get("findingMarkdown"):
            data = dict(data)
            data["findingMarkdown"] = _reconstruct_finding_from_json(data)

        verified_findings.append(data)

    output = {
        "verifiedFindings": verified_findings,
        "dismissedCount": dismissed_count,
        "totalProcessed": total_processed,
    }

    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
            f.write("\n")
    except OSError as e:
        sys.stderr.write(f"Error writing {output_file}: {e}\n")
        sys.exit(1)

    print(f"scopeDir: {os.path.abspath(scope_dir)}")
    print(f"outputFile: {os.path.abspath(output_file)}")
    print(f"Wrote {len(verified_findings)} verified finding(s) to {output_file}")


if __name__ == "__main__":
    main()
