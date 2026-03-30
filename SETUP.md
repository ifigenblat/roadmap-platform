# Setup guide

Single place to install dependencies and local databases for **Roadmap Platform**. For architecture and API details, see **[README.md](./README.md)** and **`spec:/docs/`**.

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **[Node.js LTS](https://nodejs.org/)** (includes **npm**) | Monorepo workspaces, Vite client, services |
| **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux), running | Postgres + Redis containers for local dev (unless you use host Postgres only) |
| **Git** | Clone this repo |
| **Git for Windows** or **WSL** (Windows only) | Several npm scripts invoke **`bash`** (`db:push:all`, `db:setup:local`, stack scripts) |

Optional: **`pg_isready`** / Postgres client tools (macOS: `brew install libpq`) — the bash setup script uses it to wait for Postgres; the PowerShell script uses TCP checks instead.

---

## One-command install

Run everything **from the repository root** (where `package.json` lives).

### macOS / Linux

```bash
npm run setup
```

Equivalent:

```bash
./scripts/setup-mac.sh
# or
bash scripts/setup.sh
```

**Host Postgres on port 5432** (e.g. Homebrew) instead of Docker Postgres:

```bash
npm run setup -- --local-postgres
```

**Help:**

```bash
./scripts/setup.sh --help
```

If scripts are not executable: `chmod +x scripts/setup.sh scripts/setup-mac.sh`

### Windows (PowerShell)

```powershell
npm run setup:windows
```

Equivalent:

```powershell
.\scripts\setup.ps1
```

**Host Postgres on 5432** (new `.env` only):

```powershell
.\scripts\setup.ps1 -LocalPostgres
```

---

## What `setup` does

1. Copies **`.env.example`** → **`.env`** if `.env` is missing (and optionally tunes it for host Postgres when you pass `--local-postgres` / `-LocalPostgres`).
2. Runs **`npm install`** at the repo root (all workspaces).
3. Starts **Docker Compose** services: **postgres + redis**, or **redis only** if `LOCAL_POSTGRES=1` in `.env`.
4. Waits until Postgres and Redis accept connections.
5. If `LOCAL_POSTGRES=1`, runs **`npm run db:setup:local`** (bash) to ensure the dev role and database exist.
6. Runs **`npm run db:push:all`** to apply Prisma schemas (portfolio → template → integration).

---

## After setup

| Step | Command |
|------|---------|
| Seed demo data (optional) | `npm run db:seed -w @roadmap/portfolio-service` |
| Run app + gateway + services | `npm run dev` or `npm start` (Docker + Turbo; see README) |
| Check health | `npm run verify:stack` |

**URLs (defaults):**

- Web UI: **http://localhost:3001/** (override with `VITE_DEV_PORT`)
- API gateway: **http://localhost:4010** (`/api/*`)

---

## Setup flags (manual / advanced)

### Bash (`scripts/setup.sh`)

| Flag | Meaning |
|------|---------|
| `--local-postgres` | New `.env` tuned for host Postgres **5432** + Redis in Docker |
| `--skip-docker` | Do not run Docker; you must supply Postgres + Redis yourself |
| `--no-install` | Skip `npm install` |
| `--skip-db-push` | Skip `npm run db:push:all` |

### PowerShell (`scripts/setup.ps1`)

| Parameter | Meaning |
|-----------|---------|
| `-LocalPostgres` | Same idea as `--local-postgres` for a newly created `.env` |
| `-SkipDocker` | Same as `--skip-docker` |
| `-NoInstall` | Skip `npm install` |
| `-SkipDbPush` | Skip `npm run db:push:all` |

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Docker errors | Start Docker Desktop / daemon; retry `npm run setup` or `docker compose up -d postgres redis` |
| `npm run setup` hangs on Postgres | Ensure the published port in **`.env`** matches Docker (**`POSTGRES_PORT`**, often **5433** for Docker Postgres) |
| Windows: `bash` not found | Install [Git for Windows](https://git-scm.com/download/win) or use WSL for bash-heavy scripts |
| Port already in use | `npm run stop:all` then start a single dev session (see README) |

For empty UI or API errors, see **README.md** (troubleshooting and gateway sections).
