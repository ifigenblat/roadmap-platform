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
  aiRuntimeSchema,
  aiSummarizeRoadmapSchema,
} from "@roadmap/types";
import type { z } from "zod";

type AiRuntime = z.infer<typeof aiRuntimeSchema>;

/** Ensures OpenAI-compatible root ends with `/v1` (Ollama, LM Studio, etc.). */
function normalizeOpenAiCompatibleBase(raw: string | undefined | null): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  let u = t.replace(/\/+$/, "");
  if (!/\/v1$/i.test(u)) u = `${u}/v1`;
  return u;
}

const rootEnv = resolve(process.cwd(), "../../.env");
const pkgEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(pkgEnv)) config({ path: pkgEnv });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "ai-service" }));

/** Safe for UI: does not expose secrets. */
app.get("/ai/status", (_req, res) => {
  const envCompat = normalizeOpenAiCompatibleBase(process.env.OPENAI_COMPATIBLE_BASE_URL);
  res.json({
    openaiConfigured:
      Boolean(process.env.OPENAI_API_KEY?.trim()) || Boolean(envCompat.length > 0),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    openaiCompatibleBaseUrlEnv: envCompat || undefined,
  });
});

function defaultProvider(runtime?: AiRuntime): "openai" | "gemini" {
  const p = runtime?.provider;
  return p === "gemini" ? "gemini" : "openai";
}


async function openAiChat(
  system: string,
  user: string,
  runtime?: AiRuntime
): Promise<{ text: string | null; live: boolean }> {
  const model =
    (runtime?.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini") || "gpt-4o-mini";
  const max_tokens = runtime?.maxTokens != null ? runtime.maxTokens : 600;
  const temperature = runtime?.temperature != null ? runtime.temperature : 0.4;
  const key = (runtime?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY)?.trim();
  const runtimeBase = normalizeOpenAiCompatibleBase(runtime?.openaiCompatibleBaseUrl);
  const envBase = normalizeOpenAiCompatibleBase(process.env.OPENAI_COMPATIBLE_BASE_URL);
  const baseUrl = runtimeBase || envBase;

  if (baseUrl) {
    const url = `${baseUrl}/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens,
        temperature,
      }),
    });
    if (!res.ok) return { text: null, live: false };
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? null;
    return { text, live: true };
  }

  if (!key) return { text: null, live: false };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens,
      temperature,
    }),
  });
  if (!res.ok) return { text: null, live: false };
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? null;
  return { text, live: true };
}

async function geminiChat(
  system: string,
  user: string,
  runtime?: AiRuntime
): Promise<{ text: string | null; live: boolean }> {
  const key = (runtime?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY)?.trim();
  if (!key) return { text: null, live: false };
  const modelId =
    (runtime?.geminiModel?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash") ||
    "gemini-2.0-flash";
  const maxOut = runtime?.maxTokens != null ? runtime.maxTokens : 600;
  const temperature = runtime?.temperature != null ? runtime.temperature : 0.4;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxOut,
        temperature,
      },
    }),
  });
  if (!res.ok) return { text: null, live: false };
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? null;
  return { text, live: true };
}

async function runLlmChat(
  system: string,
  user: string,
  runtime?: AiRuntime
): Promise<{ text: string | null; live: boolean; provider: "openai" | "gemini" }> {
  const useGemini = defaultProvider(runtime) === "gemini";
  if (useGemini) {
    const r = await geminiChat(system, user, runtime);
    return { ...r, provider: "gemini" };
  }
  const r = await openAiChat(system, user, runtime);
  return { ...r, provider: "openai" };
}

/** Exposed source tag for clients (not only OpenAI). */
function sourceFrom(
  aiText: string | null | undefined,
  provider: "openai" | "gemini"
): "openai" | "gemini" | "stub" {
  if (aiText) return provider === "gemini" ? "gemini" : "openai";
  return "stub";
}

app.post("/ai/generate-initiative-objective", async (req, res) => {
  const parsed = aiGenerateObjectiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { initiativeName, context } = parsed.data;
  const user = `Initiative: ${initiativeName}\nContext: ${context ?? "(none)"}\nWrite one short business objective (2 sentences max).`;
  const { text: aiText, provider } = await runLlmChat(
    "You write crisp initiative objectives for roadmaps in Roadmap Platform. No markdown.",
    user
  );
  const ai =
    aiText ??
    `Advance "${initiativeName}" with measurable customer and business impact.${
      context ? ` Context: ${context.slice(0, 200)}` : ""
    }`;
  res.json({ objective: ai, source: sourceFrom(aiText, provider) });
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
  const { text: aiText, provider } = await runLlmChat(
    "Summarize the roadmap in 3–5 bullet points for executives. No markdown.",
    user
  );
  const ai =
    aiText ??
    `Roadmap overview (${lines.length || 0} items): focus on delivery risk, customer impact, and dependencies.`;
  res.json({ summary: ai, source: sourceFrom(aiText, provider) });
});

app.post("/ai/classify-theme", async (req, res) => {
  const parsed = aiClassifyThemeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const candidates = parsed.data.candidateThemes?.length
    ? `Choose exactly one from: ${parsed.data.candidateThemes.join(", ")}.`
    : "Infer the best short theme label (2–4 words).";
  const user = `Text:\n${parsed.data.text}\n${candidates}`;
  const { text: aiText, provider } = await runLlmChat(
    "You classify roadmap text into strategic themes. Reply with only the theme name, no punctuation.",
    user
  );
  const ai = aiText ?? "General";
  res.json({
    theme: ai.replace(/^["']|["']$/g, "").trim(),
    source: sourceFrom(aiText, provider),
  });
});

app.post("/ai/quality-check", async (req, res) => {
  const parsed = aiQualityCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const crit =
    parsed.data.criteria?.join("; ") ??
    "clarity, measurable outcomes, customer value, feasibility";
  const user = `Criteria: ${crit}\n\nText:\n${parsed.data.text}`;
  const { text: aiText, provider } = await runLlmChat(
    "You review roadmap/initiative text. Reply with: (1) score 1-5, (2) one line verdict, (3) up to 3 improvements. Plain text.",
    user
  );
  const ai =
    aiText ??
    "Score: 3/5. Adequate but could use clearer metrics and owner. Add acceptance criteria; name a business sponsor; tie to a customer outcome.";
  res.json({ review: ai, source: sourceFrom(aiText, provider) });
});

app.post("/ai/executive-summary", async (req, res) => {
  const parsed = aiExecutiveSummarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const b = parsed.data.bundle;
  const runtime = parsed.data._aiRuntime;
  const payload = JSON.stringify(b, null, 2);
  const { text: aiText, provider } = await runLlmChat(
    "You write board-ready executive summaries for roadmaps in Roadmap Platform. Output plain text with short sections: Overview, Strategic themes (bullets), Delivery health (call out risks), Next steps. Be concise; no markdown headings with #.",
    `Create an executive summary for this roadmap bundle:\n${payload}`,
    runtime
  );
  const ai =
    aiText ??
    `Overview: ${b.roadmapName} (${b.planningYear}). Themes: ${b.themes.length}; ungrouped initiatives: ${b.ungroupedInitiatives.length}. Highlight delivery mix and dependencies.`;
  res.json({ narrative: ai, source: sourceFrom(aiText, provider) });
});

const port = Number(process.env.PORT || 4310);
app.listen(port, () => console.log(`ai-service listening on ${port}`));
