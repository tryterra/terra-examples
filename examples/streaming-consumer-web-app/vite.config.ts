import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev-only convenience: keeps the SPA same-origin with the token server
    // so there's no CORS ceremony. In production the built SPA is static
    // files, and /api/token is whatever route your backend exposes.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
