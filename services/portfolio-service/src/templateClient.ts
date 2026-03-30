const base = () => process.env.TEMPLATE_SERVICE_URL || "http://localhost:4210";
const key = () => process.env.INTERNAL_API_KEY || "";

export async function deleteTemplatesForWorkspace(workspaceId: string): Promise<void> {
  const res = await fetch(
    `${base()}/internal/workspaces/${encodeURIComponent(workspaceId)}/templates`,
    {
      method: "DELETE",
      headers: { "x-internal-key": key() },
    }
  );
  if (!res.ok) {
    throw new Error(`template wipe: ${res.status} ${await res.text()}`);
  }
}
