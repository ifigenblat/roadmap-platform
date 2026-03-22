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
