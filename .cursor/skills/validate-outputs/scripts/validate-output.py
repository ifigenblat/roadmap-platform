#!/usr/bin/env python3
"""
Validate JSON output files from code-review package agents against registered schemas.

Usage: python3 validate-output.py <file> <schema-name>

Exit codes:
  0 - valid (prints OK [schema]: <file>)
  1 - invalid JSON syntax or schema validation failure (prints ERROR [schema]: <message>)
  2 - unknown schema name or file not found

Supported schemas: file-groups, domain-findings, verdict, verified-findings
"""

import json
import os
import sys


SCHEMAS = frozenset({"file-groups", "domain-findings", "verdict", "verified-findings"})


def _validate_file_groups(data):
    """Validate file-groups schema. Returns None on success, error message on failure."""
    if "groups" not in data:
        return "Missing required field 'groups'"
    if "domainGroups" not in data:
        return "Missing required field 'domainGroups'"

    groups = data.get("groups")
    domain_groups = data.get("domainGroups")

    if not isinstance(groups, list):
        return "Field 'groups' must be a list"

    if not isinstance(domain_groups, dict):
        return "Field 'domainGroups' must be a dict"

    for i, group in enumerate(groups):
        if not isinstance(group, dict):
            return f"Group at index {i} must be an object"
        if "id" not in group:
            return f"Group at index {i} is missing required field 'id'"
        if "files" not in group:
            return f"Group at index {i} is missing required field 'files'"
        if "domains" not in group:
            return f"Group at index {i} is missing required field 'domains'"
        if not isinstance(group["id"], str):
            return f"Group at index {i} field 'id' must be a string"
        if not isinstance(group["files"], list):
            return f"Group at index {i} field 'files' must be a list"
        if not isinstance(group["domains"], list):
            return f"Group at index {i} field 'domains' must be a list"
        for j, file_item in enumerate(group["files"]):
            if not isinstance(file_item, dict):
                return f"File at index {j} in group at index {i} must be an object"
            if "path" not in file_item:
                return f"File at index {j} in group at index {i} is missing required field 'path'"
            if "status" not in file_item:
                return f"File at index {j} in group at index {i} is missing required field 'status'"
            if not isinstance(file_item["path"], str):
                return f"File at index {j} in group at index {i} field 'path' must be a string"
            if not isinstance(file_item["status"], str):
                return f"File at index {j} in group at index {i} field 'status' must be a string"

    for key, val in domain_groups.items():
        if not isinstance(val, list):
            return f"domainGroups['{key}'] must be a list"

    return None


def _validate_domain_findings(data):
    """Validate domain-findings schema. Returns None on success, error message on failure."""
    if "domain" not in data:
        return "Missing required field 'domain'"
    if "findings" not in data:
        return "Missing required field 'findings'"

    domain = data.get("domain")
    findings = data.get("findings")

    if not isinstance(domain, str) or not domain.strip():
        return "Field 'domain' must be a non-empty string"

    if not isinstance(findings, list):
        return "Field 'findings' must be a list"

    for i, finding in enumerate(findings):
        if not isinstance(finding, dict):
            return f"Finding at index {i} must be an object"
        if "severity" not in finding:
            return f"Finding at index {i} is missing required field 'severity'"
        if "title" not in finding:
            return f"Finding at index {i} is missing required field 'title'"
        if "findingMarkdown" not in finding:
            return f"Finding at index {i} is missing required field 'findingMarkdown'"
        if not isinstance(finding["severity"], str):
            return f"Finding at index {i} field 'severity' must be a string"
        if not isinstance(finding["title"], str):
            return f"Finding at index {i} field 'title' must be a string"
        if not isinstance(finding["findingMarkdown"], str):
            return f"Finding at index {i} field 'findingMarkdown' must be a string"
        if "threatModel" in finding and finding["threatModel"] is not None:
            if not isinstance(finding["threatModel"], dict):
                return f"Finding at index {i} field 'threatModel' must be a dict when present"

    return None


def _validate_verdict(data):
    """Validate verdict schema. Returns None on success, error message on failure."""
    required_str_fields = ("type", "domain", "file", "description", "impact", "recommendation")
    for field in required_str_fields:
        if field not in data:
            return f"Missing required field '{field}'"
        if not isinstance(data[field], str):
            return f"Field '{field}' must be a string"

    if "verdict" not in data:
        return "Missing required field 'verdict'"
    if data["verdict"] not in ("verified", "dismissed"):
        return f"Field 'verdict' must be 'verified' or 'dismissed', got '{data['verdict']}'"

    if "severity" not in data:
        return "Missing required field 'severity'"
    if not isinstance(data["severity"], str):
        return "Field 'severity' must be a string"

    if "title" not in data:
        return "Missing required field 'title'"
    if not isinstance(data["title"], str):
        return "Field 'title' must be a string"

    return None


def _validate_verified_findings(data):
    """Validate verified-findings schema. Returns None on success, error message on failure."""
    if "verifiedFindings" not in data:
        return "Missing required field 'verifiedFindings'"
    if "dismissedCount" not in data:
        return "Missing required field 'dismissedCount'"
    if "totalProcessed" not in data:
        return "Missing required field 'totalProcessed'"

    findings = data["verifiedFindings"]
    if not isinstance(findings, list):
        return "Field 'verifiedFindings' must be a list"
    if not isinstance(data["dismissedCount"], int):
        return "Field 'dismissedCount' must be an integer"
    if not isinstance(data["totalProcessed"], int):
        return "Field 'totalProcessed' must be an integer"

    for i, finding in enumerate(findings):
        if not isinstance(finding, dict):
            return f"Finding at index {i} must be an object"
        if finding.get("verdict") != "verified":
            return f"Finding at index {i} field 'verdict' must be 'verified'"

    return None


def validate(schema_name, data):
    """Validate data against schema. Returns None on success, error message on failure."""
    if schema_name == "file-groups":
        return _validate_file_groups(data)
    if schema_name == "domain-findings":
        return _validate_domain_findings(data)
    if schema_name == "verdict":
        return _validate_verdict(data)
    if schema_name == "verified-findings":
        return _validate_verified_findings(data)
    return f"Unknown schema '{schema_name}'"


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python3 validate-output.py <file> <schema-name>\n")
        sys.stderr.write("Supported schemas: file-groups, domain-findings, verdict, verified-findings\n")
        sys.exit(2)

    file_path = sys.argv[1]
    schema_name = sys.argv[2]

    if schema_name not in SCHEMAS:
        print(f"ERROR [{schema_name}]: Unknown schema '{schema_name}'")
        sys.exit(2)

    if not os.path.isfile(file_path):
        print(f"ERROR [{schema_name}]: File not found: {file_path}")
        sys.exit(2)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR [{schema_name}]: Invalid JSON syntax: {e}")
        sys.exit(1)
    except OSError as e:
        print(f"ERROR [{schema_name}]: {e}")
        sys.exit(1)

    err = validate(schema_name, data)
    if err:
        print(f"ERROR [{schema_name}]: {err} in {file_path}")
        sys.exit(1)

    print(f"OK [{schema_name}]: {file_path}")
    sys.exit(0)


if __name__ == "__main__":
    main()
