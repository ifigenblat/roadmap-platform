# Cursor guide: AI provider settings (LocalKnowledge structure, local vs cloud theming, APIs)

Give this file to Cursor when building **AI provider configuration** in another project. Goal: **same page structure and look-and-feel** as LocalKnowledge (React, Tailwind, dark mode, cards, forms), while giving the **“runs locally”** path a **dedicated color theme** so it stays visually distinct from **cloud/remotel** options and matches your product’s idea of “local” (privacy, on-device).

Companion: root **`CURSOR_NEW_PROJECT_ARCHITECTURE.md`** (monorepo, gateway, shared patterns).

---

## 1. What you are building

- A **settings screen** (typically admin-only) where operators choose:
  - **Where AI runs**: *Locally* (no third-party API) vs *Cloud* (OpenAI-compatible HTTP API).
  - **Which backend**: e.g. Ollama vs LM Studio vs hosted OpenAI/Groq/Together/custom URL.
  - **Credentials** for cloud: API key (never echoed back in full), base URL, model id.
  - Optional: **processing limits** (chunk sizes, delays, max text) aligned with your AI service.
- **Runtime**: an **AI microservice** that reads the same persisted config and exposes **`GET /status`** and generation routes your app already uses.

LocalKnowledge reference UI: `client/src/pages/AISettings.js`. Reference backend wiring: `services/user-service/src/routes/userRoutes.js` (settings API), `services/ai-service/src/aiProcessor.js` (consumes config), `services/ai-service/src/routes/aiRoutes.js`.

---

## 2. Look and feel (match LocalKnowledge)

Reuse these UI conventions so the page feels like the same product family:

| Element | Pattern |
|--------|---------|
| Page shell | `max-w-4xl mx-auto`, title `text-3xl font-bold`, subtitle `text-gray-600 dark:text-gray-400` |
| Primary surface | `bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6` |
| Close / secondary | Icon button top-right (`X` from Lucide), `hover:bg-gray-100 dark:hover:bg-gray-700` |
| Form controls | Full-width on small screens; `max-w-xs` / `max-w-md` where appropriate; `focus:ring-2 focus:ring-*` |
| Primary submit | `bg-blue-600 hover:bg-blue-700` + Lucide `Save` icon (keep **primary actions** blue for consistency with the rest of the app) |
| Helper / install actions | Optional accent buttons (e.g. `bg-emerald-600` for “download”, `bg-blue-600` for “run”) as in the reference page |
| Collapsible sections | Chevron up/down, border-top separators |
| Code / commands | `pre` with `bg-gray-100 dark:bg-gray-900`, monospace, copy button |
| Toasts | `react-hot-toast` for save/errors |

Stack assumptions: **React 18**, **Tailwind**, **axios**, **lucide-react**, **React Router**, **Redux Toolkit** (optional but recommended for `aiStatus` after save).

---

## 3. Local vs cloud theming (“maintain local color and theme”)

The app should **not** look like two different products. Keep **global** typography, layout, cards, and **primary Save** styling aligned with the main app. Differentiate **only** the AI-provider subtrees using **semantic colors**:

### 3.1 Tailwind approach (recommended)

In `tailwind.config.js`, extend `theme.extend.colors` with **namespaced tokens** your project owns, for example:

```js
// Example only — adjust hex/hues to your brand
colors: {
  'ai-local': {
    50: '...', 100: '...', /* … */
    DEFAULT: '...',        // e.g. emerald/teal — “runs on this machine”
    foreground: '...',
    muted: '...',
    border: '...',
    ring: '...',
  },
  'ai-cloud': {
    DEFAULT: '...',        // e.g. violet/indigo — “remote API”
    foreground: '...',
    muted: '...',
    border: '...',
    ring: '...',
  },
}
```

**Usage rules for Cursor:**

1. When **`runLocation === 'local'`** (or equivalent):
   - Wrap the **service dropdown + instruction blurb + install panels** in a container with:
     - `border-l-4 border-ai-local` or `ring-1 ring-ai-local/30`
     - Optional very light wash: `bg-ai-local/5 dark:bg-ai-local/10`
   - Use **`focus:ring-ai-local`** on selects/inputs **inside** that block only.
   - Badges/labels like “No data sent out” → `text-ai-local` / `bg-ai-local/15`.

2. When **`runLocation === 'cloud'`**:
   - Same layout, but swap to **`ai-cloud`** tokens and “Remote API” copy.

3. **Shared** fields (API key, URL, model) inherit the **active** branch’s ring/border so the form visually matches the selected mode.

4. Do **not** recolor the entire page; only the **AI configuration region** and its immediate callouts.

### 3.2 CSS variables (alternative)

If you prefer variables: define `--color-ai-local-*` and `--color-ai-cloud-*` on `:root` / `.dark`, then reference them in Tailwind via `rgb(var(--...) / <alpha-value>)` or use arbitrary values `border-[color:var(--ai-local-border)]`.

### 3.3 Content cues

- **Local**: emphasize privacy, offline, LAN, “this machine”.
- **Cloud**: emphasize API key security, billing, rate limits.

---

## 4. Frontend behavior (mirror reference logic)

### 4.1 State model

- **`runLocation`**: `'local' | 'cloud'`.
- **`service`**: concrete provider id (e.g. `ollama`, `lmstudio`, `openai`, `groq`, `custom`).
- **Presets map**: default `baseUrl` + `model` per provider (like `CLOUD_PROVIDER_PRESETS` in reference).
- **`hasApiKey` / masked key**: load from API; never store full key in Redux; clear password input after successful save.

### 4.2 Encode/decode saved shape

The API persists a **compact** shape; the UI expands it:

