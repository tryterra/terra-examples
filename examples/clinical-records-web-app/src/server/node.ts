/**
 * Local Node entrypoint. Dev: vite serves the SPA on :5173 and proxies /api
 * here (:8787). Production-style: `npm run build` then this serves ./dist too.
 * The API (src/server/index.ts) is a plain Hono app - it runs anywhere Hono
 * runs.
 */
import { mkdirSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { seedDemoData } from "./demo-seed";
import { migrateDb } from "./lib/db";
import { isDemoMode } from "./lib/env";
import app from "./index";

mkdirSync("./data", { recursive: true });
// Auto-migrate so a fresh clone works with plain `npm run dev`.
await migrateDb();
if (isDemoMode()) await seedDemoData();

if (process.env.NODE_ENV === "production") {
  app.use("*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.error(
    isDemoMode()
      ? `api on :${port} - DEMO MODE (synthetic records; add Terra credentials in .env to go live)`
      : `api on :${port} - live Terra API`,
  );
});
