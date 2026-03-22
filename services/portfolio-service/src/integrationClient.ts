const base = () => process.env.INTEGRATION_SERVICE_URL || "http://localhost:4400";
const key = () => process.env.INTERNAL_API_KEY || "";

export async function integrationCreateExternalLink(data: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  provider: string;
  externalId: string;
  externalUrl: string;
  syncState: string;
  metadataJson?: unknown;
}): Promise<void> {
  const res = await fetch(`${base()}/internal/external-links`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": key(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`integration external-link: ${res.status} ${await res.text()}`);
  }
}

export async function integrationDeleteExternalLinksForWorkspace(
  workspaceId: string
): Promise<void> {
  const res = await fetch(
    `${base()}/internal/workspaces/${encodeURIComponent(workspaceId)}/external-links`,
    {
      method: "DELETE",
      headers: { "x-internal-key": key() },
    }
  );
  if (!res.ok) {
    throw new Error(`integration wipe links: ${res.status} ${await res.text()}`);
  }
}

export async function integrationHasExternalLink(
  workspaceId: string,
  f: {
    entityType: string;
    entityId: string;
    provider: string;
    externalId: string;
  }
): Promise<boolean> {
  const url = new URL("/external-links", base());
  url.searchParams.set("workspaceId", workspaceId);
  const res = await fetch(url.toString());
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{
    entityType: string;
    entityId: string;
    provider: string;
    externalId: string;
  }>;
  return rows.some(
    (x) =>
      x.entityType === f.entityType &&
      x.entityId === f.entityId &&
      x.provider === f.provider &&
      x.externalId === f.externalId
  );
}
