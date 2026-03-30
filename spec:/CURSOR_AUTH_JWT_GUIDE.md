# Cursor guide: Authentication & JWT (LocalKnowledge token mechanism)

Use this document when implementing **authentication in a new project** so it matches **LocalKnowledge**: same **JWT shape**, **header usage**, **gateway validation**, **client `localStorage` contract**, and **downstream identity headers**.

Companion files: **`CURSOR_NEW_PROJECT_ARCHITECTURE.md`**, **`CURSOR_AI_PROVIDER_SETTINGS_GUIDE.md`**.

---

## 1. Model in one paragraph

- **auth-service** issues **HS256 JWTs** after **bcrypt** password verification. The **same `JWT_SECRET`** is used by the **API gateway** to validate tokens on protected routes **before** proxying to microservices.
- The **browser** stores the raw token under **`localStorage` key `token`** and sends **`Authorization: Bearer <token>`** on API calls.
- The gateway decodes the JWT, attaches **`req.user`**, and forwards **`X-User-Id`**, **`X-User-Email`**, and **`X-User-Role`** (role **name**, lowercase checks in services) to backend services.
- Microservices **must not** trust client-supplied user ids in JSON bodies for authorization; they should use **gateway-injected headers** (or re-validate the JWT if exposed directly).

---

## 2. JWT library and signing

| Item | Value |
|------|--------|
| Library | **`jsonwebtoken`** (`jwt.sign` / `jwt.verify`) |
| Algorithm | Default **HS256** (symmetric) |
| Secret | **`process.env.JWT_SECRET`** — **identical** on **gateway** and **auth-service** |
| Expiration | **`expiresIn: '7d'`** (seven days) |

Reference implementation: `services/auth-service/src/services/AuthService.js` (`generateToken`).

---

## 3. JWT payload (claims) shape

The signed payload **is the “session”** the UI expects on `user`. Include at least:

```json
{
  "id": "<user uuid or id>",
  "name": "<display name>",
  "email": "<email>",
  "role": {
    "id": "<role id>",
    "name": "<machine role name, e.g. user | admin | superadmin>",
    "displayName": "<human label>",
    "permissions": { ... }
  },
  "mustChangePassword": false
}
```

Notes:

- Use **`id`** (not only `_id`) for consistency with the client and gateway headers.
- **`role.name`** is what the gateway forwards as **`X-User-Role`** and what services compare (e.g. `superadmin` for settings).
- **`mustChangePassword`**: optional first-login flow; client reads it from user object.

---

## 4. Password hashing

| Item | Value |
|------|--------|
| Library | **`bcryptjs`** |
| Salt | **`bcrypt.genSalt(10)`** then **`bcrypt.hash(password, salt)`** |
| Compare | **`bcrypt.compare(plain, hashed)`** |

Never store or log plaintext passwords.

---

## 5. API gateway behavior

### 5.1 Validate middleware (concept)

1. Read **`Authorization`** header, strip **`Bearer `** prefix.
2. If missing → **401** `{ error: 'No token provided' }`.
3. **`jwt.verify(token, JWT_SECRET)`** → assign **`req.user = decoded`**.
4. On failure → **401** `{ error: 'Invalid token' }`.

Reference: `services/gateway/index.js` (`validateToken`).

### 5.2 Do not break proxied bodies

Do **not** mount **`express.json()`** globally on the gateway if it proxies **POST/PUT** with bodies; that can **consume the stream** and empty proxied requests. Validate JWT in middleware without reading the body for proxied routes.

### 5.3 Public vs protected `/api/auth/*`

Mount **`/api/auth`** so that **login, register, forgot-password, reset-password** (and optionally **`/validate`**) are proxied **without** JWT. **All other** `/api/auth/*` routes (e.g. **`/me`**, **`/profile`**, **`/password`**) require a valid JWT **at the gateway**, then proxy to auth-service.

Reference pattern: `services/gateway/index.js` (`publicPaths` for `/api/auth`).

### 5.4 Headers to downstream services

On each proxied request, when **`req.user`** exists:

| Header | Source |
|--------|--------|
| **`X-User-Id`** | `req.user.id` |
| **`X-User-Email`** | `req.user.email` |
| **`X-User-Role`** | `req.user.role?.name` (if present) |

Reference: `onProxyReq` in `services/gateway/index.js`.

Services use these for **authorization** (e.g. user-service `PUT /settings` checks **`X-User-Role === 'superadmin'`**).

---

## 6. Auth service responsibilities

