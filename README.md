# Roadmap Platform

Production-oriented starter monorepo for **Roadmap Platform**. **Everything lives at this repo root** (`client/`, `services/`, `packages/`).

Product specs and Cursor prompts: **`spec:/docs/`** (and `spec:/CURSOR_PROMPTS.md`). Architecture migration notes: **`spec:/docs/ARCHITECTURE_LOCALKNOWLEDGE_MIGRATION.md`**.

## What is included
- **Vite + React** SPA (`client/`) — Axios, React Router, Tailwind; route screens under `src/pages/` (dev port **3001**, proxies `/api` → gateway **4010**; override with `VITE_DEV_PORT`)
- **API gateway** (`services/gateway/`) — Express **CommonJS** BFF
- Portfolio service (TypeScript + Prisma)
- Shared types package (`@roadmap/types`)
- **Shared Sequelize** module for integration data (`@roadmap/shared-postgres`)
- AI / Template / Integration / Worker services
- Docker Compose for local development
- Cursor bootstrap instructions

The web app is the **Vite + React** SPA under **`client/`** only (no Next.js in this repo).

### First-time install (macOS / Linux vs Windows)

Full step-by-step guide: **[SETUP.md](./SETUP.md)**.

**Prerequisites:** [Node.js LTS](https://nodejs.org/) (includes **npm**), and **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux) running when you use containerized Postgres/Redis.

| Platform | Command | Notes |
|----------|---------|--------|
| **macOS / Linux** | **`npm run setup`** or **`./scripts/setup-mac.sh`** | Same behavior as **`bash scripts/setup.sh`**. Host Postgres on 5432: **`npm run setup -- --local-postgres`**. Help: **`./scripts/setup.sh --help`**. If needed: **`chmod +x scripts/setup-mac.sh scripts/setup.sh`**. |
| **Windows** | **`npm run setup:windows`** or **`.\scripts\setup.ps1`** in PowerShell | Creates `.env`, **`npm install`**, **`docker compose up`**, **`npm run db:push:all`**. Flags: **`-LocalPostgres`**, **`-SkipDocker`**, **`-NoInstall`**, **`-SkipDbPush`**. Many npm scripts call **`bash`** (e.g. **`db:push:all`**, **`db:setup:local`**) — install **[Git for Windows](https://git-scm.com/download/win)** so `bash` is on your `PATH`, or run those commands from **WSL**. |

After setup, continue with the steps below (seed, **`npm run dev`**, etc.).

## Suggested build order
**Quick path (new machine):** use the table above, or from the repo root run **`npm run setup`** — creates `.env` from `.env.example` if missing, **`npm install`**, starts Postgres + Redis via Docker (or Redis only when `LOCAL_POSTGRES=1` in `.env`), runs local DB bootstrap when needed, then **`npm run db:push:all`**. Use **`npm run setup -- --local-postgres`** on first run to generate a host-Postgres-oriented `.env` (port 5432). See **`./scripts/setup.sh --help`** for flags (`--skip-docker`, `--no-install`, etc.).

1. `npm install` (npm **workspaces**; run from the repo root)
2. **Postgres + Redis**
   - **Local Postgres (e.g. Homebrew):** set `LOCAL_POSTGRES=1`, `POSTGRES_PORT=5432`, and use `:5432` in all DB URLs in root `.env` (see `.env.example`). Run **`npm run db:setup:local`** once to ensure the `postgres` role and `roadmap_platform` database exist, then bring up **Redis only**: `docker compose up -d redis` or **`npm run stack:docker`** (respects `LOCAL_POSTGRES` in `.env`).
   - **Docker Postgres:** `docker compose up -d postgres redis` — Postgres is **published on host port 5433** by default (`POSTGRES_PORT` in `.env`) so it does not conflict with another Postgres on 5432. (Or **`npm run stack:docker`** with `LOCAL_POSTGRES` unset.)
3. Copy root `.env.example` → `.env` if you have not already. Use **three** URLs (`PORTFOLIO_DATABASE_URL`, `TEMPLATE_DATABASE_URL`, `INTEGRATION_DATABASE_URL`) so each service owns a Postgres **schema** (`portfolio`, `template`, `integration`) and `prisma db push` cannot drop sibling tables. Connection URLs must use the same host port as `POSTGRES_PORT`.
4. Push schemas (order matters the first time):
   - `npm run db:push:all`  
   or manually: portfolio → template → integration `prisma db push` with those env vars set. (Integration DDL is applied via Prisma; **runtime** uses Sequelize — see migration doc.)
5. Start **portfolio** and **template** services, then seed: `npm run db:seed -w @roadmap/portfolio-service` (seed creates a template via template-service HTTP).
6. `npm run dev` (gateway, portfolio, template, integration, ai, worker, **client** — Redis is used by the **worker** for other BullMQ jobs; **Imports** `.xlsx` uploads are processed **synchronously** in portfolio-service). The SPA is at **http://localhost:3001** (default; set `VITE_DEV_PORT` to change).

**Dev startup order:** Turbo runs all `dev` tasks in parallel. The **gateway** starts immediately and proxies to upstream services as they become ready (brief **502**s are normal for a few seconds while portfolio/template/integration/ai bind). After services are up, run **`npm run verify:stack`** to confirm **/health** on each port. **Docker Desktop** must be running before `npm run setup` / `stack:docker` when you use containerized Postgres/Redis.

### Dev stack script

Run **from the repo root** (same directory as `package.json`). **Docker Desktop (or the Docker daemon) must be running** before `stack:start` / `npm start`.

**Command aliases (same behavior, pick one naming style):**

| Intent | npm | Shell (equivalent) |
|--------|-----|---------------------|
| **Full start** — Docker then Turbo (`npm run dev`) | `npm start`, `npm run stack:start`, **`npm run start:all`** | `./scripts/dev-stack.sh start`, **`./scripts/start-all.sh`** |
| **Stop** — free dev ports + `docker compose stop` | `npm run stack:stop`, **`npm run stop:all`** | `./scripts/dev-stack.sh stop`, **`./scripts/stop-all.sh`** |
| **Stop + remove containers** | `npm run stack:stop:down` or **`npm run stop:all -- --down`** | `./scripts/dev-stack.sh stop --down`, **`./scripts/stop-all.sh --down`** |
| **Restart** — stop (no `--down`) then full start | `npm run stack:restart`, **`npm run restart:all`** | `./scripts/dev-stack.sh restart`, **`./scripts/restart-all.sh`** |

All of the above delegate to **`scripts/dev-stack.sh`**. The **`*-all`** scripts are thin wrappers so you can say “start all / stop all / restart all” from npm or the shell without remembering `stack:*` names.

| Command | What it does |
|--------|----------------|
| `npm run stack:start` or **`npm start`** or **`npm run start:all`** | `docker compose up -d` for **postgres + redis**, or **redis only** if `LOCAL_POSTGRES=1` in `.env`, then **`npm run dev`** in the foreground (Ctrl+C stops the Node dev processes; containers keep running). |
| `npm run stack:docker` | Postgres + Redis via Docker, or Redis only when `LOCAL_POSTGRES=1` (no `npm run dev`). |
| `npm run setup` | First-time machine setup: `.env`, `npm install`, Docker Postgres+Redis (or Redis-only if `LOCAL_POSTGRES=1`), `db:setup:local` when local Postgres, `db:push:all`. Flags: `npm run setup -- --help`. |
| `npm run db:setup:local` | Ensure local (non-Docker) role + database exist (`scripts/setup-local-postgres.sh`). |
| `npm run stack:status` | `docker compose ps` plus listeners on the usual dev ports and the Postgres host port. |
| `npm run verify:stack` | After `npm run dev`, curls **`/health`** on gateway (4010), portfolio, template, integration, ai, worker; warns if Vite (3001) is down. |

**Environment:** `DEV_STACK_FOREGROUND=0 npm run stack:start` only starts Docker and exits (then run `npm run dev` yourself when ready).

**Shell permissions:** If you get “permission denied” on a script, run once: `chmod +x scripts/dev-stack.sh scripts/start-all.sh scripts/stop-all.sh scripts/restart-all.sh`.

### Troubleshooting (clean start)

| Issue | What to do |
|--------|------------|
| **`EADDRINUSE`** on 3001, 4010, 4110, 4210, etc. | Only one Turbo **`npm run dev`** should run at a time. Stop the other terminal or run **`npm run stop:all`** (or `npm run stack:stop`) to kill listeners on the dev ports, then start again with **`npm run start:all`** / **`npm start`**. |
| **Blank or white browser page** | Open DevTools **Console** for React/runtime errors. If the shell (sidebar/header) never appears, a client crash is likely—fix duplicate dev processes (above) and refresh. If the layout loads but lists are empty, see **Empty lists in the UI** (paragraph after this table). |
| `npm run setup` hangs on Postgres | Install a Postgres client with **`pg_isready`** (e.g. macOS: `brew install libpq` and follow the formula’s “PATH” hint), or ensure Docker Postgres is up and **`POSTGRES_PORT`** in `.env` matches the published port. |
| `docker compose failed — is Docker running?` | Start **Docker Desktop** (or the Linux daemon), then `npm run stack:docker` or re-run **`npm run setup`**. |
| Services exit on DB errors | Run **`npm run db:push:all`** with valid **`PORTFOLIO_DATABASE_URL`**, **`TEMPLATE_DATABASE_URL`**, **`INTEGRATION_DATABASE_URL`** (same host/port as Postgres). |
| Worker / BullMQ errors | Ensure **Redis** is listening on **`REDIS_URL`** (default `redis://127.0.0.1:6379`). Start Redis: **`npm run stack:docker`** or `docker compose up -d redis`. |
| Not sure anything is healthy | With **`npm run dev`** running, execute **`npm run verify:stack`** (checks each service **`/health`**). |

**Empty lists in the UI** (layout visible, grids empty or warnings): usually the **gateway** (`http://localhost:4010`) is not running or returned an error — the SPA calls **`/api/*`** (proxied from **3001** to **4010**). Run **`npm run dev`** or **`npm run start:all`** from the repo root. If you see **502** from the gateway, portfolio (4110) or another upstream may be down — check Turbo logs, Postgres/Redis, and **`npm run stack:status`**.

### Prisma

npm runs package **install scripts** by default, so Prisma engine postinstall steps run. Portfolio `build` / `typecheck` run `prisma generate` before `tsc`. Integration-service uses Prisma **only** for `db push` (DDL); the app uses Sequelize.

### Import spreadsheet data

Excel files under `spec:/Data/` (DCX + CET roadmaps) can be loaded into Postgres. Prefer filenames like **2026 Roadmap Platform** (see `import-xlsx.ts`); the importer still accepts legacy **Project** / **Product** workbook titles if your files keep those names.

```bash
# Postgres running (Docker: docker compose up -d postgres — or local Homebrew with LOCAL_POSTGRES=1)
npm run db:push:all
npm run import:xlsx -w @roadmap/portfolio-service
```

This creates workspace `excel-import` (slug) and roadmaps `2026-roadmap-platform-dcx` and `2026-roadmap-platform-cet-sales-marketing`. Re-running the import clears prior data in that workspace and re-imports.

## API surface
Contracts are documented in `spec:/docs/05-api-contracts.md`. The **gateway** (`http://localhost:4010`) exposes them under `/api/*` and proxies to **portfolio-service**, **template-service**, **integration-service**, and **ai-service**. OpenAPI: `http://localhost:4010/api/openapi.yaml` (source: `spec:/openapi/openapi.yaml`).

**Postman:** import `postman/Roadmap-Platform.postman_collection.json` (gateway + direct services in one file); optional `postman/environment/Local.postman_environment.json` — see `postman/README.md`.

## Current state
Templates and integrations are **separate services** with their own tables (`svc_*` in the `template` / `integration` schemas). Portfolio holds roadmaps/initiatives/themes/import batches in the `portfolio` schema. **Worker** runs BullMQ (`import-workbook` queue is available for future/async use; the **Imports** UI calls portfolio directly so uploads complete without the worker). Use `REDIS_URL` + Redis for the worker; optional `INTERNAL_API_KEY` for internal HTTP.

### Wipe local DB completely

```bash
npm run db:reset:local
```

Then start **template-service** (and **portfolio**) before `npm run db:seed -w @roadmap/portfolio-service`. For `import:xlsx`, having **template** and **integration** running improves workspace wipes (otherwise the script logs warnings and continues).
