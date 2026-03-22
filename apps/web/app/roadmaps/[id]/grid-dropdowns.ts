/** Excel-aligned initiative Type values (dropdown). Unknown imported values are appended in the UI. */
export const INITIATIVE_TYPE_OPTIONS = [
  "",
  "Strategic Initiative",
  "Enhancement",
  "BAU",
  "Project",
  "Program",
  "Platform",
  "Technology",
  "Research",
  "Infrastructure",
  "Other",
] as const;

/** Phase / row Status as captured in spreadsheets and phase_segment.status */
export const PHASE_STATUS_OPTIONS = [
  "",
  "Backlog",
  "In Progress",
  "Done",
  "Blocked",
  "At Risk",
  "Not started",
  "Deferred",
  "Cancelled",
] as const;

export const ITEM_STATUS_VALUES = ["not_started", "in_progress", "at_risk", "done"] as const;

export function mergeOptionList(fixed: readonly string[], current: string | null | undefined): string[] {
  const c = (current ?? "").trim();
  const base = [...fixed];
  if (c && !base.includes(c)) base.unshift(c);
  return base;
}