### 6.1 Endpoints to implement (match client expectations)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/auth/register` | Public | Create user; return **`{ token, user }`** |
| `POST` | `/api/auth/login` | Public | Validate password; return **`{ token, user }`** |
| `GET` | `/api/auth/validate` | Bearer | Optional: **`{ valid: true, user }`** via **`AuthService.validateToken`** |
| `GET` | `/api/auth/me` | Bearer | **Current user** (prefer **reload from DB** + role, same shape as `formatUserForJWT`) — used by **`loadUser`** thunk |
| `PUT` | `/api/auth/profile` | Bearer | Update name/email; return updated **user** object |
| `PUT` | `/api/auth/password` | Bearer | Body: **`currentPassword`**, **`newPassword`**; use **`X-User-Id`** from gateway for subject |
| `POST` | `/api/auth/forgot-password` | Public | Start reset flow (opaque response) |
| `POST` | `/api/auth/reset-password` | Public | Body: **`token`**, **`newPassword`** |

**`validateToken(token)`** pattern (reference `AuthService.js`): verify JWT with **`jwt.verify`**, then **load user from DB by `decoded.id`** and return **`formatUserForJWT(user)`** so role changes and disabled users are reflected.

### 6.2 Login / register response

Both return:

```json
{
  "token": "<jwt>",
  "user": { "id", "name", "email", "role", "mustChangePassword" }
}
```

`user` must match **`formatUserForJWT`** (no password hash).

---

## 7. Client (React + Redux) contract

Reference: `client/src/store/slices/authSlice.js`.

| Behavior | Detail |
|----------|--------|
| Storage | **`localStorage.setItem('token', token)`** on login/register |
| Clear | **`localStorage.removeItem('token')`** on logout or failed **`loadUser`** (401) |
| Header | **`Authorization: Bearer ${localStorage.getItem('token')}`** |
| Bootstrap | On app load, if **`token`** exists, dispatch **`loadUser`** → **`GET /api/auth/me`** |
| State | Redux: **`token`**, **`user`**, **`isAuthenticated`**, **`mustChangePassword`**, **`loading`**, **`error`** |

Axios calls use **relative URLs** (e.g. `/api/auth/login`) with CRA **`proxy`** to the gateway in development.

---

## 8. Password reset tokens (email flow)

LocalKnowledge pattern (reference `AuthService.requestPasswordReset`):

1. Generate **raw** token: **`crypto.randomBytes(32).toString('hex')`** (64 hex chars).
2. Store **only** **`sha256(raw)`** in DB with **expiry** (e.g. 1 hour).
3. Send **raw** token in email link to client (e.g. `/reset-password?token=...`).
4. **`POST /api/auth/reset-password`** validates length/format of raw token, hashes, looks up user, then sets new **bcrypt** password.

Do not leak whether an email exists in production responses.

---

## 9. Security checklist

- [ ] **`JWT_SECRET`** long, random in production; **never** commit real secrets.
- [ ] Gateway and auth-service share **exactly** the same secret.
- [ ] HTTPS in production; tokens in **`localStorage`** are vulnerable to XSS — keep CSP and dependencies patched.
- [ ] Rate-limit **`/login`**, **`/register`**, **`/forgot-password`** (e.g. **`express-rate-limit`** on gateway or auth-service).
- [ ] Microservices behind gateway: **trust `X-*` headers only from the gateway** (private network), not from the public internet.
- [ ] Optionally shorten JWT TTL or add refresh tokens in a greenfield app; LocalKnowledge uses **7d** opaque tokens.

---

## 10. Reference paths in this repo

| Topic | Path |
|------|------|
| JWT generation / validation / bcrypt | `services/auth-service/src/services/AuthService.js` |
| Auth HTTP routes | `services/auth-service/src/routes/authRoutes.js` |
| Gateway JWT + proxy + auth public paths | `services/gateway/index.js` |
| Client auth slice | `client/src/store/slices/authSlice.js` |

---

## 11. Implementation order for Cursor

1. **`JWT_SECRET`** in env; implement **`generateToken`** / **`formatUserForJWT`** / **`validateToken`**.
2. **`POST /login`** and **`POST /register`** returning **`{ token, user }`**.
3. **`GET /api/auth/me`** returning DB-backed user (for **`loadUser`**).
4. Gateway **`validateToken`** and **`/api/auth`** public path list; forward **`X-User-*`** on all protected proxies.
5. **`PUT /api/auth/profile`** and **`PUT /api/auth/password`** with **`X-User-Id`** from gateway.
6. Client Redux + **`localStorage`** + protected routes.

---

*This guide describes the **LocalKnowledge** JWT and gateway pattern so another codebase can replicate it faithfully.*
