#!/usr/bin/env python3
"""
Generate verifier task-specs from Phase 2 domain output files.

Usage: python3 generate-finding-task-specs.py <outputDir> <scopeDir> <coordinatorScopeDir> <taskPrefix>

- outputDir: repo working root
- scopeDir: where to write verifier task-specs (e.g. .working/verification/)
- coordinatorScopeDir: where done-signal files live (e.g. .working/orchestration/)
- taskPrefix: prefix for task names (e.g. verify-)

Reads domain-*.json from {outputDir}/.working/, enumerates all findings,
writes per-finding task-specs and task-manifest.txt.
"""

import glob as glob_module
import json
import os
import sys


def _reconstruct_finding(finding: dict) -> str:
    """Reconstruct finding markdown from structured fields when findingMarkdown is absent."""
    severity = finding.get("severity", "unknown")
    severity_title = severity.title() if severity else "Unknown"
    title = finding.get("title", "Untitled")
    type_val = finding.get("type", "")
    domain = finding.get("domain", "")
    file_val = finding.get("file", "")
    lines = finding.get("lines", "")
    description = finding.get("description", "")
    impact = finding.get("impact", "")
    recommendation = finding.get("recommendation", "")

    parts = [f"### [{severity_title}] {title}"]
    parts.append(f"- **Type:** {type_val}")
    parts.append(f"- **Domain:** {domain}")
    parts.append(f"- **File:** {file_val}")
    parts.append(f"- **Lines:** {lines}")
    parts.append(f"- **Description:** {description}")
    parts.append(f"- **Impact:** {impact}")
    parts.append(f"- **Recommendation:** {recommendation}")

    threat_model = finding.get("threatModel")
    if threat_model and isinstance(threat_model, dict):
        parts.append("")
        parts.append("#### Threat Model")
        for key, val in threat_model.items():
            if val:
                label = key.replace("_", " ").title()
                parts.append(f"- **{label}:** {val}")

    return "\n".join(parts)


def _get_finding_block(finding: dict) -> str:
    """Return the ## Finding block content: use findingMarkdown if present, else reconstruct."""
    if finding.get("findingMarkdown"):
        return finding["findingMarkdown"]
    return _reconstruct_finding(finding)


def _read_text(path: str) -> str:
    """Read file as UTF-8 text. Return empty string if missing or unreadable."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def main() -> None:
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    validate_scripts_dir = os.path.normpath(
        os.path.join(_script_dir, "..", "..", "validate-outputs", "scripts")
    )

    if len(sys.argv) != 5:
        sys.stderr.write(
            "Usage: python3 generate-finding-task-specs.py <outputDir> <scopeDir> "
            "<coordinatorScopeDir> <taskPrefix>\n"
        )
        sys.exit(1)

    output_dir = sys.argv[1]
    scope_dir = sys.argv[2]
    coordinator_scope_dir = sys.argv[3]
    task_prefix = sys.argv[4]

    working_dir = os.path.join(output_dir, ".working")
    # Domain-synthesizer writes domain-{name}.json; full-review-process uses component dirs.
    # Patterns: domain-*/domain-*.json (domain-logic/domain-logic.json),
    # domain-*.json (flat), */domain-*.json (api-services-security/domain-security.json, etc.)
    subdir_pattern = os.path.join(working_dir, "domain-*", "domain-*.json")
    flat_pattern = os.path.join(working_dir, "domain-*.json")
    component_pattern = os.path.join(working_dir, "*", "domain-*.json")
    domain_files = sorted(
        list(set(
            glob_module.glob(subdir_pattern)
            + glob_module.glob(flat_pattern)
            + glob_module.glob(component_pattern)
        ))
    )

    findings = []
    for path in domain_files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            sys.stderr.write(f"Error reading {path}: {e}\n")
            continue

        for finding in data.get("findings", []):
            findings.append(finding)

    if not findings:
        os.makedirs(scope_dir, exist_ok=True)
        manifest_path = os.path.join(scope_dir, "task-manifest.txt")
        try:
            with open(manifest_path, "w", encoding="utf-8") as f:
                f.write("")
        except OSError as e:
            sys.stderr.write(f"Error writing manifest: {e}\n")
            sys.exit(1)
        return

    task_specs_dir = os.path.join(scope_dir, "task-specs")
    os.makedirs(task_specs_dir, exist_ok=True)

    change_summary = _read_text(os.path.join(working_dir, "change-summary.md"))
    acceptance_criteria = _read_text(os.path.join(working_dir, "acceptance-criteria.md"))
    if not acceptance_criteria:
        acceptance_criteria = "(none)"

    patterns_dir = os.path.join(working_dir, "patterns")
    manifest_lines = []

    for i, finding in enumerate(findings, start=1):
        n = f"{i:02d}"
        spec_filename = f"{task_prefix}{n}.md"
        spec_path = os.path.join(task_specs_dir, spec_filename)

        output_path = os.path.join(scope_dir, f"task-{n}-verdict.md")
        done_signal_path = os.path.join(coordinator_scope_dir, f"{task_prefix}{n}.txt")

        finding_block = _get_finding_block(finding)
        domain = finding.get("domain", "")
        pattern_slice = _read_text(os.path.join(patterns_dir, f"{domain}.md"))

        spec_content = f"""outputPath: {output_path}
validateScriptsDir: {validate_scripts_dir}
doneSignal: {done_signal_path}

## Finding

{finding_block}

## Working Context

### Change Summary
{change_summary}

### Domain Pattern Slice ({domain})
{pattern_slice}

### Acceptance Criteria
{acceptance_criteria}
"""

        try:
            with open(spec_path, "w", encoding="utf-8") as f:
                f.write(spec_content)
        except OSError as e:
            sys.stderr.write(f"Error writing {spec_path}: {e}\n")
            sys.exit(1)

        manifest_lines.append(f"{task_prefix}{n}::finding-verifier:{task_prefix}{n}.txt")

    manifest_path = os.path.join(scope_dir, "task-manifest.txt")
    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write("\n".join(manifest_lines) + "\n")
    except OSError as e:
        sys.stderr.write(f"Error writing manifest: {e}\n")
        sys.exit(1)

    print(f"Wrote {len(findings)} task-specs to {scope_dir}")
    print(f"Wrote task-manifest.txt to {manifest_path}")


if __name__ == "__main__":
    main()
