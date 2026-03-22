import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import {
  aiClassifyThemeSchema,
  aiExecutiveSummarySchema,
  aiGenerateObjectiveSchema,
  aiQualityCheckSchema,
  aiSummarizeRoadmapSchema,
} from "@roadmap/types";

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "ai-service" }));

async function openAiChat(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 600,
      temperature: 0.4,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

app.post("/ai/generate-initiative-objective", async (req, res) => {
  const parsed = aiGenerateObjectiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { initiativeName, context } = parsed.data;
  const user = `Initiative: ${initiativeName}\nContext: ${context ?? "(none)"}\nWrite one short business objective (2 sentences max).`;
  const ai =
    (await openAiChat(
      "You write crisp initiative objectives for product roadmaps. No markdown.",
      user
    )) ??
    `Advance "${initiativeName}" with measurable customer and business impact.${
      context ? ` Context: ${context.slice(0, 200)}` : ""
    }`;
  res.json({ objective: ai, source: process.env.OPENAI_API_KEY ? "openai" : "stub" });
});

app.post("/ai/summarize-roadmap", async (req, res) => {
  const parsed = aiSummarizeRoadmapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const lines =
    parsed.data.items?.map(
      (i) => `- ${i.name}${i.status ? ` [${i.status}]` : ""}${i.notes ? `: ${i.notes}` : ""}`
    ) ?? [];
  const user =
    parsed.data.rawText ??
    [parsed.data.title && `Title: ${parsed.data.title}`, ...lines].filter(Boolean).join("\n");
  const ai =
    (await openAiChat(
      "Summarize the roadmap in 3–5 bullet points for executives. No markdown.",
      user
    )) ??
    `Roadmap overview (${lines.length || 0} items): focus on delivery risk, customer impact, and dependencies.`;
  res.json({ summary: ai, source: process.env.OPENAI_API_KEY ? "openai" : "stub" });
});

app.post("/ai/classify-theme", async (req, res) => {
  const parsed = aiClassifyThemeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const candidates = parsed.data.candidateThemes?.length
    ? `Choose exactly one from: ${parsed.data.candidateThemes.join(", ")}.`
    : "Infer the best short theme label (2–4 words).";
  const user = `Text:\n${parsed.data.text}\n${candidates}`;
  const ai =
    (await openAiChat(
      "You classify roadmap text into strategic themes. Reply with only the theme name, no punctuation.",
      user
    )) ?? "General";
  res.json({
    theme: ai.replace(/^["']|["']$/g, "").trim(),
    source: process.env.OPENAI_API_KEY ? "openai" : "stub",
  });
});

app.post("/ai/quality-check", async (req, res) => {
  const parsed = aiQualityCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const crit =
    parsed.data.criteria?.join("; ") ??
    "clarity, measurable outcomes, customer value, feasibility";
  const user = `Criteria: ${crit}\n\nText:\n${parsed.data.text}`;
  const ai =
    (await openAiChat(
      "You review roadmap/initiative text. Reply with: (1) score 1-5, (2) one line verdict, (3) up to 3 improvements. Plain text.",
      user
    )) ?? "Score: 3/5. Adequate but could use clearer metrics and owner. Add acceptance criteria; name a business sponsor; tie to a customer outcome.";
  res.json({ review: ai, source: process.env.OPENAI_API_KEY ? "openai" : "stub" });
});

app.post("/ai/executive-summary", async (req, res) => {
  const parsed = aiExecutiveSummarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const b = parsed.data.bundle;
  const payload = JSON.stringify(b, null, 2);
  const ai =
    (await openAiChat(
      "You write board-ready executive summaries for product roadmaps. Output plain text with short sections: Overview, Strategic themes (bullets), Delivery health (call out risks), Next steps. Be concise; no markdown headings with #.",
      `Create an executive summary for this roadmap bundle:\n${payload}`
    )) ??
    `Overview: ${b.roadmapName} (${b.planningYear}). Themes: ${b.themes.length}; ungrouped initiatives: ${b.ungroupedInitiatives.length}. Highlight delivery mix and dependencies.`;
  res.json({ narrative: ai, source: process.env.OPENAI_API_KEY ? "openai" : "stub" });
});

const port = Number(process.env.PORT || 4300);
app.listen(port, () => console.log(`ai-service listening on ${port}`));
