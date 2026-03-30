import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    /** Dev client on 3001; proxy `/api` → gateway (override with `VITE_DEV_PORT`). */
    port: Number(process.env.VITE_DEV_PORT) || 3001,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4010",
        changeOrigin: true,
      },
    },
  },
});
