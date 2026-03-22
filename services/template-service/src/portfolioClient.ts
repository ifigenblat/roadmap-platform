/** Resolve default portfolio workspace id (portfolio must be up). */
export async function fetchDefaultWorkspaceId(): Promise<string> {
  const base = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4100";
  const key = process.env.INTERNAL_API_KEY || "";
  const res = await fetch(`${base}/internal/default-workspace-id`, {
    headers: { "x-internal-key": key },
  });
  if (!res.ok) {
    throw new Error(
      `portfolio default-workspace: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function createRoadmapInPortfolio(body: Record<string, unknown>) {
  const base = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4100";
  const res = await fetch(`${base}/roadmaps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`portfolio create roadmap: ${res.status} ${text}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}
