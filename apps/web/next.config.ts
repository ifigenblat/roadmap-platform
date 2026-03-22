import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root — load root `.env` for `NEXT_PUBLIC_*` and shared config */
loadEnvConfig(path.join(__dirname, "../.."));
/** This app — `.env.development` sets `PORT=3001` so CLI/env stay aligned with `-p 3001` */
loadEnvConfig(path.join(__dirname), true);

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
