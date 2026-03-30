#!/usr/bin/env python3
"""
Compute a collision-safe output directory path for a code review session.

Outputs a single line to stdout: .ai/code-review/{YYYYMMDD-HHMM}-{ref-slug}

Usage:
  python3 compute-output-dir.py [--pr-iid IID] [--diff-ref REF] [--mode MODE]

Arguments:
  --pr-iid IID     Merge/pull request IID (e.g. 42 → slug becomes mr-42)
  --diff-ref REF   Git ref, branch, commit, or path being reviewed
  --mode MODE      Review mode: committed | local | staged (default: committed)

Slug derivation priority:
  1. If --pr-iid is provided: mr-{IID}
  2. If --diff-ref is provided: sanitized form of the ref
  3. If --mode is local or staged: mode name
  4. Fallback: main

Sanitization rules applied to ref slugs:
  - Lowercase
  - Characters in [/ . _ space] replaced with hyphens
  - Consecutive hyphens collapsed to one
  - Leading and trailing hyphens stripped
  - Truncated to 40 characters
"""

import argparse
import re
import sys
from datetime import datetime


def sanitize(value: str) -> str:
    """Apply slug sanitization rules to a string."""
    slug = value.lower()
    slug = re.sub(r"[/._\s]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    slug = slug.strip("-")
    return slug[:40]


def compute_ref_slug(pr_iid: str | None, diff_ref: str | None, mode: str) -> str:
    if pr_iid:
        return sanitize(f"mr-{pr_iid}")
    if diff_ref:
        slug = sanitize(diff_ref)
        if slug:
            return slug
    if mode in ("local", "staged"):
        return mode
    return "main"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute collision-safe output directory for a code review session."
    )
    parser.add_argument("--pr-iid", default=None, help="Merge/pull request IID")
    parser.add_argument("--diff-ref", default=None, help="Git ref, branch, or path being reviewed")
    parser.add_argument(
        "--mode",
        default="committed",
        choices=["committed", "local", "staged"],
        help="Review mode (default: committed)",
    )
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    ref_slug = compute_ref_slug(args.pr_iid, args.diff_ref, args.mode)
    output_dir = f".ai/code-review/{timestamp}-{ref_slug}"
    sys.stdout.write(output_dir + "\n")


if __name__ == "__main__":
    main()
