import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const openApiPath = join(repoRoot, "spec:", "openapi", "openapi.yaml");

const portfolioBase = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4100";
const templateBase = process.env.TEMPLATE_SERVICE_URL || "http://localhost:4200";
const integrationBase = process.env.INTEGRATION_SERVICE_URL || "http://localhost:4400";
const aiBase = process.env.AI_SERVICE_URL || "http://localhost:4300";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api-gateway" });
});

app.get("/api/openapi.yaml", (_req, res) => {
  try {
    const yaml = readFileSync(openApiPath, "utf8");
    res.type("application/yaml").send(yaml);
  } catch {
    res.status(404).send("OpenAPI spec not found");
  }
});

function withQuery(path: string, req: express.Request): string {
  const i = req.url.indexOf("?");
  if (i === -1) return path;
  return `${path}${req.url.slice(i)}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retries when upstream is not listening yet (turbo starts gateway and services in parallel). */
async function fetchUpstream(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const attempts = 10;
  const delayMs = 200;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastError;
}

async function proxyJson(
  req: express.Request,
  res: express.Response,
  base: string,
  path: string
) {
  const target = withQuery(path, req);
  const init: RequestInit = {
    method: req.method,
    headers: { "content-type": "application/json" },
  };
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.method !== "DELETE"
  ) {
    init.body = JSON.stringify(req.body ?? {});
  }
  try {
    const upstream = await fetchUpstream(`${base}${target}`, init);
    const body = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") || "application/json")
      .send(body);
  } catch (error) {
    res.status(502).json({
      message: `Upstream request failed for ${target}`,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/* ——— Portfolio (roadmaps, items, initiatives, themes, imports) + template + integration ——— */

app.get("/api/workspaces", (req, res) => proxyJson(req, res, portfolioBase, "/workspaces"));
app.post("/api/workspaces", (req, res) => proxyJson(req, res, portfolioBase, "/workspaces"));
app.patch("/api/workspaces/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/workspaces/${req.params.id}`)
);
app.delete("/api/workspaces/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/workspaces/${req.params.id}`)
);
app.get("/api/roadmaps", (req, res) => proxyJson(req, res, portfolioBase, "/roadmaps"));
app.post("/api/roadmaps", (req, res) => proxyJson(req, res, portfolioBase, "/roadmaps"));
app.get("/api/roadmaps/:id/items", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/items`)
);
app.post("/api/roadmaps/:id/items", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/items`)
);
app.get("/api/roadmaps/:id/themes", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/themes`)
);
app.post("/api/roadmaps/:id/themes", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/themes`)
);
app.get("/api/roadmaps/:id/executive-summary", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/executive-summary`)
);
app.patch("/api/roadmaps/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}`)
);
app.post("/api/roadmaps/:id/clone", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/clone`)
);
app.post("/api/roadmaps/:id/archive", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}/archive`)
);
app.get("/api/roadmaps/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmaps/${req.params.id}`)
);

app.get("/api/roadmap-items/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmap-items/${req.params.id}`)
);
app.put("/api/roadmap-items/:id/teams", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmap-items/${req.params.id}/teams`)
);
app.patch("/api/roadmap-items/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmap-items/${req.params.id}`)
);
app.post("/api/roadmap-items/:id/move", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmap-items/${req.params.id}/move`)
);
app.post("/api/roadmap-items/:id/phases", (req, res) =>
  proxyJson(req, res, portfolioBase, `/roadmap-items/${req.params.id}/phases`)
);
app.patch("/api/phase-segments/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/phase-segments/${req.params.id}`)
);
app.get("/api/roadmap-items", (req, res) => proxyJson(req, res, portfolioBase, "/roadmap-items"));
app.post("/api/roadmap-items", (req, res) => proxyJson(req, res, portfolioBase, "/roadmap-items"));

app.get("/api/initiatives", (req, res) => proxyJson(req, res, portfolioBase, "/initiatives"));
app.post("/api/initiatives", (req, res) => proxyJson(req, res, portfolioBase, "/initiatives"));
app.delete("/api/initiatives/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/initiatives/${req.params.id}`)
);
app.post("/api/initiatives/:id/themes", (req, res) =>
  proxyJson(req, res, portfolioBase, `/initiatives/${req.params.id}/themes`)
);
app.delete("/api/initiatives/:id/themes/:themeId", (req, res) =>
  proxyJson(
    req,
    res,
    portfolioBase,
    `/initiatives/${req.params.id}/themes/${req.params.themeId}`
  )
);
app.get("/api/initiatives/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/initiatives/${req.params.id}`)
);
app.patch("/api/initiatives/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/initiatives/${req.params.id}`)
);

