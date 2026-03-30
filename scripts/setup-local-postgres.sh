#!/usr/bin/env bash
# Create the dev Postgres role + database on your Mac/Homebrew cluster (not Docker).
# Uses root .env for POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT.
#
# First connection uses a superuser: POSTGRES_BOOTSTRAP_USER (default: your macOS login),
# via TCP to 127.0.0.1 (matches typical Homebrew pg_hba trust for localhost).
#
# Usage (from repo root):  ./scripts/setup-local-postgres.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-roadmap_platform}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BOOTSTRAP_USER="${POSTGRES_BOOTSTRAP_USER:-$(whoami)}"

psql_base=(psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$BOOTSTRAP_USER" -d postgres -v ON_ERROR_STOP=1)

if ! "${psql_base[@]}" -c "SELECT 1" >/dev/null 2>&1; then
  cat >&2 <<EOF
Could not connect to Postgres as bootstrap user "$BOOTSTRAP_USER" on 127.0.0.1:$POSTGRES_PORT.

Fix one of:
  • Start Postgres (e.g. brew services start postgresql@16).
  • Set POSTGRES_BOOTSTRAP_USER in .env to a superuser that can connect over TCP (often your macOS username).

EOF
  exit 1
fi

echo "==> Ensuring role $POSTGRES_USER exists (bootstrap: $BOOTSTRAP_USER)..."
psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$BOOTSTRAP_USER" -d postgres -v ON_ERROR_STOP=1 <<SQLEOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    EXECUTE format('CREATE ROLE %I WITH LOGIN SUPERUSER PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
  END IF;
END
\$\$;
SQLEOF

echo "==> Ensuring database $POSTGRES_DB exists..."
exists=$("${psql_base[@]}" -Atqc "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}'")
if [[ "$exists" == "1" ]]; then
  echo "    (already exists)"
else
  "${psql_base[@]}" -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"
fi

echo "Done. Set POSTGRES_PORT=$POSTGRES_PORT and the three *DATABASE_URL* values in .env (see .env.example), then: npm run db:push:all"