- **Local + Ollama**: `aiProvider: 'ollama'`, `cloudProvider` may be a placeholder for legacy UI.
- **Local + OpenAI-compatible URL** (LM Studio, LocalAI, llama.cpp): in LocalKnowledge this is stored as `aiProvider: 'openai'` with `cloudProvider` set to `lmstudio` | `localai` | `llamacpp` and `cloudApiUrl` / `cloudModel` pointing at localhost — **no API key** when not required.

Implement the same mapping functions as in `AISettings.js` so the page round-trips correctly.

### 4.3 After save

Dispatch a thunk like **`checkAIStatusAsync`** hitting **`GET /api/ai/status`** so Upload / Knowledge / modals show the correct provider label (see `getAIDisplayName` in `client/src/utils/aiUtils.js`).

### 4.4 Authorization

Restrict the page to **superadmin** (or your equivalent). Reference: `isSuperAdmin` in `client/src/utils/permissions.js`.

### 4.5 Optional: admin “run setup”

LocalKnowledge exposes **`POST /api/admin/run-local-ai-setup`** with `{ action, port? }` for scripted installs. Replicate only if your deployment allows **controlled** execution from the API; otherwise document manual commands in an expandable section (same UX as reference).

---

## 5. API: user / config service

### 5.1 Endpoints (behind gateway)

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| `GET` | `/api/users/settings` | Authenticated user | Load provider + limits; **no** raw `cloudApiKey` |
| `PUT` | `/api/users/settings` | **Superadmin only** | Persist provider, optional new API key, numeric limits |

Gateway must forward identity headers to the user service, e.g. **`X-User-Role`** (lowercase value `superadmin` in LocalKnowledge). JWT is verified at the gateway; microservice trusts forwarded headers only from the gateway network.

### 5.2 Response shape (GET / sanitized)

Include at minimum:

- `aiProvider`: `'ollama' | 'openai'`
- `cloudProvider`: string enum (e.g. `openai`, `groq`, `together`, `lmstudio`, `localai`, `llamacpp`, `custom`)
- `cloudApiUrl`, `cloudModel` (strings)
- `hasApiKey` (boolean), `cloudApiKeyMasked` (e.g. `••••••••` + last 4)
- Processing fields your AI stack needs: e.g. `maxExtractedTextChars`, `aiChunkChars`, `aiChunkDelayMs`, `aiMaxTextLength`, `ollamaChunkChars`, `knowledgeTopK`

### 5.3 PUT body (superadmin)

Accept the same fields the UI sends; validate ranges; on missing new key, **preserve** existing stored key.

### 5.4 Persistence (LocalKnowledge pattern)

- JSON file under **`services/config/settings.json`** (path from `CONFIG_PATH` env).
- **user-service** reads/writes via `userRoutes.js`.
- **ai-service** reads the **same file** with a **short TTL cache** and **`invalidateSettingsCache()`** on `/api/ai/status` so saves take effect quickly.

In a greenfield project you may use Postgres instead, but then **both** the “settings API” owner and **ai-service** must agree on one source (DB table, Redis, or shared volume).

---

## 6. API: AI service

### 6.1 Routes to implement or proxy

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/ai/status` | Provider, model, `enabled`, `available`, human-readable `error` |
| `POST` | `/api/ai/generate-cards` (or your namespaced path) | Chunked generation |
| `POST` | `/api/ai/regenerate` | Snippet → card JSON |
| … | Knowledge embed/ask | If your product has RAG |

Mount routes so the gateway can forward **`/api/ai/*`** unchanged.

### 6.2 Config resolution order (recommended)

1. Parsed **`settings.json`** (from admin UI).
2. **Environment variables** as fallback (`OLLAMA_*`, `OPENAI_*`, etc.).
3. Optional: feature flags like `OLLAMA_ENABLED=true`.

### 6.3 Status payload (conceptual)

Return fields the client can use for labels:

- `provider`: `'ollama' | 'openai'` (or extend)
- `model`, `cloudLabel` (e.g. “Groq”)
- `enabled`, `available`, `error`

---

## 7. Security checklist

- Never return **full** API keys from `GET /settings`.
- **PUT /settings**: enforce role at gateway **and** service.
- Rate-limit public auth routes; keep AI routes authenticated if they cost money or compute.
- If you add **admin run scripts**, sandbox arguments, use timeouts, and reject arbitrary shell.

---

## 8. Implementation order for Cursor

1. Add **`tailwind` semantic colors** `ai-local` / `ai-cloud` and apply to the AI settings panel only.
2. Implement **`GET/PUT /api/.../settings`** with masking and superadmin guard + gateway headers.
3. Persist to **shared** store (file or DB) readable by **ai-service**.
4. Implement **`GET /api/ai/status`** + cache invalidation; wire **Redux** refresh on save.
5. Port the **page structure** from `AISettings.js` (forms, collapsibles, optional install section).
6. Align **defaults and maxima** for processing fields between client and server validation.

---

## 9. Quick reference: files in LocalKnowledge

| Concern | Path |
|---------|------|
| AI settings page | `client/src/pages/AISettings.js` |
| AI display name helper | `client/src/utils/aiUtils.js` |
| AI status thunk | `client/src/store/slices/cardSlice.js` (`checkAIStatusAsync`) |
| Settings HTTP API | `services/user-service/src/routes/userRoutes.js` |
| AI reads settings + calls providers | `services/ai-service/src/aiProcessor.js` |
| AI HTTP routes | `services/ai-service/src/routes/aiRoutes.js` |
| Gateway user headers | `services/gateway/index.js` (`X-User-Role`, etc.) |

---

*This guide is meant to be copied or `@`-referenced in Cursor for a **different** codebase while staying consistent with LocalKnowledge patterns.*
