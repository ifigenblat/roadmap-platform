import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import { prisma } from "./db.js";
import { businessSponsorsRouter } from "./routes/business-sponsors.js";
import { importsRouter } from "./routes/imports.js";
import { initiativesRouter } from "./routes/initiatives.js";
import { roadmapItemsRouter } from "./routes/roadmap-items.js";
import { roadmapsRouter } from "./routes/roadmaps.js";
import { phaseDefinitionsRouter } from "./routes/phase-definitions.js";
import { teamsRouter } from "./routes/teams.js";
import { themesRouter } from "./routes/themes.js";
import { workspacesRouter } from "./routes/workspaces.js";
import { internalRouter } from "./internalRoutes.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "portfolio-service" });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.use(internalRouter);
app.use(workspacesRouter);
app.use(importsRouter);
app.use(roadmapsRouter);
app.use(roadmapItemsRouter);
app.use(teamsRouter);
app.use(phaseDefinitionsRouter);
app.use(businessSponsorsRouter);
app.use(initiativesRouter);
app.use(themesRouter);

const port = Number(process.env.PORT || 4110);
app.listen(port, () => console.log(`portfolio-service listening on ${port}`));
