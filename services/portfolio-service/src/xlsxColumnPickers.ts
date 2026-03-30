/** Normalize sheet header keys for resilient matching (NBSP, ZWSP, newlines in merged cells, etc.). */
export function normalizeHeaderKey(s: string): string {
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

function strCell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

const SPONSOR_EXACT_ALIASES = [
  "Business Sponsor",
  "Business sponsor",
  "Sponsor",
  "Exec Sponsor",
  "Executive Sponsor",
  "Business Owner",
  "Executive Owner",
  "Product Sponsor",
  "Leadership Sponsor",
  "Portfolio Sponsor",
];

/**
 * Resolve sponsor / business-owner text from a Data row.
 * Tries known headers first, then any column whose name contains the word "sponsor",
 * then headers that look like "business owner" / "executive owner".
 */
export function pickBusinessSponsorFromRow(row: Record<string, unknown>): string {
  for (const alias of SPONSOR_EXACT_ALIASES) {
    const want = normalizeHeaderKey(alias);
    const match = Object.keys(row).find((rk) => normalizeHeaderKey(rk) === want);
    if (match) {
      const v = strCell(row[match]);
      if (v) return v;
    }
  }

  const keys = Object.keys(row).sort((a, b) => b.length - a.length);
  for (const rk of keys) {
    const nk = normalizeHeaderKey(rk);
    if (/\bsponsor\b/.test(nk)) {
      const v = strCell(row[rk]);
      if (v) return v;
    }
  }

  for (const rk of keys) {
    const nk = normalizeHeaderKey(rk);
    if (
      nk === "business owner" ||
      nk === "executive owner" ||
      /\bbusiness owner\b/.test(nk) ||
      /\bexecutive owner\b/.test(nk)
    ) {
      const v = strCell(row[rk]);
      if (v) return v;
    }
  }

  return "";
}

function cleanHeaderCell(s: string): string {
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

/** Score one header cell for picking which row is the real column header (vs title rows above the table). */
function cellHeaderScore(normalizedKey: string): number {
  const nk = normalizedKey;
  if (!nk) return 0;
  if (nk.includes("initiative")) return 5;
  if (nk.includes("project") && !nk.includes("objective")) return 4;
  if (/\bsponsor\b/.test(nk) || nk.includes("business owner") || nk.includes("executive owner")) return 4;
  if (nk.includes("phase")) return 2;
  if (nk.includes("team")) return 2;
  if (nk.includes("theme") && !nk.includes("objective")) return 2;
  if (nk.includes("start") && nk.includes("date")) return 2;
  if (nk.includes("end") && nk.includes("date")) return 2;
  if (nk.includes("status")) return 1;
  if (nk.includes("jira")) return 1;
  if (nk.includes("capacity") || nk.includes("sprint")) return 1;
  if (nk.includes("business objective")) return 1;
  return 0;
}

function scoreHeaderRowValues(cells: unknown[]): number {
  let s = 0;
  for (const c of cells) {
    s += cellHeaderScore(normalizeHeaderKey(cleanHeaderCell(String(c ?? ""))));
  }
  return s;
}

/**
 * Build row objects when the table header is not necessarily on the first row (title banners, blank rows).
 * Picks the row in the first few lines with the strongest roadmap-like header scores.
 */
export function keyedRowsFromAoA(aoa: unknown[][]): {
  rows: Record<string, unknown>[];
  headerRow0Based: number;
  headerScore: number;
} {
  if (!aoa.length) {
    return { rows: [], headerRow0Based: 0, headerScore: 0 };
  }

  const maxCols = Math.max(0, ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)));
  const padded = aoa.map((r) => {
    const row = [...(Array.isArray(r) ? r : [])];
    while (row.length < maxCols) row.push("");
    return row;
  });

  let bestIdx = 0;
  let bestScore = -1;
  const maxScan = Math.min(15, Math.max(0, padded.length - 1));
  for (let i = 0; i < maxScan; i++) {
    const score = scoreHeaderRowValues(padded[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore < 4) {
    bestIdx = 0;
    bestScore = scoreHeaderRowValues(padded[0] ?? []);
  }

  const headerCells = padded[bestIdx] ?? [];
  const keyCounts = new Map<string, number>();
  const keys = headerCells.map((cell, colIdx) => {
    const t = cleanHeaderCell(String(cell ?? ""));
    const base = t || `__COL_${colIdx}`;
    const n = (keyCounts.get(base) ?? 0) + 1;
    keyCounts.set(base, n);
    return n === 1 ? base : `${base}__${n}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = bestIdx + 1; r < padded.length; r++) {
    const arr = padded[r];
    const row: Record<string, unknown> = {};
    let anyNonEmpty = false;
    for (let c = 0; c < maxCols; c++) {
      const key = keys[c] ?? `__COL_${c}`;
      const val = arr[c];
      const asStr = val == null ? "" : String(val);
      if (asStr.trim()) anyNonEmpty = true;
      row[key] = asStr;
    }
    if (anyNonEmpty) rows.push(row);
  }

  return { rows, headerRow0Based: bestIdx, headerScore: bestScore };
}

/** CET workbook: Data sheet initiative names often differ from the "Initiative Descriptions" sheet — exact map for known pairs. */
export const INITIATIVE_DESCRIPTION_ALIASES_CET: Readonly<Record<string, string>> = {
  "PCG Non-Del Core Notifications": "P3 Non-Del Core Notifications",
  "Horizon - Self-Serve Scheduling": "Borrower Self-Serve Scheduling",
  "PDM - Servicing": "Pennymac Data Model (PDM) for Servicing",
  "Kirby Deprecation and Replacement": "Deprecate Kirby",
  "Service Order": "New Zendesk Group - Service Orders",
  "CDL Salesforce MFD Workflow (Zendesk Migration)": "MST LeadForce Migration",
  "Zoom Interaction Summaries in CRM": "Zoom & SMS Integration for AI Summaries",
  "CET - Non-QM Products": "Non-QM Product Integration",
  "Horizon Enhancements - Sales": "CDL Horizon CRM Workflow Enhancements",
  "Horizon Enhancements - SFMC": "CDL Horizon Marketing Enhancements",
};

export type InitiativeDescriptionEntry = {
  name: string;
  short?: string;
  long?: string;
  pillar?: string;
};

export type InitiativeDescriptionIndex = {
  byExact: Map<string, { short?: string; long?: string }>;
  entries: InitiativeDescriptionEntry[];
};

export function buildInitiativeDescriptionIndex(
  entries: InitiativeDescriptionEntry[]
): InitiativeDescriptionIndex {
  const byExact = new Map<string, { short?: string; long?: string }>();
  for (const e of entries) {
    byExact.set(e.name, { short: e.short, long: e.long });
  }
  return { byExact, entries };
}

/** Normalize initiative labels so Data vs Descriptions rows can match (banner prefixes, parentheses, punctuation). */
export function normalizeInitiativeMatchKey(s: string): string {
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[:+]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^horizon\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function initiativeWordSet(s: string): Set<string> {
  const n = normalizeInitiativeMatchKey(s);
  return new Set(
    n.split(/\s+/).filter((w) => w.length > 2 || /^[a-z]{2,3}$/i.test(w))
  );
}

function initiativeWordJaccard(a: string, b: string): number {
  const A = initiativeWordSet(a);
  const B = initiativeWordSet(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) {
    if (B.has(w)) inter++;
  }
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/**
 * Match a Data-row initiative name to Initiative Descriptions (exact, CET aliases, normalized equality, then scored fuzzy + theme/pillar).
 */
export function resolveInitiativeDescription(
  dataInitiativeName: string,
  dataTheme: string | undefined,
  index: InitiativeDescriptionIndex,
  /** CET workbooks ship mismatched Data vs Descriptions names; other workbooks should pass {}. */
  aliases: Readonly<Record<string, string>> = {}
): { short?: string; long?: string } | undefined {
  const pick = (name: string) => index.byExact.get(name);

  const direct = pick(dataInitiativeName);
  if (direct !== undefined) return direct;

  const aliasTarget = aliases[dataInitiativeName];
  if (aliasTarget) {
    const via = pick(aliasTarget);
    if (via !== undefined) return via;
  }

  const nd = normalizeInitiativeMatchKey(dataInitiativeName);
  const normHits = index.entries.filter(
    (e) => normalizeInitiativeMatchKey(e.name) === nd
  );
  if (normHits.length === 1) {
    const e = normHits[0];
    return { short: e.short, long: e.long };
  }

  const themeN = dataTheme ? normalizeHeaderKey(dataTheme) : "";
  const scored = index.entries.map((e) => {
    let sc = initiativeWordJaccard(dataInitiativeName, e.name) * 100;
    if (themeN && e.pillar && normalizeHeaderKey(e.pillar) === themeN) {
      sc += 40;
    }
    return { e, sc };
  });
  scored.sort((a, b) => b.sc - a.sc);
  const top = scored[0];
  const second = scored[1]?.sc ?? -1;
  if (top && top.sc >= 50 && top.sc - second >= 8) {
    return { short: top.e.short, long: top.e.long };
  }

  return undefined;
}
