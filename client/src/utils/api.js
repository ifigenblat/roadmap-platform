import axios from "axios";

/** Same-origin in dev (Vite proxies `/api` → gateway). Override with `VITE_API_BASE_URL`. */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "token";
const authOptional = import.meta.env.VITE_AUTH_OPTIONAL !== "false";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!axios.isAxiosError(err) || !err.response) return Promise.reject(err);
    if (err.response.status !== 401) return Promise.reject(err);
    const url = String(err.config?.url ?? "");
    if (url.includes("/api/auth/login") || url.includes("/api/auth/register")) {
      return Promise.reject(err);
    }
    if (!authOptional) {
      localStorage.removeItem(TOKEN_KEY);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);
