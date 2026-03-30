import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import { Worker } from "bullmq";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const portfolioBase = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4110";
const internalKey = process.env.INTERNAL_API_KEY || "";

function redisConnectionFromUrl(urlStr: string) {
  const u = new URL(urlStr);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    maxRetriesPerRequest: null,
  };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "worker",
    redis: Boolean(process.env.REDIS_URL),
  });
});

app.get("/", (_req, res) =>
  res.json({
    service: "worker",
    queue: "import-workbook",
    message:
      "Consumes BullMQ import-workbook jobs; calls portfolio POST /internal/imports/:id/process-workbook (upload UI uses sync import; queue is optional).",
  })
);

const worker = new Worker(
  "import-workbook",
  async (job) => {
    const { importBatchId, filePath } = job.data as {
      importBatchId: string;
      filePath?: string;
    };
    const res = await fetch(
      `${portfolioBase}/internal/imports/${importBatchId}/process-workbook`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify({
          filePath,
          workerJobId: String(job.id ?? ""),
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`portfolio process-workbook: ${res.status} ${await res.text()}`);
    }
  },
  { connection: redisConnectionFromUrl(redisUrl) }
);

worker.on("failed", (job, err) => {
  console.error("Job failed", job?.id, err);
});

const port = Number(process.env.PORT || 4510);
app.listen(port, () =>
  console.log(`worker listening on ${port} (BullMQ on ${redisUrl})`)
);
