/** Best-effort plain text from Jira Cloud description (often Atlassian Document Format). */

function walk(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    const parts = n.content.map((c) => walk(c));
    const sep = n.type === "paragraph" || n.type === "heading" ? "\n" : "";
    return parts.join(sep);
  }
  return "";
}

export function jiraDescriptionPlain(description: unknown): string {
  if (description == null) return "";
  if (typeof description === "string") return description.trim();
  if (typeof description === "object" && description !== null && "content" in description) {
    return walk(description).trim();
  }
  return "";
}
