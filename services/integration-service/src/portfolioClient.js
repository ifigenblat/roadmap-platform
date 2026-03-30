async function fetchDefaultWorkspaceId() {
  const base = process.env.PORTFOLIO_SERVICE_URL || "http://localhost:4110";
  const key = process.env.INTERNAL_API_KEY || "";
  const res = await fetch(`${base}/internal/default-workspace-id`, {
    headers: { "x-internal-key": key },
  });
  if (!res.ok) {
    throw new Error(`portfolio default-workspace: ${res.status} ${await res.text()}`);
  }
  /** @type {{ id: string }} */
  const data = await res.json();
  return data.id;
}

module.exports = { fetchDefaultWorkspaceId };
