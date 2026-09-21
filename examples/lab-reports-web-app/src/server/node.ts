/**
 * Local Node entrypoint. Dev: vite serves the SPA on :5173 and proxies /api
 * here (:8787). Production-style: `npm run build` then this serves ./dist too.
 * Deploying elsewhere? app (src/server/index.ts) is a plain Hono app — it
 * runs anywhere Hono runs; on serverless move webhook post-response work to
 * waitUntil/a queue.
 */
// The demo bootstrap must run before ./index — importing routes opens the
// SQLite file, which would otherwise create an empty database first.
import "./demo-bootstrap";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "./lib/db";
import { isDemoMode } from "./lib/env";
import app from "./index";

// Auto-migrate so a fresh clone works with plain `npm run dev`.
await migrate(createDb(), { migrationsFolder: "./db/migrations" });

if (process.env.NODE_ENV === "production") {
  app.use("*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.error(
    isDemoMode()
      ? `api on :${port} — DEMO MODE (sample data; add Terra credentials in .env to go live)`
      : `api on :${port} — live Terra API`,
  );
});
