import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  server: { port: 4173, proxy: { "/api": { target: "http://127.0.0.1:4174", changeOrigin: false } } },
  preview: { port: 4173, proxy: { "/api": { target: "http://127.0.0.1:4174", changeOrigin: false } } },
  test: { exclude: ["e2e/**", "node_modules/**"] },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes("node_modules/@xyflow")) return "react-flow";
    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "react-vendor";
    if (id.includes("node_modules/lucide-react")) return "icons";
  } } } },
});
