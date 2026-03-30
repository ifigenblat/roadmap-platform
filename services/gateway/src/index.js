const { config } = require("dotenv");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { createProxyMiddleware } = require("http-proxy-middleware");

const rootEnv = path.resolve(process.cwd(), "../../.env");
const pkgEnv = path.resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const repoRoot = path.join(__dirname, "..", "..", "..");
const openApiPath = path.join(repoRoot, "spec:", "openapi", "openapi.yaml");

const portfolioBase = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4110";
const templateBase = process.env.TEMPLATE_SERVICE_URL || "http://localhost:4210";
const integrationBase = process.env.INTEGRATION_SERVICE_URL || "http://localhost:4410";
const aiBase = process.env.AI_SERVICE_URL || "http://localhost:4310";
const authBase = process.env.AUTH_SERVICE_URL || "http://localhost:4610";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));

/** CURSOR_AUTH_JWT_GUIDE: HS256 JWT; forward X-User-* to upstream. */
function shouldEnforceJwt() {
  return Boolean(process.env.JWT_SECRET?.trim()) && process.env.JWT_ENFORCE_GATEWAY === "1";
}

function isPublicAuthRoute(fullPath, method) {
  return (
    (fullPath === "/api/auth/login" && method === "POST") ||
    (fullPath === "/api/auth/register" && method === "POST") ||
    (fullPath === "/api/auth/forgot-password" && method === "POST") ||
    (fullPath === "/api/auth/reset-password" && method === "POST")
  );
}

