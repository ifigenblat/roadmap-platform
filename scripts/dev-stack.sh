#!/usr/bin/env bash
# Control local Docker (Postgres, Redis) + Node dev servers (turbo / npm run dev).
#
# Usage (from repo root):
#   ./scripts/dev-stack.sh start       # docker up, then run npm run dev (foreground; Ctrl+C stops Node only)
#   ./scripts/dev-stack.sh stop        # kill dev ports + docker compose stop
#   ./scripts/dev-stack.sh stop --down # same + docker compose down (containers removed)
#   ./scripts/dev-stack.sh restart     # stop then npm run dev (foreground)
#   ./scripts/dev-stack.sh status      # docker ps + listeners on dev ports
#   ./scripts/dev-stack.sh docker      # only: docker compose up -d postgres redis
#
# Environment:
#   DEV_STACK_FOREGROUND=0  # with `start`: only bring up Docker, print hint (no npm run dev)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORTS=(3001 4000 4100 4200 4300 4400 4500)

require_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  cat >&2 <<'EOF'
Error: Cannot connect to the Docker daemon.

  • macOS/Windows: open Docker Desktop and wait until it is fully running.
  • Linux: start the Docker service (e.g. sudo systemctl start docker).

Then retry:  npm run stack:start   or   npm start   or   ./scripts/dev-stack.sh start
EOF
  exit 1
}

free_node_ports() {
  bash "$ROOT/scripts/free-dev-ports.sh"
}

cmd_start() {
  require_docker
  echo "==> Docker: postgres + redis"
  docker compose up -d postgres redis
  docker compose ps postgres redis

  if [[ "${DEV_STACK_FOREGROUND:-1}" == "0" ]]; then
    echo ""
    echo "Docker is up. Start the app with: npm run dev"
    return 0
  fi

  echo ""
  echo "==> Monorepo: npm run dev (turbo). Press Ctrl+C to stop Node processes only."
  echo "    (Postgres/Redis keep running; use: $0 stop)"
  exec npm run dev
}

cmd_stop() {
  local down="${1:-}"
  free_node_ports
  echo ""
  if docker info >/dev/null 2>&1; then
    if [[ "$down" == "--down" ]]; then
      echo "==> docker compose down (removes containers; named volumes kept)"
      docker compose down
    else
      echo "==> docker compose stop (containers kept)"
      docker compose stop
    fi
    echo "Stopped."
  else
    echo "Docker is not running; skipped docker compose (dev ports were freed)."
  fi
}

cmd_restart() {
  cmd_stop ""
  echo ""
  cmd_start
}

cmd_status() {
  echo "==> Docker Compose"
  docker compose ps 2>/dev/null || echo "(docker compose failed — is Docker running?)"
  echo ""
  echo "==> Listeners (Node dev ports)"
  for p in "${PORTS[@]}"; do
    line=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)
    if [[ -n "$line" ]]; then
      echo "  $p: $line"
    else
      echo "  $p: (none)"
    fi
  done
  echo ""
  echo "==> Postgres host port (from compose)"
  pg="${POSTGRES_PORT:-5433}"
  line=$(lsof -nP -iTCP:"$pg" -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)
  if [[ -n "$line" ]]; then
    echo "  $pg: $line"
  else
    echo "  $pg: (none)"
  fi
}

cmd_docker() {
  require_docker
  docker compose up -d postgres redis
  docker compose ps postgres redis
  echo "Postgres: localhost:${POSTGRES_PORT:-5433}  Redis: localhost:6379"
}

usage() {
  cat <<'EOF'
Commands:
  start       Start postgres + redis, then run npm run dev (foreground).
              Set DEV_STACK_FOREGROUND=0 to only start Docker and exit.
  stop        Kill Node dev ports + docker compose stop.
  stop --down Same, then docker compose down (containers removed).
  restart     stop (without --down) then npm run dev.
  status      Show docker compose ps and listeners on dev ports.
  docker      Only: docker compose up -d postgres redis.
  help        Show this help.
EOF
}

case "${1:-}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop "${2:-}"
    ;;
  restart)
    cmd_restart
    ;;
  status)
    cmd_status
    ;;
  docker)
    cmd_docker
    ;;
  help|-h|--help|"")
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage
    exit 1
    ;;
esac
