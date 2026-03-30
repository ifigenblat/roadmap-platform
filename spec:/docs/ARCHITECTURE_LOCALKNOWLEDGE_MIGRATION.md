# LocalKnowledge-style architecture migration

This repo was refactored toward the layout and stack described in `CURSOR_NEW_PROJECT_ARCHITECTURE.md` (React SPA, Express microservices, shared Sequelize module, CommonJS gateway).

## Done (aligned with `CURSOR_NEW_PROJECT_ARCHITECTURE.md`)

- **`client/`** — Vite + React 18, **Axios** (`src/utils/api.js` + `lib/api.ts`), **React Router**, **Tailwind**, **`clsx` + `tailwind-merge`** (`src/utils/cn.js`). Route screens live under **`client/src/pages/`**. Entry: **`src/index.jsx`**. Dev server default port **3001**; proxies `/api` → gateway **4010**. Add **react-hook-form**, **zod**, etc., when a screen needs them.
- **`services/gateway/`** — **CommonJS** Express BFF: **`http-proxy-middleware`** (no global `express.json()` on proxied `/api`), **`helmet`**, **`express-rate-limit`**, optional **JWT** when `JWT_SECRET` + `JWT_ENFORCE_GATEWAY=1`. Local-only routes: OpenAPI file, import workbook (multer), merged **`/api/ai/status`**, augmented **`/api/ai/executive-summary`**.
- **`services/shared/postgres/`** — Sequelize models for the **integration** schema (`@roadmap/shared-postgres`). Used by **integration-service**.
- **`services/integration-service/`** — **JavaScript (CommonJS)** + Sequelize; Prisma removed. Zod schemas for Jira connect duplicated inline (keep in sync with `@roadmap/types`).

## Not migrated yet (intentional)

- **`portfolio-service`**, **`template-service`**, **`ai-service`**, **`worker`** — remain **TypeScript** + **Prisma** (or existing stack). A full **Sequelize-only** data layer per `CURSOR_NEW_PROJECT_ARCHITECTURE.md` §6 would replace these Prisma apps; that is a large, separate cutover (schemas, migrations, route parity). Until then, the gateway proxies to these services unchanged.
- **End-to-end JWT + login UI** — gateway can enforce JWT when env is set; the SPA does not ship auth screens yet (`JWT_ENFORCE_GATEWAY` should stay unset for local dev).
