import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "client"),
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 4174,
    proxy: {
      "/api": "http://127.0.0.1:4173",
      "/media": "http://127.0.0.1:4173",
      "/thumb": "http://127.0.0.1:4173",
      "/oauth": "http://127.0.0.1:4173",
    },
  },
});
