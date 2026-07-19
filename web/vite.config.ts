import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite config for the Polity Pulse demo SPA.
// Builds to ./dist as static assets; the Cloudflare Worker serves ./dist
// via [assets] binding while keeping /api/pulse as a JSON endpoint.
// See ../docs/operations/pulse-demo-ui-ux-plan-2026-07-19.md §1.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Single chunk — small app, avoids dynamic-import worker quirks on Workers
    // static-asset serving.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5174,
    // Proxy /api to the Worker's wrangler dev port so the SPA can poll the
    // real agent during local UI development.
    proxy: {
      "/api": {
        target: "http://localhost:8799",
        changeOrigin: true,
      },
    },
  },
});