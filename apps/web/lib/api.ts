/** Must match api-gateway `PORT` (default 4010 in this repo). */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4010";

export type LoadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Server-side friendly: never throws; surfaces gateway-down / HTTP errors for UI banners. */
export async function loadJson<T>(path: string): Promise<LoadJsonResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) {
      const hint =
        res.status === 502
          ? " The gateway on port 4010 could not reach portfolio-service (4110). If you just started dev, wait a few seconds and refresh (services start in parallel). Otherwise: (1) duplicate `npm run dev` / EADDRINUSE — `npm run stack:stop` or `./scripts/free-dev-ports.sh`, then a single `npm run dev`; (2) portfolio crashed (terminal: Prisma/Postgres); (3) Postgres — `docker compose up -d postgres`, or `./scripts/reset-postgres-docker-volume.sh` for volume permission issues. Diagnose: `npm run stack:status`."
          : " Check api-gateway and upstream services.";
      return {
        ok: false,
        message: `API returned ${res.status} for ${path}.${hint}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Cannot reach ${API_BASE}${path} (${detail}). Start the backend: from repo root run \`npm run stack:start\` (Docker + all services) or \`npm run dev\`. Gateway listens on port **4010** by default (not 4000).`,
    };
  }
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export async function sendJson<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "DELETE") {
    headers["content-type"] = "application/json";
  }
  const init: RequestInit = { method, headers };
  if (method === "DELETE") {
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  } else {
    init.body = JSON.stringify(body ?? {});
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
