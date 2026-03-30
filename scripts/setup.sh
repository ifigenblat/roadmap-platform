#!/usr/bin/env bash
# One-shot onboarding: .env, npm install, Postgres + Redis (Docker or local), Prisma push.
#
# Usage (repo root):
#   ./scripts/setup.sh                  # Docker Postgres (host port 5433) + Redis
#   ./scripts/setup.sh --local-postgres # Homebrew/host Postgres on 5432 + Redis in Docker
#   ./scripts/setup.sh --skip-docker    # Only install + db push (you manage Postgres/Redis)
#   ./scripts/setup.sh --no-install     # Skip npm install
#   ./scripts/setup.sh --skip-db-push   # Skip prisma db push
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USE_LOCAL_POSTGRES=0
SKIP_DOCKER=0
NO_INSTALL=0
SKIP_DB_PUSH=0
CREATED_ENV=0

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [options]

  -l, --local-postgres   New .env from .env.example tuned for host Postgres (5432).
                         Ignored if .env already exists (edit .env yourself).
      --skip-docker      Do not run docker compose (Postgres/Redis must already run).
      --no-install       Skip npm install.
      --skip-db-push     Skip npm run db:push:all.
  -h, --help             Show this help.

Defaults: copy .env.example → .env if missing, npm install, docker up (postgres+redis
or redis-only when LOCAL_POSTGRES=1), db:setup:local when LOCAL_POSTGRES=1, db:push:all.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -l | --local-postgres)
      USE_LOCAL_POSTGRES=1
      ;;
    --skip-docker)
      SKIP_DOCKER=1
      ;;
    --no-install)
      NO_INSTALL=1
      ;;
    --skip-db-push)
      SKIP_DB_PUSH=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

apply_local_postgres_env() {
  local f="$ROOT/.env"
  local tmp
  tmp="$(mktemp)"
  sed \
    -e 's/^# LOCAL_POSTGRES=1$/LOCAL_POSTGRES=1/' \
    -e 's/^POSTGRES_PORT=5433$/POSTGRES_PORT=5432/' \
    -e 's/localhost:5433/localhost:5432/g' \
    "$f" >"$tmp" && mv "$tmp" "$f"
}

ensure_env_file() {
  if [[ -f "$ROOT/.env" ]]; then
    return 0
  fi
  if [[ ! -f "$ROOT/.env.example" ]]; then
    echo "Error: missing .env.example at repo root." >&2
    exit 1
  fi
  cp "$ROOT/.env.example" "$ROOT/.env"
  CREATED_ENV=1
  echo "==> Created .env from .env.example"
  if [[ "$USE_LOCAL_POSTGRES" == "1" ]]; then
    apply_local_postgres_env
    echo "==> Tuned .env for local Postgres (LOCAL_POSTGRES=1, port 5432)"
  fi
}

require_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  cat >&2 <<'EOF'
Error: Docker is not available (daemon not reachable).

  • macOS/Windows: start Docker Desktop and retry.
  • Or re-run with --skip-docker if Postgres and Redis already run on this machine.
EOF
  exit 1
}

docker_db_services() {
  if [[ "${LOCAL_POSTGRES:-0}" == "1" ]]; then
    echo "redis"
  else
    echo "postgres redis"
  fi
}

wait_for_postgres_tcp() {
  local port="${POSTGRES_PORT:-5433}"
  local host="${POSTGRES_HOST:-127.0.0.1}"
  local i=0
  echo "==> Waiting for Postgres on ${host}:${port}..."
  while ! pg_isready -h "$host" -p "$port" >/dev/null 2>&1; do
    i=$((i + 1))
    if [[ $i -gt 90 ]]; then
      echo "Error: Postgres did not become ready on ${host}:${port} within 90s." >&2
      exit 1
    fi
    sleep 1
  done
  echo "    Postgres is accepting connections."
}

redis_port_open() {
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 6379 2>/dev/null
    return
  fi
  (echo >/dev/tcp/127.0.0.1/6379) 2>/dev/null
}

wait_for_redis_tcp() {
  local i=0
  echo "==> Waiting for Redis on 127.0.0.1:6379..."
  while ! redis_port_open; do
    i=$((i + 1))
    if [[ $i -gt 60 ]]; then
      echo "Error: Redis did not open port 6379 within 60s (start Docker redis or install Redis)." >&2
      exit 1
    fi
    sleep 1
  done
  echo "    Redis is accepting connections."
}

ensure_env_file

if [[ "$USE_LOCAL_POSTGRES" == "1" ]] && [[ "$CREATED_ENV" == "0" ]]; then
  echo "==> Note: .env already exists; not auto-editing. Set LOCAL_POSTGRES=1 and matching URLs if you use host Postgres."
fi

if [[ "$NO_INSTALL" == "0" ]]; then
  echo "==> npm install"
  npm install
else
  echo "==> Skipping npm install (--no-install)"
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

if [[ "$SKIP_DOCKER" == "0" ]]; then
  require_docker
  services="$(docker_db_services)"
  echo "==> docker compose up -d $services"
  # shellcheck disable=SC2086
  docker compose up -d $services
  docker compose ps
else
  echo "==> Skipping Docker (--skip-docker); ensure Postgres (port ${POSTGRES_PORT:-5433}) and Redis (6379) are up."
fi

needs_pg_wait=0
[[ "$SKIP_DB_PUSH" == "0" ]] && needs_pg_wait=1
[[ "${LOCAL_POSTGRES:-0}" == "1" ]] && needs_pg_wait=1
if [[ "$needs_pg_wait" == "1" ]]; then
  wait_for_postgres_tcp
fi

if [[ "$SKIP_DOCKER" == "0" ]]; then
  wait_for_redis_tcp
elif [[ "$SKIP_DB_PUSH" == "0" ]]; then
  echo "==> Checking Redis on 127.0.0.1:6379 (--skip-docker; best-effort)"
  if ! redis_port_open 2>/dev/null; then
    echo "    Warning: nothing listening on 6379 — worker/BullMQ needs Redis. Start it before npm run dev." >&2
  fi
fi

if [[ "${LOCAL_POSTGRES:-0}" == "1" ]]; then
  echo "==> Local Postgres: ensuring role + database (npm run db:setup:local)"
  npm run db:setup:local
fi

if [[ "$SKIP_DB_PUSH" == "0" ]]; then
  echo "==> Prisma: npm run db:push:all"
  npm run db:push:all
else
  echo "==> Skipped db push (--skip-db-push)"
fi

cat <<EOF

==> Setup finished.

Next (optional):
  • Seed portfolio DB:  npm run db:seed -w @roadmap/portfolio-service
  • Run the stack:      npm run dev
                        or  npm start   (Docker + turbo dev)

See README.md for details.
EOF
