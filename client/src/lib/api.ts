import axios from "axios";
import { api } from "../utils/api.js";

/**
 * Empty string = same origin (Vite dev proxies /api → gateway :4010).
 * Set VITE_API_BASE_URL=http://localhost:4010 if you serve the SPA without a proxy.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type LoadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Never throws; surfaces gateway-down / HTTP errors for UI banners. */
export async function loadJson<T>(path: string): Promise<LoadJsonResult<T>> {
  try {
    const res = await api.get<T>(path, { validateStatus: () => true });
    if (res.status >= 400) {
      const hint =
        res.status === 502
          ? " The gateway on port 4010 could not reach portfolio-service (4110). If you just started dev, wait a few seconds and refresh (services start in parallel). Otherwise: (1) duplicate `npm run dev` / EADDRINUSE — `npm run stack:stop` or `./scripts/free-dev-ports.sh`, then a single `npm run dev`; (2) portfolio crashed (terminal: Prisma/Postgres); (3) Postgres — `docker compose up -d postgres`, or `./scripts/reset-postgres-docker-volume.sh` for volume permission issues. Diagnose: `npm run stack:status`."
          : " Check gateway and upstream services.";
      return {
        ok: false,
        message: `API returned ${res.status} for ${path}.${hint}`,
      };
    }
    return { ok: true, data: res.data as T };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Cannot reach ${API_BASE}${path} (${detail}). Start the backend: from repo root run \`npm run stack:start\` (Docker + all services) or \`npm run dev\`. Gateway listens on port **4010** by default (not 4000).`,
    };
  }
}

export async function fetchJson<T>(path: string): Promise<T> {
  try {
    const res = await api.get<T>(path);
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response) {
      throw new Error(`Request failed: ${e.response.status}`);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function sendJson<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await api.request<T>({
    url: path,
    method,
    ...(method === "DELETE"
      ? body !== undefined
        ? { data: body }
        : {}
      : { data: body ?? {} }),
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`Request failed: ${res.status}`);
  }
  const d = res.data;
  if (d === undefined || d === null || d === "") {
    return undefined as T;
  }
  return d as T;
}
