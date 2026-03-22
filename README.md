# Roadmap Platform Starter Repo

Production-oriented starter monorepo for a roadmap management platform. **Everything lives at this repo root** (`apps/`, `services/`, `packages/`).

Product specs and Cursor prompts: **`spec:/docs/`** (and `spec:/CURSOR_PROMPTS.md`).

## What is included
- Next.js web app
- API gateway
- Portfolio service with Prisma schema and seed data
- Shared types package
- AI / Template / Integration / Worker service stubs
- Docker Compose for local development
- Cursor bootstrap instructions

## Suggested build order
1. `npm install` (npm **workspaces**; run from the repo root)
2. `docker compose up -d postgres redis` — Postgres is **published on host port 5433** by default (`POSTGRES_PORT` in `.env`) so it does not conflict with another Postgres on 5432. (Or use **`npm run stack:docker`** — only Postgres + Redis; see [Dev stack script](#dev-stack-script) below.)
3. Copy root `.env.example` → `.env`. Use **three** URLs (`PORTFOLIO_DATABASE_URL`, `TEMPLATE_DATABASE_URL`, `INTEGRATION_DATABASE_URL`) so each service owns a Postgres **schema** (`portfolio`, `template`, `integration`) and `prisma db push` cannot drop sibling tables. Connection URLs must use the same host port as `POSTGRES_PORT` (default `5433`).
4. Push schemas (order matters the first time):
   - `npm run db:push:all`  
   or manually: portfolio → template → integration `prisma db push` with those env vars set.
5. Start **portfolio** and **template** services, then seed: `npm run db:seed -w @roadmap/portfolio-service` (seed creates a template via template-service HTTP).
6. `npm run dev` (gateway, portfolio, template, integration, ai, worker, web — ensure Redis is up for import queue + worker). The web UI is at **http://localhost:3001** so port 3000 stays free for other apps. (Or **`npm run stack:start`** or **`npm start`** to bring up Docker and run `npm run dev` in one step.)

### Dev stack script

Run **from the repo root** (same directory as `package.json`). **Docker Desktop (or the Docker daemon) must be running** before `stack:start` / `npm start`.

| Command | What it does |
|--------|----------------|
| `npm run stack:start` or **`npm start`** | `docker compose up -d postgres redis`, then **`npm run dev`** in the foreground (Ctrl+C stops the Node dev processes; Postgres/Redis keep running). |
| `npm run stack:docker` | Only Postgres + Redis via Docker (no `npm run dev`). |
| `npm run stack:stop` | Frees dev ports used by Turbo (`scripts/free-dev-ports.sh`), then `docker compose stop`. |
| `npm run stack:stop:down` | Same port cleanup, then `docker compose down` (containers removed; named volumes are kept unless your compose file says otherwise). |
| `npm run stack:restart` | `stack:stop` (without `--down`) then `stack:start`. |
| `npm run stack:status` | `docker compose ps` plus listeners on the usual dev ports and the Postgres host port. |

**Environment:** `DEV_STACK_FOREGROUND=0 npm run stack:start` only starts Docker and exits (then run `npm run dev` yourself when ready).

**Shell:** `./scripts/dev-stack.sh <command>` is equivalent (e.g. `./scripts/dev-stack.sh start`). If you get “permission denied”, run `chmod +x scripts/dev-stack.sh` once.

### Next.js web — `Cannot find module './NNN.js'`

That comes from a **stale or partial** `apps/web/.next` (often after watcher/`EMFILE` issues on macOS). Stop the dev server, then either delete `apps/web/.next` and run `npm run dev -w @roadmap/web`, or run **`npm run dev:clean -w @roadmap/web`** (removes `.next` then starts dev). The web `dev` script sets `WATCHPACK_POLLING=true` to reduce broken incremental builds.

**Empty tables in the UI** usually means **api-gateway** (`http://localhost:4000`) is not running: the web app calls `NEXT_PUBLIC_API_BASE_URL` (default `4000`), not portfolio (`4100`) directly. Run `npm run dev` from the repo root or start `@roadmap/api-gateway` alongside `@roadmap/web`. List pages show an amber warning when the API is unreachable.

### Prisma

npm runs package **install scripts** by default, so Prisma engine postinstall steps run. Portfolio `build` / `typecheck` run `prisma generate` before `tsc`.

### Import spreadsheet data

Excel files under `spec:/Data/` (DCX + CET roadmaps) can be loaded into Postgres:

```bash
docker compose up -d postgres
npm run db:push:all
npm run import:xlsx -w @roadmap/portfolio-service
```

This creates workspace `excel-import` (slug) and roadmaps `2026-product-roadmap-dcx` and `2026-product-roadmap-cet-sales-marketing`. Re-running the import clears prior data in that workspace and re-imports.

## API surface
Contracts are documented in `spec:/docs/05-api-contracts.md`. The **gateway** (`http://localhost:4000`) exposes them under `/api/*` and proxies to **portfolio-service**, **template-service**, **integration-service**, and **ai-service**. OpenAPI: `http://localhost:4000/api/openapi.yaml` (source: `spec:/openapi/openapi.yaml`).

**Postman:** import `postman/Roadmap-Platform.postman_collection.json` (gateway + direct services in one file); optional `postman/environment/Local.postman_environment.json` — see `postman/README.md`.

## Current state
Templates and integrations are **separate services** with their own Prisma tables (`svc_*` in the `template` / `integration` schemas). Portfolio holds roadmaps/initiatives/themes/import batches in the `portfolio` schema. **Worker** runs BullMQ consumers for `import-workbook` and calls portfolio’s internal completion hook (extend to parse uploaded files). Use `REDIS_URL` + Redis for queues; optional `INTERNAL_API_KEY` for internal HTTP.

### Wipe local DB completely

```bash
npm run db:reset:local
```

Then start **template-service** (and **portfolio**) before `npm run db:seed -w @roadmap/portfolio-service`. For `import:xlsx`, having **template** and **integration** running improves workspace wipes (otherwise the script logs warnings and continues).
