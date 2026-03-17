import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// biome-ignore lint/style/noDefaultExport: Vite requires default export
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3456",
    },
  },
  build: {
    outDir: "../../public",
    emptyOutDir: true,
  },
});
