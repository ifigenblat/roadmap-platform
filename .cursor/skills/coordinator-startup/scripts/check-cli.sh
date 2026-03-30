#!/usr/bin/env bash
# check-cli.sh — probe for Cursor CLI binary and record the resolved command name.
#
# Usage: check-cli.sh <outputDir>
#
# On success: writes the resolved command name to
#   <outputDir>/.working/orchestration/cli-cmd.txt
#   prints CLI_CMD=<name> to stdout
#   exits 0
#
# On failure: prints a CLI_NOT_FOUND diagnostic block to stdout
#   exits 1

set -euo pipefail

OUTPUT_DIR="${1:-}"

if [ -z "$OUTPUT_DIR" ]; then
    echo "Usage: check-cli.sh <outputDir>" >&2
    exit 1
fi

CLI_CMD=""

# Probe cursor-agent first, then agent (flat CLI name)
if command -v cursor-agent > /dev/null 2>&1; then
    CLI_CMD="cursor-agent"
elif command -v agent > /dev/null 2>&1; then
    CLI_CMD="agent"
fi

if [ -n "$CLI_CMD" ]; then
    ORCHESTRATION_DIR="${OUTPUT_DIR}/.working/orchestration"
    mkdir -p "$ORCHESTRATION_DIR"
    printf '%s' "$CLI_CMD" > "${ORCHESTRATION_DIR}/cli-cmd.txt"
    echo "CLI_CMD=${CLI_CMD}"
    exit 0
fi

# CLI not found — print diagnostic block and exit 1
cat <<'EOF'
CLI_NOT_FOUND

Cursor CLI (cursor-agent / agent) was not found in your PATH.

The Cursor CLI is the headless command-line interface for Cursor AI. It is
required for orchestration=cli mode, which fans out review agents as parallel
CLI sessions for maximum concurrency (8+).

Install the Cursor CLI:

  curl https://cursor.com/install -fsSL | bash

After installation, restart your terminal and rerun the review.

Alternative orchestration modes (no CLI required):
  - orchestration=native   (default) — foreground Task batches, all Cursor modes
  - orchestration=rolling             — scripted rolling window, requires MAX mode
EOF

exit 1
