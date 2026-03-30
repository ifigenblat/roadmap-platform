#!/usr/bin/env python3
"""
Generate domain reviewer task-specs and synthesizer task-spec from file-groups.json.

Matches the domain-review-orchestrator Step 3 template exactly.

Usage: python3 generate-domain-task-specs.py <domain> <outputDir> <scopeDir> \
    <coordinatorScopeDir> <taskPrefix> <severityThreshold>
"""

import json
import os
import re
import subprocess
import sys

# Domain -> reviewer agent name mapping (matches domain-review-orchestrator)
DOMAIN_REVIEWER = {
    "logic": "logic-correctness-reviewer",
    "security": "security-reviewer",
    "performance": "performance-reviewer",
    "observability": "observability-reviewer",
    "quality": "quality-maintainability-reviewer",
    "architecture": "design-architecture-reviewer",
    "testing": "testing-reviewer",
    "http-client": "http-client-reviewer",
    "event-driven": "event-driven-reviewer",
    "lambda": "lambda-reviewer",
    "orchestrated-process": "orchestrated-process-reviewer",
    "feature-flags": "feature-flag-reviewer",
}


def read_file(path: str, default: str = "") -> str:
    """Read file contents or return default if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return default


def main() -> None:
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    validate_scripts_dir = os.path.normpath(
        os.path.join(_script_dir, "..", "..", "validate-outputs", "scripts")
    )

    if len(sys.argv) != 7:
        sys.stderr.write(
            "Usage: python3 generate-domain-task-specs.py <domain> <outputDir> "
            "<scopeDir> <coordinatorScopeDir> <taskPrefix> <severityThreshold>\n"
        )
        sys.exit(1)

    domain = sys.argv[1]
    output_dir = sys.argv[2]
    scope_dir = sys.argv[3]
    coordinator_scope_dir = sys.argv[4]
    task_prefix = sys.argv[5]
    severity_threshold = sys.argv[6]

    working = os.path.join(output_dir, ".working")
    file_groups_path = os.path.join(working, "file-groups.json")

    try:
        with open(file_groups_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)
    except OSError as e:
        sys.stderr.write(f"Error reading file-groups.json: {e}\n")
        sys.exit(1)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Error parsing file-groups.json: {e}\n")
        sys.exit(1)

    domain_groups = json_data.get("domainGroups", {})
    if not isinstance(domain_groups, dict):
        print(
            f"ERROR: file-groups.json 'domainGroups' must be a dict, got {type(domain_groups).__name__}",
            file=sys.stderr,
        )
        sys.exit(1)
    group_ids = domain_groups.get(domain)
    if not group_ids:
        print(f"No groups for domain {domain}")
        sys.exit(0)

    raw_groups = json_data.get("groups", [])
    if not isinstance(raw_groups, list):
        print(
            f"ERROR: file-groups.json 'groups' must be a list, got {type(raw_groups).__name__}",
            file=sys.stderr,
        )
        sys.exit(1)
    groups = {g["id"]: g for g in raw_groups if isinstance(g, dict) and "id" in g}

    # Phase 1 context
    change_summary = read_file(os.path.join(working, "change-summary.md"))
    if not change_summary:
        sys.stderr.write("Error: change-summary.md is required but missing or empty\n")
        sys.exit(1)

    patterns_path = os.path.join(working, "patterns", f"{domain}.md")
    domain_pattern = read_file(patterns_path)
    acceptance_criteria = read_file(os.path.join(working, "acceptance-criteria.md"))
    tool_findings = ""
    if domain == "security":
        tool_findings = read_file(os.path.join(working, "tool-findings.md"))

    # Extract Diff Ref from change-summary (use HEAD for staged/local mode if absent)
    diff_ref_match = re.search(r"\*\*Diff Ref:\*\*\s*(.+)", change_summary)
    diff_ref = diff_ref_match.group(1).strip() if diff_ref_match else None
    diff_ref = diff_ref if diff_ref else "HEAD"

    # Resolve reviewer agent
    reviewer_agent = DOMAIN_REVIEWER.get(domain, f"{domain}-reviewer")

    ac_display = (
        acceptance_criteria.strip()
        if acceptance_criteria.strip()
        else "(none)"
    )
    tool_display = (
        tool_findings.strip()
        if domain == "security" and tool_findings.strip()
        else "(none)"
    )

    os.makedirs(scope_dir, exist_ok=True)
    task_specs_dir = os.path.join(scope_dir, "task-specs")
    os.makedirs(task_specs_dir, exist_ok=True)

    manifest_entries = []
    group_list = [gid for gid in group_ids if gid in groups]

    for idx, group_id in enumerate(group_list):
        n = idx + 1
        n_str = f"{n:02d}"
        task_id = f"{task_prefix}{n_str}"
        group = groups[group_id]

        files_list = group.get("files", [])
        file_paths = [
            f["path"] if isinstance(f, dict) else f for f in files_list
        ]

        # Collect diffs for all files in group
        diff_parts = []
        for fp in file_paths:
            result = subprocess.run(
                ["git", "diff", diff_ref, "--", fp],
                capture_output=True,
                text=True,
            )
            if result.stdout:
                diff_parts.append(f"--- {fp}\n{result.stdout}")
            elif result.returncode != 0 and result.stderr:
                diff_parts.append(f"--- {fp}\n(git diff failed: {result.stderr})")

        diff_content = "\n".join(diff_parts) if diff_parts else "(no diff)"

        # Reviewer task-spec (matches domain-review-orchestrator Step 3)
        reviewer_spec = f"""Domain: {domain}
