/**
 * API assembly. The chained .route() calls + `export type AppType` are the
 * whole client contract - the React app consumes it via hc<AppType>, no
 * codegen. Don't break the chain.
 */
import { Hono } from "hono";
import { logger } from "hono/logger";
import { isDemoMode, webhookSecret } from "./lib/env";
import { userRoutes } from "./routes/users";
import { webhookRoutes } from "./routes/webhook";

const app = new Hono();
app.use(logger());

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed as `typeof routes` below
const routes = app
  .get("/api/health", (c) =>
    c.json({
      ok: true,
      demo: isDemoMode(),
      webhooks: Boolean(webhookSecret()),
    }),
  )
  .route("/api/users", userRoutes)
  .route("/api/webhook", webhookRoutes);

export type AppType = typeof routes;
export default app;
