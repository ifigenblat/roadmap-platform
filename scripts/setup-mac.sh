#!/usr/bin/env bash
# Roadmap Platform — macOS / Linux setup (install deps, Docker DBs, Prisma push).
# Delegates to scripts/setup.sh. Requires: Node.js, npm, Docker Desktop (or Linux Docker), bash.
#
# Usage (from repo root):
#   ./scripts/setup-mac.sh
#   ./scripts/setup-mac.sh --local-postgres   # host Postgres on 5432 + Redis in Docker
#   ./scripts/setup-mac.sh --skip-docker
#   ./scripts/setup-mac.sh --help
#
# Equivalent: npm run setup
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/setup.sh" "$@"
