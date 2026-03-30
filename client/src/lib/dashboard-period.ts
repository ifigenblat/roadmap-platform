export type DashboardPeriod =
  | "mtd"
  | "last_month"
  | "qtd"
  | "last_q"
  | "ytd"
  | "last_year"
  | "custom";

const PERIOD_IDS: readonly DashboardPeriod[] = [
  "mtd",
  "last_month",
  "qtd",
  "last_q",
  "ytd",
  "last_year",
  "custom",
] as const;

export function normalizeDashboardPeriod(raw: string | undefined): DashboardPeriod {
  if (raw && (PERIOD_IDS as readonly string[]).includes(raw)) {
    return raw as DashboardPeriod;
  }
  return "ytd";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Returns null when custom period has no valid from/to. */
export function getRoadmapItemFilterRange(
  period: DashboardPeriod,
  now: Date,
  customFrom: string | undefined,
  customTo: string | undefined,
): { start: Date; end: Date } | null {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "mtd":
      return { start: startOfDay(new Date(y, m, 1)), end: endOfDay(now) };
    case "last_month": {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "qtd": {
      const qStartMonth = Math.floor(m / 3) * 3;
      return { start: startOfDay(new Date(y, qStartMonth, 1)), end: endOfDay(now) };
    }
    case "last_q": {
      const cq = Math.floor(m / 3);
      let lq = cq - 1;
      let yq = y;
      if (lq < 0) {
        lq = 3;
        yq--;
      }
      const sm = lq * 3;
      const start = new Date(yq, sm, 1);
      const end = new Date(yq, sm + 3, 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "ytd":
      return { start: startOfDay(new Date(y, 0, 1)), end: endOfDay(now) };
    case "last_year":
      return {
        start: startOfDay(new Date(y - 1, 0, 1)),
        end: endOfDay(new Date(y - 1, 11, 31)),
      };
    case "custom": {
      if (!customFrom?.trim() || !customTo?.trim()) return null;
      const a = new Date(customFrom);
      const b = new Date(customTo);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
      const start = startOfDay(a);
      const end = endOfDay(b);
      if (start > end) return null;
      return { start, end };
    }
  }
}

export function roadmapItemOverlapsRange(
  itemStart: Date,
  itemEnd: Date,
  range: { start: Date; end: Date },
): boolean {
  return itemStart <= range.end && itemEnd >= range.start;
}

export function formatDashboardPeriodCaption(
  period: DashboardPeriod,
  range: { start: Date; end: Date } | null,
): string {
  if (period === "custom" && !range) {
    return "Custom — choose start and end dates";
  }
  if (!range) return "";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${range.start.toLocaleDateString(undefined, opts)} – ${range.end.toLocaleDateString(undefined, opts)}`;
}
