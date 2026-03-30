#!/usr/bin/env bash
# Stop everything: free Node dev ports + docker compose stop (containers kept).
# Same as: npm run stack:stop  |  ./scripts/dev-stack.sh stop
#
# Remove containers: ./scripts/stop-all.sh --down
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/dev-stack.sh" stop "${1:-}"
