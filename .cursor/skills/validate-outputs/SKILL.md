---
name: validate-outputs
description: Validates file-groups.json, domain-{name}.json, task-*-verdict.json, and verified-findings.json outputs against registered schemas. Use when change-analyzer, domain-synthesizer, finding-verifier, or the report pipeline have written structured JSON and you need to verify correctness before signaling done.
promp:
  package: "code-review"
  version: "1.9.0-beta.25"
  environment: "development"
  prompVersion: "1.0.1-beta.17"
  skill: "validate-outputs"
---

# Validate Outputs

Agents that produce structured JSON outputs must validate them before writing their done signal.

## When to Use

After writing any of the following, and **before** touching the done signal file:
- `file-groups.json` (change-analyzer)
- `domain-{name}.json` (domain-synthesizer)
- `task-*-verdict.json` (finding-verifier)
- `verified-findings.json` (compile-verdicts.py)

## Script Location

The validator script lives at `{packageRoot}/skills/validate-outputs/scripts/validate-output.py`. Agents receive `validateScriptsDir` in their task context (injected by the generator scripts or coordinator). Use it directly:

```
python3 {validateScriptsDir}/validate-output.py <file> <schema>
```

## Schemas

| Schema | Producer | Invocation |
|--------|----------|------------|
| `file-groups` | change-analyzer | `python3 {validateScriptsDir}/validate-output.py {path}/file-groups.json file-groups` |
| `domain-findings` | domain-synthesizer | `python3 {validateScriptsDir}/validate-output.py {path}/domain-{name}.json domain-findings` |
| `verdict` | finding-verifier | `python3 {validateScriptsDir}/validate-output.py {path}/task-{n}-verdict.json verdict` |
| `verified-findings` | compile-verdicts.py | `python3 {validateScriptsDir}/validate-output.py {path}/verified-findings.json verified-findings` |

## Example Outputs

**OK:**
```
OK [file-groups]: /path/to/file-groups.json
OK [domain-findings]: /path/to/domain-security.json
OK [verdict]: /path/to/task-01-verdict.json
OK [verified-findings]: /path/to/verified-findings.json
```

**ERROR (validation):**
```
ERROR [file-groups]: Missing required field 'domainGroups' in /path/to/file.json
ERROR [domain-findings]: Finding at index 2 is missing required field 'findingMarkdown'
ERROR [verdict]: Field 'verdict' must be 'verified' or 'dismissed'
ERROR [verified-findings]: findings[0] missing required field 'findingMarkdown'
```

## On Failure

If the validator exits non-zero:
1. Fix the JSON to satisfy the schema
2. Re-run the validator
3. Do **not** write the done signal until validation passes
