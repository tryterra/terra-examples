import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/client": path.resolve(__dirname, "./src/client"),
      "@/server": path.resolve(__dirname, "./src/server"),
    },
  },
  test: {
    globals: true,
    restoreMocks: true,
    environment: "node",
    include: ["src/server/**/*.test.ts"],
  },
});
