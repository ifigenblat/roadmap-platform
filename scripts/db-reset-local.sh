#!/usr/bin/env bash
# Drop & recreate roadmap_platform, then push all Prisma schemas (isolated per-service Postgres schemas).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-roadmap_platform}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Terminating connections to $POSTGRES_DB..."
psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" \
  || true

echo "Dropping database $POSTGRES_DB (if exists)..."
psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"

echo "Creating database $POSTGRES_DB..."
psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$POSTGRES_DB\";"

echo "Pushing Prisma schemas..."
"$ROOT/scripts/db-push-all.sh"