function gatewayAuth(req, res, next) {
  const fullPath = req.originalUrl.split("?")[0];
  const method = req.method.toUpperCase();
  const secret = process.env.JWT_SECRET?.trim();

  if (!fullPath.startsWith("/api")) {
    return next();
  }

  if (fullPath === "/api/openapi.yaml") {
    return next();
  }

  const tryAttachUser = () => {
    const auth = req.headers.authorization;
    if (!secret || !auth?.startsWith("Bearer ")) return;
    try {
      req.user = jwt.verify(auth.slice(7), secret);
    } catch {
      /* invalid — ignore unless enforcing */
    }
  };

  if (!shouldEnforceJwt()) {
    tryAttachUser();
    return next();
  }

  if (isPublicAuthRoute(fullPath, method)) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    req.user = jwt.verify(auth.slice(7), secret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.use(gatewayAuth);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchUpstream(url, init) {
  const attempts = 25;
  const delayMs = 300;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  throw lastError;
}

function portfolioInternalHeaders() {
  const key = process.env.INTERNAL_API_KEY?.trim();
  return key ? { "x-internal-key": key } : {};
}

function forwardUserHeaders(req) {
  const u = req.user;
  if (!u || typeof u !== "object" || !u.id) return {};
  const out = { "X-User-Id": String(u.id) };
  if (u.email) out["X-User-Email"] = String(u.email);
  const rn = u.role?.name;
  if (rn) out["X-User-Role"] = String(rn).toLowerCase();
  return out;
}

async function fetchWorkspaceAiRuntime(workspaceId) {
  const url = `${portfolioBase}/internal/workspaces/${encodeURIComponent(workspaceId)}/ai-runtime`;
  try {
    const upstream = await fetchUpstream(url, { headers: portfolioInternalHeaders() });
    if (!upstream.ok) return null;
    const raw = await upstream.json();
    const provider = raw.provider === "gemini" ? "gemini" : "openai";
    const out = { provider };
    if (raw.model) out.model = raw.model;
    if (raw.geminiModel) out.geminiModel = raw.geminiModel;
    if (raw.maxTokens != null) out.maxTokens = raw.maxTokens;
    if (raw.temperature != null) out.temperature = raw.temperature;
    if (raw.openaiApiKey) out.openaiApiKey = raw.openaiApiKey;
    if (raw.geminiApiKey) out.geminiApiKey = raw.geminiApiKey;
    if (raw.openaiCompatibleBaseUrl) out.openaiCompatibleBaseUrl = raw.openaiCompatibleBaseUrl;
    if (raw.localOpenAiKind) out.localOpenAiKind = raw.localOpenAiKind;
    return out;
  } catch {
    return null;
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gateway" });
});

app.get("/api/openapi.yaml", (_req, res) => {
  try {
    const yaml = readFileSync(openApiPath, "utf8");
    res.type("application/yaml").send(yaml);
  } catch {
    res.status(404).send("OpenAPI spec not found");
  }
});

app.post("/api/imports/workbook", upload.single("file"), async (req, res) => {
  const form = new FormData();
  if (req.file) {
    const blob = new Blob([new Uint8Array(req.file.buffer)], {
      type: req.file.mimetype || "application/octet-stream",
    });
    form.append("file", blob, req.file.originalname || "workbook");
  }
  const ws = req.body?.workspaceId;
  if (typeof ws === "string" && ws.length > 0) {
    form.append("workspaceId", ws);
  }
  const roadmapId = req.body?.roadmapId;
  if (typeof roadmapId === "string" && roadmapId.length > 0) {
    form.append("roadmapId", roadmapId);
  }
  const roadmapName = req.body?.roadmapName;
  if (typeof roadmapName === "string" && roadmapName.length > 0) {
    form.append("roadmapName", roadmapName);
  }
  try {
    const upstream = await fetchUpstream(`${portfolioBase}/imports/workbook`, {
      method: "POST",
      body: form,
      headers: forwardUserHeaders(req),
    });
    const body = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") || "application/json")
      .send(body);
  } catch (error) {
    res.status(502).json({
      message: "Upstream upload failed for /imports/workbook",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/ai/status", async (req, res) => {
  const q = req.query.workspaceId;
  const workspaceId = typeof q === "string" ? q.trim() : "";

  let publicSettings = null;
  if (workspaceId) {
    try {
      const r = await fetchUpstream(
        `${portfolioBase}/workspaces/${encodeURIComponent(workspaceId)}/ai-settings`,
        {
          method: "GET",
          headers: { "content-type": "application/json", ...forwardUserHeaders(req) },
        }
      );
      if (r.ok) {
        publicSettings = await r.json();
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const upstream = await fetchUpstream(`${aiBase}/ai/status`, {
      method: "GET",
      headers: { "content-type": "application/json", ...forwardUserHeaders(req) },
    });
    const bodyText = await upstream.text();
    if (!upstream.ok) {
      res.status(upstream.status).type(upstream.headers.get("content-type") || "application/json").send(bodyText);
      return;
    }
    const baseStatus = JSON.parse(bodyText);
    const envConfigured = baseStatus.openaiConfigured;
    const envGemini = baseStatus.geminiConfigured;
    const workspaceHasKey = publicSettings?.hasApiKeyOverride ?? false;
    const workspaceHasGeminiKey = publicSettings?.hasGeminiApiKeyOverride ?? false;
    const workspaceLocalBase =
      typeof publicSettings?.openaiCompatibleBaseUrl === "string"
        ? publicSettings.openaiCompatibleBaseUrl.trim()
        : "";
    const wsProvider = publicSettings?.aiProvider === "gemini" ? "gemini" : "openai";
    const trimmedOpenai = publicSettings?.openaiModel?.trim();
    const trimmedGemini = publicSettings?.geminiModel?.trim();
    const effectiveModel =
      workspaceId && publicSettings
        ? wsProvider === "gemini"
          ? trimmedGemini?.length
            ? trimmedGemini
            : baseStatus.geminiModel
          : trimmedOpenai?.length
            ? trimmedOpenai
            : baseStatus.model
        : baseStatus.model;
    res.json({
      ...baseStatus,
      effectiveModel,
      aiProvider: publicSettings ? wsProvider : undefined,
      openaiConfigured: envConfigured || workspaceHasKey || Boolean(workspaceLocalBase.length > 0),
      geminiConfigured: envGemini || workspaceHasGeminiKey,
      workspaceId: workspaceId || undefined,
      workspaceHasApiKeyOverride: workspaceId ? workspaceHasKey : undefined,
      workspaceHasGeminiApiKeyOverride: workspaceId ? workspaceHasGeminiKey : undefined,
      workspaceOpenAiCompatibleBaseUrl:
        workspaceId && workspaceLocalBase.length > 0 ? workspaceLocalBase : undefined,
      localOpenAiKind: workspaceId ? publicSettings?.localOpenAiKind ?? null : undefined,
    });
  } catch (error) {
    res.status(502).json({
      message: "Upstream request failed for /ai/status",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/ai/executive-summary", express.json({ limit: "8mb" }), async (req, res) => {
  const body = req.body;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const outBody = { bundle: body.bundle };
  if (workspaceId) {
    const runtime = await fetchWorkspaceAiRuntime(workspaceId);
    if (runtime) outBody._aiRuntime = runtime;
  }
  try {
    const upstream = await fetchUpstream(`${aiBase}/ai/executive-summary`, {
      method: "POST",
      headers: { "content-type": "application/json", ...forwardUserHeaders(req) },
      body: JSON.stringify(outBody),
    });
    const respBody = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") || "application/json")
      .send(respBody);
  } catch (error) {
    res.status(502).json({
      message: "Upstream request failed for /ai/executive-summary",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * http-proxy-middleware forwards streaming bodies (CURSOR_NEW_PROJECT_ARCHITECTURE §4).
 * No global express.json() — JSON only on routes handled above.
 */
const apiProxy = createProxyMiddleware({
  changeOrigin: true,
  target: portfolioBase,
  /** Express mounts this proxy at `/api`, so upstream path is `/auth/login` — auth-service expects `/api/auth/login`. */
  pathRewrite: (path, req) => {
    const full = req.originalUrl.split("?")[0];
    if (full.startsWith("/api/auth")) {
      return `/api${path}`;
    }
    return path;
  },
  router: (req) => {
    const u = req.originalUrl.split("?")[0];
    if (u.startsWith("/api/auth")) return authBase;
    if (u.startsWith("/api/templates")) return templateBase;
    if (u.startsWith("/api/integrations") || u.startsWith("/api/external-links")) return integrationBase;
    if (u.startsWith("/api/ai")) return aiBase;
    return portfolioBase;
  },
  on: {
    proxyReq: (proxyReq, req) => {
      const auth = req.headers.authorization;
      if (auth) {
        proxyReq.setHeader("Authorization", auth);
      }
      const u = req.user;
      if (u && typeof u === "object" && u.id) {
        proxyReq.setHeader("X-User-Id", String(u.id));
        if (u.email) proxyReq.setHeader("X-User-Email", String(u.email));
        const rn = u.role?.name;
        if (rn) proxyReq.setHeader("X-User-Role", String(rn).toLowerCase());
      }
    },
  },
});

app.use("/api", apiLimiter, apiProxy);

const port = Number(process.env.PORT || 4010);
app.listen(port, () => console.log(`gateway listening on ${port}`));
