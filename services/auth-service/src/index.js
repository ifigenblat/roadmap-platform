const { config } = require("dotenv");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const cors = require("cors");
const express = require("express");
const { router: authRouter } = require("./routes/authRoutes.js");
const { runSeed } = require("./seed.js");

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth-service" });
});

app.use("/api/auth", authRouter);

const port = Number(process.env.PORT || 4610);

async function main() {
  if (!process.env.JWT_SECRET?.trim()) {
    console.warn(
      "[auth-service] JWT_SECRET is not set — set it in root .env (same value as gateway)."
    );
  }
  await runSeed();
  app.listen(port, () => console.log(`auth-service listening on ${port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
