/** Workspace rows as returned by GET /api/workspaces */
export type WorkspaceListItem = { id: string; name: string; slug?: string };

/** Dropdown / table label: name with slug when available (matches roadmaps create form). */
export function workspaceOptionLabel(w: WorkspaceListItem): string {
  const slug = (w.slug ?? "").trim();
  return slug ? `${w.name} (${slug})` : w.name;
}

/** Resolve a persisted workspace id to a user-facing label; avoids showing raw UUIDs when possible. */
export function workspaceLabelById(
  id: string | null | undefined,
  workspaces: WorkspaceListItem[],
): string {
  const t = (id ?? "").trim();
  if (!t) return "—";
  const w = workspaces.find((x) => x.id === t);
  return w ? workspaceOptionLabel(w) : "Unknown workspace";
}

/** Default workspace pick for forms: URL filter, then slug `default`, then first row. */
export function resolveDefaultWorkspaceId(
  workspaces: WorkspaceListItem[],
  preferredId: string,
): string {
  const pref = (preferredId ?? "").trim();
  if (pref && workspaces.some((w) => w.id === pref)) return pref;
  const bySlug = workspaces.find((w) => (w.slug ?? "").toLowerCase() === "default");
  if (bySlug) return bySlug.id;
  return workspaces[0]?.id ?? "";
}
