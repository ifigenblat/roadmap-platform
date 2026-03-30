#!/usr/bin/env bash
# Load root .env and run prisma db push for portfolio → template → integration.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi
: "${PORTFOLIO_DATABASE_URL:?Set PORTFOLIO_DATABASE_URL in .env (see .env.example)}"
: "${TEMPLATE_DATABASE_URL:?Set TEMPLATE_DATABASE_URL in .env}"
: "${INTEGRATION_DATABASE_URL:?Set INTEGRATION_DATABASE_URL in .env}"
: "${AUTH_DATABASE_URL:?Set AUTH_DATABASE_URL in .env (see .env.example)}"

npm exec -w @roadmap/portfolio-service -- prisma db push
npm exec -w @roadmap/template-service -- prisma db push
npm exec -w @roadmap/integration-service -- prisma db push
npm exec -w @roadmap/auth-service -- prisma db push
