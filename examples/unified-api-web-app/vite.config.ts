import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import agents from "agents/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import svgr from "vite-plugin-svgr";
import path from "node:path";

export default defineConfig({
  server: {
    allowedHosts: [".ngrok-free.app"],
  },
  plugins: [
    agents(),
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
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@/client": path.resolve(__dirname, "./src/client"),
      "@/server": path.resolve(__dirname, "./src/server"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