app.get("/api/themes", (req, res) => proxyJson(req, res, portfolioBase, "/themes"));
app.post("/api/themes", (req, res) => proxyJson(req, res, portfolioBase, "/themes"));
app.get("/api/themes/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/themes/${req.params.id}`)
);
app.patch("/api/themes/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/themes/${req.params.id}`)
);
app.delete("/api/themes/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/themes/${req.params.id}`)
);

app.get("/api/teams", (req, res) => proxyJson(req, res, portfolioBase, "/teams"));
app.post("/api/teams", (req, res) => proxyJson(req, res, portfolioBase, "/teams"));
app.get("/api/teams/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/teams/${req.params.id}`)
);
app.patch("/api/teams/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/teams/${req.params.id}`)
);
app.delete("/api/teams/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/teams/${req.params.id}`)
);

app.get("/api/business-sponsors", (req, res) =>
  proxyJson(req, res, portfolioBase, "/business-sponsors")
);
app.post("/api/business-sponsors", (req, res) =>
  proxyJson(req, res, portfolioBase, "/business-sponsors")
);
app.get("/api/business-sponsors/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/business-sponsors/${req.params.id}`)
);
app.patch("/api/business-sponsors/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/business-sponsors/${req.params.id}`)
);
app.delete("/api/business-sponsors/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/business-sponsors/${req.params.id}`)
);

app.get("/api/templates", (req, res) => proxyJson(req, res, templateBase, "/templates"));
app.post("/api/templates", (req, res) => proxyJson(req, res, templateBase, "/templates"));
app.get("/api/templates/:id", (req, res) =>
  proxyJson(req, res, templateBase, `/templates/${req.params.id}`)
);
app.post("/api/templates/:id/create-roadmap", (req, res) =>
  proxyJson(req, res, templateBase, `/templates/${req.params.id}/create-roadmap`)
);

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
  try {
    const upstream = await fetchUpstream(`${portfolioBase}/imports/workbook`, {
      method: "POST",
      body: form,
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

app.get("/api/imports", (req, res) => proxyJson(req, res, portfolioBase, "/imports"));
app.get("/api/imports/:id", (req, res) =>
  proxyJson(req, res, portfolioBase, `/imports/${req.params.id}`)
);
app.get("/api/imports/:id/errors", (req, res) =>
  proxyJson(req, res, portfolioBase, `/imports/${req.params.id}/errors`)
);

app.get("/api/integrations", (req, res) =>
  proxyJson(req, res, integrationBase, "/integrations")
);
app.post("/api/integrations/jira/connect", (req, res) =>
  proxyJson(req, res, integrationBase, "/integrations/jira/connect")
);
app.post("/api/integrations/confluence/connect", (req, res) =>
  proxyJson(req, res, integrationBase, "/integrations/confluence/connect")
);
app.post("/api/integrations/:id/sync", (req, res) =>
  proxyJson(req, res, integrationBase, `/integrations/${req.params.id}/sync`)
);
app.get("/api/external-links", (req, res) =>
  proxyJson(req, res, integrationBase, "/external-links")
);

/* ——— AI service ——— */

app.post("/api/ai/generate-initiative-objective", (req, res) =>
  proxyJson(req, res, aiBase, "/ai/generate-initiative-objective")
);
app.post("/api/ai/summarize-roadmap", (req, res) =>
  proxyJson(req, res, aiBase, "/ai/summarize-roadmap")
);
app.post("/api/ai/classify-theme", (req, res) =>
  proxyJson(req, res, aiBase, "/ai/classify-theme")
);
app.post("/api/ai/quality-check", (req, res) =>
  proxyJson(req, res, aiBase, "/ai/quality-check")
);
app.post("/api/ai/executive-summary", (req, res) =>
  proxyJson(req, res, aiBase, "/ai/executive-summary")
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`api-gateway listening on ${port}`));
