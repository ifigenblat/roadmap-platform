#!/usr/bin/env python3
"""
Merge reviewer findings from task-*-findings.json files.

Usage: python3 merge-findings.py <scopeDir> <outputFile>

Reads task-*-findings.json from scopeDir (ordered by numeric suffix).
If task-manifest.txt is present, uses it to determine task order and which
entries are reviewer tasks (skips domain-synthesizer entries).

Output JSON schema:
{
  "mergedFindings": [{ ...finding fields..., "sourceTaskId": "task-01" }],
  "notAssessed":    ["task-03", ...],
  "clean":          ["task-02", ...]
}

- notAssessed: task IDs whose findings file is absent from disk (agent failure)
- clean: task IDs whose findings file exists but contains an empty findings array
- mergedFindings: all findings from all tasks, each enriched with sourceTaskId
"""

import glob as glob_module
import json
import os
import re
import sys


def extract_numeric_suffix(task_id: str) -> str | None:
    """Extract trailing numeric suffix (e.g. domain-logic-01 -> '01')."""
    m = re.search(r"(\d+)$", task_id)
    return m.group(1) if m else None


def task_id_from_n(n: str) -> str:
    """Convert zero-padded suffix back to task ID label."""
    return f"task-{n}"


def load_findings_file(scope_dir: str, n: str) -> tuple[list[dict], str]:
    """
    Load task-{n}-findings.json.
    Returns (findings_list, status) where status is 'found', 'missing', or 'clean'.
    """
    filename = f"task-{n}-findings.json"
    path = os.path.join(scope_dir, filename)
    if not os.path.exists(path):
        return [], "missing"
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return [], "missing"
    findings = data.get("findings", [])
    if not findings:
        return [], "clean"
    return findings, "found"


def run_with_manifest(scope_dir: str) -> tuple[list[dict], list[str], list[str]]:
    """Read task-manifest.txt and process reviewer tasks in manifest order."""
    manifest_path = os.path.join(scope_dir, "task-manifest.txt")
    with open(manifest_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    merged_findings: list[dict] = []
    not_assessed: list[str] = []
    clean: list[str] = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split("::")
        if len(parts) < 2:
            continue
        task_id = parts[0].strip()
        rest = parts[1].strip()
        agent_name = rest.split(":")[0].strip() if ":" in rest else rest
        if agent_name == "domain-synthesizer":
            continue
        n = extract_numeric_suffix(task_id)
        if n is None:
            continue
        findings, status = load_findings_file(scope_dir, n)
        label = task_id_from_n(n)
        if status == "missing":
            not_assessed.append(label)
        elif status == "clean":
            clean.append(label)
        else:
            for finding in findings:
                enriched = dict(finding)
                enriched["sourceTaskId"] = label
                merged_findings.append(enriched)

    return merged_findings, not_assessed, clean


def run_fallback(scope_dir: str) -> tuple[list[dict], list[str], list[str]]:
    """Fallback: glob task-*-findings.json and process each sorted by numeric suffix."""
    pattern = os.path.join(scope_dir, "task-*-findings.json")
    paths = glob_module.glob(pattern)

    def key(p: str) -> int:
        base = os.path.basename(p)
        m = re.match(r"task-(\d+)-findings\.json", base)
        return int(m.group(1)) if m else 0

    paths.sort(key=key)

    merged_findings: list[dict] = []
    not_assessed: list[str] = []
    clean: list[str] = []

    for path in paths:
        base = os.path.basename(path)
        m = re.match(r"task-(\d+)-findings\.json", base)
        if not m:
            continue
        n = m.group(1)
        findings, status = load_findings_file(scope_dir, n)
        label = task_id_from_n(n)
        if status == "missing":
            not_assessed.append(label)
        elif status == "clean":
            clean.append(label)
        else:
            for finding in findings:
                enriched = dict(finding)
                enriched["sourceTaskId"] = label
                merged_findings.append(enriched)

    return merged_findings, not_assessed, clean


def main() -> None:
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python3 merge-findings.py <scopeDir> <outputFile>\n")
        sys.exit(1)

    scope_dir = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.isdir(scope_dir):
        sys.stderr.write(f"Error: scopeDir is not a directory: {scope_dir}\n")
        sys.exit(1)

    manifest_path = os.path.join(scope_dir, "task-manifest.txt")
    if os.path.exists(manifest_path):
        merged_findings, not_assessed, clean = run_with_manifest(scope_dir)
    else:
        merged_findings, not_assessed, clean = run_fallback(scope_dir)

    output = {
        "mergedFindings": merged_findings,
        "notAssessed": not_assessed,
        "clean": clean,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
