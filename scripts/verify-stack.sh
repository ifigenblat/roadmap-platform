#!/usr/bin/env bash
# Quick health checks for local dev (run after `npm run dev` or `npm start`).
# Exits 0 if all required endpoints respond; 1 if any fail.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

GATEWAY="${GATEWAY_URL:-http://127.0.0.1:4010}"
PORTFOLIO="${PORTFOLIO_HEALTH_URL:-http://127.0.0.1:4110}"
TEMPLATE="${TEMPLATE_HEALTH_URL:-http://127.0.0.1:4210}"
INTEGRATION="${INTEGRATION_HEALTH_URL:-http://127.0.0.1:4410}"
AI="${AI_HEALTH_URL:-http://127.0.0.1:4310}"
WORKER="${WORKER_HEALTH_URL:-http://127.0.0.1:4510}"
AUTH="${AUTH_HEALTH_URL:-http://127.0.0.1:4610}"
CLIENT="${CLIENT_URL:-http://127.0.0.1:3001}"

fail=0

check_http() {
  local name=$1
  local url=$2
  if curl -sfS --connect-timeout 2 --max-time 5 "$url" >/dev/null; then
    echo "OK   $name  ($url)"
  else
    echo "FAIL $name  ($url)"
    fail=1
  fi
}

echo "==> Verifying stack (override base URLs with GATEWAY_URL, PORTFOLIO_HEALTH_URL, …)"
check_http "gateway" "$GATEWAY/health"
check_http "portfolio-service" "$PORTFOLIO/health"
check_http "template-service" "$TEMPLATE/health"
check_http "integration-service" "$INTEGRATION/health"
check_http "ai-service" "$AI/health"
check_http "worker" "$WORKER/health"
check_http "auth-service" "$AUTH/health"

if curl -sfS --connect-timeout 2 --max-time 3 -o /dev/null "$CLIENT/" 2>/dev/null; then
  echo "OK   vite-client  ($CLIENT/)"
else
  echo "WARN vite-client  ($CLIENT/) — not responding (is Vite running? try port 3001 with VITE_DEV_PORT)"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "All core services responded."
  exit 0
fi
echo "One or more services failed. Fix: Postgres + Redis (e.g. npm run stack:docker), .env URLs, npm run db:push:all. See README."
exit 1
