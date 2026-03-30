/**
 * Maps persisted `StrategicTheme.colorToken` strings to UI accents.
 * Class strings are spelled out literally so Tailwind can scan them (see tailwind.config.js).
 */

export const STRATEGIC_THEME_COLOR_TOKENS = [
  "none",
  "slate",
  "indigo",
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "fuchsia",
  "cyan",
  "lime",
  "orange",
] as const;

export type StrategicThemeColorToken = (typeof STRATEGIC_THEME_COLOR_TOKENS)[number];

/** Hex for inline overlays (timeline bars) — always works even if Tailwind misses a class. */
const TOKEN_HEX: Record<string, string> = {
  slate: "#64748b",
  indigo: "#6366f1",
  sky: "#0ea5e9",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  cyan: "#06b6d4",
  lime: "#84cc16",
  orange: "#f97316",
};

function norm(token: string | null | undefined): string | null {
  if (!token || token === "none") return null;
  return token.toLowerCase();
}

export function themeColorHex(token: string | null | undefined): string | null {
  const k = norm(token);
  if (!k) return null;
  return TOKEN_HEX[k] ?? null;
}

/** rgba() for semi-transparent bar overlays (~32% intensity in transcript). */
export function themeBarTintColor(token: string | null | undefined, alpha = 0.32): string | null {
  const hex = themeColorHex(token);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `rgba(${r},${g},${b},${alpha})`;
}

const BORDER_LEFT: Record<string, string> = {
  slate: "border-l-4 border-slate-500",
  indigo: "border-l-4 border-indigo-500",
  sky: "border-l-4 border-sky-500",
  emerald: "border-l-4 border-emerald-500",
  amber: "border-l-4 border-amber-500",
  rose: "border-l-4 border-rose-500",
  violet: "border-l-4 border-violet-500",
  fuchsia: "border-l-4 border-fuchsia-500",
  cyan: "border-l-4 border-cyan-500",
  lime: "border-l-4 border-lime-500",
  orange: "border-l-4 border-orange-500",
};

/** Left accent on roadmap grid initiative header rows. */
export function themeInitiativeHeaderAccentClass(token: string | null | undefined): string {
  const k = norm(token);
  if (!k) return "";
  return BORDER_LEFT[k] ?? "border-l-4 border-slate-600";
}

const OBJECTIVE_CARD: Record<string, string> = {
  slate: "border-l-4 border-slate-500 bg-slate-900/80",
  indigo: "border-l-4 border-indigo-500 bg-indigo-950/25",
  sky: "border-l-4 border-sky-500 bg-sky-950/25",
  emerald: "border-l-4 border-emerald-500 bg-emerald-950/25",
  amber: "border-l-4 border-amber-500 bg-amber-950/20",
  rose: "border-l-4 border-rose-500 bg-rose-950/25",
  violet: "border-l-4 border-violet-500 bg-violet-950/25",
  fuchsia: "border-l-4 border-fuchsia-500 bg-fuchsia-950/25",
  cyan: "border-l-4 border-cyan-500 bg-cyan-950/25",
  lime: "border-l-4 border-lime-500 bg-lime-950/20",
  orange: "border-l-4 border-orange-500 bg-orange-950/20",
};

/** Theme detail “Pillar objective” section. */
export function themeDetailObjectiveSectionClass(token: string | null | undefined): string {
  const k = norm(token);
  const base = "rounded-2xl border border-slate-800 p-6 ";
  if (!k) return `${base}bg-slate-900`;
  return base + (OBJECTIVE_CARD[k] ?? "bg-slate-900");
}

const EXEC_CARD: Record<string, string> = {
  slate: "border-l-4 border-slate-500 bg-slate-900/60",
  indigo: "border-l-4 border-indigo-500 bg-indigo-950/20",
  sky: "border-l-4 border-sky-500 bg-sky-950/20",
  emerald: "border-l-4 border-emerald-500 bg-emerald-950/20",
  amber: "border-l-4 border-amber-500 bg-amber-950/15",
  rose: "border-l-4 border-rose-500 bg-rose-950/20",
  violet: "border-l-4 border-violet-500 bg-violet-950/20",
  fuchsia: "border-l-4 border-fuchsia-500 bg-fuchsia-950/20",
  cyan: "border-l-4 border-cyan-500 bg-cyan-950/20",
  lime: "border-l-4 border-lime-500 bg-lime-950/15",
  orange: "border-l-4 border-orange-500 bg-orange-950/15",
};

export function themeExecutiveCardClass(token: string | null | undefined): string {
  const k = norm(token);
  const base = "rounded-xl border border-slate-800 p-4 ";
  if (!k) return `${base}bg-slate-900/50`;
  return base + (EXEC_CARD[k] ?? "bg-slate-900/50");
}

const PILL_BORDER: Record<string, string> = {
  slate: "border-slate-600 bg-slate-950/90",
  indigo: "border-indigo-600/50 bg-indigo-950/50",
  sky: "border-sky-600/50 bg-sky-950/50",
  emerald: "border-emerald-600/50 bg-emerald-950/45",
  amber: "border-amber-600/50 bg-amber-950/40",
  rose: "border-rose-600/50 bg-rose-950/45",
  violet: "border-violet-600/50 bg-violet-950/45",
  fuchsia: "border-fuchsia-600/50 bg-fuchsia-950/45",
  cyan: "border-cyan-600/50 bg-cyan-950/45",
  lime: "border-lime-600/50 bg-lime-950/35",
  orange: "border-orange-600/50 bg-orange-950/40",
};

/** Initiative list theme chip wrapper. */
export function themeInitiativePillClass(token: string | null | undefined): string {
  const k = norm(token);
  const base = "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs text-slate-200 ";
  if (!k) return `${base}border-slate-700 bg-slate-950/80`;
  return base + (PILL_BORDER[k] ?? "border-slate-700 bg-slate-950/80");
}

export function themeColorTokenLabel(token: string | null | undefined): string {
  const k = norm(token);
  if (!k) return "None";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function themeColorTokenSelectOptions(): { value: string; label: string }[] {
  return STRATEGIC_THEME_COLOR_TOKENS.map((t) => ({
    value: t === "none" ? "" : t,
    label: t === "none" ? "None" : t.charAt(0).toUpperCase() + t.slice(1),
  }));
}
