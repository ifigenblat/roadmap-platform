#!/usr/bin/env bash
# Restart everything: stop-all (no --down) then start-all.
# Same as: npm run stack:restart  |  ./scripts/dev-stack.sh restart
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/dev-stack.sh" restart
