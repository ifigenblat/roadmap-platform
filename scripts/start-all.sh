#!/usr/bin/env bash
# Start everything: Docker (Postgres/Redis per .env) + all Node dev apps (Turbo: gateway, services, client).
# Same as: npm run stack:start  |  npm start  |  ./scripts/dev-stack.sh start
#
# Environment:
#   DEV_STACK_FOREGROUND=0  — only start Docker, print hint, exit (no npm run dev)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/dev-stack.sh" start
