#!/usr/bin/env bash
# Recreate the Postgres named volume when logs show:
#   ERROR: could not open directory "pg_logical/snapshots": Permission denied
# (Bad ownership on /var/lib/postgresql/data — common if the volume was corrupted or copied.)
#
# WARNING: This deletes all data in the Docker volume `pgdata` for this compose project.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Stopping stack and removing Postgres volume (compose project volumes only)..."
docker compose down -v

echo "Starting Postgres fresh..."
docker compose up -d postgres

echo "Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d postgres >/dev/null 2>&1; then
    echo "Postgres is ready."
    echo ""
    echo "Next: apply Prisma schemas to the empty DB, e.g."
    echo "  npm run db:push:all"
    echo "  npm run db:seed -w @roadmap/portfolio-service   # if you use seed"
    exit 0
  fi
  sleep 1
done
echo "Postgres did not become ready in time; check: docker compose logs postgres"
exit 1
