/** Pure date helpers for timeline layout (UTC date parts, no time-of-day drift). */

export function parseYmd(iso: string): { y: number; m: number; d: number } {
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map((x) => Number(x));
  return { y, m, d };
}

export function toUtcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

export function ymdToMs(iso: string): number {
  const { y, m, d } = parseYmd(iso);
  return toUtcMs(y, m, d);
}

const MS_PER_DAY = 86400000;

/** True when the string parses to a finite calendar day (YYYY-MM-DD prefix). */
export function isValidYmd(iso: string): boolean {
  if (!iso || typeof iso !== "string") return false;
  const ms = ymdToMs(iso);
  return Number.isFinite(ms) && !Number.isNaN(ms);
}

export function oneDayWidthPercent(domainMs: number): number {
  if (!Number.isFinite(domainMs) || domainMs <= 0) return 0.35;
  return Math.max(0.35, (MS_PER_DAY / domainMs) * 100);
}

export function addMonthsMs(ms: number, delta: number): number {
  const dt = new Date(ms);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + delta, dt.getUTCDate());
}

export function startOfQuarterMs(ms: number): number {
  const dt = new Date(ms);
  const q = Math.floor(dt.getUTCMonth() / 3);
  return Date.UTC(dt.getUTCFullYear(), q * 3, 1);
}

export function startOfMonthMs(ms: number): number {
  const dt = new Date(ms);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1);
}

export function formatQuarterLabel(ms: number): string {
  const dt = new Date(ms);
  const q = Math.floor(dt.getUTCMonth() / 3) + 1;
  return `Q${q} ${dt.getUTCFullYear()}`;
}

export function formatMonthLabel(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type TimelineZoom = "quarter" | "month";

/** "Jan 1" / "Dec 31" style in UTC. */
export function formatShortDay(iso: string): string {
  if (!isValidYmd(iso)) return "—";
  const d = new Date(ymdToMs(iso));
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateRangePretty(startIso: string, endIso: string): string {
  return `${formatShortDay(startIso)} – ${formatShortDay(endIso)}`;
}

export type YearSpan = { year: number; leftPct: number; widthPct: number };

/** Non-overlapping year bands for the top header row (percent of chart width). */
export function buildYearSpans(domainStart: number, domainEnd: number, domainMs: number): YearSpan[] {
  if (!Number.isFinite(domainMs) || domainMs <= 0) return [];
  const y0 = new Date(domainStart).getUTCFullYear();
  const y1 = new Date(domainEnd).getUTCFullYear();
  const out: YearSpan[] = [];
  for (let y = y0; y <= y1; y++) {
    const yearStart = Date.UTC(y, 0, 1);
    const yearEndEx = Date.UTC(y + 1, 0, 1);
    const segStart = Math.max(domainStart, yearStart);
    const segEnd = Math.min(domainEnd, yearEndEx - 1);
    if (segStart > segEnd) continue;
    const leftPct = ((segStart - domainStart) / domainMs) * 100;
    const widthPct = ((segEnd - segStart) / domainMs) * 100;
    out.push({ year: y, leftPct, widthPct: Math.max(0, widthPct) });
  }
  return out;
}

export function buildTicks(domainStart: number, domainEnd: number, zoom: TimelineZoom): number[] {
  const ticks: number[] = [];
  let t =
    zoom === "quarter" ? startOfQuarterMs(domainStart) : startOfMonthMs(domainStart);
  const end = domainEnd;
  const step = zoom === "quarter" ? 3 : 1;
  while (t <= end) {
    if (t >= domainStart - 1) ticks.push(t);
    t = addMonthsMs(t, step);
  }
  if (ticks.length === 0) ticks.push(domainStart);
  return ticks;
}