Severity threshold: {severity_threshold}
outputPath: {scope_dir}/task-{n_str}-findings.json
validateScriptsDir: {validate_scripts_dir}
doneSignal: {coordinator_scope_dir}/{task_prefix}{n_str}.txt

## File Group

Group ID: {group_id}
Files: {", ".join(file_paths)}

```diff
{diff_content}
```

## Working Context

### Domain Pattern Slice
{domain_pattern.strip() if domain_pattern.strip() else "(none)"}

### Change Summary
{change_summary}

### Acceptance Criteria
{ac_display}

### Tool Findings (security domain only)
{tool_display}
"""

        spec_path = os.path.join(task_specs_dir, f"{task_prefix}{n_str}.md")
        with open(spec_path, "w", encoding="utf-8") as f:
            f.write(reviewer_spec)

        manifest_entries.append(f"{task_id}::{reviewer_agent}:{task_prefix}{n_str}.txt")

    # Synthesizer task-spec
    synth_spec = f"""Domain: {domain}
scopeDir: {scope_dir}
outputPath: {scope_dir}/{domain}.md
validateScriptsDir: {validate_scripts_dir}
doneSignal: {coordinator_scope_dir}/{task_prefix}synth.txt
severityThreshold: {severity_threshold}

## Working Context

### Domain Pattern Slice
{domain_pattern.strip() if domain_pattern.strip() else "(none)"}

### Change Summary
{change_summary}

### Acceptance Criteria
{ac_display}

### Tool Findings (security domain only)
{tool_display}
"""

    synth_path = os.path.join(task_specs_dir, f"{task_prefix}synth.md")
    with open(synth_path, "w", encoding="utf-8") as f:
        f.write(synth_spec)

    # Synthesizer depends on all reviewer tasks
    reviewer_task_ids = [f"{task_prefix}{i+1:02d}" for i in range(len(group_list))]
    dep_list = ",".join(reviewer_task_ids)
    manifest_entries.append(
        f"{task_prefix}synth:{dep_list}:domain-synthesizer:{task_prefix}synth.txt"
    )

    manifest_path = os.path.join(scope_dir, "task-manifest.txt")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write("\n".join(manifest_entries))

    print(f"Wrote {len(group_list)} reviewer specs, 1 synthesizer spec, and manifest to {scope_dir}")


if __name__ == "__main__":
    main()
