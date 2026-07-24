import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import svgr from "vite-plugin-svgr";
import path from "node:path";

export default defineConfig({
  server: {
    allowedHosts: [".ngrok-free.app"],
    // The Hono server owns /api; vite dev only serves the SPA.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  plugins: [
    { ...optimizeLocales.vite({ locales: ["en-US"] }), enforce: "pre" },
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/client/routes",
      generatedRouteTree: "./src/client/routeTree.gen.ts",
    }),
    svgr(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@/client": path.resolve(__dirname, "./src/client"),
      "@/server": path.resolve(__dirname, "./src/server"),
    },
  },
});
